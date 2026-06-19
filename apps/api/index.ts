import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';
import type {
  AIScribeInput,
  AIScribeOutput,
  DashboardData,
  QuizSubmission,
  QuizResult,
  IHospitalAdapter,
  APIResponse,
} from '@health-journal/shared/types';
import { aiScribe } from '@health-journal/ai-scribe/pipeline';
import { EncryptionService } from './services/encryption';
import { IPFSService } from './services/ipfs';
import { RewardService } from './services/rewards';
import { AntiGamingService } from './services/anti-gaming';
import { EducationService } from './services/education';
import { ReminderService } from './services/reminders';
import { AnalyticsService } from './services/analytics';
import { authMiddleware, type AuthContext } from './middleware/auth';

// ============================================================
// API Server — Team Delta
// Hospital integration via plugin adapter pattern
// ============================================================

const app = new Hono();
const prisma = new PrismaClient();

// Services
const encryption = new EncryptionService(process.env.ENCRYPTION_KEY!);
const ipfs = new IPFSService(process.env.PINATA_JWT!);
const rewards = new RewardService(prisma);
const antiGaming = new AntiGamingService(prisma);
const education = new EducationService(prisma);
const reminders = new ReminderService(prisma);
const analytics = new AnalyticsService(prisma);

// ── Hospital Plugin Adapter (null until connected) ──
let hospitalAdapter: IHospitalAdapter | null = null;

export function registerHospitalAdapter(adapter: IHospitalAdapter) {
  hospitalAdapter = adapter;
  console.log('[Plugin] Hospital adapter registered');
}

export function getHospitalAdapter(): IHospitalAdapter | null {
  return hospitalAdapter;
}

// ── Middleware ──
app.use('*', cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use('*', logger());

// ── Health check ──
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    hospitalConnected: hospitalAdapter !== null,
    timestamp: new Date().toISOString(),
  })
);

// ============================================================
// AUTH-PROTECTED ROUTES
// ============================================================
const api = new Hono<{ Variables: AuthContext }>();
api.use('*', authMiddleware(prisma));

// ── CHAT (AI Scribe) ──
api.post('/chat', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ message: string; language?: 'ko' | 'en' }>();

  // Anti-gaming check
  const gamingCheck = await antiGaming.checkInput(userId, body.message);
  if (gamingCheck.blocked) {
    return c.json<APIResponse<null>>({
      success: false,
      error: { code: 'ANTI_GAMING', message: gamingCheck.reason! },
    }, 429);
  }

  // Process through AI Scribe pipeline
  const input: AIScribeInput = {
    userId,
    rawInput: body.message,
    language: body.language || 'ko',
  };

  const result: AIScribeOutput = await aiScribe.process(input);

  // Encrypt and store
  const encryptedInput = encryption.encrypt(body.message);
  const ipfsHash = await ipfs.upload(result.fhirBundle);

  const entry = await prisma.healthEntry.create({
    data: {
      userId,
      rawInput: encryptedInput,
      fhirBundle: result.fhirBundle as any,
      aiResponse: result.aiResponse,
      ipfsHash,
      detailScore: result.detailScore,
      urgencyScore: result.urgencyScore,
      pointsEarned: 0, // Set after reward claim
      entryDate: new Date(),
      source: 'user_chat',
    },
  });

  // Store individual symptom logs
  if (result.extractedSymptoms.length > 0) {
    await prisma.symptomLog.createMany({
      data: result.extractedSymptoms.map((s) => ({
        entryId: entry.id,
        snomedCode: s.snomedCode,
        icd11Code: s.icd11Code,
        displayName: s.displayName,
        displayNameKo: s.displayNameKo,
        severity: s.severity,
        bodySite: s.bodySite,
        onsetDate: s.onsetDate ? new Date(s.onsetDate) : new Date(),
      })),
    });
  }

  // Update user streak
  await rewards.updateStreak(userId);

  return c.json<APIResponse<{ entry: typeof entry; aiResult: AIScribeOutput }>>({
    success: true,
    data: { entry, aiResult: result },
  });
});

