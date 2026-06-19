// Agent Debate Routes — Multi-agent health discussion panel

import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../app";
import {
  runDebate,
  getDebateAgents,
  type DebateContext,
  type DebateResult,
} from "../services/agent-debate";

const agentDebateRouter = new Hono();

// ── In-memory debate store (replace with DB table in production) ──
const debateStore = new Map<string, { userId: string; result: DebateResult; createdAt: Date }>();

// Cleanup old debates from memory (keep last 24h)
function cleanupDebateStore() {
  const cutoff = Date.now() - 24 * 3600_000;
  for (const [id, debate] of debateStore) {
    if (debate.createdAt.getTime() < cutoff) {
      debateStore.delete(id);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupDebateStore, 30 * 60_000);

// ── Validation Schemas ──

const startDebateSchema = z.object({
  symptoms: z.string().min(2).max(2000).optional(),
  includeWearable: z.boolean().default(true),
  rounds: z.number().int().min(1).max(5).optional(),
});

// ── POST /agent-debate/start — Start a new debate session ──
agentDebateRouter.post("/start", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = startDebateSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: parsed.error.message,
          },
        },
        400
      );
    }

    const { symptoms, includeWearable, rounds } = parsed.data;
    const userId = c.get("userId") as string;

    // Build debate context
    const context: DebateContext = {};

    if (symptoms) {
      context.userSymptoms = symptoms;
    }

    // Fetch wearable data if requested
    if (includeWearable) {
      try {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const weekAgo = new Date(now.getTime() - 7 * 86400_000);

        // Fetch latest wearable data points
        const [heartRateData, sleepData, stepsData, bloodOxygenData, stressData] =
          await Promise.all([
            // Heart rate — latest readings today
            prisma.wearableDataPoint.findMany({
              where: { userId, dataType: "heart_rate", timestamp: { gte: dayStart } },
              orderBy: { timestamp: "desc" },
              take: 100,
            }),
            // Sleep — most recent sleep record
            prisma.wearableDataPoint.findFirst({
              where: { userId, dataType: "sleep" },
              orderBy: { timestamp: "desc" },
            }),
            // Steps — today + past week for average
            prisma.wearableDataPoint.findMany({
              where: { userId, dataType: "steps", timestamp: { gte: weekAgo } },
              orderBy: { timestamp: "desc" },
            }),
            // Blood oxygen — most recent
            prisma.wearableDataPoint.findFirst({
              where: { userId, dataType: "blood_oxygen" },
              orderBy: { timestamp: "desc" },
            }),
            // Stress — most recent
            prisma.wearableDataPoint.findFirst({
              where: { userId, dataType: "stress" },
              orderBy: { timestamp: "desc" },
            }),
          ]);

        const wearableData: DebateContext["wearableData"] = {};

        // Process heart rate
        if (heartRateData.length > 0) {
          const bpmValues = heartRateData.map((d) => (d.value as any).bpm as number).filter(Boolean);
          if (bpmValues.length > 0) {
            const restingCandidates = heartRateData
              .filter((d) => (d.value as any).context === "resting" || (d.value as any).context === "sedentary")
              .map((d) => (d.value as any).bpm as number)
              .filter(Boolean);

            wearableData.heartRate = {
              avg: Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length),
              min: Math.min(...bpmValues),
              max: Math.max(...bpmValues),
              resting: restingCandidates.length > 0
                ? Math.round(restingCandidates.reduce((a, b) => a + b, 0) / restingCandidates.length)
                : Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length),
            };
          }
        }

        // Process sleep
        if (sleepData) {
          const sv = sleepData.value as any;
          wearableData.sleep = {
            duration: sv.totalHours || sv.duration || (sv.sleepEnd && sv.sleepStart
              ? (new Date(sv.sleepEnd).getTime() - new Date(sv.sleepStart).getTime()) / 3600_000
              : 0),
            deepSleep: sv.deepSleepHours || sv.deepSleep || 0,
            remSleep: sv.remSleepHours || sv.remSleep || 0,
            quality: sv.quality || sv.sleepQuality || "unknown",
          };
        }

        // Process steps
        if (stepsData.length > 0) {
          const todaySteps = stepsData.find(
            (d) => new Date(d.timestamp).toDateString() === now.toDateString()
          );
          const weekStepValues = stepsData.map((d) => (d.value as any).count as number).filter(Boolean);

          wearableData.steps = {
            today: todaySteps ? ((todaySteps.value as any).count as number) || 0 : 0,
            weekAvg: weekStepValues.length > 0
              ? Math.round(weekStepValues.reduce((a, b) => a + b, 0) / weekStepValues.length)
              : 0,
          };
        }

        // Process blood oxygen
        if (bloodOxygenData) {
          wearableData.bloodOxygen = (bloodOxygenData.value as any).spo2 as number;
        }

        // Process stress
        if (stressData) {
          wearableData.stress = (stressData.value as any).stressLevel as number;
        }

        // Only include if we got any data
        if (Object.keys(wearableData).length > 0) {
          context.wearableData = wearableData;
        }
      } catch (wearableError) {
        console.warn("[AgentDebate] Failed to fetch wearable data, continuing without:", wearableError);
      }
    }

    // Fetch recent health entries for context
    try {
      const recentEntries = await prisma.healthEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { symptomLogs: true },
      });

      if (recentEntries.length > 0) {
        context.recentEntries = recentEntries.map((entry) => ({
          date: entry.entryDate.toISOString().split("T")[0],
          symptoms: entry.symptomLogs.map((s) => s.displayName),
          severity: entry.urgencyScore ? Math.round(entry.urgencyScore * 10) : entry.detailScore,
        }));
      }
    } catch (entryError) {
      console.warn("[AgentDebate] Failed to fetch health entries, continuing without:", entryError);
    }

    // Run the debate
    const result = await runDebate(userId, context, rounds);

    // Store in memory
    debateStore.set(result.id, {
      userId,
      result,
      createdAt: new Date(),
    });

    // Award L2E points
    try {
      await prisma.pointTransaction.create({
        data: {
          userId,
          amount: result.pointsEarned,
          type: "DAILY_TIP_VIEW", // Closest existing type for L2E
          description: `Agent Debate: ${result.topic} (${result.totalRounds} rounds)`,
        },
      });

      // Update user points
      await prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: result.pointsEarned } },
      });
    } catch (pointsError) {
      console.warn("[AgentDebate] Failed to award points:", pointsError);
      // Don't fail the entire debate over points
    }

    return c.json({
      success: true,
      data: {
        id: result.id,
        topic: result.topic,
        totalRounds: result.totalRounds,
        messageCount: result.messages.length,
        messages: result.messages.map((m) => ({
          agentId: m.agentId,
          agentName: m.agentName,
          emoji: m.emoji,
          content: m.content,
          replyTo: m.replyTo,
          confidence: m.confidence,
          round: m.round,
          timestamp: m.timestamp,
        })),
        consensus: result.consensus,
        keyInsights: result.keyInsights,
        pointsEarned: result.pointsEarned,
        wearableDataIncluded: !!context.wearableData,
        recentEntriesIncluded: !!context.recentEntries && context.recentEntries.length > 0,
      },
    });
  } catch (error: any) {
    console.error("[AgentDebate] Start error:", error);
    return c.json(
      {
        success: false,
        error: { code: "DEBATE_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /agent-debate/history — Get past debate sessions ──
agentDebateRouter.get("/history", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
    const offset = parseInt(c.req.query("offset") || "0");

    // Gather debates for this user from memory store
    const userDebates = Array.from(debateStore.values())
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = userDebates.length;
    const paged = userDebates.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: paged.map((d) => ({
        id: d.result.id,
        topic: d.result.topic,
        totalRounds: d.result.totalRounds,
        messageCount: d.result.messages.length,
        consensus: d.result.consensus,
        keyInsights: d.result.keyInsights,
        pointsEarned: d.result.pointsEarned,
        createdAt: d.createdAt.toISOString(),
      })),
      meta: { limit, offset, total },
    });
  } catch (error: any) {
    console.error("[AgentDebate] History error:", error);
    return c.json(
      {
        success: false,
        error: { code: "HISTORY_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /agent-debate/agents — List debate panel agents ──
agentDebateRouter.get("/agents", (c) => {
  return c.json({
    success: true,
    data: getDebateAgents(),
  });
});

// ── GET /agent-debate/:id — Get a specific debate session ──
agentDebateRouter.get("/:id", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const debateId = c.req.param("id");

    const stored = debateStore.get(debateId);

    if (!stored) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Debate session not found",
          },
        },
        404
      );
    }

    // Verify ownership
    if (stored.userId !== userId) {
      return c.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this debate",
          },
        },
        403
      );
    }

    const result = stored.result;

    return c.json({
      success: true,
      data: {
        id: result.id,
        topic: result.topic,
        totalRounds: result.totalRounds,
        messageCount: result.messages.length,
        messages: result.messages.map((m) => ({
          agentId: m.agentId,
          agentName: m.agentName,
          emoji: m.emoji,
          content: m.content,
          replyTo: m.replyTo,
          confidence: m.confidence,
          round: m.round,
          timestamp: m.timestamp,
        })),
        consensus: result.consensus,
        keyInsights: result.keyInsights,
        pointsEarned: result.pointsEarned,
        context: result.context,
        createdAt: stored.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[AgentDebate] Get error:", error);
    return c.json(
      {
        success: false,
        error: { code: "DEBATE_FETCH_ERROR", message: error.message },
      },
      500
    );
  }
});

export { agentDebateRouter };
