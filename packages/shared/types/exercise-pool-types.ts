// Exercise Pool Types — STEPN-style daily exercise staking pool

// ── Exercise Types ──

export type ExerciseType =
  | "walking"
  | "running"
  | "cycling"
  | "gym"
  | "yoga"
  | "swimming"
  | "hiking"
  | "other";

export type ExerciseDataSource =
  | "manual"
  | "apple_watch"
  | "galaxy_watch"
  | "fitbit"
  | "garmin"
  | "google_fit";

// ── Pool Status ──

export type PoolState = "active" | "staking_closed" | "ended" | "settled";

export interface PoolStatus {
  poolId: number;
  poolDate: string; // ISO date string
  startTime: string;
  endTime: string;
  state: PoolState;
  totalStaked: string; // Decimal string
  participantCount: number;
  completedCount: number;
  settled: boolean;
  stakingOpen: boolean;
  estimatedRewardPerCompleter: string;
  timeRemaining: number; // seconds
}

export interface PoolSummary {
  poolId: number;
  poolDate: string;
  totalStaked: string;
  participantCount: number;
  completedCount: number;
  completionRate: number; // percentage
  rewardPerCompleter: string;
  platformFee: string;
  settled: boolean;
}

// ── Participant ──

export interface PoolParticipant {
  userId: string;
  walletAddress: string;
  stakedAmount: string;
  completed: boolean;
  exerciseMinutes: number;
  exerciseType?: ExerciseType;
  heartRateAvg?: number;
  caloriesBurned?: number;
  dataSource: ExerciseDataSource;
  completedAt?: string;
  rewardAmount?: string;
  claimed: boolean;
}

export interface UserPoolStatus {
  poolId: number;
  staked: boolean;
  completed: boolean;
  stakedAt?: string;
  completedAt?: string;
  claimed: boolean;
  exerciseMinutes: number;
  exerciseType?: ExerciseType;
  rewardAmount?: string;
  potentialReward?: string;
}

// ── Exercise Proof ──

export interface ExerciseProof {
  duration: number; // minutes
  type: ExerciseType;
  heartRateAvg?: number; // bpm
  heartRateMax?: number; // bpm
  calories?: number; // kcal
  steps?: number;
  distance?: number; // meters
  source: ExerciseDataSource;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  rawData?: Record<string, unknown>; // Raw wearable data
}

export interface ExerciseVerificationResult {
  verified: boolean;
  message: string;
  messageKo: string;
  exerciseMinutes: number;
  warnings?: string[];
}

// ── Anti-Cheat ──

export interface ExerciseValidation {
  valid: boolean;
  reason?: string;
  reasonKo?: string;
  confidence: number; // 0-100
  flags: ExerciseFlag[];
}

export type ExerciseFlagType =
  | "duration_too_short"
  | "duration_too_long"
  | "heart_rate_implausible"
  | "heart_rate_too_low"
  | "heart_rate_too_high"
  | "timing_mismatch"
  | "duplicate_submission"
  | "impossible_calories"
  | "suspicious_pattern"
  | "future_timestamp"
  | "overlapping_exercise";

export interface ExerciseFlag {
  type: ExerciseFlagType;
  severity: "low" | "medium" | "high";
  description: string;
  descriptionKo: string;
}

// ── Pool History ──

export interface PoolHistory {
  poolId: number;
  poolDate: string;
  staked: boolean;
  completed: boolean;
  exerciseMinutes: number;
  exerciseType?: ExerciseType;
  rewardAmount?: string;
  claimed: boolean;
  result: "won" | "lost" | "refunded" | "pending";
}

export interface UserPoolStats {
  totalPoolsJoined: number;
  totalPoolsCompleted: number;
  totalPoolsFailed: number;
  completionRate: number;
  totalStaked: string;
  totalRewardsEarned: string;
  totalLost: string;
  netProfit: string;
  currentStreak: number; // consecutive completions
  bestStreak: number;
  favoriteExerciseType?: ExerciseType;
  avgExerciseMinutes: number;
}

// ── Leaderboard ──

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  walletAddress: string;
  displayName?: string;
  totalCompleted: number;
  totalRewards: string;
  completionRate: number;
  currentStreak: number;
  favoriteExercise?: ExerciseType;
}

export interface Leaderboard {
  period: "daily" | "weekly" | "monthly" | "all_time";
  entries: LeaderboardEntry[];
  totalParticipants: number;
  updatedAt: string;
}

