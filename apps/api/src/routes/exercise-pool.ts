// Exercise Pool Routes — STEPN-style daily exercise staking pool
//
// Routes:
// POST /exercise-pool/join        — Join today's pool
// POST /exercise-pool/submit-proof — Submit exercise completion proof
// GET  /exercise-pool/current      — Get current pool status
// GET  /exercise-pool/history      — Get user's pool history
// GET  /exercise-pool/stats        — Get user's pool statistics
// GET  /exercise-pool/leaderboard  — Top exercisers
// GET  /exercise-pool/status       — User's current pool status

import { Hono } from "hono";
import { exercisePoolService } from "../services/exercise-pool";
import { POOL_MESSAGES, EXERCISE_POOL_CONFIG } from "../../../../packages/shared/types/exercise-pool-types";
import type { ExerciseProof, ExerciseType, ExerciseDataSource } from "../../../../packages/shared/types/exercise-pool-types";

const exercisePoolRouter = new Hono();

// ── POST /exercise-pool/join — Join today's pool ──
exercisePoolRouter.post("/join", async (c) => {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }, 401);
    }

    const result = await exercisePoolService.joinPool(userId);

    return c.json({
      success: true,
      data: {
        poolId: result.poolId,
        status: result.status,
        stakedAmount: EXERCISE_POOL_CONFIG.STAKE_AMOUNT,
        message: POOL_MESSAGES.STAKE_SUCCESS.en,
      },
    });
  } catch (error: any) {
    console.error("Exercise pool join error:", error);

    // Map known errors to proper responses
    const errorMap: Record<string, { code: string; status: number }> = {
      [POOL_MESSAGES.ALREADY_STAKED.en]: { code: "ALREADY_STAKED", status: 400 },
      [POOL_MESSAGES.STAKING_CLOSED.en]: { code: "STAKING_CLOSED", status: 400 },
      [POOL_MESSAGES.POOL_NOT_ACTIVE.en]: { code: "POOL_NOT_ACTIVE", status: 404 },
      [POOL_MESSAGES.INSUFFICIENT_BALANCE.en]: { code: "INSUFFICIENT_BALANCE", status: 400 },
      [POOL_MESSAGES.NOT_PARTICIPANT.en]: { code: "USER_NOT_FOUND", status: 404 },
    };

    const mapped = errorMap[error.message];
    if (mapped) {
      return c.json({
        success: false,
        error: { code: mapped.code, message: error.message },
      }, mapped.status as any);
    }

    return c.json({
      success: false,
      error: { code: "JOIN_ERROR", message: error.message },
    }, 500);
  }
});

