// @health-journal/shared/types — Shared types for the entire team

// ── FHIR R4 Types ──
export interface FHIRCoding {
  system: string; code: string; display: string;
}
export interface FHIRCodeableConcept {
  coding: FHIRCoding[]; text?: string;
}
export interface FHIRCondition {
  resourceType: "Condition"; id: string;
  code: FHIRCodeableConcept;
  severity?: FHIRCodeableConcept;
  bodySite?: FHIRCodeableConcept[];
  onsetDateTime?: string;
  clinicalStatus?: FHIRCodeableConcept;
  note?: { text: string }[];
}
export interface FHIRObservation {
  resourceType: "Observation"; id: string;
  code: FHIRCodeableConcept;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  valueString?: string; effectiveDateTime?: string;
}
export interface FHIRMedicationStatement {
  resourceType: "MedicationStatement"; id: string;
  medicationCodeableConcept: FHIRCodeableConcept;
  dosage?: { text: string; timing?: { repeat?: { frequency: number; period: number; periodUnit: string } }; route?: FHIRCodeableConcept }[];
  effectivePeriod?: { start: string; end?: string };
  status: "active" | "completed" | "stopped" | "unknown";
}
export type FHIRResource = FHIRCondition | FHIRObservation | FHIRMedicationStatement;
export interface FHIRBundleEntry { resource: FHIRResource; }
export interface FHIRBundle {
  resourceType: "Bundle"; type: "collection"; timestamp: string; entry: FHIRBundleEntry[];
}

// ── AI Scribe Types ──
export type SeverityLevel = "mild" | "moderate" | "severe" | "critical";
export type UrgencyLevel = "none" | "low" | "medium" | "high" | "emergency";
export interface SymptomExtraction {
  name: string; snomedCode: string; icdCode: string; severity: SeverityLevel;
  bodySite?: string; duration?: string; onsetDate?: string;
}
export interface MedicationExtraction {
  name: string; dosage?: string; frequency?: string; route?: string;
  status: "active" | "completed" | "stopped"; effectiveness?: "effective" | "ineffective" | "unknown";
}
export interface SafetyAlert {
  isEmergency: boolean; triggerSymptoms: string[];
  guidance: string; emergencyNumber: string;
}
export interface AIScribeResult {
  fhirBundle: FHIRBundle; symptoms: SymptomExtraction[]; medications: MedicationExtraction[];
  urgencyScore: number; urgencyLevel: UrgencyLevel; detailScore: number;
  educationResponse: string; safetyAlert?: SafetyAlert;
  ipfsHash?: string; onchainHash?: string;
  language: "ko" | "en"; processedAt: string;
}

// ── User & Auth ──
export type UserLevel = 1 | 2 | 3 | 4 | 5;
export interface User {
  id: string; walletAddress: string; didIdentifier?: string;
  streakDays: number; totalPoints: number; level: UserLevel;
  dataConsent: boolean; createdAt: Date; updatedAt: Date;
}
export const USER_LEVEL_CONFIG = {
  1: { title: "Health Rookie", titleKo: "Health Rookie", pointsRequired: 0 },
  2: { title: "Wellness Seeker", titleKo: "Wellness Seeker", pointsRequired: 500 },
  3: { title: "Health Guardian", titleKo: "Health Guardian", pointsRequired: 2000 },
  4: { title: "Vitality Master", titleKo: "Vitality Master", pointsRequired: 10000 },
  5: { title: "Health Oracle", titleKo: "Health Oracle", pointsRequired: 50000 },
} as const;

// ── Reward & Gamification ──
export type RewardType = "daily_checkin" | "detail_bonus" | "medication_checkin" | "quiz_correct" | "streak_bonus" | "referral" | "data_contribution" | "course_completion";
export const REWARD_AMOUNTS: Record<RewardType, number> = {
  daily_checkin: 10, detail_bonus: 5, medication_checkin: 3, quiz_correct: 5,
  streak_bonus: 0, referral: 100, data_contribution: 0, course_completion: 50,
};
export const STREAK_MULTIPLIERS = [
  { days: 90, multiplier: 500 }, { days: 30, multiplier: 300 },
  { days: 14, multiplier: 200 }, { days: 7, multiplier: 150 },
  { days: 3, multiplier: 120 }, { days: 0, multiplier: 100 },
] as const;
export const STREAK_BONUSES: Record<number, number> = { 7: 50, 30: 300 };

