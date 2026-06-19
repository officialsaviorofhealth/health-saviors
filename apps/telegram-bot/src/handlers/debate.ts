/**
 * Agent Debate Handler
 *
 * /debate command — lets users watch AI agents discuss their health data
 * in a cinematic panel-discussion format. Agents analyze wearable data,
 * symptoms, and health patterns, then reach a consensus.
 */

import { type Bot, InlineKeyboard } from "grammy";
import {
  startDebate,
  getDebateHistory,
  getDebateDetail,
  getAnalytics,
  type DebateResult,
} from "../api-client";
import { getUserLanguage, getUserTelegramId } from "../middleware/auth";
import { escapeHtml, formatError } from "../utils/formatters";
import type { Language } from "../config";

// ── Conversation state for debate flow ──────────────────────────

const debateState = new Map<string, "awaiting_topic">();

export function registerDebateHandler(bot: Bot): void {
  // /debate command — show debate menu
  bot.command("debate", async (ctx) => {
    const lang = getUserLanguage(ctx);
    await showDebateMenu(ctx, lang);
  });

  // ── Callback query handlers ─────────────────────────────────

  // Start new discussion
  bot.callbackQuery("debate:new", async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);

    await ctx.answerCallbackQuery();

    // Set state to await topic input
    debateState.set(telegramId, "awaiting_topic");

    const text =
      lang === "ko"
        ? [
            "<b>🔬 Start New Discussion</b>",
            "",
            "What would you like the agents to discuss?",
            "",
            "💬 Send your symptoms or health concern.",
            'e.g. "I have been sleeping poorly and getting frequent headaches"',
            "",
            "Or type <b>auto</b> to use your recent",
            "health data automatically.",
          ].join("\n")
        : [
            "<b>🔬 Start New Discussion</b>",
            "",
            "What would you like the agents to discuss?",
            "",
            "💬 Send your symptoms or health concern.",
            'e.g. "I have been sleeping poorly and getting frequent headaches"',
            "",
            "Or type <b>auto</b> to use your recent",
            "health data automatically.",
          ].join("\n");

    await ctx.reply(text, { parse_mode: "HTML" });
  });

  // View recent discussions
  bot.callbackQuery("debate:history", async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);

    await ctx.answerCallbackQuery(
      lang === "ko" ? "Loading history..." : "Loading history...",
    );

    await handleDebateHistory(ctx, telegramId, lang);
  });

  // What is this?
  bot.callbackQuery("debate:info", async (ctx) => {
    const lang = getUserLanguage(ctx);
    await ctx.answerCallbackQuery();

    const text =
      lang === "ko"
        ? [
            "<b>❓ What is Agent Debate?</b>",
            "",
            "Multiple AI health expert agents analyze",
            "and discuss your health data together.",
            "",
            "<b>🏃 COACH</b> — Exercise/Activity expert",
            "<b>🥗 NUTRITION</b> — Nutrition expert",
            "<b>😴 SLEEP</b> — Sleep expert",
            "<b>🧠 MENTAL</b> — Mental health expert",
            "<b>⚖️ MODERATOR</b> — Discussion moderator",
            "",
            "Agents react to each other's opinions,",
            "analyze from different perspectives,",
            "and reach a final consensus.",
            "",
            "💡 You earn H2E points for each debate!",
            "",
            "Type /debate again to start.",
          ].join("\n")
        : [
            "<b>❓ What is Agent Debate?</b>",
            "",
            "Multiple AI health expert agents analyze",
            "and discuss your health data together.",
            "",
            "<b>🏃 COACH</b> — Exercise/Activity expert",
            "<b>🥗 NUTRITION</b> — Nutrition expert",
            "<b>😴 SLEEP</b> — Sleep expert",
            "<b>🧠 MENTAL</b> — Mental health expert",
            "<b>⚖️ MODERATOR</b> — Discussion moderator",
            "",
            "Agents react to each other's opinions,",
            "analyze from different perspectives,",
            "and reach a final consensus.",
            "",
            "💡 You earn H2E points for each debate!",
            "",
            "Type /debate again to start.",
          ].join("\n");

    await ctx.reply(text, { parse_mode: "HTML" });
  });

  // View specific debate detail (format: debate:view:{debateId})
  bot.callbackQuery(/^debate:view:(.+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);
    const match = ctx.match as RegExpMatchArray;
    const debateId = match[1];

    await ctx.answerCallbackQuery(
      lang === "ko" ? "Loading debate..." : "Loading debate...",
    );

    try {
      const result = await getDebateDetail(telegramId, debateId);

      if (!result.success || !result.data) {
        await ctx.reply(formatError(result.error, lang), { parse_mode: "HTML" });
        return;
      }

      await sendDebateMessages(ctx, result.data, lang);
    } catch (error) {
      console.error("[debate] Error fetching debate detail:", error);
      await ctx.reply(
        lang === "ko"
          ? "❌ Error loading debate details."
          : "❌ Error loading debate details.",
      );
    }
  });

  // ── Text handler for debate topic input ─────────────────────
  // This must be registered as a specific handler that checks state,
  // NOT as a catch-all. We use hears with a filter.
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;

    // Skip commands
    if (text.startsWith("/")) return next();

    const telegramId = getUserTelegramId(ctx);
    const state = debateState.get(telegramId);

    // Only handle if user is in debate flow
    if (state !== "awaiting_topic") return next();

    // Clear state
    debateState.delete(telegramId);

    const lang = getUserLanguage(ctx);

    await ctx.replyWithChatAction("typing");

    try {
      let context = text;

      // If user typed 'auto', fetch recent health data
      if (text.toLowerCase().trim() === "auto") {
        const analytics = await getAnalytics(telegramId, lang);

        if (analytics.success && analytics.data) {
          const parts: string[] = [];

          if (analytics.data.recentSymptoms && analytics.data.recentSymptoms.length > 0) {
            const symptoms = analytics.data.recentSymptoms
              .map((s) => `${s.displayName} (${s.severity})`)
              .join(", ");
            parts.push(`Recent symptoms: ${symptoms}`);
          }

          parts.push(`Streak: ${analytics.data.streak.current} days`);
          parts.push(`Entries this week: ${analytics.data.entries.thisWeek}`);

          context = parts.length > 0
            ? parts.join(". ")
            : lang === "ko"
              ? "General health status analysis"
              : "General health status analysis";
        } else {
          context = lang === "ko"
            ? "General health status analysis"
            : "General health status analysis";
        }
      }

      // Show "starting debate" message
      const startMsg =
        lang === "ko"
          ? [
              "🏥 <b>Preparing AI Health Panel Discussion...</b>",
              "",
              "⏳ Agents are analyzing your data.",
              "Please wait a moment.",
            ].join("\n")
          : [
              "🏥 <b>Preparing AI Health Panel Discussion...</b>",
              "",
              "⏳ Agents are analyzing your data.",
              "Please wait a moment.",
            ].join("\n");

      await ctx.reply(startMsg, { parse_mode: "HTML" });

      // Call the debate API
      const result = await startDebate(telegramId, context, lang);

      if (!result.success || !result.data) {
        await ctx.reply(formatError(result.error, lang), { parse_mode: "HTML" });
        return;
      }

      // Send the debate in cinematic format
      await sendDebateMessages(ctx, result.data, lang);
    } catch (error) {
      console.error("[debate] Error starting debate:", error);
      await ctx.reply(
        lang === "ko"
          ? "❌ Error starting the debate. Please try again later."
          : "❌ Error starting the debate. Please try again later.",
      );
    }
  });
}

