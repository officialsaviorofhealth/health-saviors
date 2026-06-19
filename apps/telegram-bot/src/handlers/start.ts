/**
 * /start Command Handler
 *
 * Welcomes the user with a description of the bot and shows
 * the main menu with inline keyboard buttons.
 */

import { type Bot, InlineKeyboard } from "grammy";
import { getUserLanguage, getUserTelegramId } from "../middleware/auth";

export function registerStartHandler(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const lang = getUserLanguage(ctx);
    const firstName = ctx.from?.first_name || (lang === "ko" ? "User" : "User");

    const welcomeKo = [
      `<b>Hello, ${firstName}! 👋</b>`,
      "",
      "🏥 Welcome to <b>AI Health Journal</b>!",
      "",
      "I'm your AI-powered health assistant.",
      "Log your health daily, get AI analysis,",
      "and earn <b>H2E (Health2Earn)</b> points!",
      "",
      "🔹 <b>Key Features:</b>",
      "  • Describe symptoms naturally — AI analyzes them",
      "  • SNOMED CT / FHIR medical data standardization",
      "  • Pattern analysis & medication interaction warnings",
      "  • Daily health quizzes to learn and earn!",
      "  • Consecutive check-in bonus system",
      "",
      '💡 <b>Usage:</b> Just send any message to start a health chat.',
      'e.g. "I\'ve had a headache since morning and feel a bit dizzy"',
      "",
      "Choose an option from the menu below! 👇",
    ];

    const welcomeEn = [
      `<b>Hello, ${firstName}! 👋</b>`,
      "",
      "🏥 Welcome to <b>AI Health Journal</b>!",
      "",
      "I'm your AI-powered health assistant.",
      "Log your health daily, get AI analysis,",
      "and earn <b>H2E (Health2Earn)</b> points!",
      "",
      "🔹 <b>Key Features:</b>",
      "  • Describe symptoms naturally — AI analyzes them",
      "  • SNOMED CT / FHIR medical data standardization",
      "  • Pattern analysis & medication interaction warnings",
      "  • Daily health quizzes to learn and earn!",
      "  • Consecutive check-in bonus system",
      "",
      '💡 <b>Usage:</b> Just send any message to start a health chat.',
      'e.g. "I\'ve had a headache since morning and feel a bit dizzy"',
      "",
      "Choose an option from the menu below! 👇",
    ];

    const keyboard = createMainMenuKeyboard(lang);
    const text = lang === "ko" ? welcomeKo.join("\n") : welcomeEn.join("\n");

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // Handle "menu" command — shows the main menu again
  bot.command("menu", async (ctx) => {
    const lang = getUserLanguage(ctx);
    const keyboard = createMainMenuKeyboard(lang);

    await ctx.reply(
      lang === "ko"
        ? "📋 <b>Main Menu</b>\n\nChoose an option:"
        : "📋 <b>Main Menu</b>\n\nChoose an option:",
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      },
    );
  });

  // Handle inline button callbacks for main menu
  bot.callbackQuery("menu:symptom", async (ctx) => {
    const lang = getUserLanguage(ctx);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      lang === "ko"
        ? '🏥 <b>Log Symptom</b>\n\nDescribe your symptoms freely.\ne.g. "I have a sore throat and cough since yesterday"\n\nAI will analyze and record in FHIR standard.'
        : '🏥 <b>Log Symptom</b>\n\nDescribe your symptoms freely.\ne.g. "I have a sore throat and cough since yesterday"\n\nAI will analyze and record in FHIR standard.',
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery("menu:report", async (ctx) => {
    await ctx.answerCallbackQuery();
    // Trigger the /report command logic
    await ctx.reply("/report", { entities: [{ type: "bot_command", offset: 0, length: 7 }] });
  });

  bot.callbackQuery("menu:quiz", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("/quiz", { entities: [{ type: "bot_command", offset: 0, length: 5 }] });
  });

  bot.callbackQuery("menu:medication", async (ctx) => {
    const lang = getUserLanguage(ctx);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      lang === "ko"
        ? '💊 <b>Medication Check</b>\n\nTell me about your current medications.\ne.g. "I\'m taking Tylenol 500mg twice daily"\n\nAI will check for drug interactions.'
        : '💊 <b>Medication Check</b>\n\nTell me about your current medications.\ne.g. "I\'m taking Tylenol 500mg twice daily"\n\nAI will check for drug interactions.',
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery("menu:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("/settings", {
      entities: [{ type: "bot_command", offset: 0, length: 9 }],
    });
  });
}

// ── Main menu keyboard builder ─────────────────────────────────

function createMainMenuKeyboard(lang: "ko" | "en"): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (lang === "ko") {
    keyboard
      .text("🏥 Log Symptom", "menu:symptom")
      .text("📊 Health Report", "menu:report")
      .row()
      .text("🧠 Daily Quiz", "menu:quiz")
      .text("💊 Medication Check", "menu:medication")
      .row()
      .text("⚙️ Settings", "menu:settings");
  } else {
    keyboard
      .text("🏥 Log Symptom", "menu:symptom")
      .text("📊 Health Report", "menu:report")
      .row()
      .text("🧠 Daily Quiz", "menu:quiz")
      .text("💊 Medication Check", "menu:medication")
      .row()
      .text("⚙️ Settings", "menu:settings");
  }

  return keyboard;
}

export { createMainMenuKeyboard };
