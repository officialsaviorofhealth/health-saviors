/**
 * Message Formatting Utilities
 *
 * All formatters produce Telegram MarkdownV2 or HTML formatted strings.
 * We use HTML parse mode for reliability (fewer escaping issues than MarkdownV2).
 */

import { InlineKeyboard } from "grammy";
import type { ChatResponse, AnalyticsDashboard, QuizResponse } from "../api-client";
import type { Language } from "../config";

// ── Severity helpers ───────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  mild: "\u{1F7E2}",       // green circle
  moderate: "\u{1F7E1}",   // yellow circle
  severe: "\u{1F7E0}",     // orange circle
  critical: "\u{1F534}",   // red circle
};

const SEVERITY_LABEL: Record<string, { ko: string; en: string }> = {
  mild: { ko: "Mild", en: "Mild" },
  moderate: { ko: "Moderate", en: "Moderate" },
  severe: { ko: "Severe", en: "Severe" },
  critical: { ko: "Critical", en: "Critical" },
};

function getSeverityEmoji(severity?: string): string {
  return SEVERITY_EMOJI[severity || "moderate"] || "\u{1F7E1}";
}

function getSeverityLabel(severity: string | undefined, lang: Language): string {
  const s = severity || "moderate";
  const labels = SEVERITY_LABEL[s] || SEVERITY_LABEL["moderate"];
  return lang === "ko" ? labels.ko : labels.en;
}

// ── HTML escape ────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── MarkdownV2 escape (for when needed) ────────────────────────

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// ── Format Chat / Symptom Report ───────────────────────────────

export function formatSymptomReport(
  data: NonNullable<ChatResponse["data"]>,
  lang: Language = "ko",
): string {
  const lines: string[] = [];
  const { aiResult, rewardEarned, currentStreak } = data;

  // Header
  lines.push("<b>\u{1F3E5} AI Health Analysis</b>");
  lines.push("");

  // AI Education Response
  if (aiResult.educationResponse) {
    lines.push(escapeHtml(aiResult.educationResponse));
    lines.push("");
  }

  // Detected symptoms
  if (aiResult.symptoms.length > 0) {
    lines.push("<b>\u{1FA7A} Detected Symptoms:</b>");
    for (const s of aiResult.symptoms) {
      const emoji = getSeverityEmoji(s.severity);
      const label = getSeverityLabel(s.severity, lang);
      const name = escapeHtml(s.name);
      const code = s.snomedCode ? ` <code>[${s.snomedCode}]</code>` : "";
      lines.push(`  ${emoji} ${name} (${label})${code}`);
    }
    lines.push("");
  }

  // Medication warnings
  if (aiResult.medicationWarnings && aiResult.medicationWarnings.length > 0) {
    lines.push("<b>\u{1F6A8} Medication Warnings:</b>");
    for (const w of aiResult.medicationWarnings) {
      lines.push(`  ⚠️ ${escapeHtml(w)}`);
    }
    lines.push("");
  }

  // Safety alert
  if (aiResult.safetyAlert) {
    lines.push(`\u{1F6D1} <b>Safety Alert</b>`);
    lines.push(`  ${escapeHtml(aiResult.safetyAlert)}`);
    lines.push("");
  }

  // Pattern insights
  if (aiResult.patternInsights && aiResult.patternInsights.length > 0) {
    lines.push("<b>\u{1F4CA} Pattern Insights:</b>");
    for (const p of aiResult.patternInsights) {
      lines.push(`  \u{1F4A1} ${escapeHtml(p)}`);
    }
    lines.push("");
  }

  // Urgency level
  const urgencyEmoji =
    aiResult.urgencyLevel === "emergency"
      ? "\u{1F534}"
      : aiResult.urgencyLevel === "urgent"
        ? "\u{1F7E0}"
        : "\u{1F7E2}";
  lines.push(
    `${urgencyEmoji} Urgency: <b>${escapeHtml(aiResult.urgencyLevel)}</b>`,
  );

  // Detail score
  lines.push(`\u{1F4DD} Detail Score: <b>${aiResult.detailScore}/10</b>`);
  lines.push("");

  // Reward section
  lines.push("────────────────────");
  lines.push(`\u{1F4B0} <b>+${rewardEarned} H2E</b> points earned!`);
  lines.push(`\u{1F525} Streak: <b>${currentStreak}</b> days`);

  return lines.join("\n");
}

// ── Format Quiz Question ───────────────────────────────────────

export function formatQuizQuestion(
  quiz: NonNullable<QuizResponse["data"]>,
  lang: Language = "ko",
): { text: string; keyboard: InlineKeyboard } {
  const lines: string[] = [];

  lines.push("<b>\u{1F9E0} Daily Health Quiz</b>");
  lines.push("");

  // Show question in user's language
  const questionText = lang === "ko" && quiz.questionKo ? quiz.questionKo : quiz.question;
  lines.push(escapeHtml(questionText));
  lines.push("");

  // Difficulty badge
  const diffEmoji =
    quiz.difficulty === "hard" ? "\u{1F534}" : quiz.difficulty === "medium" ? "\u{1F7E1}" : "\u{1F7E2}";
  lines.push(`${diffEmoji} Difficulty: ${escapeHtml(quiz.difficulty)}`);
  lines.push(`\u{1F4B0} Reward: <b>${quiz.rewardAmount} H2E</b>`);

  // Build inline keyboard with options
  const labels = ["A", "B", "C", "D"];
  const keyboard = new InlineKeyboard();

  const options = quiz.options as string[];
  options.forEach((option: string, idx: number) => {
    keyboard.text(`${labels[idx]}. ${option}`, `quiz:${quiz.id}:${idx}`);
    if (idx < options.length - 1) {
      keyboard.row();
    }
  });

  return { text: lines.join("\n"), keyboard };
}

