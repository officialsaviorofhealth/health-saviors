// Report Generator Service — Personalized Health Report generation
// Premium + Free tier support, GPT-5-mini AI narrative, multi-format output

import { prisma } from "../app";
import { patternAnalyzer } from "../../../../packages/ai-scribe/pipeline/pattern-analyzer";
import { analyticsCache, CacheKeys } from "./cache";
import type {
  PersonalizedReport,
  ReportGenerationOptions,
  ReportOverview,
  ReportSymptomAnalysis,
  ReportPatternInsights,
  ReportMedicationReview,
  ReportAIRecommendations,
  TopSymptomEntry,
  SeverityDistribution,
  SymptomTrendDirection,
  CorrelationEntry,
  MedicationInteraction,
  REPORT_TIER_LIMITS,
} from "../../../../packages/shared/types/report-types";
import type { SymptomTrend } from "../../../../packages/shared/types";

// ── Internal data gathering result ──
interface ReportRawData {
  user: { streakDays: number; totalPoints: bigint; level: number } | null;
  entries: { id: string; entryDate: Date; detailScore: number; pointsEarned: number; createdAt: Date }[];
  symptomLogs: { displayName: string; severity: string; snomedCode: string; onsetDate: Date; bodySite: string | null }[];
  previousPeriodSymptomNames: Set<string>;
  medications: { medicationName: string; dosage: string | null; isActive: boolean; frequency: any; startDate: Date; endDate: Date | null }[];
  periodDays: number;
  periodFrom: Date;
  periodTo: Date;
}

export class ReportGenerator {
  // ── Public: Generate full personalized report ──
  async generateReport(userId: string, options: ReportGenerationOptions = {}): Promise<PersonalizedReport> {
    const {
      periodDays = 30,
      language = "ko",
      includeAI = true,
    } = options;

    const isPremium = await this.checkPremiumAccess(userId);
    const rawData = await this.gatherReportData(userId, periodDays);

    if (!rawData.user) {
      throw new Error("User not found.");
    }

    // Build all sections
    const overview = this.buildOverview(rawData);
    const symptomAnalysis = this.buildSymptomAnalysis(rawData, isPremium, language);
    const patternInsights = this.buildPatternInsights(rawData, isPremium, language);
    const medicationReview = this.buildMedicationReview(rawData, isPremium, language);
    const predictiveWarnings = this.buildPredictiveWarnings(rawData, isPremium, language);

    // AI Recommendations (with optional GPT narrative)
    const aiRecommendations = await this.buildAIRecommendations(
      rawData, symptomAnalysis, patternInsights, predictiveWarnings,
      isPremium, includeAI, language,
    );

    const report: PersonalizedReport = {
      userId,
      generatedAt: new Date().toISOString(),
      period: {
        from: rawData.periodFrom.toISOString().split("T")[0],
        to: rawData.periodTo.toISOString().split("T")[0],
      },
      overview,
      symptomAnalysis,
      patternInsights,
      medicationReview,
      aiRecommendations,
      predictiveWarnings,
      isPremium,
      language,
    };

    return report;
  }

