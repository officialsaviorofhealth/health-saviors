// AI Scribe 5-Stage Pipeline
// Extract → Map → Structure → Educate → Safety

import { AI_SCRIBE_SYSTEM_PROMPT, AI_SCRIBE_FEW_SHOTS } from "../prompts/system-prompt";
import { SNOMED_LOOKUP } from "../mappings/snomed-codes";
import { EMERGENCY_RULES, checkEmergency } from "../safety/emergency-detector";
import type { AIScribeResult, FHIRBundle, FHIRBundleEntry, FHIRCondition, FHIRMedicationStatement, SymptomExtraction, MedicationExtraction, SafetyAlert } from "../../shared/types";

export interface AIScribePipelineConfig {
  llmApiKey?: string;
  preferredModel: "llm";
  language: "ko" | "en";
}

interface RawAIResponse {
  symptoms: Array<{
    name: string; nameKo: string; snomedCode: string; icdCode: string;
    severity: string; bodySite?: string; duration?: string; onsetDate?: string | null;
  }>;
  medications: Array<{
    name: string; nameKo: string; dosage?: string; frequency?: string;
    status: string; effectiveness?: string;
  }>;
  urgencyScore: number;
  urgencyLevel: string;
  detailScore: number;
  educationResponse: string;
  safetyAlert: SafetyAlert | null;
}

export class AIScribePipeline {
  private config: AIScribePipelineConfig;

  constructor(config: AIScribePipelineConfig) {
    this.config = config;
  }

  // ── Main Pipeline ──
  async process(userInput: string): Promise<AIScribeResult> {
    // Stage 1: Extract via AI
    const rawResult = await this.stage1_extract(userInput);

    // Stage 2: Map to medical codes
    const symptoms = this.stage2_map(rawResult.symptoms);
    const medications = this.stage2_mapMedications(rawResult.medications);

    // Stage 3: Structure into FHIR R4
    const fhirBundle = this.stage3_structure(symptoms, medications);

    // Stage 4: Education response (already from AI)
    const educationResponse = rawResult.educationResponse;

    // Stage 5: Safety check
    const safetyAlert = this.stage5_safety(userInput, rawResult.safetyAlert);

    return {
      fhirBundle,
      symptoms,
      medications,
      urgencyScore: rawResult.urgencyScore,
      urgencyLevel: rawResult.urgencyLevel as AIScribeResult["urgencyLevel"],
      detailScore: rawResult.detailScore,
      educationResponse,
      safetyAlert: safetyAlert || undefined,
      language: this.config.language,
      processedAt: new Date().toISOString(),
    };
  }

  // ── Stage 1: Extract (LLM API) ──
  private async stage1_extract(userInput: string): Promise<RawAIResponse> {
    if (this.config.llmApiKey) {
      return this.callLLM(userInput);
    }

    // Graceful fallback when no API key is configured
    console.warn("[AIScribePipeline] No LLM API key configured. Returning fallback response.");
    return this.getFallbackResponse(userInput);
  }

  // ── Fallback: Return structured mock response when no AI is available ──
  private getFallbackResponse(userInput: string): RawAIResponse {
    const isKo = this.config.language === "ko";
    return {
      symptoms: [],
      medications: [],
      urgencyScore: 0,
      urgencyLevel: "none",
      detailScore: 1,
      educationResponse: isKo
        ? "AI service is not currently configured. Your health record has been saved, and analysis will be enabled automatically once an AI API key is configured. For emergencies, call your local emergency number."
        : "AI service is not currently configured. Your health record has been saved. Analysis will be enabled automatically once an AI API key is configured. For emergencies, call your local emergency number.",
      safetyAlert: null,
    };
  }

