/**
 * Daily Quiz Handler (Learn2Earn)
 *
 * /quiz command or inline button — fetches a daily health quiz,
 * shows it with inline keyboard options (A/B/C/D), and handles
 * answer submissions via callback queries.
 */

import type { Bot } from "grammy";
import { getDailyQuiz, submitQuizAnswer } from "../api-client";
import { getUserLanguage, getUserTelegramId } from "../middleware/auth";
import { formatQuizQuestion, formatQuizResult, formatError } from "../utils/formatters";

export function registerQuizHandler(bot: Bot): void {
  // /quiz command — fetch and show daily quiz
  bot.command("quiz", async (ctx) => {
    await handleQuizRequest(ctx);
  });

  // Handle quiz answer callback queries (format: quiz:{quizId}:{selectedIndex})
  bot.callbackQuery(/^quiz:(.+):(\d+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);
    const match = ctx.match as RegExpMatchArray;
    const quizId = match[1];
    const selectedIndex = parseInt(match[2], 10);

    await ctx.answerCallbackQuery(
      lang === "ko" ? "Submitting answer..." : "Submitting answer...",
    );

    try {
      const result = await submitQuizAnswer(telegramId, quizId, selectedIndex);

      if (!result.success || !result.data) {
        // Handle already-submitted case
        if (result.error?.code === "ALREADY_SUBMITTED") {
          await ctx.editMessageText(
            lang === "ko"
              ? "⚠️ You already answered this quiz.\n\nType /quiz for a new one."
              : "⚠️ You already answered this quiz.\n\nType /quiz for a new one.",
            { parse_mode: "HTML" },
          );
          return;
        }

        await ctx.editMessageText(formatError(result.error, lang), {
          parse_mode: "HTML",
        });
        return;
      }

      // Format and show the result
      const resultText = formatQuizResult(result.data, selectedIndex, lang);

      // Edit the original quiz message to show the result
      await ctx.editMessageText(resultText, { parse_mode: "HTML" });

      // If correct, show a celebratory message
      if (result.data.correct) {
        await ctx.reply(
          lang === "ko"
            ? [
                "🎉 <b>Congratulations!</b>",
                "",
                `💰 ${result.data.rewardEarned} H2E points earned.`,
                "",
                "Try again tomorrow! Learn new health knowledge every day.",
              ].join("\n")
            : [
                "🎉 <b>Congratulations!</b>",
                "",
                `💰 ${result.data.rewardEarned} H2E points earned.`,
                "",
                "Try again tomorrow! Learn new health knowledge every day.",
              ].join("\n"),
          { parse_mode: "HTML" },
        );
      }
    } catch (error) {
      console.error("[quiz] Error submitting answer:", error);
      await ctx.editMessageText(
        lang === "ko"
          ? "❌ Error submitting your answer."
          : "❌ Error submitting your answer.",
        { parse_mode: "HTML" },
      );
    }
  });
}

// ── Shared quiz fetch logic ────────────────────────────────────

async function handleQuizRequest(ctx: any): Promise<void> {
  const lang = getUserLanguage(ctx);
  const telegramId = getUserTelegramId(ctx);

  await ctx.replyWithChatAction("typing");

  try {
    const result = await getDailyQuiz(telegramId);

    if (!result.success) {
      await ctx.reply(formatError(result.error, lang), { parse_mode: "HTML" });
      return;
    }

    if (!result.data) {
      // All quizzes completed
      await ctx.reply(
        lang === "ko"
          ? [
              "🎓 <b>All Quizzes Completed!</b>",
              "",
              "Congratulations! You've answered all available quizzes.",
              "We'll notify you when new quizzes are added.",
              "",
              "💡 In the meantime, keep logging your health to earn H2E points!",
            ].join("\n")
          : [
              "🎓 <b>All Quizzes Completed!</b>",
              "",
              "Congratulations! You've answered all available quizzes.",
              "We'll notify you when new quizzes are added.",
              "",
              "💡 In the meantime, keep logging your health to earn H2E points!",
            ].join("\n"),
        { parse_mode: "HTML" },
      );
      return;
    }

    // Format quiz with inline keyboard
    const { text, keyboard } = formatQuizQuestion(result.data, lang);

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("[quiz] Error fetching quiz:", error);
    await ctx.reply(
      lang === "ko"
        ? "❌ Error loading the quiz."
        : "❌ Error loading the quiz.",
    );
  }
}
