// Wearable Insights API Routes
// Provides processed health insights, scores, and alerts from wearable data.
// All routes require authentication.

import { Hono } from "hono";
import {
  getWearableSummary,
  getHealthScoreOnly,
  getActiveAlerts,
} from "../services/wearable-insights";

const wearableInsightsRouter = new Hono();

// ── GET /wearable-insights/insights — Full insight summary ──
// GET /api/v1/wearable-insights/insights — Full insight summary
// Query: ?days=7 (default 7, max 90)
wearableInsightsRouter.get("/insights", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const daysParam = c.req.query("days");
    const days = daysParam
      ? Math.max(1, Math.min(90, parseInt(daysParam, 10) || 7))
      : 7;

    const summary = await getWearableSummary(userId, days);

    return c.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error("[WearableInsights] Insights error:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INSIGHTS_ERROR",
          message: error.message || "Failed to generate wearable insights",
        },
      },
      500,
    );
  }
});

// ── GET /wearable-insights/score — Health score only ──
// GET /api/v1/wearable-insights/score — Health score only
// Returns: { score: number, trend: string, breakdown: {} }
wearableInsightsRouter.get("/score", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const daysParam = c.req.query("days");
    const days = daysParam
      ? Math.max(1, Math.min(90, parseInt(daysParam, 10) || 7))
      : 7;

    const scoreData = await getHealthScoreOnly(userId, days);

    return c.json({
      success: true,
      data: scoreData,
    });
  } catch (error: any) {
    console.error("[WearableInsights] Score error:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "SCORE_ERROR",
          message: error.message || "Failed to calculate health score",
        },
      },
      500,
    );
  }
});

// ── GET /wearable-insights/alerts — Active alerts & warnings only ──
// GET /api/v1/wearable-insights/alerts — Active alerts and warnings only
// Returns only severity "warning" and "alert" insights
wearableInsightsRouter.get("/alerts", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const daysParam = c.req.query("days");
    const days = daysParam
      ? Math.max(1, Math.min(90, parseInt(daysParam, 10) || 7))
      : 7;

    const alerts = await getActiveAlerts(userId, days);

    return c.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        hasAlerts: alerts.some((a) => a.severity === "alert"),
        hasWarnings: alerts.some((a) => a.severity === "warning"),
      },
    });
  } catch (error: any) {
    console.error("[WearableInsights] Alerts error:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "ALERTS_ERROR",
          message: error.message || "Failed to fetch wearable alerts",
        },
      },
      500,
    );
  }
});

export { wearableInsightsRouter };
