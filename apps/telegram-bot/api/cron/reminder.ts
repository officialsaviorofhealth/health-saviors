/**
 * Vercel Cron — Daily Reminder Dispatcher
 *
 * Runs every hour via Vercel Cron.
 * Checks all sessions and sends morning/evening reminders as needed.
 *
 * Schedule: "0 * * * *" (every hour at minute 0)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBot } from "../../src/bot";
import { getAllSessions } from "../../src/middleware/auth";

// Track which users got their daily reminders (reset daily)
// Note: On Vercel, this resets on cold starts. Acceptable for MVP —
// worst case, a user gets a duplicate reminder after a cold start.
const sentMorningReminders = new Set<string>();
const sentEveningReminders = new Set<string>();
let lastResetDate = new Date().toDateString();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a legitimate cron invocation
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const bot = getBot();
    const now = new Date();
    const currentDate = now.toDateString();

    // Reset tracking at midnight
    if (currentDate !== lastResetDate) {
      sentMorningReminders.clear();
      sentEveningReminders.clear();
      lastResetDate = currentDate;
    }

    const currentHour = now.getHours();
    const sessions = getAllSessions();
    let sent = 0;

    for (const [telegramId, session] of sessions) {
      if (!session.reminderEnabled) continue;

      // Morning reminder: at the user's configured hour
      if (
        currentHour === session.reminderHour &&
        !sentMorningReminders.has(telegramId)
      ) {
        sentMorningReminders.add(telegramId);
        await sendMorningReminder(bot, telegramId, session.language);
        sent++;
      }

      // Evening reminder: at 20:00 if no activity today
      if (currentHour === 20 && !sentEveningReminders.has(telegramId)) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        if (session.lastActivityAt < todayStart.getTime()) {
          sentEveningReminders.add(telegramId);
          await sendEveningReminder(bot, telegramId, session.language);
          sent++;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      checked: sessions.size,
      sent,
      hour: currentHour,
    });
  } catch (error) {
    console.error("[cron/reminder] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Morning reminder ──────────────────────────────────────────

async function sendMorningReminder(
  bot: ReturnType<typeof getBot>,
  telegramId: string,
  lang: "ko" | "en",
): Promise<void> {
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
        ].join("\n")
      : [
          `<b>${greeting}</b>`,
          "",
          "How are you feeling today? 🤔",
          "",
          "Describe your symptoms or condition freely.",
          "AI will analyze and you'll earn H2E points!",
        ].join("\n");

  try {
    await bot.api.sendMessage(parseInt(telegramId), text, {
      parse_mode: "HTML",
    });
    console.log(`[cron/reminder] Sent morning reminder to ${telegramId}`);
  } catch (error: any) {
    if (error.error_code === 403) {
      console.log(`[cron/reminder] User ${telegramId} blocked the bot`);
    } else {
      console.error(`[cron/reminder] Failed to send to ${telegramId}:`, error.message);
    }
  }
}

// ── Evening reminder ──────────────────────────────────────────

async function sendEveningReminder(
  bot: ReturnType<typeof getBot>,
  telegramId: string,
  lang: "ko" | "en",
): Promise<void> {
  const text =
    lang === "ko"
      ? [
          "<b>🌙 You haven't logged your health today!</b>",
          "",
          "Before the day ends, record how you're feeling.",
          "Maintain your check-in streak for bonus points! 🔥",
        ].join("\n")
      : [
          "<b>🌙 You haven't logged your health today!</b>",
          "",
          "Before the day ends, record how you're feeling.",
          "Maintain your check-in streak for bonus points! 🔥",
        ].join("\n");

  try {
    await bot.api.sendMessage(parseInt(telegramId), text, {
      parse_mode: "HTML",
    });
    console.log(`[cron/reminder] Sent evening reminder to ${telegramId}`);
  } catch (error: any) {
    if (error.error_code === 403) {
      console.log(`[cron/reminder] User ${telegramId} blocked the bot`);
    } else {
      console.error(`[cron/reminder] Failed to send to ${telegramId}:`, error.message);
    }
  }
}
