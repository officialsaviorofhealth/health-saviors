/**
 * Daily Reminder Handler
 *
 * /reminder command — configure daily health check-in reminders.
 * Sends morning greetings and evening reminders if no entry was logged.
 * Uses setInterval to check every minute for pending reminders.
 */

import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import {
  getUserLanguage,
  getUserTelegramId,
  getSession,
  setSession,
  getAllSessions,
  type UserSession,
} from "../middleware/auth";
import { config } from "../config";

// Track which users got their daily reminders (reset daily)
const sentMorningReminders = new Set<string>();
const sentEveningReminders = new Set<string>();
let lastResetDate = new Date().toDateString();

export function registerReminderHandler(bot: Bot): void {
  // /reminder command — show reminder settings
  bot.command("reminder", async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);
    const session = getSession(telegramId);

    if (!session) {
      await ctx.reply(
        lang === "ko"
          ? "⚠️ Please type /start first."
          : "⚠️ Please type /start first.",
      );
      return;
    }

    const statusEmoji = session.reminderEnabled ? "🔔" : "🔕";
    const statusText = session.reminderEnabled
      ? lang === "ko"
        ? "ON"
        : "ON"
      : lang === "ko"
        ? "OFF"
        : "OFF";

    const timeStr = `${String(session.reminderHour).padStart(2, "0")}:${String(session.reminderMinute).padStart(2, "0")}`;

    const text =
      lang === "ko"
        ? [
            "<b>⏰ Reminder Settings</b>",
            "",
            `${statusEmoji} Status: <b>${statusText}</b>`,
            `🕐 Time: <b>${timeStr}</b>`,
            "",
            "You'll receive a daily health check-in reminder at the time you set.",
            "An evening reminder is sent if no entry was logged!",
            "",
            "Use the buttons below to change settings:",
          ].join("\n")
        : [
            "<b>⏰ Reminder Settings</b>",
            "",
            `${statusEmoji} Status: <b>${statusText}</b>`,
            `🕐 Time: <b>${timeStr}</b>`,
            "",
            "You'll receive a daily health check-in reminder.",
            "An evening reminder is sent if no entry was logged.",
            "",
            "Use the buttons below to change settings:",
          ].join("\n");

    const keyboard = buildReminderKeyboard(session, lang);

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // Toggle reminder on/off
  bot.callbackQuery("reminder:toggle", async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);
    const session = getSession(telegramId);

    if (!session) {
      await ctx.answerCallbackQuery(
        lang === "ko" ? "Session not found" : "Session not found",
      );
      return;
    }

    session.reminderEnabled = !session.reminderEnabled;
    setSession(telegramId, session);

    await ctx.answerCallbackQuery(
      session.reminderEnabled
        ? lang === "ko"
          ? "🔔 Reminder enabled"
          : "🔔 Reminder enabled"
        : lang === "ko"
          ? "🔕 Reminder disabled"
          : "🔕 Reminder disabled",
    );

    // Update the message
    const statusEmoji = session.reminderEnabled ? "🔔" : "🔕";
    const statusText = session.reminderEnabled
      ? lang === "ko"
        ? "ON"
        : "ON"
      : lang === "ko"
        ? "OFF"
        : "OFF";
    const timeStr = `${String(session.reminderHour).padStart(2, "0")}:${String(session.reminderMinute).padStart(2, "0")}`;

    const text =
      lang === "ko"
        ? [
            "<b>⏰ Reminder Settings</b>",
            "",
            `${statusEmoji} Status: <b>${statusText}</b>`,
            `🕐 Time: <b>${timeStr}</b>`,
          ].join("\n")
        : [
            "<b>⏰ Reminder Settings</b>",
            "",
            `${statusEmoji} Status: <b>${statusText}</b>`,
            `🕐 Time: <b>${timeStr}</b>`,
          ].join("\n");

    const keyboard = buildReminderKeyboard(session, lang);

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // Set reminder time
  bot.callbackQuery(/^reminder:time:(\d+)$/, async (ctx) => {
    const lang = getUserLanguage(ctx);
    const telegramId = getUserTelegramId(ctx);
    const session = getSession(telegramId);

    if (!session) {
      await ctx.answerCallbackQuery(
        lang === "ko" ? "Session not found" : "Session not found",
      );
      return;
    }

    const hour = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    session.reminderHour = hour;
    session.reminderMinute = 0;
    setSession(telegramId, session);

    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    await ctx.answerCallbackQuery(
      lang === "ko"
        ? `⏰ Reminder set to ${timeStr}`
        : `⏰ Reminder set to ${timeStr}`,
    );

    // Update the message
    const statusEmoji = session.reminderEnabled ? "🔔" : "🔕";
    const statusText = session.reminderEnabled
      ? lang === "ko"
        ? "ON"
        : "ON"
      : lang === "ko"
        ? "OFF"
        : "OFF";

    const text =
      lang === "ko"
        ? [
            "<b>⏰ Reminder Settings</b>",
            "",
            `${statusEmoji} Status: <b>${statusText}</b>`,
            `🕐 Time: <b>${timeStr}</b>`,
          ].join("\n")
        : [
            "<b>⏰ Reminder Settings</b>",
            "",
            `${statusEmoji} Status: <b>${statusText}</b>`,
            `🕐 Time: <b>${timeStr}</b>`,
          ].join("\n");

    const keyboard = buildReminderKeyboard(session, lang);

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });
}

