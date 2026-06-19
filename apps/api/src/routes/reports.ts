// Report Routes — Personalized Health Report API
// GET  /reports/monthly   — Monthly report (premium feature)
// GET  /reports/weekly    — Weekly summary (free, limited)
// POST /reports/generate  — Custom period report
// GET  /reports/history   — List past generated reports

import { Hono } from "hono";
import { prisma } from "../app";
import { reportGenerator } from "../services/report-generator";
import { analyticsCache, CacheKeys } from "../services/cache";
import type { ReportGenerationOptions, ReportHistoryEntry } from "../../../../packages/shared/types/report-types";

const reportsRouter = new Hono();

// ── GET /reports/monthly — Generate monthly report (premium) ──
reportsRouter.get("/monthly", async (c) => {
  const userId = c.get("userId") as string;
  const language = (c.req.query("lang") as "ko" | "en") || "en";
  const format = c.req.query("format") || "json"; // json | text | html

  try {
    const report = await reportGenerator.generateReport(userId, {
      periodDays: 30,
      language,
      includeAI: true,
    });

    // Store report in cache for history (30 min TTL)
    const historyKey = `user:${userId}:report:monthly:${new Date().toISOString().split("T")[0]}`;
    analyticsCache.set(historyKey, report, 1800_000);

    if (format === "text") {
      const text = reportGenerator.formatReportAsText(report);
      return c.text(text);
    }
    if (format === "html") {
      const html = reportGenerator.formatReportAsHTML(report);
      return c.html(html);
    }

    return c.json({ success: true, data: report });
  } catch (error: any) {
    console.error("Monthly report error:", error);
    return c.json({
      success: false,
      error: { code: "REPORT_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /reports/weekly — Generate weekly summary (free, limited) ──
reportsRouter.get("/weekly", async (c) => {
  const userId = c.get("userId") as string;
  const language = (c.req.query("lang") as "ko" | "en") || "en";
  const format = c.req.query("format") || "json";

  try {
    const report = await reportGenerator.generateReport(userId, {
      periodDays: 7,
      language,
      includeAI: false, // free tier: no AI narrative
    });

    // Store report in cache for history (30 min TTL)
    const historyKey = `user:${userId}:report:weekly:${new Date().toISOString().split("T")[0]}`;
    analyticsCache.set(historyKey, report, 1800_000);

    if (format === "text") {
      const text = reportGenerator.formatReportAsText(report);
      return c.text(text);
    }
    if (format === "html") {
      const html = reportGenerator.formatReportAsHTML(report);
      return c.html(html);
    }

    return c.json({ success: true, data: report });
  } catch (error: any) {
    console.error("Weekly report error:", error);
    return c.json({
      success: false,
      error: { code: "REPORT_ERROR", message: error.message },
    }, 500);
  }
});

// ── POST /reports/generate — Custom period report ──
reportsRouter.post("/generate", async (c) => {
  const userId = c.get("userId") as string;

  let body: {
    periodDays?: number;
    language?: "ko" | "en";
    includeAI?: boolean;
    format?: "json" | "text" | "html";
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({
      success: false,
      error: { code: "INVALID_BODY", message: "Invalid JSON body" },
    }, 400);
  }

  const periodDays = body.periodDays ?? 30;
  const language = body.language ?? "en";
  const includeAI = body.includeAI ?? true;
  const format = body.format ?? "json";

  // Validate period range
  if (periodDays < 1 || periodDays > 365) {
    return c.json({
      success: false,
      error: { code: "INVALID_PERIOD", message: "periodDays must be between 1 and 365" },
    }, 400);
  }

  try {
    // Premium check for AI and extended features
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, totalPoints: true },
    });

    if (!user) {
      return c.json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      }, 404);
    }

    // For periods > 30 days, require premium access
    const isPremiumUser = user.level >= 3 || Number(user.totalPoints) >= 2000;
    if (periodDays > 30 && !isPremiumUser) {
      return c.json({
        success: false,
        error: {
          code: "PREMIUM_REQUIRED",
          message: "Reports over 30 days require premium access. Level 3+ or 2000+ points needed.",
        },
      }, 403);
    }

    const report = await reportGenerator.generateReport(userId, {
      periodDays,
      language,
      includeAI: includeAI && isPremiumUser, // AI narrative only for premium
    });

    // Store report in cache for history
    const historyKey = `user:${userId}:report:custom:${new Date().toISOString().split("T")[0]}:${periodDays}d`;
    analyticsCache.set(historyKey, report, 1800_000);

    if (format === "text") {
      const text = reportGenerator.formatReportAsText(report);
      return c.text(text);
    }
    if (format === "html") {
      const html = reportGenerator.formatReportAsHTML(report);
      return c.html(html);
    }

    return c.json({ success: true, data: report });
  } catch (error: any) {
    console.error("Custom report error:", error);
    return c.json({
      success: false,
      error: { code: "REPORT_ERROR", message: error.message },
    }, 500);
  }
});

// ── GET /reports/history — List past generated reports ──
reportsRouter.get("/history", async (c) => {
  const userId = c.get("userId") as string;
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

  try {
    // Query health entries to build a rough report history
    // (In production, we'd have a dedicated reports table; here we infer from entry data)
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, totalPoints: true, createdAt: true },
    });

    if (!user) {
      return c.json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      }, 404);
    }

    const isPremium = user.level >= 3 || Number(user.totalPoints) >= 2000;

    // Generate available report periods based on user's account history
    const reports: ReportHistoryEntry[] = [];
    const userCreatedAt = new Date(user.createdAt);

    // Add available weekly reports (last 4 weeks)
    for (let i = 0; i < Math.min(4, limit); i++) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);

      if (weekStart < userCreatedAt) break;

      reports.push({
        id: `weekly-${weekStart.toISOString().split("T")[0]}`,
        generatedAt: weekEnd.toISOString(),
        period: {
          from: weekStart.toISOString().split("T")[0],
          to: weekEnd.toISOString().split("T")[0],
        },
        type: "weekly",
        isPremium: false,
      });
    }

    // Add available monthly reports (last 3 months)
    for (let i = 0; i < Math.min(3, limit); i++) {
      const monthEnd = new Date(now);
      monthEnd.setMonth(monthEnd.getMonth() - i);
      const monthStart = new Date(monthEnd);
      monthStart.setDate(monthStart.getDate() - 30);

      if (monthStart < userCreatedAt) break;

      reports.push({
        id: `monthly-${monthStart.toISOString().split("T")[0]}`,
        generatedAt: monthEnd.toISOString(),
        period: {
          from: monthStart.toISOString().split("T")[0],
          to: monthEnd.toISOString().split("T")[0],
        },
        type: "monthly",
        isPremium,
      });
    }

    // Sort by generatedAt descending and limit
    reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    return c.json({
      success: true,
      data: {
        reports: reports.slice(0, limit),
        isPremium,
        totalAvailable: reports.length,
      },
    });
  } catch (error: any) {
    console.error("Report history error:", error);
    return c.json({
      success: false,
      error: { code: "HISTORY_ERROR", message: error.message },
    }, 500);
  }
});

export { reportsRouter };
