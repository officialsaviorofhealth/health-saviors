import { Hono } from "hono";
import { prisma } from "../app";
import { createHash, randomBytes } from "crypto";

const agentRouter = new Hono();

// GET /api/v1/agents — List agents with filters
agentRouter.get("/", async (c) => {
  const category = c.req.query("category");
  const status = c.req.query("status");
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  const where: any = {};
  if (category) where.category = category;
  if (status) where.status = status;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [agents, total] = await Promise.all([
    prisma.aIAgent.findMany({
      where, orderBy: { totalQueries: "desc" }, skip: (page - 1) * limit, take: limit,
    }),
    prisma.aIAgent.count({ where }),
  ]);

  return c.json({
    success: true,
    data: agents.map((a) => ({
      id: a.id, name: a.name, category: a.category, status: a.status,
      description: a.description,
      avatarEmoji: a.avatarEmoji, accentColor: a.accentColor,
      capabilities: a.capabilities, pricingTier: a.pricingTier,
      totalQueries: a.totalQueries.toString(), uptime: a.uptime,
    })),
    meta: { page, limit, total },
  });
});

// GET /api/v1/agents/stats/summary — Agent platform stats
agentRouter.get("/stats/summary", async (c) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalAgents, activeAgents, queriesToday] = await Promise.all([
    prisma.aIAgent.count(),
    prisma.aIAgent.count({ where: { status: "active" } }),
    prisma.agentQueryLog.count({ where: { createdAt: { gte: today } } }),
  ]);

  return c.json({
    success: true,
    data: { totalAgents, activeAgents, queriesToday, totalPointsVolume: 0 },
  });
});

// GET /api/v1/agents/:id — Single agent detail
agentRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const agent = await prisma.aIAgent.findUnique({ where: { id } });
  if (!agent) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);

  return c.json({
    success: true,
    data: {
      id: agent.id, name: agent.name, category: agent.category, status: agent.status,
      description: agent.description,
      avatarEmoji: agent.avatarEmoji, accentColor: agent.accentColor,
      capabilities: agent.capabilities, pricingTier: agent.pricingTier,
      endpointUrl: agent.endpointUrl, totalQueries: agent.totalQueries.toString(),
      uptime: agent.uptime, lastActiveAt: agent.lastActiveAt,
    },
  });
});

// POST /api/v1/agents/register — Register new agent
agentRouter.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const { name, category, description, capabilities, endpointUrl, walletAddress, avatarEmoji, accentColor } = body;

    if (!name || !category || !endpointUrl || !walletAddress) {
      return c.json({ success: false, error: { code: "MISSING_FIELDS" } }, 400);
    }

    const apiKey = randomBytes(32).toString("hex");
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

    const agent = await prisma.aIAgent.create({
      data: {
        name, category, description: description || "",
        capabilities: capabilities || [], endpointUrl,
        walletAddress: walletAddress.toLowerCase(),
        avatarEmoji: avatarEmoji || "🤖", accentColor: accentColor || "#00ff88",
        apiKeyHash, authMethod: "api-key",
      },
    });

    return c.json({ success: true, data: { id: agent.id, apiKey, walletAddress: agent.walletAddress } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "REGISTER_ERROR", message: error.message } }, 500);
  }
});

// GET /api/v1/agents/:id/activity — Agent activity log
agentRouter.get("/:id/activity", async (c) => {
  const id = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

  const logs = await prisma.agentQueryLog.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return c.json({
    success: true,
    data: logs.map((l) => ({
      id: l.id, action: l.action, detail: l.detail,
      amount: l.amount ? Number(l.amount) : null, createdAt: l.createdAt,
    })),
  });
});

// GET /api/v1/agents/:id/earnings — Agent earnings across all BM streams
agentRouter.get("/:id/earnings", async (c) => {
  const id = c.req.param("id");

  const [agent, battleEarnings, queryBillings] = await Promise.all([
    prisma.aIAgent.findUnique({ where: { id } }),
    prisma.battleParticipant.findMany({
      where: { agentId: id },
      include: { battle: { select: { topic: true, status: true, createdAt: true } } },
    }),
    prisma.queryBilling.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!agent) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);

  const totalBattleEarnings = battleEarnings.reduce((s, bp) => s + bp.earnings, 0);
  const totalQueryEarnings = queryBillings.reduce((s, q) => s + q.developerShare, 0);
  const totalBattles = battleEarnings.length;
  const wins = battleEarnings.filter((bp) => bp.rank === 1).length;

  return c.json({
    success: true,
    data: {
      agentId: id,
      agentName: agent.name,
      summary: {
        totalEarnings: totalBattleEarnings + totalQueryEarnings,
        battleEarnings: totalBattleEarnings,
        queryEarnings: totalQueryEarnings,
        totalBattles,
        wins,
        winRate: totalBattles > 0 ? `${((wins / totalBattles) * 100).toFixed(1)}%` : "0%",
        totalQueries: Number(agent.totalQueries),
      },
      recentBattles: battleEarnings.slice(0, 10).map((bp) => ({
        battleTopic: bp.battle.topic,
        status: bp.battle.status,
        rank: bp.rank,
        earnings: bp.earnings,
        voteCount: bp.voteCount,
        date: bp.battle.createdAt,
      })),
      recentQueries: queryBillings.slice(0, 10).map((q) => ({
        tier: q.tier,
        developerShare: q.developerShare,
        date: q.createdAt,
      })),
    },
  });
});

