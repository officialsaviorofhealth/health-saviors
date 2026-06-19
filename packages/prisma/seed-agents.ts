// Agent Ecosystem Seed Script — AI agent ecosystem seed
// Usage: npx tsx packages/prisma/seed-agents.ts
//
// Populates the database with:
//   - 25 AI agents across 10 categories
//   - 50 fake users (data providers)
//   - 30,000+ QueryBilling transactions over 30 days
//   - Agent activity logs for the past 7 days

import { PrismaClient, QueryTier } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Returns a random date between `daysAgoStart` and `daysAgoEnd` days ago from now. */
function randomDateInRange(daysAgoStart: number, daysAgoEnd: number): Date {
  const now = Date.now();
  const start = now - daysAgoStart * 24 * 60 * 60 * 1000;
  const end = now - daysAgoEnd * 24 * 60 * 60 * 1000;
  return new Date(start + Math.random() * (end - start));
}

/** Returns a random timestamp within a given day, weighted toward business hours (UTC 0-9). */
function randomTimeOnDay(day: Date): Date {
  const d = new Date(day);
  // 70% chance of business hours (UTC 0-9)
  if (Math.random() < 0.7) {
    const hour = randomInt(0, 8); // UTC 0-8
    const minute = randomInt(0, 59);
    d.setUTCHours(hour, minute, randomInt(0, 59), randomInt(0, 999));
  } else {
    const hour = randomInt(9, 23); // off-hours
    const minute = randomInt(0, 59);
    d.setUTCHours(hour, minute, randomInt(0, 59), randomInt(0, 999));
  }
  return d;
}

// ── 1. AI Agent Definitions ────────────────────────────────────

interface AgentSeed {
  name: string;
  description: string;
  descriptionKo: string;
  category: string;
  endpointUrl: string;
  authMethod: string;
  status: string;
  pricingTier: string;
  targetQueries: number; // target billing count for 30 days
  avatarEmoji: string;
  accentColor: string;
  capabilities: string[];
  contactEmail: string;
  uptime: number;
}

