// Wearable Data Analyzer
// Analyzes wearable data for health insights, anomaly detection,
// exercise verification (Exercise Pool), and sleep quality analysis.

import type {
  WearableData,
  HeartRateData,
  SleepData,
  HealthAnomaly,
  ExerciseVerification,
  SleepAnalysis,
  HeartRateAnalysis,
  DataType,
} from "./types";

// ── Critical Thresholds ──

const THRESHOLDS = {
  heartRate: {
    criticalLow: 30,
    warningLow: 45,
    warningHigh: 150,
    criticalHigh: 200,
  },
  bloodOxygen: {
    criticalLow: 85,
    warningLow: 92,
  },
  bloodPressure: {
    systolicCriticalHigh: 180,
    systolicWarningHigh: 140,
    systolicWarningLow: 90,
    systolicCriticalLow: 70,
    diastolicCriticalHigh: 120,
    diastolicWarningHigh: 90,
    diastolicWarningLow: 60,
    diastolicCriticalLow: 40,
  },
  bodyTemperature: {
    criticalHigh: 40.0,
    warningHigh: 38.0,
    warningLow: 35.5,
    criticalLow: 34.0,
  },
  steps: {
    warningHigh: 50000, // Improbably high daily step count
  },
} as const;

// ── Heart Rate Zones (age-independent approximation) ──
const HR_ZONE_REST_MAX = 60;
const HR_ZONE_FAT_BURN_MAX = 120;
const HR_ZONE_CARDIO_MAX = 150;
// Above cardio = peak

export class WearableAnalyzer {
  // ── Detect Anomalies ──

