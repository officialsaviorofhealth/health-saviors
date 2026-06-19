// Billing Routes — Agent query billing, earnings, and revenue sharing

import { Hono } from "hono";
import { prisma } from "../app";
import {
  agentBillingService,
  BillingError,
  QUERY_PRICING,
  REVENUE_SPLIT,
  type QueryTier,
} from "../services/agent-billing";

const billingRouter = new Hono();

// ── POST /api/v1/billing/query — Execute a billable query ──
billingRouter.post("/query", async (c) => {
  try {
    const requesterId = c.get("userId") as string;
    const body = await c.req.json();
    const { agentId, targetUserId, tier, dataFields } = body;

    // Validate required fields
    if (!agentId || !targetUserId || !tier) {
      return c.json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "agentId, targetUserId, and tier are required",
        },
      }, 400);
    }

    // Validate tier
    if (!QUERY_PRICING[tier as QueryTier]) {
      return c.json({
        success: false,
        error: {
          code: "INVALID_TIER",
          message: `Invalid tier "${tier}". Valid: ${Object.keys(QUERY_PRICING).join(", ")}`,
        },
      }, 400);
    }

    // Prevent self-query billing (requester should not be the data provider)
    if (requesterId === targetUserId) {
      return c.json({
        success: false,
        error: {
          code: "SELF_QUERY_NOT_ALLOWED",
          message: "Cannot bill a query for your own data",
        },
      }, 400);
    }

    // Validate dataFields against tier
    const allowedFields = agentBillingService.getAvailableDataFields(tier as QueryTier);
    if (dataFields && Array.isArray(dataFields)) {
      const invalidFields = dataFields.filter((f: string) => !allowedFields.includes(f));
      if (invalidFields.length > 0) {
        return c.json({
          success: false,
          error: {
            code: "INVALID_DATA_FIELDS",
            message: `Fields not available in "${tier}" tier: ${invalidFields.join(", ")}. ` +
              `Available: ${allowedFields.join(", ")}`,
          },
        }, 400);
      }
    }

    const billing = await agentBillingService.chargeQuery(
      agentId,
      targetUserId,
      requesterId,
      tier as QueryTier,
      dataFields,
    );

    return c.json({
      success: true,
      data: {
        receipt: {
          queryId: billing.queryId,
          tier: billing.tier,
          pointsCharged: billing.pointsCharged,
          breakdown: {
            platformShare: billing.platformShare,
            dataProviderShare: billing.userShare,
            developerShare: billing.developerShare,
          },
          dataIncluded: billing.dataIncluded,
          createdAt: billing.createdAt,
        },
        agentId: billing.agentId,
        targetUserId: billing.userId,
      },
    });
  } catch (error: any) {
    if (error instanceof BillingError) {
      const statusMap: Record<string, number> = {
        INVALID_TIER: 400,
        AGENT_NOT_FOUND: 404,
        USER_NOT_FOUND: 404,
        REQUESTER_NOT_FOUND: 404,
        NO_DATA_CONSENT: 403,
        INSUFFICIENT_POINTS: 402,
      };
      const status = statusMap[error.code] || 400;
      return c.json({ success: false, error: { code: error.code, message: error.message } }, status as any);
    }
    console.error("Billing query error:", error);
    return c.json({
      success: false,
      error: {
        code: "BILLING_ERROR",
        message: "An unexpected billing error occurred",
      },
    }, 500);
  }
});

// ── GET /api/v1/billing/earnings — Get earnings for authenticated user ──
billingRouter.get("/earnings", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const period = c.req.query("period") || "month";

    // Get earnings as data provider
    const dataEarnings = await agentBillingService.getUserDataEarnings(userId, period);

    // Get earnings as agent developer — find agents owned by this user
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    let agentEarnings: any = null;
    if (userRecord?.walletAddress) {
      // Find agents registered by this user's wallet
      const agents = await prisma.aIAgent.findMany({
        where: { walletAddress: userRecord.walletAddress },
        select: { id: true, name: true },
      });

      if (agents.length > 0) {
        const agentEarningsList = await Promise.all(
          agents.map(async (agent) => {
            const earnings = await agentBillingService.getAgentEarnings(agent.id, period);
            return {
              agentId: agent.id,
              agentName: agent.name,
              ...earnings,
            };
          }),
        );
        agentEarnings = agentEarningsList;
      }
    }

    // Also get query history where this user was the requester
    const spentHistory = await agentBillingService.getQueryHistory(
      { requesterId: userId },
      10,
      0,
    );

    return c.json({
      success: true,
      data: {
        asDataProvider: {
          totalEarned: dataEarnings.totalEarned,
          queryCount: dataEarnings.queryCount,
          period: { start: dataEarnings.periodStart, end: dataEarnings.periodEnd },
          breakdown: dataEarnings.breakdown,
        },
        asAgentDeveloper: agentEarnings,
        asRequester: {
          recentQueries: spentHistory.data.length,
          totalSpent: spentHistory.data.reduce((sum, q) => sum + q.pointsCharged, 0),
        },
      },
    });
  } catch (error: any) {
    console.error("Earnings fetch error:", error);
    return c.json({
      success: false,
      error: {
        code: "EARNINGS_ERROR",
        message: "Failed to fetch earnings",
      },
    }, 500);
  }
});

