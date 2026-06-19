// Samsung Health Connect Adapter
// Handles data posted from the Android app via Health Connect API.
// Health Connect (formerly Samsung Health SDK) is a native Android API.
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
  SamsungHealthExport,
  SamsungHealthRecord,
  ValidationResult,
} from "../types";

// ── Health Connect Data Type Constants ──
const HC_HEART_RATE = "HeartRate";
const HC_BLOOD_OXYGEN = "OxygenSaturation";
const HC_BLOOD_PRESSURE = "BloodPressure";
const HC_BODY_TEMPERATURE = "BodyTemperature";
const HC_STEPS = "Steps";
const HC_ACTIVE_CALORIES = "ActiveCaloriesBurned";
const HC_TOTAL_CALORIES = "TotalCaloriesBurned";
const HC_DISTANCE = "Distance";
const HC_FLOORS = "FloorsClimbed";
const HC_SLEEP_SESSION = "SleepSession";
const HC_SLEEP_STAGE = "SleepStage";
const HC_EXERCISE_SESSION = "ExerciseSession";
const HC_STRESS = "StressLevel";
const HC_MENSTRUAL = "MenstruationPeriod";
const HC_MENSTRUAL_FLOW = "MenstruationFlow";

// Sleep stage values from Health Connect
const SLEEP_STAGE_UNKNOWN = 0;
const SLEEP_STAGE_AWAKE = 1;
const SLEEP_STAGE_SLEEPING = 2;
const SLEEP_STAGE_OUT_OF_BED = 3;
const SLEEP_STAGE_LIGHT = 4;
const SLEEP_STAGE_DEEP = 5;
const SLEEP_STAGE_REM = 6;

export class SamsungHealthAdapter implements WearableAdapter {
  source: WearableSource = "samsung_health";

  // ── Auth: Samsung Health Connect is on-device only, no server OAuth ──
  // Android app handles Health Connect permissions directly.

  getAuthUrl(_userId: string, _redirectUri: string): string {
    // Health Connect doesn't use OAuth — authorization is handled natively on Android.
    // Return a deep link to the Android app's Health Connect permission screen.
    return "healthjournal://settings/health-connect-permissions";
  }

  async handleAuthCallback(
    _code: string,
    userId: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // For Samsung Health Connect, the "token" is a device-specific identifier.
    return {
      accessToken: `samsung_device_${userId}_${Date.now()}`,
      refreshToken: `samsung_refresh_${userId}`,
    };
  }

  async refreshToken(
    _refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return {
      accessToken: _refreshToken.replace("refresh", "device"),
      refreshToken: _refreshToken,
    };
  }

  supportsRealtime(): boolean {
    // Health Connect supports change notifications on Android
    return true;
  }

  // ── Data Sync ──

  async syncData(
    _accessToken: string,
    options: SyncOptions
  ): Promise<WearableData> {
    // Like Apple HealthKit, syncData for Samsung is called when the Android app
    // POSTs collected Health Connect data. Returns empty structure to be populated.
    return {
      source: "samsung_health",
      userId: options.userId,
      syncedAt: new Date().toISOString(),
    };
  }

  // ── Parse Samsung Health Export ──