// ── REWARDS ──
api.post('/rewards/claim', async (c) => {
  const userId = c.get('userId');
  const walletAddr = c.get('walletAddr');
  const body = await c.req.json<{ entryId: string }>();

  const result = await rewards.claimDaily(userId, walletAddr, body.entryId);
  return c.json<APIResponse<RewardClaimResponse>>({
    success: result.success,
    data: result,
    error: result.error ? { code: 'CLAIM_FAILED', message: result.error } : undefined,
  });
});

api.get('/rewards/history', async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');

  const [transactions, total] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pointTransaction.count({ where: { userId } }),
  ]);

  return c.json<APIResponse<typeof transactions>>({
    success: true,
    data: transactions,
    meta: { page, limit, total },
  });
});

// ── HEALTH TIMELINE ──
api.get('/health/timeline', async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');

  const entries = await prisma.healthEntry.findMany({
    where: { userId },
    include: { symptomLogs: true },
    orderBy: { entryDate: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return c.json<APIResponse<typeof entries>>({ success: true, data: entries });
});

// ── HEALTH ANALYTICS ──
api.get('/health/analytics', async (c) => {
  const userId = c.get('userId');
  const days = parseInt(c.req.query('days') || '30');

  const trends = await analytics.getSymptomTrends(userId, days);
  const insights = await analytics.getInsights(userId);

  return c.json<APIResponse<{ trends: typeof trends; insights: typeof insights }>>({
    success: true,
    data: { trends, insights },
  });
});

// ── DASHBOARD ──
api.get('/dashboard', async (c) => {
  const userId = c.get('userId');

  const [user, recentEntries, trends, insights, rewardHistory, activeReminders] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.healthEntry.findMany({
        where: { userId },
        orderBy: { entryDate: 'desc' },
        take: 5,
        include: { symptomLogs: true },
      }),
      analytics.getSymptomTrends(userId, 30),
      analytics.getInsights(userId),
      prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.medicationReminder.findMany({
        where: { userId, isActive: true },
      }),
    ]);

  const todayEducation = await education.getDailyTip(userId);
  const availableQuiz = await education.getAvailableQuiz(userId);

  return c.json<APIResponse<any>>({
    success: true,
    data: {
      user,
      recentEntries,
      symptomTrends: trends,
      insights,
      rewardHistory,
      activeReminders,
      todayEducation,
      availableQuiz,
    },
  });
});

// ── EDUCATION (L2E) ──
api.get('/education/daily', async (c) => {
  const userId = c.get('userId');
  const tip = await education.getDailyTip(userId);
  return c.json<APIResponse<typeof tip>>({ success: true, data: tip });
});

api.get('/education/quiz', async (c) => {
  const userId = c.get('userId');
  const quiz = await education.getAvailableQuiz(userId);
  return c.json<APIResponse<typeof quiz>>({ success: true, data: quiz });
});

api.post('/education/quiz/submit', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<QuizSubmission>();
  const result = await education.submitQuiz(userId, body);
  return c.json<APIResponse<QuizResult>>({ success: true, data: result });
});

// ── REMINDERS ──
api.get('/reminders', async (c) => {
  const userId = c.get('userId');
  const [meds, screenings] = await Promise.all([
    prisma.medicationReminder.findMany({ where: { userId, isActive: true } }),
    prisma.screeningReminder.findMany({ where: { userId, isCompleted: false } }),
  ]);
  return c.json<APIResponse<{ medications: typeof meds; screenings: typeof screenings }>>({
    success: true,
    data: { medications: meds, screenings },
  });
});

api.post('/reminders/medication', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const reminder = await reminders.createMedicationReminder(userId, body);
  return c.json<APIResponse<typeof reminder>>({ success: true, data: reminder });
});

api.post('/reminders/medication/:id/checkin', async (c) => {
  const userId = c.get('userId');
  const reminderId = c.req.param('id');
  const result = await reminders.medicationCheckin(userId, reminderId);
  return c.json<APIResponse<typeof result>>({ success: true, data: result });
});

// ── DATA CONSENT ──
api.post('/consent/grant', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ grantee: string; scope: any }>();

  const consent = await prisma.dataConsentRecord.create({
    data: { userId, grantee: body.grantee, scope: body.scope },
  });

  return c.json<APIResponse<typeof consent>>({ success: true, data: consent });
});