  detectAnomalies(data: WearableData): HealthAnomaly[] {
    const anomalies: HealthAnomaly[] = [];

    // Heart rate anomalies
    if (data.heartRate) {
      for (const hr of data.heartRate) {
        if (hr.bpm >= THRESHOLDS.heartRate.criticalHigh) {
          anomalies.push({
            type: "critical",
            dataType: "heart_rate",
            message: `Dangerously high heart rate: ${hr.bpm} bpm`,
            messageKo: `Dangerously high heart rate: ${hr.bpm} bpm`,
            value: hr.bpm,
            threshold: { max: THRESHOLDS.heartRate.criticalHigh },
            timestamp: hr.timestamp,
            recommendation:
              "Stop all physical activity immediately. If symptoms persist (chest pain, dizziness, shortness of breath), call emergency services.",
            recommendationKo:
              "Stop all physical activity immediately. If symptoms persist (chest pain, dizziness, shortness of breath), call emergency services.",
          });
        } else if (hr.bpm >= THRESHOLDS.heartRate.warningHigh) {
          anomalies.push({
            type: "warning",
            dataType: "heart_rate",
            message: `Elevated heart rate: ${hr.bpm} bpm`,
            messageKo: `Elevated heart rate: ${hr.bpm} bpm`,
            value: hr.bpm,
            threshold: { max: THRESHOLDS.heartRate.warningHigh },
            timestamp: hr.timestamp,
            recommendation:
              "Consider reducing activity intensity. Monitor for chest discomfort or dizziness.",
            recommendationKo:
              "Consider reducing activity intensity. Monitor for chest discomfort or dizziness.",
          });
        }

        if (hr.bpm <= THRESHOLDS.heartRate.criticalLow) {
          anomalies.push({
            type: "critical",
            dataType: "heart_rate",
            message: `Dangerously low heart rate: ${hr.bpm} bpm`,
            messageKo: `Dangerously low heart rate: ${hr.bpm} bpm`,
            value: hr.bpm,
            threshold: { min: THRESHOLDS.heartRate.criticalLow },
            timestamp: hr.timestamp,
            recommendation:
              "Seek immediate medical attention. Bradycardia below 30 bpm may indicate a serious cardiac condition.",
            recommendationKo:
              "Seek immediate medical attention. Bradycardia below 30 bpm may indicate a serious cardiac condition.",
          });
        } else if (hr.bpm <= THRESHOLDS.heartRate.warningLow) {
          anomalies.push({
            type: "warning",
            dataType: "heart_rate",
            message: `Low heart rate: ${hr.bpm} bpm`,
            messageKo: `Low heart rate: ${hr.bpm} bpm`,
            value: hr.bpm,
            threshold: { min: THRESHOLDS.heartRate.warningLow },
            timestamp: hr.timestamp,
            recommendation:
              "Monitor your heart rate. If you feel lightheaded or faint, consult a doctor.",
            recommendationKo:
              "Monitor your heart rate. If you feel lightheaded or faint, consult a doctor.",
          });
        }
      }
    }

    // Blood oxygen anomalies
    if (data.bloodOxygen) {
      for (const bo of data.bloodOxygen) {
        if (bo.spo2 <= THRESHOLDS.bloodOxygen.criticalLow) {
          anomalies.push({
            type: "critical",
            dataType: "blood_oxygen",
            message: `Critically low blood oxygen: ${bo.spo2}%`,
            messageKo: `Critically low blood oxygen: ${bo.spo2}%`,
            value: bo.spo2,
            threshold: { min: THRESHOLDS.bloodOxygen.criticalLow },
            timestamp: bo.timestamp,
            recommendation:
              "Seek emergency medical care immediately. SpO2 below 85% is a medical emergency.",
            recommendationKo:
              "Seek emergency medical care immediately. SpO2 below 85% is a medical emergency.",
          });
        } else if (bo.spo2 <= THRESHOLDS.bloodOxygen.warningLow) {
          anomalies.push({
            type: "warning",
            dataType: "blood_oxygen",
            message: `Low blood oxygen: ${bo.spo2}%`,
            messageKo: `Low blood oxygen: ${bo.spo2}%`,
            value: bo.spo2,
            threshold: { min: THRESHOLDS.bloodOxygen.warningLow },
            timestamp: bo.timestamp,
            recommendation:
              "Monitor your oxygen levels. If you experience shortness of breath, seek medical attention.",
            recommendationKo:
              "Monitor your oxygen levels. If you experience shortness of breath, seek medical attention.",
          });
        }
      }
    }

    // Blood pressure anomalies
    if (data.bloodPressure) {
      for (const bp of data.bloodPressure) {
        // Systolic checks
        if (bp.systolic >= THRESHOLDS.bloodPressure.systolicCriticalHigh) {
          anomalies.push({
            type: "critical",
            dataType: "blood_pressure",
            message: `Hypertensive crisis: ${bp.systolic}/${bp.diastolic} mmHg`,
            messageKo: `Hypertensive crisis: ${bp.systolic}/${bp.diastolic} mmHg`,
            value: bp.systolic,
            threshold: {
              max: THRESHOLDS.bloodPressure.systolicCriticalHigh,
            },
            timestamp: bp.timestamp,
            recommendation:
              "This is a hypertensive crisis. Seek emergency medical care immediately.",
            recommendationKo:
              "This is a hypertensive crisis. Seek emergency medical care immediately.",
          });
        } else if (
          bp.systolic >= THRESHOLDS.bloodPressure.systolicWarningHigh
        ) {
          anomalies.push({
            type: "warning",
            dataType: "blood_pressure",
            message: `High blood pressure: ${bp.systolic}/${bp.diastolic} mmHg`,
            messageKo: `High blood pressure: ${bp.systolic}/${bp.diastolic} mmHg`,
            value: bp.systolic,
            threshold: {
              max: THRESHOLDS.bloodPressure.systolicWarningHigh,
            },
            timestamp: bp.timestamp,
            recommendation:
              "Your blood pressure is elevated. Monitor regularly and consult your doctor.",
            recommendationKo:
              "Your blood pressure is elevated. Monitor regularly and consult your doctor.",
          });
        }

        if (
          bp.systolic <= THRESHOLDS.bloodPressure.systolicCriticalLow
        ) {
          anomalies.push({
            type: "critical",
            dataType: "blood_pressure",
            message: `Dangerously low blood pressure: ${bp.systolic}/${bp.diastolic} mmHg`,
            messageKo: `Dangerously low blood pressure: ${bp.systolic}/${bp.diastolic} mmHg`,
            value: bp.systolic,
            threshold: {
              min: THRESHOLDS.bloodPressure.systolicCriticalLow,
            },
            timestamp: bp.timestamp,
            recommendation:
              "Severely low blood pressure. Lie down, elevate legs, and seek medical attention.",
            recommendationKo:
              "Severely low blood pressure. Lie down, elevate legs, and seek medical attention.",
          });
        }

        // Diastolic checks
        if (
          bp.diastolic >= THRESHOLDS.bloodPressure.diastolicCriticalHigh
        ) {
          anomalies.push({
            type: "critical",
            dataType: "blood_pressure",
            message: `Critically high diastolic pressure: ${bp.diastolic} mmHg`,
            messageKo: `Critically high diastolic pressure: ${bp.diastolic} mmHg`,
            value: bp.diastolic,
            threshold: {
              max: THRESHOLDS.bloodPressure.diastolicCriticalHigh,
            },
            timestamp: bp.timestamp,
            recommendation:
              "Seek emergency medical care. Extremely elevated diastolic pressure requires immediate treatment.",
            recommendationKo:
              "Seek emergency medical care. Extremely elevated diastolic pressure requires immediate treatment.",
          });
        }
      }
    }

    // Body temperature anomalies
    if (data.bodyTemperature) {
      for (const temp of data.bodyTemperature) {
        if (temp.celsius >= THRESHOLDS.bodyTemperature.criticalHigh) {
          anomalies.push({
            type: "critical",
            dataType: "temperature",
            message: `Dangerously high temperature: ${temp.celsius}°C`,
            messageKo: `Dangerously high temperature: ${temp.celsius}°C`,
            value: temp.celsius,
            threshold: {
              max: THRESHOLDS.bodyTemperature.criticalHigh,
            },
            timestamp: temp.timestamp,
            recommendation:
              "High fever detected. Seek medical attention. Cool the body and hydrate.",
            recommendationKo:
              "High fever detected. Seek medical attention. Cool the body and hydrate.",
          });
        } else if (
          temp.celsius >= THRESHOLDS.bodyTemperature.warningHigh
        ) {
          anomalies.push({
            type: "warning",
            dataType: "temperature",
            message: `Elevated temperature: ${temp.celsius}°C`,
            messageKo: `Elevated temperature: ${temp.celsius}°C`,
            value: temp.celsius,
            threshold: {
              max: THRESHOLDS.bodyTemperature.warningHigh,
            },
            timestamp: temp.timestamp,
            recommendation:
              "You have a fever. Rest, hydrate, and consider taking antipyretics. Monitor symptoms.",
            recommendationKo:
              "You have a fever. Rest, hydrate, and consider taking antipyretics. Monitor symptoms.",
          });
        }

        if (temp.celsius <= THRESHOLDS.bodyTemperature.criticalLow) {
          anomalies.push({
            type: "critical",
            dataType: "temperature",
            message: `Hypothermia detected: ${temp.celsius}°C`,
            messageKo: `Hypothermia detected: ${temp.celsius}°C`,
            value: temp.celsius,
            threshold: {
              min: THRESHOLDS.bodyTemperature.criticalLow,
            },
            timestamp: temp.timestamp,
            recommendation:
              "Hypothermia is a medical emergency. Warm the body gradually and seek medical care.",
            recommendationKo:
              "Hypothermia is a medical emergency. Warm the body gradually and seek medical care.",
          });
        }
      }
    }

    return anomalies;
  }

