/**
 * Sample Report Data for AI Health Journal
 * AI Health Journal sample report data
 *
 * Pre-generated report data showing what personalized health reports look like.
 * Used for demo presentations and UI development.
 */

// ── Types ──────────────────────────────────────────────────────

export interface SymptomFrequency {
  snomedCode: string;
  displayName: string;
  displayNameKo: string;
  count: number;
  severityBreakdown: {
    mild: number;
    moderate: number;
    severe: number;
  };
  trend: "increasing" | "decreasing" | "stable";
  averageSeverity: number; // 1-3 scale
}

export interface WeeklyBreakdown {
  weekLabel: string;
  entries: number;
  avgDetailScore: number;
  topSymptom: string;
  pointsEarned: number;
}

export interface MedicationSummary {
  name: string;
  dosage: string;
  period: string;
  adherenceRate: number; // 0-100
  effectiveness: "improving" | "stable" | "not_effective";
}

export interface CorrelationInsight {
  factor1: string;
  factor2: string;
  correlation: number; // -1 to 1
  descriptionKo: string;
  descriptionEn: string;
}

export interface HealthReport {
  userId: string;
  userName: string;
  reportType: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  overview: {
    totalEntries: number;
    streakDays: number;
    level: number;
    levelTitle: string;
    levelTitleKo: string;
    totalPoints: number;
    pointsEarnedThisPeriod: number;
    healthScore: number; // 0-100
    healthScoreChange: number; // from last period
    averageDetailScore: number;
  };

  symptomAnalysis: {
    totalSymptomsLogged: number;
    uniqueSymptoms: number;
    topSymptoms: SymptomFrequency[];
    weeklyBreakdown: WeeklyBreakdown[];
    bodySystemSummary: Array<{
      system: string;
      systemKo: string;
      count: number;
      percentage: number;
    }>;
  };

  medicationSummary: MedicationSummary[];

  correlations: CorrelationInsight[];

  aiRecommendations: {
    lifestyle: string[];
    medicalFollowUp: string[];
    preventive: string[];
    aiNarrative: string;
    aiNarrativeEn: string;
  };

  rewardSummary: {
    totalEarned: number;
    breakdown: Array<{
      type: string;
      typeKo: string;
      amount: number;
    }>;
    streakMultiplier: number;
    nextMilestone: {
      days: number;
      multiplier: number;
    };
  };

  quizPerformance: {
    attempted: number;
    correct: number;
    accuracy: number;
    categoriesStrong: string[];
    categoriesWeak: string[];
  };
}

// ── Sample Report: User 1 (Minsu Kim) — Monthly ───────────────────

