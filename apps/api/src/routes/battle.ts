import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../app";

const battleRouter = new Hono();

// ── Battle list ──
// GET /api/v1/battles — fetch battle list from DB (includes participants)
battleRouter.get("/", async (c) => {
  const statusFilter = c.req.query("status") as
    | "waiting"
    | "active"
    | "voting"
    | "settled"
    | "cancelled"
    | undefined;

  const battles = await prisma.battle.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      participants: {
        include: { agent: true },
        orderBy: { voteCount: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allBattles = battles.map((b) => {
    const totalVotes = b.participants.reduce((sum, p) => sum + p.voteCount, 0);
    return {
      id: b.id,
      topic: b.topic,
      status: b.status,
      entryFee: b.entryFee,
      prizePool: b.prizePool,
      spectatorPool: b.spectatorPool,
      agentCount: b.participants.length,
      totalVotes,
      platformRevenue: b.platformRevenue,
      startedAt: b.startedAt,
      endsAt: b.endsAt,
      winner: b.winnerId,
      agents: b.participants.map((p) => ({
        agentId: p.agentId,
        name: p.agent.name,
        emoji: p.agent.avatarEmoji,
        analysis: p.analysis,
        confidence: p.confidence,
        voteCount: p.voteCount,
        earnings: p.earnings,
        rank: p.rank,
        votePercentage: totalVotes > 0 ? Math.round((p.voteCount / totalVotes) * 100) : 0,
      })),
    };
  });

  return c.json({
    success: true,
    data: allBattles,
    meta: {
      totalBattles: allBattles.length,
      activeBattles: allBattles.filter((b) => b.status === "active").length,
      totalPrizePool: allBattles.reduce((s, b) => s + b.prizePool, 0),
      totalPlatformRevenue: allBattles.reduce((s, b) => s + b.platformRevenue, 0),
    },
  });
});

// ── Platform revenue statistics ──
// GET /api/v1/battles/revenue — fetch revenue statistics from the live DB
battleRouter.get("/revenue", async (c) => {
  // Overall battle statistics
  const allBattles = await prisma.battle.findMany({
    include: {
      participants: {
        include: { agent: true },
      },
    },
  });

  const settled = allBattles.filter((b) => b.status === "settled");
  const totalPrizeVolume = allBattles.reduce((s, b) => s + b.prizePool, 0);
  const totalSpectatorVolume = allBattles.reduce((s, b) => s + b.spectatorPool, 0);
  const platformRevenue = allBattles.reduce((s, b) => s + b.platformRevenue, 0);

  // Daily revenue aggregation (grouped by createdAt)
  const dailyRevenueRaw = await prisma.$queryRaw<
    { date: string; revenue: bigint; battles: bigint; spectators: bigint }[]
  >`
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(platform_revenue), 0)::bigint as revenue,
      COUNT(*)::bigint as battles,
      COALESCE(SUM(spectator_pool / NULLIF(spectator_fee, 0)), 0)::bigint as spectators
    FROM battles
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `;

  const dailyRevenue = dailyRevenueRaw
    .map((d) => ({
      date: String(d.date),
      revenue: Number(d.revenue),
      battles: Number(d.battles),
      spectators: Number(d.spectators),
    }))
    .reverse(); // oldest date first

  // Top agents (by earnings)
  const topAgentsRaw = await prisma.battleParticipant.groupBy({
    by: ["agentId"],
    _sum: { earnings: true, voteCount: true },
    _count: { id: true },
    orderBy: { _sum: { earnings: "desc" } },
    take: 20,
  });

  const agentIds = topAgentsRaw.map((a) => a.agentId);
  const agents = await prisma.aIAgent.findMany({
    where: { id: { in: agentIds } },
  });
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const topAgents = topAgentsRaw.map((a) => {
    const agent = agentMap.get(a.agentId);
    return {
      agentId: a.agentId,
      name: agent?.name ?? "Unknown",
      emoji: agent?.avatarEmoji ?? "\u{1F916}",
      totalEarnings: a._sum.earnings ?? 0,
      battles: a._count.id,
      totalVotes: a._sum.voteCount ?? 0,
    };
  });

  const totalVotes = allBattles.reduce(
    (s, b) => s + b.participants.reduce((vs, p) => vs + p.voteCount, 0),
    0
  );

  return c.json({
    success: true,
    data: {
      summary: {
        totalPrizeVolume,
        totalSpectatorVolume,
        platformRevenue,
        platformFeeRate: "15%",
        totalBattles: allBattles.length,
        settledBattles: settled.length,
        avgPrizePool:
          allBattles.length > 0 ? Math.floor(totalPrizeVolume / allBattles.length) : 0,
        avgSpectators:
          allBattles.length > 0 ? Math.floor(totalVotes / allBattles.length) : 0,
      },
      dailyRevenue,
      topAgents,
    },
  });
});

// ── Vote ──
// POST /api/v1/battles/:id/vote — cast a vote: deduct points, create BattleVote, increment voteCount
const voteSchema = z.object({
  agentId: z.string().uuid(),
});

battleRouter.post("/:id/vote", async (c) => {
  const battleId = c.req.param("id");
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "INVALID_INPUT", details: parsed.error.flatten() } }, 400);
  }
  const { agentId } = parsed.data;

  // Fetch battle
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { participants: { include: { agent: true } } },
  });
  if (!battle) {
    return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);
  }
  if (battle.status !== "active" && battle.status !== "voting") {
    return c.json({ success: false, error: { code: "BATTLE_NOT_VOTABLE" } }, 400);
  }

  // Verify the agent is a participant
  const participant = battle.participants.find((p) => p.agentId === agentId);
  if (!participant) {
    return c.json({ success: false, error: { code: "AGENT_NOT_IN_BATTLE" } }, 400);
  }

  // Check the user's points
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return c.json({ success: false, error: { code: "USER_NOT_FOUND" } }, 404);
  }
  if (user.totalPoints < battle.spectatorFee) {
    return c.json({ success: false, error: { code: "INSUFFICIENT_POINTS" } }, 400);
  }

  // Process the vote in a transaction (prevent duplicate votes via unique constraint)
  try {
    await prisma.$transaction([
      // Deduct user points
      prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { decrement: battle.spectatorFee } },
      }),
      // Create BattleVote
      prisma.battleVote.create({
        data: {
          battleId,
          userId,
          agentId,
          pointsPaid: battle.spectatorFee,
        },
      }),
      // Increment participant voteCount
      prisma.battleParticipant.update({
        where: { id: participant.id },
        data: { voteCount: { increment: 1 } },
      }),
      // Increment battle spectatorPool
      prisma.battle.update({
        where: { id: battleId },
        data: { spectatorPool: { increment: battle.spectatorFee } },
      }),
      // Record the point transaction
      prisma.pointTransaction.create({
        data: {
          userId,
          amount: -battle.spectatorFee,
          type: "BATTLE_VOTE",
          description: `Battle vote: ${battle.topic} - Agent ${agentId}`,
        },
      }),
    ]);
  } catch (err: any) {
    // Unique constraint violation = already voted
    if (err.code === "P2002") {
      return c.json({ success: false, error: { code: "ALREADY_VOTED" } }, 409);
    }
    throw err;
  }

  // Fetch the latest standings
  const updatedBattle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { participants: { include: { agent: true }, orderBy: { voteCount: "desc" } } },
  });
  const totalVotes = updatedBattle!.participants.reduce((s, p) => s + p.voteCount, 0);

  return c.json({
    success: true,
    data: {
      battleId,
      votedFor: agentId,
      spectatorFee: battle.spectatorFee,
      currentStandings: updatedBattle!.participants.map((p) => ({
        agentId: p.agentId,
        name: p.agent.name,
        voteCount: p.voteCount,
        votePercentage: totalVotes > 0 ? Math.round((p.voteCount / totalVotes) * 100) : 0,
      })),
    },
  });
});