  // ── Generate Daily Summary ──

  generateDailySummary(
    data: WearableData,
    language: "ko" | "en" = "en"
  ): string {
    const parts: string[] = [];

    if (language === "ko") {
      parts.push("📊 Daily Health Summary");
      parts.push(`Data source: ${this.getSourceNameKo(data.source)}`);
      parts.push("");

      // Activity
      if (data.steps || data.activeCalories || data.exerciseMinutes) {
        parts.push("🏃 Activity");
        if (data.steps) {
          const goalPercent = data.steps.goal
            ? Math.round((data.steps.count / data.steps.goal) * 100)
            : null;
          parts.push(
            `  Steps: ${data.steps.count.toLocaleString()}${goalPercent !== null ? ` (${goalPercent}% of goal)` : ""}`
          );
        }
        if (data.activeCalories) {
          parts.push(
            `  Active calories: ${Math.round(data.activeCalories)} kcal`
          );
        }
        if (data.exerciseMinutes) {
          parts.push(
            `  Exercise: ${Math.round(data.exerciseMinutes)} min`
          );
        }
        if (data.distance) {
          parts.push(
            `  Distance: ${(data.distance / 1000).toFixed(1)} km`
          );
        }
        if (data.standHours !== undefined) {
          parts.push(`  Stand hours: ${data.standHours}`);
        }
        parts.push("");
      }

      // Heart rate
      if (data.heartRate && data.heartRate.length > 0) {
        const analysis = this.analyzeHeartRate(data.heartRate);
        parts.push("❤️ Heart Rate");
        parts.push(`  Average: ${analysis.avgBpm} bpm`);
        parts.push(
          `  Range: ${analysis.minBpm} - ${analysis.maxBpm} bpm`
        );
        if (analysis.restingBpm) {
          parts.push(`  Resting: ${analysis.restingBpm} bpm`);
        }
        parts.push("");
      }

      // Blood oxygen
      if (data.bloodOxygen && data.bloodOxygen.length > 0) {
        const avgSpo2 =
          data.bloodOxygen.reduce((sum, bo) => sum + bo.spo2, 0) /
          data.bloodOxygen.length;
        const minSpo2 = Math.min(...data.bloodOxygen.map((bo) => bo.spo2));
        parts.push("🫁 Blood Oxygen");
        parts.push(`  Average: ${Math.round(avgSpo2)}%`);
        parts.push(`  Minimum: ${minSpo2}%`);
        parts.push("");
      }

      // Blood pressure
      if (data.bloodPressure && data.bloodPressure.length > 0) {
        const latest =
          data.bloodPressure[data.bloodPressure.length - 1];
        parts.push("🩸 Blood Pressure");
        parts.push(
          `  Latest: ${latest.systolic}/${latest.diastolic} mmHg`
        );
        parts.push(
          `  Category: ${this.getBloodPressureCategoryKo(latest.systolic, latest.diastolic)}`
        );
        parts.push("");
      }

      // Sleep
      if (data.sleep) {
        const sleepAnalysis = this.analyzeSleep(data.sleep);
        parts.push("😴 Sleep");
        parts.push(
          `  Total sleep: ${sleepAnalysis.totalHours.toFixed(1)} hours`
        );
        parts.push(`  Sleep score: ${sleepAnalysis.score}/100`);
        parts.push(
          `  Quality: ${this.getSleepQualityKo(sleepAnalysis.quality)}`
        );
        if (data.sleep.stages) {
          parts.push(
            `  Deep sleep: ${data.sleep.stages.deep} min (${sleepAnalysis.deepSleepPercent.toFixed(0)}%)`
          );
          parts.push(
            `  REM sleep: ${data.sleep.stages.rem} min (${sleepAnalysis.remSleepPercent.toFixed(0)}%)`
          );
        }
        parts.push("");
      }

      // Stress
      if (data.stressLevel !== undefined) {
        parts.push("🧠 Stress");
        parts.push(
          `  Level: ${data.stressLevel}/100 (${this.getStressLevelKo(data.stressLevel)})`
        );
        parts.push("");
      }

      // Anomalies
      const anomalies = this.detectAnomalies(data);
      if (anomalies.length > 0) {
        parts.push("⚠️ Alerts");
        for (const anomaly of anomalies) {
          const icon =
            anomaly.type === "critical" ? "🚨" : anomaly.type === "warning" ? "⚠️" : "ℹ️";
          parts.push(`  ${icon} ${anomaly.messageKo}`);
          parts.push(`     → ${anomaly.recommendationKo}`);
        }
      }
    } else {
      // English
      parts.push("📊 Daily Health Summary");
      parts.push(`Data source: ${this.getSourceName(data.source)}`);
      parts.push("");

      // Activity
      if (data.steps || data.activeCalories || data.exerciseMinutes) {
        parts.push("🏃 Activity");
        if (data.steps) {
          const goalPercent = data.steps.goal
            ? Math.round((data.steps.count / data.steps.goal) * 100)
            : null;
          parts.push(
            `  Steps: ${data.steps.count.toLocaleString()}${goalPercent !== null ? ` (${goalPercent}% of goal)` : ""}`
          );
        }
        if (data.activeCalories) {
          parts.push(
            `  Active calories: ${Math.round(data.activeCalories)} kcal`
          );
        }
        if (data.exerciseMinutes) {
          parts.push(
            `  Exercise: ${Math.round(data.exerciseMinutes)} min`
          );
        }
        if (data.distance) {
          parts.push(
            `  Distance: ${(data.distance / 1000).toFixed(1)} km`
          );
        }
        if (data.standHours !== undefined) {
          parts.push(`  Stand hours: ${data.standHours}`);
        }
        parts.push("");
      }

      // Heart rate
      if (data.heartRate && data.heartRate.length > 0) {
        const analysis = this.analyzeHeartRate(data.heartRate);
        parts.push("❤️ Heart Rate");
        parts.push(`  Average: ${analysis.avgBpm} bpm`);
        parts.push(
          `  Range: ${analysis.minBpm} - ${analysis.maxBpm} bpm`
        );
        if (analysis.restingBpm) {
          parts.push(`  Resting: ${analysis.restingBpm} bpm`);
        }
        parts.push("");
      }

      // Blood oxygen
      if (data.bloodOxygen && data.bloodOxygen.length > 0) {
        const avgSpo2 =
          data.bloodOxygen.reduce((sum, bo) => sum + bo.spo2, 0) /
          data.bloodOxygen.length;
        const minSpo2 = Math.min(...data.bloodOxygen.map((bo) => bo.spo2));
        parts.push("🫁 Blood Oxygen");
        parts.push(`  Average: ${Math.round(avgSpo2)}%`);
        parts.push(`  Minimum: ${minSpo2}%`);
        parts.push("");
      }

      // Blood pressure
      if (data.bloodPressure && data.bloodPressure.length > 0) {
        const latest =
          data.bloodPressure[data.bloodPressure.length - 1];
        parts.push("🩸 Blood Pressure");
        parts.push(
          `  Latest: ${latest.systolic}/${latest.diastolic} mmHg`
        );
        parts.push(
          `  Category: ${this.getBloodPressureCategory(latest.systolic, latest.diastolic)}`
        );
        parts.push("");
      }

      // Sleep
      if (data.sleep) {
        const sleepAnalysis = this.analyzeSleep(data.sleep);
        parts.push("😴 Sleep");
        parts.push(
          `  Total sleep: ${sleepAnalysis.totalHours.toFixed(1)} hours`
        );
        parts.push(`  Sleep score: ${sleepAnalysis.score}/100`);
        parts.push(`  Quality: ${sleepAnalysis.quality}`);
        if (data.sleep.stages) {
          parts.push(
            `  Deep sleep: ${data.sleep.stages.deep} min (${sleepAnalysis.deepSleepPercent.toFixed(0)}%)`
          );
          parts.push(
            `  REM sleep: ${data.sleep.stages.rem} min (${sleepAnalysis.remSleepPercent.toFixed(0)}%)`
          );
        }
        parts.push("");
      }

      // Stress
      if (data.stressLevel !== undefined) {
        parts.push("🧠 Stress");
        parts.push(
          `  Level: ${data.stressLevel}/100 (${this.getStressLevel(data.stressLevel)})`
        );
        parts.push("");
      }

      // Anomalies
      const anomalies = this.detectAnomalies(data);
      if (anomalies.length > 0) {
        parts.push("⚠️ Alerts");
        for (const anomaly of anomalies) {
          const icon =
            anomaly.type === "critical" ? "🚨" : anomaly.type === "warning" ? "⚠️" : "ℹ️";
          parts.push(`  ${icon} ${anomaly.message}`);
          parts.push(`     → ${anomaly.recommendation}`);
        }
      }
    }

    return parts.join("\n");
  }