export const sampleMonthlyReportUser1: HealthReport = {
  userId: "d1000000-0000-0000-0000-000000000001",
  userName: "Minsu Kim",
  reportType: "monthly",
  periodStart: "2026-02-01",
  periodEnd: "2026-02-28",
  generatedAt: "2026-03-01T00:00:00Z",

  overview: {
    totalEntries: 20,
    streakDays: 14,
    level: 5,
    levelTitle: "Health Manager",
    levelTitleKo: "Health Manager",
    totalPoints: 2450,
    pointsEarnedThisPeriod: 680,
    healthScore: 78,
    healthScoreChange: 15,
    averageDetailScore: 6.2,
  },

  symptomAnalysis: {
    totalSymptomsLogged: 28,
    uniqueSymptoms: 8,
    topSymptoms: [
      {
        snomedCode: "25064002",
        displayName: "Headache",
        displayNameKo: "Headache",
        count: 8,
        severityBreakdown: { mild: 4, moderate: 3, severe: 1 },
        trend: "decreasing",
        averageSeverity: 1.6,
      },
      {
        snomedCode: "84229001",
        displayName: "Fatigue",
        displayNameKo: "Fatigue",
        count: 5,
        severityBreakdown: { mild: 2, moderate: 3, severe: 0 },
        trend: "decreasing",
        averageSeverity: 1.6,
      },
      {
        snomedCode: "81680005",
        displayName: "Neck pain",
        displayNameKo: "Neck pain",
        count: 3,
        severityBreakdown: { mild: 2, moderate: 1, severe: 0 },
        trend: "stable",
        averageSeverity: 1.3,
      },
      {
        snomedCode: "193462001",
        displayName: "Insomnia",
        displayNameKo: "Insomnia",
        count: 2,
        severityBreakdown: { mild: 1, moderate: 1, severe: 0 },
        trend: "decreasing",
        averageSeverity: 1.5,
      },
      {
        snomedCode: "73595000",
        displayName: "Stress",
        displayNameKo: "Stress",
        count: 2,
        severityBreakdown: { mild: 0, moderate: 2, severe: 0 },
        trend: "decreasing",
        averageSeverity: 2.0,
      },
      {
        snomedCode: "53627009",
        displayName: "Shoulder pain",
        displayNameKo: "Shoulder pain",
        count: 1,
        severityBreakdown: { mild: 0, moderate: 1, severe: 0 },
        trend: "stable",
        averageSeverity: 2.0,
      },
      {
        snomedCode: "404640003",
        displayName: "Dizziness",
        displayNameKo: "Dizziness",
        count: 1,
        severityBreakdown: { mild: 0, moderate: 1, severe: 0 },
        trend: "stable",
        averageSeverity: 2.0,
      },
      {
        snomedCode: "422587007",
        displayName: "Nausea",
        displayNameKo: "Nausea",
        count: 1,
        severityBreakdown: { mild: 0, moderate: 1, severe: 0 },
        trend: "stable",
        averageSeverity: 2.0,
      },
    ],
    weeklyBreakdown: [
      {
        weekLabel: "Week 1 (Feb 1-7)",
        entries: 4,
        avgDetailScore: 5.5,
        topSymptom: "Headache",
        pointsEarned: 55,
      },
      {
        weekLabel: "Week 2 (Feb 8-14)",
        entries: 6,
        avgDetailScore: 8.0,
        topSymptom: "Headache",
        pointsEarned: 155,
      },
      {
        weekLabel: "Week 3 (Feb 15-21)",
        entries: 5,
        avgDetailScore: 5.4,
        topSymptom: "Headache",
        pointsEarned: 67,
      },
      {
        weekLabel: "Week 4 (Feb 22-28)",
        entries: 5,
        avgDetailScore: 5.0,
        topSymptom: "Fatigue",
        pointsEarned: 59,
      },
    ],
    bodySystemSummary: [
      { system: "Neurological", systemKo: "Neurological", count: 12, percentage: 42.9 },
      { system: "General", systemKo: "General", count: 7, percentage: 25.0 },
      { system: "Musculoskeletal", systemKo: "Musculoskeletal", count: 5, percentage: 17.9 },
      { system: "Mental Health", systemKo: "Mental Health", count: 4, percentage: 14.3 },
    ],
  },

  medicationSummary: [
    {
      name: "Tylenol (Acetaminophen) 500mg",
      dosage: "500mg as needed",
      period: "Feb 7 - Feb 19",
      adherenceRate: 80,
      effectiveness: "improving",
    },
    {
      name: "Magnesium 400mg",
      dosage: "400mg before bed",
      period: "Feb 9 - Present",
      adherenceRate: 95,
      effectiveness: "improving",
    },
    {
      name: "Vitamin B Complex",
      dosage: "1 tablet after breakfast",
      period: "Feb 14 - Present",
      adherenceRate: 90,
      effectiveness: "stable",
    },
    {
      name: "Omega-3 1000mg",
      dosage: "After breakfast",
      period: "Feb 14 - Present",
      adherenceRate: 90,
      effectiveness: "stable",
    },
  ],

  correlations: [
    {
      factor1: "Stress",
      factor2: "Headache",
      correlation: 0.82,
      descriptionKo: "Strong correlation between stress and headache occurrence (85% on high-stress days).",
      descriptionEn: "Strong correlation between stress and headache occurrence (85% on high-stress days).",
    },
    {
      factor1: "Lack of sleep (<6 hours)",
      factor2: "Headache",
      correlation: 0.71,
      descriptionKo: "Headache occurrence is 70% on days with less than 6 hours of sleep.",
      descriptionEn: "Headache occurrence is 70% on days with less than 6 hours of sleep.",
    },
    {
      factor1: "Stretching",
      factor2: "Headache reduction",
      correlation: -0.65,
      descriptionKo: "Stretching reduces headache occurrence to 15%.",
      descriptionEn: "Stretching reduces headache occurrence to 15%.",
    },
    {
      factor1: "Yoga",
      factor2: "Sleep quality",
      correlation: 0.58,
      descriptionKo: "Yoga practice correlates with improved sleep quality.",
      descriptionEn: "Yoga practice correlates with improved sleep quality.",
    },
  ],

  aiRecommendations: {
    lifestyle: [
      "Maintain a regular sleep schedule (bedtime around 11:00 PM recommended)",
      "Take a 5-minute stretch break every hour during work",
      "Drink at least 2L of water per day",
      "Do yoga or light exercise at least 3 times a week",
      "Align your monitor to eye level (follow the 20-20-20 rule)",
    ],
    medicalFollowUp: [
      "A neurology consultation is recommended for recurring headaches",
      "A specialist evaluation may be needed to assess the possibility of migraines",
    ],
    preventive: [
      "Prepare antihistamines ahead of the upcoming spring allergy season",
      "Review your routine health check-up schedule (once a year recommended)",
      "Magnesium supplementation may help prevent migraines (currently taking - continue recommended)",
    ],
    aiNarrative: `Analysis of Minsu Kim's health data over the past month reveals a pattern of weekday-concentrated headaches. Headache frequency and severity peaked during the second week, coinciding with high work stress.

However, after implementing lifestyle changes in week 3 (regular stretching, yoga, and fixed sleep schedule), headache frequency decreased by over 80%. This suggests the primary causes were prolonged screen use, poor posture, sleep deprivation, and stress.

Sleep quality has also improved since introducing magnesium supplementation. The improvement trend is clear, and maintaining current healthy habits should prevent chronic headache development.

Note: The severe headache episode in week 2 (accompanied by dizziness and nausea) showed migraine characteristics. A neurology consultation is recommended for proper diagnosis and potential preventive treatment.`,

    aiNarrativeEn: `Analysis of Minsu Kim's health data over the past month reveals a pattern of weekday-concentrated headaches. Headache frequency and severity peaked during the second week, coinciding with high work stress.

However, after implementing lifestyle changes in week 3 (regular stretching, yoga, and fixed sleep schedule), headache frequency decreased by over 80%. This suggests the primary causes were prolonged screen use, poor posture, sleep deprivation, and stress.

Sleep quality has also improved since introducing magnesium supplementation. The improvement trend is clear, and maintaining current healthy habits should prevent chronic headache development.

Note: The severe headache episode in week 2 (accompanied by dizziness and nausea) showed migraine characteristics. A neurology consultation is recommended for proper diagnosis and potential preventive treatment.`,
  },

  rewardSummary: {
    totalEarned: 680,
    breakdown: [
      { type: "daily_entry", typeKo: "Daily Entry", amount: 330 },
      { type: "streak_bonus", typeKo: "Streak Bonus", amount: 200 },
      { type: "quiz_reward", typeKo: "Quiz Reward", amount: 50 },
      { type: "course_completion", typeKo: "Course Completion", amount: 50 },
      { type: "detail_bonus", typeKo: "Detail Bonus", amount: 50 },
    ],
    streakMultiplier: 2.0,
    nextMilestone: {
      days: 21,
      multiplier: 2.5,
    },
  },

  quizPerformance: {
    attempted: 8,
    correct: 6,
    accuracy: 75.0,
    categoriesStrong: ["nutrition", "exercise"],
    categoriesWeak: ["health_tech"],
  },
};

