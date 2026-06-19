import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// ============================================================
// Encryption Service — AES-256-GCM
// ============================================================
export class EncryptionService {
  private key: Buffer;

  constructor(encryptionKey: string) {
    this.key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// ============================================================
// IPFS Service — Pinata
// ============================================================
export class IPFSService {
  private jwt: string;
  private endpoint = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

  constructor(jwt: string) {
    this.jwt = jwt;
  }

  async upload(data: any): Promise<string> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.jwt}`,
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: { name: `health-entry-${Date.now()}` },
        }),
      });
      const result = await res.json();
      return result.IpfsHash;
    } catch (err) {
      console.error('[IPFS] Upload failed:', err);
      return ''; // Non-blocking: entry still saved in DB
    }
  }
}

// ============================================================
// Reward Service — Backend signature + streak management
// ============================================================
export class RewardService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async updateStreak(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEntry = await this.prisma.healthEntry.findFirst({
      where: {
        userId,
        entryDate: { gte: today },
      },
    });

    const yesterdayEntry = await this.prisma.healthEntry.findFirst({
      where: {
        userId,
        entryDate: { gte: yesterday, lt: today },
      },
    });

    let newStreak = user.streakDays;
    if (!todayEntry && yesterdayEntry) {
      // Still within streak window
    } else if (todayEntry && yesterdayEntry) {
      newStreak = user.streakDays + 1;
    } else if (todayEntry && !yesterdayEntry) {
      newStreak = 1; // Reset
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { streakDays: newStreak },
    });
  }

  async claimDaily(
    userId: string,
    _walletAddr: string,
    entryId: string
  ): Promise<any> {
    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingClaim = await this.prisma.pointTransaction.findFirst({
      where: {
        userId,
        type: 'HEALTH_LOG',
        createdAt: { gte: today },
      },
    });

    if (existingClaim) {
      return { success: false, error: 'Already claimed today' };
    }

    const entry = await this.prisma.healthEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry || entry.userId !== userId) {
      return { success: false, error: 'Entry not found' };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'User not found' };

    // Calculate reward points (no blockchain, just DB points)
    const multiplier = this.getMultiplier(user.streakDays);
    const baseReward = 10;
    let totalReward = Math.floor((baseReward * multiplier) / 100);
    const bonuses: any[] = [];

    if (entry.detailScore >= 5) {
      totalReward += 5;
      bonuses.push({ type: 'detail_bonus', amount: '5' });
    }

    // Record confirmed transaction (no pending state needed)
    await this.prisma.pointTransaction.create({
      data: {
        userId,
        amount: totalReward,
        type: 'HEALTH_LOG',
        description: `Daily log (entryId: ${entryId}, detail: ${entry.detailScore}, streak: ${user.streakDays})`,
      },
    });

    // Update points directly
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalPoints: { increment: totalReward },
      },
    });

    return {
      success: true,
      amount: totalReward.toString(),
      newStreak: user.streakDays,
      multiplier,
      bonuses,
    };
  }

  private getMultiplier(streak: number): number {
    if (streak >= 90) return 500;
    if (streak >= 30) return 300;
    if (streak >= 14) return 200;
    if (streak >= 7) return 150;
    if (streak >= 3) return 120;
    return 100;
  }
}

// ============================================================
// Anti-Gaming Service
// ============================================================
export class AntiGamingService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async checkInput(
    userId: string,
    input: string
  ): Promise<{ blocked: boolean; reason?: string }> {
    // 1. Rate limit: max 5 entries per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.healthEntry.count({
      where: { userId, createdAt: { gte: today } },
    });
    if (todayCount >= 5) {
      return {
        blocked: true,
        reason: 'Daily entry limit reached (5/day)',
      };
    }

    // 2. Minimum length check
    if (input.trim().length < 5) {
      return {
        blocked: true,
        reason: 'Input too short — please describe your health in more detail',
      };
    }

    // 3. Copy-paste detection: check similarity to recent entries
    const recentEntries = await this.prisma.healthEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { rawInput: true },
    });

    // Simple Jaccard similarity check
    const inputTokens = new Set(input.toLowerCase().split(/\s+/));
    for (const entry of recentEntries) {
      // Note: rawInput is encrypted, so we'd need to decrypt for real check
      // Simplified here — in production, store input hash for comparison
    }

    // 4. Gibberish detection (basic)
    const koreanChars = (input.match(/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/g) || []).length;
    const englishChars = (input.match(/[a-zA-Z]/g) || []).length;
    const totalChars = input.replace(/\s/g, '').length;
    const meaningfulRatio = (koreanChars + englishChars) / Math.max(totalChars, 1);

    if (meaningfulRatio < 0.5) {
      return {
        blocked: true,
        reason: 'Input appears to be gibberish',
      };
    }

    return { blocked: false };
  }
}

// ============================================================
// Analytics Service
// ============================================================
export class AnalyticsService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getSymptomTrends(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const symptoms = await this.prisma.symptomLog.groupBy({
      by: ['snomedCode', 'displayName'],
      where: {
        entry: { userId },
        onsetDate: { gte: since },
      },
      _count: { snomedCode: true },
      orderBy: { _count: { snomedCode: 'desc' } },
      take: 10,
    });

    // Calculate actual trend for each symptom by comparing first half vs second half of period
    const midDate = new Date(since.getTime() + (Date.now() - since.getTime()) / 2);

    const symptomTrendsWithDirection = await Promise.all(
      symptoms.map(async (s) => {
        const [firstHalf, secondHalf] = await Promise.all([
          this.prisma.symptomLog.count({
            where: {
              entry: { userId },
              snomedCode: s.snomedCode,
              onsetDate: { gte: since, lt: midDate },
            },
          }),
          this.prisma.symptomLog.count({
            where: {
              entry: { userId },
              snomedCode: s.snomedCode,
              onsetDate: { gte: midDate },
            },
          }),
        ]);

        let trend: 'improving' | 'worsening' | 'stable' = 'stable';
        if (secondHalf > firstHalf * 1.3) trend = 'worsening';
        else if (firstHalf > secondHalf * 1.3) trend = 'improving';

        return {
          snomedCode: s.snomedCode,
          displayName: s.displayName,
          occurrences: s._count.snomedCode,
          trend,
        };
      })
    );

    return symptomTrendsWithDirection;
  }

  async getInsights(userId: string) {
    // Placeholder — will be enhanced with AI pattern analysis
    return [];
  }
}

// ============================================================
// Education Service — L2E
// ============================================================
export class EducationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getDailyTip(userId: string) {
    const attempt = await this.prisma.educationContent.findFirst({
      where: {
        contentType: 'daily_tip',
        isActive: true,
        // Exclude already seen tips
        NOT: {
          quizAttempts: { some: { userId } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return attempt;
  }

  async getAvailableQuiz(userId: string) {
    return this.prisma.educationContent.findFirst({
      where: {
        contentType: 'quiz',
        isActive: true,
        NOT: {
          quizAttempts: { some: { userId } },
        },
      },
    });
  }

  async submitQuiz(userId: string, submission: { quizId: string; selectedOptionId: string }) {
    const quiz = await this.prisma.educationContent.findUnique({
      where: { id: submission.quizId },
    });
    if (!quiz) throw new Error('Quiz not found');

    const content = quiz.content as any;
    const isCorrect = content.correctOptionId === submission.selectedOptionId;

    await this.prisma.quizAttempt.create({
      data: {
        userId,
        contentId: submission.quizId,
        selectedOptionId: submission.selectedOptionId,
        isCorrect,
        rewardEarned: isCorrect ? quiz.rewardAmount : null,
      },
    });

    return {
      correct: isCorrect,
      correctOptionId: content.correctOptionId,
      explanation: content.explanation || '',
      rewardEarned: isCorrect ? quiz.rewardAmount.toString() : undefined,
    };
  }
}

// ============================================================
// Reminder Service
// ============================================================
export class ReminderService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createMedicationReminder(userId: string, data: any) {
    return this.prisma.medicationReminder.create({
      data: {
        userId,
        medicationName: data.medicationName,
        dosage: data.dosage,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        source: data.source || 'manual',
      },
    });
  }

  async medicationCheckin(userId: string, reminderId: string) {
    const reminder = await this.prisma.medicationReminder.findFirst({
      where: { id: reminderId, userId },
    });
    if (!reminder) throw new Error('Reminder not found');

    // Record medication checkin reward (simple points)
    const rewardAmount = 3;
    await this.prisma.pointTransaction.create({
      data: {
        userId,
        amount: rewardAmount,
        type: 'HEALTH_LOG',
        description: `Medication checkin (reminderId: ${reminderId})`,
      },
    });

    // Credit points to user
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: rewardAmount } },
    });

    return { success: true, rewardAmount: rewardAmount.toString() };
  }
}