  parseSamsungHealthData(rawData: SamsungHealthExport): WearableData {
    const data: WearableData = {
      source: "samsung_health",
      userId: rawData.userId,
      syncedAt: rawData.exportDate || new Date().toISOString(),
    };

    if (!rawData.records || rawData.records.length === 0) {
      return data;
    }

    // Group records by data type
    const recordsByType = new Map<string, SamsungHealthRecord[]>();
    for (const record of rawData.records) {
      const existing = recordsByType.get(record.dataType) || [];
      existing.push(record);
      recordsByType.set(record.dataType, existing);
    }

    // Heart rate
    const heartRateRecords = recordsByType.get(HC_HEART_RATE);
    if (heartRateRecords && heartRateRecords.length > 0) {
      data.heartRate = this.convertHeartRate(heartRateRecords);
    }

    // Blood oxygen
    const bloodOxygenRecords = recordsByType.get(HC_BLOOD_OXYGEN);
    if (bloodOxygenRecords && bloodOxygenRecords.length > 0) {
      data.bloodOxygen = this.convertBloodOxygen(bloodOxygenRecords);
    }

    // Blood pressure
    const bloodPressureRecords = recordsByType.get(HC_BLOOD_PRESSURE);
    if (bloodPressureRecords && bloodPressureRecords.length > 0) {
      data.bloodPressure = this.convertBloodPressure(bloodPressureRecords);
    }

    // Body temperature
    const temperatureRecords = recordsByType.get(HC_BODY_TEMPERATURE);
    if (temperatureRecords && temperatureRecords.length > 0) {
      data.bodyTemperature = this.convertTemperature(temperatureRecords);
    }

    // Steps
    const stepsRecords = recordsByType.get(HC_STEPS);
    if (stepsRecords && stepsRecords.length > 0) {
      data.steps = this.convertSteps(stepsRecords);
    }

    // Active calories
    const calorieRecords = recordsByType.get(HC_ACTIVE_CALORIES);
    if (calorieRecords && calorieRecords.length > 0) {
      data.activeCalories = calorieRecords.reduce(
        (sum, r) => sum + (Number(r.values["energy"]) || 0),
        0
      );
    }

    // Distance
    const distanceRecords = recordsByType.get(HC_DISTANCE);
    if (distanceRecords && distanceRecords.length > 0) {
      data.distance = distanceRecords.reduce(
        (sum, r) => sum + (Number(r.values["distance"]) || 0),
        0
      );
    }

    // Floors
    const floorRecords = recordsByType.get(HC_FLOORS);
    if (floorRecords && floorRecords.length > 0) {
      data.floors = floorRecords.reduce(
        (sum, r) => sum + (Number(r.values["floors"]) || 0),
        0
      );
    }

    // Sleep
    const sleepSessionRecords = recordsByType.get(HC_SLEEP_SESSION);
    const sleepStageRecords = recordsByType.get(HC_SLEEP_STAGE);
    if (sleepSessionRecords && sleepSessionRecords.length > 0) {
      data.sleep = this.convertSleep(
        sleepSessionRecords,
        sleepStageRecords || []
      );
    }

    // Exercise
    const exerciseRecords = recordsByType.get(HC_EXERCISE_SESSION);
    if (exerciseRecords && exerciseRecords.length > 0) {
      data.exerciseMinutes = exerciseRecords.reduce((sum, r) => {
        const start = new Date(r.startTime).getTime();
        const end = new Date(r.endTime).getTime();
        return sum + (end - start) / 60000;
      }, 0);
    }

    // Stress level (Samsung-specific)
    const stressRecords = recordsByType.get(HC_STRESS);
    if (stressRecords && stressRecords.length > 0) {
      // Use the latest stress reading
      const latest = stressRecords[stressRecords.length - 1];
      data.stressLevel = Number(latest.values["stressLevel"]) || undefined;
    }

    // Menstrual data
    const menstrualRecords = recordsByType.get(HC_MENSTRUAL);
    const menstrualFlowRecords = recordsByType.get(HC_MENSTRUAL_FLOW);
    if (menstrualRecords && menstrualRecords.length > 0) {
      data.menstrualCycle = this.convertMenstrual(
        menstrualRecords,
        menstrualFlowRecords || []
      );
    }

    return data;
  }

  // ── Validate data ──