// ── Sample Report: User 2 (Seoyeon Lee) — Weekly ────────────────────

export const sampleWeeklyReportUser2: HealthReport = {
  userId: "d2000000-0000-0000-0000-000000000002",
  userName: "Seoyeon Lee",
  reportType: "weekly",
  periodStart: "2026-02-22",
  periodEnd: "2026-02-28",
  generatedAt: "2026-03-01T00:00:00Z",

  overview: {
    totalEntries: 6,
    streakDays: 7,
    level: 3,
    levelTitle: "Health Tracker",
    levelTitleKo: "Health Tracker",
    totalPoints: 1200,
    pointsEarnedThisPeriod: 180,
    healthScore: 72,
    healthScoreChange: 8,
    averageDetailScore: 5.5,
  },

  symptomAnalysis: {
    totalSymptomsLogged: 8,
    uniqueSymptoms: 5,
    topSymptoms: [
      {
        snomedCode: "64531003",
        displayName: "Nasal congestion",
        displayNameKo: "Nasal congestion",
        count: 2,
        severityBreakdown: { mild: 2, moderate: 0, severe: 0 },
        trend: "decreasing",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "162607003",
        displayName: "Sneezing",
        displayNameKo: "Sneezing",
        count: 1,
        severityBreakdown: { mild: 1, moderate: 0, severe: 0 },
        trend: "decreasing",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "279079003",
        displayName: "Bloating",
        displayNameKo: "Bloating",
        count: 1,
        severityBreakdown: { mild: 1, moderate: 0, severe: 0 },
        trend: "stable",
        averageSeverity: 1.0,
      },
    ],
    weeklyBreakdown: [
      {
        weekLabel: "This Week (Feb 22-28)",
        entries: 6,
        avgDetailScore: 5.5,
        topSymptom: "Nasal congestion",
        pointsEarned: 180,
      },
    ],
    bodySystemSummary: [
      { system: "Respiratory", systemKo: "Respiratory", count: 4, percentage: 50.0 },
      { system: "Gastrointestinal", systemKo: "Gastrointestinal", count: 2, percentage: 25.0 },
      { system: "Skin", systemKo: "Skin", count: 2, percentage: 25.0 },
    ],
  },

  medicationSummary: [
    {
      name: "Cetirizine 10mg",
      dosage: "10mg after breakfast",
      period: "Feb 13 - Present",
      adherenceRate: 92,
      effectiveness: "improving",
    },
    {
      name: "Fluticasone Nasal Spray",
      dosage: "2 sprays morning and evening",
      period: "Feb 13 - Present",
      adherenceRate: 88,
      effectiveness: "improving",
    },
    {
      name: "Probiotics",
      dosage: "1 capsule on empty stomach in the morning",
      period: "Feb 15 - Present",
      adherenceRate: 85,
      effectiveness: "improving",
    },
  ],

  correlations: [
    {
      factor1: "Pollen count",
      factor2: "Allergy symptoms",
      correlation: 0.75,
      descriptionKo: "Allergy symptoms worsen on high pollen count days.",
      descriptionEn: "Allergy symptoms worsen on high pollen count days.",
    },
    {
      factor1: "Spicy food",
      factor2: "Digestive symptoms",
      correlation: 0.68,
      descriptionKo: "Digestive symptoms tend to appear after spicy food consumption.",
      descriptionEn: "Digestive symptoms tend to appear after spicy food consumption.",
    },
    {
      factor1: "Probiotic intake",
      factor2: "Digestive improvement",
      correlation: -0.55,
      descriptionKo: "Consistent probiotic intake correlates with reduced digestive symptoms.",
      descriptionEn: "Consistent probiotic intake correlates with reduced digestive symptoms.",
    },
  ],

  aiRecommendations: {
    lifestyle: [
      "Check the pollen forecast and limit going outside on high-count days",
      "Wash your face and rinse your nasal passages after being outdoors",
      "Cut back on spicy foods and late-night snacks",
      "Take probiotics consistently",
    ],
    medicalFollowUp: [
      "Consider an allergy test (skin prick test or blood IgE test)",
      "If digestive symptoms persist, consider seeing a gastroenterologist",
    ],
    preventive: [
      "Take your medication consistently to prepare for the spring allergy season",
      "Using an air purifier is recommended",
      "Increase fermented foods instead of irritating foods",
    ],
    aiNarrative: `Analysis of Seoyeon Lee's health data this week shows overall improvement in allergy symptoms. Consistent use of cetirizine and nasal spray is proving effective, with reduced nasal congestion and sneezing frequency.

Digestive symptoms have also stabilized since starting probiotics. However, bloating after late-night snacking suggests continued dietary management is needed.

Maintaining current medication and lifestyle management ahead of peak spring allergy season is recommended.`,

    aiNarrativeEn: `Analysis of Seoyeon Lee's health data this week shows overall improvement in allergy symptoms. Consistent use of cetirizine and nasal spray is proving effective, with reduced nasal congestion and sneezing frequency.

Digestive symptoms have also stabilized since starting probiotics. However, bloating after late-night snacking suggests continued dietary management is needed.

Maintaining current medication and lifestyle management ahead of peak spring allergy season is recommended.`,
  },

  rewardSummary: {
    totalEarned: 180,
    breakdown: [
      { type: "daily_entry", typeKo: "Daily Entry", amount: 90 },
      { type: "streak_bonus", typeKo: "Streak Bonus", amount: 50 },
      { type: "quiz_reward", typeKo: "Quiz Reward", amount: 25 },
      { type: "detail_bonus", typeKo: "Detail Bonus", amount: 15 },
    ],
    streakMultiplier: 1.5,
    nextMilestone: {
      days: 14,
      multiplier: 2.0,
    },
  },

  quizPerformance: {
    attempted: 5,
    correct: 4,
    accuracy: 80.0,
    categoriesStrong: ["general", "hygiene"],
    categoriesWeak: ["exercise"],
  },
};

