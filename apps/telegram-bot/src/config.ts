/**
 * Telegram Bot Configuration
 *
 * Environment variables:
 *   BOT_TOKEN       — Telegram Bot API token (required)
 *   API_BASE_URL    — Backend API base URL (default: http://localhost:3001/api/v1)
 *   WEBHOOK_URL     — If set, bot uses webhook mode instead of polling
 *   BOT_API_SECRET  — Shared secret for bot-to-API authentication
 */

export const config = {
  /** Telegram Bot API token from @BotFather */
  botToken: process.env.BOT_TOKEN || "",

  /** Backend API base URL */
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3001/api/v1",

  /** Optional: Webhook URL for production deployment. If unset, uses long-polling. */
  webhookUrl: process.env.WEBHOOK_URL,

  /** Shared secret for authenticating bot requests to the API */
  botApiSecret: process.env.BOT_API_SECRET || "telegram-bot-secret",

  /** Default language for new users */
  defaultLanguage: "ko" as "ko" | "en",

  /** Reminder check interval in milliseconds (1 minute) */
  reminderCheckInterval: 60_000,

  /** Maximum message length for Telegram */
  maxMessageLength: 4096,
} as const;

export type Language = "ko" | "en";