  validateData(data: SamsungHealthExport): ValidationResult {
    const issues: string[] = [];
    const suspiciousPatterns: string[] = [];
    let hasValidTimestamps = true;
    let hasValidRanges = true;
    let hasConsistentSource = true;

    if (!data.exportDate) {
      issues.push("Missing export date");
    }

    if (!data.userId) {
      issues.push("Missing user ID");
    }

    if (!data.records || data.records.length === 0) {
      issues.push("No records found in export");
      return {
        valid: false,
        issues,
        dataIntegrity: {
          hasValidTimestamps,
          hasValidRanges,
          hasConsistentSource,
          suspiciousPatterns,
        },
      };
    }

    for (const record of data.records) {
      // Timestamp validation
      const start = new Date(record.startTime);
      const end = new Date(record.endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        hasValidTimestamps = false;
        issues.push(`Invalid timestamp in ${record.dataType}`);
      }

      // Future date check
      if (start.getTime() > Date.now() + 60000) {
        hasValidTimestamps = false;
        suspiciousPatterns.push(
          `Future timestamp detected: ${record.startTime}`
        );
      }

      // End before start
      if (end < start) {
        hasValidTimestamps = false;
        issues.push(`End time before start time in ${record.dataType}`);
      }

      // Range validation per type
      if (record.dataType === HC_HEART_RATE) {
        const bpm = Number(record.values["bpm"]);
        if (bpm < 20 || bpm > 300) {
          hasValidRanges = false;
          issues.push(`Heart rate out of range: ${bpm} bpm`);
        }
      }

      if (record.dataType === HC_BLOOD_OXYGEN) {
        const spo2 = Number(record.values["percentage"]);
        if (spo2 < 50 || spo2 > 100) {
          hasValidRanges = false;
          issues.push(`Blood oxygen out of range: ${spo2}%`);
        }
      }

      if (record.dataType === HC_BLOOD_PRESSURE) {
        const systolic = Number(record.values["systolic"]);
        const diastolic = Number(record.values["diastolic"]);
        if (systolic < 60 || systolic > 300) {
          hasValidRanges = false;
          issues.push(`Systolic blood pressure out of range: ${systolic}`);
        }
        if (diastolic < 30 || diastolic > 200) {
          hasValidRanges = false;
          issues.push(`Diastolic blood pressure out of range: ${diastolic}`);
        }
        if (diastolic >= systolic) {
          hasValidRanges = false;
          issues.push(
            `Diastolic (${diastolic}) >= systolic (${systolic})`
          );
        }
      }

      if (record.dataType === HC_STEPS) {
        const count = Number(record.values["count"]);
        if (count < 0 || count > 100000) {
          hasValidRanges = false;
          issues.push(`Step count suspicious: ${count}`);
        }
      }

      if (record.dataType === HC_BODY_TEMPERATURE) {
        const temp = Number(record.values["temperature"]);
        if (temp < 30 || temp > 45) {
          hasValidRanges = false;
          issues.push(`Body temperature out of range: ${temp}C`);
        }
      }

      // Source consistency
      if (
        record.packageName &&
        !record.packageName.includes("samsung") &&
        !record.packageName.includes("health") &&
        !record.packageName.includes("google")
      ) {
        hasConsistentSource = false;
        suspiciousPatterns.push(
          `Non-health source package: ${record.packageName}`
        );
      }
    }

    // Check for duplicate timestamps (potential replay attack)
    const heartRateRecords = data.records.filter(
      (r) => r.dataType === HC_HEART_RATE
    );
    const hrTimestamps = heartRateRecords.map((r) => r.startTime);
    const uniqueHrTimestamps = new Set(hrTimestamps);
    if (
      hrTimestamps.length > 10 &&
      uniqueHrTimestamps.size < hrTimestamps.length * 0.5
    ) {
      suspiciousPatterns.push(
        "High proportion of duplicate heart rate timestamps (potential replay)"
      );
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

  private convertHeartRate(
    records: SamsungHealthRecord[]
  ): HeartRateData[] {
    return records.map((record) => ({
      timestamp: record.startTime,
      bpm: Math.round(Number(record.values["bpm"]) || 0),
      context: this.inferHeartRateContext(record),
    }));
  }

  private inferHeartRateContext(
    record: SamsungHealthRecord
  ): HeartRateData["context"] {
    // Samsung Health Connect may include metadata about measurement context
    if (record.metadata) {
      if (record.metadata["exerciseType"]) return "workout";
      if (record.metadata["measurementContext"] === "sleep") return "sleep";
    }

    const bpm = Number(record.values["bpm"]) || 0;
    if (bpm < 65) return "resting";
    if (bpm > 130) return "active";
    return undefined;
  }

  private convertBloodOxygen(
    records: SamsungHealthRecord[]
  ): BloodOxygenData[] {
    return records.map((record) => ({
      timestamp: record.startTime,
      spo2: Math.round(Number(record.values["percentage"]) || 0),
    }));
  }

  private convertBloodPressure(
    records: SamsungHealthRecord[]
  ): BloodPressureData[] {
    return records.map((record) => ({
      timestamp: record.startTime,
      systolic: Math.round(Number(record.values["systolic"]) || 0),
      diastolic: Math.round(Number(record.values["diastolic"]) || 0),
    }));
  }

  private convertTemperature(
    records: SamsungHealthRecord[]
  ): TemperatureData[] {
    return records.map((record) => {
      let celsius = Number(record.values["temperature"]) || 0;
      // Health Connect stores temperature in Celsius
      const location = (record.values["measurementLocation"] as string) || "wrist";

      return {
        timestamp: record.startTime,
        celsius: parseFloat(celsius.toFixed(1)),
        location: this.normalizeTemperatureLocation(location),
      };
    });
  }

  private normalizeTemperatureLocation(
    location: string
  ): "wrist" | "ear" | "forehead" {
    const lower = location.toLowerCase();
    if (lower.includes("ear") || lower.includes("tympanic")) return "ear";
    if (lower.includes("forehead") || lower.includes("temporal"))
      return "forehead";
    return "wrist";
  }

  private convertSteps(records: SamsungHealthRecord[]): StepsData {
    const totalCount = records.reduce(
      (sum, r) => sum + (Number(r.values["count"]) || 0),
      0
    );
    const date =
      records.length > 0
        ? records[0].startTime.split("T")[0]
        : new Date().toISOString().split("T")[0];

    return {
      date,
      count: Math.round(totalCount),
      goal: 6000, // Samsung Health default goal
    };
  }

  private convertSleep(
    sessionRecords: SamsungHealthRecord[],
    stageRecords: SamsungHealthRecord[]
  ): SleepData {
    // Use the first (or primary) sleep session
    const session = sessionRecords[0];
    const bedtime = session.startTime;
    const wakeTime = session.endTime;

    let awakeMinutes = 0;
    let lightMinutes = 0;
    let deepMinutes = 0;
    let remMinutes = 0;

    if (stageRecords.length > 0) {
      for (const stage of stageRecords) {
        const duration =
          (new Date(stage.endTime).getTime() -
            new Date(stage.startTime).getTime()) /
          60000;
        const stageValue = Number(stage.values["stage"]) || 0;

        switch (stageValue) {
          case SLEEP_STAGE_AWAKE:
          case SLEEP_STAGE_OUT_OF_BED:
            awakeMinutes += duration;
            break;
          case SLEEP_STAGE_LIGHT:
          case SLEEP_STAGE_SLEEPING:
          case SLEEP_STAGE_UNKNOWN:
            lightMinutes += duration;
            break;
          case SLEEP_STAGE_DEEP:
            deepMinutes += duration;
            break;
          case SLEEP_STAGE_REM:
            remMinutes += duration;
            break;
        }
      }
    } else {
      // No stage data — calculate total from session duration
      const totalDuration =
        (new Date(wakeTime).getTime() - new Date(bedtime).getTime()) /
        60000;
      // Estimate stages if not provided
      lightMinutes = totalDuration * 0.5;
      deepMinutes = totalDuration * 0.2;
      remMinutes = totalDuration * 0.2;
      awakeMinutes = totalDuration * 0.1;
    }

    const sleepMinutes = lightMinutes + deepMinutes + remMinutes;
    const totalMinutes = sleepMinutes + awakeMinutes;
    const efficiency = totalMinutes > 0 ? sleepMinutes / totalMinutes : 0;

    // Sleep score calculation
    const durationScore = Math.min((sleepMinutes / 480) * 40, 40);
    const deepScore = Math.min(
      (deepMinutes / (sleepMinutes || 1)) * 100,
      30
    );
    const efficiencyScore = efficiency * 30;
    const sleepScore = Math.round(
      durationScore + deepScore + efficiencyScore
    );

    return {
      date: bedtime.split("T")[0] || new Date().toISOString().split("T")[0],
      totalMinutes: Math.round(sleepMinutes),
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

  private convertMenstrual(
    periodRecords: SamsungHealthRecord[],
    flowRecords: SamsungHealthRecord[]
  ): import("../types").MenstrualData {
    const latest = periodRecords[periodRecords.length - 1];
    const date = latest.startTime.split("T")[0];

    // Determine phase from Health Connect data
    const phase = (latest.values["phase"] as string) || "menstrual";
    const normalizedPhase = this.normalizeMenstrualPhase(phase);

    // Determine flow level
    let flowLevel: "light" | "medium" | "heavy" | undefined;
    if (flowRecords.length > 0) {
      const latestFlow = flowRecords[flowRecords.length - 1];
      const flowValue = Number(latestFlow.values["flow"]) || 0;
      if (flowValue <= 1) flowLevel = "light";
      else if (flowValue <= 2) flowLevel = "medium";
      else flowLevel = "heavy";
    }

    return {
      date,
      phase: normalizedPhase,
      flowLevel,
    };
  }

  private normalizeMenstrualPhase(
    phase: string
  ): "menstrual" | "follicular" | "ovulation" | "luteal" {
    const lower = phase.toLowerCase();
    if (lower.includes("menstrual") || lower.includes("period"))
      return "menstrual";
    if (lower.includes("follicular")) return "follicular";
    if (lower.includes("ovul")) return "ovulation";
    if (lower.includes("luteal")) return "luteal";
    return "menstrual";
  }
}