  // ── Public: Format report as plain text (Telegram / email) ──
  formatReportAsText(report: PersonalizedReport): string {
    const lines: string[] = [];

    // Header
    lines.push("===== AI Health Report =====");
    lines.push(`Period: ${report.period.from} ~ ${report.period.to}`);
    lines.push(`Generated: ${report.generatedAt.split("T")[0]}`);
    lines.push("");

    // Section 1: Overview
    lines.push("[ Overview ]");
    const o = report.overview;
    lines.push(`  Total Entries: ${o.totalEntries}`);
    lines.push(`  Streak: ${o.streakDays} days`);
    lines.push(`  Level: ${o.level}`);
    lines.push(`  Total Points: ${o.totalPoints.toLocaleString()}`);
    lines.push(`  Compliance: ${o.complianceRate}%`);
    lines.push("");

    // Section 2: Symptom Analysis
    lines.push("[ Symptom Analysis ]");
    if (report.symptomAnalysis.topSymptoms.length === 0) {
      lines.push(`  No symptoms reported`);
    } else {
      for (const s of report.symptomAnalysis.topSymptoms) {
        const trendIcon = s.trend === "improving" ? "+" : s.trend === "worsening" ? "!" : "-";
        lines.push(`  [${trendIcon}] ${s.name}: ${s.count}x (avg severity ${s.avgSeverity.toFixed(1)}/4)`);
      }
    }

    if (report.symptomAnalysis.newSymptoms.length > 0) {
      lines.push(`  New symptoms: ${report.symptomAnalysis.newSymptoms.join(", ")}`);
    }
    if (report.symptomAnalysis.resolvedSymptoms.length > 0) {
      lines.push(`  Resolved: ${report.symptomAnalysis.resolvedSymptoms.join(", ")}`);
    }

    const sd = report.symptomAnalysis.severityDistribution;
    lines.push(`  Severity: mild:${sd.mild} / mod:${sd.moderate} / severe:${sd.severe} / critical:${sd.critical}`);
    lines.push("");

    // Section 3: Pattern Insights (premium)
    if (report.isPremium && (report.patternInsights.recurringPatterns.length > 0 || report.patternInsights.correlations.length > 0)) {
      lines.push("[ Pattern Insights ]");

      for (const p of report.patternInsights.weekdayPatterns) {
        lines.push(`  - ${p}`);
      }
      for (const p of report.patternInsights.seasonalFactors) {
        lines.push(`  - ${p}`);
      }
      for (const c of report.patternInsights.correlations) {
        lines.push(`  [${c.severity.toUpperCase()}] ${c.condition}`);
        lines.push(`    ${c.guidance}`);
        lines.push(`    Matched: ${c.matchedSymptoms.join(", ")}`);
      }
      for (const r of report.patternInsights.recurringPatterns) {
        lines.push(`  - ${r}`);
      }
      lines.push("");
    }

    // Section 4: Medication Review (premium)
    if (report.isPremium && report.medicationReview.activeMedications.length > 0) {
      lines.push("[ Medication Review ]");
      lines.push(`  Active: ${report.medicationReview.activeMedications.join(", ")}`);
      for (const interaction of report.medicationReview.interactions) {
        lines.push(`  [${interaction.severity}] ${interaction.drugs.join(" + ")}: ${interaction.description}`);
      }
      for (const note of report.medicationReview.adherenceNotes) {
        lines.push(`  - ${note}`);
      }
      lines.push("");
    }

    // Section 5: AI Recommendations
    lines.push("[ AI Recommendations ]");
    if (report.aiRecommendations.lifestyle.length > 0) {
      lines.push(`  Lifestyle:`);
      for (const r of report.aiRecommendations.lifestyle) {
        lines.push(`    - ${r}`);
      }
    }
    if (report.aiRecommendations.medicalFollowUp.length > 0) {
      lines.push(`  Medical Follow-up:`);
      for (const r of report.aiRecommendations.medicalFollowUp) {
        lines.push(`    - ${r}`);
      }
    }
    if (report.aiRecommendations.preventive.length > 0) {
      lines.push(`  Preventive:`);
      for (const r of report.aiRecommendations.preventive) {
        lines.push(`    - ${r}`);
      }
    }
    if (report.aiRecommendations.aiNarrative) {
      lines.push("");
      lines.push("  [AI Narrative]");
      lines.push(`  ${report.aiRecommendations.aiNarrative}`);
    }
    lines.push("");

    // Section 6: Predictive Warnings (premium)
    if (report.isPremium && report.predictiveWarnings.length > 0) {
      lines.push("[ Predictive Warnings ]");
      for (const w of report.predictiveWarnings) {
        lines.push(`  ! ${w}`);
      }
      lines.push("");
    }

    // Footer
    lines.push("* This report is for reference only and is not a medical diagnosis. Consult a healthcare professional.");
    lines.push(`[${report.isPremium ? "Premium" : "Free"}]`);

    return lines.join("\n");
  }

