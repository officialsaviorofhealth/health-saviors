import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../app";

const predictionsRouter = new Hono();

const PLATFORM_FEE_RATE = 0.18; // 18% platform fee

// ── Zod schemas ──

const createMarketSchema = z.object({
  type: z.enum(["steps", "sleep", "exercise", "weight", "streak", "custom"]),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  targetValue: z.number().positive(),
  unit: z.string().min(1).max(30),
  deadline: z.string().datetime(),
});

const placeBetSchema = z.object({
  side: z.enum(["yes", "no"]),
  amount: z.number().int().min(5, "Minimum bet is 5 H2E"),
});

const resolveSchema = z.object({
  outcome: z.enum(["yes", "no"]),
});

// ── GET /api/v1/predictions — prediction market list ──
predictionsRouter.get("/", async (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");

  // Build filter conditions
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const markets = await prisma.predictionMarket.findMany({
    where,
    include: { bets: true },
    orderBy: { createdAt: "desc" },
  });

  const totalVolume = markets.reduce((s, p) => s + p.yesPool + p.noPool, 0);
  const totalRevenue = markets.reduce((s, p) => s + p.platformRevenue, 0);

  return c.json({
    success: true,
    data: markets.map((p) => {
      const totalPool = p.yesPool + p.noPool;
      return {
        id: p.id,
        type: p.type,
        title: p.title,
        description: p.description,
        targetValue: p.targetValue,
        unit: p.unit,
        deadline: p.deadline,
        status: p.status,
        yesPool: p.yesPool,
        noPool: p.noPool,
        totalPool,
        totalBettors: p.totalBettors,
        yesOdds: p.yesPool > 0 && p.noPool > 0 ? +(p.noPool / p.yesPool).toFixed(2) : 0,
        noOdds: p.yesPool > 0 && p.noPool > 0 ? +(p.yesPool / p.noPool).toFixed(2) : 0,
        platformFee: `${p.platformFeeRate * 100}%`,
        platformRevenue: p.platformRevenue,
        betsCount: p.bets.length,
        createdAt: p.createdAt,
        resolvedAt: p.resolvedAt,
      };
    }),
    meta: {
      totalMarkets: markets.length,
      openMarkets: markets.filter((p) => p.status === "open").length,
      totalVolume,
      totalPlatformRevenue: totalRevenue,
      avgPoolSize: markets.length > 0 ? Math.floor(totalVolume / markets.length) : 0,
    },
  });
});

// ── GET /api/v1/predictions/revenue — revenue dashboard ──
predictionsRouter.get("/revenue", async (c) => {
  // Daily revenue: group prediction_bets by date
  const dailyData = await prisma.$queryRaw<
    { date: string; volume: bigint; revenue: bigint; bettors: bigint }[]
  >`
    SELECT
      DATE(pb.created_at) AS date,
      COALESCE(SUM(pb.amount), 0) AS volume,
      COALESCE(SUM(FLOOR(pb.amount * ${PLATFORM_FEE_RATE})), 0) AS revenue,
      COUNT(DISTINCT pb.user_id) AS bettors
    FROM prediction_bets pb
    GROUP BY DATE(pb.created_at)
    ORDER BY date DESC
    LIMIT 30
  `;

  // Overall market summary
  const allMarkets = await prisma.predictionMarket.findMany();

  const totalVolume = allMarkets.reduce((s, p) => s + p.yesPool + p.noPool, 0);
  const totalRevenue = allMarkets.reduce((s, p) => s + p.platformRevenue, 0);
  const totalBettors = allMarkets.reduce((s, p) => s + p.totalBettors, 0);
  const resolvedMarkets = allMarkets.filter(
    (p) => p.status === "resolved_yes" || p.status === "resolved_no"
  ).length;

  // Statistics by type
  const types = ["steps", "sleep", "exercise", "weight", "streak", "custom"] as const;
  const byType = types.map((type) => {
    const filtered = allMarkets.filter((p) => p.type === type);
    return {
      type,
      markets: filtered.length,
      volume: filtered.reduce((s, p) => s + p.yesPool + p.noPool, 0),
      revenue: filtered.reduce((s, p) => s + p.platformRevenue, 0),
    };
  });

  return c.json({
    success: true,
    data: {
      summary: {
        totalVolume,
        totalRevenue,
        feeRate: `${PLATFORM_FEE_RATE * 100}%`,
        totalMarkets: allMarkets.length,
        totalBettors,
        resolvedMarkets,
      },
      dailyData: dailyData.map((d) => ({
        date: d.date,
        volume: Number(d.volume),
        revenue: Number(d.revenue),
        bettors: Number(d.bettors),
      })),
      byType,
    },
  });
});

// ── POST /api/v1/predictions — create a new prediction market ──
predictionsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createMarketSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, 400);
  }

  const { type, title, description, targetValue, unit, deadline } = parsed.data;

  const market = await prisma.predictionMarket.create({
    data: {
      type,
      title,
      description,
      targetValue,
      unit,
      deadline: new Date(deadline),
      status: "open",
      yesPool: 0,
      noPool: 0,
      totalBettors: 0,
      platformFeeRate: PLATFORM_FEE_RATE,
      platformRevenue: 0,
    },
  });

  return c.json({ success: true, data: market }, 201);
});

