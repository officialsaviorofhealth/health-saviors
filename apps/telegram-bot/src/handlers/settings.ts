/**
 * Settings Handler
 *
 * /settings command — manage user preferences:
 * - Language toggle (Korean/English)
 * - Reminder on/off
 */

import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import {
  getUserLanguage,
  getUserTelegramId,
  getSession,
  setSession,
} from "../middleware/auth";
import type { Language } from "../config";

export function registerSettingsHandler(bot: Bot): void {
  // /settings command — show settings panel
  bot.command("settings", async (ctx) => {
    await showSettings(ctx);
  });

  // Language toggle
  bot.callbackQuery("settings:lang:ko", async (ctx) => {
    await setLanguage(ctx, "ko");
  });

  bot.callbackQuery("settings:lang:en", async (ctx) => {
    await setLanguage(ctx, "en");
  });

  // Reminder toggle from settings
  bot.callbackQuery("settings:reminder:toggle", async (ctx) => {
    const telegramId = getUserTelegramId(ctx);
    const session = getSession(telegramId);

    if (!session) {
      await ctx.answerCallbackQuery("Session not found");
      return;
    }

    session.reminderEnabled = !session.reminderEnabled;
    setSession(telegramId, session);

    const lang = session.language;
    await ctx.answerCallbackQuery(
      session.reminderEnabled
        ? lang === "ko"
          ? "🔔 Reminder ON"
          : "🔔 Reminder ON"
        : lang === "ko"
          ? "🔕 Reminder OFF"
          : "🔕 Reminder OFF",
    );

    await updateSettingsMessage(ctx);
  });

  // Back to main menu
  bot.callbackQuery("settings:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = getUserLanguage(ctx);
    await ctx.editMessageText(
      lang === "ko"
        ? "✅ Settings saved."
        : "✅ Settings saved.",
      { parse_mode: "HTML" },
    );
  });

  // Help command
  bot.command("help", async (ctx) => {
    const lang = getUserLanguage(ctx);

    const helpKo = [
      "<b>📖 Help — AI Health Journal Bot</b>",
      "",
      "<b>📋 Commands:</b>",
      "  /start — Start bot & main menu",
      "  /menu — Show main menu",
      "  /report — View health report",
      "  /quiz — Daily health quiz",
      "  /reminder — Reminder settings",
      "  /settings — Language/notification settings",
      "  /help — This help message",
      "",
      "<b>💬 Health Chat:</b>",
      "Send any non-command message and",
      "AI will analyze your symptoms and create a health record.",
      "",
      "<b>🎮 Points System:</b>",
      "  • Daily health log: base points + detail bonus",
      "  • Quiz correct answer: 10 H2E points",
      "  • Consecutive check-in: streak bonus (up to 5x!)",
      "",
      "<b>⚠️ Disclaimer:</b>",
      "This bot does not replace professional medical diagnosis.",
      "If you have serious symptoms, please consult a healthcare professional.",
    ].join("\n");

    const helpEn = [
      "<b>📖 Help — AI Health Journal Bot</b>",
      "",
      "<b>📋 Commands:</b>",
      "  /start — Start bot & main menu",
      "  /menu — Show main menu",
      "  /report — View health report",
      "  /quiz — Daily health quiz",
      "  /reminder — Reminder settings",
      "  /settings — Language/notification settings",
      "  /help — This help message",
      "",
      "<b>💬 Health Chat:</b>",
      "Send any non-command message and",
      "AI will analyze your symptoms and create a health record.",
      "",
      "<b>🎮 Points System:</b>",
      "  • Daily health log: base points + detail bonus",
      "  • Quiz correct answer: 10 H2E points",
      "  • Consecutive check-in: streak bonus (up to 5x!)",
      "",
      "<b>⚠️ Disclaimer:</b>",
      "This bot does not replace professional medical diagnosis.",
      "If you have serious symptoms, please consult a healthcare professional.",
    ].join("\n");

    await ctx.reply(lang === "ko" ? helpKo : helpEn, { parse_mode: "HTML" });
  });
}

// ── Show settings panel ────────────────────────────────────────