// ── Build reminder settings keyboard ───────────────────────────

function buildReminderKeyboard(session: UserSession, lang: "ko" | "en"): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Toggle button
  const toggleLabel = session.reminderEnabled
    ? lang === "ko"
      ? "🔕 Disable Reminder"
      : "🔕 Disable Reminder"
    : lang === "ko"
      ? "🔔 Enable Reminder"
      : "🔔 Enable Reminder";
  keyboard.text(toggleLabel, "reminder:toggle").row();

  // Time selection (common times)
  if (lang === "ko") {
    keyboard
      .text("🌅 7 AM", "reminder:time:7")
      .text("☀️ 8 AM", "reminder:time:8")
      .text("🌤 9 AM", "reminder:time:9")
      .row()
      .text("🌞 10 AM", "reminder:time:10")
      .text("🌇 6 PM", "reminder:time:18")
      .text("🌙 9 PM", "reminder:time:21");
  } else {
    keyboard
      .text("🌅 7 AM", "reminder:time:7")
      .text("☀️ 8 AM", "reminder:time:8")
      .text("🌤 9 AM", "reminder:time:9")
      .row()
      .text("🌞 10 AM", "reminder:time:10")
      .text("🌇 6 PM", "reminder:time:18")
      .text("🌙 9 PM", "reminder:time:21");
  }

  return keyboard;
}

// ── Reminder scheduler ─────────────────────────────────────────

/**
 * Start the reminder check loop.
 * Runs every minute to check if any users need their daily reminder.
 */
export function startReminderScheduler(bot: Bot): NodeJS.Timeout {
  console.log("[reminder] Starting reminder scheduler...");

  const interval = setInterval(async () => {
    try {
      const now = new Date();
      const currentDate = now.toDateString();

      // Reset sent-reminder tracking at midnight
      if (currentDate !== lastResetDate) {
        sentMorningReminders.clear();
        sentEveningReminders.clear();
        lastResetDate = currentDate;
        console.log("[reminder] Daily reset — cleared sent reminder tracking");
      }

      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const sessions = getAllSessions();

      for (const [telegramId, session] of sessions) {
        if (!session.reminderEnabled) continue;

        // Morning reminder: at the user's configured time
        if (
          currentHour === session.reminderHour &&
          currentMinute === session.reminderMinute &&
          !sentMorningReminders.has(telegramId)
        ) {
          sentMorningReminders.add(telegramId);
          await sendMorningReminder(bot, telegramId, session);
        }

        // Evening reminder: at 20:00 if no recent activity today
        if (
          currentHour === 20 &&
          currentMinute === 0 &&
          !sentEveningReminders.has(telegramId)
        ) {
          // Check if user has been active today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          if (session.lastActivityAt < todayStart.getTime()) {
            sentEveningReminders.add(telegramId);
            await sendEveningReminder(bot, telegramId, session);
          }
        }
      }
    } catch (error) {
      console.error("[reminder] Scheduler error:", error);
    }
  }, config.reminderCheckInterval);

  return interval;
}

