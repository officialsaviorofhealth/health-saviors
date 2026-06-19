// Pure Hono app — no side effects (no serve, no setInterval, no simulator)
// Used by both Docker (index.ts) and Vercel (apps/web API route)

import { Hono } from "hono";
import { cors } from "hono/cors";

// Hono environment type for c.get/c.set
type Env = {
  Variables: {
    userId: string;
    wallet?: string;
    email?: string;
  };
};
import { PrismaClient } from "@prisma/client";
import { chatRouter } from "./routes/chat";
import { rewardRouter } from "./routes/rewards";
import { reminderRouter } from "./routes/reminders";
import { educationRouter } from "./routes/education";
import { analyticsRouter } from "./routes/analytics";
import { consentRouter } from "./routes/consent";
import { hospitalRouter } from "./routes/hospital";
import { agentRouter } from "./routes/agents";
import { reportsRouter } from "./routes/reports";
import { exercisePoolRouter } from "./routes/exercise-pool";
import { wearableRouter } from "./routes/wearable";
import { wearableInsightsRouter } from "./routes/wearable-insights";
import { billingRouter } from "./routes/billing";
import { agentDebateRouter } from "./routes/agent-debate";
import { battleRouter } from "./routes/battle";
import { ecosystemRouter } from "./routes/ecosystem";
import { predictionsRouter } from "./routes/predictions";
import { commerceRouter } from "./routes/commerce";
import { dataIntelligenceRouter } from "./routes/data-intelligence";
import { authMiddleware } from "./middleware/auth";
import { apiMeteringMiddleware, apiMeteringService } from "./middleware/api-metering";
import { antiGamingEngine } from "./services/anti-gaming";
import { exercisePoolService } from "./services/exercise-pool";
import { agentBillingService } from "./services/agent-billing";
import { jobQueue } from "./services/job-queue";
import { handleWearableCallback } from "./routes/wearable";
import { QUERY_PRICING, REVENUE_SPLIT } from "./services/agent-billing";

// ── Prisma singleton (serverless-safe) ──
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ── Inject Prisma into services ──
antiGamingEngine.setPrisma(prisma);
exercisePoolService.setPrisma(prisma);
agentBillingService.setPrisma(prisma);
apiMeteringService.setPrisma(prisma);

// ── Create Hono app ──
const app = new Hono<Env>();

app.use("*", cors({ origin: process.env.CORS_ORIGIN || "*" }));

app.get("/health", (c) =>
  c.json({
    status: "ok",
    version: "0.2.0",
    ts: new Date().toISOString(),
    jobs: jobQueue.getStats(),
  })
);

// ── Auth routes (public) ──
app.get("/api/v1/auth/nonce", authMiddleware.getNonce);
app.post("/api/v1/auth/connect", authMiddleware.connect);
app.post("/api/v1/auth/register", authMiddleware.register);
app.post("/api/v1/auth/login", authMiddleware.login);

// ── Wearable OAuth callback (public) ──
app.get("/api/v1/wearable/callback/:source", handleWearableCallback);

// ── Public billing pricing ──
app.get("/api/v1/billing/pricing", (c) => {
  const tiers = Object.entries(QUERY_PRICING).map(([tier, points]) => ({
    tier,
    pointsPerQuery: points,
    revenueSplit: {
      platform: `${REVENUE_SPLIT.platform * 100}%`,
      dataProvider: `${REVENUE_SPLIT.dataProvider * 100}%`,
      agentDeveloper: `${REVENUE_SPLIT.agentDeveloper * 100}%`,
    },
  }));
  return c.json({ success: true, data: { tiers } });
});

// ── Public ecosystem routes ──
app.route("/api/v1/ecosystem", ecosystemRouter);

// ── Public seed endpoint (dev only) — seeds all BM demo data ──
app.post("/api/v1/seed-all", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ success: false, error: "Seeding disabled in production" }, 403);
  }

  const results: Record<string, any> = {};

  try {
    // 1. Seed agents first (battles depend on agents)
    const agentSeedRes = await app.request(
      new Request("http://localhost/api/v1/agents/seed", { method: "POST", headers: { "Content-Type": "application/json" } })
    );
    results.agents = await agentSeedRes.json().catch(() => "done");
  } catch (e: any) { results.agents = { error: e.message }; }

  try {
    // 2. Seed battles (depends on agents)
    const battleSeedRes = await app.request(
      new Request("http://localhost/api/v1/battles/seed", { method: "POST", headers: { "Content-Type": "application/json" } })
    );
    results.battles = await battleSeedRes.json().catch(() => "done");
  } catch (e: any) { results.battles = { error: e.message }; }

  try {
    // 3. Seed predictions
    const predSeedRes = await app.request(
      new Request("http://localhost/api/v1/predictions/seed", { method: "POST", headers: { "Content-Type": "application/json" } })
    );
    results.predictions = await predSeedRes.json().catch(() => "done");
  } catch (e: any) { results.predictions = { error: e.message }; }

  try {
    // 4. Seed commerce products
    const commSeedRes = await app.request(
      new Request("http://localhost/api/v1/commerce/seed", { method: "POST", headers: { "Content-Type": "application/json" } })
    );
    results.commerce = await commSeedRes.json().catch(() => "done");
  } catch (e: any) { results.commerce = { error: e.message }; }

  try {
    // 5. Seed data intelligence packages
    const dataSeedRes = await app.request(
      new Request("http://localhost/api/v1/data-intelligence/seed", { method: "POST", headers: { "Content-Type": "application/json" } })
    );
    results.dataIntelligence = await dataSeedRes.json().catch(() => "done");
  } catch (e: any) { results.dataIntelligence = { error: e.message }; }

  return c.json({ success: true, data: results });
});

// ── Protected Auth routes ──
app.get("/api/v1/auth/me", authMiddleware.verify, authMiddleware.getMe);

// ── Protected API group ──
const api = new Hono();
api.use("*", authMiddleware.verify);
api.route("/chat", chatRouter);
api.route("/rewards", rewardRouter);
api.route("/reminders", reminderRouter);
api.route("/education", educationRouter);
api.route("/analytics", analyticsRouter);
api.route("/consent", consentRouter);
api.route("/hospital", hospitalRouter);
api.route("/agents", agentRouter);
api.route("/reports", reportsRouter);
api.route("/exercise-pool", exercisePoolRouter);
api.route("/wearable", wearableRouter);
api.route("/wearable-insights", wearableInsightsRouter);
api.route("/agent-debate", agentDebateRouter);
api.route("/battles", battleRouter);
api.route("/predictions", predictionsRouter);
api.route("/commerce", commerceRouter);
api.route("/data-intelligence", dataIntelligenceRouter);
api.use("/billing/query", apiMeteringMiddleware());
api.route("/billing", billingRouter);

app.route("/api/v1", api);

export default app;
