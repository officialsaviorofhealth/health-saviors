// Apple HealthKit Adapter
// Handles data posted from the iOS/watchOS app via HealthKit API.
// HealthKit is a native iOS framework — actual reading happens on-device.
// This adapter receives, parses, validates, and normalizes that data.

import type {
  WearableAdapter,
  WearableData,
  WearableSource,
  SyncOptions,
  HeartRateData,
  BloodOxygenData,
  BloodPressureData,
  TemperatureData,
  StepsData,
  SleepData,
  AppleHealthKitExport,
  HKQuantitySample,
  HKCategorySample,
  HKCorrelation,
  ValidationResult,
} from "../types";

// ── HealthKit Identifier Constants ──
const HK_HEART_RATE = "HKQuantityTypeIdentifierHeartRate";
const HK_BLOOD_OXYGEN = "HKQuantityTypeIdentifierOxygenSaturation";
const HK_SYSTOLIC = "HKQuantityTypeIdentifierBloodPressureSystolic";
const HK_DIASTOLIC = "HKQuantityTypeIdentifierBloodPressureDiastolic";
const HK_BODY_TEMPERATURE = "HKQuantityTypeIdentifierBodyTemperature";
const HK_STEP_COUNT = "HKQuantityTypeIdentifierStepCount";
const HK_ACTIVE_ENERGY = "HKQuantityTypeIdentifierActiveEnergyBurned";
const HK_DISTANCE = "HKQuantityTypeIdentifierDistanceWalkingRunning";
const HK_FLIGHTS_CLIMBED = "HKQuantityTypeIdentifierFlightsClimbed";
const HK_SLEEP_ANALYSIS = "HKCategoryTypeIdentifierSleepAnalysis";
const HK_MINDFUL_TIME = "HKCategoryTypeIdentifierMindfulSession";
const HK_BLOOD_PRESSURE_CORRELATION = "HKCorrelationTypeIdentifierBloodPressure";

// Sleep analysis values (HKCategoryValueSleepAnalysis)
const SLEEP_VALUE_IN_BED = 0;
const SLEEP_VALUE_ASLEEP_UNSPECIFIED = 1;
const SLEEP_VALUE_AWAKE = 2;
const SLEEP_VALUE_ASLEEP_CORE = 3; // light
const SLEEP_VALUE_ASLEEP_DEEP = 4;
const SLEEP_VALUE_ASLEEP_REM = 5;

export class AppleHealthAdapter implements WearableAdapter {
  source: WearableSource = "apple_health";

  // ── Auth: Apple HealthKit is on-device only, no server OAuth ──
  // The iOS app handles HealthKit authorization directly.
  // These methods are implemented for interface compliance.

  getAuthUrl(_userId: string, _redirectUri: string): string {
    // Apple HealthKit does not use OAuth — authorization is handled natively on iOS.
    // Return a deep link to the iOS app's HealthKit permission screen.
    return "healthjournal://settings/healthkit-permissions";
  }

  async handleAuthCallback(
    _code: string,
    userId: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // For Apple HealthKit, the "token" is a device-specific identifier.
    // The iOS app generates a signed device token after HealthKit authorization.
    return {
      accessToken: `apple_device_${userId}_${Date.now()}`,
      refreshToken: `apple_refresh_${userId}`,
    };
  }

  async refreshToken(
    _refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // No token refresh needed for HealthKit; device auth persists.
    return {
      accessToken: _refreshToken.replace("refresh", "device"),
      refreshToken: _refreshToken,
    };
  }

  supportsRealtime(): boolean {
    // HealthKit supports background delivery on iOS
    return true;
  }

  // ── Data Sync: receive data posted from iOS app ──

  async syncData(
    _accessToken: string,
    options: SyncOptions
  ): Promise<WearableData> {
    // In practice, syncData for Apple HealthKit is called when the iOS app
    // POSTs collected HealthKit data to the API. The actual sync is triggered
    // from the mobile side. This stub returns an empty structure that will be
    // populated by parseHealthKitData.
    return {
      source: "apple_health",
      userId: options.userId,
      syncedAt: new Date().toISOString(),
    };
  }

  // ── Parse HealthKit Export ──