// ── POST /exercise-pool/submit-proof — Submit exercise completion proof ──
exercisePoolRouter.post("/submit-proof", async (c) => {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }, 401);
    }

    const body = await c.req.json();

    // Validate required fields
    if (!body.proof) {
      return c.json({
        success: false,
        error: {
          code: "INVALID_PROOF",
          message: "Exercise proof data is required",
        },
      }, 400);
    }

    const { proof } = body;

    // Validate proof structure
    if (!proof.duration || typeof proof.duration !== "number") {
      return c.json({
        success: false,
        error: {
          code: "INVALID_DURATION",
          message: "Exercise duration (in minutes) is required",
        },
      }, 400);
    }

    const validTypes: ExerciseType[] = [
      "walking", "running", "cycling", "gym", "yoga", "swimming", "hiking", "other",
    ];
    if (!proof.type || !validTypes.includes(proof.type)) {
      return c.json({
        success: false,
        error: {
          code: "INVALID_EXERCISE_TYPE",
          message: `Exercise type must be one of: ${validTypes.join(", ")}`,
        },
      }, 400);
    }

    const validSources: ExerciseDataSource[] = [
      "manual", "apple_watch", "galaxy_watch", "fitbit", "garmin", "google_fit",
    ];
    if (!proof.source || !validSources.includes(proof.source)) {
      return c.json({
        success: false,
        error: {
          code: "INVALID_SOURCE",
          message: `Data source must be one of: ${validSources.join(", ")}`,
        },
      }, 400);
    }

    if (!proof.startTime || !proof.endTime) {
      return c.json({
        success: false,
        error: {
          code: "INVALID_TIMESTAMPS",
          message: "Start time and end time are required",
        },
      }, 400);
    }

    const exerciseProof: ExerciseProof = {
      duration: proof.duration,
      type: proof.type,
      heartRateAvg: proof.heartRateAvg,
      heartRateMax: proof.heartRateMax,
      calories: proof.calories,
      steps: proof.steps,
      distance: proof.distance,
      source: proof.source,
      startTime: proof.startTime,
      endTime: proof.endTime,
      rawData: proof.rawData,
    };

    const result = await exercisePoolService.submitExerciseProof(userId, exerciseProof);

    const statusCode = result.verified ? 200 : 400;
    return c.json({
      success: result.verified,
      data: {
        verified: result.verified,
        message: result.message,
        exerciseMinutes: result.exerciseMinutes,
        warnings: result.warnings,
      },
    }, statusCode as any);
  } catch (error: any) {
    console.error("Exercise proof submission error:", error);
    return c.json({
      success: false,
      error: { code: "PROOF_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /exercise-pool/current — Get current pool status ──
exercisePoolRouter.get("/current", async (c) => {
  try {
    const pool = await exercisePoolService.getCurrentPool();

    if (!pool) {
      return c.json({
        success: true,
        data: null,
        message: POOL_MESSAGES.POOL_NOT_ACTIVE.en,
      });
    }

    return c.json({ success: true, data: pool });
  } catch (error: any) {
    console.error("Get current pool error:", error);
    return c.json({
      success: false,
      error: { code: "POOL_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /exercise-pool/history — Get user's pool history ──
exercisePoolRouter.get("/history", async (c) => {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }, 401);
    }

    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

    const history = await exercisePoolService.getUserPoolHistory(userId, page, limit);

    return c.json({
      success: true,
      data: history,
      meta: { page, limit },
    });
  } catch (error: any) {
    console.error("Get pool history error:", error);
    return c.json({
      success: false,
      error: { code: "HISTORY_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /exercise-pool/stats — Get user's pool statistics ──
exercisePoolRouter.get("/stats", async (c) => {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }, 401);
    }

    const stats = await exercisePoolService.getUserPoolStats(userId);

    return c.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Get pool stats error:", error);
    return c.json({
      success: false,
      error: { code: "STATS_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /exercise-pool/leaderboard — Top exercisers ──
exercisePoolRouter.get("/leaderboard", async (c) => {
  try {
    const period = (c.req.query("period") || "weekly") as "daily" | "weekly" | "monthly" | "all_time";
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

    const validPeriods = ["daily", "weekly", "monthly", "all_time"];
    if (!validPeriods.includes(period)) {
      return c.json({
        success: false,
        error: {
          code: "INVALID_PERIOD",
          message: `Period must be one of: ${validPeriods.join(", ")}`,
        },
      }, 400);
    }

    const leaderboard = await exercisePoolService.getLeaderboard(period, limit);

    return c.json({
      success: true,
      data: {
        period,
        entries: leaderboard,
        totalParticipants: leaderboard.length,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Get leaderboard error:", error);
    return c.json({
      success: false,
      error: { code: "LEADERBOARD_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /exercise-pool/status — User's current pool status ──
exercisePoolRouter.get("/status", async (c) => {
  try {
    const userId = c.get("userId") as string;
    if (!userId) {
      return c.json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }, 401);
    }

    const status = await exercisePoolService.getUserCurrentPoolStatus(userId);

    return c.json({ success: true, data: status });
  } catch (error: any) {
    console.error("Get user pool status error:", error);
    return c.json({
      success: false,
      error: { code: "STATUS_ERROR", message: error.message },
    }, 500);
  }
});

export { exercisePoolRouter };