const AGENTS: AgentSeed[] = [
  // ── Insurance (3) ──
  {
    name: "MetLife Health Analytics",
    description: "Enterprise-grade health risk assessment engine. Analyzes symptom patterns, chronic condition progression, and lifestyle factors to generate actuarial risk scores for insurance underwriting and policy optimization.",
    descriptionKo: "Enterprise-grade health risk assessment engine that analyzes symptom patterns, chronic condition progression, and lifestyle factors to generate actuarial risk scores for insurance underwriting and policy optimization.",
    category: "insurance",
    endpointUrl: "https://api.metlife.com/health-analytics/v2",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 3000,
    avatarEmoji: "🏦",
    accentColor: "#0066B3",
    capabilities: ["symptom_analysis", "risk_scoring", "chronic_disease_tracking", "actuarial_modeling"],
    contactEmail: "api-support@metlife.com",
    uptime: 99.97,
  },
  {
    name: "AIA Vitality Engine",
    description: "Wellness program optimization platform that processes health behavior data to personalize insurance reward programs. Tracks physical activity, nutrition habits, and preventive care compliance for dynamic premium adjustments.",
    descriptionKo: "Wellness program optimization platform that processes health behavior data to personalize insurance reward programs. Tracks physical activity, nutrition habits, and preventive care compliance for dynamic premium adjustments.",
    category: "insurance",
    endpointUrl: "https://api.aia.com/vitality-engine/v3/query",
    authMethod: "api-key",
    status: "active",
    pricingTier: "premium",
    targetQueries: 1200,
    avatarEmoji: "💪",
    accentColor: "#E4002B",
    capabilities: ["wellness_scoring", "activity_tracking", "premium_optimization", "reward_calculation"],
    contactEmail: "developer@aia.com",
    uptime: 99.91,
  },
  {
    name: "Samsung Life InsureBot",
    description: "Korean insurance health scoring system that processes biometric data from Samsung Health ecosystem. Provides real-time health risk assessments for policy holders, integrating wearable data with traditional health metrics.",
    descriptionKo: "Insurance health scoring system that processes biometric data from the Samsung Health ecosystem. Provides real-time health risk assessments for policy holders, integrating wearable data with traditional health metrics.",
    category: "insurance",
    endpointUrl: "https://api.samsunglife.com/insurebot/v1/health-score",
    authMethod: "api-key",
    status: "active",
    pricingTier: "premium",
    targetQueries: 1800,
    avatarEmoji: "🇰🇷",
    accentColor: "#1428A0",
    capabilities: ["biometric_scoring", "wearable_integration", "health_risk_assessment", "policy_optimization"],
    contactEmail: "api@samsunglife.com",
    uptime: 99.94,
  },

  // ── Pharma (3) ──
  {
    name: "Pfizer Clinical Insights",
    description: "Adverse drug reaction monitoring and pharmacovigilance AI. Processes patient-reported symptoms cross-referenced with medication data to identify potential drug interactions and unreported side effects at population scale.",
    descriptionKo: "Adverse drug reaction monitoring and pharmacovigilance AI. Cross-references patient-reported symptoms with medication data to identify potential drug interactions and unreported side effects at population scale.",
    category: "pharma",
    endpointUrl: "https://api.pfizer.com/clinical-insights/v2/query",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 900,
    avatarEmoji: "💊",
    accentColor: "#0093D0",
    capabilities: ["adverse_reaction_detection", "drug_interaction_analysis", "pharmacovigilance", "population_screening"],
    contactEmail: "clinical-api@pfizer.com",
    uptime: 99.99,
  },
  {
    name: "Yuhan Pharma AI",
    description: "Medication interaction research platform from Korea's leading pharmaceutical company. Specializes in analyzing traditional Korean medicine interactions with modern pharmaceuticals and monitoring regional prescription patterns.",
    descriptionKo: "Medication interaction research platform from a leading pharmaceutical company. Specializes in analyzing herbal medicine interactions with modern pharmaceuticals and monitoring regional prescription patterns.",
    category: "pharma",
    endpointUrl: "https://api.yuhan.co.kr/pharma-ai/v1/interaction",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 650,
    avatarEmoji: "🧪",
    accentColor: "#003B71",
    capabilities: ["drug_interaction", "traditional_medicine_analysis", "prescription_monitoring", "regional_patterns"],
    contactEmail: "ai-dev@yuhan.co.kr",
    uptime: 99.85,
  },
  {
    name: "Roche Diagnostics Agent",
    description: "Lab result correlation analysis engine that identifies diagnostic patterns across patient populations. Processes blood panel results, biomarkers, and imaging data to support early disease detection and treatment monitoring.",
    descriptionKo: "Lab result correlation analysis engine that identifies diagnostic patterns across patient populations. Processes blood panel results, biomarkers, and imaging data to support early disease detection and treatment monitoring.",
    category: "pharma",
    endpointUrl: "https://api.roche.com/diagnostics/v3/analyze",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 750,
    avatarEmoji: "🔬",
    accentColor: "#0066CC",
    capabilities: ["lab_correlation", "biomarker_analysis", "early_detection", "treatment_monitoring"],
    contactEmail: "diagnostics-api@roche.com",
    uptime: 99.98,
  },

  // ── Research (3) ──
  {
    name: "Seoul National University Health Lab",
    description: "Academic health research platform from Korea's top university. Conducts longitudinal health studies on Korean population demographics, analyzing genetic predispositions, environmental factors, and lifestyle disease prevalence.",
    descriptionKo: "Academic health research platform from a top university. Conducts longitudinal health studies on population demographics, analyzing genetic predispositions, environmental factors, and lifestyle disease prevalence.",
    category: "research",
    endpointUrl: "https://healthlab.snu.ac.kr/api/v2/research",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 500,
    avatarEmoji: "🎓",
    accentColor: "#003458",
    capabilities: ["longitudinal_study", "genetic_analysis", "population_health", "environmental_factors"],
    contactEmail: "healthlab@snu.ac.kr",
    uptime: 99.72,
  },
  {
    name: "WHO Epidemiology Monitor",
    description: "Global disease surveillance agent that tracks symptom patterns across regions for early pandemic detection. Aggregates anonymized health data to identify emerging disease clusters and seasonal outbreak patterns worldwide.",
    descriptionKo: "Global disease surveillance agent that tracks symptom patterns across regions for early pandemic detection. Aggregates anonymized health data to identify emerging disease clusters and seasonal outbreak patterns worldwide.",
    category: "research",
    endpointUrl: "https://api.who.int/epi-monitor/v1/surveillance",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 800,
    avatarEmoji: "🌍",
    accentColor: "#009ADE",
    capabilities: ["disease_surveillance", "outbreak_detection", "seasonal_patterns", "global_tracking"],
    contactEmail: "epimonitor@who.int",
    uptime: 99.95,
  },
  {
    name: "Nature Medicine Data Agent",
    description: "Medical journal correlation analysis system that cross-references patient symptom data with published clinical research. Identifies emerging treatment efficacy patterns and supports evidence-based medicine recommendations.",
    descriptionKo: "Medical journal correlation analysis system that cross-references patient symptom data with published clinical research. Identifies emerging treatment efficacy patterns and supports evidence-based medicine recommendations.",
    category: "research",
    endpointUrl: "https://api.nature.com/medicine/v2/data-agent",
    authMethod: "api-key",
    status: "active",
    pricingTier: "premium",
    targetQueries: 400,
    avatarEmoji: "📖",
    accentColor: "#C41E3D",
    capabilities: ["literature_correlation", "treatment_efficacy", "evidence_synthesis", "clinical_insights"],
    contactEmail: "data-api@nature.com",
    uptime: 99.88,
  },

  // ── Fitness/Wellness (3) ──
  {
    name: "Noom Health Intelligence",
    description: "Behavioral health pattern analysis engine powering Noom's personalized coaching. Processes dietary logs, exercise habits, and psychological triggers to predict health behavior changes and optimize intervention timing.",
    descriptionKo: "Behavioral health pattern analysis engine powering Noom's personalized coaching. Processes dietary logs, exercise habits, and psychological triggers to predict health behavior changes and optimize intervention timing.",
    category: "fitness",
    endpointUrl: "https://api.noom.com/health-intel/v3/analyze",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 2500,
    avatarEmoji: "🍏",
    accentColor: "#00C853",
    capabilities: ["behavioral_analysis", "dietary_patterns", "intervention_optimization", "habit_tracking"],
    contactEmail: "api@noom.com",
    uptime: 99.89,
  },
  {
    name: "Samsung Health Insights",
    description: "Wearable data aggregation platform processing health metrics from 500M+ Samsung Health users. Analyzes step counts, heart rate variability, sleep quality, and stress levels for population health benchmarking and personalized wellness.",
    descriptionKo: "Wearable data aggregation platform processing health metrics from 500M+ Samsung Health users. Analyzes step counts, heart rate variability, sleep quality, and stress levels for population health benchmarking and personalized wellness.",
    category: "fitness",
    endpointUrl: "https://api.samsung.com/health-insights/v4/query",
    authMethod: "api-key",
    status: "active",
    pricingTier: "premium",
    targetQueries: 5000,
    avatarEmoji: "📱",
    accentColor: "#1428A0",
    capabilities: ["wearable_aggregation", "hrv_analysis", "sleep_quality", "stress_monitoring", "population_benchmarking"],
    contactEmail: "health-api@samsung.com",
    uptime: 99.96,
  },
  {
    name: "Apple Health Research",
    description: "Population health studies platform leveraging Apple Watch and iPhone sensor data. Conducts large-scale observational studies on cardiovascular health, respiratory patterns, and mobility trends across diverse demographics.",
    descriptionKo: "Population health studies platform leveraging Apple Watch and iPhone sensor data. Conducts large-scale observational studies on cardiovascular health, respiratory patterns, and mobility trends across diverse demographics.",
    category: "fitness",
    endpointUrl: "https://api.apple.com/health-research/v2/study",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 1500,
    avatarEmoji: "🍎",
    accentColor: "#000000",
    capabilities: ["population_health", "cardiovascular_study", "respiratory_analysis", "mobility_trends"],
    contactEmail: "health-research@apple.com",
    uptime: 99.99,
  },

  // ── Telehealth (3) ──
  {
    name: "Doctor On Demand AI",
    description: "Pre-consultation screening system that triages patients before virtual doctor visits. Analyzes reported symptoms, medical history, and urgency levels to match patients with appropriate specialists and optimize wait times.",
    descriptionKo: "Pre-consultation screening system that triages patients before virtual doctor visits. Analyzes reported symptoms, medical history, and urgency levels to match patients with appropriate specialists and optimize wait times.",
    category: "telehealth",
    endpointUrl: "https://api.doctorondemand.com/ai/v2/screen",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 950,
    avatarEmoji: "👨‍⚕️",
    accentColor: "#00897B",
    capabilities: ["symptom_triage", "specialist_matching", "urgency_scoring", "history_analysis"],
    contactEmail: "api-team@doctorondemand.com",
    uptime: 99.93,
  },
  {
    name: "GoodDoc AI",
    description: "Korea's leading telehealth symptom triage platform processing 2M+ consultations monthly. Integrates with Korea's NHIS system for insurance-aware routing and provides bilingual (Korean/English) symptom assessment.",
    descriptionKo: "Leading telehealth symptom triage platform processing 2M+ consultations monthly. Integrates with the national health insurance system for insurance-aware routing and provides bilingual symptom assessment.",
    category: "telehealth",
    endpointUrl: "https://api.goodoc.co.kr/ai/v3/triage",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 1100,
    avatarEmoji: "🏥",
    accentColor: "#1976D2",
    capabilities: ["symptom_triage", "nhis_integration", "bilingual_assessment", "specialist_routing"],
    contactEmail: "dev@goodoc.co.kr",
    uptime: 99.87,
  },
  {
    name: "Teladoc Analytics",
    description: "Remote patient monitoring analytics platform that processes continuous health data from home monitoring devices. Identifies deterioration patterns in chronic disease patients and generates alert scores for clinical intervention.",
    descriptionKo: "Remote patient monitoring analytics platform that processes continuous health data from home monitoring devices. Identifies deterioration patterns in chronic disease patients and generates alert scores for clinical intervention.",
    category: "telehealth",
    endpointUrl: "https://api.teladoc.com/analytics/v2/monitor",
    authMethod: "api-key",
    status: "active",
    pricingTier: "premium",
    targetQueries: 700,
    avatarEmoji: "📡",
    accentColor: "#7B1FA2",
    capabilities: ["remote_monitoring", "deterioration_detection", "alert_scoring", "chronic_disease_tracking"],
    contactEmail: "analytics-api@teladoc.com",
    uptime: 99.92,
  },

  // ── Mental Health (2) ──
  {
    name: "Calm Wellness Agent",
    description: "Stress pattern analysis system that correlates self-reported mood data with sleep quality, heart rate variability, and activity levels. Provides population-level insights for mental wellness program effectiveness measurement.",
    descriptionKo: "Stress pattern analysis system that correlates self-reported mood data with sleep quality, heart rate variability, and activity levels. Provides population-level insights for mental wellness program effectiveness measurement.",
    category: "mental_health",
    endpointUrl: "https://api.calm.com/wellness/v2/analyze",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 850,
    avatarEmoji: "🧘",
    accentColor: "#4FC3F7",
    capabilities: ["stress_analysis", "mood_correlation", "sleep_quality", "wellness_measurement"],
    contactEmail: "api@calm.com",
    uptime: 99.90,
  },
  {
    name: "Mindset AI",
    description: "Korean mental health screening platform specializing in workplace stress and burnout detection. Analyzes health journal entries using Korean NLP to identify early signs of depression, anxiety, and occupational burnout.",
    descriptionKo: "Mental health screening platform specializing in workplace stress and burnout detection. Analyzes health journal entries using NLP to identify early signs of depression, anxiety, and occupational burnout.",
    category: "mental_health",
    endpointUrl: "https://api.mindset.kr/ai/v1/screen",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 600,
    avatarEmoji: "🧠",
    accentColor: "#AB47BC",
    capabilities: ["depression_screening", "burnout_detection", "nlp", "workplace_wellness"],
    contactEmail: "dev@mindset.kr",
    uptime: 99.78,
  },

  // ── Nutrition (2) ──
  {
    name: "MyFitnessPal Insights",
    description: "Dietary pattern analysis engine processing food diary data from 200M+ users. Identifies nutritional deficiencies, eating behavior trends, and correlates dietary patterns with reported health outcomes for research applications.",
    descriptionKo: "Dietary pattern analysis engine processing food diary data from 200M+ users. Identifies nutritional deficiencies and eating behavior trends, and correlates dietary patterns with reported health outcomes for research applications.",
    category: "nutrition",
    endpointUrl: "https://api.myfitnesspal.com/insights/v3/analyze",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 1300,
    avatarEmoji: "🥗",
    accentColor: "#0288D1",
    capabilities: ["dietary_analysis", "nutrition_tracking", "deficiency_detection", "behavior_trends"],
    contactEmail: "api-support@myfitnesspal.com",
    uptime: 99.86,
  },
  {
    name: "Lotte Wellfood Nutrition AI",
    description: "Korean food and nutrition research platform from Lotte Wellfood. Analyzes dietary patterns specific to Korean cuisine, tracks nutritional intake of fermented foods, and provides personalized K-food nutrition recommendations.",
    descriptionKo: "Food and nutrition research platform from Lotte Wellfood. Analyzes regional dietary patterns, tracks the nutritional intake of fermented foods, and provides personalized nutrition recommendations.",
    category: "nutrition",
    endpointUrl: "https://api.lottewellfood.com/nutrition-ai/v1/analyze",
    authMethod: "api-key",
    status: "active",
    pricingTier: "basic",
    targetQueries: 450,
    avatarEmoji: "🍱",
    accentColor: "#D32F2F",
    capabilities: ["korean_diet_analysis", "fermented_food_tracking", "nutrition_recommendation", "k_food_research"],
    contactEmail: "ai-dev@lottewellfood.com",
    uptime: 99.81,
  },

  // ── Wearable (2) ──
  {
    name: "Garmin Health API",
    description: "Fitness device data analysis platform aggregating metrics from Garmin's ecosystem of GPS watches and activity trackers. Specializes in endurance athlete health monitoring, VO2 max estimation, and training load analysis.",
    descriptionKo: "Fitness device data analysis platform aggregating metrics from Garmin's ecosystem of GPS watches and activity trackers. Specializes in endurance athlete health monitoring, VO2 max estimation, and training load analysis.",
    category: "wearable",
    endpointUrl: "https://api.garmin.com/health/v2/analytics",
    authMethod: "api-key",
    status: "active",
    pricingTier: "standard",
    targetQueries: 950,
    avatarEmoji: "⌚",
    accentColor: "#000000",
    capabilities: ["fitness_tracking", "vo2_max_estimation", "training_load", "endurance_monitoring"],
    contactEmail: "health-api@garmin.com",
    uptime: 99.93,
  },
  {
    name: "Fitbit Research Agent",
    description: "Sleep and activity research platform powered by Fitbit's massive user dataset. Conducts epidemiological studies on sleep disorders, sedentary behavior, and the relationship between physical activity and mental health outcomes.",
    descriptionKo: "Sleep and activity research platform powered by Fitbit's massive user dataset. Conducts epidemiological studies on sleep disorders, sedentary behavior, and the relationship between physical activity and mental health outcomes.",
    category: "wearable",
    endpointUrl: "https://api.fitbit.com/research/v2/study",
    authMethod: "api-key",
    status: "active",
    pricingTier: "premium",
    targetQueries: 700,
    avatarEmoji: "💤",
    accentColor: "#00B0B9",
    capabilities: ["sleep_research", "activity_analysis", "sedentary_behavior", "mental_health_correlation"],
    contactEmail: "research-api@fitbit.com",
    uptime: 99.91,
  },

  // ── Clinical Trial (2) ──
  {
    name: "ClinicalTrials.gov Matcher",
    description: "Patient-trial matching engine that cross-references health profiles with active clinical trials from ClinicalTrials.gov. Uses NLP to parse eligibility criteria and match patients based on conditions, demographics, and lab results.",
    descriptionKo: "Patient-trial matching engine that cross-references health profiles with active clinical trials from ClinicalTrials.gov. Uses NLP to parse eligibility criteria and match patients based on conditions, demographics, and lab results.",
    category: "clinical_trial",
    endpointUrl: "https://api.clinicaltrials.gov/matcher/v2/match",
    authMethod: "api-key",
    status: "active",
    pricingTier: "basic",
    targetQueries: 350,
    avatarEmoji: "🔍",
    accentColor: "#1565C0",
    capabilities: ["trial_matching", "eligibility_parsing", "condition_matching", "demographic_screening"],
    contactEmail: "api@clinicaltrials.gov",
    uptime: 99.80,
  },
  {
    name: "Novartis Trial Recruit",
    description: "Clinical recruitment screening platform that identifies potential trial candidates from anonymized health records. Evaluates biomarker data, treatment history, and comorbidity profiles to accelerate recruitment for Phase II-IV trials.",
    descriptionKo: "Clinical recruitment screening platform that identifies potential trial candidates from anonymized health records. Evaluates biomarker data, treatment history, and comorbidity profiles to accelerate recruitment for Phase II-IV trials.",
    category: "clinical_trial",
    endpointUrl: "https://api.novartis.com/trial-recruit/v1/screen",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 300,
    avatarEmoji: "📋",
    accentColor: "#0460A9",
    capabilities: ["recruitment_screening", "biomarker_evaluation", "comorbidity_profiling", "treatment_history"],
    contactEmail: "trial-api@novartis.com",
    uptime: 99.95,
  },

  // ── Enterprise (2) ──
  {
    name: "Mercer Workplace Health",
    description: "Corporate wellness analytics platform that processes anonymized employee health data for Fortune 500 companies. Generates workplace health risk reports, identifies productivity-impacting health trends, and optimizes benefit programs.",
    descriptionKo: "Corporate wellness analytics platform that processes anonymized employee health data for Fortune 500 companies. Generates workplace health risk reports, identifies productivity-impacting health trends, and optimizes benefit programs.",
    category: "enterprise",
    endpointUrl: "https://api.mercer.com/workplace-health/v2/analytics",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 550,
    avatarEmoji: "🏢",
    accentColor: "#002F6C",
    capabilities: ["workplace_analytics", "risk_reporting", "benefit_optimization", "productivity_insights"],
    contactEmail: "api@mercer.com",
    uptime: 99.90,
  },
  {
    name: "Samsung SDS Health Platform",
    description: "Enterprise health data platform providing B2B health analytics infrastructure. Processes corporate health checkup data, occupational health records, and employee wellness program metrics for large Korean conglomerates.",
    descriptionKo: "Enterprise health data platform providing B2B health analytics infrastructure. Processes corporate health checkup data, occupational health records, and employee wellness program metrics for large conglomerates.",
    category: "enterprise",
    endpointUrl: "https://api.samsungsds.com/health-platform/v3/query",
    authMethod: "api-key",
    status: "active",
    pricingTier: "enterprise",
    targetQueries: 680,
    avatarEmoji: "⚙️",
    accentColor: "#1428A0",
    capabilities: ["health_checkup_analytics", "occupational_health", "corporate_wellness", "b2b_infrastructure"],
    contactEmail: "health-api@samsungsds.com",
    uptime: 99.94,
  },
];

