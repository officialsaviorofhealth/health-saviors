/**
 * Shared Bot Instance — used by both webhook handler and cron jobs
 * Shared bot instance across Vercel serverless invocations
 *
 * Vercel keeps warm instances, so the bot object persists between
 * invocations on the same worker. Sessions are in-memory (acceptable
 * for MVP; swap to Vercel KV or Redis for production scale).
 */

import { Bot } from "grammy";
import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import { registerStartHandler } from "./handlers/start";
import { registerHealthChatHandler } from "./handlers/health-chat";
import { registerQuizHandler } from "./handlers/quiz";
import { registerReportHandler } from "./handlers/report";
import { registerReminderHandler } from "./handlers/reminder";
import { registerSettingsHandler } from "./handlers/settings";
import { registerDebateHandler } from "./handlers/debate";

// ── Singleton bot instance ─────────────────────────────────────

let _bot: Bot | null = null;

export function getBot(): Bot {
  if (_bot) return _bot;

  if (!config.botToken) {
    throw new Error("BOT_TOKEN environment variable is not set.");
  }

  _bot = new Bot(config.botToken);

  // Global middleware
  _bot.use(authMiddleware);

  // Register command handlers (order matters)
  registerStartHandler(_bot);
  registerQuizHandler(_bot);
  registerReportHandler(_bot);
  registerReminderHandler(_bot);
  registerSettingsHandler(_bot);
  registerDebateHandler(_bot);

  // Health chat MUST be last — catches all text messages
  registerHealthChatHandler(_bot);

  // Error handler
  _bot.catch((err) => {
    const ctx = err.ctx;
    const error = err.error;

    console.error(`[bot] Error handling update ${ctx.update.update_id}:`);
    if (error instanceof Error) {
      console.error(`  ${error.name}: ${error.message}`);
    }

    try {
      const msg = "❌ An error occurred. Please try again later.";
      ctx.reply(msg).catch(() => {});
    } catch {
      // Silently ignore
    }
  });

  return _bot;
}
