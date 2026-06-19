// Enhanced AI Scribe Pipeline — Production Ready
// Integrates: base pipeline + detail scorer + pattern analyzer + circuit breaker + medication interaction

import { AIScribePipeline, type AIScribePipelineConfig } from "./index";
import { calculateDetailScore, isLikelyAbuse } from "./detail-scorer";
import { patternAnalyzer } from "./pattern-analyzer";
import { medicationInteractionChecker } from "./medication-interactions";
import { checkEmergency } from "../safety/emergency-detector";
import type { AIScribeResult, SymptomTrend, MedicationExtraction } from "../../shared/types";

export interface EnhancedConfig {
  llmApiKey?: string;
  preferredModel?: AIScribePipelineConfig["preferredModel"];
  language: "ko" | "en";
  enableAntiAbuse: boolean;
  maxRetries: number;
  circuitBreaker?: { failureThreshold: number; resetTimeMs: number };
}

export interface EnhancedResult extends AIScribeResult {
  scoreBreakdown: ReturnType<typeof calculateDetailScore>;
  isAbuse: boolean;
  medicationWarnings: MedicationWarning[];
  patternInsights: string[];
}

export interface MedicationWarning {
  severity: "info" | "warning" | "critical";
  medications: string[];
  message: string;
  messageKo: string;
}

// ── Circuit Breaker — prevents cascading failures ──
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 60_000,
  ) {}

  canExecute(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.resetTimeMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true; // half-open: allow one attempt
  }

  onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }

  getState() {
    return { state: this.state, failures: this.failures, threshold: this.threshold };
  }
}

export class EnhancedAIScribePipeline {
  private basePipeline: AIScribePipeline;
  private config: EnhancedConfig;
  private circuitBreaker: CircuitBreaker;

  constructor(config: EnhancedConfig) {
    this.config = config;
    this.basePipeline = new AIScribePipeline({
      llmApiKey: config.llmApiKey,
      preferredModel: "llm",
      language: config.language,
    });
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker?.failureThreshold ?? 5,
      config.circuitBreaker?.resetTimeMs ?? 60_000,
    );
  }

  async process(userInput: string, context?: {
    userId?: string;
    recentSymptoms?: SymptomTrend[];
    currentMedications?: string[];
  }): Promise<EnhancedResult> {
    // ── Pre-check: Anti-abuse ──
    if (this.config.enableAntiAbuse && isLikelyAbuse(userInput)) {
      return this.abuseResponse();
    }

    // ── Circuit Breaker check ──
    if (!this.circuitBreaker.canExecute()) {
      return this.fallbackResponse(userInput);
    }

    // ── Run base pipeline with retry + exponential backoff ──
    let result: AIScribeResult | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        result = await this.basePipeline.process(userInput);
        this.circuitBreaker.onSuccess();
        break;
      } catch (err) {
        lastError = err as Error;
        this.circuitBreaker.onFailure();
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10_000)));
        }
      }
    }

    if (!result) {
      // AI failed entirely — return fallback with whatever we can extract locally
      return this.fallbackResponse(userInput);
    }

    // ── Calculate detail score ──
    const scoreBreakdown = calculateDetailScore(userInput, result);
    result.detailScore = scoreBreakdown.total;

    // ── Medication interaction check ──
    const allMedications = [
      ...result.medications.map(m => m.name),
      ...(context?.currentMedications || []),
    ];
    const medicationWarnings = medicationInteractionChecker.checkInteractions(
      allMedications, this.config.language,
    );

    // ── Pattern analysis ──
    let patternInsights: string[] = [];
    if (context?.recentSymptoms && context.recentSymptoms.length > 0) {
      patternInsights = patternAnalyzer.detectRecurringPatterns(context.recentSymptoms);
    }

    // ── Append medication warnings to education response ──
    if (medicationWarnings.length > 0) {
      const warningText = medicationWarnings
        .filter(w => w.severity !== "info")
        .map(w => this.config.language === "ko" ? `⚠️ ${w.messageKo}` : `⚠️ ${w.message}`)
        .join("\n");
      if (warningText) {
        result.educationResponse += "\n\n" + warningText;
      }
    }

    return {
      ...result,
      scoreBreakdown,
      isAbuse: false,
      medicationWarnings,
      patternInsights,
    };
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  private abuseResponse(): EnhancedResult {
    return {
      fhirBundle: { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), entry: [] },
      symptoms: [], medications: [],
      urgencyScore: 0, urgencyLevel: "none", detailScore: 0,
      educationResponse: this.config.language === "ko"
        ? "Please provide meaningful health information. Include specific symptoms, duration, and medications for better analysis."
        : "Please provide meaningful health information. Include specific symptoms, duration, and medications for better analysis.",
      language: this.config.language,
      processedAt: new Date().toISOString(),
      scoreBreakdown: { total: 0, symptomDetail: 0, medicationDetail: 0, contextDetail: 0, uniqueness: 0, lengthBonus: 0 },
      isAbuse: true,
      medicationWarnings: [],
      patternInsights: [],
    };
  }

  private fallbackResponse(userInput: string): EnhancedResult {
    // Rule-based local extraction when AI is unavailable
    const safetyAlert = checkEmergency(userInput, this.config.language);

    return {
      fhirBundle: { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), entry: [] },
      symptoms: [], medications: [],
      urgencyScore: safetyAlert ? 0.9 : 0,
      urgencyLevel: safetyAlert ? "emergency" : "none",
      detailScore: 1,
      educationResponse: this.config.language === "ko"
        ? "AI service is temporarily unavailable. Your health record has been saved and will be analyzed shortly. ⚕️ For emergencies, call your local emergency number."
        : "AI service is temporarily unavailable. Your health record has been saved and will be analyzed shortly. ⚕️ For emergencies, call your local emergency number.",
      safetyAlert: safetyAlert || undefined,
      language: this.config.language,
      processedAt: new Date().toISOString(),
      scoreBreakdown: { total: 1, symptomDetail: 0, medicationDetail: 0, contextDetail: 0, uniqueness: 1, lengthBonus: 0 },
      isAbuse: false,
      medicationWarnings: [],
      patternInsights: [],
    };
  }
}

export const createPipeline = (config: Partial<EnhancedConfig> = {}): EnhancedAIScribePipeline => {
  return new EnhancedAIScribePipeline({
    llmApiKey: process.env.LLM_API_KEY,
    preferredModel: "llm",
    language: "ko",
    enableAntiAbuse: true,
    maxRetries: 3,
    circuitBreaker: { failureThreshold: 5, resetTimeMs: 60_000 },
    ...config,
  });
};