// ── Format Quiz Result ─────────────────────────────────────────

export function formatQuizResult(
  result: NonNullable<import("../api-client").QuizSubmitResponse["data"]>,
  selectedIndex: number,
  lang: Language = "ko",
): string {
  const lines: string[] = [];

  if (result.correct) {
    lines.push("✅ <b>Correct!</b>");
    lines.push(`\u{1F4B0} <b>+${result.rewardEarned} H2E</b> points earned!`);
  } else {
    const labels = ["A", "B", "C", "D"];
    lines.push(
      `❌ <b>Wrong!</b> The correct answer was <b>${labels[result.correctIndex]}</b>.`,
    );
  }

  lines.push("");

  // Explanation
  const explanation =
    lang === "ko" && result.explanationKo ? result.explanationKo : result.explanation;
  if (explanation) {
    lines.push("<b>\u{1F4DA} Explanation:</b>");
    lines.push(escapeHtml(explanation));
  }

  return lines.join("\n");
}

// ── Format Analytics Dashboard ─────────────────────────────────

export function formatAnalytics(
  data: NonNullable<AnalyticsDashboard["data"]>,
  lang: Language = "ko",
): string {
  const lines: string[] = [];

  lines.push("<b>\u{1F4CA} Health Report</b>");
  lines.push("");

  // Level & streak section
  const levelTitle = lang === "ko" ? data.level.titleKo : data.level.title;
  lines.push(`\u{1F451} Level: <b>Lv.${data.level.current} ${escapeHtml(levelTitle)}</b>`);
  lines.push(
    `\u{1F525} Streak: <b>${data.streak.current}</b> days (x${data.streak.multiplier / 100} bonus)`,
  );
  lines.push("");

  // Points section
  lines.push("<b>\u{1F4B0} H2E Points</b>");
  lines.push(`  Total: <b>${data.points.total}</b>`);
  lines.push(`  This week: <b>${data.points.thisWeek}</b>`);
  lines.push(`  This month: <b>${data.points.thisMonth}</b>`);
  lines.push("");

  // Entry counts
  lines.push("<b>\u{1F4DD} Entry Stats</b>");
  lines.push(`  This week: <b>${data.entries.thisWeek}</b> entries`);
  lines.push(`  This month: <b>${data.entries.thisMonth}</b> entries`);
  lines.push(`  Total: <b>${data.entries.total}</b> entries`);
  lines.push("");

  // Recent symptoms
  if (data.recentSymptoms && data.recentSymptoms.length > 0) {
    lines.push("<b>\u{1FA7A} Recent Symptoms</b>");

    // Count occurrences for a top-symptoms view
    const symptomCounts = new Map<string, { count: number; severity: string }>();
    for (const s of data.recentSymptoms) {
      const existing = symptomCounts.get(s.displayName);
      if (existing) {
        existing.count++;
      } else {
        symptomCounts.set(s.displayName, { count: 1, severity: s.severity });
      }
    }

    const sorted = Array.from(symptomCounts.entries()).sort((a, b) => b[1].count - a[1].count);
    for (const [name, info] of sorted.slice(0, 5)) {
      const emoji = getSeverityEmoji(info.severity);
      lines.push(`  ${emoji} ${escapeHtml(name)} (x${info.count})`);
    }
    lines.push("");
  }

  // Progress bar
  const progressBar = generateProgressBar(data.level.progress, 10);
  lines.push(`Next level: ${progressBar} ${data.level.progress}%`);

  return lines.join("\n");
}

// ── Progress bar generator ─────────────────────────────────────

function generateProgressBar(percent: number, length: number): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

// ── Format daily tip ───────────────────────────────────────────

export function formatDailyTip(
  tip: { title: string; titleKo: string; content: string; contentKo: string; category: string; rewardH2E: number },
  lang: Language = "ko",
): string {
  const lines: string[] = [];

  lines.push("<b>\u{1F4A1} Daily Health Tip</b>");
  lines.push("");

  const title = lang === "ko" ? tip.titleKo : tip.title;
  const content = lang === "ko" ? tip.contentKo : tip.content;

  lines.push(`<b>${escapeHtml(title)}</b>`);
  lines.push(escapeHtml(content));
  lines.push("");
  lines.push(`\u{1F4B0} +${tip.rewardH2E} H2E`);

  return lines.join("\n");
}

// ── Format error message ───────────────────────────────────────

export function formatError(
  error: { code: string; message: string } | undefined,
  lang: Language = "ko",
): string {
  if (!error) {
    return "❌ An unknown error occurred.";
  }

  const messages: Record<string, { ko: string; en: string }> = {
    API_UNREACHABLE: {
      ko: "❌ Cannot reach the server. Please try again later.",
      en: "❌ Cannot reach the server. Please try again later.",
    },
    ABUSE_DETECTED: {
      ko: "⚠️ Suspicious activity detected.",
      en: "⚠️ Suspicious activity detected.",
    },
    INVALID_INPUT: {
      ko: "❌ Invalid input. Please try again.",
      en: "❌ Invalid input. Please try again.",
    },
    UNAUTHORIZED: {
      ko: "❌ Authentication required. Please type /start.",
      en: "❌ Authentication required. Please type /start.",
    },
  };

  const msg = messages[error.code];
  if (msg) {
    return lang === "ko" ? msg.ko : msg.en;
  }

  return `❌ Error: ${escapeHtml(error.message)}`;
}

// ── Typing indicator helper ────────────────────────────────────

export function truncateMessage(text: string, maxLength: number = 4096): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 20) + "\n\n... (truncated)";
}
