import { NextRequest, NextResponse } from "next/server";

// Health Intelligence mock API — returns realistic AI-generated responses
// This endpoint simulates what the production API will look like

interface QueryRequest {
  query: string;
  cohort_size?: number;
  format?: string;
  agent_id?: string;
}

const INTELLIGENCE_DB: Record<string, object> = {
  sleep: {
    top_patterns: [
      { factor: "late_onset_sleep", prevalence: 0.68, description: "Delayed sleep phase (after 1AM)" },
      { factor: "weekend_shift", prevalence: 0.54, description: "2+ hour weekend sleep schedule shift" },
      { factor: "screen_exposure", prevalence: 0.47, description: "Blue light exposure within 1h of bed" },
      { factor: "caffeine_after_3pm", prevalence: 0.38, description: "Caffeine intake past 3:00 PM" },
    ],
    avg_sleep_hours: 6.3,
    optimal_range: "7.0-8.5 hours",
    confidence: 0.91,
  },
  headache: {
    top_triggers: [
      { factor: "sleep_deficit", correlation: 0.72, description: "Below 6h sleep duration" },
      { factor: "high_stress", correlation: 0.65, description: "Stress score > 7/10" },
      { factor: "caffeine_excess", correlation: 0.41, description: "3+ caffeine servings/day" },
      { factor: "dehydration", correlation: 0.38, description: "Below 1.5L water intake" },
    ],
    affected_demographics: "Females 25-34 most reported",
    confidence: 0.94,
  },
  exercise: {
    correlation_with_fatigue: -0.63,
    finding: "Regular exercise (3+/week) reduces fatigue reports by 47%",
    optimal_frequency: "4-5 sessions per week",
    diminishing_returns_at: "7+ sessions per week",
    exercise_types_ranked: [
      { type: "moderate_cardio", effectiveness: 0.82 },
      { type: "yoga_stretching", effectiveness: 0.71 },
      { type: "strength_training", effectiveness: 0.65 },
      { type: "high_intensity", effectiveness: 0.58 },
    ],
    confidence: 0.88,
  },
  stress: {
    stress_to_sleep: {
      correlation: -0.71,
      avg_sleep_loss: "48 minutes per high-stress day",
      recovery_time: "2-3 days to normalize",
    },
    sleep_to_stress: {
      correlation: -0.58,
      threshold: "Below 6h triggers 2.3x stress risk next day",
      cumulative_effect: "3+ nights of poor sleep → 4.1x stress risk",
    },
    top_stressors: [
      { factor: "work_overload", prevalence: 0.62 },
      { factor: "financial_worry", prevalence: 0.45 },
      { factor: "relationship_conflict", prevalence: 0.31 },
    ],
    confidence: 0.86,
  },
  nutrition: {
    deficiency_patterns: [
      { nutrient: "magnesium", prevalence: 0.43, symptom_link: "headache, fatigue, muscle cramps" },
      { nutrient: "vitamin_d", prevalence: 0.38, symptom_link: "fatigue, mood changes, bone pain" },
      { nutrient: "iron", prevalence: 0.29, symptom_link: "fatigue, dizziness, cold extremities" },
      { nutrient: "b12", prevalence: 0.18, symptom_link: "fatigue, cognitive fog, numbness" },
    ],
    dietary_recommendations: "Mediterranean-style diet correlates with 31% fewer symptom reports",
    confidence: 0.85,
  },
  mental: {
    burnout_indicators: [
      { factor: "emotional_exhaustion", prevalence: 0.52 },
      { factor: "depersonalization", prevalence: 0.34 },
      { factor: "reduced_accomplishment", prevalence: 0.41 },
    ],
    protective_factors: [
      { factor: "regular_exercise", risk_reduction: 0.38 },
      { factor: "social_connection", risk_reduction: 0.42 },
      { factor: "mindfulness_practice", risk_reduction: 0.29 },
      { factor: "nature_exposure", risk_reduction: 0.23 },
    ],
    confidence: 0.83,
  },
};

function matchTopic(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("sleep") || q.includes("insomnia")) return "sleep";
  if (q.includes("headache") || q.includes("migraine")) return "headache";
  if (q.includes("exercise") || q.includes("fatigue") || q.includes("tired")) return "exercise";
  if (q.includes("stress") || q.includes("anxiety")) return "stress";
  if (q.includes("nutrition") || q.includes("diet") || q.includes("vitamin")) return "nutrition";
  if (q.includes("mental") || q.includes("burnout") || q.includes("mood")) return "mental";
  // Default: return a general combined response
  return "sleep";
}

export async function POST(request: NextRequest) {
  try {
    const body: QueryRequest = await request.json();

    if (!body.query) {
      return NextResponse.json(
        { error: "Missing required field: query", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    // Simulate processing delay (200-800ms)
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 600));

    const topic = matchTopic(body.query);
    const insight = INTELLIGENCE_DB[topic];
    const sampleSize = body.cohort_size || Math.floor(10000 + Math.random() * 40000);

    return NextResponse.json({
      success: true,
      query: body.query,
      topic_detected: topic,
      insight: {
        ...insight,
        sample_basis: `${sampleSize.toLocaleString()} anonymized wellness patterns`,
      },
      metadata: {
        contains_pii: false,
        data_transferred: false,
        model_version: "hs-intelligence-v2.1",
        processing_time_ms: Math.floor(150 + Math.random() * 200),
        timestamp: new Date().toISOString(),
      },
      billing: {
        points_charged: 5,
        currency: "H2E",
        status: "confirmed",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "PARSE_ERROR" },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Health Saviors Intelligence API",
    version: "v2.1",
    status: "operational",
    endpoints: {
      "POST /api/health": "Query health intelligence (this endpoint)",
      "GET /api/health": "Service status (you are here)",
    },
    documentation: "https://docs.healthsaviors.io",
    supported_topics: Object.keys(INTELLIGENCE_DB),
  });
}