  parseHealthKitData(rawData: AppleHealthKitExport): WearableData {
    const data: WearableData = {
      source: "apple_health",
      userId: rawData.userId,
      syncedAt: rawData.exportDate || new Date().toISOString(),
    };

    if (rawData.quantitySamples && rawData.quantitySamples.length > 0) {
      data.heartRate = this.convertHeartRate(
        rawData.quantitySamples.filter((s) => s.type === HK_HEART_RATE)
      );

      data.bloodOxygen = this.convertBloodOxygen(
        rawData.quantitySamples.filter((s) => s.type === HK_BLOOD_OXYGEN)
      );

      data.bodyTemperature = this.convertTemperature(
        rawData.quantitySamples.filter((s) => s.type === HK_BODY_TEMPERATURE)
      );

      data.steps = this.convertSteps(
        rawData.quantitySamples.filter((s) => s.type === HK_STEP_COUNT)
      );

      // Active calories
      const caloriesSamples = rawData.quantitySamples.filter(
        (s) => s.type === HK_ACTIVE_ENERGY
      );
      if (caloriesSamples.length > 0) {
        data.activeCalories = caloriesSamples.reduce(
          (sum, s) => sum + s.value,
          0
        );
      }

      // Distance (meters)
      const distanceSamples = rawData.quantitySamples.filter(
        (s) => s.type === HK_DISTANCE
      );
      if (distanceSamples.length > 0) {
        data.distance = distanceSamples.reduce((sum, s) => {
          // HealthKit may report in km or m depending on unit
          return sum + (s.unit === "km" ? s.value * 1000 : s.value);
        }, 0);
      }

      // Floors climbed
      const floorSamples = rawData.quantitySamples.filter(
        (s) => s.type === HK_FLIGHTS_CLIMBED
      );
      if (floorSamples.length > 0) {
        data.floors = floorSamples.reduce((sum, s) => sum + s.value, 0);
      }
    }

    // Blood pressure from correlations
    if (rawData.correlations && rawData.correlations.length > 0) {
      data.bloodPressure = this.convertBloodPressure(
        rawData.correlations.filter(
          (c) => c.type === HK_BLOOD_PRESSURE_CORRELATION
        )
      );
    }

    // Sleep analysis from category samples
    if (rawData.categorySamples && rawData.categorySamples.length > 0) {
      const sleepSamples = rawData.categorySamples.filter(
        (s) => s.type === HK_SLEEP_ANALYSIS
      );
      if (sleepSamples.length > 0) {
        data.sleep = this.convertSleep(sleepSamples);
      }

      // Mindful minutes
      const mindfulSamples = rawData.categorySamples.filter(
        (s) => s.type === HK_MINDFUL_TIME
      );
      if (mindfulSamples.length > 0) {
        data.mindfulMinutes = mindfulSamples.reduce((sum, s) => {
          const start = new Date(s.startDate).getTime();
          const end = new Date(s.endDate).getTime();
          return sum + (end - start) / 60000;
        }, 0);
      }
    }

    // Workouts -> exerciseMinutes
    if (rawData.workouts && rawData.workouts.length > 0) {
      data.exerciseMinutes = rawData.workouts.reduce(
        (sum, w) => sum + w.duration / 60,
        0
      );
    }

    // Activity summary
    if (rawData.activitySummary) {
      data.activeCalories =
        data.activeCalories ?? rawData.activitySummary.activeEnergyBurned;
      data.exerciseMinutes =
        data.exerciseMinutes ?? rawData.activitySummary.exerciseTime;
      data.standHours =
        data.standHours ?? rawData.activitySummary.standHours;
    }

    return data;
  }

  // ── Validate data authenticity ──

