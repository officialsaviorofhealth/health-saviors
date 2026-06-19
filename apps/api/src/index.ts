// Docker / Node.js entry point — imports pure app + adds server + background jobs
import app, { prisma } from "./app";
import { serve } from "@hono/node-server";
import { antiGamingEngine } from "./services/anti-gaming";
import { exercisePoolService } from "./services/exercise-pool";
import { apiMeteringService } from "./middleware/api-metering";
import { jobQueue } from "./services/job-queue";
import { startSimulator, stopSimulator } from "./services/agent-simulator";

// ── Periodic cleanup (every hour) ──
setInterval(() => {
  antiGamingEngine.cleanup();
  jobQueue.cleanup();
  apiMeteringService.cleanup();
}, 3600_000);

// ── Exercise Pool cron (every 5 minutes) ──
setInterval(async () => {
  try {
    await exercisePoolService.createDailyPool();
    await exercisePoolService.settleCurrentPool();
  } catch (err) {
    console.error("Exercise pool cron error:", err);
  }
}, 300_000);

exercisePoolService.createDailyPool().catch((err) =>
  console.error("Initial pool creation error:", err),
);

// ── Agent Simulator ──
const simulatorEnabled =
  process.env.ENABLE_SIMULATOR === "true" ||
  process.env.NODE_ENV === "development" ||
  !process.env.NODE_ENV;
if (simulatorEnabled) {
  startSimulator(prisma, {
    enabled: true,
    intervalMs: 30_000,
    queriesPerHour: 50,
    peakHourMultiplier: 2.0,
  }).catch((err) =>
    console.error("[Simulator] Startup error:", err),
  );
}

// ── Graceful shutdown ──
process.on("SIGTERM", async () => {
  stopSimulator();
  await prisma.$disconnect();
  process.exit(0);
});

// ── Start HTTP server ──
const port = parseInt(process.env.PORT || "3001");
serve({ fetch: app.fetch, port }, () => {
  console.log(`AI Health Journal API v0.2.0 — listening on port ${port}`);
});

export default app;
