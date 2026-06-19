// @health-journal/shared/types/report-types — Personalized Health Report Types
// Shared between API, frontend, and Telegram bot

// ── Report Period ──
export interface ReportPeriod {
  from: string;   // ISO date string (YYYY-MM-DD)
  to: string;     // ISO date string (YYYY-MM-DD)
}

// ── Section 1: Overview ──
export interface ReportOverview {
  totalEntries: number;
  streakDays: number;
  level: number;
  totalPoints: number;
  complianceRate: number; // % of days with entries in the period (0–100)
}

// ── Section 2: Symptom Analysis ──
export type SymptomTrendDirection = "improving" | "worsening" | "stable";

export interface TopSymptomEntry {
  name: string;
  count: number;
  avgSeverity: number;
  trend: SymptomTrendDirection;
}

export interface SeverityDistribution {
  mild: number;
  moderate: number;
  severe: number;
  critical: number;
}

export interface ReportSymptomAnalysis {
  topSymptoms: TopSymptomEntry[];
  newSymptoms: string[];           // first appeared this period
  resolvedSymptoms: string[];      // not reported this period but were before
  severityDistribution: SeverityDistribution;
}

// ── Section 3: Pattern Insights ──
export interface CorrelationEntry {
  condition: string;
  guidance: string;
  severity: string;
  matchedSymptoms: string[];
}

export interface ReportPatternInsights {
  weekdayPatterns: string[];
  seasonalFactors: string[];
  correlations: CorrelationEntry[];
  recurringPatterns: string[];
}

// ── Section 4: Medication Review ──
export interface MedicationInteraction {
  drugs: string[];
  severity: string;
  description: string;
}

export interface ReportMedicationReview {
  activeMedications: string[];
  interactions: MedicationInteraction[];
  adherenceNotes: string[];
}

// ── Section 5: AI Recommendations ──
export interface ReportAIRecommendations {
  lifestyle: string[];
  medicalFollowUp: string[];
  preventive: string[];
  aiNarrative: string;   // GPT-generated personalized narrative
}

// ── Full Personalized Report ──
export interface PersonalizedReport {
  userId: string;
  generatedAt: string;     // ISO timestamp
  period: ReportPeriod;

  // Section 1
  overview: ReportOverview;

  // Section 2
  symptomAnalysis: ReportSymptomAnalysis;

  // Section 3
  patternInsights: ReportPatternInsights;

  // Section 4
  medicationReview: ReportMedicationReview;

  // Section 5
  aiRecommendations: ReportAIRecommendations;

  // Section 6
  predictiveWarnings: string[];

  // Meta
  isPremium: boolean;
  language: "ko" | "en";
}

// ── Report Generation Options ──
export interface ReportGenerationOptions {
  periodDays?: number;       // default 30 for monthly, 7 for weekly
  language?: "ko" | "en";    // default "en"
  includeAI?: boolean;       // requires OPENAI_API_KEY
}

// ── Report History Entry ──
export interface ReportHistoryEntry {
  id: string;
  generatedAt: string;
  period: ReportPeriod;
  type: "weekly" | "monthly" | "custom";
  isPremium: boolean;
}

// ── Free vs Premium Report Tier ──
export type ReportTier = "free" | "premium";

export const REPORT_TIER_LIMITS = {
  free: {
    maxTopSymptoms: 3,
    includeCorrelations: false,
    includeMedicationReview: false,
    includeAINarrative: false,
    includePredictiveWarnings: false,
    maxRecurringPatterns: 2,
  },
  premium: {
    maxTopSymptoms: 10,
    includeCorrelations: true,
    includeMedicationReview: true,
    includeAINarrative: true,
    includePredictiveWarnings: true,
    maxRecurringPatterns: 20,
  },
} as const;
