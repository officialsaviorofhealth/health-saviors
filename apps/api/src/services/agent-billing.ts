// Agent Query Billing Service — Core BM for AI Agent Marketplace
//
// Revenue model: platform 30% / data provider (user) 50% / agent developer 20%

import type { PrismaClient } from "@prisma/client";

// ── Pricing Tiers ──
export const QUERY_PRICING = {
  basic: 10,       // 10 points per query (text-only health data)
  standard: 25,    // 25 points per query (text + structured data)
  premium: 50,     // 50 points per query (text + wearable + full history)
  enterprise: 100, // 100 points per query (all data + priority processing)
} as const;

// ── Revenue Split ──
export const REVENUE_SPLIT = {
  platform: 0.30,
  dataProvider: 0.50,
  agentDeveloper: 0.20,
} as const;

// ── Data fields available per tier ──
const TIER_DATA_FIELDS: Record<keyof typeof QUERY_PRICING, string[]> = {
  basic: ["symptoms"],
  standard: ["symptoms", "structured_data", "medications"],
  premium: ["symptoms", "structured_data", "medications", "wearable", "history"],
  enterprise: ["symptoms", "structured_data", "medications", "wearable", "history", "fhir_bundle"],
};

export type QueryTier = keyof typeof QUERY_PRICING;

export interface QueryBillingResult {
  queryId: string;
  agentId: string;
  userId: string;
  requesterId: string;
  tier: QueryTier;
  pointsCharged: number;
  platformShare: number;
  userShare: number;
  developerShare: number;
  dataIncluded: string[];
  createdAt: Date;
}

export interface EarningsSummary {
  totalEarned: number;
  queryCount: number;
  periodStart: Date;
  periodEnd: Date;
  breakdown: {
    tier: string;
    queryCount: number;
    totalEarned: number;
  }[];
}

export interface PlatformRevenueSummary {
  totalRevenue: number;
  totalQueries: number;
  totalDistributedToUsers: number;
  totalDistributedToDevelopers: number;
  periodStart: Date;
  periodEnd: Date;
  tierBreakdown: {
    tier: string;
    queryCount: number;
    revenue: number;
  }[];
}

