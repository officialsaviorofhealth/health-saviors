// Exercise Pool Service — STEPN-style daily exercise staking pool
//
// Core flow:
// 1. createDailyPool() — Cron: create pool at midnight UTC
// 2. joinPool() — User stakes points
// 3. submitExerciseProof() — User submits exercise data
// 4. settleCurrentPool() — Cron: settle pool, distribute rewards

import type { PrismaClient } from "@prisma/client";
import type {
  ExerciseProof,
  ExerciseValidation,
  ExerciseFlag,
  ExerciseVerificationResult,
  PoolStatus,
  PoolHistory,
  UserPoolStats,
  LeaderboardEntry,
  PoolState,
  ExerciseType,
} from "../../../../packages/shared/types/exercise-pool-types";
import { EXERCISE_POOL_CONFIG, POOL_MESSAGES } from "../../../../packages/shared/types/exercise-pool-types";

export class ExercisePoolService {
  private prisma: PrismaClient | null = null;

  constructor() {
    // No blockchain dependencies needed — all pool logic is DB-based
  }

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ── Pool Lifecycle ──

  /// Create today's exercise pool (called by cron at midnight UTC)
  async createDailyPool(): Promise<{ poolId: number; startTime: Date; endTime: Date }> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check if pool already exists for today
    const existing = await this.prisma.exercisePool.findUnique({
      where: { poolDate: today },
    });
    if (existing) {
      return { poolId: existing.id, startTime: existing.startTime, endTime: existing.endTime };
    }

    const startTime = new Date(today);
    const endTime = new Date(today);
    endTime.setUTCHours(23, 59, 59, 999);

    // Create in database
    const pool = await this.prisma.exercisePool.create({
      data: {
        poolDate: today,
        onchainPoolId: null,
        startTime,
        endTime,
      },
    });

