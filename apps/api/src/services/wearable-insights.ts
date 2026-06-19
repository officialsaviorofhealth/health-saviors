// Wearable Data Insight Analysis Service
// Processes raw wearable data into actionable health insights for
// the debate feature and data marketplace.

import { prisma } from "../app";
import { analyticsCache, CacheKeys } from "./cache";

// ── Interfaces ──────────────────────────────────────────────

export interface WearableRawData {
  heartRate: Array<{ timestamp: number; value: number }>;
  sleep: Array<{
    date: string;
    duration: number;      // total sleep in minutes
    deepSleep: number;     // minutes
    remSleep: number;      // minutes
    lightSleep: number;    // minutes
    awake: number;         // minutes
  }>;
  steps: Array<{ date: string; count: number }>;
  bloodOxygen?: Array<{ timestamp: number; value: number }>;
  stress?: Array<{ timestamp: number; value: number }>;
  temperature?: Array<{ timestamp: number; value: number }>;
}

export interface WearableInsight {
  category: "heart" | "sleep" | "activity" | "respiratory" | "stress" | "overall";
  severity: "info" | "warning" | "alert";
  title: string;
  description: string;
  dataPoints: Record<string, number>;
  recommendation: string;
}

export interface HeartRateAnalysis {
  avg: number;
  min: number;
  max: number;
  resting: number;
  trend: "improving" | "stable" | "declining";
  anomalies: number;
}

export interface SleepAnalysis {
  avgDuration: number;       // minutes
  avgDeepSleep: number;      // minutes
  avgQuality: number;        // 0-100
  trend: "improving" | "stable" | "declining";
  consistency: number;       // 0-100
}

export interface ActivityAnalysis {
  avgSteps: number;
  activeDays: number;
  totalDays: number;
  trend: "improving" | "stable" | "declining";
}

export interface WearableSummary {
  period: { from: string; to: string };
  heartRate: HeartRateAnalysis;
  sleep: SleepAnalysis;
  activity: ActivityAnalysis;
  insights: WearableInsight[];
  overallScore: number;      // 0-100
  dataQuality: "high" | "medium" | "low";
}

// ── Thresholds based on medical guidelines ──────────

const THRESHOLDS = {
  // Heart rate (adults at rest) — AHA guidelines
  TACHYCARDIA_BPM: 100,
  BRADYCARDIA_BPM: 50,
  OPTIMAL_RESTING_HR_LOW: 60,
  OPTIMAL_RESTING_HR_HIGH: 80,
  EXCELLENT_RESTING_HR: 55,
  POOR_RESTING_HR: 90,

  // Sleep — National Sleep Foundation
  MIN_RECOMMENDED_SLEEP_MIN: 420,    // 7 hours
  OPTIMAL_SLEEP_MIN: 480,            // 8 hours
  MAX_RECOMMENDED_SLEEP_MIN: 540,    // 9 hours
  DEEP_SLEEP_MIN_PERCENT: 0.15,     // at least 15% deep sleep
  DEEP_SLEEP_IDEAL_PERCENT: 0.20,   // ideal ~20%
  REM_SLEEP_MIN_PERCENT: 0.20,      // at least 20% REM
  SLEEP_CONSISTENCY_THRESHOLD_MIN: 60, // bedtime variance threshold

  // Activity — WHO / CDC
  SEDENTARY_STEPS: 3000,
  LOW_ACTIVE_STEPS: 5000,
  ACTIVE_STEPS: 7500,
  HIGHLY_ACTIVE_STEPS: 10000,
  WEEKLY_STEP_GOAL: 70000,

  // Blood oxygen — medical norms
  NORMAL_SPO2_MIN: 95,
  CONCERNING_SPO2: 92,
  CRITICAL_SPO2: 90,

  // Stress (arbitrary 0-100 scale from wearables)
  LOW_STRESS: 30,
  MODERATE_STRESS: 50,
  HIGH_STRESS: 70,
  VERY_HIGH_STRESS: 85,

  // Body temperature (Celsius)
  NORMAL_TEMP_LOW: 36.1,
  NORMAL_TEMP_HIGH: 37.2,
  FEVER_TEMP: 37.8,
  HIGH_FEVER_TEMP: 38.3,
};

// ── Heart Rate Analysis ────────────────────────────────────

