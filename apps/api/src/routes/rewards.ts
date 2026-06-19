import { Hono } from "hono";
import { prisma } from "../app";

const rewardRouter = new Hono();

// POST /api/v1/rewards/claim — Claim daily H2E points
rewardRouter.post("/claim", async (c) => {
  try {
    const userId = c.get("userId") as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ success: false, error: { code: "USER_NOT_FOUND" } }, 404);

    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingClaim = await prisma.pointTransaction.findFirst({
      where: { userId, type: "STREAK_BONUS", createdAt: { gte: today, lt: tomorrow } },
    });

    if (existingClaim) {
      return c.json({ success: false, error: { code: "ALREADY_CLAIMED", message: "You have already claimed your reward today" } }, 400);
    }

    // Sum unclaimed points for today
    const unclaimed = await prisma.pointTransaction.aggregate({
      where: { userId, type: { not: "STREAK_BONUS" }, createdAt: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
    });

    const claimable = Number(unclaimed._sum.amount || 0);
    if (claimable <= 0) {
      return c.json({ success: false, error: { code: "NOTHING_TO_CLAIM", message: "There are no rewards to claim" } }, 400);
    }

    // Credit points directly to user account
    await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: claimable } },
    });

    await prisma.pointTransaction.create({
      data: {
        userId, amount: claimable, type: "STREAK_BONUS", description: "Daily point claim",
      },
    });

    return c.json({
      success: true,
      data: { amount: claimable, claimableH2E: claimable, status: "confirmed" },
    });
  } catch (error: any) {
    console.error("Claim error:", error);
    return c.json({ success: false, error: { code: "CLAIM_ERROR", message: error.message } }, 500);
  }
});

// GET /api/v1/rewards/streak — Streak info
rewardRouter.get("/streak", async (c) => {
  const userId = c.get("userId") as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastCheckinDate: true, totalPoints: true, level: true },
  });
  if (!user) return c.json({ success: false, error: { code: "USER_NOT_FOUND" } }, 404);

  const multiplier = getMultiplier(user.streakDays);
  return c.json({
    success: true,
    data: { streakDays: user.streakDays, multiplier, lastCheckinDate: user.lastCheckinDate, totalPoints: user.totalPoints.toString(), level: user.level },
  });
});

// GET /api/v1/rewards/history — Reward history
rewardRouter.get("/history", async (c) => {
  const userId = c.get("userId") as string;
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  const [transactions, total] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit,
    }),
    prisma.pointTransaction.count({ where: { userId } }),
  ]);

  return c.json({
    success: true,
    data: transactions.map((tx) => ({
      id: tx.id, amount: Number(tx.amount), type: tx.type, description: tx.description, createdAt: tx.createdAt,
    })),
    meta: { page, limit, total },
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

export { rewardRouter };