    return { poolId: pool.id, startTime: pool.startTime, endTime: pool.endTime };
  }

  /// Join today's pool (stake points)
  async joinPool(userId: string): Promise<{ poolId: number; status: string }> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error(POOL_MESSAGES.NOT_PARTICIPANT.en);

    // Get or create today's pool
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let pool = await this.prisma.exercisePool.findUnique({ where: { poolDate: today } });

    if (!pool) {
      const created = await this.createDailyPool();
      pool = await this.prisma.exercisePool.findUnique({ where: { id: created.poolId } });
      if (!pool) throw new Error(POOL_MESSAGES.POOL_NOT_ACTIVE.en);
    }

    // Check if staking window is open (first 12 hours)
    const now = new Date();
    const stakingDeadline = new Date(pool.startTime);
    stakingDeadline.setHours(stakingDeadline.getHours() + EXERCISE_POOL_CONFIG.STAKING_WINDOW_HOURS);
    if (now > stakingDeadline || now > pool.endTime) {
      throw new Error(POOL_MESSAGES.STAKING_CLOSED.en);
    }

    // Check if already staked
    const existing = await this.prisma.exercisePoolParticipant.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId } },
    });
    if (existing) {
      throw new Error(POOL_MESSAGES.ALREADY_STAKED.en);
    }

    // Check user's point balance
    if (Number(user.totalPoints) < Number(EXERCISE_POOL_CONFIG.STAKE_AMOUNT)) {
      throw new Error(POOL_MESSAGES.INSUFFICIENT_BALANCE.en);
    }

    // Deduct stake points from user
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { decrement: Number(EXERCISE_POOL_CONFIG.STAKE_AMOUNT) } },
    });

    // Record participation in database
    const participant = await this.prisma.exercisePoolParticipant.create({
      data: {
        poolId: pool.id,
        userId,
        walletAddress: user.walletAddress,
        stakedAmount: EXERCISE_POOL_CONFIG.STAKE_AMOUNT,
        stakeTxHash: `points_${Date.now()}_${userId.slice(0, 8)}`,
      },
    });

    // Update pool stats
    await this.prisma.exercisePool.update({
      where: { id: pool.id },
      data: {
        totalStaked: { increment: Number(EXERCISE_POOL_CONFIG.STAKE_AMOUNT) },
        participantCount: { increment: 1 },
      },
    });

    return { poolId: pool.id, status: "joined" };
  }

  // ── Exercise Proof Submission ──

  /// Submit exercise proof (manual check-in or wearable data)
  async submitExerciseProof(
    userId: string,
    proof: ExerciseProof,
  ): Promise<ExerciseVerificationResult> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    // Get today's pool
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const pool = await this.prisma.exercisePool.findUnique({
      where: { poolDate: today },
    });

    if (!pool) {
      return {
        verified: false,
        message: POOL_MESSAGES.POOL_NOT_ACTIVE.en,
        exerciseMinutes: 0,
      };
    }

    // Check if user is a participant
    const participant = await this.prisma.exercisePoolParticipant.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId } },
    });

    if (!participant) {
      return {
        verified: false,
        message: POOL_MESSAGES.NOT_PARTICIPANT.en,
        exerciseMinutes: 0,
      };
    }

    if (participant.completed) {
      return {
        verified: false,
        message: POOL_MESSAGES.ALREADY_COMPLETED.en,
        exerciseMinutes: participant.exerciseMinutes,
      };
    }

    // Validate exercise data (anti-cheat)
    const validation = this.validateExerciseData(proof);

    if (!validation.valid) {
      // Save flags but don't mark as complete
      await this.prisma.exercisePoolParticipant.update({
        where: { id: participant.id },
        data: {
          antiCheatFlags: validation.flags as any,
          proofData: proof as any,
        },
      });

      return {
        verified: false,
        message: validation.reason || POOL_MESSAGES.EXERCISE_NOT_VERIFIED.en,
        exerciseMinutes: proof.duration,
        warnings: validation.flags.map((f) => f.description),
      };
    }

    // Check minimum duration
    if (proof.duration < EXERCISE_POOL_CONFIG.MIN_EXERCISE_DURATION_MINUTES) {
      return {
        verified: false,
        message: POOL_MESSAGES.EXERCISE_TOO_SHORT.en,
        exerciseMinutes: proof.duration,
      };
    }

    const now = new Date();

    // Mark as completed in database
    await this.prisma.exercisePoolParticipant.update({
      where: { id: participant.id },
      data: {
        completed: true,
        exerciseMinutes: proof.duration,
        exerciseType: proof.type,
        heartRateAvg: proof.heartRateAvg || null,
        heartRateMax: proof.heartRateMax || null,
        caloriesBurned: proof.calories || null,
        steps: proof.steps || null,
        distance: proof.distance || null,
        dataSource: proof.source,
        proofData: proof as any,
        completedAt: now,
        verifiedAt: now,
        antiCheatFlags: validation.flags.length > 0 ? (validation.flags as any) : null,
      },
    });

    // Update pool completed count
    await this.prisma.exercisePool.update({
      where: { id: pool.id },
      data: {
        completedCount: { increment: 1 },
      },
    });

    // Calculate potential reward
    const potentialReward = await this.calculatePotentialReward(pool.id);

    return {
      verified: true,
      message: POOL_MESSAGES.EXERCISE_VERIFIED.en,
      exerciseMinutes: proof.duration,
      warnings: validation.flags.length > 0
        ? validation.flags.filter((f) => f.severity === "low").map((f) => f.description)
        : undefined,
    };
  }

  // ── Anti-Cheat Validation ──

  /// Validate exercise data for plausibility
  private validateExerciseData(proof: ExerciseProof): ExerciseValidation {
    const flags: ExerciseFlag[] = [];
    let confidence = 100;

    const startTime = new Date(proof.startTime);
    const endTime = new Date(proof.endTime);
    const now = new Date();

    // 1. Future timestamp check
    if (startTime > now || endTime > now) {
      flags.push({
        type: "future_timestamp",
        severity: "high",
        description: "Exercise timestamps are in the future",
      });
      confidence -= 50;
    }

    // 2. Duration consistency: endTime - startTime should match reported duration
    const calculatedDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    if (Math.abs(calculatedDuration - proof.duration) > 5) {
      flags.push({
        type: "timing_mismatch",
        severity: "medium",
        description: `Reported duration (${proof.duration}min) doesn't match timestamps (${Math.round(calculatedDuration)}min)`,
      });
      confidence -= 20;
    }

    // 3. Duration too long
    if (proof.duration > EXERCISE_POOL_CONFIG.MAX_EXERCISE_DURATION_MINUTES) {
      flags.push({
        type: "duration_too_long",
        severity: "medium",
        description: `Exercise duration (${proof.duration}min) exceeds maximum (${EXERCISE_POOL_CONFIG.MAX_EXERCISE_DURATION_MINUTES}min)`,
      });
      confidence -= 15;
    }

    // 4. Duration too short
    if (proof.duration < EXERCISE_POOL_CONFIG.MIN_EXERCISE_DURATION_MINUTES) {
      flags.push({
        type: "duration_too_short",
        severity: "high",
        description: `Exercise duration (${proof.duration}min) is less than required (${EXERCISE_POOL_CONFIG.MIN_EXERCISE_DURATION_MINUTES}min)`,
      });
      confidence -= 40;
    }

    // 5. Heart rate plausibility (if provided)
    if (proof.heartRateAvg !== undefined) {
      if (proof.heartRateAvg < EXERCISE_POOL_CONFIG.MIN_HEART_RATE) {
        flags.push({
          type: "heart_rate_too_low",
          severity: "high",
          description: `Average heart rate (${proof.heartRateAvg} bpm) is below minimum (${EXERCISE_POOL_CONFIG.MIN_HEART_RATE} bpm)`,
        });
        confidence -= 30;
      }

      if (proof.heartRateAvg > EXERCISE_POOL_CONFIG.MAX_HEART_RATE) {
        flags.push({
          type: "heart_rate_too_high",
          severity: "high",
          description: `Average heart rate (${proof.heartRateAvg} bpm) exceeds maximum (${EXERCISE_POOL_CONFIG.MAX_HEART_RATE} bpm)`,
        });
        confidence -= 30;
      }

      // For active exercise types, HR should be elevated
      const activeTypes: ExerciseType[] = ["running", "cycling", "swimming", "hiking"];
      if (
        activeTypes.includes(proof.type) &&
        proof.heartRateAvg < EXERCISE_POOL_CONFIG.MIN_EXERCISE_HEART_RATE
      ) {
        flags.push({
          type: "heart_rate_implausible",
          severity: "medium",
          description: `Heart rate (${proof.heartRateAvg} bpm) seems low for ${proof.type}`,
        });
        confidence -= 15;
      }
    }

    // 6. Calorie plausibility (if provided)
    if (proof.calories !== undefined && proof.duration > 0) {
      const caloriesPerMinute = proof.calories / proof.duration;

      if (caloriesPerMinute > EXERCISE_POOL_CONFIG.MAX_CALORIES_PER_MINUTE) {
        flags.push({
          type: "impossible_calories",
          severity: "high",
          description: `Calories per minute (${caloriesPerMinute.toFixed(1)}) exceeds maximum (${EXERCISE_POOL_CONFIG.MAX_CALORIES_PER_MINUTE})`,
        });
        confidence -= 25;
      }

      if (caloriesPerMinute < EXERCISE_POOL_CONFIG.MIN_CALORIES_PER_MINUTE && proof.type !== "yoga") {
        flags.push({
          type: "impossible_calories",
          severity: "low",
          description: `Calories per minute (${caloriesPerMinute.toFixed(1)}) seems too low for ${proof.type}`,
        });
        confidence -= 10;
      }
    }

    // 7. Wearable data gets higher trust
    if (proof.source !== "manual") {
      confidence = Math.min(confidence + 10, 100);
    }

    // Determine validity based on confidence
    const highSeverityFlags = flags.filter((f) => f.severity === "high");
    const valid = highSeverityFlags.length === 0 && confidence >= 40;

    return {
      valid,
      reason: valid ? undefined : highSeverityFlags[0]?.description || "Exercise data validation failed",
      confidence: Math.max(confidence, 0),
      flags,
    };
  }

  // ── Pool Status & Queries ──

  /// Get current pool status
  async getCurrentPool(): Promise<PoolStatus | null> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const pool = await this.prisma.exercisePool.findUnique({
      where: { poolDate: today },
    });

    if (!pool) return null;

    const now = new Date();
    const stakingDeadline = new Date(pool.startTime);
    stakingDeadline.setHours(stakingDeadline.getHours() + EXERCISE_POOL_CONFIG.STAKING_WINDOW_HOURS);

    let state: PoolState;
    if (pool.settled) {
      state = "settled";
    } else if (now > pool.endTime) {
      state = "ended";
    } else if (now > stakingDeadline) {
      state = "staking_closed";
    } else {
      state = "active";
    }

    const timeRemaining = Math.max(0, Math.floor((pool.endTime.getTime() - now.getTime()) / 1000));

    // Calculate estimated reward
    const estimatedReward = await this.calculatePotentialReward(pool.id);

    return {
      poolId: pool.id,
      poolDate: pool.poolDate.toISOString().split("T")[0],
      startTime: pool.startTime.toISOString(),
      endTime: pool.endTime.toISOString(),
      state,
      totalStaked: pool.totalStaked.toString(),
      participantCount: pool.participantCount,
      completedCount: pool.completedCount,
      settled: pool.settled,
      stakingOpen: state === "active",
      estimatedRewardPerCompleter: estimatedReward.toString(),
      timeRemaining,
    };
  }

  /// Get user's pool history
  async getUserPoolHistory(userId: string, page = 1, limit = 20): Promise<PoolHistory[]> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const participants = await this.prisma.exercisePoolParticipant.findMany({
      where: { userId },
      include: { pool: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return participants.map((p) => {
      let result: "won" | "lost" | "refunded" | "pending";
      if (!p.pool.settled) {
        result = "pending";
      } else if (p.completed && p.rewardAmount && Number(p.rewardAmount) > Number(p.stakedAmount)) {
        result = "won";
      } else if (p.completed && p.rewardAmount && Number(p.rewardAmount) === Number(p.stakedAmount)) {
        result = "refunded";
      } else {
        result = "lost";
      }

      return {
        poolId: p.pool.id,
        poolDate: p.pool.poolDate.toISOString().split("T")[0],
        staked: true,
        completed: p.completed,
        exerciseMinutes: p.exerciseMinutes,
        exerciseType: p.exerciseType as ExerciseType | undefined,
        rewardAmount: p.rewardAmount?.toString(),
        claimed: p.claimed,
        result,
      };
    });
  }

  /// Get user's pool statistics
  async getUserPoolStats(userId: string): Promise<UserPoolStats> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const allParticipations = await this.prisma.exercisePoolParticipant.findMany({
      where: { userId },
      include: { pool: { select: { settled: true } } },
      orderBy: { createdAt: "desc" },
    });

    const settledParticipations = allParticipations.filter((p) => p.pool.settled);
    const completedPools = settledParticipations.filter((p) => p.completed);
    const failedPools = settledParticipations.filter((p) => !p.completed);

    const totalStaked = allParticipations.reduce(
      (sum, p) => sum + Number(p.stakedAmount),
      0,
    );
    const totalRewards = completedPools.reduce(
      (sum, p) => sum + Number(p.rewardAmount || 0),
      0,
    );
    const totalLost = failedPools.reduce(
      (sum, p) => sum + Number(p.stakedAmount),
      0,
    );

    // Calculate current streak
    let currentStreak = 0;
    for (const p of allParticipations) {
      if (p.completed) currentStreak++;
      else break;
    }

    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    for (const p of [...allParticipations].reverse()) {
      if (p.completed) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Favorite exercise type
    const exerciseTypeCounts = new Map<string, number>();
    for (const p of completedPools) {
      if (p.exerciseType) {
        exerciseTypeCounts.set(
          p.exerciseType,
          (exerciseTypeCounts.get(p.exerciseType) || 0) + 1,
        );
      }
    }
    let favoriteExerciseType: ExerciseType | undefined;
    let maxCount = 0;
    for (const [type, count] of exerciseTypeCounts) {
      if (count > maxCount) {
        maxCount = count;
        favoriteExerciseType = type as ExerciseType;
      }
    }

    // Average exercise minutes
    const avgMinutes =
      completedPools.length > 0
        ? completedPools.reduce((sum, p) => sum + p.exerciseMinutes, 0) / completedPools.length
        : 0;

    return {
      totalPoolsJoined: allParticipations.length,
      totalPoolsCompleted: completedPools.length,
      totalPoolsFailed: failedPools.length,
      completionRate:
        settledParticipations.length > 0
          ? Math.round((completedPools.length / settledParticipations.length) * 100)
          : 0,
      totalStaked: totalStaked.toString(),
      totalRewardsEarned: totalRewards.toString(),
      totalLost: totalLost.toString(),
      netProfit: (totalRewards - totalStaked).toString(),
      currentStreak,
      bestStreak,
      favoriteExerciseType,
      avgExerciseMinutes: Math.round(avgMinutes),
    };
  }

  /// Calculate potential reward for a pool
  async calculatePotentialReward(poolId: number): Promise<number> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const pool = await this.prisma.exercisePool.findUnique({ where: { id: poolId } });
    if (!pool || pool.participantCount === 0) return 0;

    const stakeAmount = Number(EXERCISE_POOL_CONFIG.STAKE_AMOUNT);

    // If everyone completes, everyone gets their stake back
    if (pool.completedCount === pool.participantCount) return stakeAmount;

    // If nobody completed yet, estimate assuming caller will be the only completer
    const completedCount = Math.max(pool.completedCount, 1);
    const failedCount = pool.participantCount - completedCount;
    const failedStakes = failedCount * stakeAmount;
    const platformFee = (failedStakes * EXERCISE_POOL_CONFIG.PLATFORM_FEE_PERCENT) / 100;
    const rewardPool = failedStakes - platformFee;

    return stakeAmount + rewardPool / completedCount;
  }

  // ── Pool Settlement ──

  /// Settle the current pool (cron job at midnight UTC)
  async settleCurrentPool(): Promise<void> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    // Find unsettled pools that have ended
    const now = new Date();
    const unsettledPools = await this.prisma.exercisePool.findMany({
      where: {
        settled: false,
        endTime: { lt: now },
      },
      include: {
        participants: true,
      },
    });

    for (const pool of unsettledPools) {
      await this.settlePool(pool.id);
    }
  }

  /// Settle a specific pool
  async settlePool(poolId: number): Promise<void> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const pool = await this.prisma.exercisePool.findUnique({
      where: { id: poolId },
      include: { participants: true },
    });

    if (!pool || pool.settled) return;

    const stakeAmount = Number(EXERCISE_POOL_CONFIG.STAKE_AMOUNT);
    const completers = pool.participants.filter((p) => p.completed);
    const failedCount = pool.participantCount - completers.length;

    let rewardPerCompleter = 0;
    let platformFee = 0;
    let totalReward = 0;

    if (pool.participantCount === 0) {
      // No participants
    } else if (completers.length === 0) {
      // Nobody completed — all goes to platform
      platformFee = pool.participantCount * stakeAmount;
    } else if (completers.length === pool.participantCount) {
      // Everyone completed — everyone gets stake back
      rewardPerCompleter = stakeAmount;
      totalReward = completers.length * stakeAmount;
    } else {
      // Mixed: completers share loser stakes minus fee
      const failedStakes = failedCount * stakeAmount;
      platformFee = (failedStakes * EXERCISE_POOL_CONFIG.PLATFORM_FEE_PERCENT) / 100;
      const rewardPool = failedStakes - platformFee;
      rewardPerCompleter = stakeAmount + rewardPool / completers.length;
      totalReward = rewardPool;
    }

    // Update completer rewards and credit points to user accounts
    for (const completer of completers) {
      await this.prisma.exercisePoolParticipant.update({
        where: { id: completer.id },
        data: { rewardAmount: rewardPerCompleter },
      });

      // Credit reward points to user
      await this.prisma.user.update({
        where: { id: completer.userId },
        data: { totalPoints: { increment: rewardPerCompleter } },
      });
    }

    // Mark pool as settled
    await this.prisma.exercisePool.update({
      where: { id: poolId },
      data: {
        settled: true,
        settledAt: new Date(),
        totalReward,
        platformFee,
        settleTxHash: null,
      },
    });

    console.log(
      `Pool #${poolId} settled: ${completers.length}/${pool.participantCount} completed, ` +
        `reward per completer: ${rewardPerCompleter}, platform fee: ${platformFee}`,
    );
  }

  // ── Leaderboard ──

  /// Get exercise pool leaderboard
  async getLeaderboard(
    period: "daily" | "weekly" | "monthly" | "all_time" = "weekly",
    limit = 20,
  ): Promise<LeaderboardEntry[]> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "daily":
        startDate = new Date(now);
        startDate.setUTCHours(0, 0, 0, 0);
        break;
      case "weekly":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "monthly":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "all_time":
      default:
        startDate = new Date(0);
        break;
    }

    // Aggregate user stats
    const participations = await this.prisma.exercisePoolParticipant.findMany({
      where: {
        createdAt: { gte: startDate },
        pool: { settled: true },
      },
      include: {
        user: { select: { id: true, walletAddress: true } },
      },
    });

    // Group by user
    const userStatsMap = new Map<
      string,
      {
        userId: string;
        walletAddress: string;
        totalCompleted: number;
        totalParticipated: number;
        totalRewards: number;
        exerciseTypes: Map<string, number>;
      }
    >();

    for (const p of participations) {
      const existing = userStatsMap.get(p.userId) || {
        userId: p.userId,
        walletAddress: p.user.walletAddress,
        totalCompleted: 0,
        totalParticipated: 0,
        totalRewards: 0,
        exerciseTypes: new Map<string, number>(),
      };

      existing.totalParticipated++;
      if (p.completed) {
        existing.totalCompleted++;
        existing.totalRewards += Number(p.rewardAmount || 0);
        if (p.exerciseType) {
          existing.exerciseTypes.set(
            p.exerciseType,
            (existing.exerciseTypes.get(p.exerciseType) || 0) + 1,
          );
        }
      }

      userStatsMap.set(p.userId, existing);
    }

    // Sort by total completed, then by total rewards
    const sorted = [...userStatsMap.values()]
      .sort((a, b) => {
        if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
        return b.totalRewards - a.totalRewards;
      })
      .slice(0, limit);

    return sorted.map((user, index) => {
      // Find favorite exercise
      let favoriteExercise: ExerciseType | undefined;
      let maxCount = 0;
      for (const [type, count] of user.exerciseTypes) {
        if (count > maxCount) {
          maxCount = count;
          favoriteExercise = type as ExerciseType;
        }
      }

      return {
        rank: index + 1,
        userId: user.userId,
        walletAddress: user.walletAddress,
        totalCompleted: user.totalCompleted,
        totalRewards: user.totalRewards.toString(),
        completionRate:
          user.totalParticipated > 0
            ? Math.round((user.totalCompleted / user.totalParticipated) * 100)
            : 0,
        currentStreak: 0, // Calculated separately if needed
        favoriteExercise,
      };
    });
  }

  /// Get user's status for current pool
  async getUserCurrentPoolStatus(userId: string): Promise<{
    joined: boolean;
    completed: boolean;
    poolId?: number;
    exerciseMinutes?: number;
    potentialReward?: string;
  }> {
    if (!this.prisma) throw new Error("Prisma not initialized");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const pool = await this.prisma.exercisePool.findUnique({
      where: { poolDate: today },
    });

    if (!pool) return { joined: false, completed: false };

    const participant = await this.prisma.exercisePoolParticipant.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId } },
    });

    if (!participant) return { joined: false, completed: false, poolId: pool.id };

    const potentialReward = await this.calculatePotentialReward(pool.id);

    return {
      joined: true,
      completed: participant.completed,
      poolId: pool.id,
      exerciseMinutes: participant.exerciseMinutes,
      potentialReward: potentialReward.toString(),
    };
  }
}

export const exercisePoolService = new ExercisePoolService();