// ── API Request/Response Types ──

export interface JoinPoolRequest {
  walletAddress: string;
}

export interface JoinPoolResponse {
  poolId: number;
  txHash: string;
  stakedAmount: string;
  poolEndTime: string;
  message: string;
  messageKo: string;
}

export interface SubmitProofRequest {
  proof: ExerciseProof;
}

export interface SubmitProofResponse {
  verified: boolean;
  message: string;
  messageKo: string;
  exerciseMinutes: number;
  potentialReward?: string;
  warnings?: string[];
}

export interface ClaimRewardRequest {
  poolId: number;
}

export interface ClaimRewardResponse {
  poolId: number;
  rewardAmount: string;
  txHash: string;
  message: string;
  messageKo: string;
}

// ── Pool Configuration ──

export const EXERCISE_POOL_CONFIG = {
  STAKE_AMOUNT: "100", // 100 tokens
  STAKE_AMOUNT_WEI: "100000000000000000000", // 100 * 1e18
  EXERCISE_DURATION_MINUTES: 30,
  POOL_DURATION_HOURS: 24,
  STAKING_WINDOW_HOURS: 12,
  PLATFORM_FEE_PERCENT: 5,
  MIN_PARTICIPANTS: 2,

  // Anti-cheat thresholds
  MIN_HEART_RATE: 50, // bpm — resting range
  MAX_HEART_RATE: 220, // bpm — absolute max
  MIN_EXERCISE_HEART_RATE: 70, // bpm — minimum during exercise
  MAX_EXERCISE_DURATION_MINUTES: 300, // 5 hours max
  MIN_EXERCISE_DURATION_MINUTES: 30, // minimum required
  MAX_CALORIES_PER_MINUTE: 25, // kcal — very intense exercise
  MIN_CALORIES_PER_MINUTE: 2, // kcal — light exercise
} as const;

// ── Messages ──

export const POOL_MESSAGES = {
  POOL_NOT_FOUND: {
    en: "Exercise pool not found.",
    ko: "Exercise pool not found.",
  },
  POOL_NOT_ACTIVE: {
    en: "No active exercise pool. Please wait for the next pool to start.",
    ko: "No active exercise pool. Please wait for the next pool to start.",
  },
  STAKING_CLOSED: {
    en: "Staking window has closed for this pool. Try the next pool.",
    ko: "Staking window has closed for this pool. Try the next pool.",
  },
  ALREADY_STAKED: {
    en: "You have already joined this pool.",
    ko: "You have already joined this pool.",
  },
  STAKE_SUCCESS: {
    en: "Successfully joined the exercise pool! Complete 30 minutes of exercise to earn rewards.",
    ko: "Successfully joined the exercise pool! Complete 30 minutes of exercise to earn rewards.",
  },
  EXERCISE_VERIFIED: {
    en: "Exercise completed and verified! You will receive your reward after pool settlement.",
    ko: "Exercise completed and verified! You will receive your reward after pool settlement.",
  },
  EXERCISE_TOO_SHORT: {
    en: "Exercise duration is less than 30 minutes. Keep going!",
    ko: "Exercise duration is less than 30 minutes. Keep going!",
  },
  EXERCISE_NOT_VERIFIED: {
    en: "Exercise could not be verified. Please check your data and try again.",
    ko: "Exercise could not be verified. Please check your data and try again.",
  },
  ALREADY_COMPLETED: {
    en: "Exercise already completed for this pool.",
    ko: "Exercise already completed for this pool.",
  },
  NOT_PARTICIPANT: {
    en: "You are not a participant in this pool.",
    ko: "You are not a participant in this pool.",
  },
  REWARD_CLAIMED: {
    en: "Reward successfully claimed!",
    ko: "Reward successfully claimed!",
  },
  POOL_NOT_SETTLED: {
    en: "Pool has not been settled yet. Please wait.",
    ko: "Pool has not been settled yet. Please wait.",
  },
  ANTI_CHEAT_FLAGGED: {
    en: "Your exercise data has been flagged for review. Please ensure accurate data submission.",
    ko: "Your exercise data has been flagged for review. Please ensure accurate data submission.",
  },
  INSUFFICIENT_BALANCE: {
    en: "Insufficient token balance. You need 100 tokens to join the pool.",
    ko: "Insufficient token balance. You need 100 tokens to join the pool.",
  },
} as const;