export function analyzeHeartRate(
  data: WearableRawData["heartRate"],
): { analysis: HeartRateAnalysis; insights: WearableInsight[] } {
  const insights: WearableInsight[] = [];

  if (!data || data.length === 0) {
    return {
      analysis: {
        avg: 0, min: 0, max: 0, resting: 0,
        trend: "stable", anomalies: 0,
      },
      insights: [],
    };
  }

  // Sort by timestamp
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map((d) => d.value);

  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Estimate resting HR: lowest 10th percentile average
  // (approximation — true resting HR requires context like "at rest")
  const sortedByValue = [...values].sort((a, b) => a - b);
  const p10Index = Math.max(1, Math.floor(sortedByValue.length * 0.10));
  const restingCandidates = sortedByValue.slice(0, p10Index);
  const resting = Math.round(
    restingCandidates.reduce((s, v) => s + v, 0) / restingCandidates.length,
  );

  // Trend: compare first-half average vs second-half average
  const mid = Math.floor(sorted.length / 2);
  const firstHalfAvg = sorted.slice(0, mid).reduce((s, d) => s + d.value, 0) / Math.max(mid, 1);
  const secondHalfAvg = sorted.slice(mid).reduce((s, d) => s + d.value, 0) / Math.max(sorted.length - mid, 1);
  const trendDelta = secondHalfAvg - firstHalfAvg;

  // For resting HR, lower is generally better (within reason)
  let trend: "improving" | "stable" | "declining";
  if (trendDelta < -2) {
    trend = "improving"; // resting HR going down = improving
  } else if (trendDelta > 2) {
    trend = "declining"; // resting HR going up = declining
  } else {
    trend = "stable";
  }

  // Count anomalies: tachycardia or bradycardia events
  let tachycardiaCount = 0;
  let bradycardiaCount = 0;
  for (const v of values) {
    if (v > THRESHOLDS.TACHYCARDIA_BPM) tachycardiaCount++;
    if (v < THRESHOLDS.BRADYCARDIA_BPM) bradycardiaCount++;
  }
  const anomalies = tachycardiaCount + bradycardiaCount;

  // Generate insights

  // Tachycardia events
  if (tachycardiaCount > 0) {
    const pct = Math.round((tachycardiaCount / values.length) * 100);
    const severity = pct > 20 ? "alert" : "warning";
    insights.push({
      category: "heart",
      severity,
      title: "Elevated Heart Rate Events Detected",
      description: `${tachycardiaCount} readings exceeded 100 bpm (${pct}% of measurements). Sustained elevated heart rate at rest may indicate stress, dehydration, or cardiovascular concerns.`,
      dataPoints: {
        tachycardiaCount,
        percentageOfReadings: pct,
        maxRecorded: max,
      },
      recommendation: "Monitor your heart rate during rest periods. If elevated HR persists, consult a healthcare provider. Stay hydrated and manage stress.",
    });
  }

  // Bradycardia events
  if (bradycardiaCount > 0) {
    const pct = Math.round((bradycardiaCount / values.length) * 100);
    // Bradycardia can be normal for athletes, alert only if significant
    const severity = pct > 30 ? "warning" : "info";
    insights.push({
      category: "heart",
      severity,
      title: "Low Heart Rate Events Detected",
      description: `${bradycardiaCount} readings were below 50 bpm (${pct}% of measurements). This may be normal for well-conditioned athletes, but should be evaluated if accompanied by dizziness or fatigue.`,
      dataPoints: {
        bradycardiaCount,
        percentageOfReadings: pct,
        minRecorded: min,
      },
      recommendation: "If you are not a trained athlete and experience dizziness, fainting, or fatigue, consult a healthcare provider.",
    });
  }

  // High resting heart rate
  if (resting > THRESHOLDS.POOR_RESTING_HR) {
    insights.push({
      category: "heart",
      severity: "warning",
      title: "Elevated Resting Heart Rate",
      description: `Your estimated resting heart rate is ${resting} bpm, above the optimal range of 60-80 bpm. A higher resting HR is associated with increased cardiovascular risk over time.`,
      dataPoints: { restingHR: resting, optimalMax: THRESHOLDS.OPTIMAL_RESTING_HR_HIGH },
      recommendation: "Regular aerobic exercise, stress reduction, adequate sleep, and reducing caffeine/alcohol can help lower resting heart rate.",
    });
  } else if (resting <= THRESHOLDS.EXCELLENT_RESTING_HR && resting > 0) {
    insights.push({
      category: "heart",
      severity: "info",
      title: "Excellent Resting Heart Rate",
      description: `Your estimated resting heart rate is ${resting} bpm, which is in the excellent range, typically seen in well-conditioned individuals.`,
      dataPoints: { restingHR: resting },
      recommendation: "Keep up your current fitness routine. Your cardiovascular health indicators are strong.",
    });
  }

  // Heart rate variability proxy: standard deviation of resting-range values
  const restingRangeValues = values.filter(
    (v) => v >= THRESHOLDS.BRADYCARDIA_BPM && v <= THRESHOLDS.OPTIMAL_RESTING_HR_HIGH,
  );
  if (restingRangeValues.length >= 10) {
    const mean = restingRangeValues.reduce((s, v) => s + v, 0) / restingRangeValues.length;
    const variance = restingRangeValues.reduce((s, v) => s + (v - mean) ** 2, 0) / restingRangeValues.length;
    const stdDev = Math.sqrt(variance);

    // Low variability in resting HR can indicate poor autonomic function
    if (stdDev < 3) {
      insights.push({
        category: "heart",
        severity: "info",
        title: "Low Heart Rate Variability Observed",
        description: `Your heart rate shows low variability (std dev: ${stdDev.toFixed(1)} bpm) during resting periods. While this may be influenced by measurement frequency, low HRV can be associated with stress or fatigue.`,
        dataPoints: { hrvStdDev: parseFloat(stdDev.toFixed(1)), sampleSize: restingRangeValues.length },
        recommendation: "Deep breathing exercises, meditation, and regular physical activity can help improve heart rate variability.",
      });
    }
  }

  // Trend-based insight
  if (trend === "declining") {
    insights.push({
      category: "heart",
      severity: "warning",
      title: "Heart Rate Trend Increasing",
      description: `Your heart rate has been trending upward over the analysis period (avg change: +${Math.abs(Math.round(trendDelta))} bpm). This could reflect increased stress, reduced fitness, or other factors.`,
      dataPoints: { trendDelta: parseFloat(trendDelta.toFixed(1)), firstHalfAvg: Math.round(firstHalfAvg), secondHalfAvg: Math.round(secondHalfAvg) },
      recommendation: "Review your recent lifestyle changes. Ensure adequate sleep, hydration, and recovery between activities.",
    });
  }

  return {
    analysis: { avg, min, max, resting, trend, anomalies },
    insights,
  };
}

// ── Sleep Analysis ───────────────────────────────────────────

