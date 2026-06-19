// In-Memory Cache Service — TTL-based caching layer
// Reduces DB/API calls for frequently accessed data
// Future: Redis adapter when REDIS_URL is configured

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

export class CacheService {
  private store = new Map<string, CacheEntry<any>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs: number = 60_000) {
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupIntervalMs);
  }

  // Get cached value
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.hits++;
    return entry.value as T;
  }

  // Set value with TTL (ms)
  set<T>(key: string, value: T, ttlMs: number = 300_000): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      hits: 0,
    });
  }

  // Get or compute value
  async getOrSet<T>(key: string, compute: () => Promise<T>, ttlMs: number = 300_000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }

  // Delete specific key
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  // Delete keys matching pattern
  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  // Invalidate all user-related cache
  invalidateUser(userId: string): number {
    return this.invalidatePattern(`user:${userId}`);
  }

  // Cache stats
  stats(): { size: number; hitRate: string } {
    let totalHits = 0;
    let entries = 0;
    for (const entry of this.store.values()) {
      totalHits += entry.hits;
      entries++;
    }
    return {
      size: entries,
      hitRate: entries > 0 ? `${(totalHits / Math.max(entries, 1)).toFixed(1)} avg hits/key` : "0",
    };
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// ── Pre-configured cache instances ──

// User data cache (5 min TTL)
export const userCache = new CacheService();

// SNOMED lookup cache (1 hour TTL — static data)
export const snomedCache = new CacheService();

// Analytics cache (2 min TTL — semi-live data)
export const analyticsCache = new CacheService();

// Cache key builders
export const CacheKeys = {
  userProfile: (userId: string) => `user:${userId}:profile`,
  userStreak: (userId: string) => `user:${userId}:streak`,
  userAnalytics: (userId: string) => `user:${userId}:analytics`,
  dashboardData: (userId: string) => `user:${userId}:dashboard`,
  symptomTrends: (userId: string, days: number) => `user:${userId}:trends:${days}`,
  leaderboard: (limit: number) => `global:leaderboard:${limit}`,
  activeMedications: (userId: string) => `user:${userId}:medications`,
} as const;