  private async callLLM(userInput: string): Promise<RawAIResponse> {
    // LLM provider (OpenAI-compatible chat completions, e.g. Groq / xAI Grok)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.llmApiKey!}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
        max_tokens: 2000,
        messages: [
          { role: "system", content: AI_SCRIBE_SYSTEM_PROMPT },
          ...AI_SCRIBE_FEW_SHOTS,
          { role: "user", content: userInput },
        ],
      }),
    });

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content || "{}";
    return this.parseAIResponse(text);
  }

  private parseAIResponse(text: string): RawAIResponse {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return {
        symptoms: [], medications: [], urgencyScore: 0, urgencyLevel: "none",
        detailScore: 1, educationResponse: "Could not analyze your input. Please try again.",
        safetyAlert: null,
      };
    }
  }

  // ── Stage 2: Map to codes ──
  private stage2_map(rawSymptoms: RawAIResponse["symptoms"]): SymptomExtraction[] {
    return rawSymptoms.map((s) => {
      // Validate/correct SNOMED code via lookup
      const snomedEntry = SNOMED_LOOKUP[s.snomedCode];
      return {
        name: s.name,
        snomedCode: snomedEntry ? s.snomedCode : this.findClosestSnomed(s.name),
        icdCode: s.icdCode || "",
        severity: (s.severity as SymptomExtraction["severity"]) || "moderate",
        bodySite: s.bodySite,
        duration: s.duration,
        onsetDate: s.onsetDate || undefined,
      };
    });
  }

  private stage2_mapMedications(rawMeds: RawAIResponse["medications"]): MedicationExtraction[] {
    return rawMeds.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      route: undefined,
      status: (m.status as MedicationExtraction["status"]) || "active",
      effectiveness: (m.effectiveness as MedicationExtraction["effectiveness"]) || "unknown",
    }));
  }

  private findClosestSnomed(symptomName: string): string {
    const lower = symptomName.toLowerCase();
    for (const [code, entry] of Object.entries(SNOMED_LOOKUP)) {
      if (entry.display.toLowerCase().includes(lower) || lower.includes(entry.display.toLowerCase())) {
        return code;
      }
    }
    return "unknown";
  }

  // ── Stage 3: FHIR R4 Structure ──
  private stage3_structure(symptoms: SymptomExtraction[], medications: MedicationExtraction[]): FHIRBundle {
    const entries: FHIRBundleEntry[] = [];

    symptoms.forEach((s, i) => {
      const condition: FHIRCondition = {
        resourceType: "Condition",
        id: `symptom-${i}`,
        code: {
          coding: [
            { system: "http://snomed.info/sct", code: s.snomedCode, display: s.name },
            ...(s.icdCode ? [{ system: "http://id.who.int/icd/release/11", code: s.icdCode, display: s.name }] : []),
          ],
        },
        severity: s.severity ? {
          coding: [{ system: "http://snomed.info/sct", code: this.severityToSnomed(s.severity), display: s.severity }],
        } : undefined,
        bodySite: s.bodySite ? [{
          coding: [{ system: "http://snomed.info/sct", code: "", display: s.bodySite }],
        }] : undefined,
        onsetDateTime: s.onsetDate,
      };
      entries.push({ resource: condition });
    });

    medications.forEach((m, i) => {
      const medStatement: FHIRMedicationStatement = {
        resourceType: "MedicationStatement",
        id: `medication-${i}`,
        medicationCodeableConcept: {
          coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "", display: m.name }],
          text: m.name,
        },
        dosage: m.dosage ? [{ text: `${m.dosage} ${m.frequency || ""}`.trim() }] : undefined,
        status: m.status,
      };
      entries.push({ resource: medStatement });
    });

    return {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: entries,
    };
  }

  private severityToSnomed(severity: string): string {
    const map: Record<string, string> = {
      mild: "255604002", moderate: "6736007", severe: "24484000", critical: "399166001",
    };
    return map[severity] || "";
  }

  // ── Stage 5: Safety ──
  private stage5_safety(userInput: string, aiAlert: SafetyAlert | null): SafetyAlert | null {
    // Double-check with rule-based system even if AI missed it
    const ruleBasedAlert = checkEmergency(userInput, this.config.language);
    if (ruleBasedAlert) return ruleBasedAlert;
    return aiAlert;
  }
}

export default AIScribePipeline;
