// Agent Activity Simulator — Background transaction generator
//
// Makes the platform look alive with realistic agent query traffic.
// Uses in-memory counters for efficient stats; writes to DB for persistence.

import type { PrismaClient } from "@prisma/client";
import { QUERY_PRICING, REVENUE_SPLIT } from "./agent-billing";

// ── Configuration ──

export interface SimulatorConfig {
  enabled: boolean;
  intervalMs: number;          // how often to generate events (default: 30 seconds)
  queriesPerHour: number;      // avg queries per hour across all agents (default: 50)
  peakHourMultiplier: number;  // 2x during business hours
}

const DEFAULT_CONFIG: SimulatorConfig = {
  enabled: true,
  intervalMs: 30_000,
  queriesPerHour: 50,
  peakHourMultiplier: 2.0,
};

// ── Agent profiles with activity weights ──

interface AgentProfile {
  name: string;
  category: string;
  description: string;
  avatarEmoji: string;
  accentColor: string;
  capabilities: string[];
  weight: number;               // activity weight: 5=high, 2=medium, 1=low
  preferredTiers: Array<{ tier: keyof typeof QUERY_PRICING; chance: number }>;
  queryTemplates: string[];
}

const AGENT_PROFILES: AgentProfile[] = [
  // ── High-volume agents (weight 5) ──
  {
    name: "Samsung Health AI",
    category: "wellness",
    description: "Samsung's AI-powered health analytics platform integrating wearable data with clinical insights",
    avatarEmoji: "💙",
    accentColor: "#1428A0",
    capabilities: ["wearable_analytics", "sleep_analysis", "heart_rate_monitoring", "stress_detection"],
    weight: 5,
    preferredTiers: [
      { tier: "premium", chance: 0.40 },
      { tier: "standard", chance: 0.35 },
      { tier: "enterprise", chance: 0.15 },
      { tier: "basic", chance: 0.10 },
    ],
    queryTemplates: [
      "Query: wearable_data_aggregation — HR/sleep/steps for {n} users",
      "Query: sleep_pattern_analysis — {n} nights processed, avg quality {score}/100",
      "Sync: samsung_health_import — {n} data points ingested",
      "Query: stress_level_assessment — HRV analysis for {n} users",
      "Batch: daily_wellness_digest — compiled for {n} subscribers",
      "Query: activity_trend_analysis — weekly step goals, {pct}% achieved",
    ],
  },
  {
    name: "MetLife Health Insights",
    category: "insurance",
    description: "Insurance risk assessment and personalized health recommendations powered by AI",
    avatarEmoji: "🛡️",
    accentColor: "#00A3E0",
    capabilities: ["risk_assessment", "actuarial_analysis", "health_scoring", "preventive_care"],
    weight: 5,
    preferredTiers: [
      { tier: "enterprise", chance: 0.35 },
      { tier: "premium", chance: 0.40 },
      { tier: "standard", chance: 0.20 },
      { tier: "basic", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: risk_assessment_score — score {score}/100 for policy #{id}",
      "Batch: actuarial_data_pull — {n} anonymized profiles analyzed",
      "Query: health_risk_stratification — cardiovascular risk tier {tier}",
      "Query: preventive_care_recommendation — {n} suggestions generated",
      "Batch: population_health_study — {n} anonymized records processed",
      "Query: claim_health_correlation — pattern match on {n} claims",
    ],
  },
  {
    name: "Noom Health Coach",
    category: "wellness",
    description: "AI behavior change coaching for weight management and healthy habits",
    avatarEmoji: "🥗",
    accentColor: "#FF6B35",
    capabilities: ["nutrition_analysis", "behavior_coaching", "weight_tracking", "meal_planning"],
    weight: 5,
    preferredTiers: [
      { tier: "standard", chance: 0.45 },
      { tier: "basic", chance: 0.30 },
      { tier: "premium", chance: 0.20 },
      { tier: "enterprise", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: nutrition_pattern_analysis — {n} meal logs processed",
      "Query: calorie_intake_assessment — daily avg {cal} kcal",
      "Query: behavior_change_tracking — {n}-day streak, {pct}% adherence",
      "Query: weight_trend_prediction — trajectory: {direction} {kg}kg/month",
      "Batch: meal_plan_generation — personalized for {n} users",
      "Query: food_interaction_check — {n} dietary conflicts found",
    ],
  },

  // ── Medium-volume agents (weight 2) ──
  {
    name: "Seoul Medical AI Diagnostics",
    category: "clinical",
    description: "Seoul National University Hospital's AI-powered diagnostic assistant",
    avatarEmoji: "🏥",
    accentColor: "#003876",
    capabilities: ["symptom_analysis", "differential_diagnosis", "clinical_decision_support"],
    weight: 2,
    preferredTiers: [
      { tier: "premium", chance: 0.50 },
      { tier: "enterprise", chance: 0.30 },
      { tier: "standard", chance: 0.15 },
      { tier: "basic", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: symptom_pattern_analysis — {n} records scanned",
      "Query: differential_diagnosis — {n} conditions ranked by probability",
      "Query: medication_interaction_check — {n} interactions found",
      "Sync: clinical_data_export — FHIR R4 bundle ({n} resources)",
      "Query: lab_result_interpretation — {n} biomarkers analyzed",
    ],
  },
  {
    name: "Kakao Healthcare",
    category: "platform",
    description: "Kakao's integrated health platform connecting users with healthcare providers",
    avatarEmoji: "💬",
    accentColor: "#FEE500",
    capabilities: ["health_chatbot", "appointment_booking", "prescription_tracking", "telemedicine"],
    weight: 2,
    preferredTiers: [
      { tier: "basic", chance: 0.40 },
      { tier: "standard", chance: 0.35 },
      { tier: "premium", chance: 0.20 },
      { tier: "enterprise", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: symptom_triage — severity level {level}, recommended: {rec}",
      "Query: provider_matching — {n} specialists in region",
      "Query: prescription_adherence — {pct}% compliance rate",
      "Query: telemedicine_prep — patient summary for {n} appointments",
      "Batch: health_notification_targeting — {n} users segmented",
    ],
  },
  {
    name: "Naver Health Search AI",
    category: "search",
    description: "Naver's health-specific search intelligence for medical information retrieval",
    avatarEmoji: "🔍",
    accentColor: "#03C75A",
    capabilities: ["health_search", "medical_qa", "symptom_checker", "health_content_ranking"],
    weight: 2,
    preferredTiers: [
      { tier: "basic", chance: 0.55 },
      { tier: "standard", chance: 0.30 },
      { tier: "premium", chance: 0.12 },
      { tier: "enterprise", chance: 0.03 },
    ],
    queryTemplates: [
      "Query: health_knowledge_retrieval — \"{topic}\" — {n} sources ranked",
      "Query: symptom_checker_v3 — analyzed {n} symptom combinations",
      "Query: medical_entity_extraction — {n} entities from user query",
      "Query: health_content_relevance — scored {n} articles",
      "Batch: trending_health_topics — top {n} queries this hour",
    ],
  },
  {
    name: "LG CNS MedFlow",
    category: "enterprise",
    description: "Enterprise healthcare data pipeline and analytics for hospitals and insurers",
    avatarEmoji: "⚡",
    accentColor: "#A50034",
    capabilities: ["data_pipeline", "ehr_integration", "analytics_dashboard", "compliance_audit"],
    weight: 2,
    preferredTiers: [
      { tier: "enterprise", chance: 0.50 },
      { tier: "premium", chance: 0.30 },
      { tier: "standard", chance: 0.15 },
      { tier: "basic", chance: 0.05 },
    ],
    queryTemplates: [
      "Batch: ehr_data_normalization — {n} records standardized to FHIR R4",
      "Query: compliance_audit_scan — {n} policy violations flagged",
      "Sync: hospital_data_pipeline — ingested {n} new records",
      "Query: analytics_dashboard_refresh — {n} KPIs recalculated",
      "Batch: data_quality_report — {pct}% completeness score",
    ],
  },
  {
    name: "Lunit INSIGHT",
    category: "imaging",
    description: "AI-powered medical imaging analysis for chest X-rays and mammography",
    avatarEmoji: "🔬",
    accentColor: "#6C63FF",
    capabilities: ["chest_xray_analysis", "mammography_screening", "nodule_detection", "radiology_ai"],
    weight: 2,
    preferredTiers: [
      { tier: "premium", chance: 0.45 },
      { tier: "enterprise", chance: 0.35 },
      { tier: "standard", chance: 0.15 },
      { tier: "basic", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: chest_xray_analysis — abnormality score {score}/100",
      "Query: nodule_detection — {n} candidate nodules, {m} flagged",
      "Batch: screening_batch — {n} mammograms processed",
      "Query: radiology_report_assist — structured findings for {n} studies",
      "Query: image_quality_assessment — {pct}% diagnostic quality",
    ],
  },

  // ── Low-volume agents (weight 1) ──
  {
    name: "KAIST BioAI Lab",
    category: "research",
    description: "Academic research lab studying population health patterns with anonymized data",
    avatarEmoji: "🧬",
    accentColor: "#004B87",
    capabilities: ["population_study", "genomics_correlation", "epidemiology", "clinical_trial_matching"],
    weight: 1,
    preferredTiers: [
      { tier: "enterprise", chance: 0.60 },
      { tier: "premium", chance: 0.25 },
      { tier: "standard", chance: 0.10 },
      { tier: "basic", chance: 0.05 },
    ],
    queryTemplates: [
      "Batch: population_health_study — {n} anonymized records",
      "Query: epidemiological_pattern — correlation r={corr} for {topic}",
      "Batch: cohort_analysis — {n} subjects, {m} control group",
      "Query: biomarker_correlation — {n} features extracted",
      "Batch: longitudinal_study_update — {n} new data points added",
    ],
  },
  {
    name: "AstraZeneca TrialMatch",
    category: "pharma",
    description: "Clinical trial patient matching using health profile analysis",
    avatarEmoji: "💊",
    accentColor: "#830051",
    capabilities: ["trial_matching", "eligibility_screening", "adverse_event_monitoring"],
    weight: 1,
    preferredTiers: [
      { tier: "enterprise", chance: 0.55 },
      { tier: "premium", chance: 0.30 },
      { tier: "standard", chance: 0.10 },
      { tier: "basic", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: trial_eligibility_screen — {n}/{m} criteria matched for trial #{id}",
      "Batch: adverse_event_scan — {n} patient records screened",
      "Query: patient_phenotype_match — similarity score {score}/100",
      "Batch: recruitment_funnel — {n} candidates for phase {phase} trial",
      "Query: contraindication_check — {n} flags for compound #{id}",
    ],
  },
  {
    name: "National Health Insurance AI",
    category: "government",
    description: "National Health Insurance Service analytics for preventive care programs",
    avatarEmoji: "🏛️",
    accentColor: "#0066B3",
    capabilities: ["preventive_screening", "cost_analysis", "population_health", "claim_processing"],
    weight: 1,
    preferredTiers: [
      { tier: "enterprise", chance: 0.40 },
      { tier: "premium", chance: 0.30 },
      { tier: "standard", chance: 0.20 },
      { tier: "basic", chance: 0.10 },
    ],
    queryTemplates: [
      "Batch: preventive_screening_eligibility — {n} citizens flagged",
      "Query: health_checkup_analysis — {n} abnormal findings this quarter",
      "Batch: chronic_disease_registry — {n} new entries added",
      "Query: cost_effectiveness_model — savings estimate: {n} USD/person",
      "Query: regional_health_index — {region} score: {score}/100",
    ],
  },
  {
    name: "FitBerry Wellness",
    category: "fitness",
    description: "Korean fitness startup providing AI workout and recovery recommendations",
    avatarEmoji: "🫐",
    accentColor: "#7B2D8B",
    capabilities: ["workout_planning", "recovery_tracking", "injury_prevention", "performance_analytics"],
    weight: 1,
    preferredTiers: [
      { tier: "basic", chance: 0.45 },
      { tier: "standard", chance: 0.35 },
      { tier: "premium", chance: 0.15 },
      { tier: "enterprise", chance: 0.05 },
    ],
    queryTemplates: [
      "Query: recovery_assessment — readiness score {score}/100",
      "Query: workout_personalization — {n} exercises adjusted for user profile",
      "Query: injury_risk_prediction — {bodyPart} risk level: {level}",
      "Batch: performance_benchmark — {n} users ranked this week",
      "Query: exercise_load_analysis — weekly TSS: {n}, recommended: {m}",
    ],
  },
];

// ── Query detail filler topics ──

const HEALTH_TOPICS = [
  "hypertension", "type_2_diabetes", "sleep_apnea", "chronic_fatigue",
  "migraine_patterns", "anxiety_disorders", "iron_deficiency", "vitamin_d_levels",
  "metabolic_syndrome", "GERD", "atrial_fibrillation", "osteoporosis_risk",
  "thyroid_function", "lipid_profile", "renal_function", "liver_enzymes",
  "inflammatory_markers", "autoimmune_screening", "allergy_sensitization",
  "respiratory_function",
];

const BODY_PARTS = ["lower_back", "knee", "shoulder", "neck", "ankle", "wrist", "hip"];
const DIRECTIONS = ["down", "up", "stable"];
const REGIONS = ["North", "South", "East", "West", "Central", "Metro", "Coastal", "Northeast", "Southwest"];
const RECOMMENDATIONS = ["specialist_visit", "self_care", "emergency", "follow_up_7d", "monitoring"];
const SEVERITY_LEVELS = ["low", "moderate", "elevated", "high"];

// ── In-memory counters for efficient real-time stats ──

interface InMemoryStats {
  queries24h: number;
  queriesAllTime: number;
  pointsDistributed24h: number;
  activeAgentIds24h: Set<string>;
  recentActivity: Array<{ agent: string; action: string; time: Date }>;
  agentQueries24h: Map<string, number>;
  hourlyQueryCounts: number[];  // last 60 entries (1 per minute)
  lastHourlyReset: number;
}

const stats: InMemoryStats = {
  queries24h: 0,
  queriesAllTime: 0,
  pointsDistributed24h: 0,
  activeAgentIds24h: new Set(),
  recentActivity: [],
  agentQueries24h: new Map(),
  hourlyQueryCounts: new Array(60).fill(0),
  lastHourlyReset: Date.now(),
};

// Reset 24h counters at midnight KST
let lastDayReset = new Date().toDateString();

function resetDailyCountersIfNeeded(): void {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const today = nowKST.toDateString();
  if (today !== lastDayReset) {
    stats.queries24h = 0;
    stats.pointsDistributed24h = 0;
    stats.activeAgentIds24h.clear();
    stats.agentQueries24h.clear();
    lastDayReset = today;
  }
}

// Update rolling minute counter
function recordQueryInMinuteWindow(count: number): void {
  const now = Date.now();
  const minuteIndex = Math.floor((now / 60_000)) % 60;
  const elapsed = now - stats.lastHourlyReset;

  // If more than an hour since last reset, zero everything
  if (elapsed > 3600_000) {
    stats.hourlyQueryCounts.fill(0);
    stats.lastHourlyReset = now;
  }

  stats.hourlyQueryCounts[minuteIndex] += count;
}

// ── Utility helpers ──

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickTier(profile: AgentProfile): keyof typeof QUERY_PRICING {
  const roll = Math.random();
  let cumulative = 0;
  for (const { tier, chance } of profile.preferredTiers) {
    cumulative += chance;
    if (roll <= cumulative) return tier;
  }
  return "basic";
}

function fillTemplate(template: string): string {
  return template
    .replace(/\{n\}/g, () => String(randomInt(12, 4_850)))
    .replace(/\{m\}/g, () => String(randomInt(3, 500)))
    .replace(/\{score\}/g, () => String(randomInt(42, 98)))
    .replace(/\{pct\}/g, () => String(randomInt(51, 99)))
    .replace(/\{id\}/g, () => String(randomInt(10000, 99999)))
    .replace(/\{cal\}/g, () => String(randomInt(1200, 2800)))
    .replace(/\{kg\}/g, () => randomFloat(0.2, 1.8).toFixed(1))
    .replace(/\{corr\}/g, () => randomFloat(0.12, 0.89).toFixed(2))
    .replace(/\{tier\}/g, () => ["A", "B", "C", "D"][randomInt(0, 3)])
    .replace(/\{phase\}/g, () => String(randomInt(1, 3)))
    .replace(/\{topic\}/g, () => HEALTH_TOPICS[randomInt(0, HEALTH_TOPICS.length - 1)])
    .replace(/\{direction\}/g, () => DIRECTIONS[randomInt(0, DIRECTIONS.length - 1)])
    .replace(/\{bodyPart\}/g, () => BODY_PARTS[randomInt(0, BODY_PARTS.length - 1)])
    .replace(/\{region\}/g, () => REGIONS[randomInt(0, REGIONS.length - 1)])
    .replace(/\{rec\}/g, () => RECOMMENDATIONS[randomInt(0, RECOMMENDATIONS.length - 1)])
    .replace(/\{level\}/g, () => SEVERITY_LEVELS[randomInt(0, SEVERITY_LEVELS.length - 1)]);
}

/** Get the time-of-day query rate multiplier (KST) */
function getTimeMultiplier(): number {
  const nowKST = new Date(Date.now() + 9 * 3600_000);
  const hour = nowKST.getUTCHours();
  const dayOfWeek = nowKST.getUTCDay(); // 0=Sun, 6=Sat

  let multiplier = 1.0;

  // Night hours (11PM - 6AM KST): 0.3x
  if (hour >= 23 || hour < 6) {
    multiplier = 0.3;
  }
  // Peak hours (9AM - 6PM KST): 2x
  else if (hour >= 9 && hour < 18) {
    multiplier = 2.0;
  }
  // Shoulder hours: 1x (default)

  // Weekends: 0.5x
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    multiplier *= 0.5;
  }

  // Add organic variation: +/- 20%
  multiplier *= randomFloat(0.80, 1.20);

  return multiplier;
}

// ── Agent DB cache ──

interface CachedAgent {
  id: string;
  name: string;
  profile: AgentProfile;
}

let cachedAgents: CachedAgent[] = [];
let cachedUserIds: string[] = [];
let cacheInitialized = false;
let totalDataProviders = 0;

/** Ensure agents exist in DB (create if missing), cache their IDs */
async function ensureAgentsExist(prisma: PrismaClient): Promise<void> {
  if (cacheInitialized) return;

  for (const profile of AGENT_PROFILES) {
    // Upsert: find by name or create
    let agent = await prisma.aIAgent.findFirst({
      where: { name: profile.name },
    });

    if (!agent) {
      agent = await prisma.aIAgent.create({
        data: {
          name: profile.name,
          category: profile.category,
          description: profile.description,
          avatarEmoji: profile.avatarEmoji,
          accentColor: profile.accentColor,
          capabilities: profile.capabilities,
          pricingTier: profile.preferredTiers[0].tier,
          endpointUrl: `https://api.${profile.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.health/v1`,
          status: "active",
          authMethod: "api-key",
        },
      });
    } else if (agent.status !== "active") {
      // Activate any existing agent that was idle
      await prisma.aIAgent.update({
        where: { id: agent.id },
        data: { status: "active" },
      });
    }

    cachedAgents.push({ id: agent.id, name: agent.name, profile });
  }

  // Load user IDs for data providers (users with data consent)
  const users = await prisma.user.findMany({
    where: { dataConsent: true },
    select: { id: true },
    take: 200,
  });
  cachedUserIds = users.map((u) => u.id);

  // If no consented users, grab any users
  if (cachedUserIds.length === 0) {
    const allUsers = await prisma.user.findMany({
      select: { id: true },
      take: 200,
    });
    cachedUserIds = allUsers.map((u) => u.id);
  }

  totalDataProviders = cachedUserIds.length;

  // Initialize all-time counter from DB
  const allTimeResult = await prisma.queryBilling.count();
  stats.queriesAllTime = allTimeResult;

  // Initialize 24h counter from DB
  const oneDayAgo = new Date(Date.now() - 86400_000);
  const todayResult = await prisma.queryBilling.count({
    where: { createdAt: { gte: oneDayAgo } },
  });
  stats.queries24h = todayResult;

  cacheInitialized = true;
  console.log(
    `[Simulator] Initialized: ${cachedAgents.length} agents, ${cachedUserIds.length} data providers`
  );
}

// ── Core simulation tick ──

async function simulationTick(prisma: PrismaClient, config: SimulatorConfig): Promise<void> {
  resetDailyCountersIfNeeded();

  if (cachedUserIds.length === 0) {
    // No users to query data from — skip silently
    return;
  }

  const timeMultiplier = getTimeMultiplier();

  // Calculate how many queries to generate this tick
  // queriesPerHour * multiplier / (3600_000 / intervalMs) = queries per tick
  const ticksPerHour = 3600_000 / config.intervalMs;
  const expectedQueriesPerTick = (config.queriesPerHour * timeMultiplier) / ticksPerHour;

  // Poisson-ish distribution: use expected value with random variation
  const queriesThisTick = Math.max(
    0,
    Math.round(expectedQueriesPerTick + (Math.random() - 0.5) * expectedQueriesPerTick * 0.6),
  );

  if (queriesThisTick === 0) return;

  // Pick 1-3 unique agents for this tick (weighted)
  const agentCount = Math.min(randomInt(1, 3), queriesThisTick);
  const selectedAgents: CachedAgent[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < agentCount; i++) {
    let attempts = 0;
    let agent: CachedAgent;
    do {
      const idx = cachedAgents.indexOf(pickWeighted(cachedAgents.map((a) => ({ ...a, weight: a.profile.weight }))));
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        agent = cachedAgents[idx];
        break;
      }
      attempts++;
    } while (attempts < 10);
    if (attempts < 10) {
      selectedAgents.push(agent!);
    }
  }

  // Distribute queries among selected agents
  let remaining = queriesThisTick;
  for (let ai = 0; ai < selectedAgents.length; ai++) {
    const agent = selectedAgents[ai];
    const isLast = ai === selectedAgents.length - 1;
    const agentQueries = isLast ? remaining : Math.max(1, Math.round(remaining / (selectedAgents.length - ai)));
    remaining -= agentQueries;

    for (let q = 0; q < agentQueries; q++) {
      try {
        await generateSingleQuery(prisma, agent);
      } catch (err) {
        // Swallow individual query failures silently
        // DB constraint violations, etc. are expected during startup
      }
    }
  }

  recordQueryInMinuteWindow(queriesThisTick);
}

async function generateSingleQuery(prisma: PrismaClient, agent: CachedAgent): Promise<void> {
  const profile = agent.profile;
  const tier = pickTier(profile);
  const pointsCharged = QUERY_PRICING[tier];

  // Revenue split
  const platformShare = Math.floor(pointsCharged * REVENUE_SPLIT.platform);
  const userShare = Math.floor(pointsCharged * REVENUE_SPLIT.dataProvider);
  const developerShare = pointsCharged - platformShare - userShare;

  // Pick a random target user (data provider)
  const targetUserId = cachedUserIds[randomInt(0, cachedUserIds.length - 1)];

  // Also use a random user as the "requester" (simulates different API callers)
  const requesterId = cachedUserIds[randomInt(0, cachedUserIds.length - 1)];

  // Determine data fields based on tier
  const tierFields: Record<string, string[]> = {
    basic: ["symptoms"],
    standard: ["symptoms", "structured_data", "medications"],
    premium: ["symptoms", "structured_data", "medications", "wearable", "history"],
    enterprise: ["symptoms", "structured_data", "medications", "wearable", "history", "fhir_bundle"],
  };

  // Generate realistic query description
  const template = profile.queryTemplates[randomInt(0, profile.queryTemplates.length - 1)];
  const detail = fillTemplate(template);

  // Slight timestamp jitter (up to 25 seconds back) for organic feel
  const jitterMs = randomInt(0, 25_000);
  const timestamp = new Date(Date.now() - jitterMs);

  // Write to DB in a single transaction
  await prisma.$transaction(async (tx) => {
    // 1. Create QueryBilling record
    await tx.queryBilling.create({
      data: {
        agentId: agent.id,
        userId: targetUserId,
        requesterId,
        tier: tier as any,
        pointsCharged,
        platformShare,
        userShare,
        developerShare,
        dataIncluded: tierFields[tier] || ["symptoms"],
        createdAt: timestamp,
      },
    });

    // 2. Create AgentQueryLog entry
    await tx.agentQueryLog.create({
      data: {
        agentId: agent.id,
        action: "billable_query",
        detail: `Tier: ${tier} | ${detail}`,
        amount: pointsCharged,
        createdAt: timestamp,
      },
    });

    // 3. Update agent totalQueries and lastActiveAt
    await tx.aIAgent.update({
      where: { id: agent.id },
      data: {
        totalQueries: { increment: 1 },
        lastActiveAt: timestamp,
        status: "active",
      },
    });

    // 4. Credit data provider with their share (50% of query price)
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        totalPoints: { increment: userShare },
      },
    });
  });

  // Update in-memory stats
  stats.queries24h++;
  stats.queriesAllTime++;
  stats.pointsDistributed24h += userShare;
  stats.activeAgentIds24h.add(agent.id);

  const agentPrev = stats.agentQueries24h.get(agent.name) || 0;
  stats.agentQueries24h.set(agent.name, agentPrev + 1);

  // Add to recent activity feed (keep last 200)
  stats.recentActivity.unshift({
    agent: agent.name,
    action: detail,
    time: timestamp,
  });
  if (stats.recentActivity.length > 200) {
    stats.recentActivity.length = 200;
  }
}

// ── Public API ──

let simulatorInterval: ReturnType<typeof setInterval> | null = null;
let simulatorRunning = false;

/**
 * Start the background activity simulator.
 */
export async function startSimulator(
  prisma: PrismaClient,
  config: Partial<SimulatorConfig> = {},
): Promise<void> {
  const finalConfig: SimulatorConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log("[Simulator] Disabled by configuration");
    return;
  }

  if (simulatorRunning) {
    console.log("[Simulator] Already running");
    return;
  }

  try {
    await ensureAgentsExist(prisma);
  } catch (err) {
    console.error("[Simulator] Failed to initialize agents:", err);
    console.log("[Simulator] Will retry on next tick...");
  }

  simulatorRunning = true;

  // Run first tick immediately
  simulationTick(prisma, finalConfig).catch((err) => {
    console.error("[Simulator] Tick error:", err);
  });

  // Schedule recurring ticks
  simulatorInterval = setInterval(() => {
    if (!cacheInitialized) {
      // Retry initialization if it failed
      ensureAgentsExist(prisma).catch(() => {});
      return;
    }
    simulationTick(prisma, finalConfig).catch((err) => {
      console.error("[Simulator] Tick error:", err);
    });
  }, finalConfig.intervalMs);

  console.log(
    `[Simulator] Started — interval: ${finalConfig.intervalMs}ms, target: ~${finalConfig.queriesPerHour} queries/hr`
  );
}