// ── Create battle ──
// POST /api/v1/battles/create — create a new battle
const createSchema = z.object({
  topic: z.string().min(1).max(500),
  entryFee: z.number().int().positive(),
  endsAt: z.string().datetime().optional(),
});

battleRouter.post("/create", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "INVALID_INPUT", details: parsed.error.flatten() } }, 400);
  }
  const { topic, entryFee, endsAt } = parsed.data;

  const battle = await prisma.battle.create({
    data: {
      topic,
      entryFee,
      status: "waiting",
      startedAt: new Date(),
      endsAt: endsAt ? new Date(endsAt) : null,
    },
  });

  return c.json({
    success: true,
    data: battle,
  });
});

// ── Agent joins battle ──
// POST /api/v1/battles/:id/join — an agent joins a battle and pays the entry fee
const joinSchema = z.object({
  agentId: z.string().uuid(),
  analysis: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

battleRouter.post("/:id/join", async (c) => {
  const battleId = c.req.param("id");
  const body = await c.req.json();

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "INVALID_INPUT", details: parsed.error.flatten() } }, 400);
  }
  const { agentId, analysis, confidence } = parsed.data;

  // Verify the battle
  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle) {
    return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);
  }
  if (battle.status !== "waiting" && battle.status !== "active") {
    return c.json({ success: false, error: { code: "BATTLE_NOT_JOINABLE" } }, 400);
  }

  // Verify the agent
  const agent = await prisma.aIAgent.findUnique({ where: { id: agentId } });
  if (!agent) {
    return c.json({ success: false, error: { code: "AGENT_NOT_FOUND" } }, 404);
  }

  // Deduct the entry fee and create the participant (transaction)
  try {
    const [participant] = await prisma.$transaction([
      // Create BattleParticipant
      prisma.battleParticipant.create({
        data: {
          battleId,
          agentId,
          analysis,
          confidence,
        },
      }),
      // Increment battle prizePool & switch status to active
      prisma.battle.update({
        where: { id: battleId },
        data: {
          prizePool: { increment: battle.entryFee },
          status: "active",
        },
      }),
    ]);

    return c.json({
      success: true,
      data: {
        participantId: participant.id,
        battleId,
        agentId,
        entryFee: battle.entryFee,
        newPrizePool: battle.prizePool + battle.entryFee,
      },
    });
  } catch (err: any) {
    // Unique constraint violation = already joined
    if (err.code === "P2002") {
      return c.json({ success: false, error: { code: "ALREADY_JOINED" } }, 409);
    }
    throw err;
  }
});

