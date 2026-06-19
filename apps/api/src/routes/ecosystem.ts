// Ecosystem Routes — Public live dashboard endpoints
//
// These power the "live" activity dashboard and require no authentication.

import { Hono } from "hono";
import { prisma } from "../app";
import {
  getRealtimeStats,
  getRecentTransactions,
  getDailyGrowthMetrics,
  getAgentLeaderboard,
} from "../services/agent-simulator";

const ecosystemRouter = new Hono();

// ── GET /stats — Real-time ecosystem stats ──
ecosystemRouter.get("/stats", (c) => {
  const stats = getRealtimeStats();

  return c.json({
    success: true,
    data: {
      totalQueries24h: stats.totalQueries24h,
      totalQueriesAllTime: stats.totalQueriesAllTime,
      activeAgents24h: stats.activeAgents24h,
      totalAgents: stats.totalAgents,
      totalPointsDistributed24h: stats.totalPointsDistributed24h,
      totalDataProviders: stats.totalDataProviders,
      queryRate: stats.queryRate,
      topAgents: stats.topAgents,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      note: "Stats are updated in real-time from in-memory counters",
    },
  });
});

// ── GET /feed — Live activity feed (last 50 events) ──
ecosystemRouter.get("/feed", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);

  // Get from in-memory recent activity (fast path)
  const stats = getRealtimeStats();
  const memoryFeed = stats.recentActivity.slice(0, limit);

  // If memory feed is sparse, supplement from DB
  if (memoryFeed.length < limit) {
    try {
      const dbTransactions = await getRecentTransactions(prisma, limit);
      const dbFeed = dbTransactions.map((t) => ({
        id: t.id,
        agent: t.agentName,
        action: `${t.tier} query — ${t.pointsCharged} points charged, ${t.userShare} earned by provider`,
        user: t.userAnonymized,
        tier: t.tier,
        pointsCharged: t.pointsCharged,
        userShare: t.userShare,
        time: t.createdAt,
      }));

      return c.json({
        success: true,
        data: dbFeed,
        meta: {
          count: dbFeed.length,
          source: "database",
          generatedAt: new Date().toISOString(),
        },
      });
    } catch {
      // Fall through to memory feed
    }
  }

  return c.json({
    success: true,
    data: memoryFeed.map((item, idx) => ({
      id: `live-${Date.now()}-${idx}`,
      agent: item.agent,
      action: item.action,
      time: item.time,
    })),
    meta: {
      count: memoryFeed.length,
      source: "realtime",
      generatedAt: new Date().toISOString(),
    },
  });
});

// ── GET /leaderboard — Top agents by queries and revenue ──
ecosystemRouter.get("/leaderboard", async (c) => {
  try {
    const leaderboard = await getAgentLeaderboard(prisma);

    return c.json({
      success: true,
      data: leaderboard.map((agent, rank) => ({
        rank: rank + 1,
        id: agent.id,
        name: agent.name,
        category: agent.category,
        avatarEmoji: agent.avatarEmoji,
        accentColor: agent.accentColor,
        totalQueries: agent.totalQueries,
        queries24h: agent.queries24h,
        revenue24h: agent.revenue24h,
        lastActiveAt: agent.lastActiveAt,
      })),
      meta: {
        generatedAt: new Date().toISOString(),
        period: "24h stats with all-time totals",
      },
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: { code: "LEADERBOARD_ERROR", message: err.message },
    }, 500);
  }
});

// ── GET /growth — Daily growth metrics (past 30 days) ──
ecosystemRouter.get("/growth", async (c) => {
  const days = Math.min(parseInt(c.req.query("days") || "30"), 90);

  try {
    const metrics = await getDailyGrowthMetrics(prisma, days);

    // Calculate summary stats
    const totalQueries = metrics.reduce((sum, m) => sum + m.queries, 0);
    const totalPoints = metrics.reduce((sum, m) => sum + m.pointsDistributed, 0);
    const avgDailyQueries = metrics.length > 0
      ? Math.round(totalQueries / metrics.length)
      : 0;

    // Calculate growth rate (compare last 7 days vs previous 7 days)
    const last7 = metrics.slice(-7);
    const prev7 = metrics.slice(-14, -7);
    const last7Queries = last7.reduce((sum, m) => sum + m.queries, 0);
    const prev7Queries = prev7.reduce((sum, m) => sum + m.queries, 0);
    const growthRate = prev7Queries > 0
      ? Math.round(((last7Queries - prev7Queries) / prev7Queries) * 10000) / 100
      : 0;

    return c.json({
      success: true,
      data: {
        daily: metrics,
        summary: {
          totalQueries,
          totalPointsDistributed: totalPoints,
          avgDailyQueries,
          growthRate7d: growthRate,
          period: `${days} days`,
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
        days,
      },
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: { code: "GROWTH_ERROR", message: err.message },
    }, 500);
  }
});

export { ecosystemRouter };
