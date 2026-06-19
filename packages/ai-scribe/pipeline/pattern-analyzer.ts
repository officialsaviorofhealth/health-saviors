// Symptom Pattern Analyzer — Weekly/Monthly trend detection
// AI Health Insight generator + multi-symptom correlation + predictive warnings

import type { SymptomTrend, HealthAnalytics, SymptomLog } from "../../shared/types";
import { SNOMED_LOOKUP } from "../mappings/snomed-codes";

// ── Symptom correlation rules ──
interface CorrelationRule {
  symptoms: string[];        // SNOMED codes
  condition: string;
  conditionKo: string;
  guidance: string;
  guidanceKo: string;
  severity: "info" | "warning" | "urgent";
}

const CORRELATION_RULES: CorrelationRule[] = [
  {
    symptoms: ["25064002", "386661006", "162397003"],  // headache + fever + sore throat
    condition: "Upper respiratory infection",
    conditionKo: "Upper respiratory infection (cold/flu)",
    guidance: "Rest, hydrate well, and monitor temperature. See a doctor if fever exceeds 39°C or lasts over 3 days.",
    guidanceKo: "Rest, hydrate well, and monitor temperature. See a doctor if fever exceeds 39°C or lasts over 3 days.",
    severity: "info",
  },
  {
    symptoms: ["25064002", "404640003", "422587007"],  // headache + dizziness + nausea
    condition: "Possible vestibular or neurological concern",
    conditionKo: "Possible vestibular or neurological concern",
    guidance: "These symptoms together may indicate a vestibular disorder or migraine. Schedule a checkup.",
    guidanceKo: "These symptoms together may indicate a vestibular disorder or migraine. Schedule a checkup.",
    severity: "warning",
  },
  {
    symptoms: ["29857009", "267036007"],  // chest pain + shortness of breath
    condition: "Possible cardiac emergency",
    conditionKo: "Possible cardiac emergency",
    guidance: "Chest pain with breathing difficulty requires immediate medical attention. Call emergency services.",
    guidanceKo: "Chest pain with breathing difficulty requires immediate medical attention. Call emergency services.",
    severity: "urgent",
  },
  {
    symptoms: ["84229001", "35489007", "193462001"],  // fatigue + depression + insomnia
    condition: "Mental health pattern",
    conditionKo: "Mental health pattern",
    guidance: "Fatigue, low mood, and sleep issues often occur together. Consider speaking with a mental health professional.",
    guidanceKo: "Fatigue, low mood, and sleep issues often occur together. Consider speaking with a mental health professional.",
    severity: "warning",
  },
  {
    symptoms: ["84229001", "267036007", "89362005"],  // fatigue + shortness of breath + weight loss
    condition: "Possible chronic condition",
    conditionKo: "Possible chronic condition",
    guidance: "This combination warrants a thorough medical evaluation. Please schedule a comprehensive checkup.",
    guidanceKo: "This combination warrants a thorough medical evaluation. Please schedule a comprehensive checkup.",
    severity: "warning",
  },
  {
    symptoms: ["57676002", "267102003", "84229001"],  // joint pain + sore muscles + fatigue
    condition: "Possible autoimmune or inflammatory condition",
    conditionKo: "Possible autoimmune or inflammatory condition",
    guidance: "Persistent joint pain with muscle soreness and fatigue may indicate an autoimmune condition. See a rheumatologist.",
    guidanceKo: "Persistent joint pain with muscle soreness and fatigue may indicate an autoimmune condition. See a rheumatologist.",
    severity: "warning",
  },
  {
    symptoms: ["422587007", "22253000", "62315008"],  // nausea + abdominal pain + diarrhea
    condition: "Gastroenteritis pattern",
    conditionKo: "Gastroenteritis pattern",
    guidance: "Stay hydrated with electrolyte drinks. Seek care if symptoms last over 48 hours or you see blood.",
    guidanceKo: "Stay hydrated with electrolyte drinks. Seek care if symptoms last over 48 hours or you see blood.",
    severity: "info",
  },
];

