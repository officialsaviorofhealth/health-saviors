// API Metering Middleware — Rate limiting per agent tier with DB-backed persistence

import type { Context, Next } from "hono";
import type { PrismaClient } from "@prisma/client";

// ── Rate limits per subscription tier ──
export const RATE_LIMITS = {
  free: { queriesPerDay: 10, queriesPerMonth: 100 },
  pro: { queriesPerDay: 500, queriesPerMonth: 10000 },
  enterprise: { queriesPerDay: -1, queriesPerMonth: -1 }, // unlimited
} as const;

export type RateLimitTier = keyof typeof RATE_LIMITS;

// ── In-memory cache for fast path (reduces DB reads) ──
interface CachedRateLimit {
  tierPlan: RateLimitTier;
  dailyCount: number;
  monthlyCount: number;
  dailyResetAt: number;   // epoch ms
  monthlyResetAt: number; // epoch ms
  lastSynced: number;     // epoch ms — when we last wrote to DB
}

const SYNC_INTERVAL_MS = 30_000; // Sync to DB every 30s

class ApiMeteringService {
  private prisma: PrismaClient | null = null;
  private cache = new Map<string, CachedRateLimit>();

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error(
        "PrismaClient not initialized for API metering."
      );
    }
    return this.prisma;
  }

  /**
   * Get or initialize rate limit state for an agent
   */
  private async getOrCreateRateLimit(agentId: string): Promise<CachedRateLimit> {
    const cached = this.cache.get(agentId);
    const now = Date.now();

    // Return from cache if fresh
    if (cached && now - cached.lastSynced < SYNC_INTERVAL_MS) {
      return this.maybeResetCounters(cached, now);
    }

    // Load from DB
    const db = this.getPrisma();
    let dbRecord = await db.agentRateLimit.findUnique({ where: { agentId } });

    if (!dbRecord) {
      // Check the agent's tier from AIAgent
      const agent = await db.aIAgent.findUnique({
        where: { id: agentId },
        select: { pricingTier: true },
      });

      const tierPlan = this.mapPricingTierToRateLimitTier(agent?.pricingTier || "basic");
      const dailyResetAt = this.getNextDailyReset();
      const monthlyResetAt = this.getNextMonthlyReset();

      dbRecord = await db.agentRateLimit.create({
        data: {
          agentId,
          tierPlan,
          dailyCount: 0,
          monthlyCount: 0,
          dailyResetAt: new Date(dailyResetAt),
          monthlyResetAt: new Date(monthlyResetAt),
        },
      });
    }

    const entry: CachedRateLimit = {
      tierPlan: dbRecord.tierPlan as RateLimitTier,
      dailyCount: dbRecord.dailyCount,
      monthlyCount: dbRecord.monthlyCount,
      dailyResetAt: dbRecord.dailyResetAt.getTime(),
      monthlyResetAt: dbRecord.monthlyResetAt.getTime(),
      lastSynced: now,
    };

    const reset = this.maybeResetCounters(entry, now);
    this.cache.set(agentId, reset);
    return reset;
  }

  /**
   * Map agent pricing tier to rate limit tier
   */
  private mapPricingTierToRateLimitTier(pricingTier: string): RateLimitTier {
    switch (pricingTier) {
      case "enterprise":
        return "enterprise";
      case "premium":
      case "standard":
        return "pro";
      case "basic":
      default:
        return "free";
    }
  }

  /**
   * Reset daily/monthly counters if the reset time has passed
   */
  private maybeResetCounters(entry: CachedRateLimit, now: number): CachedRateLimit {
    let changed = false;

    if (now >= entry.dailyResetAt) {
      entry.dailyCount = 0;
      entry.dailyResetAt = this.getNextDailyReset();
      changed = true;
    }

    if (now >= entry.monthlyResetAt) {
      entry.monthlyCount = 0;
      entry.monthlyResetAt = this.getNextMonthlyReset();
      changed = true;
    }

    if (changed) {
      entry.lastSynced = 0; // Force DB sync on next persist
    }

    return entry;
  }

  /**
   * Get the next daily reset timestamp (midnight UTC)
   */
  private getNextDailyReset(): number {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Get the next monthly reset timestamp (1st of next month, midnight UTC)
   */
  private getNextMonthlyReset(): number {
    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return nextMonth.getTime();
  }

  /**
   * Persist current cache to DB (non-blocking)
   */
  private async persistToDb(agentId: string, entry: CachedRateLimit): Promise<void> {
    const now = Date.now();
    if (now - entry.lastSynced < SYNC_INTERVAL_MS) return;

    try {
      const db = this.getPrisma();
      await db.agentRateLimit.upsert({
        where: { agentId },
        update: {
          dailyCount: entry.dailyCount,
          monthlyCount: entry.monthlyCount,
          dailyResetAt: new Date(entry.dailyResetAt),
          monthlyResetAt: new Date(entry.monthlyResetAt),
        },
        create: {
          agentId,
          tierPlan: entry.tierPlan,
          dailyCount: entry.dailyCount,
          monthlyCount: entry.monthlyCount,
          dailyResetAt: new Date(entry.dailyResetAt),
          monthlyResetAt: new Date(entry.monthlyResetAt),
        },
      });
      entry.lastSynced = now;
    } catch (err) {
      console.error("Failed to persist rate limit to DB:", err);
    }
  }

  /**
   * Check rate limit and increment counter. Returns null if allowed, error response if exceeded.
   */
  async checkAndIncrement(agentId: string): Promise<{
    allowed: boolean;
    tierPlan: RateLimitTier;
    dailyRemaining: number;
    monthlyRemaining: number;
    dailyResetAt: number;
    monthlyResetAt: number;
    errorMessage?: string;
  }> {
    const entry = await this.getOrCreateRateLimit(agentId);
    const limits = RATE_LIMITS[entry.tierPlan];

    const dailyLimit = limits.queriesPerDay;
    const monthlyLimit = limits.queriesPerMonth;

    // Check daily limit
    if (dailyLimit !== -1 && entry.dailyCount >= dailyLimit) {
      return {
        allowed: false,
        tierPlan: entry.tierPlan,
        dailyRemaining: 0,
        monthlyRemaining: monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - entry.monthlyCount),
        dailyResetAt: entry.dailyResetAt,
        monthlyResetAt: entry.monthlyResetAt,
        errorMessage:
          `Daily query limit exceeded (${dailyLimit}/day for "${entry.tierPlan}" tier). Resets at ${new Date(entry.dailyResetAt).toISOString()}.`,
      };
    }

    // Check monthly limit
    if (monthlyLimit !== -1 && entry.monthlyCount >= monthlyLimit) {
      return {
        allowed: false,
        tierPlan: entry.tierPlan,
        dailyRemaining: dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - entry.dailyCount),
        monthlyRemaining: 0,
        dailyResetAt: entry.dailyResetAt,
        monthlyResetAt: entry.monthlyResetAt,
        errorMessage:
          `Monthly query limit exceeded (${monthlyLimit}/month for "${entry.tierPlan}" tier). Resets at ${new Date(entry.monthlyResetAt).toISOString()}.`,
      };
    }

    // Increment counters
    entry.dailyCount += 1;
    entry.monthlyCount += 1;
    this.cache.set(agentId, entry);

    // Persist in background
    this.persistToDb(agentId, entry).catch(() => {}); // fire-and-forget

    const dailyRemaining = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - entry.dailyCount);
    const monthlyRemaining = monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - entry.monthlyCount);

    return {
      allowed: true,
      tierPlan: entry.tierPlan,
      dailyRemaining,
      monthlyRemaining,
      dailyResetAt: entry.dailyResetAt,
      monthlyResetAt: entry.monthlyResetAt,
    };
  }

  /**
   * Get current rate limit status without incrementing (for info endpoints)
   */
  async getStatus(agentId: string): Promise<{
    tierPlan: RateLimitTier;
    dailyUsed: number;
    monthlyUsed: number;
    dailyLimit: number;
    monthlyLimit: number;
    dailyResetAt: string;
    monthlyResetAt: string;
  }> {
    const entry = await this.getOrCreateRateLimit(agentId);
    const limits = RATE_LIMITS[entry.tierPlan];

    return {
      tierPlan: entry.tierPlan,
      dailyUsed: entry.dailyCount,
      monthlyUsed: entry.monthlyCount,
      dailyLimit: limits.queriesPerDay,
      monthlyLimit: limits.queriesPerMonth,
      dailyResetAt: new Date(entry.dailyResetAt).toISOString(),
      monthlyResetAt: new Date(entry.monthlyResetAt).toISOString(),
    };
  }

  /**
   * Clean up stale cache entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const staleThreshold = 3600_000; // 1 hour

    for (const [agentId, entry] of this.cache.entries()) {
      if (now - entry.lastSynced > staleThreshold) {
        this.cache.delete(agentId);
      }
    }
  }
}

export const apiMeteringService = new ApiMeteringService();

/**
 * Hono middleware factory for API metering.
 * Extracts agentId from the request body (for billing/query) or query param.
 */