  validateData(data: AppleHealthKitExport): ValidationResult {
    const issues: string[] = [];
    const suspiciousPatterns: string[] = [];
    let hasValidTimestamps = true;
    let hasValidRanges = true;
    let hasConsistentSource = true;

    // Check export date exists
    if (!data.exportDate) {
      issues.push("Missing export date");
    }

    // Check userId exists
    if (!data.userId) {
      issues.push("Missing user ID");
    }

    // Validate quantity samples
    if (data.quantitySamples) {
      for (const sample of data.quantitySamples) {
        // Timestamp validation
        const start = new Date(sample.startDate);
        const end = new Date(sample.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          hasValidTimestamps = false;
          issues.push(`Invalid timestamp in ${sample.type}`);
        }

        // Future date check
        if (start.getTime() > Date.now() + 60000) {
          hasValidTimestamps = false;
          suspiciousPatterns.push(
            `Future timestamp detected: ${sample.startDate}`
          );
        }

        // End before start
        if (end < start) {
          hasValidTimestamps = false;
          issues.push(`End date before start date in ${sample.type}`);
        }

        // Range validation per type
        if (sample.type === HK_HEART_RATE) {
          if (sample.value < 20 || sample.value > 300) {
            hasValidRanges = false;
            issues.push(
              `Heart rate out of range: ${sample.value} bpm`
            );
          }
          // Suspicious: perfectly constant heart rate over long period
          if (sample.value === 72 && data.quantitySamples.filter(
            (s) => s.type === HK_HEART_RATE && s.value === 72
          ).length > 50) {
            suspiciousPatterns.push(
              "Suspiciously constant heart rate values detected"
            );
          }
        }

        if (sample.type === HK_BLOOD_OXYGEN) {
          if (sample.value < 50 || sample.value > 100) {
            hasValidRanges = false;
            issues.push(
              `Blood oxygen out of range: ${sample.value}%`
            );
          }
        }

        if (sample.type === HK_STEP_COUNT) {
          if (sample.value < 0 || sample.value > 100000) {
            hasValidRanges = false;
            issues.push(`Step count suspicious: ${sample.value}`);
          }
        }

        if (sample.type === HK_BODY_TEMPERATURE) {
          if (sample.value < 30 || sample.value > 45) {
            hasValidRanges = false;
            issues.push(
              `Body temperature out of range: ${sample.value}C`
            );
          }
        }

        // Source consistency — all samples should come from Apple ecosystem
        if (
          sample.sourceBundle &&
          !sample.sourceBundle.startsWith("com.apple.") &&
          !sample.sourceBundle.includes("health")
        ) {
          hasConsistentSource = false;
          suspiciousPatterns.push(
            `Non-Apple source bundle: ${sample.sourceBundle}`
          );
        }
      }

      // Check for impossibly high data density (data tampering indicator)
      const heartRateSamples = data.quantitySamples.filter(
        (s) => s.type === HK_HEART_RATE
      );
      if (heartRateSamples.length > 0) {
        const timeSpan =
          new Date(
            heartRateSamples[heartRateSamples.length - 1].endDate
          ).getTime() -
          new Date(heartRateSamples[0].startDate).getTime();
        const samplesPerMinute =
          heartRateSamples.length / (timeSpan / 60000);
        if (samplesPerMinute > 10) {
          // More than 10 readings/min is suspicious
          suspiciousPatterns.push(
            `Unusually high heart rate sample density: ${samplesPerMinute.toFixed(1)}/min`
          );
        }
      }
    }

    // Validate category samples (sleep)
    if (data.categorySamples) {
      for (const sample of data.categorySamples) {
        const start = new Date(sample.startDate);
        const end = new Date(sample.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          hasValidTimestamps = false;
          issues.push(`Invalid timestamp in category sample ${sample.type}`);
        }

        // Sleep session should not exceed 24 hours
        if (sample.type === HK_SLEEP_ANALYSIS) {
          const durationHours =
            (end.getTime() - start.getTime()) / 3600000;
          if (durationHours > 24) {
            hasValidRanges = false;
            issues.push(
              `Sleep session exceeds 24 hours: ${durationHours.toFixed(1)}h`
            );
          }
        }
      }
    }

    return {
      valid: issues.length === 0 && suspiciousPatterns.length === 0,
      issues,
      dataIntegrity: {
        hasValidTimestamps,
        hasValidRanges,
        hasConsistentSource,
        suspiciousPatterns,
      },
    };
  }

  // ── Private Conversion Methods ──

  private convertHeartRate(samples: HKQuantitySample[]): HeartRateData[] {
    return samples.map((sample) => {
      let context: HeartRateData["context"] = undefined;

      // Determine context from metadata
      if (sample.metadata) {
        const motionContext = sample.metadata["HKMetadataKeyHeartRateMotionContext"];
        if (motionContext === "1") context = "active";
        else if (motionContext === "0") context = "resting";

        // Check if during workout
        if (sample.metadata["HKMetadataKeyWorkoutBrandName"]) {
          context = "workout";
        }
      }

      // Infer resting if value is low and no explicit context
      if (!context && sample.value < 65) {
        context = "resting";
      }

      return {
        timestamp: sample.startDate,
        bpm: Math.round(sample.value),
        context,
      };
    });
  }