async function showSettings(ctx: any): Promise<void> {
  const lang = getUserLanguage(ctx);
  const telegramId = getUserTelegramId(ctx);
  const session = getSession(telegramId);

  const currentLang = session?.language || "ko";
  const reminderOn = session?.reminderEnabled ?? true;

  const langFlag = currentLang === "ko" ? "🇰🇷 Korean" : "🇺🇸 English";
  const reminderStatus = reminderOn
    ? lang === "ko"
      ? "🔔 ON"
      : "🔔 ON"
    : lang === "ko"
      ? "🔕 OFF"
      : "🔕 OFF";

  const text =
    lang === "ko"
      ? [
          "<b>⚙️ Settings</b>",
          "",
          `🌐 Language: <b>${langFlag}</b>`,
          `⏰ Reminder: <b>${reminderStatus}</b>`,
          "",
          "Use the buttons below to change settings:",
        ].join("\n")
      : [
          "<b>⚙️ Settings</b>",
          "",
          `🌐 Language: <b>${langFlag}</b>`,
          `⏰ Reminder: <b>${reminderStatus}</b>`,
          "",
          "Use the buttons below to change settings:",
        ].join("\n");

  const keyboard = buildSettingsKeyboard(currentLang, reminderOn, lang);

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

// ── Set language ───────────────────────────────────────────────

async function setLanguage(ctx: any, newLang: Language): Promise<void> {
  const telegramId = getUserTelegramId(ctx);
  const session = getSession(telegramId);

  if (!session) {
    await ctx.answerCallbackQuery("Session not found");
    return;
  }

  session.language = newLang;
  setSession(telegramId, session);

  await ctx.answerCallbackQuery(
    newLang === "ko" ? "🇰🇷 Switched to Korean" : "🇺🇸 Switched to English",
  );

  await updateSettingsMessage(ctx);
}

// ── Update settings message in place ───────────────────────────

async function updateSettingsMessage(ctx: any): Promise<void> {
  const telegramId = getUserTelegramId(ctx);
  const session = getSession(telegramId);
  const lang = session?.language || "ko";

  const currentLang = session?.language || "ko";
  const reminderOn = session?.reminderEnabled ?? true;

  const langFlag = currentLang === "ko" ? "🇰🇷 Korean" : "🇺🇸 English";
  const reminderStatus = reminderOn
    ? lang === "ko"
      ? "🔔 ON"
      : "🔔 ON"
    : lang === "ko"
      ? "🔕 OFF"
      : "🔕 OFF";

  const text =
    lang === "ko"
      ? [
          "<b>⚙️ Settings</b>",
          "",
          `🌐 Language: <b>${langFlag}</b>`,
          `⏰ Reminder: <b>${reminderStatus}</b>`,
        ].join("\n")
      : [
          "<b>⚙️ Settings</b>",
          "",
          `🌐 Language: <b>${langFlag}</b>`,
          `⏰ Reminder: <b>${reminderStatus}</b>`,
        ].join("\n");

  const keyboard = buildSettingsKeyboard(currentLang, reminderOn, lang);

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch {
    // Message may not be editable; send a new one
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
}

// ── Build settings keyboard ────────────────────────────────────

function buildSettingsKeyboard(
  currentLang: Language,
  reminderOn: boolean,
  displayLang: Language,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Language buttons — highlight the active one
  if (currentLang === "ko") {
    keyboard
      .text("✅ 🇰🇷 Korean", "settings:lang:ko")
      .text("🇺🇸 English", "settings:lang:en");
  } else {
    keyboard
      .text("🇰🇷 Korean", "settings:lang:ko")
      .text("✅ 🇺🇸 English", "settings:lang:en");
  }
  keyboard.row();

  // Reminder toggle
  const reminderLabel = reminderOn
    ? displayLang === "ko"
      ? "🔕 Disable Reminder"
      : "🔕 Disable Reminder"
    : displayLang === "ko"
      ? "🔔 Enable Reminder"
      : "🔔 Enable Reminder";
  keyboard.text(reminderLabel, "settings:reminder:toggle").row();

  // Done
  keyboard.text(
    displayLang === "ko" ? "✅ Done" : "✅ Done",
    "settings:back",
  );

  return keyboard;
}