  // ── Public: Format report as HTML (web / PDF) ──
  formatReportAsHTML(report: PersonalizedReport): string {
    const html: string[] = [];

    html.push(`<!DOCTYPE html><html lang="en">`);
    html.push(`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`);
    html.push(`<title>AI Health Report</title>`);
    html.push(`<style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a2e; background: #f8f9fa; }
      .report-header { background: linear-gradient(135deg, #00c9ff, #92fe9d); padding: 32px; border-radius: 16px; color: #1a1a2e; margin-bottom: 24px; }
      .report-header h1 { margin: 0 0 8px; font-size: 28px; }
      .report-header .meta { opacity: 0.8; font-size: 14px; }
      .section { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      .section h2 { margin-top: 0; font-size: 20px; color: #16213e; border-bottom: 2px solid #e8e8e8; padding-bottom: 8px; }
      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
      .stat-card { background: #f0f4f8; padding: 16px; border-radius: 8px; text-align: center; }
      .stat-card .value { font-size: 28px; font-weight: 700; color: #0f3460; }
      .stat-card .label { font-size: 12px; color: #666; margin-top: 4px; }
      .symptom-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
      .symptom-name { flex: 1; font-weight: 500; }
      .symptom-count { margin: 0 12px; color: #555; }
      .trend-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      .trend-improving { background: #d4edda; color: #155724; }
      .trend-worsening { background: #f8d7da; color: #721c24; }
      .trend-stable { background: #e2e3e5; color: #383d41; }
      .severity-bar { display: flex; height: 24px; border-radius: 12px; overflow: hidden; margin: 8px 0; }
      .severity-bar div { display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; font-weight: 600; }
      .sev-mild { background: #81c784; }
      .sev-moderate { background: #ffb74d; }
      .sev-severe { background: #e57373; }
      .sev-critical { background: #c62828; }
      .correlation-card { border-left: 4px solid #ffc107; padding: 12px 16px; margin: 8px 0; background: #fffde7; border-radius: 0 8px 8px 0; }
      .correlation-card.urgent { border-left-color: #dc3545; background: #fff5f5; }
      .correlation-card.warning { border-left-color: #ffc107; background: #fffde7; }
      .correlation-card.info { border-left-color: #17a2b8; background: #f0f9ff; }
      .med-pill { display: inline-block; background: #e3f2fd; color: #1565c0; padding: 4px 12px; border-radius: 16px; margin: 4px; font-size: 13px; }
      .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 12px 16px; border-radius: 8px; margin: 8px 0; }
      .ai-narrative { background: linear-gradient(135deg, #667eea22, #764ba222); padding: 20px; border-radius: 12px; font-style: italic; line-height: 1.6; }
      .recommendation-list { list-style: none; padding: 0; }
      .recommendation-list li { padding: 8px 0 8px 20px; position: relative; }
      .recommendation-list li::before { content: ""; position: absolute; left: 0; top: 14px; width: 8px; height: 8px; background: #00c9ff; border-radius: 50%; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 24px; padding: 16px; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
      .badge-premium { background: #ffd700; color: #333; }
      .badge-free { background: #e0e0e0; color: #666; }
      .new-tag { background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px; }
      .resolved-tag { background: #fce4ec; color: #c62828; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px; }
    </style></head><body>`);

    // Header
    html.push(`<div class="report-header">`);
    html.push(`  <h1>AI Health Report <span class="badge ${report.isPremium ? "badge-premium" : "badge-free"}">${report.isPremium ? "Premium" : "Free"}</span></h1>`);
    html.push(`  <div class="meta">Period: ${report.period.from} ~ ${report.period.to} | Generated: ${report.generatedAt.split("T")[0]}</div>`);
    html.push(`</div>`);

    // Section 1: Overview
    html.push(`<div class="section"><h2>Overview</h2>`);
    html.push(`<div class="stat-grid">`);
    html.push(`  <div class="stat-card"><div class="value">${report.overview.totalEntries}</div><div class="label">Entries</div></div>`);
    html.push(`  <div class="stat-card"><div class="value">${report.overview.streakDays}</div><div class="label">Streak (days)</div></div>`);
    html.push(`  <div class="stat-card"><div class="value">Lv.${report.overview.level}</div><div class="label">Level</div></div>`);
    html.push(`  <div class="stat-card"><div class="value">${report.overview.totalPoints.toLocaleString()}</div><div class="label">Points</div></div>`);
    html.push(`  <div class="stat-card"><div class="value">${report.overview.complianceRate}%</div><div class="label">Compliance</div></div>`);
    html.push(`</div></div>`);

    // Section 2: Symptom Analysis
    html.push(`<div class="section"><h2>Symptom Analysis</h2>`);
    if (report.symptomAnalysis.topSymptoms.length === 0) {
      html.push(`<p>No symptoms reported in this period.</p>`);
    } else {
      for (const s of report.symptomAnalysis.topSymptoms) {
        const trendClass = `trend-${s.trend}`;
        const trendLabel = s.trend;
        html.push(`<div class="symptom-row">`);
        html.push(`  <span class="symptom-name">${this.escapeHtml(s.name)}</span>`);
        html.push(`  <span class="symptom-count">${s.count}x</span>`);
        html.push(`  <span class="symptom-count">avg ${s.avgSeverity.toFixed(1)}/4</span>`);
        html.push(`  <span class="trend-badge ${trendClass}">${trendLabel}</span>`);
        html.push(`</div>`);
      }
    }

    // Severity distribution bar
    const sd = report.symptomAnalysis.severityDistribution;
    const sdTotal = sd.mild + sd.moderate + sd.severe + sd.critical;
    if (sdTotal > 0) {
      html.push(`<h3>Severity Distribution</h3>`);
      html.push(`<div class="severity-bar">`);
      if (sd.mild > 0) html.push(`<div class="sev-mild" style="width:${(sd.mild / sdTotal * 100).toFixed(1)}%">Mild ${sd.mild}</div>`);
      if (sd.moderate > 0) html.push(`<div class="sev-moderate" style="width:${(sd.moderate / sdTotal * 100).toFixed(1)}%">Mod ${sd.moderate}</div>`);
      if (sd.severe > 0) html.push(`<div class="sev-severe" style="width:${(sd.severe / sdTotal * 100).toFixed(1)}%">Severe ${sd.severe}</div>`);
      if (sd.critical > 0) html.push(`<div class="sev-critical" style="width:${(sd.critical / sdTotal * 100).toFixed(1)}%">Critical ${sd.critical}</div>`);
      html.push(`</div>`);
    }

    // New / Resolved symptoms
    if (report.symptomAnalysis.newSymptoms.length > 0) {
      html.push(`<p>New symptoms: ${report.symptomAnalysis.newSymptoms.map(s => `<span class="new-tag">${this.escapeHtml(s)}</span>`).join(" ")}</p>`);
    }
    if (report.symptomAnalysis.resolvedSymptoms.length > 0) {
      html.push(`<p>Resolved: ${report.symptomAnalysis.resolvedSymptoms.map(s => `<span class="resolved-tag">${this.escapeHtml(s)}</span>`).join(" ")}</p>`);
    }
    html.push(`</div>`);

    // Section 3: Pattern Insights (premium only)
    if (report.isPremium && (
      report.patternInsights.weekdayPatterns.length > 0 ||
      report.patternInsights.correlations.length > 0 ||
      report.patternInsights.recurringPatterns.length > 0 ||
      report.patternInsights.seasonalFactors.length > 0
    )) {
      html.push(`<div class="section"><h2>Pattern Insights</h2>`);

      if (report.patternInsights.weekdayPatterns.length > 0 || report.patternInsights.seasonalFactors.length > 0) {
        html.push(`<ul class="recommendation-list">`);
        for (const p of report.patternInsights.weekdayPatterns) {
          html.push(`<li>${this.escapeHtml(p)}</li>`);
        }
        for (const p of report.patternInsights.seasonalFactors) {
          html.push(`<li>${this.escapeHtml(p)}</li>`);
        }
        html.push(`</ul>`);
      }

      for (const c of report.patternInsights.correlations) {
        html.push(`<div class="correlation-card ${c.severity}">`);
        html.push(`  <strong>${this.escapeHtml(c.condition)}</strong>`);
        html.push(`  <p>${this.escapeHtml(c.guidance)}</p>`);
        html.push(`  <small>Matched: ${c.matchedSymptoms.map(s => this.escapeHtml(s)).join(", ")}</small>`);
        html.push(`</div>`);
      }

      if (report.patternInsights.recurringPatterns.length > 0) {
        html.push(`<h3>Recurring Patterns</h3><ul class="recommendation-list">`);
        for (const r of report.patternInsights.recurringPatterns) {
          html.push(`<li>${this.escapeHtml(r)}</li>`);
        }
        html.push(`</ul>`);
      }
      html.push(`</div>`);
    }

    // Section 4: Medication Review (premium only)
    if (report.isPremium && report.medicationReview.activeMedications.length > 0) {
      html.push(`<div class="section"><h2>Medication Review</h2>`);
      html.push(`<p>Active Medications:</p>`);
      html.push(`<div>${report.medicationReview.activeMedications.map(m => `<span class="med-pill">${this.escapeHtml(m)}</span>`).join("")}</div>`);

      if (report.medicationReview.interactions.length > 0) {
        html.push(`<h3>Drug Interactions</h3>`);
        for (const ix of report.medicationReview.interactions) {
          html.push(`<div class="warning-box"><strong>${ix.drugs.map(d => this.escapeHtml(d)).join(" + ")}</strong> [${ix.severity}]<br>${this.escapeHtml(ix.description)}</div>`);
        }
      }
      if (report.medicationReview.adherenceNotes.length > 0) {
        html.push(`<h3>Adherence Notes</h3><ul class="recommendation-list">`);
        for (const n of report.medicationReview.adherenceNotes) {
          html.push(`<li>${this.escapeHtml(n)}</li>`);
        }
        html.push(`</ul>`);
      }
      html.push(`</div>`);
    }

    // Section 5: AI Recommendations
    html.push(`<div class="section"><h2>AI Recommendations</h2>`);
    if (report.aiRecommendations.lifestyle.length > 0) {
      html.push(`<h3>Lifestyle</h3><ul class="recommendation-list">`);
      for (const r of report.aiRecommendations.lifestyle) html.push(`<li>${this.escapeHtml(r)}</li>`);
      html.push(`</ul>`);
    }
    if (report.aiRecommendations.medicalFollowUp.length > 0) {
      html.push(`<h3>Medical Follow-up</h3><ul class="recommendation-list">`);
      for (const r of report.aiRecommendations.medicalFollowUp) html.push(`<li>${this.escapeHtml(r)}</li>`);
      html.push(`</ul>`);
    }
    if (report.aiRecommendations.preventive.length > 0) {
      html.push(`<h3>Preventive</h3><ul class="recommendation-list">`);
      for (const r of report.aiRecommendations.preventive) html.push(`<li>${this.escapeHtml(r)}</li>`);
      html.push(`</ul>`);
    }
    if (report.aiRecommendations.aiNarrative) {
      html.push(`<div class="ai-narrative"><h3>AI Narrative</h3><p>${this.escapeHtml(report.aiRecommendations.aiNarrative)}</p></div>`);
    }
    html.push(`</div>`);

    // Section 6: Predictive Warnings (premium only)
    if (report.isPremium && report.predictiveWarnings.length > 0) {
      html.push(`<div class="section"><h2>Predictive Warnings</h2>`);
      for (const w of report.predictiveWarnings) {
        html.push(`<div class="warning-box">${this.escapeHtml(w)}</div>`);
      }
      html.push(`</div>`);
    }

    // Footer
    html.push(`<div class="footer">`);
    html.push(`<p>This report is for reference only and is not a medical diagnosis. Consult a healthcare professional.</p>`);
    html.push(`<p>AI Health Journal &copy; ${new Date().getFullYear()}</p>`);
    html.push(`</div></body></html>`);

    return html.join("\n");
  }

