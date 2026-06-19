// @health-journal/wearable-adapter — Wearable Device Types

// ── Wearable Data ──

export interface WearableData {
  source: WearableSource;
  userId: string;
  syncedAt: string;

  // Vital signs
  heartRate?: HeartRateData[];
  bloodOxygen?: BloodOxygenData[];
  bloodPressure?: BloodPressureData[];
  bodyTemperature?: TemperatureData[];

  // Activity
  steps?: StepsData;
  activeCalories?: number;
  exerciseMinutes?: number;
  standHours?: number;
  distance?: number; // meters
  floors?: number;

  // Sleep
  sleep?: SleepData;

  // Wellness
  stressLevel?: number; // 0-100
  mindfulMinutes?: number;
  menstrualCycle?: MenstrualData;
}

export type WearableSource =
  | "apple_health"
  | "samsung_health"
  | "fitbit"
  | "garmin"
  | "google_fit";

// ── Vital Signs Types ──

export interface HeartRateData {
  timestamp: string;
  bpm: number;
  context?: "resting" | "active" | "workout" | "sleep";
}

export interface BloodOxygenData {
  timestamp: string;
  spo2: number; // percentage
}

export interface BloodPressureData {
  timestamp: string;
  systolic: number;
  diastolic: number;
}

export interface TemperatureData {
  timestamp: string;
  celsius: number;
  location?: "wrist" | "ear" | "forehead";
}

// ── Activity Types ──

export interface StepsData {
  date: string;
  count: number;
  goal?: number;
}

// ── Sleep Types ──

export interface SleepData {
  date: string;
  totalMinutes: number;
  stages?: {
    awake: number;
    light: number;
    deep: number;
    rem: number;
  };
  sleepScore?: number;
  bedtime: string;
  wakeTime: string;
}

// ── Menstrual Types ──

export interface MenstrualData {
  date: string;
  phase: "menstrual" | "follicular" | "ovulation" | "luteal";
  flowLevel?: "light" | "medium" | "heavy";
}

// ── Adapter Interface ──

export interface WearableAdapter {
  source: WearableSource;

  // Auth
  getAuthUrl(userId: string, redirectUri: string): string;
  handleAuthCallback(
    code: string,
    userId: string
  ): Promise<{ accessToken: string; refreshToken: string }>;
  refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }>;

  // Data sync
  syncData(accessToken: string, options: SyncOptions): Promise<WearableData>;

  // Real-time (if supported)
  supportsRealtime(): boolean;
}

export interface SyncOptions {
  userId: string;
  startDate: string;
  endDate: string;
  dataTypes: DataType[];
}

export type DataType =
  | "heart_rate"
  | "blood_oxygen"
  | "blood_pressure"
  | "temperature"
  | "steps"
  | "sleep"
  | "exercise"
  | "stress"
  | "menstrual";

// ── Apple HealthKit Native Types ──

export interface HKQuantitySample {
  type: string; // e.g. "HKQuantityTypeIdentifierHeartRate"
  startDate: string;
  endDate: string;
  value: number;
  unit: string;
  metadata?: Record<string, string>;
  sourceName?: string;
  sourceBundle?: string;
  device?: string;
}

export interface HKCategorySample {
  type: string; // e.g. "HKCategoryTypeIdentifierSleepAnalysis"
  startDate: string;
  endDate: string;
  value: number; // category enum value
  metadata?: Record<string, string>;
  sourceName?: string;
  sourceBundle?: string;
}

export interface HKCorrelation {
  type: string; // e.g. "HKCorrelationTypeIdentifierBloodPressure"
  startDate: string;
  endDate: string;
  objects: HKQuantitySample[];
  metadata?: Record<string, string>;
}

export interface AppleHealthKitExport {
  exportDate: string;
  userId: string;
  deviceModel?: string;
  osVersion?: string;
  bundleId?: string;
  quantitySamples?: HKQuantitySample[];
  categorySamples?: HKCategorySample[];
  correlations?: HKCorrelation[];
  workouts?: HKWorkout[];
  activitySummary?: HKActivitySummary;
}

export interface HKWorkout {
  type: string; // "HKWorkoutActivityTypeRunning" etc.
  startDate: string;
  endDate: string;
  duration: number; // seconds
  totalEnergyBurned?: number; // kcal
  totalDistance?: number; // meters
  metadata?: Record<string, string>;
}

export interface HKActivitySummary {
  date: string;
  activeEnergyBurned: number;
  exerciseTime: number; // minutes
  standHours: number;
}

// ── Samsung Health Connect Types ──

export interface SamsungHealthExport {
  exportDate: string;
  userId: string;
  deviceModel?: string;
  sdkVersion?: string;
  records: SamsungHealthRecord[];
}

export interface SamsungHealthRecord {
  dataType: string; // "HeartRate", "Steps", "SleepSession", etc.
  startTime: string;
  endTime: string;
  values: Record<string, number | string>;
  metadata?: Record<string, string>;
  packageName?: string;
}

// ── Google Fit Types ──

export interface GoogleFitDataSource {
  dataStreamId: string;
  dataStreamName: string;
  type: string;
  dataType: { name: string; field: { name: string; format: string }[] };
  device?: { uid: string; type: string; manufacturer: string; model: string };
}

export interface GoogleFitDataPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataTypeName: string;
  value: { intVal?: number; fpVal?: number; stringVal?: string; mapVal?: { key: string; value: { fpVal: number } }[] }[];
  originDataSourceId?: string;
}

export interface GoogleFitDataset {
  dataSourceId: string;
  maxEndTimeNs: string;
  minStartTimeNs: string;
  point: GoogleFitDataPoint[];
}

// ── Analyzer Types ──

export interface HealthAnomaly {
  type: "critical" | "warning" | "info";
  dataType: DataType;
  message: string;
  messageKo: string;
  value: number;
  threshold: { min?: number; max?: number };
  timestamp: string;
  recommendation: string;
  recommendationKo: string;
}

export interface ExerciseVerification {
  verified: boolean;
  totalMinutes: number;
  requiredMinutes: number;
  activeCalories: number;
  avgHeartRate?: number;
  exerciseTypes: string[];
  confidence: number; // 0-1, how confident we are the data is genuine
  message: string;
  messageKo: string;
}

export interface SleepAnalysis {
  quality: "poor" | "fair" | "good" | "excellent";
  score: number; // 0-100
  totalHours: number;
  deepSleepPercent: number;
  remSleepPercent: number;
  efficiency: number; // time asleep / time in bed
  insights: string[];
  insightsKo: string[];
}

export interface HeartRateAnalysis {
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  restingBpm?: number;
  zones: {
    rest: number; // minutes
    fatBurn: number;
    cardio: number;
    peak: number;
  };
  variability: "low" | "normal" | "high";
  insights: string[];
  insightsKo: string[];
}

// ── Validation Types ──

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  dataIntegrity: {
    hasValidTimestamps: boolean;
    hasValidRanges: boolean;
    hasConsistentSource: boolean;
    suspiciousPatterns: string[];
  };
}