// ── POST /api/v1/predictions/:id/bet — place a bet ──
predictionsRouter.post("/:id/bet", async (c) => {
  const marketId = c.req.param("id");
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const parsed = placeBetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, 400);
  }

  const { side, amount } = parsed.data;

  // Verify the market exists
  const market = await prisma.predictionMarket.findUnique({ where: { id: marketId } });
  if (!market) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Market not found" } }, 404);
  if (market.status !== "open") return c.json({ success: false, error: { code: "MARKET_CLOSED", message: "Market is closed" } }, 400);

  // Verify the user's points
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ success: false, error: { code: "USER_NOT_FOUND" } }, 404);
  if (user.totalPoints < amount) {
    return c.json({ success: false, error: { code: "INSUFFICIENT_POINTS", message: `Insufficient points (you have ${user.totalPoints})` } }, 400);
  }

  // Calculate odds (based on the pool after the bet)
  const newYesPool = side === "yes" ? market.yesPool + amount : market.yesPool;
  const newNoPool = side === "no" ? market.noPool + amount : market.noPool;
  const totalPool = newYesPool + newNoPool;
  const winningPool = side === "yes" ? newYesPool : newNoPool;
  const potentialPayout = Math.floor(amount * (totalPool / winningPool) * (1 - PLATFORM_FEE_RATE));

  // Transaction: deduct points + create bet + update market + record point history
  const [bet, updatedMarket] = await prisma.$transaction([
    // Create the bet record
    prisma.predictionBet.create({
      data: {
        marketId,
        userId,
        side,
        amount,
        potentialPayout,
      },
    }),
    // Update the market pools
    prisma.predictionMarket.update({
      where: { id: marketId },
      data: {
        yesPool: newYesPool,
        noPool: newNoPool,
        totalBettors: { increment: 1 },
        platformRevenue: Math.floor(totalPool * PLATFORM_FEE_RATE),
      },
    }),
    // Deduct the user's points
    prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { decrement: amount } },
    }),
    // Record the point transaction
    prisma.pointTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: "PREDICTION_BET",
        description: `Prediction bet: ${market.title} (${side.toUpperCase()})`,
      },
    }),
  ]);

  return c.json({
    success: true,
    data: {
      betId: bet.id,
      predictionId: marketId,
      side,
      amount,
      potentialPayout,
      currentOdds: side === "yes"
        ? updatedMarket.noPool > 0 ? +(updatedMarket.noPool / updatedMarket.yesPool).toFixed(2) : 0
        : updatedMarket.yesPool > 0 ? +(updatedMarket.yesPool / updatedMarket.noPool).toFixed(2) : 0,
    },
  });
});

// ── POST /api/v1/predictions/:id/resolve — settle a market ──
predictionsRouter.post("/:id/resolve", async (c) => {
  const marketId = c.req.param("id");
  const body = await c.req.json();

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, 400);
  }

  const { outcome } = parsed.data;

  // Verify the market exists and check its status
  const market = await prisma.predictionMarket.findUnique({
    where: { id: marketId },
    include: { bets: true },
  });
  if (!market) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);
  if (market.status !== "open" && market.status !== "locked") {
    return c.json({ success: false, error: { code: "ALREADY_RESOLVED", message: "Market has already been settled" } }, 400);
  }

  const totalPool = market.yesPool + market.noPool;
  const winningPool = outcome === "yes" ? market.yesPool : market.noPool;
  const platformFee = Math.floor(totalPool * market.platformFeeRate);

  // Filter winning bets
  const winningBets = market.bets.filter((b) => b.side === outcome);
  const losingBets = market.bets.filter((b) => b.side !== outcome);

  // Calculate the payout for each winning bet: bet.amount * (totalPool / winningPool) * (1 - feeRate)
  const payoutUpdates = winningBets.map((bet) => {
    const payout = winningPool > 0
      ? Math.floor(bet.amount * (totalPool / winningPool) * (1 - market.platformFeeRate))
      : 0;
    return { betId: bet.id, userId: bet.userId, payout };
  });

  // Set payout = 0 for losing bets
  const losingUpdates = losingBets.map((bet) => ({
    betId: bet.id,
    userId: bet.userId,
    payout: 0,
  }));

  // Transaction: change market status + settle bets + pay out user points + record point history + platform revenue
  const resolvedStatus = outcome === "yes" ? "resolved_yes" : "resolved_no";

  await prisma.$transaction([
    // Update the market status
    prisma.predictionMarket.update({
      where: { id: marketId },
      data: {
        status: resolvedStatus as "resolved_yes" | "resolved_no",
        platformRevenue: platformFee,
        resolvedAt: new Date(),
      },
    }),
    // Record payouts for winning bets
    ...payoutUpdates.map((p) =>
      prisma.predictionBet.update({
        where: { id: p.betId },
        data: { payout: p.payout },
      })
    ),
    // Set payout = 0 for losing bets
    ...losingUpdates.map((p) =>
      prisma.predictionBet.update({
        where: { id: p.betId },
        data: { payout: 0 },
      })
    ),
    // Pay out points to winning users
    ...payoutUpdates.map((p) =>
      prisma.user.update({
        where: { id: p.userId },
        data: { totalPoints: { increment: p.payout } },
      })
    ),
    // Record point transactions for wins
    ...payoutUpdates.map((p) =>
      prisma.pointTransaction.create({
        data: {
          userId: p.userId,
          amount: p.payout,
          type: "PREDICTION_WIN",
          description: `Prediction win: ${market.title} (${outcome.toUpperCase()})`,
        },
      })
    ),
    // Record platform revenue
    prisma.platformRevenue.create({
      data: {
        source: "prediction",
        amount: platformFee * 0.01, // H2E → USD conversion (example rate)
        amountH2e: platformFee,
        metadata: {
          marketId: market.id,
          marketTitle: market.title,
          outcome,
          totalPool,
          winningPool,
          totalBettors: market.totalBettors,
        },
      },
    }),
  ]);

  return c.json({
    success: true,
    data: {
      marketId,
      outcome,
      totalPool,
      winningPool,
      platformFee,
      winnersCount: winningBets.length,
      losersCount: losingBets.length,
      payouts: payoutUpdates.map((p) => ({
        userId: p.userId,
        payout: p.payout,
      })),
    },
  });
});