export interface RewardClaimRequest { walletAddress: string; rewardType: RewardType; detailScore?: number; entryId?: string; }
export interface RewardClaimSignature { amount: string; nonce: string; deadline: number; signature: string; }
export interface RewardTransaction {
  id: string; userId: string; txHash?: string; amount: string;
  rewardType: RewardType; status: "pending" | "confirmed" | "failed"; createdAt: Date;
}
export interface PointTransaction {
  id: string; userId: string; amount: number;
  type: "HEALTH_LOG" | "QUIZ_CORRECT" | "STREAK_BONUS" | "DAILY_TIP_VIEW" | "REPORT_PURCHASE" | "REFERRAL";
  description?: string; createdAt: Date;
}

// ── Health Entry ──
export interface HealthEntry {
  id: string; userId: string; rawInput: string; fhirBundle: FHIRBundle;
  aiResponse: string; ipfsHash?: string; onchainHash?: string;
  detailScore: number; pointsEarned: number; entryDate: string; createdAt: Date;
}
export interface HealthEntryCreateRequest { message: string; language?: "ko" | "en"; }
export interface HealthEntryResponse {
  entry: HealthEntry; aiResult: AIScribeResult; rewardEarned: number;
  currentStreak: number; newLevel?: UserLevel;
}

// ── Symptom Analytics ──
export interface SymptomTrend { snomedCode: string; displayName: string; occurrences: number; dates: string[]; avgSeverity: number; }
export interface HealthAnalytics {
  recentSymptoms: SymptomTrend[]; topSymptoms: SymptomTrend[];
  streakHistory: { date: string; logged: boolean }[];
  weeklyEntryCount: number; monthlyEntryCount: number; aiInsight?: string;
}

// ── Medication Reminder ──
export type ReminderSource = "manual" | "hospital_sync" | "ai_parsed";
export interface ReminderFrequency { times: string[]; daysOfWeek?: number[]; instruction?: string; }
export interface MedicationReminder {
  id: string; userId: string; medicationName: string; dosage?: string;
  frequency: ReminderFrequency; startDate: string; endDate?: string;
  source: ReminderSource; isActive: boolean; createdAt: Date;
}
export interface ReminderCreateRequest { medicationName: string; dosage?: string; frequency: ReminderFrequency; startDate: string; endDate?: string; }

// ── Data Consent ──
export interface ConsentScope { symptoms: boolean; medications: boolean; vitals: boolean; labResults: boolean; demographics: boolean; }
export interface DataConsent {
  id: string; userId: string; grantee: string; granteeName?: string;
  scope: ConsentScope; txHash?: string; grantedAt: Date; revokedAt?: Date; expiresAt?: Date;
}

// ── Education ──
export type EducationContentType = "daily_tip" | "quiz" | "course" | "seasonal";
export interface DailyTip { id: string; title: string; titleKo: string; content: string; contentKo: string; category: string; relatedSnomedCodes?: string[]; }
export interface Quiz {
  id: string; question: string; questionKo: string; options: { text: string; textKo: string }[];
  correctIndex: number; explanation: string; explanationKo: string; category: string;
  difficulty: "easy" | "medium" | "hard"; rewardAmount: number;
}
export interface QuizSubmission { quizId: string; selectedIndex: number; }
export interface QuizResult { correct: boolean; correctIndex: number; explanation: string; rewardEarned: number; }

// ── Data Marketplace ──
export interface ResearchDataset {
  id: string; title: string; description: string; category: string;
  sampleSize: number; dateRange: { start: string; end: string };
  priceH2E: string; priceBNB: string; format: "json" | "csv";
  anonymizationLevel: "k10" | "k50" | "k100"; createdAt: Date;
}
export const DATA_REVENUE_SPLIT = { users: 60, platform: 25, hospitals: 10, treasury: 5 } as const;