class AgentBillingService {
  private prisma: PrismaClient | null = null;

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error(
        "PrismaClient not initialized. Call setPrisma() first."
      );
    }
    return this.prisma;
  }

  // ── Helper: compute date range from period string ──
  private getPeriodRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (period) {
      case "today":
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case "week":
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "year":
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "all":
        start = new Date(0);
        break;
      default:
        // Default to 30 days
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }

  /**
   * Execute a billable query — deducts points from requester, splits revenue
   */
  async chargeQuery(
    agentId: string,
    targetUserId: string,
    requesterId: string,
    tier: QueryTier,
    dataFields?: string[],
  ): Promise<QueryBillingResult> {
    const db = this.getPrisma();
    const pointsCharged = QUERY_PRICING[tier];

    // Validate tier
    if (!QUERY_PRICING[tier]) {
      throw new BillingError(
        "INVALID_TIER",
        `Invalid query tier: ${tier}. Valid tiers: ${Object.keys(QUERY_PRICING).join(", ")}`,
      );
    }

    // Validate agent exists
    const agent = await db.aIAgent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new BillingError(
        "AGENT_NOT_FOUND",
        "Agent not found",
      );
    }

    // Validate target user exists and has consented to data sharing
    const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new BillingError(
        "USER_NOT_FOUND",
        "Target user not found",
      );
    }
    if (!targetUser.dataConsent) {
      throw new BillingError(
        "NO_DATA_CONSENT",
        "Target user has not consented to data sharing",
      );
    }

    // Validate requester has enough points
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester) {
      throw new BillingError(
        "REQUESTER_NOT_FOUND",
        "Requester not found",
      );
    }
    if (requester.totalPoints < pointsCharged) {
      throw new BillingError(
        "INSUFFICIENT_POINTS",
        `Insufficient points. Required: ${pointsCharged}, Available: ${requester.totalPoints}`,
      );
    }

    // Calculate revenue split (integer math to avoid floating point issues)
    const platformShare = Math.floor(pointsCharged * REVENUE_SPLIT.platform);
    const userShare = Math.floor(pointsCharged * REVENUE_SPLIT.dataProvider);
    const developerShare = pointsCharged - platformShare - userShare; // Remainder goes to developer

    // Determine data fields included based on tier
    const includedFields = dataFields?.length
      ? dataFields.filter((f) => TIER_DATA_FIELDS[tier].includes(f))
      : TIER_DATA_FIELDS[tier];

    // Execute billing transaction atomically
    const billing = await db.$transaction(async (tx) => {
      // 1. Deduct points from requester
      await tx.user.update({
        where: { id: requesterId },
        data: { totalPoints: { decrement: pointsCharged } },
      });

      // 2. Credit data provider (user whose data is queried)
      await tx.user.update({
        where: { id: targetUserId },
        data: { totalPoints: { increment: userShare } },
      });

      // 3. Create billing record
      const record = await tx.queryBilling.create({
        data: {
          agentId,
          userId: targetUserId,
          requesterId,
          tier,
          pointsCharged,
          platformShare,
          userShare,
          developerShare,
          dataIncluded: includedFields,
        },
      });

      // 4. Increment agent query count
      await tx.aIAgent.update({
        where: { id: agentId },
        data: {
          totalQueries: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });

      // 5. Log to agent query log
      await tx.agentQueryLog.create({
        data: {
          agentId,
          action: "billable_query",
          detail: `Tier: ${tier}, Points: ${pointsCharged}, Data: [${includedFields.join(",")}]`,
          amount: pointsCharged,
        },
      });

      return record;
    });

    return {
      queryId: billing.id,
      agentId: billing.agentId,
      userId: billing.userId,
      requesterId: billing.requesterId,
      tier: billing.tier as QueryTier,
      pointsCharged: billing.pointsCharged,
      platformShare: billing.platformShare,
      userShare: billing.userShare,
      developerShare: billing.developerShare,
      dataIncluded: billing.dataIncluded,
      createdAt: billing.createdAt,
    };
  }

  /**
   * Get agent developer earnings for a given period
   */
  async getAgentEarnings(agentId: string, period: string = "month"): Promise<EarningsSummary> {
    const db = this.getPrisma();
    const { start, end } = this.getPeriodRange(period);

    // Verify agent exists
    const agent = await db.aIAgent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new BillingError("AGENT_NOT_FOUND", "Agent not found");
    }

    const billings = await db.queryBilling.findMany({
      where: {
        agentId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        tier: true,
        developerShare: true,
      },
    });

    // Aggregate by tier
    const tierMap = new Map<string, { count: number; total: number }>();
    let totalEarned = 0;

    for (const b of billings) {
      totalEarned += b.developerShare;
      const existing = tierMap.get(b.tier) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += b.developerShare;
      tierMap.set(b.tier, existing);
    }

    const breakdown = Array.from(tierMap.entries()).map(([tier, data]) => ({
      tier,
      queryCount: data.count,
      totalEarned: data.total,
    }));

    return {
      totalEarned,
      queryCount: billings.length,
      periodStart: start,
      periodEnd: end,
      breakdown,
    };
  }

  /**
   * Get how much a user earned from their data being queried
   */
  async getUserDataEarnings(userId: string, period: string = "month"): Promise<EarningsSummary> {
    const db = this.getPrisma();
    const { start, end } = this.getPeriodRange(period);

    const billings = await db.queryBilling.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        tier: true,
        userShare: true,
      },
    });

    // Aggregate by tier
    const tierMap = new Map<string, { count: number; total: number }>();
    let totalEarned = 0;

    for (const b of billings) {
      totalEarned += b.userShare;
      const existing = tierMap.get(b.tier) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += b.userShare;
      tierMap.set(b.tier, existing);
    }

    const breakdown = Array.from(tierMap.entries()).map(([tier, data]) => ({
      tier,
      queryCount: data.count,
      totalEarned: data.total,
    }));

    return {
      totalEarned,
      queryCount: billings.length,
      periodStart: start,
      periodEnd: end,
      breakdown,
    };
  }

  /**
   * Get platform's total revenue for a given period
   */
  async getPlatformRevenue(period: string = "month"): Promise<PlatformRevenueSummary> {
    const db = this.getPrisma();
    const { start, end } = this.getPeriodRange(period);

    const billings = await db.queryBilling.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        tier: true,
        pointsCharged: true,
        platformShare: true,
        userShare: true,
        developerShare: true,
      },
    });

    const tierMap = new Map<string, { count: number; revenue: number }>();
    let totalRevenue = 0;
    let totalDistributedToUsers = 0;
    let totalDistributedToDevelopers = 0;

    for (const b of billings) {
      totalRevenue += b.platformShare;
      totalDistributedToUsers += b.userShare;
      totalDistributedToDevelopers += b.developerShare;

      const existing = tierMap.get(b.tier) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += b.platformShare;
      tierMap.set(b.tier, existing);
    }

    const tierBreakdown = Array.from(tierMap.entries()).map(([tier, data]) => ({
      tier,
      queryCount: data.count,
      revenue: data.revenue,
    }));

    return {
      totalRevenue,
      totalQueries: billings.length,
      totalDistributedToUsers,
      totalDistributedToDevelopers,
      periodStart: start,
      periodEnd: end,
      tierBreakdown,
    };
  }

  /**
   * Get query history for an agent or user, with pagination
   */
  async getQueryHistory(
    filters: { agentId?: string; userId?: string; requesterId?: string },
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ data: QueryBillingResult[]; total: number }> {
    const db = this.getPrisma();

    const where: any = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.requesterId) where.requesterId = filters.requesterId;

    const [records, total] = await Promise.all([
      db.queryBilling.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: Math.min(limit, 100),
      }),
      db.queryBilling.count({ where }),
    ]);

    return {
      data: records.map((r) => ({
        queryId: r.id,
        agentId: r.agentId,
        userId: r.userId,
        requesterId: r.requesterId,
        tier: r.tier as QueryTier,
        pointsCharged: r.pointsCharged,
        platformShare: r.platformShare,
        userShare: r.userShare,
        developerShare: r.developerShare,
        dataIncluded: r.dataIncluded,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  /**
   * Get the available data fields for a given tier
   */
  getAvailableDataFields(tier: QueryTier): string[] {
    return TIER_DATA_FIELDS[tier] || [];
  }
}

// ── Custom billing error ──
export class BillingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BillingError";
  }
}

export const agentBillingService = new AgentBillingService();