// ── POST /api/v1/predictions/seed — seed demo markets ──
predictionsRouter.post("/seed", async (c) => {
  const seedData = [
    {
      type: "steps" as const,
      title: "Community 10K Steps Challenge",
      description: "Will the community average exceed 10,000 steps today?",
      targetValue: 10000,
      unit: "steps",
      deadline: new Date(Date.now() + 8 * 3600000),
      yesPool: 2340,
      noPool: 1560,
      totalBettors: 47,
    },
    {
      type: "sleep" as const,
      title: "7+ Hours Sleep Tonight",
      description: "Will 60% of active users log 7+ hours of sleep?",
      targetValue: 60,
      unit: "%",
      deadline: new Date(Date.now() + 14 * 3600000),
      yesPool: 4200,
      noPool: 3100,
      totalBettors: 89,
    },
    {
      type: "streak" as const,
      title: "Weekly Streak Survival",
      description: "Will more than 70% of users maintain their streak this week?",
      targetValue: 70,
      unit: "%",
      deadline: new Date(Date.now() + 4 * 86400000),
      yesPool: 8900,
      noPool: 5600,
      totalBettors: 156,
    },
    {
      type: "exercise" as const,
      title: "1000 Collective Workout Minutes",
      description: "Will the platform log 1000+ total workout minutes this week?",
      targetValue: 1000,
      unit: "minutes",
      deadline: new Date(Date.now() + 5 * 86400000),
      yesPool: 6300,
      noPool: 2800,
      totalBettors: 112,
    },
    {
      type: "weight" as const,
      title: "Average BMI Improvement",
      description: "Will users tracking weight show 0.5+ BMI improvement this month?",
      targetValue: 0.5,
      unit: "BMI",
      deadline: new Date(Date.now() - 2 * 86400000),
      status: "resolved_yes" as const,
      yesPool: 12500,
      noPool: 8200,
      totalBettors: 234,
      resolvedAt: new Date(Date.now() - 2 * 86400000),
      platformRevenue: Math.floor((12500 + 8200) * PLATFORM_FEE_RATE),
    },
    {
      type: "steps" as const,
      title: "Marathon Monday",
      description: "Will any user exceed 30,000 steps on Monday?",
      targetValue: 30000,
      unit: "steps",
      deadline: new Date(Date.now() - 5 * 86400000),
      status: "resolved_no" as const,
      yesPool: 3400,
      noPool: 7800,
      totalBettors: 98,
      resolvedAt: new Date(Date.now() - 5 * 86400000),
      platformRevenue: Math.floor((3400 + 7800) * PLATFORM_FEE_RATE),
    },
  ];

  const created = await prisma.$transaction(
    seedData.map((m) =>
      prisma.predictionMarket.create({
        data: {
          type: m.type,
          title: m.title,
          description: m.description,
          targetValue: m.targetValue,
          unit: m.unit,
          deadline: m.deadline,
          status: m.status ?? "open",
          yesPool: m.yesPool,
          noPool: m.noPool,
          totalBettors: m.totalBettors,
          platformFeeRate: PLATFORM_FEE_RATE,
          platformRevenue: m.platformRevenue ?? Math.floor((m.yesPool + m.noPool) * PLATFORM_FEE_RATE),
          resolvedAt: m.resolvedAt ?? null,
        },
      })
    )
  );

  return c.json({
    success: true,
    data: { seeded: created.length, markets: created },
  });
});

export { predictionsRouter };