// ── 2. Fake Users ──────────────────────────────────────────────

interface FakeUser {
  name: string; // for reference only (not stored, but used in generating data)
  points: number;
  streakDays: number;
  level: number;
  dataConsent: boolean;
  createdAt: Date;
}

const KOREAN_NAMES = [
  "Minsu Kim", "Seoyeon Lee", "Jihoon Park", "Yujin Choi", "Haeun Jung",
  "Donghyun Kang", "Subin Yoon", "Jaewon Lim", "Soyoung Han", "Minjae Cho",
  "Jieun Oh", "Junho Seo", "Yerin Shin", "Taehyun Ryu", "Daeun Song",
  "Seongmin Heo", "Sujeong Bae", "Hyeonwoo Moon", "Jia Yang", "Seungwoo Hong",
  "Nayeon Kwon", "Doyoon Yoo", "Jiwon Nam", "Hayoon Jeon", "Bonseok Koo",
  "Chaewon Lee", "Taeyoung Kim", "Seojun Park", "Yejin Choi", "Minho Jang",
];

const ENGLISH_NAMES = [
  "Alex Thompson", "Sarah Chen", "Michael Park", "Emma Wilson", "David Kim",
  "Jessica Lee", "Ryan O'Brien", "Priya Sharma", "James Rodriguez", "Olivia Brown",
  "Daniel Nakamura", "Sophie Martin", "Chris Anderson", "Aisha Hassan", "Tom Baker",
  "Maria Santos", "Kevin Liu", "Rachel Green", "Hassan Ali", "Emily Davis",
];