// GET /api/v1/agents/leaderboard — Top agents by earnings
agentRouter.get("/leaderboard/top", async (c) => {
  const agents = await prisma.aIAgent.findMany({
    orderBy: { totalQueries: "desc" },
    take: 20,
    include: {
      battleParticipants: {
        select: { earnings: true, rank: true },
      },
    },
  });

  const leaderboard = agents.map((a) => {
    const totalBattleEarnings = a.battleParticipants.reduce((s, bp) => s + bp.earnings, 0);
    const wins = a.battleParticipants.filter((bp) => bp.rank === 1).length;
    return {
      id: a.id,
      name: a.name,
      avatarEmoji: a.avatarEmoji,
      category: a.category,
      totalEarnings: totalBattleEarnings,
      battles: a.battleParticipants.length,
      wins,
      totalQueries: Number(a.totalQueries),
      uptime: a.uptime,
    };
  });

  leaderboard.sort((a, b) => b.totalEarnings - a.totalEarnings);

  return c.json({ success: true, data: leaderboard });
});

// POST /api/v1/agents/seed — Seed demo agents
agentRouter.post("/seed", async (c) => {
  const demoAgents = [
    { name: "HealthCoach Pro", category: "wellness", description: "Comprehensive lifestyle analysis with sleep-activity balance", avatarEmoji: "🏃", accentColor: "#00ff88", capabilities: ["health-analysis", "battle", "recommendation"], endpointUrl: "https://agents.healthsaviors.io/coach-v2" },
    { name: "NutriAnalyst", category: "nutrition", description: "AI-powered nutritional deficiency pattern detection", avatarEmoji: "🥗", accentColor: "#4ade80", capabilities: ["nutrition-analysis", "battle", "commerce"], endpointUrl: "https://agents.healthsaviors.io/nutri-ai" },
    { name: "SleepDoctor AI", category: "sleep", description: "Sleep architecture analysis and circadian rhythm optimization", avatarEmoji: "😴", accentColor: "#8b5cf6", capabilities: ["sleep-analysis", "battle", "prediction"], endpointUrl: "https://agents.healthsaviors.io/sleep-doc" },
    { name: "MedSage", category: "medical", description: "Medical database cross-reference and SNOMED CT mapping", avatarEmoji: "🧬", accentColor: "#06b6d4", capabilities: ["medical-analysis", "battle", "data-curation"], endpointUrl: "https://agents.healthsaviors.io/med-sage" },
    { name: "CardioGuard", category: "cardiology", description: "Cardiovascular risk assessment from vital data", avatarEmoji: "❤️", accentColor: "#ef4444", capabilities: ["cardio-analysis", "battle", "wearable"], endpointUrl: "https://agents.healthsaviors.io/cardio-bot" },
    { name: "NeuroWellness", category: "mental", description: "Neuropsychological analysis and stress management", avatarEmoji: "🧠", accentColor: "#f59e0b", capabilities: ["mental-health", "battle", "prediction"], endpointUrl: "https://agents.healthsaviors.io/neuro-ai" },
  ];

  const created = [];
  for (const agentData of demoAgents) {
    const apiKey = randomBytes(32).toString("hex");
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
    const walletAddress = "0x" + randomBytes(20).toString("hex");

    const existing = await prisma.aIAgent.findFirst({ where: { name: agentData.name } });
    if (existing) {
      created.push({ id: existing.id, name: existing.name, status: "already_exists" });
      continue;
    }

    const agent = await prisma.aIAgent.create({
      data: {
        ...agentData,
        walletAddress,
        apiKeyHash,
        authMethod: "api-key",
        pricingTier: "basic",
        status: "active",
        totalQueries: BigInt(Math.floor(Math.random() * 5000)),
        uptime: 95 + Math.random() * 5,
        lastActiveAt: new Date(),
      },
    });
    created.push({ id: agent.id, name: agent.name, apiKey, status: "created" });
  }

  return c.json({ success: true, data: { agents: created } });
});

export { agentRouter };
