// Detail Score Algorithm — Input quality 0-10
// Anti-gaming: detects gibberish, copy-paste, low-effort
import type { AIScribeResult } from "../../shared/types";

interface ScoreBreakdown {
  total: number;
  symptomDetail: number;    // 0-3: count + severity + bodysite
  medicationDetail: number; // 0-2: name + dosage + effectiveness
  contextDetail: number;    // 0-2: duration, timeline, lifestyle
  uniqueness: number;       // 0-2: not copy-paste, varied vocab
  lengthBonus: number;      // 0-1: adequate length
}

// Known gibberish / copy-paste patterns
const ABUSE_PATTERNS = [
  /(.)\1{5,}/,                           // aaaaa repeated chars
  /^[.\s]+$/,                            // Only punctuation/whitespace
  /^(test|asdf|qwer|1234)/i,             // Test inputs
  /^(it hurts|hurts)\s*$/i,              // Too minimal "it hurts"
  /^.{1,5}$/,                            // Less than 5 chars
];

const COPY_PASTE_HASHES = new Set<string>(); // Rolling window of recent input hashes

export function calculateDetailScore(
  userInput: string,
  aiResult: Pick<AIScribeResult, "symptoms" | "medications">
): ScoreBreakdown {
  let symptomDetail = 0;
  let medicationDetail = 0;
  let contextDetail = 0;
  let uniqueness = 2;  // Start at max, deduct for abuse
  let lengthBonus = 0;

  // ── Anti-abuse check ──
  const normalized = userInput.trim();
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { total: 0, symptomDetail: 0, medicationDetail: 0, contextDetail: 0, uniqueness: 0, lengthBonus: 0 };
    }
  }

  // Copy-paste detection (simple hash check)
  const inputHash = simpleHash(normalized.toLowerCase().replace(/\s+/g, ""));
  if (COPY_PASTE_HASHES.has(inputHash)) {
    uniqueness = 0;
  } else {
    COPY_PASTE_HASHES.add(inputHash);
    if (COPY_PASTE_HASHES.size > 1000) {
      const first = COPY_PASTE_HASHES.values().next().value;
      if (first) COPY_PASTE_HASHES.delete(first);
    }
  }

  // Vocabulary diversity check
  const words = normalized.split(/\s+/);
  const uniqueWords = new Set(words);
  if (uniqueWords.size / Math.max(words.length, 1) < 0.4) {
    uniqueness = Math.max(uniqueness - 1, 0);
  }

  // ── Symptom detail ──
  const symCount = aiResult.symptoms.length;
  if (symCount >= 3) symptomDetail = 3;
  else if (symCount >= 2) symptomDetail = 2;
  else if (symCount >= 1) symptomDetail = 1;

  // Severity and body site mentioned?
  const hasSeverity = aiResult.symptoms.some(s => s.severity !== "moderate");
  const hasBodySite = aiResult.symptoms.some(s => s.bodySite);
  if (hasSeverity) symptomDetail = Math.min(symptomDetail + 0.5, 3);
  if (hasBodySite) symptomDetail = Math.min(symptomDetail + 0.5, 3);

  // ── Medication detail ──
  if (aiResult.medications.length > 0) {
    medicationDetail = 1;
    const hasEffectiveness = aiResult.medications.some(m => m.effectiveness !== "unknown");
    const hasDosage = aiResult.medications.some(m => m.dosage);
    if (hasEffectiveness) medicationDetail += 0.5;
    if (hasDosage) medicationDetail += 0.5;
  }

  // ── Context ──
  const contextKeywords = {
    duration: /(\d+\s*days?|yesterday|today|a few days|a week|a month|hours?|weeks?)/i,
    timeline: /(morning|evening|night|dawn|lunch|afternoon|after meal|before meal)/i,
    lifestyle: /(exercise|stress|sleep|diet|drinking|alcohol|smoking|caffeine)/i,
    trigger: /(because|cause|started|suddenly|gradually|recurring|since)/i,
  };

  let contextHits = 0;
  for (const [, regex] of Object.entries(contextKeywords)) {
    if (regex.test(normalized)) contextHits++;
  }
  contextDetail = Math.min(contextHits, 2);

  // ── Length bonus ──
  if (normalized.length >= 50) lengthBonus = 0.5;
  if (normalized.length >= 100) lengthBonus = 1;

  const total = Math.min(
    Math.round((symptomDetail + medicationDetail + contextDetail + uniqueness + lengthBonus) * 10) / 10,
    10
  );

  return { total, symptomDetail, medicationDetail, contextDetail, uniqueness, lengthBonus };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export function isLikelyAbuse(userInput: string): boolean {
  const result = calculateDetailScore(userInput, { symptoms: [], medications: [] });
  return result.total === 0 && result.uniqueness === 0;
}
