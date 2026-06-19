// @health-journal/wearable-adapter — Main Export
// Main exports for the wearable device adapter package

// ── Types ──
export type {
  WearableData,
  WearableSource,
  WearableAdapter,
  SyncOptions,
  DataType,
  HeartRateData,
  BloodOxygenData,
  BloodPressureData,
  TemperatureData,
  StepsData,
  SleepData,
  MenstrualData,
  HealthAnomaly,
  ExerciseVerification,
  SleepAnalysis,
  HeartRateAnalysis,
  ValidationResult,
  // Apple HealthKit native types
  AppleHealthKitExport,
  HKQuantitySample,
  HKCategorySample,
  HKCorrelation,
  HKWorkout,
  HKActivitySummary,
  // Samsung Health Connect native types
  SamsungHealthExport,
  SamsungHealthRecord,
  // Google Fit native types
  GoogleFitDataSource,
  GoogleFitDataPoint,
  GoogleFitDataset,
} from "./types";

// ── Adapters ──
export { AppleHealthAdapter } from "./adapters/apple-health";
export { SamsungHealthAdapter } from "./adapters/samsung-health";
export { GoogleFitAdapter } from "./adapters/google-fit";

// ── Analyzer ──
export { WearableAnalyzer } from "./analyzer";

// ── Factory ──
import type { WearableAdapter, WearableSource } from "./types";
import { AppleHealthAdapter } from "./adapters/apple-health";
import { SamsungHealthAdapter } from "./adapters/samsung-health";
import { GoogleFitAdapter } from "./adapters/google-fit";

/**
 * Create a wearable adapter for the given source.
 */
export function createAdapter(source: WearableSource): WearableAdapter {
  switch (source) {
    case "apple_health":
      return new AppleHealthAdapter();
    case "samsung_health":
      return new SamsungHealthAdapter();
    case "google_fit":
      return new GoogleFitAdapter();
    case "fitbit":
      throw new Error(
        "Fitbit adapter not yet implemented"
      );
    case "garmin":
      throw new Error(
        "Garmin adapter not yet implemented"
      );
    default:
      throw new Error(
        `Unknown wearable source: ${source}`
      );
  }
}

/**
 * List all supported wearable sources.
 */
export function getSupportedSources(): {
  source: WearableSource;
  name: string;
  nameKo: string;
  implemented: boolean;
  authType: "device" | "oauth";
}[] {
  return [
    {
      source: "apple_health",
      name: "Apple Health",
      nameKo: "Apple Health",
      implemented: true,
      authType: "device",
    },
    {
      source: "samsung_health",
      name: "Samsung Health",
      nameKo: "Samsung Health",
      implemented: true,
      authType: "device",
    },
    {
      source: "google_fit",
      name: "Google Fit",
      nameKo: "Google Fit",
      implemented: true,
      authType: "oauth",
    },
    {
      source: "fitbit",
      name: "Fitbit",
      nameKo: "Fitbit",
      implemented: false,
      authType: "oauth",
    },
    {
      source: "garmin",
      name: "Garmin",
      nameKo: "Garmin",
      implemented: false,
      authType: "oauth",
    },
  ];
}