/**
 * Stop the simulator gracefully.
 */
export function stopSimulator(): void {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
  }
  simulatorRunning = false;
  console.log("[Simulator] Stopped");
}

/**
 * Get real-time ecosystem statistics (uses in-memory counters, very fast).
 */
export function getRealtimeStats(): {
  totalQueries24h: number;
  totalQueriesAllTime: number;
  activeAgents24h: number;
  totalAgents: number;
  totalPointsDistributed24h: number;
  totalDataProviders: number;
  topAgents: Array<{ name: string; queries24h: number }>;
  recentActivity: Array<{ agent: string; action: string; time: Date }>;
  queryRate: number;
} {
  resetDailyCountersIfNeeded();

  // Top agents by 24h queries
  const topAgents = Array.from(stats.agentQueries24h.entries())
    .map(([name, queries24h]) => ({ name, queries24h }))
    .sort((a, b) => b.queries24h - a.queries24h)
    .slice(0, 10);

  // Query rate: sum of last 60 minute buckets divided by 60 = queries per minute
  const totalLastHour = stats.hourlyQueryCounts.reduce((sum, c) => sum + c, 0);
  const queryRate = Math.round((totalLastHour / 60) * 100) / 100;

  return {
    totalQueries24h: stats.queries24h,
    totalQueriesAllTime: stats.queriesAllTime,
    activeAgents24h: stats.activeAgentIds24h.size,
    totalAgents: cachedAgents.length,
    totalPointsDistributed24h: stats.pointsDistributed24h,
    totalDataProviders,
    topAgents,
    recentActivity: stats.recentActivity.slice(0, 20),
    queryRate,
  };
}

