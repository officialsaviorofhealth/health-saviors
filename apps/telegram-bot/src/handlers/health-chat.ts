/**
 * Health Chat Handler
 *
 * Any text message (not a command) triggers the AI health chat.
 * Sends the user's message to the API /chat endpoint and formats
 * the AI response with FHIR data, medication warnings, pattern insights,
 * and severity indicators.
 */

import type { Bot } from "grammy";
import { chat } from "../api-client";
import { getUserLanguage, getUserTelegramId } from "../middleware/auth";
import { formatSymptomReport, formatError, truncateMessage } from "../utils/formatters";

export function registerHealthChatHandler(bot: Bot): void {
  // Handle any text message that is NOT a command
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    // Skip if it's a command (starts with /)
    if (text.startsWith("/")) return;

    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);

    // Show "typing..." indicator while processing
    await ctx.replyWithChatAction("typing");

    try {
      // Send to the backend AI pipeline
      const result = await chat(telegramId, text, lang);

      if (!result.success || !result.data) {
        await ctx.reply(formatError(result.error, lang), { parse_mode: "HTML" });
        return;
      }

      // Format the AI response
      const formattedMessage = formatSymptomReport(result.data, lang);

      // Send the formatted response (truncate if too long for Telegram)
      await ctx.reply(truncateMessage(formattedMessage), {
        parse_mode: "HTML",
      });

      // If there's a safety alert, send an additional prominent message
      if (result.data.aiResult.safetyAlert) {
        const alertText =
          lang === "ko"
            ? [
                "🚨 <b>Important Safety Alert</b>",
                "",
                result.data.aiResult.safetyAlert,
                "",
                "⚠️ If symptoms are severe, consult a healthcare professional immediately.",
                "For emergencies, call your local emergency number.",
              ].join("\n")
            : [
                "🚨 <b>Important Safety Alert</b>",
                "",
                result.data.aiResult.safetyAlert,
                "",
                "⚠️ If symptoms are severe, consult a healthcare professional immediately.",
                "For emergencies, call your local emergency number.",
              ].join("\n");

        await ctx.reply(alertText, { parse_mode: "HTML" });
      }

      // If urgency is emergency level, add extra warning
      if (result.data.aiResult.urgencyLevel === "emergency") {
        const emergencyText =
          lang === "ko"
            ? [
                "🔴🔴🔴 <b>Emergency Detected</b> 🔴🔴🔴",
                "",
                "AI analysis suggests urgent medical attention may be needed.",
                "",
                "📞 Call <b>emergency services</b> immediately",
                "🏥 or visit the nearest emergency room.",
                "",
                "⚠️ This bot does not replace professional medical diagnosis.",
              ].join("\n")
            : [
                "🔴🔴🔴 <b>Emergency Detected</b> 🔴🔴🔴",
                "",
                "AI analysis suggests urgent medical attention may be needed.",
                "",
                "📞 Call <b>emergency services</b> immediately",
                "🏥 or visit the nearest emergency room.",
                "",
                "⚠️ This bot does not replace professional medical diagnosis.",
              ].join("\n");

        await ctx.reply(emergencyText, { parse_mode: "HTML" });
      }
    } catch (error) {
      console.error("[health-chat] Error processing message:", error);

      const errorText =
        lang === "ko"
          ? "❌ Error processing your message. Please try again later."
          : "❌ Error processing your message. Please try again later.";

      await ctx.reply(errorText);
    }
  });
}