function generateFakeUsers(): FakeUser[] {
  const users: FakeUser[] = [];
  const allNames = [...KOREAN_NAMES, ...ENGLISH_NAMES];

  for (const name of allNames) {
    users.push({
      name,
      points: randomInt(100, 5000),
      streakDays: randomInt(0, 45),
      level: randomInt(1, 8),
      dataConsent: Math.random() > 0.15, // 85% consent
      createdAt: randomDateInRange(90, 1), // past 3 months
    });
  }

  return users;
}

// ── 3. Billing Transaction Generation ──────────────────────────

const TIER_PRICING: Record<QueryTier, { pointsCharged: number; weight: number }> = {
  basic: { pointsCharged: 10, weight: 0.40 },
  standard: { pointsCharged: 25, weight: 0.35 },
  premium: { pointsCharged: 50, weight: 0.18 },
  enterprise: { pointsCharged: 100, weight: 0.07 },
};

const DATA_TYPES = [
  ["symptoms", "history"],
  ["symptoms"],
  ["wearable", "activity"],
  ["symptoms", "wearable", "history"],
  ["history", "medications"],
  ["symptoms", "lab_results"],
  ["wearable"],
  ["symptoms", "wearable"],
  ["history"],
  ["symptoms", "history", "lab_results"],
  ["activity", "sleep"],
  ["symptoms", "medications", "history"],
];