// ── Battle settlement ──
// POST /api/v1/battles/:id/settle — determine the winner by votes and distribute earnings
battleRouter.post("/:id/settle", async (c) => {
  const battleId = c.req.param("id");

  // Fetch battle + participants
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        include: { agent: true },
        orderBy: { voteCount: "desc" },
      },
    },
  });
  if (!battle) {
    return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);
  }
  if (battle.status === "settled") {
    return c.json({ success: false, error: { code: "ALREADY_SETTLED" } }, 400);
  }
  if (battle.participants.length === 0) {
    return c.json({ success: false, error: { code: "NO_PARTICIPANTS" } }, 400);
  }

  // Sorted by vote ranking (already ordered by voteCount desc)
  const sorted = battle.participants;
  const totalPool = battle.prizePool + battle.spectatorPool;
  const feeRate = battle.platformFeeRate;
  const distributable = Math.floor(totalPool * (1 - feeRate));
  const platformFee = totalPool - distributable;

  // Earnings split: 1st 60%, 2nd 30%, 3rd 10%
  const shares = [0.6, 0.3, 0.1];
  const earningsMap: { id: string; earnings: number; rank: number }[] = sorted.map((p, i) => ({
    id: p.id,
    earnings: i < shares.length ? Math.floor(distributable * shares[i]) : 0,
    rank: i + 1,
  }));

  const winnerId = sorted[0].agentId;

  // Process the settlement in a transaction
  const txOps = [];

  // 1. Update each participant's earnings / rank
  for (const e of earningsMap) {
    txOps.push(
      prisma.battleParticipant.update({
        where: { id: e.id },
        data: { earnings: e.earnings, rank: e.rank },
      })
    );
  }

  // 2. Update battle status
  txOps.push(
    prisma.battle.update({
      where: { id: battleId },
      data: {
        status: "settled",
        winnerId,
        platformRevenue: platformFee,
        settledAt: new Date(),
      },
    })
  );

  // 3. Record PlatformRevenue
  txOps.push(
    prisma.platformRevenue.create({
      data: {
        source: "battle",
        amount: platformFee * 0.01, // H2E -> USD conversion (example rate)
        amountH2e: platformFee,
        metadata: {
          battleId,
          topic: battle.topic,
          prizePool: battle.prizePool,
          spectatorPool: battle.spectatorPool,
        },
      },
    })
  );

  // 4. Record point transactions for the winning agents (top 3)
  for (const e of earningsMap.filter((e) => e.earnings > 0)) {
    const participant = sorted.find((p) => p.id === e.id)!;
    // Agent-related earnings are recorded in AgentQueryLog
    txOps.push(
      prisma.agentQueryLog.create({
        data: {
          agentId: participant.agentId,
          action: "BATTLE_WIN",
          detail: `Battle settlement: ${battle.topic} - Rank #${e.rank}, Earnings: ${e.earnings} H2E`,
          amount: e.earnings,
        },
      })
    );
  }

  await prisma.$transaction(txOps);

  // Fetch the settlement result
  const settledBattle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        include: { agent: true },
        orderBy: { rank: "asc" },
      },
    },
  });

  return c.json({
    success: true,
    data: {
      battleId,
      topic: battle.topic,
      status: "settled",
      winnerId,
      totalPool,
      distributable,
      platformFee,
      standings: settledBattle!.participants.map((p) => ({
        agentId: p.agentId,
        name: p.agent.name,
        emoji: p.agent.avatarEmoji,
        rank: p.rank,
        voteCount: p.voteCount,
        earnings: p.earnings,
      })),
    },
  });
});

