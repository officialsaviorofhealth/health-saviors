import { Hono } from "hono";
import { prisma } from "../app";

const analyticsRouter = new Hono();

// GET /api/v1/analytics/dashboard — User dashboard
analyticsRouter.get("/dashboard", async (c) => {
  const userId = c.get("userId") as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, totalPoints: true, level: true, lastCheckinDate: true },
  });
  if (!user) return c.json({ success: false, error: { code: "USER_NOT_FOUND" } }, 404);

  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

  const [entriesWeek, entriesMonth, entriesTotal, recentSymptoms, weekPts, monthPts] = await Promise.all([
    prisma.healthEntry.count({ where: { userId, createdAt: { gte: weekAgo } } }),
    prisma.healthEntry.count({ where: { userId, createdAt: { gte: monthAgo } } }),
    prisma.healthEntry.count({ where: { userId } }),
    prisma.symptomLog.findMany({
      where: { entry: { userId } }, orderBy: { onsetDate: "desc" }, take: 10,
      select: { displayName: true, severity: true, snomedCode: true, onsetDate: true },
    }),
    prisma.pointTransaction.aggregate({ where: { userId, createdAt: { gte: weekAgo } }, _sum: { amount: true } }),
    prisma.pointTransaction.aggregate({ where: { userId, createdAt: { gte: monthAgo } }, _sum: { amount: true } }),
  ]);

  const multiplier = getMultiplier(user.streakDays);
  const lvl = getLevelTitle(user.level);

  return c.json({
    success: true,
    data: {
      streak: { current: user.streakDays, best: user.streakDays, multiplier },
      level: { current: user.level, title: lvl.en, progress: Number(user.totalPoints) % 100 },
      points: { total: user.totalPoints.toString(), thisWeek: Number(weekPts._sum.amount || 0), thisMonth: Number(monthPts._sum.amount || 0) },
      entries: { total: entriesTotal, thisWeek: entriesWeek, thisMonth: entriesMonth },
      recentSymptoms,
    },
  });
});

// GET /api/v1/analytics/symptoms/trends — Symptom trends
analyticsRouter.get("/symptoms/trends", async (c) => {
  const userId = c.get("userId") as string;
  const days = parseInt(c.req.query("days") || "30");
  const since = new Date(); since.setDate(since.getDate() - days);

  const symptoms = await prisma.symptomLog.findMany({
    where: { entry: { userId }, onsetDate: { gte: since } },
    select: { displayName: true, onsetDate: true },
    orderBy: { onsetDate: "asc" },
  });

  const dateMap = new Map<string, Map<string, number>>();
  const symptomSet = new Set<string>();
  for (const s of symptoms) {
    const date = s.onsetDate.toISOString().split("T")[0];
    symptomSet.add(s.displayName);
    if (!dateMap.has(date)) dateMap.set(date, new Map());
    dateMap.get(date)!.set(s.displayName, (dateMap.get(date)!.get(s.displayName) || 0) + 1);
  }

  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const series = Array.from(symptomSet).map((name) => ({
    name,
    data: dates.map((date) => dateMap.get(date)?.get(name) || 0),
  }));

  return c.json({ success: true, data: { dates, series } });
});

// GET /api/v1/analytics/leaderboard — Leaderboard
analyticsRouter.get("/leaderboard", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

  const users = await prisma.user.findMany({
    orderBy: { totalPoints: "desc" }, take: limit,
    select: { walletAddress: true, streakDays: true, totalPoints: true, level: true },
  });

  return c.json({
    success: true,
    data: users.map((u, i) => ({
      rank: i + 1,
      walletAddress: `${u.walletAddress.slice(0, 6)}...${u.walletAddress.slice(-4)}`,
      streakDays: u.streakDays,
      totalPoints: u.totalPoints.toString(),
      level: u.level,
    })),
  });
});

function getMultiplier(streak: number): number {
  if (streak >= 90) return 500;
  if (streak >= 30) return 300;
  if (streak >= 14) return 200;
  if (streak >= 7) return 150;
  if (streak >= 3) return 120;
  return 100;
}

function getLevelTitle(level: number) {
  const t: Record<number, { en: string }> = {
    1: { en: "Health Rookie" }, 2: { en: "Health Explorer" },
    3: { en: "Health Tracker" }, 4: { en: "Health Guardian" },
    5: { en: "Health Master" },
  };
  return t[level] || t[1];
}

export { analyticsRouter };
