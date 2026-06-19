/**
 * AI Health Journal — Telegram Bot Entry Point
 *
 * Initializes the grammY bot, registers all command handlers,
 * sets up the menu commands, and starts polling (or webhook).
 *
 * Environment variables:
 *   BOT_TOKEN     — required
 *   API_BASE_URL  — defaults to http://localhost:3001/api/v1
 *   WEBHOOK_URL   — if set, uses webhook mode instead of polling
 */

import { Bot, webhookCallback } from "grammy";
import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import { registerStartHandler } from "./handlers/start";
import { registerHealthChatHandler } from "./handlers/health-chat";
import { registerQuizHandler } from "./handlers/quiz";
import { registerReportHandler } from "./handlers/report";
import { registerReminderHandler, startReminderScheduler } from "./handlers/reminder";
import { registerSettingsHandler } from "./handlers/settings";
import { registerDebateHandler } from "./handlers/debate";

// ── Validate configuration ─────────────────────────────────────

if (!config.botToken) {
  console.error("FATAL: BOT_TOKEN environment variable is not set.");
  console.error("Get a token from @BotFather on Telegram.");
  process.exit(1);
}

// ── Create bot instance ────────────────────────────────────────

const bot = new Bot(config.botToken);

// ── Global middleware ──────────────────────────────────────────

// Auth middleware — auto-registers users and manages sessions
bot.use(authMiddleware);

// ── Register command handlers ──────────────────────────────────
// Order matters: specific commands before the catch-all text handler.

registerStartHandler(bot);       // /start, /menu, menu callbacks
registerQuizHandler(bot);        // /quiz, quiz answer callbacks
registerReportHandler(bot);      // /report, report callbacks
registerReminderHandler(bot);    // /reminder, reminder callbacks
registerSettingsHandler(bot);    // /settings, /help, settings callbacks
registerDebateHandler(bot);      // /debate, debate callbacks

// Health chat handler MUST be registered last — it catches all text messages
registerHealthChatHandler(bot);

// ── Set bot menu commands ──────────────────────────────────────

async function setMenuCommands(): Promise<void> {
  try {
    // Default commands
    await bot.api.setMyCommands(
      [
        { command: "start", description: "Start bot / Main menu" },
        { command: "menu", description: "Show main menu" },
        { command: "report", description: "View health report" },
        { command: "quiz", description: "Daily health quiz" },
        { command: "debate", description: "Watch AI agents discuss your health" },
        { command: "reminder", description: "Reminder settings" },
        { command: "settings", description: "Language & notification settings" },
        { command: "help", description: "Help" },
      ],
      { scope: { type: "default" } },
    );

    // English commands for English-speaking users
    await bot.api.setMyCommands(
      [
        { command: "start", description: "Start bot / Main menu" },
        { command: "menu", description: "Show main menu" },
        { command: "report", description: "View health report" },
        { command: "quiz", description: "Daily health quiz" },
        { command: "debate", description: "Watch AI agents discuss your health" },
        { command: "reminder", description: "Reminder settings" },
        { command: "settings", description: "Language & notification settings" },
        { command: "help", description: "Help" },
      ],
      { scope: { type: "default" }, language_code: "en" },
    );

    console.log("[bot] Menu commands set successfully");
  } catch (error) {
    console.error("[bot] Failed to set menu commands:", error);
  }
}

// ── Error handling ─────────────────────────────────────────────

bot.catch((err) => {
  const ctx = err.ctx;
  const error = err.error;

  console.error(`[bot] Error while handling update ${ctx.update.update_id}:`);

  if (error instanceof Error) {
    console.error(`  ${error.name}: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack.split("\n").slice(1, 3).join("\n")}`);
    }
  } else {
    console.error("  Unknown error:", error);
  }

  // Try to notify the user
  try {
    const msg = "❌ An error occurred. Please try again later.";
    ctx.reply(msg).catch(() => {});
  } catch {
    // Silently ignore if we can't reply
  }
});

// ── Start the bot ──────────────────────────────────────────────

let reminderInterval: NodeJS.Timeout | undefined;

async function start(): Promise<void> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🏥 AI Health Journal — Telegram Bot");
  console.log("  📦 Version: 0.1.0");
  console.log(`  🌐 API: ${config.apiBaseUrl}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Set menu commands
  await setMenuCommands();

  // Start reminder scheduler
  reminderInterval = startReminderScheduler(bot);

  if (config.webhookUrl) {
    // Webhook mode (for production behind a reverse proxy)
    console.log(`[bot] Starting in webhook mode: ${config.webhookUrl}`);

    // Note: You need to serve the webhook callback.
    // This works with frameworks like Hono, Express, etc.
    // Example integration:
    //   app.post("/webhook", webhookCallback(bot, "std:http"));

    // Set webhook with Telegram
    await bot.api.setWebhook(config.webhookUrl);
    console.log("[bot] Webhook set successfully");

    // For standalone webhook mode, we use a simple HTTP server
    const { createServer } = await import("http");
    const callback = webhookCallback(bot, "http");
    const server = createServer(async (req, res) => {
      if (req.method === "POST" && req.url === "/webhook") {
        try {
          await callback(req, res);
        } catch (error) {
          console.error("[webhook] Error:", error);
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      } else if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", bot: "telegram-bot", version: "0.1.0" }));
      } else {
        res.statusCode = 404;
        res.end("Not Found");
      }
    });

    const port = parseInt(process.env.PORT || "3002");
    server.listen(port, () => {
      console.log(`[bot] Webhook server listening on port ${port}`);
    });
  } else {
    // Long-polling mode (for development)
    console.log("[bot] Starting in long-polling mode...");

    // Delete any existing webhook first
    await bot.api.deleteWebhook();

    bot.start({
      onStart: (botInfo) => {
        console.log(`[bot] Bot started as @${botInfo.username}`);
        console.log("[bot] Ready to receive messages!");
      },
    });
  }
}

// ── Graceful shutdown ──────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`\n[bot] Received ${signal}, shutting down gracefully...`);

  if (reminderInterval) {
    clearInterval(reminderInterval);
    console.log("[bot] Reminder scheduler stopped");
  }

  bot.stop();
  console.log("[bot] Bot stopped. Goodbye!");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── Launch ─────────────────────────────────────────────────────

start().catch((error) => {
  console.error("[bot] Fatal error during startup:", error);
  process.exit(1);
});