// ── GET /api/v1/billing/earnings/agent/:agentId — Agent-specific earnings ──
billingRouter.get("/earnings/agent/:agentId", async (c) => {
  try {
    const agentId = c.req.param("agentId");
    const period = c.req.query("period") || "month";
    const userId = c.get("userId") as string;

    // Verify user owns this agent (via wallet address)
    const agent = await prisma.aIAgent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return c.json({ success: false, error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } }, 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    // Admin check or ownership check
    const isOwner = user?.walletAddress && agent.walletAddress &&
      user.walletAddress.toLowerCase() === agent.walletAddress.toLowerCase();

    if (!isOwner) {
      return c.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not own this agent",
        },
      }, 403);
    }

    const earnings = await agentBillingService.getAgentEarnings(agentId, period);

    return c.json({
      success: true,
      data: {
        agentId,
        agentName: agent.name,
        ...earnings,
      },
    });
  } catch (error: any) {
    if (error instanceof BillingError) {
      return c.json({ success: false, error: { code: error.code, message: error.message } }, 404);
    }
    console.error("Agent earnings error:", error);
    return c.json({
      success: false,
      error: {
        code: "AGENT_EARNINGS_ERROR",
        message: "Failed to fetch agent earnings",
      },
    }, 500);
  }
});

// ── GET /api/v1/billing/revenue — Platform revenue (admin only) ──
billingRouter.get("/revenue", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const period = c.req.query("period") || "month";

    // Simple admin check — in production, use a proper RBAC system
    const adminWallets = (process.env.ADMIN_WALLETS || "").toLowerCase().split(",").filter(Boolean);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    const isAdmin = user?.walletAddress && adminWallets.includes(user.walletAddress.toLowerCase());

    // In development mode, allow all users
    if (!isAdmin && process.env.NODE_ENV !== "development") {
      return c.json({
        success: false,
        error: {
          code: "ADMIN_REQUIRED",
          message: "Admin access required",
        },
      }, 403);
    }

    const revenue = await agentBillingService.getPlatformRevenue(period);

    return c.json({
      success: true,
      data: revenue,
    });
  } catch (error: any) {
    console.error("Platform revenue error:", error);
    return c.json({
      success: false,
      error: {
        code: "REVENUE_ERROR",
        message: "Failed to fetch platform revenue",
      },
    }, 500);
  }
});

// ── GET /api/v1/billing/history — Query billing history for authenticated user ──
billingRouter.get("/history", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const role = c.req.query("role") || "requester"; // requester | provider
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    let filters: { agentId?: string; userId?: string; requesterId?: string };

    if (role === "provider") {
      // Queries where this user's data was used
      filters = { userId };
    } else {
      // Queries made by this user
      filters = { requesterId: userId };
    }

    const { data, total } = await agentBillingService.getQueryHistory(filters, limit, offset);

    return c.json({
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("Query history error:", error);
    return c.json({
      success: false,
      error: {
        code: "HISTORY_ERROR",
        message: "Failed to fetch query history",
      },
    }, 500);
  }
});

// ── GET /api/v1/billing/pricing — Get pricing tiers (public info) ──
billingRouter.get("/pricing", async (c) => {
  const tiers = Object.entries(QUERY_PRICING).map(([tier, points]) => {
    const availableData = agentBillingService.getAvailableDataFields(tier as QueryTier);
    return {
      tier,
      pointsPerQuery: points,
      dataFields: availableData,
      revenueSplit: {
        platform: `${REVENUE_SPLIT.platform * 100}%`,
        dataProvider: `${REVENUE_SPLIT.dataProvider * 100}%`,
        agentDeveloper: `${REVENUE_SPLIT.agentDeveloper * 100}%`,
      },
    };
  });

  return c.json({
    success: true,
    data: {
      tiers,
      description: {
        en: "Points are charged per query. Revenue is split between the platform, data provider (user), and agent developer.",
      },
    },
  });
});

export { billingRouter };