  private convertBloodOxygen(
    samples: HKQuantitySample[]
  ): BloodOxygenData[] {
    return samples.map((sample) => ({
      timestamp: sample.startDate,
      // HealthKit stores SpO2 as a fraction (0.0-1.0), convert to percentage
      spo2:
        sample.value <= 1
          ? Math.round(sample.value * 100)
          : Math.round(sample.value),
    }));
  }

  private convertBloodPressure(
    correlations: HKCorrelation[]
  ): BloodPressureData[] {
    return correlations
      .map((correlation) => {
        const systolicSample = correlation.objects.find(
          (obj) => obj.type === HK_SYSTOLIC
        );
        const diastolicSample = correlation.objects.find(
          (obj) => obj.type === HK_DIASTOLIC
        );

        if (!systolicSample || !diastolicSample) return null;

        return {
          timestamp: correlation.startDate,
          systolic: Math.round(systolicSample.value),
          diastolic: Math.round(diastolicSample.value),
        };
      })
      .filter((bp): bp is BloodPressureData => bp !== null);
  }

  private convertTemperature(
    samples: HKQuantitySample[]
  ): TemperatureData[] {
    return samples.map((sample) => {
      let celsius = sample.value;
      // Convert Fahrenheit to Celsius if needed
      if (sample.unit === "degF" || sample.unit === "F") {
        celsius = (sample.value - 32) * (5 / 9);
      }

      return {
        timestamp: sample.startDate,
        celsius: parseFloat(celsius.toFixed(1)),
        location: "wrist", // Apple Watch measures from wrist
      };
    });
  }

  private convertSteps(samples: HKQuantitySample[]): StepsData {
    const totalCount = samples.reduce((sum, s) => sum + s.value, 0);
    const date =
      samples.length > 0
        ? samples[0].startDate.split("T")[0]
        : new Date().toISOString().split("T")[0];

    return {
      date,
      count: Math.round(totalCount),
      goal: 10000, // Default Apple Watch goal
    };
  }

  private convertSleep(categorySamples: HKCategorySample[]): SleepData {
    // Sort by start date
    const sorted = [...categorySamples].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    let awakeMinutes = 0;
    let lightMinutes = 0;
    let deepMinutes = 0;
    let remMinutes = 0;
    let totalMinutes = 0;

    let bedtime = sorted[0]?.startDate || "";
    let wakeTime = sorted[sorted.length - 1]?.endDate || "";

    for (const sample of sorted) {
      const duration =
        (new Date(sample.endDate).getTime() -
          new Date(sample.startDate).getTime()) /
        60000;

      switch (sample.value) {
        case SLEEP_VALUE_AWAKE:
          awakeMinutes += duration;
          break;
        case SLEEP_VALUE_ASLEEP_CORE:
        case SLEEP_VALUE_ASLEEP_UNSPECIFIED:
          lightMinutes += duration;
          break;
        case SLEEP_VALUE_ASLEEP_DEEP:
          deepMinutes += duration;
          break;
        case SLEEP_VALUE_ASLEEP_REM:
          remMinutes += duration;
          break;
        case SLEEP_VALUE_IN_BED:
          // In bed but not classified — count as awake
          awakeMinutes += duration;
          break;
      }

      totalMinutes += duration;
    }

    // Calculate sleep score (0-100) based on duration and stage distribution
    const sleepMinutesOnly = lightMinutes + deepMinutes + remMinutes;
    const efficiency =
      totalMinutes > 0 ? sleepMinutesOnly / totalMinutes : 0;
    const durationScore = Math.min(
      (sleepMinutesOnly / 480) * 40,
      40
    ); // 8 hours = max 40 pts
    const deepScore = Math.min(
      (deepMinutes / (sleepMinutesOnly || 1)) * 100,
      30
    ); // deep sleep ratio = max 30 pts
    const efficiencyScore = efficiency * 30; // efficiency = max 30 pts
    const sleepScore = Math.round(
      durationScore + deepScore + efficiencyScore
    );

    return {
      date: bedtime.split("T")[0] || new Date().toISOString().split("T")[0],
      totalMinutes: Math.round(sleepMinutesOnly),
      stages: {
        awake: Math.round(awakeMinutes),
        light: Math.round(lightMinutes),
        deep: Math.round(deepMinutes),
        rem: Math.round(remMinutes),
      },
      sleepScore: Math.min(sleepScore, 100),
      bedtime,
      wakeTime,
    };
  }
}
