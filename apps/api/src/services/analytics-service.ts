// Analytics Service — Health data aggregation + AI insight generation
// Integrates PatternAnalyzer for trends, correlations, and predictive warnings
// Uses cache layer for performance

import { prisma } from "../app";
import { patternAnalyzer } from "../../../../packages/ai-scribe/pipeline/pattern-analyzer";
import { analyticsCache, CacheKeys } from "./cache";

export class AnalyticsService {
  async getUserAnalytics(userId: string, language: "ko" | "en" = "ko") {
    // Try cache first (2 min TTL)
    const cacheKey = CacheKeys.dashboardData(userId);
    const cached = analyticsCache.get<any>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

    const [user, weekEntries, monthEntries, totalEntries, recentSymptomLogs, topSymptoms] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { streakDays: true, totalPoints: true, level: true } }),
      prisma.healthEntry.count({ where: { userId, createdAt: { gte: weekAgo } } }),
      prisma.healthEntry.count({ where: { userId, createdAt: { gte: monthAgo } } }),
      prisma.healthEntry.count({ where: { userId } }),
      prisma.symptomLog.findMany({
        where: { entry: { userId }, onsetDate: { gte: monthAgo } },
        orderBy: { onsetDate: "desc" },
        take: 100,
        select: { displayName: true, severity: true, snomedCode: true, onsetDate: true },
      }),
      prisma.symptomLog.groupBy({
        by: ["displayName", "snomedCode"],
        where: { entry: { userId }, onsetDate: { gte: monthAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    // ── Pattern Analysis ──
    const symptomLogs = recentSymptomLogs.map(s => ({
      ...s,
      onsetDate: s.onsetDate.toISOString().split("T")[0],
    }));
    const trends = patternAnalyzer.analyzeTrends(symptomLogs as any, 30);
    const recurringPatterns = patternAnalyzer.detectRecurringPatterns(trends);
    const correlations = patternAnalyzer.detectCorrelations(trends, language);
    const predictiveWarnings = patternAnalyzer.generatePredictiveWarnings(trends, language);

    const streakCalendar = await this.generateStreakCalendar(userId, 30);

    // ── AI Insight Generation ──
    const aiInsight = await patternAnalyzer.generateInsight({
      recentSymptoms: trends,
      topSymptoms: trends.slice(0, 5),
      streakHistory: streakCalendar,
      weeklyEntryCount: weekEntries,
      monthlyEntryCount: monthEntries,
    }, language);

    // ── GPT Deep Insight (async, non-blocking) ──
    let aiDeepInsight: string | null = null;
    if (trends.length >= 3 && process.env.OPENAI_API_KEY) {
      aiDeepInsight = await patternAnalyzer.generateAIInsight(
        trends, language, process.env.OPENAI_API_KEY,
      );
    }

    const result = {
      user: user ? { streakDays: user.streakDays, totalPoints: user.totalPoints, level: user.level } : null,
      recentSymptoms: recentSymptomLogs.slice(0, 10),
      topSymptoms: topSymptoms.map((s) => ({ name: s.displayName, snomedCode: s.snomedCode, count: s._count.id })),
      streakHistory: streakCalendar,
      weeklyEntryCount: weekEntries,
      monthlyEntryCount: monthEntries,
      totalEntries,
      // AI-powered insights
      aiInsight,
      aiDeepInsight,
      recurringPatterns,
      correlations,
      predictiveWarnings,
    };

    // Cache for 2 minutes
    analyticsCache.set(cacheKey, result, 120_000);
    return result;
  }

  // Get symptom trends for chart
  async getSymptomTrends(userId: string, days: number = 30) {
    const cacheKey = CacheKeys.symptomTrends(userId, days);
    return analyticsCache.getOrSet(cacheKey, async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const logs = await prisma.symptomLog.findMany({
        where: { entry: { userId }, onsetDate: { gte: since } },
        select: { displayName: true, severity: true, snomedCode: true, onsetDate: true },
        orderBy: { onsetDate: "asc" },
      });

      const symptomLogs = logs.map(s => ({
        ...s,
        onsetDate: s.onsetDate.toISOString().split("T")[0],
      }));

      return patternAnalyzer.analyzeTrends(symptomLogs as any, days);
    }, 120_000);
  }

  private async generateStreakCalendar(userId: string, days: number) {
    const now = new Date();
    const since = new Date(now); since.setDate(since.getDate() - days);

    const entries = await prisma.healthEntry.findMany({
      where: { userId, entryDate: { gte: since } },
      select: { entryDate: true },
    });
    const loggedDates = new Set(entries.map((e) => e.entryDate.toISOString().split("T")[0]));

    const cal = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      cal.push({ date: dateStr, logged: loggedDates.has(dateStr) });
    }
    return cal;
  }
}

export const analyticsService = new AnalyticsService();