api.delete('/consent/:id', async (c) => {
  const userId = c.get('userId');
  const consentId = c.req.param('id');

  const consent = await prisma.dataConsentRecord.update({
    where: { id: consentId, userId },
    data: { revokedAt: new Date() },
  });

  return c.json<APIResponse<typeof consent>>({ success: true, data: consent });
});

// ── HOSPITAL PLUGIN ROUTES ──
// These routes only work when a hospital adapter is registered
api.get('/hospital/status', async (c) => {
  if (!hospitalAdapter) {
    return c.json<APIResponse<{ connected: false }>>({
      success: true,
      data: { connected: false },
    });
  }
  const status = await hospitalAdapter.healthCheck();
  return c.json<APIResponse<typeof status>>({ success: true, data: status });
});

api.post('/hospital/sync', async (c) => {
  if (!hospitalAdapter) {
    return c.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'HOSPITAL_NOT_CONNECTED',
        message: 'Hospital adapter not registered',
      },
    }, 503);
  }

  const userId = c.get('userId');
  const body = await c.req.json<{ consentId: string }>();
  const result = await hospitalAdapter.syncPatientRecords(userId, body.consentId);
  return c.json<APIResponse<typeof result>>({ success: true, data: result });
});

api.post('/hospital/share', async (c) => {
  if (!hospitalAdapter) {
    return c.json<APIResponse<null>>({
      success: false,
      error: { code: 'HOSPITAL_NOT_CONNECTED', message: 'Hospital adapter not registered' },
    }, 503);
  }

  const userId = c.get('userId');
  const body = await c.req.json<{ hospitalId: string; entryIds: string[] }>();
  const result = await hospitalAdapter.shareWithHospital(userId, body.hospitalId, body.entryIds);
  return c.json<APIResponse<typeof result>>({ success: true, data: result });
});

api.get('/hospital/prescriptions', async (c) => {
  if (!hospitalAdapter) {
    return c.json<APIResponse<null>>({
      success: false,
      error: { code: 'HOSPITAL_NOT_CONNECTED', message: 'Hospital adapter not registered' },
    }, 503);
  }

  const userId = c.get('userId');
  const prescriptions = await hospitalAdapter.importPrescriptions(userId);

  // Auto-create reminders from prescriptions
  for (const rx of prescriptions) {
    await reminders.createMedicationReminder(userId, {
      medicationName: rx.medicationName,
      dosage: rx.dosage,
      frequency: rx.frequency,
      startDate: rx.startDate,
      endDate: rx.endDate,
      source: 'hospital_sync',
    });
  }

  return c.json<APIResponse<typeof prescriptions>>({ success: true, data: prescriptions });
});

// ── LEADERBOARD ──
api.get('/leaderboard', async (c) => {
  const period = c.req.query('period') || 'weekly';
  const limit = parseInt(c.req.query('limit') || '20');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      walletAddr: true,
      streakDays: true,
      totalPoints: true,
      level: true,
    },
    orderBy: { totalPoints: 'desc' },
    take: limit,
  });

  return c.json<APIResponse<typeof users>>({ success: true, data: users });
});

// ── REPORT ──
api.post('/report/generate', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ period: 'weekly' | 'monthly' | 'all' }>();

  // Generate report (PDF generation is a future enhancement)
  const entries = await prisma.healthEntry.findMany({
    where: { userId },
    include: { symptomLogs: true },
    orderBy: { entryDate: 'desc' },
    take: body.period === 'weekly' ? 7 : body.period === 'monthly' ? 30 : 1000,
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  return c.json<APIResponse<{
    reportUrl: string;
    format: string;
    entriesIncluded: number;
    period: string;
    generatedAt: string;
    summary: { totalEntries: number; streakDays: number; totalPoints: string };
  }>>({
    success: true,
    data: {
      reportUrl: `report_${userId}_${body.period}_${Date.now()}.json`,
      format: 'json',
      entriesIncluded: entries.length,
      period: body.period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEntries: entries.length,
        streakDays: user?.streakDays ?? 0,
        totalPoints: (user?.totalPoints ?? 0).toString(),
      },
    },
  });
});

// Mount API routes
app.route('/api/v1', api);

export default app;
export { app, prisma };