function pickWeightedTier(): QueryTier {
  const r = Math.random();
  let cumulative = 0;
  for (const [tier, config] of Object.entries(TIER_PRICING)) {
    cumulative += config.weight;
    if (r <= cumulative) return tier as QueryTier;
  }
  return "basic";
}

// ── 4. Activity Log Templates ──────────────────────────────────

interface LogTemplate {
  action: string;
  detailTemplate: string;
}

const ACTIVITY_TEMPLATES: LogTemplate[] = [
  { action: "query", detailTemplate: "Query executed — {queryType}" },
  { action: "query", detailTemplate: "Batch query completed — {count} records analyzed" },
  { action: "sync", detailTemplate: "Data sync completed — {count} records processed" },
  { action: "health_check", detailTemplate: "API health check — latency {latency}ms" },
  { action: "auth", detailTemplate: "API key rotated successfully" },
  { action: "query", detailTemplate: "Real-time analysis — {queryType} for {count} patients" },
  { action: "alert", detailTemplate: "Anomaly detected — {queryType} deviation above threshold" },
  { action: "sync", detailTemplate: "Incremental sync — {count} new records ingested" },
  { action: "health_check", detailTemplate: "System diagnostics — all endpoints healthy, p99 latency {latency}ms" },
  { action: "query", detailTemplate: "Aggregation query — {queryType} across {count} data points" },
];