// ── Show main debate menu ───────────────────────────────────────

async function showDebateMenu(ctx: any, lang: Language): Promise<void> {
  const keyboard = new InlineKeyboard();

  if (lang === "ko") {
    keyboard
      .text("🔬 Start New Discussion", "debate:new")
      .row()
      .text("📋 My Recent Discussions", "debate:history")
      .row()
      .text("❓ What is this?", "debate:info");
  } else {
    keyboard
      .text("🔬 Start New Discussion", "debate:new")
      .row()
      .text("📋 My Recent Discussions", "debate:history")
      .row()
      .text("❓ What is this?", "debate:info");
  }

  const text =
    lang === "ko"
      ? [
          "🏥 <b>AI Agent Health Debate</b>",
          "",
          "Watch multiple AI health experts analyze",
          "and discuss your health data!",
          "",
          "Choose an option below:",
        ].join("\n")
      : [
          "🏥 <b>AI Agent Health Debate</b>",
          "",
          "Watch multiple AI health experts analyze",
          "and discuss your health data!",
          "",
          "Choose an option below:",
        ].join("\n");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

// ── Handle debate history ───────────────────────────────────────

async function handleDebateHistory(
  ctx: any,
  telegramId: string,
  lang: Language,
): Promise<void> {
  try {
    const result = await getDebateHistory(telegramId, 5);

    if (!result.success || !result.data) {
      await ctx.reply(formatError(result.error, lang), { parse_mode: "HTML" });
      return;
    }

    if (result.data.length === 0) {
      const text =
        lang === "ko"
          ? [
              "📋 <b>Discussion History</b>",
              "",
              "No discussions yet.",
              "",
              "Type /debate and select 'Start New Discussion'",
              "to begin your first debate!",
            ].join("\n")
          : [
              "📋 <b>Discussion History</b>",
              "",
              "No discussions yet.",
              "",
              "Type /debate and select 'Start New Discussion'",
              "to begin your first debate!",
            ].join("\n");

      await ctx.reply(text, { parse_mode: "HTML" });
      return;
    }

    const keyboard = new InlineKeyboard();

    for (const debate of result.data) {
      const topic = lang === "ko" && debate.topicKo ? debate.topicKo : debate.topic;
      const date = new Date(debate.createdAt).toLocaleDateString(
        lang === "ko" ? "ko-KR" : "en-US",
        { month: "short", day: "numeric" },
      );
      const label = `${date} — ${truncateText(topic, 30)}`;
      keyboard.text(label, `debate:view:${debate.id}`).row();
    }

    const text =
      lang === "ko"
        ? "<b>📋 Recent Discussions</b>\n\nSelect a discussion to view the full debate:"
        : "<b>📋 Recent Discussions</b>\n\nSelect a discussion to view the full debate:";

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("[debate] Error fetching history:", error);
    await ctx.reply(
      lang === "ko"
        ? "❌ Error loading debate history."
        : "❌ Error loading debate history.",
    );
  }
}

// ── Send debate in cinematic multi-message format ───────────────

async function sendDebateMessages(
  ctx: any,
  debate: DebateResult,
  lang: Language,
): Promise<void> {
  const messages = formatDebateMessages(debate, lang);

  for (let i = 0; i < messages.length; i++) {
    await ctx.reply(messages[i], { parse_mode: "HTML" });

    // Add delay between messages for cinematic effect (except after last)
    if (i < messages.length - 1) {
      await sleep(1500);
      await ctx.replyWithChatAction("typing");
      await sleep(500);
    }
  }
}

// ── Format debate into multiple messages (respecting 4096 limit) ─

function formatDebateMessages(debate: DebateResult, lang: Language): string[] {
  const messages: string[] = [];

  // ── Message 1: Header + Health Data + Round 1 ─────────────
  const msg1Lines: string[] = [];

  msg1Lines.push(
    lang === "ko"
      ? "🏥 <b>AI Health Panel Discussion</b>"
      : "🏥 <b>AI Health Panel Discussion</b>",
  );
  msg1Lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
  msg1Lines.push("");

  // Health data section (if available)
  if (debate.healthData) {
    msg1Lines.push(
      lang === "ko"
        ? "📊 <b>Your Health Data:</b>"
        : "📊 <b>Your Health Data:</b>",
    );

    if (debate.healthData.heartRate) {
      const hr = debate.healthData.heartRate;
      msg1Lines.push(
        lang === "ko"
          ? `❤️ HR: ${hr.avg} avg (${hr.resting} resting)`
          : `❤️ HR: ${hr.avg} avg (${hr.resting} resting)`,
      );
    }

    if (debate.healthData.sleep) {
      const sl = debate.healthData.sleep;
      msg1Lines.push(
        lang === "ko"
          ? `😴 Sleep: ${sl.hours}h (${sl.deepHours}h deep)`
          : `😴 Sleep: ${sl.hours}h (${sl.deepHours}h deep)`,
      );
    }

    if (debate.healthData.steps) {
      msg1Lines.push(
        lang === "ko"
          ? `🦶 Steps: ${debate.healthData.steps.toLocaleString()} today`
          : `🦶 Steps: ${debate.healthData.steps.toLocaleString()} today`,
      );
    }

    msg1Lines.push("");
  }

  // Round 1
  if (debate.rounds.length > 0) {
    const round1 = debate.rounds[0];
    const roundTitle = lang === "ko" && round1.titleKo ? round1.titleKo : round1.title;
    msg1Lines.push(`━━ ${lang === "ko" ? `Round ${round1.round}` : `Round ${round1.round}`}: ${escapeHtml(roundTitle)} ━━`);
    msg1Lines.push("");

    for (const agent of round1.agents) {
      const name = lang === "ko" && agent.nameKo ? agent.nameKo : agent.name;
      const message = lang === "ko" && agent.messageKo ? agent.messageKo : agent.message;
      const confidence = Math.round(agent.confidence * 100);

      msg1Lines.push(`${agent.emoji} <b>${escapeHtml(name)}</b> (${confidence}%)`);
      msg1Lines.push(escapeHtml(message));
      msg1Lines.push("");
    }
  }

  messages.push(truncateToLimit(msg1Lines.join("\n")));

  // ── Message 2: Rounds 2+ ──────────────────────────────────
  if (debate.rounds.length > 1) {
    const msg2Lines: string[] = [];

    for (let i = 1; i < debate.rounds.length; i++) {
      const round = debate.rounds[i];
      const roundTitle = lang === "ko" && round.titleKo ? round.titleKo : round.title;
      msg2Lines.push(`━━ ${lang === "ko" ? `Round ${round.round}` : `Round ${round.round}`}: ${escapeHtml(roundTitle)} ━━`);
      msg2Lines.push("");

      for (const agent of round.agents) {
        const name = lang === "ko" && agent.nameKo ? agent.nameKo : agent.name;
        const message = lang === "ko" && agent.messageKo ? agent.messageKo : agent.message;

        // Show reply-to connection if agent is responding to another
        if (agent.replyTo) {
          msg2Lines.push(`${agent.emoji} <b>${escapeHtml(name)}</b> → ${escapeHtml(agent.replyTo)}`);
        } else {
          const confidence = Math.round(agent.confidence * 100);
          msg2Lines.push(`${agent.emoji} <b>${escapeHtml(name)}</b> (${confidence}%)`);
        }

        msg2Lines.push(escapeHtml(message));
        msg2Lines.push("");
      }
    }

    // Split into multiple messages if too long
    const msg2Text = msg2Lines.join("\n");
    if (msg2Text.length > 4000) {
      const chunks = splitTextIntoChunks(msg2Text, 4000);
      for (const chunk of chunks) {
        messages.push(chunk);
      }
    } else {
      messages.push(msg2Text);
    }
  }

  // ── Final Message: Consensus + Key Insights + Points ──────
  const msgFinalLines: string[] = [];

  // Consensus
  const consensusSummary =
    lang === "ko" && debate.consensus.summaryKo
      ? debate.consensus.summaryKo
      : debate.consensus.summary;

  msgFinalLines.push(
    lang === "ko"
      ? "━━ Final Consensus ━━"
      : "━━ Final Consensus ━━",
  );
  msgFinalLines.push("");
  msgFinalLines.push(`⚖️ <b>${lang === "ko" ? "MODERATOR" : "MODERATOR"}</b>`);
  msgFinalLines.push(escapeHtml(consensusSummary));
  msgFinalLines.push("");

  // Key insights
  if (debate.keyInsights && debate.keyInsights.length > 0) {
    msgFinalLines.push(
      lang === "ko"
        ? "💡 <b>Key Insights:</b>"
        : "💡 <b>Key Insights:</b>",
    );

    for (let i = 0; i < debate.keyInsights.length; i++) {
      const insight = debate.keyInsights[i];
      const text = lang === "ko" && insight.textKo ? insight.textKo : insight.text;
      msgFinalLines.push(`${i + 1}. ${escapeHtml(text)}`);
    }
    msgFinalLines.push("");
  }

  // Points earned
  msgFinalLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
  msgFinalLines.push(
    lang === "ko"
      ? `🎯 <b>+${debate.rewardEarned} H2E points earned!</b>`
      : `🎯 <b>+${debate.rewardEarned} H2E points earned!</b>`,
  );

  messages.push(truncateToLimit(msgFinalLines.join("\n")));

  return messages;
}

// ── Utility helpers ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function truncateToLimit(text: string, limit: number = 4096): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 20) + "\n\n... (continued)";
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength && current.length > 0) {
      chunks.push(current.trimEnd());
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }

  if (current.trim()) {
    chunks.push(current.trimEnd());
  }

  return chunks;
}