export function analyzeSleep(
  data: WearableRawData["sleep"],
): { analysis: SleepAnalysis; insights: WearableInsight[] } {
  const insights: WearableInsight[] = [];

  if (!data || data.length === 0) {
    return {
      analysis: {
        avgDuration: 0, avgDeepSleep: 0, avgQuality: 0,
        trend: "stable", consistency: 0,
      },
      insights: [],
    };
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Compute averages
  const avgDuration = Math.round(
    sorted.reduce((s, d) => s + d.duration, 0) / sorted.length,
  );
  const avgDeepSleep = Math.round(
    sorted.reduce((s, d) => s + d.deepSleep, 0) / sorted.length,
  );
  const avgRemSleep = Math.round(
    sorted.reduce((s, d) => s + d.remSleep, 0) / sorted.length,
  );
  const avgLightSleep = Math.round(
    sorted.reduce((s, d) => s + d.lightSleep, 0) / sorted.length,
  );
  const avgAwake = Math.round(
    sorted.reduce((s, d) => s + d.awake, 0) / sorted.length,
  );

  // Sleep consistency: standard deviation of sleep duration
  const durationMean = sorted.reduce((s, d) => s + d.duration, 0) / sorted.length;
  const durationVariance =
    sorted.reduce((s, d) => s + (d.duration - durationMean) ** 2, 0) / sorted.length;
  const durationStdDev = Math.sqrt(durationVariance);

  // Consistency score: 0-100 (lower std dev = higher consistency)
  // A perfect score means < 15 min std dev, worst is > 120 min std dev
  const consistency = Math.round(
    Math.max(0, Math.min(100, 100 - ((durationStdDev - 15) / 105) * 100)),
  );

  // Sleep quality composite: duration (40%) + deep sleep % (25%) + REM % (15%) + consistency (20%)
  const durationScore = Math.min(100, Math.max(0,
    avgDuration >= THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN
      ? Math.min(100, ((avgDuration - 300) / (THRESHOLDS.OPTIMAL_SLEEP_MIN - 300)) * 100)
      : (avgDuration / THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN) * 80,
  ));

  const deepSleepPct = avgDuration > 0 ? avgDeepSleep / avgDuration : 0;
  const deepSleepScore = Math.min(100, Math.max(0,
    deepSleepPct >= THRESHOLDS.DEEP_SLEEP_IDEAL_PERCENT
      ? 100
      : (deepSleepPct / THRESHOLDS.DEEP_SLEEP_IDEAL_PERCENT) * 100,
  ));

  const remSleepPct = avgDuration > 0 ? avgRemSleep / avgDuration : 0;
  const remSleepScore = Math.min(100, Math.max(0,
    remSleepPct >= THRESHOLDS.REM_SLEEP_MIN_PERCENT
      ? 100
      : (remSleepPct / THRESHOLDS.REM_SLEEP_MIN_PERCENT) * 100,
  ));

  const avgQuality = Math.round(
    durationScore * 0.40 + deepSleepScore * 0.25 + remSleepScore * 0.15 + consistency * 0.20,
  );

  // Trend: compare first half avg duration vs second half
  const mid = Math.floor(sorted.length / 2);
  const firstHalfDur = sorted.slice(0, Math.max(mid, 1)).reduce((s, d) => s + d.duration, 0) / Math.max(mid, 1);
  const secondHalfDur = sorted.slice(mid).reduce((s, d) => s + d.duration, 0) / Math.max(sorted.length - mid, 1);
  const trendDelta = secondHalfDur - firstHalfDur;

  let trend: "improving" | "stable" | "declining";
  if (trendDelta > 15) {
    trend = "improving"; // sleeping more = improving (up to a point)
  } else if (trendDelta < -15) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  // Generate insights

  // Sleep debt
  if (avgDuration < THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN) {
    const deficit = THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN - avgDuration;
    const deficitHours = (deficit / 60).toFixed(1);
    const avgHours = (avgDuration / 60).toFixed(1);
    const severity = avgDuration < 360 ? "alert" : "warning"; // < 6h is alert

    insights.push({
      category: "sleep",
      severity,
      title: "Sleep Debt Detected",
      description: `Your average sleep duration is ${avgHours} hours, ${deficitHours} hours below the recommended 7 hours. Chronic sleep deprivation is linked to weakened immunity, impaired cognition, and increased disease risk.`,
      dataPoints: { avgDurationMin: avgDuration, deficitMin: deficit, targetMin: THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN },
      recommendation: "Aim to go to bed 30 minutes earlier. Establish a consistent bedtime routine and avoid screens 1 hour before sleep.",
    });
  }

  // Excessive sleep
  if (avgDuration > THRESHOLDS.MAX_RECOMMENDED_SLEEP_MIN) {
    const excessHours = ((avgDuration - THRESHOLDS.MAX_RECOMMENDED_SLEEP_MIN) / 60).toFixed(1);
    insights.push({
      category: "sleep",
      severity: "info",
      title: "Excessive Sleep Duration",
      description: `Your average sleep duration exceeds 9 hours by ${excessHours} hours. Consistently oversleeping may be associated with underlying health conditions or depression.`,
      dataPoints: { avgDurationMin: avgDuration, excessMin: avgDuration - THRESHOLDS.MAX_RECOMMENDED_SLEEP_MIN },
      recommendation: "If you consistently sleep more than 9 hours and still feel tired, consider consulting a healthcare provider to rule out conditions like hypothyroidism or sleep apnea.",
    });
  }

  // Deep sleep deficiency
  if (avgDuration > 0 && deepSleepPct < THRESHOLDS.DEEP_SLEEP_MIN_PERCENT) {
    const deepPctDisplay = Math.round(deepSleepPct * 100);
    insights.push({
      category: "sleep",
      severity: "warning",
      title: "Deep Sleep Deficiency",
      description: `Deep sleep accounts for only ${deepPctDisplay}% of your total sleep, below the recommended 15-20%. Deep sleep is critical for physical recovery, immune function, and memory consolidation.`,
      dataPoints: { deepSleepPercent: deepPctDisplay, avgDeepSleepMin: avgDeepSleep, targetPercent: 15 },
      recommendation: "Avoid alcohol and heavy meals before bed. Maintain a cool, dark sleeping environment. Regular exercise (not close to bedtime) promotes deeper sleep.",
    });
  }

  // Irregular sleep schedule
  if (consistency < 50) {
    insights.push({
      category: "sleep",
      severity: "warning",
      title: "Irregular Sleep Schedule",
      description: `Your sleep schedule consistency score is ${consistency}/100. High variability in sleep duration disrupts your circadian rhythm and can impair cognitive performance and mood.`,
      dataPoints: { consistencyScore: consistency, durationStdDevMin: Math.round(durationStdDev) },
      recommendation: "Try to go to bed and wake up at the same time every day, including weekends. Consistency is more important than total duration for sleep quality.",
    });
  }

  // Good sleep insight
  if (avgQuality >= 80 && avgDuration >= THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN) {
    insights.push({
      category: "sleep",
      severity: "info",
      title: "Excellent Sleep Quality",
      description: `Your sleep quality score is ${avgQuality}/100 with an average duration of ${(avgDuration / 60).toFixed(1)} hours. Your sleep patterns indicate healthy rest and recovery.`,
      dataPoints: { qualityScore: avgQuality, avgDurationMin: avgDuration, consistencyScore: consistency },
      recommendation: "Maintain your current sleep habits. Consistent good sleep is one of the strongest predictors of long-term health.",
    });
  }

  return {
    analysis: { avgDuration, avgDeepSleep, avgQuality, trend, consistency },
    insights,
  };
}

// ── Activity Analysis ────────────────────────────────────────

export function analyzeActivity(
  data: WearableRawData["steps"],
): { analysis: ActivityAnalysis; insights: WearableInsight[] } {
  const insights: WearableInsight[] = [];

  if (!data || data.length === 0) {
    return {
      analysis: { avgSteps: 0, activeDays: 0, totalDays: 0, trend: "stable" },
      insights: [],
    };
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const totalDays = sorted.length;

  const avgSteps = Math.round(
    sorted.reduce((s, d) => s + d.count, 0) / totalDays,
  );

  // Active day: >= 7500 steps (CDC moderate activity threshold)
  const activeDays = sorted.filter((d) => d.count >= THRESHOLDS.ACTIVE_STEPS).length;

  // Sedentary days: < 3000 steps
  const sedentaryDays = sorted.filter((d) => d.count < THRESHOLDS.SEDENTARY_STEPS).length;

  // Trend
  const mid = Math.floor(totalDays / 2);
  const firstHalfAvg = sorted.slice(0, Math.max(mid, 1)).reduce((s, d) => s + d.count, 0) / Math.max(mid, 1);
  const secondHalfAvg = sorted.slice(mid).reduce((s, d) => s + d.count, 0) / Math.max(totalDays - mid, 1);
  const trendDelta = secondHalfAvg - firstHalfAvg;

  let trend: "improving" | "stable" | "declining";
  if (trendDelta > 500) {
    trend = "improving";
  } else if (trendDelta < -500) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  // Active streaks
  let maxStreak = 0;
  let currentStreak = 0;
  for (const d of sorted) {
    if (d.count >= THRESHOLDS.ACTIVE_STEPS) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Weekly goal progress
  const totalSteps = sorted.reduce((s, d) => s + d.count, 0);
  const weeks = Math.max(1, totalDays / 7);
  const weeklyAvg = Math.round(totalSteps / weeks);
  const weeklyGoalPct = Math.round((weeklyAvg / THRESHOLDS.WEEKLY_STEP_GOAL) * 100);

  // Generate insights

  // Sedentary pattern
  if (sedentaryDays > 0) {
    const sedentaryPct = Math.round((sedentaryDays / totalDays) * 100);
    if (sedentaryPct >= 50) {
      insights.push({
        category: "activity",
        severity: "warning",
        title: "Predominantly Sedentary Pattern",
        description: `${sedentaryDays} of ${totalDays} days (${sedentaryPct}%) had fewer than 3,000 steps. Prolonged sedentary behavior is linked to increased risk of cardiovascular disease, type 2 diabetes, and musculoskeletal issues.`,
        dataPoints: { sedentaryDays, totalDays, sedentaryPercent: sedentaryPct },
        recommendation: "Start with small goals: take a 10-minute walk after each meal. Use reminders to stand and move every hour. Even light activity throughout the day has significant health benefits.",
      });
    } else if (sedentaryDays >= 2) {
      insights.push({
        category: "activity",
        severity: "info",
        title: "Some Sedentary Days Detected",
        description: `${sedentaryDays} of ${totalDays} days had fewer than 3,000 steps. Try to keep movement consistent across all days.`,
        dataPoints: { sedentaryDays, totalDays },
        recommendation: "On low-activity days, try short walks, stretching, or household chores to reach at least 5,000 steps.",
      });
    }
  }

  // Weekly goal
  if (weeklyGoalPct < 50) {
    insights.push({
      category: "activity",
      severity: "warning",
      title: "Weekly Step Goal Behind",
      description: `Weekly average of ${weeklyAvg.toLocaleString()} steps is ${weeklyGoalPct}% of the 70,000 weekly goal. Regular physical activity is the single most effective thing you can do for your health.`,
      dataPoints: { weeklyAvgSteps: weeklyAvg, weeklyGoal: THRESHOLDS.WEEKLY_STEP_GOAL, goalPercent: weeklyGoalPct },
      recommendation: "Build up gradually. If currently at 3,000 steps, aim for 4,000 next week. Small, consistent increases lead to lasting habits.",
    });
  } else if (weeklyGoalPct >= 100) {
    insights.push({
      category: "activity",
      severity: "info",
      title: "Weekly Step Goal Achieved",
      description: `Weekly average of ${weeklyAvg.toLocaleString()} steps meets or exceeds the 70,000 weekly goal (${weeklyGoalPct}%). Excellent physical activity level!`,
      dataPoints: { weeklyAvgSteps: weeklyAvg, goalPercent: weeklyGoalPct, activeDays, maxStreak },
      recommendation: "Great job! Maintain this activity level. Consider adding variety with different types of exercise for balanced fitness.",
    });
  }

  // Active streak
  if (maxStreak >= 5) {
    insights.push({
      category: "activity",
      severity: "info",
      title: `${maxStreak}-Day Active Streak`,
      description: `You achieved a ${maxStreak}-day streak of 7,500+ steps. Building consistent activity habits is more important than occasional intense workouts.`,
      dataPoints: { maxStreak, activeDays, totalDays },
      recommendation: "Keep the streak going! Consistency is key. Even on busy days, a short walk can maintain your streak.",
    });
  }

  // Declining trend
  if (trend === "declining") {
    insights.push({
      category: "activity",
      severity: "warning",
      title: "Activity Level Declining",
      description: `Your daily step count has been declining over the analysis period (avg change: ${Math.round(trendDelta).toLocaleString()} steps). Maintaining consistent activity is important for long-term health.`,
      dataPoints: { trendDelta: Math.round(trendDelta), firstHalfAvg: Math.round(firstHalfAvg), secondHalfAvg: Math.round(secondHalfAvg) },
      recommendation: "Identify what changed recently — weather, schedule, motivation? Set realistic mini-goals and use accountability partners or apps.",
    });
  }

  return {
    analysis: { avgSteps, activeDays, totalDays, trend },
    insights,
  };
}

// ── Blood Oxygen Analysis ───────────────────────────────

function analyzeBloodOxygen(
  data: WearableRawData["bloodOxygen"],
): WearableInsight[] {
  if (!data || data.length === 0) return [];

  const insights: WearableInsight[] = [];
  const values = data.map((d) => d.value);
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  const min = Math.min(...values);

  const lowReadings = values.filter((v) => v < THRESHOLDS.NORMAL_SPO2_MIN);
  const criticalReadings = values.filter((v) => v < THRESHOLDS.CRITICAL_SPO2);

  if (criticalReadings.length > 0) {
    insights.push({
      category: "respiratory",
      severity: "alert",
      title: "Critical Blood Oxygen Levels Detected",
      description: `${criticalReadings.length} readings fell below 90% SpO2. Blood oxygen below 90% can indicate significant respiratory compromise and requires immediate medical attention.`,
      dataPoints: { criticalCount: criticalReadings.length, minSpO2: min, avgSpO2: avg },
      recommendation: "Seek immediate medical attention if you experience shortness of breath, chest pain, or confusion alongside low oxygen readings. Contact your healthcare provider.",
    });
  } else if (lowReadings.length > 0) {
    const pct = Math.round((lowReadings.length / values.length) * 100);
    insights.push({
      category: "respiratory",
      severity: "warning",
      title: "Below-Normal Blood Oxygen Readings",
      description: `${lowReadings.length} readings (${pct}%) were below 95% SpO2 (average: ${avg}%). Normal blood oxygen is 95-100%. Consistently low readings may indicate respiratory or circulatory issues.`,
      dataPoints: { lowReadingCount: lowReadings.length, percentLow: pct, avgSpO2: avg, minSpO2: min },
      recommendation: "Monitor your readings over time. If low readings persist, discuss with your healthcare provider. Note that wrist-based sensors may be less accurate than fingertip oximeters.",
    });
  }

  return insights;
}

// ── Stress Analysis ──────────────────────────────────────

function analyzeStress(
  data: WearableRawData["stress"],
): WearableInsight[] {
  if (!data || data.length === 0) return [];

  const insights: WearableInsight[] = [];
  const values = data.map((d) => d.value);
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  const highStressCount = values.filter((v) => v >= THRESHOLDS.HIGH_STRESS).length;
  const veryHighStressCount = values.filter((v) => v >= THRESHOLDS.VERY_HIGH_STRESS).length;

  if (veryHighStressCount > 0) {
    const pct = Math.round((veryHighStressCount / values.length) * 100);
    insights.push({
      category: "stress",
      severity: "alert",
      title: "Very High Stress Levels Detected",
      description: `${veryHighStressCount} readings (${pct}%) showed very high stress levels (85+/100). Chronic high stress significantly impacts cardiovascular health, immune function, and mental wellbeing.`,
      dataPoints: { veryHighCount: veryHighStressCount, avgStress: avg, percentVeryHigh: pct },
      recommendation: "Prioritize stress management: practice deep breathing, progressive muscle relaxation, or meditation. Consider professional support if stress feels unmanageable.",
    });
  } else if (highStressCount > 0) {
    const pct = Math.round((highStressCount / values.length) * 100);
    if (pct >= 30) {
      insights.push({
        category: "stress",
        severity: "warning",
        title: "Frequent High Stress Levels",
        description: `${highStressCount} readings (${pct}%) showed high stress levels (70+/100). Frequent stress spikes can lead to burnout, sleep disruption, and health issues over time.`,
        dataPoints: { highStressCount, avgStress: avg, percentHigh: pct },
        recommendation: "Identify your stress triggers and build in recovery time. Regular exercise, social connection, and adequate sleep are powerful stress buffers.",
      });
    }
  }

  if (avg <= THRESHOLDS.LOW_STRESS && values.length >= 3) {
    insights.push({
      category: "stress",
      severity: "info",
      title: "Low Stress Levels",
      description: `Your average stress level is ${avg}/100, indicating good stress management. Low stress levels are associated with better overall health outcomes.`,
      dataPoints: { avgStress: avg },
      recommendation: "Continue your current stress management practices. They are clearly working well for you.",
    });
  }

  return insights;
}

// ── Temperature Analysis ─────────────────────────────────────

function analyzeTemperature(
  data: WearableRawData["temperature"],
): WearableInsight[] {
  if (!data || data.length === 0) return [];

  const insights: WearableInsight[] = [];
  const values = data.map((d) => d.value);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const max = Math.max(...values);

  const feverReadings = values.filter((v) => v >= THRESHOLDS.FEVER_TEMP);
  const highFeverReadings = values.filter((v) => v >= THRESHOLDS.HIGH_FEVER_TEMP);

  if (highFeverReadings.length > 0) {
    insights.push({
      category: "overall",
      severity: "alert",
      title: "High Fever Detected",
      description: `${highFeverReadings.length} temperature readings exceeded 38.3°C (101°F). High fever may indicate infection or inflammatory condition requiring medical evaluation.`,
      dataPoints: { highFeverCount: highFeverReadings.length, maxTemp: parseFloat(max.toFixed(1)), avgTemp: parseFloat(avg.toFixed(1)) },
      recommendation: "Monitor your temperature closely. Stay hydrated and rest. Seek medical attention if fever persists beyond 3 days or exceeds 39.4°C (103°F).",
    });
  } else if (feverReadings.length > 0) {
    insights.push({
      category: "overall",
      severity: "warning",
      title: "Elevated Temperature Detected",
      description: `${feverReadings.length} temperature readings exceeded 37.8°C (100°F). Low-grade fever may indicate your body is fighting an infection or inflammation.`,
      dataPoints: { feverCount: feverReadings.length, maxTemp: parseFloat(max.toFixed(1)), avgTemp: parseFloat(avg.toFixed(1)) },
      recommendation: "Rest, stay hydrated, and monitor your symptoms. If accompanied by other symptoms or the fever rises, consult your healthcare provider.",
    });
  }

  return insights;
}

// ── Cross-Reference Insights ────────────────────────

export function generateCrossInsights(
  heartAnalysis: HeartRateAnalysis,
  sleepAnalysis: SleepAnalysis,
  activityAnalysis: ActivityAnalysis,
  rawData: WearableRawData,
): WearableInsight[] {
  const insights: WearableInsight[] = [];

  // Poor sleep + high resting HR → Recovery concern
  if (
    sleepAnalysis.avgDuration > 0 &&
    sleepAnalysis.avgDuration < THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN &&
    heartAnalysis.resting > THRESHOLDS.OPTIMAL_RESTING_HR_HIGH
  ) {
    insights.push({
      category: "overall",
      severity: "warning",
      title: "Recovery Concern: Poor Sleep & Elevated Heart Rate",
      description: `Your combination of insufficient sleep (avg ${(sleepAnalysis.avgDuration / 60).toFixed(1)}h) and elevated resting heart rate (${heartAnalysis.resting} bpm) suggests your body is not recovering adequately. This pattern often precedes burnout or illness.`,
      dataPoints: {
        avgSleepMin: sleepAnalysis.avgDuration,
        restingHR: heartAnalysis.resting,
      },
      recommendation: "Prioritize sleep this week. Reduce intense exercise, avoid caffeine after noon, and consider a rest day. Your body is signaling it needs recovery time.",
    });
  }

  // Low activity + high stress → Sedentary stress pattern
  const hasStressData = rawData.stress && rawData.stress.length > 0;
  const avgStress = hasStressData
    ? Math.round(rawData.stress!.reduce((s, d) => s + d.value, 0) / rawData.stress!.length)
    : 0;

  if (
    activityAnalysis.avgSteps > 0 &&
    activityAnalysis.avgSteps < THRESHOLDS.LOW_ACTIVE_STEPS &&
    hasStressData &&
    avgStress >= THRESHOLDS.MODERATE_STRESS
  ) {
    insights.push({
      category: "overall",
      severity: "warning",
      title: "Sedentary Stress Pattern Detected",
      description: `Low physical activity (avg ${activityAnalysis.avgSteps.toLocaleString()} steps/day) combined with moderate-to-high stress (avg ${avgStress}/100) creates a harmful pattern. Physical activity is one of the most effective stress relievers.`,
      dataPoints: { avgSteps: activityAnalysis.avgSteps, avgStress },
      recommendation: "Start with just 10-minute walks when you feel stressed. Physical activity triggers endorphin release and is proven to reduce cortisol levels. Even light movement helps.",
    });
  }

  // Good sleep + good activity + normal HR → Excellent indicators
  if (
    sleepAnalysis.avgDuration >= THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN &&
    sleepAnalysis.avgQuality >= 70 &&
    activityAnalysis.avgSteps >= THRESHOLDS.ACTIVE_STEPS &&
    heartAnalysis.resting > 0 &&
    heartAnalysis.resting <= THRESHOLDS.OPTIMAL_RESTING_HR_HIGH &&
    heartAnalysis.anomalies === 0
  ) {
    insights.push({
      category: "overall",
      severity: "info",
      title: "Excellent Health Indicators",
      description: `Your data shows a strong combination: adequate sleep (${(sleepAnalysis.avgDuration / 60).toFixed(1)}h avg), good activity (${activityAnalysis.avgSteps.toLocaleString()} steps avg), and normal resting heart rate (${heartAnalysis.resting} bpm). This trifecta strongly correlates with longevity and disease prevention.`,
      dataPoints: {
        avgSleepMin: sleepAnalysis.avgDuration,
        avgSteps: activityAnalysis.avgSteps,
        restingHR: heartAnalysis.resting,
        sleepQuality: sleepAnalysis.avgQuality,
      },
      recommendation: "You are doing an excellent job managing your health. Keep up your current habits and consider tracking additional metrics for even deeper insights.",
    });
  }

  // High activity + poor sleep + elevated HR → Overtraining risk
  if (
    activityAnalysis.avgSteps >= THRESHOLDS.HIGHLY_ACTIVE_STEPS &&
    sleepAnalysis.avgDuration > 0 &&
    sleepAnalysis.avgDuration < THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN &&
    heartAnalysis.resting > THRESHOLDS.OPTIMAL_RESTING_HR_HIGH
  ) {
    insights.push({
      category: "overall",
      severity: "alert",
      title: "Overtraining Risk Detected",
      description: `High physical activity (${activityAnalysis.avgSteps.toLocaleString()} steps avg) combined with insufficient sleep (${(sleepAnalysis.avgDuration / 60).toFixed(1)}h) and elevated resting HR (${heartAnalysis.resting} bpm) suggests possible overtraining. Without adequate recovery, intense training can harm rather than help.`,
      dataPoints: {
        avgSteps: activityAnalysis.avgSteps,
        avgSleepMin: sleepAnalysis.avgDuration,
        restingHR: heartAnalysis.resting,
      },
      recommendation: "Reduce training intensity for 3-5 days. Focus on sleep and nutrition. Resume gradually only when your resting heart rate returns to baseline. Listen to your body.",
    });
  }

  // Poor sleep + low activity → Lifestyle concern
  if (
    sleepAnalysis.avgDuration > 0 &&
    sleepAnalysis.avgDuration < THRESHOLDS.MIN_RECOMMENDED_SLEEP_MIN &&
    activityAnalysis.avgSteps > 0 &&
    activityAnalysis.avgSteps < THRESHOLDS.LOW_ACTIVE_STEPS
  ) {
    insights.push({
      category: "overall",
      severity: "warning",
      title: "Low Sleep & Low Activity Pattern",
      description: `Both sleep (${(sleepAnalysis.avgDuration / 60).toFixed(1)}h avg) and activity (${activityAnalysis.avgSteps.toLocaleString()} steps avg) are below recommended levels. These two factors reinforce each other — poor sleep reduces motivation to move, and lack of movement worsens sleep quality.`,
      dataPoints: {
        avgSleepMin: sleepAnalysis.avgDuration,
        avgSteps: activityAnalysis.avgSteps,
      },
      recommendation: "Break the cycle: start with a 20-minute morning walk. Sunlight exposure and light exercise early in the day improves both sleep and activity levels. Small steps create momentum.",
    });
  }

  return insights;
}

// ── Health Score Calculation ─────────────────────────────

export function calculateHealthScore(
  heartAnalysis: HeartRateAnalysis,
  sleepAnalysis: SleepAnalysis,
  activityAnalysis: ActivityAnalysis,
  hasHeartData: boolean,
  hasSleepData: boolean,
  hasActivityData: boolean,
): number {
  // Weights: Heart (25%), Sleep (30%), Activity (25%), Trends (20%)
  let totalWeight = 0;
  let weightedScore = 0;

  // ── Heart Score (25%) ──
  if (hasHeartData && heartAnalysis.resting > 0) {
    let heartScore = 50; // baseline

    // Resting HR scoring (0-40 points)
    if (heartAnalysis.resting <= THRESHOLDS.EXCELLENT_RESTING_HR) {
      heartScore += 40;
    } else if (heartAnalysis.resting <= THRESHOLDS.OPTIMAL_RESTING_HR_LOW) {
      heartScore += 35;
    } else if (heartAnalysis.resting <= THRESHOLDS.OPTIMAL_RESTING_HR_HIGH) {
      heartScore += 25;
    } else if (heartAnalysis.resting <= THRESHOLDS.POOR_RESTING_HR) {
      heartScore += 10;
    } else {
      heartScore += 0;
    }

    // Anomaly penalty (-10 per anomaly, max -30)
    const anomalyPenalty = Math.min(30, heartAnalysis.anomalies * 10);
    heartScore -= anomalyPenalty;

    // Trend bonus/penalty
    if (heartAnalysis.trend === "improving") heartScore += 10;
    if (heartAnalysis.trend === "declining") heartScore -= 10;

    heartScore = Math.max(0, Math.min(100, heartScore));
    weightedScore += heartScore * 0.25;
    totalWeight += 0.25;
  }

  // ── Sleep Score (30%) ──
  if (hasSleepData && sleepAnalysis.avgDuration > 0) {
    // Use the composite quality score directly (0-100)
    let sleepScore = sleepAnalysis.avgQuality;

    // Trend bonus/penalty
    if (sleepAnalysis.trend === "improving") sleepScore += 5;
    if (sleepAnalysis.trend === "declining") sleepScore -= 5;

    sleepScore = Math.max(0, Math.min(100, sleepScore));
    weightedScore += sleepScore * 0.30;
    totalWeight += 0.30;
  }

  // ── Activity Score (25%) ──
  if (hasActivityData && activityAnalysis.totalDays > 0) {
    let activityScore = 0;

    // Steps-based scoring
    if (activityAnalysis.avgSteps >= THRESHOLDS.HIGHLY_ACTIVE_STEPS) {
      activityScore = 90;
    } else if (activityAnalysis.avgSteps >= THRESHOLDS.ACTIVE_STEPS) {
      activityScore = 75;
    } else if (activityAnalysis.avgSteps >= THRESHOLDS.LOW_ACTIVE_STEPS) {
      activityScore = 55;
    } else if (activityAnalysis.avgSteps >= THRESHOLDS.SEDENTARY_STEPS) {
      activityScore = 35;
    } else {
      activityScore = 15;
    }

    // Active day ratio bonus (up to +10)
    const activeDayRatio = activityAnalysis.activeDays / activityAnalysis.totalDays;
    activityScore += Math.round(activeDayRatio * 10);

    // Trend bonus/penalty
    if (activityAnalysis.trend === "improving") activityScore += 5;
    if (activityAnalysis.trend === "declining") activityScore -= 5;

    activityScore = Math.max(0, Math.min(100, activityScore));
    weightedScore += activityScore * 0.25;
    totalWeight += 0.25;
  }

  // ── Trends Score (20%) ──
  if (totalWeight > 0) {
    let trendsScore = 50; // baseline

    const trendValues = [];
    if (hasHeartData) trendValues.push(heartAnalysis.trend);
    if (hasSleepData) trendValues.push(sleepAnalysis.trend);
    if (hasActivityData) trendValues.push(activityAnalysis.trend);

    const improvingCount = trendValues.filter((t) => t === "improving").length;
    const decliningCount = trendValues.filter((t) => t === "declining").length;

    trendsScore += improvingCount * 15;
    trendsScore -= decliningCount * 15;

    trendsScore = Math.max(0, Math.min(100, trendsScore));
    weightedScore += trendsScore * 0.20;
    totalWeight += 0.20;
  }

  // Normalize: if we don't have all data categories, scale up the score
  if (totalWeight === 0) return 0;
  const normalizedScore = Math.round(weightedScore / totalWeight);

  return Math.max(0, Math.min(100, normalizedScore));
}

// ── Data Quality Assessment ───────────────────────────

function assessDataQuality(data: WearableRawData, days: number): "high" | "medium" | "low" {
  let score = 0;
  const maxScore = 5;

  // Heart rate data completeness
  if (data.heartRate.length >= days * 10) score += 1; // ~10 readings/day
  else if (data.heartRate.length >= days * 3) score += 0.5;

  // Sleep data completeness
  if (data.sleep.length >= days * 0.8) score += 1; // 80% of days
  else if (data.sleep.length >= days * 0.5) score += 0.5;

  // Step data completeness
  if (data.steps.length >= days * 0.8) score += 1;
  else if (data.steps.length >= days * 0.5) score += 0.5;

  // Optional data bonus
  if (data.bloodOxygen && data.bloodOxygen.length > 0) score += 0.5;
  if (data.stress && data.stress.length > 0) score += 0.5;
  if (data.temperature && data.temperature.length > 0) score += 0.5;

  const normalizedScore = score / maxScore;

  if (normalizedScore >= 0.7) return "high";
  if (normalizedScore >= 0.4) return "medium";
  return "low";
}

// ── Main: Get Wearable Summary ──────────────────────

export async function getWearableSummary(
  userId: string,
  days: number = 7,
): Promise<WearableSummary> {
  // Clamp days range
  days = Math.max(1, Math.min(90, days));

  // Try cache (3 min TTL)
  const cacheKey = `wearable-insights:${userId}:${days}`;
  const cached = analyticsCache.get<WearableSummary>(cacheKey);
  if (cached) return cached;

  // Determine date range
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  // Fetch all data points from DB
  const dataPoints = await prisma.wearableDataPoint.findMany({
    where: {
      userId,
      timestamp: { gte: from, lte: to },
    },
    orderBy: { timestamp: "asc" },
  });

  // Reconstruct WearableRawData from DB records
  const rawData: WearableRawData = {
    heartRate: [],
    sleep: [],
    steps: [],
    bloodOxygen: [],
    stress: [],
    temperature: [],
  };

  // Use Maps to deduplicate sleep and steps by date
  const sleepByDate = new Map<string, WearableRawData["sleep"][number]>();
  const stepsByDate = new Map<string, WearableRawData["steps"][number]>();

  for (const dp of dataPoints) {
    const value = dp.value as Record<string, any>;

    switch (dp.dataType) {
      case "heart_rate":
        rawData.heartRate.push({
          timestamp: dp.timestamp.getTime(),
          value: value.bpm ?? value.value ?? 0,
        });
        break;

      case "sleep": {
        const dateKey = dp.timestamp.toISOString().split("T")[0];
        // Prefer latest record for each date
        sleepByDate.set(dateKey, {
          date: dateKey,
          duration: value.totalMinutes ?? value.duration ?? 0,
          deepSleep: value.deepSleepMinutes ?? value.deepSleep ?? 0,
          remSleep: value.remSleepMinutes ?? value.remSleep ?? 0,
          lightSleep: value.lightSleepMinutes ?? value.lightSleep ?? 0,
          awake: value.awakeMinutes ?? value.awake ?? 0,
        });
        break;
      }

      case "steps": {
        const dateKey = dp.timestamp.toISOString().split("T")[0];
        const existing = stepsByDate.get(dateKey);
        // Sum steps for the same date (multiple syncs)
        stepsByDate.set(dateKey, {
          date: dateKey,
          count: (existing?.count ?? 0) + (value.count ?? value.value ?? 0),
        });
        break;
      }

      case "blood_oxygen":
        rawData.bloodOxygen!.push({
          timestamp: dp.timestamp.getTime(),
          value: value.spo2 ?? value.value ?? 0,
        });
        break;

      case "stress":
        rawData.stress!.push({
          timestamp: dp.timestamp.getTime(),
          value: value.stressLevel ?? value.value ?? 0,
        });
        break;

      case "temperature":
        rawData.temperature!.push({
          timestamp: dp.timestamp.getTime(),
          value: value.celsius ?? value.value ?? 0,
        });
        break;
    }
  }

  rawData.sleep = Array.from(sleepByDate.values());
  rawData.steps = Array.from(stepsByDate.values());

  // Run analyses
  const hasHeartData = rawData.heartRate.length > 0;
  const hasSleepData = rawData.sleep.length > 0;
  const hasActivityData = rawData.steps.length > 0;

  const heartResult = analyzeHeartRate(rawData.heartRate);
  const sleepResult = analyzeSleep(rawData.sleep);
  const activityResult = analyzeActivity(rawData.steps);

  // Additional data analyses
  const bloodOxygenInsights = analyzeBloodOxygen(rawData.bloodOxygen);
  const stressInsights = analyzeStress(rawData.stress);
  const temperatureInsights = analyzeTemperature(rawData.temperature);

  // Cross-reference insights
  const crossInsights = generateCrossInsights(
    heartResult.analysis,
    sleepResult.analysis,
    activityResult.analysis,
    rawData,
  );

  // Combine all insights
  const allInsights: WearableInsight[] = [
    ...heartResult.insights,
    ...sleepResult.insights,
    ...activityResult.insights,
    ...bloodOxygenInsights,
    ...stressInsights,
    ...temperatureInsights,
    ...crossInsights,
  ];

  // Sort insights: alerts first, then warnings, then info
  const severityOrder: Record<string, number> = { alert: 0, warning: 1, info: 2 };
  allInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate overall health score
  const overallScore = calculateHealthScore(
    heartResult.analysis,
    sleepResult.analysis,
    activityResult.analysis,
    hasHeartData,
    hasSleepData,
    hasActivityData,
  );

  // Assess data quality
  const dataQuality = assessDataQuality(rawData, days);

  const summary: WearableSummary = {
    period: {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
    },
    heartRate: heartResult.analysis,
    sleep: sleepResult.analysis,
    activity: activityResult.analysis,
    insights: allInsights,
    overallScore,
    dataQuality,
  };

  // Cache for 3 minutes
  analyticsCache.set(cacheKey, summary, 180_000);

  return summary;
}

// ── Convenience: Get health score only ────────────────

export async function getHealthScoreOnly(
  userId: string,
  days: number = 7,
): Promise<{
  score: number;
  trend: "improving" | "stable" | "declining";
  breakdown: {
    heart: { score: number; available: boolean };
    sleep: { score: number; available: boolean };
    activity: { score: number; available: boolean };
  };
}> {
  const summary = await getWearableSummary(userId, days);

  // Derive per-category scores for breakdown
  const heartScore =
    summary.heartRate.resting > 0
      ? Math.round(
          calculateHealthScore(
            summary.heartRate,
            { avgDuration: 0, avgDeepSleep: 0, avgQuality: 0, trend: "stable", consistency: 0 },
            { avgSteps: 0, activeDays: 0, totalDays: 0, trend: "stable" },
            true, false, false,
          ),
        )
      : 0;

  const sleepScore =
    summary.sleep.avgDuration > 0
      ? Math.round(
          calculateHealthScore(
            { avg: 0, min: 0, max: 0, resting: 0, trend: "stable", anomalies: 0 },
            summary.sleep,
            { avgSteps: 0, activeDays: 0, totalDays: 0, trend: "stable" },
            false, true, false,
          ),
        )
      : 0;

  const activityScore =
    summary.activity.totalDays > 0
      ? Math.round(
          calculateHealthScore(
            { avg: 0, min: 0, max: 0, resting: 0, trend: "stable", anomalies: 0 },
            { avgDuration: 0, avgDeepSleep: 0, avgQuality: 0, trend: "stable", consistency: 0 },
            summary.activity,
            false, false, true,
          ),
        )
      : 0;

  // Overall trend: majority vote of individual trends
  const trends = [summary.heartRate.trend, summary.sleep.trend, summary.activity.trend];
  const improvingCount = trends.filter((t) => t === "improving").length;
  const decliningCount = trends.filter((t) => t === "declining").length;

  let overallTrend: "improving" | "stable" | "declining";
  if (improvingCount > decliningCount) overallTrend = "improving";
  else if (decliningCount > improvingCount) overallTrend = "declining";
  else overallTrend = "stable";

  return {
    score: summary.overallScore,
    trend: overallTrend,
    breakdown: {
      heart: { score: heartScore, available: summary.heartRate.resting > 0 },
      sleep: { score: sleepScore, available: summary.sleep.avgDuration > 0 },
      activity: { score: activityScore, available: summary.activity.totalDays > 0 },
    },
  };
}

// ── Convenience: Get alerts only ───────────────────────────

export async function getActiveAlerts(
  userId: string,
  days: number = 7,
): Promise<WearableInsight[]> {
  const summary = await getWearableSummary(userId, days);
  return summary.insights.filter(
    (i) => i.severity === "warning" || i.severity === "alert",
  );
}