const QUERY_TYPES = [
  "symptom pattern analysis",
  "chronic condition correlation",
  "medication interaction check",
  "sleep quality assessment",
  "heart rate variability study",
  "stress level prediction",
  "dietary deficiency screening",
  "exercise recovery analysis",
  "blood pressure trend analysis",
  "mental health risk scoring",
  "wearable data aggregation",
  "population health benchmarking",
  "adverse reaction monitoring",
  "lab result correlation",
  "treatment outcome tracking",
  "biomarker trend analysis",
  "epidemiological clustering",
  "patient risk stratification",
];

function generateLogDetail(template: LogTemplate): string {
  let detail = template.detailTemplate;
  detail = detail.replace("{queryType}", randomPick(QUERY_TYPES));
  detail = detail.replace("{count}", String(randomInt(50, 12000)));
  detail = detail.replace("{latency}", String(randomInt(12, 280)));
  return detail;
}

// ── Main Seed Function ─────────────────────────────────────────

async function seedAgents() {
  console.log("=========================================");
  console.log("  AI Health Journal — Agent Ecosystem Seed");
  console.log("=========================================\n");

  // ── Step 1: Create AI Agents ──
  console.log("🤖 Seeding AI agents...");

  const createdAgents: Array<{ id: string; name: string; targetQueries: number }> = [];

  for (const agentDef of AGENTS) {
    const registeredAt = randomDateInRange(180, 7); // past 6 months
    const totalQueries = randomInt(
      Math.floor(agentDef.targetQueries * 0.8),
      Math.floor(agentDef.targetQueries * 1.2)
    );

    const agent = await prisma.aIAgent.create({
      data: {
        name: agentDef.name,
        description: agentDef.description,
        descriptionKo: agentDef.descriptionKo,
        category: agentDef.category,
        endpointUrl: agentDef.endpointUrl,
        authMethod: agentDef.authMethod,
        status: agentDef.status,
        pricingTier: agentDef.pricingTier,
        totalQueries: BigInt(totalQueries),
        walletAddress: null,
        capabilities: agentDef.capabilities,
        avatarEmoji: agentDef.avatarEmoji,
        accentColor: agentDef.accentColor,
        contactEmail: agentDef.contactEmail,
        uptime: agentDef.uptime,
        lastActiveAt: randomDateInRange(1, 0), // within last 24h
        createdAt: registeredAt,
      },
    });

    createdAgents.push({
      id: agent.id,
      name: agent.name,
      targetQueries: agentDef.targetQueries,
    });

    console.log(`  + ${agentDef.name} (${agentDef.category}, ${agentDef.pricingTier})`);
  }

  console.log(`  ✅ ${createdAgents.length} AI agents created\n`);

  // ── Step 2: Create Fake Users ──
  console.log("👥 Seeding fake users...");

  const fakeUsers = generateFakeUsers();
  const createdUserIds: string[] = [];

  for (const user of fakeUsers) {
    const lastCheckin = randomDateInRange(user.streakDays > 0 ? 1 : 30, 0);

    const created = await prisma.user.create({
      data: {
        points: user.points,
        streakDays: user.streakDays,
        level: user.level,
        dataConsent: user.dataConsent,
        lastCheckinDate: lastCheckin,
        createdAt: user.createdAt,
      },
    });

    createdUserIds.push(created.id);
  }

  console.log(`  ✅ ${createdUserIds.length} fake users created (${KOREAN_NAMES.length} Korean, ${ENGLISH_NAMES.length} English)\n`);

  // ── Step 3: Create Billing Transactions ──
  console.log("💰 Seeding billing transactions...");

  let totalBillings = 0;
  let totalRevenue = 0;

  // We need a "requester" user for each agent (represents the company/agent requester account)
  // Create a pool of requester accounts (one per agent)
  const requesterIds: string[] = [];
  for (let i = 0; i < AGENTS.length; i++) {
    const requester = await prisma.user.create({
      data: {
        points: randomInt(10000, 100000),
        streakDays: 0,
        level: 1,
        dataConsent: false,
        createdAt: randomDateInRange(180, 30),
      },
    });
    requesterIds.push(requester.id);
  }

  // Only users with consent can be data providers
  const consentedUserIds = createdUserIds.filter((_, i) => fakeUsers[i].dataConsent);

  for (let agentIdx = 0; agentIdx < createdAgents.length; agentIdx++) {
    const agent = createdAgents[agentIdx];
    const requesterId = requesterIds[agentIdx];
    const queryCount = agent.targetQueries;

    // Distribute queries over 30 days with more recent days having more activity
    // Use an exponential distribution: day 0 (today) has most, day 29 has least
    const dailyWeights: number[] = [];
    let weightSum = 0;
    for (let day = 0; day < 30; day++) {
      // Exponential growth toward recent days, plus some noise
      const weight = Math.pow(1.06, 30 - day) + randomFloat(0, 0.3);
      dailyWeights.push(weight);
      weightSum += weight;
    }

    // Normalize to get per-day counts
    const dailyCounts = dailyWeights.map((w) =>
      Math.max(1, Math.round((w / weightSum) * queryCount))
    );

    // Batch insert billing records
    const billingBatch: Array<{
      agentId: string;
      userId: string;
      requesterId: string;
      tier: QueryTier;
      pointsCharged: number;
      platformShare: number;
      userShare: number;
      developerShare: number;
      dataIncluded: string[];
      createdAt: Date;
    }> = [];

    for (let day = 0; day < 30; day++) {
      const count = dailyCounts[day];
      const dayDate = new Date();
      dayDate.setDate(dayDate.getDate() - day);

      for (let q = 0; q < count; q++) {
        const tier = pickWeightedTier();
        const pricing = TIER_PRICING[tier];
        const pointsCharged = pricing.pointsCharged;

        // Revenue split: 30% platform, 50% user (data provider), 20% developer (agent)
        const platformShare = Math.round(pointsCharged * 0.30);
        const userShare = Math.round(pointsCharged * 0.50);
        const developerShare = pointsCharged - platformShare - userShare; // remainder to avoid rounding issues

        const userId = randomPick(consentedUserIds);
        const timestamp = randomTimeOnDay(dayDate);

        billingBatch.push({
          agentId: agent.id,
          userId,
          requesterId,
          tier,
          pointsCharged,
          platformShare,
          userShare,
          developerShare,
          dataIncluded: randomPick(DATA_TYPES),
          createdAt: timestamp,
        });

        totalRevenue += pointsCharged;
      }
    }

    // Batch insert in chunks of 500 to avoid memory issues
    const CHUNK_SIZE = 500;
    for (let i = 0; i < billingBatch.length; i += CHUNK_SIZE) {
      const chunk = billingBatch.slice(i, i + CHUNK_SIZE);
      await prisma.queryBilling.createMany({ data: chunk });
    }

    totalBillings += billingBatch.length;
    console.log(`  + ${agent.name}: ${billingBatch.length} transactions`);
  }

  console.log(`  ✅ ${totalBillings.toLocaleString()} billing transactions created`);
  console.log(`  💎 Total revenue: ${totalRevenue.toLocaleString()} points\n`);

  // ── Step 4: Create Activity Logs ──
  console.log("📊 Seeding activity logs...");

  let totalLogs = 0;

  for (const agent of createdAgents) {
    const logCount = randomInt(15, 60); // 15-60 logs per agent over 7 days
    const logBatch: Array<{
      agentId: string;
      action: string;
      detail: string;
      amount: number | null;
      createdAt: Date;
    }> = [];

    for (let i = 0; i < logCount; i++) {
      const template = randomPick(ACTIVITY_TEMPLATES);
      const detail = generateLogDetail(template);
      const daysAgo = randomInt(0, 6);
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - daysAgo);
      const timestamp = randomTimeOnDay(logDate);

      // Some actions have associated amounts (queries usually do)
      let amount: number | null = null;
      if (template.action === "query") {
        amount = randomFloat(0.001, 2.5);
      }

      logBatch.push({
        agentId: agent.id,
        action: template.action,
        detail,
        amount,
        createdAt: timestamp,
      });
    }

    await prisma.agentQueryLog.createMany({ data: logBatch });
    totalLogs += logBatch.length;
  }

  console.log(`  ✅ ${totalLogs.toLocaleString()} activity logs created\n`);

  // ── Summary ──
  console.log("=========================================");
  console.log("  ✅ Agent Ecosystem Seeded Successfully!");
  console.log("=========================================");
  console.log(`  🤖 Agents:        ${createdAgents.length}`);
  console.log(`  👥 Users:         ${createdUserIds.length} data providers + ${requesterIds.length} requester accounts`);
  console.log(`  💰 Transactions:  ${totalBillings.toLocaleString()}`);
  console.log(`  💎 Total Revenue: ${totalRevenue.toLocaleString()} points`);
  console.log(`  📊 Activity Logs: ${totalLogs.toLocaleString()}`);
  console.log(`  📅 Data Span:     30 days of billing, 7 days of activity logs`);
  console.log("=========================================\n");
}

seedAgents()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
