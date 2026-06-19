/**
 * Health Report Handler
 *
 * /report command — fetches analytics dashboard from the API
 * and formats it as a comprehensive health summary.
 */

import type { Bot } from "grammy";
import { getAnalytics, getDailyTip } from "../api-client";
import { getUserLanguage, getUserTelegramId } from "../middleware/auth";
import { formatAnalytics, formatDailyTip, formatError, truncateMessage } from "../utils/formatters";
import { InlineKeyboard } from "grammy";

export function registerReportHandler(bot: Bot): void {
  // /report command — show health analytics dashboard
  bot.command("report", async (ctx) => {
    await handleReportRequest(ctx);
  });

  // Handle report sub-actions via callback queries
  bot.callbackQuery("report:refresh", async (ctx) => {
    await ctx.answerCallbackQuery(
      getUserLanguage(ctx) === "ko" ? "Refreshing..." : "Refreshing...",
    );
    await handleReportRequest(ctx, true);
  });

  bot.callbackQuery("report:tip", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleDailyTip(ctx);
  });
}

// ── Report request handler ─────────────────────────────────────

async function handleReportRequest(ctx: any, isRefresh: boolean = false): Promise<void> {
  const lang = getUserLanguage(ctx);
  const telegramId = getUserTelegramId(ctx);

  if (!isRefresh) {
    await ctx.replyWithChatAction("typing");
  }

  try {
    const result = await getAnalytics(telegramId, lang);

    if (!result.success || !result.data) {
      const errorText = formatError(result.error, lang);
      if (isRefresh) {
        await ctx.editMessageText(errorText, { parse_mode: "HTML" });
      } else {
        await ctx.reply(errorText, { parse_mode: "HTML" });
      }
      return;
    }

    // Format the analytics dashboard
    const reportText = formatAnalytics(result.data, lang);

    // Build action keyboard
    const keyboard = new InlineKeyboard();
    if (lang === "ko") {
      keyboard
        .text("🔄 Refresh", "report:refresh")
        .text("💡 Daily Tip", "report:tip");
    } else {
      keyboard
        .text("🔄 Refresh", "report:refresh")
        .text("💡 Daily Tip", "report:tip");
    }

    const fullText = truncateMessage(reportText);

    if (isRefresh) {
      await ctx.editMessageText(fullText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(fullText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error("[report] Error fetching analytics:", error);

    const errorText =
      lang === "ko"
        ? "❌ Error loading health report."
        : "❌ Error loading health report.";

    if (isRefresh) {
      await ctx.editMessageText(errorText, { parse_mode: "HTML" });
    } else {
      await ctx.reply(errorText);
    }
  }
}

// ── Daily tip handler ──────────────────────────────────────────

async function handleDailyTip(ctx: any): Promise<void> {
  const lang = getUserLanguage(ctx);
  const telegramId = getUserTelegramId(ctx);

  try {
    const result = await getDailyTip(telegramId);

    if (!result.success || !result.data) {
      await ctx.reply(formatError(result.error, lang), { parse_mode: "HTML" });
      return;
    }

    const tipText = formatDailyTip(result.data, lang);
    await ctx.reply(tipText, { parse_mode: "HTML" });
  } catch (error) {
    console.error("[report] Error fetching daily tip:", error);
    await ctx.reply(
      lang === "ko"
        ? "❌ Error loading daily tip."
        : "❌ Error loading daily tip.",
    );
  }
}