export function apiMeteringMiddleware() {
  return async (c: Context, next: Next) => {
    // Extract agentId from different sources
    let agentId: string | undefined;

    // 1. From query param
    agentId = c.req.query("agentId");

    // 2. From request body (for POST requests)
    if (!agentId && c.req.method === "POST") {
      try {
        const clonedReq = c.req.raw.clone();
        const body = await clonedReq.json();
        agentId = body?.agentId;
      } catch {
        // Body may not be JSON, that's fine
      }
    }

    // 3. From path param
    if (!agentId) {
      agentId = c.req.param("agentId");
    }

    // If no agentId found, skip metering (allow request through)
    if (!agentId) {
      await next();
      return;
    }

    try {
      const result = await apiMeteringService.checkAndIncrement(agentId);

      // Set rate limit headers
      c.header("X-RateLimit-Tier", result.tierPlan);
      c.header("X-RateLimit-Remaining-Daily", String(result.dailyRemaining));
      c.header("X-RateLimit-Remaining-Monthly", String(result.monthlyRemaining));
      c.header("X-RateLimit-Reset-Daily", new Date(result.dailyResetAt).toISOString());
      c.header("X-RateLimit-Reset-Monthly", new Date(result.monthlyResetAt).toISOString());

      if (!result.allowed) {
        return c.json(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: result.errorMessage,
              tier: result.tierPlan,
              limits: RATE_LIMITS[result.tierPlan],
              resetAt: {
                daily: new Date(result.dailyResetAt).toISOString(),
                monthly: new Date(result.monthlyResetAt).toISOString(),
              },
            },
          },
          429,
        );
      }

      await next();
    } catch (err) {
      // If metering fails, log but don't block the request (fail-open)
      console.error("API metering error (fail-open):", err);
      await next();
    }
  };
}