  // ── Verify Exercise for Exercise Pool ──

  verifyExercise(
    data: WearableData,
    requiredMinutes: number
  ): ExerciseVerification {
    let totalMinutes = data.exerciseMinutes || 0;
    const activeCalories = data.activeCalories || 0;
    const exerciseTypes: string[] = [];
    let confidence = 0;

    // Primary verification: exercise minutes from wearable
    if (data.exerciseMinutes && data.exerciseMinutes > 0) {
      confidence += 0.4;
      exerciseTypes.push("tracked_workout");
    }

    // Secondary verification: heart rate data corroborates exercise
    let avgHeartRate: number | undefined;
    if (data.heartRate && data.heartRate.length > 0) {
      const activeSamples = data.heartRate.filter(
        (hr) => hr.context === "workout" || hr.context === "active"
      );

      if (activeSamples.length > 0) {
        avgHeartRate =
          activeSamples.reduce((sum, hr) => sum + hr.bpm, 0) /
          activeSamples.length;

        // Heart rate during exercise should be elevated
        if (avgHeartRate > 100) {
          confidence += 0.3;
        } else if (avgHeartRate > 80) {
          confidence += 0.15;
        }
      }

      // Also check for sustained elevated heart rate periods
      const elevatedPeriods = this.findElevatedHeartRatePeriods(
        data.heartRate,
        100
      );
      const elevatedMinutes = elevatedPeriods.reduce(
        (sum, period) => sum + period.durationMinutes,
        0
      );

      // If no explicit exercise minutes but heart rate shows activity
      if (totalMinutes === 0 && elevatedMinutes > 5) {
        totalMinutes = elevatedMinutes;
        exerciseTypes.push("heart_rate_inferred");
        confidence += 0.2;
      }
    }

    // Tertiary: step count corroboration
    if (data.steps && data.steps.count > 3000) {
      confidence += 0.1;
      if (data.steps.count > 8000) {
        exerciseTypes.push("high_step_count");
        confidence += 0.1;
      }
    }

    // Calories corroboration
    if (activeCalories > 100) {
      confidence += 0.1;
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    // Anti-gaming: check for suspicious patterns
    if (data.heartRate && data.heartRate.length > 10) {
      const values = data.heartRate.map((hr) => hr.bpm);
      const stdDev = this.standardDeviation(values);
      // Real exercise heart rate has variability; fake data often has low std dev
      if (stdDev < 2 && data.exerciseMinutes && data.exerciseMinutes > 10) {
        confidence *= 0.5; // Penalize suspicious constant heart rate
      }
    }

    const verified = totalMinutes >= requiredMinutes && confidence >= 0.4;

    const message = verified
      ? `Exercise verified: ${Math.round(totalMinutes)} minutes (required: ${requiredMinutes} min, confidence: ${(confidence * 100).toFixed(0)}%)`
      : `Exercise not verified: ${Math.round(totalMinutes)} minutes recorded (required: ${requiredMinutes} min, confidence: ${(confidence * 100).toFixed(0)}%)`;

    const messageKo = verified
      ? `Exercise verified: ${Math.round(totalMinutes)} minutes (required: ${requiredMinutes} min, confidence: ${(confidence * 100).toFixed(0)}%)`
      : `Exercise not verified: ${Math.round(totalMinutes)} minutes recorded (required: ${requiredMinutes} min, confidence: ${(confidence * 100).toFixed(0)}%)`;

    return {
      verified,
      totalMinutes: Math.round(totalMinutes),
      requiredMinutes,
      activeCalories: Math.round(activeCalories),
      avgHeartRate: avgHeartRate ? Math.round(avgHeartRate) : undefined,
      exerciseTypes,
      confidence,
      message,
      messageKo,
    };
  }

  // ── Sleep Quality Analysis ──

  analyzeSleep(sleep: SleepData): SleepAnalysis {
    const totalHours = sleep.totalMinutes / 60;
    const insights: string[] = [];
    const insightsKo: string[] = [];

    // Calculate percentages
    let deepSleepPercent = 0;
    let remSleepPercent = 0;
    let efficiency = 1.0;

    if (sleep.stages && sleep.totalMinutes > 0) {
      deepSleepPercent =
        (sleep.stages.deep / sleep.totalMinutes) * 100;
      remSleepPercent =
        (sleep.stages.rem / sleep.totalMinutes) * 100;
      const totalInBed =
        sleep.stages.awake +
        sleep.stages.light +
        sleep.stages.deep +
        sleep.stages.rem;
      efficiency =
        totalInBed > 0
          ? sleep.totalMinutes / totalInBed
          : 1.0;
    }

    // Score calculation
    let score = sleep.sleepScore || 0;
    if (!sleep.sleepScore) {
      // Duration score (0-35): 7-9 hours is optimal
      let durationScore = 0;
      if (totalHours >= 7 && totalHours <= 9) {
        durationScore = 35;
      } else if (totalHours >= 6 && totalHours < 7) {
        durationScore = 25;
      } else if (totalHours > 9 && totalHours <= 10) {
        durationScore = 25;
      } else if (totalHours >= 5) {
        durationScore = 15;
      } else {
        durationScore = 5;
      }

      // Deep sleep score (0-25): 15-25% is ideal
      let deepScore = 0;
      if (deepSleepPercent >= 15 && deepSleepPercent <= 25) {
        deepScore = 25;
      } else if (deepSleepPercent >= 10) {
        deepScore = 15;
      } else if (deepSleepPercent >= 5) {
        deepScore = 8;
      }

      // REM score (0-25): 20-25% is ideal
      let remScore = 0;
      if (remSleepPercent >= 20 && remSleepPercent <= 25) {
        remScore = 25;
      } else if (remSleepPercent >= 15) {
        remScore = 15;
      } else if (remSleepPercent >= 10) {
        remScore = 8;
      }

      // Efficiency score (0-15)
      const efficiencyScore = Math.round(efficiency * 15);

      score = Math.min(
        durationScore + deepScore + remScore + efficiencyScore,
        100
      );
    }

    // Determine quality
    let quality: SleepAnalysis["quality"];
    if (score >= 80) quality = "excellent";
    else if (score >= 60) quality = "good";
    else if (score >= 40) quality = "fair";
    else quality = "poor";

    // Generate insights
    if (totalHours < 6) {
      insights.push(
        "You slept less than 6 hours. Aim for 7-9 hours for optimal health."
      );
      insightsKo.push(
        "You slept less than 6 hours. Aim for 7-9 hours for optimal health."
      );
    } else if (totalHours > 10) {
      insights.push(
        "You slept more than 10 hours. Excessive sleep may indicate underlying health issues."
      );
      insightsKo.push(
        "You slept more than 10 hours. Excessive sleep may indicate underlying health issues."
      );
    }

    if (deepSleepPercent < 10 && sleep.stages) {
      insights.push(
        "Deep sleep was low. Avoid caffeine and screens before bed to improve deep sleep."
      );
      insightsKo.push(
        "Deep sleep was low. Avoid caffeine and screens before bed to improve deep sleep."
      );
    }

    if (remSleepPercent < 15 && sleep.stages) {
      insights.push(
        "REM sleep was below optimal. Maintain a consistent sleep schedule to improve REM."
      );
      insightsKo.push(
        "REM sleep was below optimal. Maintain a consistent sleep schedule to improve REM."
      );
    }

    if (sleep.stages && sleep.stages.awake > 60) {
      insights.push(
        "You were awake for a significant period during the night. Consider sleep environment improvements."
      );
      insightsKo.push(
        "You were awake for a significant period during the night. Consider sleep environment improvements."
      );
    }

    // Bedtime analysis
    const bedHour = new Date(sleep.bedtime).getHours();
    if (bedHour >= 0 && bedHour < 4) {
      // Went to bed between midnight and 4am
      insights.push(
        "Late bedtime detected. Going to bed before midnight can improve sleep quality."
      );
      insightsKo.push(
        "Late bedtime detected. Going to bed before midnight can improve sleep quality."
      );
    }

    return {
      quality,
      score,
      totalHours,
      deepSleepPercent,
      remSleepPercent,
      efficiency,
      insights,
      insightsKo,
    };
  }

  // ── Heart Rate Analysis ──

  analyzeHeartRate(heartRates: HeartRateData[]): HeartRateAnalysis {
    if (heartRates.length === 0) {
      return {
        avgBpm: 0,
        minBpm: 0,
        maxBpm: 0,
        zones: { rest: 0, fatBurn: 0, cardio: 0, peak: 0 },
        variability: "normal",
        insights: [],
        insightsKo: [],
      };
    }

    const bpmValues = heartRates.map((hr) => hr.bpm);
    const avgBpm = Math.round(
      bpmValues.reduce((sum, v) => sum + v, 0) / bpmValues.length
    );
    const minBpm = Math.min(...bpmValues);
    const maxBpm = Math.max(...bpmValues);

    // Resting heart rate: average of readings with "resting" context or lowest 10%
    const restingSamples = heartRates.filter(
      (hr) => hr.context === "resting"
    );
    let restingBpm: number | undefined;
    if (restingSamples.length > 0) {
      restingBpm = Math.round(
        restingSamples.reduce((sum, hr) => sum + hr.bpm, 0) /
          restingSamples.length
      );
    } else {
      // Use lowest 10th percentile as resting estimate
      const sorted = [...bpmValues].sort((a, b) => a - b);
      const tenth = Math.max(1, Math.floor(sorted.length * 0.1));
      restingBpm = Math.round(
        sorted.slice(0, tenth).reduce((sum, v) => sum + v, 0) / tenth
      );
    }

    // Heart rate zones (approximate minutes based on sample count)
    // Estimate ~1 minute per sample as a rough approximation
    let restMinutes = 0;
    let fatBurnMinutes = 0;
    let cardioMinutes = 0;
    let peakMinutes = 0;

    for (const hr of heartRates) {
      if (hr.bpm <= HR_ZONE_REST_MAX) restMinutes++;
      else if (hr.bpm <= HR_ZONE_FAT_BURN_MAX) fatBurnMinutes++;
      else if (hr.bpm <= HR_ZONE_CARDIO_MAX) cardioMinutes++;
      else peakMinutes++;
    }

    // Heart rate variability (simple std dev approach)
    const stdDev = this.standardDeviation(bpmValues);
    let variability: HeartRateAnalysis["variability"];
    if (stdDev < 5) variability = "low";
    else if (stdDev > 20) variability = "high";
    else variability = "normal";

    // Insights
    const insights: string[] = [];
    const insightsKo: string[] = [];

    if (restingBpm && restingBpm < 60) {
      insights.push(
        `Excellent resting heart rate (${restingBpm} bpm). This indicates good cardiovascular fitness.`
      );
      insightsKo.push(
        `Excellent resting heart rate (${restingBpm} bpm). This indicates good cardiovascular fitness.`
      );
    } else if (restingBpm && restingBpm > 100) {
      insights.push(
        `Elevated resting heart rate (${restingBpm} bpm). Consider consulting a healthcare provider.`
      );
      insightsKo.push(
        `Elevated resting heart rate (${restingBpm} bpm). Consider consulting a healthcare provider.`
      );
    }

    if (variability === "low") {
      insights.push(
        "Low heart rate variability detected. This may indicate stress or fatigue."
      );
      insightsKo.push(
        "Low heart rate variability detected. This may indicate stress or fatigue."
      );
    }

    if (maxBpm - minBpm > 120) {
      insights.push(
        `Wide heart rate range today (${minBpm}-${maxBpm} bpm). Ensure adequate hydration and recovery.`
      );
      insightsKo.push(
        `Wide heart rate range today (${minBpm}-${maxBpm} bpm). Ensure adequate hydration and recovery.`
      );
    }

    if (cardioMinutes + peakMinutes > 30) {
      insights.push(
        `Great workout! You spent ${cardioMinutes + peakMinutes} minutes in cardio/peak zones.`
      );
      insightsKo.push(
        `Great workout! You spent ${cardioMinutes + peakMinutes} minutes in cardio/peak zones.`
      );
    }

    return {
      avgBpm,
      minBpm,
      maxBpm,
      restingBpm,
      zones: {
        rest: restMinutes,
        fatBurn: fatBurnMinutes,
        cardio: cardioMinutes,
        peak: peakMinutes,
      },
      variability,
      insights,
      insightsKo,
    };
  }

  // ── Helper Methods ──

  private findElevatedHeartRatePeriods(
    heartRates: HeartRateData[],
    threshold: number
  ): { start: string; end: string; durationMinutes: number }[] {
    const periods: {
      start: string;
      end: string;
      durationMinutes: number;
    }[] = [];

    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    for (const hr of heartRates) {
      if (hr.bpm >= threshold) {
        if (!periodStart) {
          periodStart = hr.timestamp;
        }
        periodEnd = hr.timestamp;
      } else {
        if (periodStart && periodEnd) {
          const durationMs =
            new Date(periodEnd).getTime() -
            new Date(periodStart).getTime();
          const durationMinutes = durationMs / 60000;
          if (durationMinutes >= 5) {
            // Only count periods >= 5 min
            periods.push({
              start: periodStart,
              end: periodEnd,
              durationMinutes,
            });
          }
        }
        periodStart = null;
        periodEnd = null;
      }
    }

    // Handle final period
    if (periodStart && periodEnd) {
      const durationMs =
        new Date(periodEnd).getTime() -
        new Date(periodStart).getTime();
      const durationMinutes = durationMs / 60000;
      if (durationMinutes >= 5) {
        periods.push({
          start: periodStart,
          end: periodEnd,
          durationMinutes,
        });
      }
    }

    return periods;
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squareDiffs = values.map((v) => (v - avg) ** 2);
    const avgSquareDiff =
      squareDiffs.reduce((sum, v) => sum + v, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  private getSourceName(source: string): string {
    const names: Record<string, string> = {
      apple_health: "Apple Health",
      samsung_health: "Samsung Health",
      google_fit: "Google Fit",
      fitbit: "Fitbit",
      garmin: "Garmin",
    };
    return names[source] || source;
  }

  private getSourceNameKo(source: string): string {
    const names: Record<string, string> = {
      apple_health: "Apple Health",
      samsung_health: "Samsung Health",
      google_fit: "Google Fit",
      fitbit: "Fitbit",
      garmin: "Garmin",
    };
    return names[source] || source;
  }

  private getBloodPressureCategory(
    systolic: number,
    diastolic: number
  ): string {
    if (systolic < 120 && diastolic < 80) return "Normal";
    if (systolic < 130 && diastolic < 80) return "Elevated";
    if (systolic < 140 || diastolic < 90)
      return "High Blood Pressure Stage 1";
    if (systolic < 180 || diastolic < 120)
      return "High Blood Pressure Stage 2";
    return "Hypertensive Crisis";
  }

  private getBloodPressureCategoryKo(
    systolic: number,
    diastolic: number
  ): string {
    if (systolic < 120 && diastolic < 80) return "Normal";
    if (systolic < 130 && diastolic < 80) return "Elevated";
    if (systolic < 140 || diastolic < 90) return "High Blood Pressure Stage 1";
    if (systolic < 180 || diastolic < 120) return "High Blood Pressure Stage 2";
    return "Hypertensive Crisis";
  }

  private getStressLevel(level: number): string {
    if (level <= 25) return "Low";
    if (level <= 50) return "Moderate";
    if (level <= 75) return "High";
    return "Very High";
  }

  private getStressLevelKo(level: number): string {
    if (level <= 25) return "Low";
    if (level <= 50) return "Moderate";
    if (level <= 75) return "High";
    return "Very High";
  }

  private getSleepQualityKo(
    quality: SleepAnalysis["quality"]
  ): string {
    const map: Record<string, string> = {
      poor: "poor",
      fair: "fair",
      good: "good",
      excellent: "excellent",
    };
    return map[quality] || quality;
  }
}