  // ── Private: Check premium access ──
  // Currently based on user level >= 3 OR high point balance
  private async checkPremiumAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, totalPoints: true },
    });
    if (!user) return false;

    // Premium if level >= 3 or has 2000+ points
    return user.level >= 3 || Number(user.totalPoints) >= 2000;
  }

  // ── Private: Gather all report data ──
  private async gatherReportData(userId: string, days: number): Promise<ReportRawData> {
    const now = new Date();
    const periodFrom = new Date(now);
    periodFrom.setDate(periodFrom.getDate() - days);

    // Previous period for comparison (to detect resolved symptoms)
    const previousPeriodFrom = new Date(periodFrom);
    previousPeriodFrom.setDate(previousPeriodFrom.getDate() - days);

    const [user, entries, symptomLogs, previousSymptomLogs, medications] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { streakDays: true, totalPoints: true, level: true },
      }),
      prisma.healthEntry.findMany({
        where: { userId, entryDate: { gte: periodFrom } },
        select: { id: true, entryDate: true, detailScore: true, pointsEarned: true, createdAt: true },
        orderBy: { entryDate: "asc" },
      }),
      prisma.symptomLog.findMany({
        where: { entry: { userId }, onsetDate: { gte: periodFrom } },
        select: { displayName: true, severity: true, snomedCode: true, onsetDate: true, bodySite: true },
        orderBy: { onsetDate: "asc" },
      }),
      prisma.symptomLog.findMany({
        where: {
          entry: { userId },
          onsetDate: { gte: previousPeriodFrom, lt: periodFrom },
        },
        select: { displayName: true },
      }),
      prisma.medicationReminder.findMany({
        where: { userId },
        select: { medicationName: true, dosage: true, isActive: true, frequency: true, startDate: true, endDate: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const previousPeriodSymptomNames = new Set(previousSymptomLogs.map(s => s.displayName));

    return {
      user,
      entries,
      symptomLogs,
      previousPeriodSymptomNames,
      medications,
      periodDays: days,
      periodFrom,
      periodTo: now,
    };
  }

  // ── Build Section 1: Overview ──
  private buildOverview(data: ReportRawData): ReportOverview {
    const uniqueDatesLogged = new Set(
      data.entries.map(e => e.entryDate.toISOString().split("T")[0])
    );
    const complianceRate = data.periodDays > 0
      ? Math.round((uniqueDatesLogged.size / data.periodDays) * 100)
      : 0;

    return {
      totalEntries: data.entries.length,
      streakDays: data.user?.streakDays ?? 0,
      level: data.user?.level ?? 1,
      totalPoints: Number(data.user?.totalPoints ?? 0),
      complianceRate: Math.min(complianceRate, 100),
    };
  }

  // ── Build Section 2: Symptom Analysis ──
  private buildSymptomAnalysis(data: ReportRawData, isPremium: boolean, language: "ko" | "en"): ReportSymptomAnalysis {
    const maxSymptoms = isPremium ? 10 : 3;

    // Prepare symptom logs for pattern analyzer
    const logsForAnalyzer = data.symptomLogs.map(s => ({
      displayName: s.displayName,
      severity: s.severity,
      snomedCode: s.snomedCode,
      onsetDate: s.onsetDate.toISOString().split("T")[0],
    }));

    const trends = patternAnalyzer.analyzeTrends(logsForAnalyzer as any, data.periodDays);

    // Build top symptoms with trend direction
    const topSymptoms: TopSymptomEntry[] = trends.slice(0, maxSymptoms).map(t => ({
      name: t.displayName,
      count: t.occurrences,
      avgSeverity: t.avgSeverity,
      trend: this.computeTrendDirection(t, data.symptomLogs),
    }));

    // New symptoms: appeared this period but NOT in previous period
    const currentSymptomNames = new Set(data.symptomLogs.map(s => s.displayName));
    const newSymptoms = Array.from(currentSymptomNames).filter(
      name => !data.previousPeriodSymptomNames.has(name)
    );

    // Resolved symptoms: appeared in previous period but NOT this period
    const resolvedSymptoms = Array.from(data.previousPeriodSymptomNames).filter(
      name => !currentSymptomNames.has(name)
    );

    // Severity distribution
    const severityDistribution: SeverityDistribution = { mild: 0, moderate: 0, severe: 0, critical: 0 };
    for (const log of data.symptomLogs) {
      const sev = log.severity.toLowerCase() as keyof SeverityDistribution;
      if (sev in severityDistribution) {
        severityDistribution[sev]++;
      }
    }

    return { topSymptoms, newSymptoms, resolvedSymptoms, severityDistribution };
  }

  // ── Build Section 3: Pattern Insights ──
  private buildPatternInsights(data: ReportRawData, isPremium: boolean, language: "ko" | "en"): ReportPatternInsights {
    if (!isPremium) {
      // Free tier: limited patterns
      const logsForAnalyzer = data.symptomLogs.map(s => ({
        displayName: s.displayName,
        severity: s.severity,
        snomedCode: s.snomedCode,
        onsetDate: s.onsetDate.toISOString().split("T")[0],
      }));
      const trends = patternAnalyzer.analyzeTrends(logsForAnalyzer as any, data.periodDays);
      const recurringPatterns = patternAnalyzer.detectRecurringPatterns(trends).slice(0, 2);
      return {
        weekdayPatterns: [],
        seasonalFactors: [],
        correlations: [],
        recurringPatterns,
      };
    }

    const logsForAnalyzer = data.symptomLogs.map(s => ({
      displayName: s.displayName,
      severity: s.severity,
      snomedCode: s.snomedCode,
      onsetDate: s.onsetDate.toISOString().split("T")[0],
    }));

    const trends = patternAnalyzer.analyzeTrends(logsForAnalyzer as any, data.periodDays);
    const recurringPatterns = patternAnalyzer.detectRecurringPatterns(trends);
    const correlations = patternAnalyzer.detectCorrelations(trends, language);
    const predictiveWarnings = patternAnalyzer.generatePredictiveWarnings(trends, language);

    // Separate weekday patterns and seasonal factors from recurringPatterns
    const weekdayPatterns: string[] = [];
    const seasonalFactors: string[] = [];
    const otherPatterns: string[] = [];

    for (const pattern of recurringPatterns) {
      if (pattern.includes("weekday") || pattern.includes("weekend")) {
        weekdayPatterns.push(pattern);
      } else {
        otherPatterns.push(pattern);
      }
    }

    // Extract seasonal patterns from predictive warnings
    for (const w of predictiveWarnings) {
      if (w.includes("winter") || w.includes("Spring") || w.includes("allergy")) {
        seasonalFactors.push(w);
      }
    }

    return {
      weekdayPatterns,
      seasonalFactors,
      correlations: correlations.map(c => ({
        condition: c.condition,
        guidance: c.guidance,
        severity: c.severity,
        matchedSymptoms: c.matchedSymptoms,
      })),
      recurringPatterns: otherPatterns,
    };
  }

  // ── Build Section 4: Medication Review ──
  private buildMedicationReview(data: ReportRawData, isPremium: boolean, language: "ko" | "en"): ReportMedicationReview {
    if (!isPremium) {
      return { activeMedications: [], interactions: [], adherenceNotes: [] };
    }

    const activeMeds = data.medications.filter(m => m.isActive);
    const activeMedNames = activeMeds.map(m => m.medicationName);

    // Basic drug interaction checks (rule-based)
    const interactions: MedicationInteraction[] = this.checkDrugInteractions(activeMedNames, language);

    // Adherence notes
    const adherenceNotes: string[] = [];
    for (const med of activeMeds) {
      const freq = med.frequency as any;
      if (freq?.times && freq.times.length >= 3) {
        adherenceNotes.push(`${med.medicationName}: ${freq.times.length} doses per day required. Set reminders.`);
      }
      if (med.endDate) {
        const endDate = new Date(med.endDate);
        const now = new Date();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 7) {
          adherenceNotes.push(`${med.medicationName}: ${daysLeft} days remaining until end date.`);
        } else if (daysLeft <= 0) {
          adherenceNotes.push(`${med.medicationName}: Course has ended. Consult your doctor.`);
        }
      }
    }

    return { activeMedications: activeMedNames, interactions, adherenceNotes };
  }

  // ── Build Section 5: AI Recommendations ──
  private async buildAIRecommendations(
    data: ReportRawData,
    symptomAnalysis: ReportSymptomAnalysis,
    patternInsights: ReportPatternInsights,
    predictiveWarnings: string[],
    isPremium: boolean,
    includeAI: boolean,
    language: "ko" | "en",
  ): Promise<ReportAIRecommendations> {
    const lifestyle: string[] = [];
    const medicalFollowUp: string[] = [];
    const preventive: string[] = [];

    // Rule-based recommendations from symptom data
    const hasHighSeverity = symptomAnalysis.topSymptoms.some(s => s.avgSeverity > 2.5);
    const hasWorseningTrend = symptomAnalysis.topSymptoms.some(s => s.trend === "worsening");
    const lowCompliance = data.entries.length < data.periodDays * 0.3;

    // Lifestyle recommendations
    if (lowCompliance) {
      lifestyle.push("Maintain your health logging habit. Daily entries enable more accurate analysis.");
    }

    // Check for stress/mental-health related symptoms
    const stressSymptoms = ["insomnia", "fatigue", "headache"];
    const hasStressIndicators = symptomAnalysis.topSymptoms.some(s =>
      stressSymptoms.some(ss => s.name.toLowerCase().includes(ss))
    );
    if (hasStressIndicators) {
      lifestyle.push("Stress-related symptoms observed. Regular sleep, light exercise, and meditation recommended.");
    }

    // General lifestyle based on severity
    if (hasHighSeverity) {
      lifestyle.push("High-severity symptoms present. Get adequate rest and visit a specialist if symptoms persist.");
    }

    // Medical follow-up recommendations
    if (hasWorseningTrend) {
      medicalFollowUp.push("Worsening symptoms detected. Visit a healthcare provider as soon as possible.");
    }
    if (symptomAnalysis.topSymptoms.length >= 5) {
      medicalFollowUp.push("Multiple symptoms reported. Consider a comprehensive health checkup.");
    }

    // For correlations found
    for (const corr of patternInsights.correlations) {
      if (corr.severity === "urgent") {
        medicalFollowUp.push(`Urgent: ${corr.condition} — Seek immediate medical attention.`);
      } else if (corr.severity === "warning") {
        medicalFollowUp.push(`Warning: ${corr.condition} — Specialist consultation recommended.`);
      }
    }

    // Preventive recommendations
    if (symptomAnalysis.newSymptoms.length > 0) {
      preventive.push(`New symptoms appeared (${symptomAnalysis.newSymptoms.slice(0, 3).join(", ")}). Monitor their progression carefully.`);
    }
    if (data.medications.filter(m => m.isActive).length > 0) {
      preventive.push("Get regular blood tests while on medication.");
    }

    // Seasonal preventive advice
    const month = new Date().getMonth();
    if (month >= 10 || month <= 1) {
      preventive.push("Winter season. Remember to get your flu shot and ventilate indoor spaces.");
    } else if (month >= 2 && month <= 4) {
      preventive.push("Spring season. Watch for pollen allergies and wear a mask outdoors.");
    }

    // AI narrative (GPT-5-mini)
    let aiNarrative = "";
    if (isPremium && includeAI) {
      const narrative = await this.generateAINarrative(
        { symptomAnalysis, patternInsights, predictiveWarnings, overview: this.buildOverview(data) },
        language,
      );
      if (narrative) {
        aiNarrative = narrative;
      }
    }

    // Provide at least one lifestyle recommendation
    if (lifestyle.length === 0) {
      lifestyle.push("You're maintaining your health logs consistently. Keep up the current lifestyle pattern!");
    }

    return { lifestyle, medicalFollowUp, preventive, aiNarrative };
  }

  // ── Build Section 6: Predictive Warnings ──
  private buildPredictiveWarnings(data: ReportRawData, isPremium: boolean, language: "ko" | "en"): string[] {
    if (!isPremium) return [];

    const logsForAnalyzer = data.symptomLogs.map(s => ({
      displayName: s.displayName,
      severity: s.severity,
      snomedCode: s.snomedCode,
      onsetDate: s.onsetDate.toISOString().split("T")[0],
    }));

    const trends = patternAnalyzer.analyzeTrends(logsForAnalyzer as any, data.periodDays);
    return patternAnalyzer.generatePredictiveWarnings(trends, language);
  }

  // ── Private: Generate AI Narrative via GPT-5-mini ──
  private async generateAINarrative(
    data: {
      symptomAnalysis: ReportSymptomAnalysis;
      patternInsights: ReportPatternInsights;
      predictiveWarnings: string[];
      overview: ReportOverview;
    },
    language: "ko" | "en",
  ): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const reportSummary = {
      totalEntries: data.overview.totalEntries,
      streakDays: data.overview.streakDays,
      complianceRate: data.overview.complianceRate,
      topSymptoms: data.symptomAnalysis.topSymptoms.map(s => ({
        name: s.name,
        count: s.count,
        avgSeverity: s.avgSeverity,
        trend: s.trend,
      })),
      newSymptoms: data.symptomAnalysis.newSymptoms,
      resolvedSymptoms: data.symptomAnalysis.resolvedSymptoms,
      correlations: data.patternInsights.correlations.map(c => c.condition),
      warnings: data.predictiveWarnings,
    };

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: `You are a personal health analysis AI assistant. Based on the user's health report data, write a 5-7 sentence personalized health analysis narrative.
Rules:
- Do not provide medical diagnoses
- Include encouragement and practical advice
- Provide specific data-driven insights
- If worsening trends exist, recommend visiting a healthcare provider
- Write in a warm, natural tone`,
            },
            {
              role: "user",
              content: JSON.stringify(reportSummary),
            },
          ],
        }),
      });

      if (!res.ok) {
        console.error("GPT narrative request failed:", res.status);
        return null;
      }
      const body = await res.json() as any;
      return body.choices?.[0]?.message?.content || null;
    } catch (err) {
      console.error("GPT narrative error:", err);
      return null;
    }
  }

  // ── Private: Compute trend direction for a symptom ──
  private computeTrendDirection(
    trend: SymptomTrend,
    rawLogs: { displayName: string; severity: string; onsetDate: Date }[],
  ): SymptomTrendDirection {
    // Get all severity values for this symptom, sorted by date
    const relevantLogs = rawLogs
      .filter(l => l.displayName === trend.displayName)
      .sort((a, b) => a.onsetDate.getTime() - b.onsetDate.getTime());

    if (relevantLogs.length < 3) return "stable";

    const severityMap: Record<string, number> = { mild: 1, moderate: 2, severe: 3, critical: 4 };
    const severities = relevantLogs.map(l => severityMap[l.severity.toLowerCase()] ?? 2);

    // Compare first half average to second half average
    const mid = Math.floor(severities.length / 2);
    const firstHalf = severities.slice(0, mid);
    const secondHalf = severities.slice(mid);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;
    if (diff > 0.3) return "worsening";
    if (diff < -0.3) return "improving";
    return "stable";
  }

  // ── Private: Basic drug interaction checker ──
  private checkDrugInteractions(medications: string[], language: "ko" | "en"): MedicationInteraction[] {
    const interactions: MedicationInteraction[] = [];
    const medLower = medications.map(m => m.toLowerCase());

    // Common interaction rules (simplified)
    const INTERACTION_RULES: Array<{
      drugs: string[][];  // groups of drug name patterns
      severity: string;
      descEn: string;
    }> = [
      {
        drugs: [["aspirin"], ["warfarin", "coumadin"]],
        severity: "warning",
        descEn: "Taking aspirin and warfarin together increases bleeding risk.",
      },
      {
        drugs: [["ibuprofen", "advil", "brufen"], ["aspirin"]],
        severity: "info",
        descEn: "Ibuprofen may reduce the cardiovascular protective effect of aspirin.",
      },
      {
        drugs: [["ssri", "fluoxetine", "sertraline"], ["maoi", "phenelzine"]],
        severity: "urgent",
        descEn: "Taking SSRIs and MAOIs together risks serotonin syndrome. Consult your doctor immediately.",
      },
      {
        drugs: [["metformin"], ["alcohol"]],
        severity: "warning",
        descEn: "Alcohol consumption while on metformin increases the risk of lactic acidosis.",
      },
      {
        drugs: [["statin", "atorvastatin", "rosuvastatin"], ["grapefruit"]],
        severity: "info",
        descEn: "Grapefruit may increase side effects of statin medications.",
      },
    ];

    for (const rule of INTERACTION_RULES) {
      const matchedDrugs: string[] = [];
      let allGroupsMatched = true;

      for (const group of rule.drugs) {
        const matchedDrug = medLower.find(m =>
          group.some(pattern => m.includes(pattern))
        );
        if (matchedDrug) {
          const originalName = medications[medLower.indexOf(matchedDrug)];
          matchedDrugs.push(originalName);
        } else {
          allGroupsMatched = false;
          break;
        }
      }

      if (allGroupsMatched && matchedDrugs.length >= 2) {
        interactions.push({
          drugs: matchedDrugs,
          severity: rule.severity,
          description: rule.descEn,
        });
      }
    }

    return interactions;
  }

  // ── Utility: HTML escape ──
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

export const reportGenerator = new ReportGenerator();
