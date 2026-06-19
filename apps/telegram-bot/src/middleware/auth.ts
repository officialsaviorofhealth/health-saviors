/**
 * Authentication Middleware for Telegram Bot
 *
 * Maps Telegram user IDs to backend user accounts.
 * Auto-registers new users on first interaction.
 * Stores per-user preferences (language, reminder settings).
 */

import type { Context, NextFunction } from "grammy";
import { registerUser, getAuthToken } from "../api-client";
import type { Language } from "../config";
import { config } from "../config";

// ── User session data ──────────────────────────────────────────

export interface UserSession {
  telegramId: string;
  backendUserId?: string;
  language: Language;
  isRegistered: boolean;
  reminderEnabled: boolean;
  reminderHour: number; // 0-23, default 9 (9 AM)
  reminderMinute: number;
  // Phase 2: Token integration
  // walletAddress?: string;
  lastActivityAt: number;
}

// ── In-memory session store ────────────────────────────────────
// In production, replace with Redis or persistent storage.

const sessions = new Map<string, UserSession>();

export function getSession(telegramId: string): UserSession | undefined {
  return sessions.get(telegramId);
}

export function setSession(telegramId: string, session: UserSession): void {
  sessions.set(telegramId, session);
}

export function getAllSessions(): Map<string, UserSession> {
  return sessions;
}

export function createDefaultSession(telegramId: string): UserSession {
  return {
    telegramId,
    language: config.defaultLanguage,
    isRegistered: false,
    reminderEnabled: true,
    reminderHour: 9,
    reminderMinute: 0,
    lastActivityAt: Date.now(),
  };
}

// ── Auth middleware ─────────────────────────────────────────────

/**
 * Middleware that ensures the user is registered with the backend.
 * On first interaction, auto-registers via the API and stores the session.
 * Subsequent interactions use the cached session.
 */
export async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    // No user info available (e.g., channel posts) — skip
    return next();
  }

  const telegramId = telegramUser.id.toString();
  let session = sessions.get(telegramId);

  if (!session) {
    session = createDefaultSession(telegramId);

    // Detect language from Telegram's language_code
    if (telegramUser.language_code) {
      session.language = telegramUser.language_code.startsWith("ko") ? "ko" : "en";
    }

    sessions.set(telegramId, session);
  }

  // Update last activity
  session.lastActivityAt = Date.now();

  // Auto-register if not yet registered or token missing
  if (!session.isRegistered || !getAuthToken(telegramId)) {
    try {
      const result = await registerUser(telegramId);
      if (result.success && result.data) {
        session.isRegistered = true;
        session.backendUserId = result.data.id;
        // Phase 2: Token integration
        // if (result.data.walletAddress) {
        //   session.walletAddress = result.data.walletAddress;
        // }
      }
    } catch (error) {
      console.error(`[auth] Failed to register user ${telegramId}:`, error);
      // Continue anyway — the user can still interact, API calls may fail gracefully
    }
  }

  return next();
}

// ── Helper: get user language from context ─────────────────────

export function getUserLanguage(ctx: Context): Language {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return config.defaultLanguage;
  const session = sessions.get(telegramId);
  return session?.language || config.defaultLanguage;
}

export function getUserTelegramId(ctx: Context): string {
  return ctx.from?.id.toString() || "0";
}