// ── Send morning reminder ──────────────────────────────────────

async function sendMorningReminder(
  bot: Bot,
  telegramId: string,
  session: UserSession,
): Promise<void> {
  const lang = session.language;

  const greetings = {
    ko: [
      "☀️ Good morning!",
      "🌅 A new day begins!",
      "🌤 Have a healthy day!",
      "🌻 Hello! Time for your health check-in!",
    ],
    en: [
      "☀️ Good morning!",
      "🌅 A new day begins!",
      "🌤 Have a healthy day!",
      "🌻 Hello! Time for your health check-in!",
    ],
  };

  const greeting = greetings[lang][Math.floor(Math.random() * greetings[lang].length)];

  const text =
    lang === "ko"
      ? [
          `<b>${greeting}</b>`,
          "",
          "How are you feeling today? 🤔",
          "",
          "Describe your symptoms or condition freely.",
          "AI will analyze and you'll earn H2E points!",
          "",
          '💡 e.g. "Feeling great today" or "A bit tired and my throat hurts"',
        ].join("\n")
      : [
          `<b>${greeting}</b>`,
          "",
          "How are you feeling today? 🤔",
          "",
          "Describe your symptoms or condition freely.",
          "AI will analyze and you'll earn H2E points!",
          "",
          '💡 e.g. "Feeling great today" or "A bit tired and my throat hurts"',
        ].join("\n");

  try {
    await bot.api.sendMessage(parseInt(telegramId), text, {
      parse_mode: "HTML",
    });
    console.log(`[reminder] Sent morning reminder to ${telegramId}`);
  } catch (error: any) {
    // User may have blocked the bot
    if (error.error_code === 403) {
      console.log(`[reminder] User ${telegramId} blocked the bot, disabling reminders`);
      session.reminderEnabled = false;
    } else {
      console.error(`[reminder] Failed to send morning reminder to ${telegramId}:`, error.message);
    }
  }
}

// ── Send evening reminder ──────────────────────────────────────

async function sendEveningReminder(
  bot: Bot,
  telegramId: string,
  session: UserSession,
): Promise<void> {
  const lang = session.language;

  const text =
    lang === "ko"
      ? [
          "<b>🌙 You haven't logged your health today!</b>",
          "",
          "Before the day ends, record how you're feeling.",
          "Maintain your check-in streak for bonus points! 🔥",
          "",
          "Tell me how you're feeling right now 👇",
        ].join("\n")
      : [
          "<b>🌙 You haven't logged your health today!</b>",
          "",
          "Before the day ends, record how you're feeling.",
          "Maintain your check-in streak for bonus points! 🔥",
          "",
          "Tell me how you're feeling right now 👇",
        ].join("\n");

  try {
    await bot.api.sendMessage(parseInt(telegramId), text, {
      parse_mode: "HTML",
    });
    console.log(`[reminder] Sent evening reminder to ${telegramId}`);
  } catch (error: any) {
    if (error.error_code === 403) {
      console.log(`[reminder] User ${telegramId} blocked the bot, disabling reminders`);
      session.reminderEnabled = false;
    } else {
      console.error(`[reminder] Failed to send evening reminder to ${telegramId}:`, error.message);
    }
  }
}
