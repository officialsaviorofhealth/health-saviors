import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../app";
import { encryptionService } from "../services/encryption";
import { antiGamingEngine } from "../services/anti-gaming";
import { rewardService } from "../services/reward-service";
import { jobQueue } from "../services/job-queue";
import { createPipeline, type EnhancedResult } from "../../../../packages/ai-scribe/pipeline/enhanced-pipeline";
import { createHash } from "crypto";

const chatRouter = new Hono();

// Singleton pipeline instance
const pipeline = createPipeline();

// ── Health-related keyword detection ──
const HEALTH_KEYWORDS_EN = [
  "pain", "ache", "headache", "stomach", "fever", "cough", "cold", "nausea", "vomit", "diarrhea",
  "dizzy", "fatigue", "insomnia", "medicine", "medication", "drug", "hospital", "doctor", "prescription",
  "symptom", "diagnosis", "blood pressure", "diabetes", "allergy", "inflammation", "surgery", "treatment",
  "exercise", "diet", "weight", "heart", "breathing", "joint", "muscle", "skin", "rash", "swelling",
  "bleeding", "digestion", "back", "neck", "shoulder", "knee", "ankle", "wrist", "eye", "ear",
  "throat", "stress", "depression", "anxiety", "sleep", "nutrition", "vitamin", "health", "condition",
  "tylenol", "painkiller", "antibiotic", "pill", "dosage", "hurt", "sick", "ill", "sore",
];

function isHealthRelated(message: string): boolean {
  const lower = message.toLowerCase();
  const hasEnHealth = HEALTH_KEYWORDS_EN.some((kw) => lower.includes(kw));
  return hasEnHealth;
}

async function callConversationalLLM(message: string, language: "ko" | "en"): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return "Hello! I'm your AI Health Journal assistant. Share your health symptoms or medication info and I'll analyze it for you.";
  }

  const systemPrompt =
    "You are an AI Health Journal assistant. Respond conversationally and warmly. Guide the user to share health information (symptoms, medications, conditions) for better analysis. Keep responses short and natural.";

  // LLM provider chat completion endpoint
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    }),
  });

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || "Hello! Share your health info and I'll help analyze it.";
}

const chatSchema = z.object({
  message: z.string().min(2).max(5000),
  language: z.enum(["ko", "en"]).default("en"),
});