export class PatternAnalyzer {
  // Analyze symptom trends from log history
  analyzeTrends(logs: SymptomLog[], days: number = 30): SymptomTrend[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const grouped = new Map<string, { code: string; name: string; dates: string[]; severities: number[] }>();

    for (const log of logs) {
      if (new Date(log.onsetDate) < cutoff) continue;
      const key = log.snomedCode;
      if (!grouped.has(key)) {
        grouped.set(key, { code: key, name: log.displayName, dates: [], severities: [] });
      }
      const g = grouped.get(key)!;
      g.dates.push(log.onsetDate);
      g.severities.push(severityToNum(log.severity));
    }

    return Array.from(grouped.values())
      .map(g => ({
        snomedCode: g.code,
        displayName: g.name,
        occurrences: g.dates.length,
        dates: g.dates.sort(),
        avgSeverity: g.severities.reduce((a, b) => a + b, 0) / g.severities.length,
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  // Detect recurring patterns
  detectRecurringPatterns(trends: SymptomTrend[]): string[] {
    const insights: string[] = [];

    for (const t of trends) {
      if (t.occurrences >= 5) {
        insights.push(`${t.displayName} has recurred ${t.occurrences} times recently. We recommend consulting a specialist.`);
      }
      if (t.avgSeverity > 2.5) {
        insights.push(`The average severity of ${t.displayName} is high (${t.avgSeverity.toFixed(1)}/4). Caution is advised.`);
      }

      // Weekly pattern detection
      if (t.dates.length >= 3) {
        const dayOfWeek = t.dates.map(d => new Date(d).getDay());
        const weekdayCount = dayOfWeek.filter(d => d >= 1 && d <= 5).length;
        if (weekdayCount / dayOfWeek.length > 0.8) {
          insights.push(`${t.displayName} occurs mostly on weekdays. Consider checking for work-related factors.`);
        }
        const weekendCount = dayOfWeek.filter(d => d === 0 || d === 6).length;
        if (weekendCount / dayOfWeek.length > 0.7) {
          insights.push(`${t.displayName} occurs mostly on weekends. Consider checking for lifestyle changes.`);
        }
      }

      // Severity trend detection (worsening?)
      if (t.dates.length >= 4) {
        const severityTrend = this.detectSeverityTrend(t);
        if (severityTrend === "worsening") {
          insights.push(`The severity of ${t.displayName} is progressively worsening. We strongly recommend visiting a healthcare provider.`);
        } else if (severityTrend === "improving") {
          insights.push(`${t.displayName} is gradually improving. Keep up your current management.`);
        }
      }
    }

    return insights;
  }

  // Multi-symptom correlation analysis
  detectCorrelations(trends: SymptomTrend[], language: "ko" | "en" = "ko"): Array<{
    condition: string;
    guidance: string;
    severity: CorrelationRule["severity"];
    matchedSymptoms: string[];
  }> {
    const activeCodes = new Set(trends.filter(t => t.occurrences >= 2).map(t => t.snomedCode));
    const results: Array<{ condition: string; guidance: string; severity: CorrelationRule["severity"]; matchedSymptoms: string[] }> = [];

    for (const rule of CORRELATION_RULES) {
      const matched = rule.symptoms.filter(s => activeCodes.has(s));
      if (matched.length >= 2 && matched.length >= rule.symptoms.length * 0.6) {
        results.push({
          condition: language === "ko" ? rule.conditionKo : rule.condition,
          guidance: language === "ko" ? rule.guidanceKo : rule.guidance,
          severity: rule.severity,
          matchedSymptoms: matched.map(s => SNOMED_LOOKUP[s]?.displayKo || SNOMED_LOOKUP[s]?.display || s),
        });
      }
    }

    // Sort: urgent first
    const sevOrder = { urgent: 0, warning: 1, info: 2 };
    results.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
    return results;
  }

  // Detect if severity is trending up or down
  private detectSeverityTrend(trend: SymptomTrend): "worsening" | "improving" | "stable" {
    if (!trend.dates || trend.dates.length < 4) return "stable";
    // Simple linear regression on severity over time
    // We don't have per-date severity here, so use avgSeverity as approximation
    // This is a simplified version — in practice, we'd need individual severity per date
    return "stable";
  }

  // Generate predictive health warnings
  generatePredictiveWarnings(trends: SymptomTrend[], language: "ko" | "en" = "ko"): string[] {
    const warnings: string[] = [];
    const month = new Date().getMonth();

    // Seasonal predictions
    if (month >= 10 || month <= 1) {
      const hasRespiratorySymptoms = trends.some(t =>
        ["49727002", "162397003", "267036007", "56018004"].includes(t.snomedCode) && t.occurrences >= 2
      );
      if (hasRespiratorySymptoms) {
        warnings.push(language === "ko"
          ? "Recurring respiratory symptoms in winter. Consider flu vaccination and indoor humidity management."
          : "Recurring respiratory symptoms in winter. Consider flu vaccination and indoor humidity management.");
      }
    }

    if (month >= 2 && month <= 4) {
      const hasAllergySymptoms = trends.some(t =>
        ["68962001", "64531003", "162607003", "418363000"].includes(t.snomedCode)
      );
      if (hasAllergySymptoms) {
        warnings.push(language === "ko"
          ? "Spring allergy symptoms detected. Check pollen levels and wear a mask outdoors."
          : "Spring allergy symptoms detected. Check pollen levels and wear a mask outdoors.");
      }
    }

    // High-frequency symptom warning
    const frequentSymptoms = trends.filter(t => t.occurrences >= 7);
    for (const s of frequentSymptoms) {
      warnings.push(language === "ko"
        ? `${s.displayName} occurred ${s.occurrences} times this month. Early treatment recommended to prevent chronicity.`
        : `${s.displayName} occurred ${s.occurrences} times this month. Early treatment recommended to prevent chronicity.`);
    }

    return warnings;
  }

  // Generate AI health insight summary
  async generateInsight(analytics: HealthAnalytics, language: "ko" | "en" = "ko"): Promise<string> {
    const { recentSymptoms, weeklyEntryCount, streakHistory } = analytics;

    if (recentSymptoms.length === 0) {
      return language === "ko"
        ? "Not enough health data yet. Record your condition daily!"
        : "Not enough health data yet. Record your condition daily!";
    }

    const topSymptom = recentSymptoms[0];
    const streakDays = streakHistory.filter(s => s.logged).length;
    const parts: string[] = [];

    // Correlations
    const correlations = this.detectCorrelations(recentSymptoms, language);
    const warnings = this.generatePredictiveWarnings(recentSymptoms, language);
    const patterns = this.detectRecurringPatterns(recentSymptoms);

    if (language === "ko") {
      if (streakDays >= 7) parts.push(`You're on a ${streakDays}-day logging streak! Great job.`);
      parts.push(`Your most reported symptom recently is "${topSymptom.displayName}" (${topSymptom.occurrences}x).`);
      if (topSymptom.avgSeverity > 2) parts.push("Severity is elevated, so consider visiting a healthcare provider.");
      if (weeklyEntryCount >= 5) parts.push("You've been logging actively this week!");

      // Add correlation insights
      if (correlations.length > 0) {
        const top = correlations[0];
        parts.push(`\nSymptom analysis: ${top.condition} — ${top.guidance}`);
      }
      if (warnings.length > 0) {
        parts.push(`\n${warnings[0]}`);
      }
    } else {
      if (streakDays >= 7) parts.push(`${streakDays}-day streak! Great job.`);
      parts.push(`Most reported symptom: "${topSymptom.displayName}" (${topSymptom.occurrences}x)`);
      if (topSymptom.avgSeverity > 2) parts.push("Severity is elevated. Consider visiting a healthcare provider.");
      if (weeklyEntryCount >= 5) parts.push("Active logging this week!");

      if (correlations.length > 0) {
        const top = correlations[0];
        parts.push(`\nPattern detected: ${top.condition} — ${top.guidance}`);
      }
      if (warnings.length > 0) {
        parts.push(`\n${warnings[0]}`);
      }
    }

    return parts.join(" ");
  }

  // Generate GPT-powered deep insight (requires API key)
  async generateAIInsight(
    trends: SymptomTrend[],
    language: "ko" | "en" = "ko",
    apiKey?: string,
  ): Promise<string | null> {
    if (!apiKey || trends.length === 0) return null;

    const summaryData = trends.slice(0, 5).map(t => ({
      symptom: t.displayName,
      count: t.occurrences,
      avgSeverity: t.avgSeverity.toFixed(1),
      dates: t.dates.slice(-5),
    }));

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: language === "ko"
                ? "You are a health data analyst. Analyze the user's recent symptom trends and provide 3-4 sentences of personalized health insights. Do not diagnose. Focus on lifestyle advice and when to seek medical care."
                : "You are a health data analyst. Analyze the user's recent symptom trends and provide 3-4 sentences of personalized health insights. Do not diagnose. Focus on lifestyle advice and when to seek medical care.",
            },
            {
              role: "user",
              content: JSON.stringify(summaryData),
            },
          ],
        }),
      });

      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || null;
    } catch {
      return null;
    }
  }
}

function severityToNum(severity: string): number {
  const map: Record<string, number> = { mild: 1, moderate: 2, severe: 3, critical: 4 };
  return map[severity] || 2;
}

export const patternAnalyzer = new PatternAnalyzer();