// ── Sample Report: User 3 (John Smith) — Monthly ───────────────

export const sampleMonthlyReportUser3: HealthReport = {
  userId: "d3000000-0000-0000-0000-000000000003",
  userName: "John Smith",
  reportType: "monthly",
  periodStart: "2026-02-01",
  periodEnd: "2026-02-28",
  generatedAt: "2026-03-01T00:00:00Z",

  overview: {
    totalEntries: 21,
    streakDays: 21,
    level: 8,
    levelTitle: "Health Expert",
    levelTitleKo: "Health Expert",
    totalPoints: 4800,
    pointsEarnedThisPeriod: 950,
    healthScore: 91,
    healthScoreChange: 3,
    averageDetailScore: 5.8,
  },

  symptomAnalysis: {
    totalSymptomsLogged: 14,
    uniqueSymptoms: 7,
    topSymptoms: [
      {
        snomedCode: "267102003",
        displayName: "Sore muscles",
        displayNameKo: "Sore muscles",
        count: 4,
        severityBreakdown: { mild: 4, moderate: 0, severe: 0 },
        trend: "stable",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "162397003",
        displayName: "Sore throat",
        displayNameKo: "Sore throat",
        count: 3,
        severityBreakdown: { mild: 3, moderate: 0, severe: 0 },
        trend: "decreasing",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "49727002",
        displayName: "Cough",
        displayNameKo: "Cough",
        count: 2,
        severityBreakdown: { mild: 2, moderate: 0, severe: 0 },
        trend: "decreasing",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "25064002",
        displayName: "Headache",
        displayNameKo: "Headache",
        count: 1,
        severityBreakdown: { mild: 1, moderate: 0, severe: 0 },
        trend: "stable",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "161891005",
        displayName: "Back pain",
        displayNameKo: "Back pain",
        count: 1,
        severityBreakdown: { mild: 1, moderate: 0, severe: 0 },
        trend: "stable",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "30989003",
        displayName: "Knee pain",
        displayNameKo: "Knee pain",
        count: 1,
        severityBreakdown: { mild: 1, moderate: 0, severe: 0 },
        trend: "stable",
        averageSeverity: 1.0,
      },
      {
        snomedCode: "298325004",
        displayName: "Hip pain",
        displayNameKo: "Hip pain",
        count: 1,
        severityBreakdown: { mild: 1, moderate: 0, severe: 0 },
        trend: "stable",
        averageSeverity: 1.0,
      },
    ],
    weeklyBreakdown: [
      {
        weekLabel: "Week 1 (Feb 1-7)",
        entries: 5,
        avgDetailScore: 5.8,
        topSymptom: "Sore muscles",
        pointsEarned: 75,
      },
      {
        weekLabel: "Week 2 (Feb 8-14)",
        entries: 5,
        avgDetailScore: 6.2,
        topSymptom: "Knee pain",
        pointsEarned: 82,
      },
      {
        weekLabel: "Week 3 (Feb 15-21)",
        entries: 6,
        avgDetailScore: 6.0,
        topSymptom: "Sore throat",
        pointsEarned: 90,
      },
      {
        weekLabel: "Week 4 (Feb 22-28)",
        entries: 5,
        avgDetailScore: 5.2,
        topSymptom: "Sore muscles",
        pointsEarned: 72,
      },
    ],
    bodySystemSummary: [
      { system: "Musculoskeletal", systemKo: "Musculoskeletal", count: 8, percentage: 57.1 },
      { system: "Respiratory", systemKo: "Respiratory", count: 5, percentage: 35.7 },
      { system: "Neurological", systemKo: "Neurological", count: 1, percentage: 7.1 },
    ],
  },

  medicationSummary: [
    {
      name: "Vitamin D3 2000 IU",
      dosage: "With breakfast daily",
      period: "Ongoing",
      adherenceRate: 95,
      effectiveness: "stable",
    },
    {
      name: "Fish Oil (Omega-3) 1200mg",
      dosage: "With food daily",
      period: "Ongoing",
      adherenceRate: 93,
      effectiveness: "stable",
    },
    {
      name: "Creatine Monohydrate 5g",
      dosage: "Daily with water",
      period: "Feb 1 - Present",
      adherenceRate: 98,
      effectiveness: "improving",
    },
    {
      name: "Magnesium Glycinate 300mg",
      dosage: "Before bed daily",
      period: "Feb 1 - Present",
      adherenceRate: 92,
      effectiveness: "improving",
    },
    {
      name: "Zinc 25mg (temporary)",
      dosage: "With dinner",
      period: "Feb 20 - Feb 24",
      adherenceRate: 100,
      effectiveness: "improving",
    },
  ],

  correlations: [
    {
      factor1: "Running distance",
      factor2: "Muscle soreness",
      correlation: 0.72,
      descriptionKo: "Muscle soreness consistently appears after longer running distances.",
      descriptionEn: "Muscle soreness consistently appears after longer running distances.",
    },
    {
      factor1: "Rest days",
      factor2: "Recovery quality",
      correlation: 0.68,
      descriptionKo: "Adequate rest days lead to faster recovery.",
      descriptionEn: "Adequate rest days lead to faster recovery.",
    },
    {
      factor1: "Sleep duration (8+ hours)",
      factor2: "Performance next day",
      correlation: 0.61,
      descriptionKo: "8+ hours of sleep correlates with improved athletic performance the next day.",
      descriptionEn: "8+ hours of sleep correlates with improved athletic performance the next day.",
    },
    {
      factor1: "Cold weather running",
      factor2: "Upper respiratory symptoms",
      correlation: 0.55,
      descriptionKo: "Cold weather running tends to trigger upper respiratory symptoms.",
      descriptionEn: "Cold weather running tends to trigger upper respiratory symptoms.",
    },
  ],

  aiRecommendations: {
    lifestyle: [
      "Continue the excellent balance of training and rest days",
      "Increase warm-up time for cold weather runs (10 min minimum)",
      "Use a buff or scarf to warm air during winter runs",
      "Add dynamic hip mobility exercises before runs",
      "Maintain the progressive distance increase (max 10% per week)",
    ],
    medicalFollowUp: [
      "Consider a sports medicine consultation for periodic knee assessment",
      "Annual cardiovascular screening recommended for athletes",
    ],
    preventive: [
      "Get a flu vaccine before next fall season",
      "Ensure adequate iron intake with regular blood tests",
      "Consider a gait analysis to prevent running injuries",
    ],
    aiNarrative: `John Smith's health data paints the picture of a disciplined athlete with excellent overall health habits. The 21-day tracking streak and consistent training log demonstrate strong commitment to health monitoring.

Musculoskeletal symptoms (muscle soreness, brief knee and back discomfort) are all within normal athletic range and resolved quickly with appropriate rest and cross-training. The smart decision to switch to swimming when experiencing knee discomfort shows good body awareness.

The brief upper respiratory infection in week 3 (sore throat, cough) resolved within 4 days, and the measured return to training was textbook recovery management. The zinc supplementation during the illness was appropriate.

Running distance has progressively increased from 5K to 15K over the month — excellent periodization. Maintaining the current supplement regimen (Vitamin D, Omega-3, Creatine, Magnesium) provides solid nutritional support for athletic performance.

Key area for attention: cold weather running tends to trigger respiratory symptoms. Breathing technique modifications for winter training would be beneficial.`,

    aiNarrativeEn: `John Smith's health data paints the picture of a disciplined athlete with excellent overall health habits. The 21-day tracking streak and consistent training log demonstrate strong commitment to health monitoring.

Musculoskeletal symptoms (muscle soreness, brief knee and back discomfort) are all within normal athletic range and resolved quickly with appropriate rest and cross-training. The smart decision to switch to swimming when experiencing knee discomfort shows good body awareness.

The brief upper respiratory infection in week 3 (sore throat, cough) resolved within 4 days, and the measured return to training was textbook recovery management. The zinc supplementation during the illness was appropriate.

Running distance has progressively increased from 5K to 15K over the month — excellent periodization. Maintaining the current supplement regimen (Vitamin D, Omega-3, Creatine, Magnesium) provides solid nutritional support for athletic performance.

Key area for attention: cold weather running tends to trigger respiratory symptoms. Breathing technique modifications for winter training would be beneficial.`,
  },

  rewardSummary: {
    totalEarned: 950,
    breakdown: [
      { type: "daily_entry", typeKo: "Daily Entry", amount: 290 },
      { type: "streak_bonus", typeKo: "Streak Bonus", amount: 400 },
      { type: "quiz_reward", typeKo: "Quiz Reward", amount: 80 },
      { type: "course_completion", typeKo: "Course Completion", amount: 80 },
      { type: "challenge_bonus", typeKo: "Challenge Bonus", amount: 100 },
    ],
    streakMultiplier: 2.5,
    nextMilestone: {
      days: 30,
      multiplier: 3.0,
    },
  },

  quizPerformance: {
    attempted: 10,
    correct: 9,
    accuracy: 90.0,
    categoriesStrong: ["exercise", "nutrition", "general"],
    categoriesWeak: ["health_tech"],
  },
};

// ── Export All Reports ─────────────────────────────────────────

export const sampleReports = {
  user1Monthly: sampleMonthlyReportUser1,
  user2Weekly: sampleWeeklyReportUser2,
  user3Monthly: sampleMonthlyReportUser3,
};

/** Get report by user ID */
export function getSampleReport(userId: string): HealthReport | undefined {
  const reportMap: Record<string, HealthReport> = {
    "d1000000-0000-0000-0000-000000000001": sampleMonthlyReportUser1,
    "d2000000-0000-0000-0000-000000000002": sampleWeeklyReportUser2,
    "d3000000-0000-0000-0000-000000000003": sampleMonthlyReportUser3,
  };
  return reportMap[userId];
}

/** Get all sample reports */
export function getAllSampleReports(): HealthReport[] {
  return [sampleMonthlyReportUser1, sampleWeeklyReportUser2, sampleMonthlyReportUser3];
}