// POST /api/v1/chat — Full integrated health chat
chatRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: { code: "INVALID_INPUT", message: parsed.error.message } }, 400);
    }
    const { message, language } = parsed.data;
    const userId = c.get("userId") as string;
    const wallet = c.get("wallet") as string;
    const ip = c.req.header("x-forwarded-for") || "unknown";

    // 1. Anti-abuse check
    const inputHash = createHash("sha256").update(message).digest("hex");
    const signals = await antiGamingEngine.checkAbuse(wallet || "unknown", ip, inputHash, userId);
    if (antiGamingEngine.shouldBlock(signals)) {
      return c.json({
        success: false,
        error: { code: "ABUSE_DETECTED", message: "Suspicious activity detected" },
      }, 403);
    }

    // 2. General chat fallback — skip FHIR pipeline for non-health messages
    if (!isHealthRelated(message)) {
      const chatResponse = await callConversationalLLM(message, language);
      return c.json({
        success: true,
        data: {
          type: "chat",
          response: chatResponse,
          rewardEarned: 0,
        },
      });
    }

    // 3. Load user context for pattern analysis
    const [user, recentSymptomLogs, activeMeds] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.symptomLog.findMany({
        where: { entry: { userId }, onsetDate: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: { snomedCode: true, displayName: true, severity: true, onsetDate: true },
        orderBy: { onsetDate: "desc" },
        take: 50,
      }),
      prisma.medicationReminder.findMany({
        where: { userId, isActive: true },
        select: { medicationName: true },
      }),
    ]);

    // Build symptom trends for pattern analyzer
    const trendMap = new Map<string, { code: string; name: string; count: number; dates: string[]; severities: number[] }>();
    for (const log of recentSymptomLogs) {
      const key = log.snomedCode;
      if (!trendMap.has(key)) trendMap.set(key, { code: key, name: log.displayName, count: 0, dates: [], severities: [] });
      const t = trendMap.get(key)!;
      t.count++;
      t.dates.push(log.onsetDate.toISOString().split("T")[0]);
      t.severities.push({ mild: 1, moderate: 2, severe: 3, critical: 4 }[log.severity] || 2);
    }
    const recentSymptoms = Array.from(trendMap.values()).map(t => ({
      snomedCode: t.code,
      displayName: t.name,
      occurrences: t.count,
      dates: t.dates,
      avgSeverity: t.severities.reduce((a, b) => a + b, 0) / t.severities.length,
    }));

    // 3. Run Enhanced AI Pipeline (includes circuit breaker, retry, SNOMED mapping, FHIR, safety) ──
    const aiResult: EnhancedResult = await pipeline.process(message, {
      userId,
      recentSymptoms,
      currentMedications: activeMeds.map(m => m.medicationName),
    });

    // 4. Short-circuit if abuse detected by pipeline
    if (aiResult.isAbuse) {
      return c.json({
        success: false,
        error: { code: "LOW_QUALITY_INPUT", message: aiResult.educationResponse },
      }, 400);
    }

    // 5. Encrypt raw input
    const encrypted = encryptionService.encrypt(message);

    // 6. Calculate reward
    const streakDays = user?.streakDays || 0;
    const reward = rewardService.calculateReward(aiResult.detailScore, streakDays);
    const pointsEarned = Number(reward.base + reward.detailBonus);

    // 7. Save to DB
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const entry = await prisma.healthEntry.create({
      data: {
        userId,
        rawInput: encrypted,
        fhirBundle: aiResult.fhirBundle as any,
        aiResponse: aiResult.educationResponse,
        detailScore: aiResult.detailScore,
        urgencyScore: aiResult.urgencyScore,
        pointsEarned,
        entryDate: today,
      },
    });

    // 7b. Save symptom logs
    if (aiResult.symptoms.length > 0) {
      await prisma.symptomLog.createMany({
        data: aiResult.symptoms.map((s) => ({
          entryId: entry.id,
          snomedCode: s.snomedCode || "unknown",
          icdCode: s.icdCode || null,
          displayName: s.name || "unknown",
          severity: s.severity || "mild",
          bodySite: s.bodySite || null,
          onsetDate: s.onsetDate ? new Date(s.onsetDate) : today,
        })),
      });
    }

    // 8. Update streak
    const lastCheckin = user?.lastCheckinDate;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = lastCheckin && lastCheckin.toDateString() === yesterday.toDateString();
    const isToday = lastCheckin && lastCheckin.toDateString() === today.toDateString();

    if (!isToday) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          streakDays: isConsecutive ? { increment: 1 } : 1,
          lastCheckinDate: today,
          totalPoints: { increment: pointsEarned },
        },
      });
    }

    // 9. Queue async jobs (IPFS upload, entry hash, analytics)
    await jobQueue.queueHealthEntryProcessing(entry.id, aiResult.fhirBundle, encrypted);

    // 10. Record point transaction
    await prisma.pointTransaction.create({
      data: {
        userId,
        amount: pointsEarned,
        type: "HEALTH_LOG",
        description: `Daily health log (detail: ${aiResult.detailScore}, streak: ${streakDays})`,
      },
    });

    return c.json({
      success: true,
      data: {
        type: "health-analysis",
        entryId: entry.id,
        aiResult: {
          symptoms: aiResult.symptoms,
          medications: aiResult.medications,
          urgencyLevel: aiResult.urgencyLevel,
          detailScore: aiResult.detailScore,
          educationResponse: aiResult.educationResponse,
          safetyAlert: aiResult.safetyAlert,
          medicationWarnings: aiResult.medicationWarnings,
          patternInsights: aiResult.patternInsights,
          scoreBreakdown: aiResult.scoreBreakdown,
        },
        rewardEarned: pointsEarned,
        currentStreak: isToday ? streakDays : (isConsecutive ? streakDays + 1 : 1),
      },
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return c.json({ success: false, error: { code: "CHAT_ERROR", message: error.message } }, 500);
  }
});

// GET /api/v1/chat/health — Pipeline health status
chatRouter.get("/health", async (c) => {
  return c.json({
    success: true,
    data: {
      circuitBreaker: pipeline.getCircuitBreakerState(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/chat/history — Paginated history
chatRouter.get("/history", async (c) => {
  const userId = c.get("userId") as string;
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  const [entries, total] = await Promise.all([
    prisma.healthEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { symptomLogs: true },
    }),
    prisma.healthEntry.count({ where: { userId } }),
  ]);

  return c.json({
    success: true,
    data: entries.map((e) => ({
      id: e.id,
      aiResponse: e.aiResponse,
      detailScore: e.detailScore,
      pointsEarned: e.pointsEarned,
      symptoms: e.symptomLogs.map((s) => ({ name: s.displayName, severity: s.severity, snomedCode: s.snomedCode })),
      entryDate: e.entryDate,
      createdAt: e.createdAt,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export { chatRouter };