// ── Seed data generation ──
// POST /api/v1/battles/seed — pull agents from the live ai_agents table and create demo battles
battleRouter.post("/seed", async (c) => {
  // Fetch real agents
  const agents = await prisma.aIAgent.findMany({ take: 6 });
  if (agents.length < 2) {
    return c.json({
      success: false,
      error: { code: "NOT_ENOUGH_AGENTS", message: "At least 2 agents are required." },
    }, 400);
  }

  const topics = [
    { topic: "Chronic headache + sleep deprivation analysis" },
    { topic: "Post-workout muscle pain optimal recovery" },
    { topic: "Stress-related GI disorder management" },
    { topic: "Vitamin D deficiency vs Iron deficiency symptoms" },
  ];

  const statuses: Array<"waiting" | "active" | "voting" | "settled"> = [
    "active",
    "voting",
    "settled",
    "active",
  ];

  const analyses: string[] = [
    "Based on a comprehensive lifestyle analysis, restoring the sleep-activity balance is the top priority.",
    "Nutrient deficiency pattern analysis: 85% likelihood of magnesium/B12 deficiency.",
    "Sleep architecture analysis: deep sleep ratio is at the lower bound of the normal range.",
    "Cross-referencing medical databases shows this symptom combination correlates 87% with iron deficiency.",
    "Cardiovascular risk assessment: within the normal range based on current vital data.",
    "Neuropsychological analysis: current stress level matches an elevated cortisol pattern.",
  ];

  const createdBattles = [];

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const status = statuses[i % 4];
    const entryFee = [20, 50, 100, 200][i % 4];

    // Randomly select 3-4 agents
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const selectedAgents = shuffled.slice(0, Math.min(3 + (i % 2), agents.length));

    // Generate vote counts
    const totalVotes = 50 + Math.floor(Math.random() * 200);
    let remaining = totalVotes;
    const voteCounts = selectedAgents.map((_, j) => {
      if (j === selectedAgents.length - 1) return Math.max(0, remaining);
      const v = Math.floor(remaining * (0.15 + Math.random() * 0.4));
      remaining -= v;
      return v;
    });
    // Sort vote counts in descending order
    voteCounts.sort((a, b) => b - a);

    const prizePool = entryFee * selectedAgents.length;
    const spectatorPool = totalVotes * 5;
    const platformFee = Math.floor((prizePool + spectatorPool) * 0.15);
    const distributable = Math.floor((prizePool + spectatorPool) * 0.85);

    // Create battle
    const battle = await prisma.battle.create({
      data: {
        topic: t.topic,
        status,
        entryFee,
        prizePool,
        spectatorPool,
        platformRevenue: status === "settled" ? platformFee : 0,
        winnerId: status === "settled" ? selectedAgents[0].id : null,
        startedAt: new Date(Date.now() - (30 + i * 15) * 60000),
        endsAt: new Date(Date.now() + (60 - i * 10) * 60000),
        settledAt: status === "settled" ? new Date() : null,
      },
    });

    // Create participants
    for (let j = 0; j < selectedAgents.length; j++) {
      const agent = selectedAgents[j];
      const earnings =
        status === "settled"
          ? j === 0
            ? Math.floor(distributable * 0.6)
            : j === 1
              ? Math.floor(distributable * 0.3)
              : j === 2
                ? Math.floor(distributable * 0.1)
                : 0
          : 0;

      await prisma.battleParticipant.create({
        data: {
          battleId: battle.id,
          agentId: agent.id,
          analysis: analyses[j % analyses.length],
          confidence: 0.75 + Math.random() * 0.2,
          voteCount: voteCounts[j],
          earnings,
          rank: status === "settled" ? j + 1 : null,
        },
      });
    }

    createdBattles.push(battle);
  }

  // Record PlatformRevenue (for settled battles)
  for (const b of createdBattles.filter((b) => b.status === "settled")) {
    await prisma.platformRevenue.create({
      data: {
        source: "battle",
        amount: b.platformRevenue * 0.01,
        amountH2e: b.platformRevenue,
        metadata: { battleId: b.id, topic: b.topic, seeded: true },
      },
    });
  }

  return c.json({
    success: true,
    data: {
      created: createdBattles.length,
      battles: createdBattles.map((b) => ({
        id: b.id,
        topic: b.topic,
        status: b.status,
        entryFee: b.entryFee,
        prizePool: b.prizePool,
      })),
    },
  });
});

export { battleRouter };