// ── Hospital Plugin Interface (DEFERRED) ──
export interface IHospitalAdapter {
  authenticate(credentials: HospitalCredentials): Promise<HospitalAuthToken>;
  fetchPatientRecords(patientDid: string, token: HospitalAuthToken, scope: ConsentScope): Promise<FHIRBundle>;
  pushHealthData(patientDid: string, data: FHIRBundle, token: HospitalAuthToken): Promise<HospitalSyncResult>;
  fetchPrescriptions(patientDid: string, token: HospitalAuthToken): Promise<FHIRMedicationStatement[]>;
  emergencyShare(patientDid: string, healthSummary: FHIRBundle, hospitalId: string): Promise<EmergencyShareResult>;
  healthCheck(): Promise<boolean>;
}
export interface HospitalCredentials { hospitalId: string; apiEndpoint: string; clientId: string; clientSecret: string; fhirVersion: "R4"; }
export interface HospitalAuthToken { accessToken: string; expiresAt: number; hospitalId: string; }
export interface HospitalSyncResult { success: boolean; syncedResourceCount: number; errors?: string[]; syncTimestamp: string; }
export interface EmergencyShareResult { success: boolean; accessCode: string; expiresAt: number; hospitalName: string; }

export class NullHospitalAdapter implements IHospitalAdapter {
  async authenticate(): Promise<HospitalAuthToken> { throw new Error("Hospital integration not configured"); }
  async fetchPatientRecords(): Promise<FHIRBundle> { return { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), entry: [] }; }
  async pushHealthData(): Promise<HospitalSyncResult> { return { success: false, syncedResourceCount: 0, errors: ["Not configured"], syncTimestamp: new Date().toISOString() }; }
  async fetchPrescriptions(): Promise<FHIRMedicationStatement[]> { return []; }
  async emergencyShare(): Promise<EmergencyShareResult> { throw new Error("Hospital integration not configured"); }
  async healthCheck(): Promise<boolean> { return false; }
}

// ── Contract Addresses ──
export interface ContractAddresses {
  h2eToken: `0x${string}`; healthReward: `0x${string}`; healthBadge: `0x${string}`;
  dataConsent: `0x${string}`; dataMarketplace: `0x${string}`; h2eVesting: `0x${string}`;
  exercisePool: `0x${string}`;
}
export const BSC_TESTNET_ADDRESSES: ContractAddresses = {
  h2eToken: "0x0000000000000000000000000000000000000000", healthReward: "0x0000000000000000000000000000000000000000",
  healthBadge: "0x0000000000000000000000000000000000000000", dataConsent: "0x0000000000000000000000000000000000000000",
  dataMarketplace: "0x0000000000000000000000000000000000000000", h2eVesting: "0x0000000000000000000000000000000000000000",
  exercisePool: "0x0000000000000000000000000000000000000000",
};

// ── API Types ──
export interface APIResponse<T = unknown> { success: boolean; data?: T; error?: { code: string; message: string }; }
export interface PaginationParams { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc"; }

// ── Report Types (re-exported) ──
export type {
  PersonalizedReport,
  ReportPeriod,
  ReportOverview,
  ReportSymptomAnalysis,
  ReportPatternInsights,
  ReportMedicationReview,
  ReportAIRecommendations,
  TopSymptomEntry,
  SeverityDistribution,
  SymptomTrendDirection,
  CorrelationEntry,
  MedicationInteraction,
  ReportGenerationOptions,
  ReportHistoryEntry,
  ReportTier,
} from "./report-types";
export { REPORT_TIER_LIMITS } from "./report-types";

// ── Exercise Pool Types (re-exported) ──
export type {
  ExerciseType,
  ExerciseDataSource,
  PoolState,
  PoolStatus,
  PoolSummary,
  PoolParticipant,
  UserPoolStatus,
  ExerciseProof,
  ExerciseVerificationResult,
  ExerciseValidation,
  ExerciseFlagType,
  ExerciseFlag,
  PoolHistory,
  UserPoolStats,
  LeaderboardEntry,
  Leaderboard,
  JoinPoolRequest,
  JoinPoolResponse,
  SubmitProofRequest,
  SubmitProofResponse,
  ClaimRewardRequest,
  ClaimRewardResponse,
} from "./exercise-pool-types";
export { EXERCISE_POOL_CONFIG, POOL_MESSAGES } from "./exercise-pool-types";