/**
 * Get recent billable transactions from the DB.
 */
export async function getRecentTransactions(
  prisma: PrismaClient,
  limit: number = 50,
): Promise<
  Array<{
    id: string;
    agentName: string;
    userAnonymized: string;
    tier: string;
    pointsCharged: number;
    userShare: number;
    createdAt: Date;
  }>
> {
  const billings = await prisma.queryBilling.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    include: {
      agent: { select: { name: true } },
    },
  });

  return billings.map((b) => ({
    id: b.id,
    agentName: b.agent.name,
    // Anonymize user ID: show first 4 and last 4 chars
    userAnonymized: `${b.userId.slice(0, 4)}...${b.userId.slice(-4)}`,
    tier: b.tier,
    pointsCharged: b.pointsCharged,
    userShare: b.userShare,
    createdAt: b.createdAt,
  }));
}

/**
 * Get daily growth metrics for the past N days.
 */
export async function getDailyGrowthMetrics(
  prisma: PrismaClient,
  days: number = 30,
): Promise<
  Array<{
    date: string;
    queries: number;
    pointsDistributed: number;
    uniqueAgents: number;
  }>
> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const billings = await prisma.queryBilling.findMany({
    where: { createdAt: { gte: startDate } },
    select: {
      agentId: true,
      pointsCharged: true,
      userShare: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate by day
  const dayMap = new Map<
    string,
    { queries: number; pointsDistributed: number; agentIds: Set<string> }
  >();

  for (const b of billings) {
    const dateKey = b.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(dateKey) || {
      queries: 0,
      pointsDistributed: 0,
      agentIds: new Set<string>(),
    };
    existing.queries++;
    existing.pointsDistributed += b.userShare;
    existing.agentIds.add(b.agentId);
    dayMap.set(dateKey, existing);
  }

  // Fill in missing days with zeros
  const result: Array<{
    date: string;
    queries: number;
    pointsDistributed: number;
    uniqueAgents: number;
  }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateKey = d.toISOString().slice(0, 10);
    const entry = dayMap.get(dateKey);
    result.push({
      date: dateKey,
      queries: entry?.queries || 0,
      pointsDistributed: entry?.pointsDistributed || 0,
      uniqueAgents: entry?.agentIds.size || 0,
    });
  }

  return result;
}

/**
 * Get the leaderboard: top agents by queries and revenue.
 */
export async function getAgentLeaderboard(
  prisma: PrismaClient,
): Promise<
  Array<{
    id: string;
    name: string;
    category: string;
    avatarEmoji: string;
    accentColor: string;
    totalQueries: string;
    queries24h: number;
    revenue24h: number;
    lastActiveAt: Date | null;
  }>
> {
  const oneDayAgo = new Date(Date.now() - 86400_000);

  const agents = await prisma.aIAgent.findMany({
    where: { status: "active" },
    orderBy: { totalQueries: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      category: true,
      avatarEmoji: true,
      accentColor: true,
      totalQueries: true,
      lastActiveAt: true,
    },
  });

  // Get 24h billing data for these agents
  const agentIds = agents.map((a) => a.id);
  const recentBillings = await prisma.queryBilling.groupBy({
    by: ["agentId"],
    where: {
      agentId: { in: agentIds },
      createdAt: { gte: oneDayAgo },
    },
    _count: { id: true },
    _sum: { pointsCharged: true },
  });

  const billingMap = new Map(
    recentBillings.map((b) => [
      b.agentId,
      { count: b._count.id, revenue: b._sum.pointsCharged || 0 },
    ]),
  );

  return agents.map((a) => {
    const billing = billingMap.get(a.id);
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      avatarEmoji: a.avatarEmoji,
      accentColor: a.accentColor,
      totalQueries: a.totalQueries.toString(),
      queries24h: billing?.count || 0,
      revenue24h: billing?.revenue || 0,
      lastActiveAt: a.lastActiveAt,
    };
  });
}
