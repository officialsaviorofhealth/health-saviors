// Learn-to-Earn Engine / L2E Education Engine
// Personalized health education based on user symptom history
// Supports Prisma DI for database-backed tips and quizzes

import type { PrismaClient } from "@prisma/client";

interface SymptomTrend {
  snomedCode: string;
  displayName: string;
  occurrences: number;
}

interface DailyTip {
  id: string; title: string; titleKo: string;
  content: string; contentKo: string;
  category: string; relatedSnomedCodes?: string[];
}

export class EducationEngine {
  private prisma: PrismaClient | null = null;

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Generate personalized daily tip
  async generateDailyTip(userId: string, recentSymptoms: SymptomTrend[]): Promise<DailyTip | null> {
    // Try DB-backed tips first
    if (this.prisma) {
      const snomedCodes = recentSymptoms.map((s) => s.snomedCode);

      // 1. Try symptom-related tip
      if (snomedCodes.length > 0) {
        const tip = await this.prisma.dailyTip.findFirst({
          where: { isActive: true, relatedSnomedCodes: { hasSome: snomedCodes } },
          orderBy: { createdAt: "desc" },
        });
        if (tip) return this.mapTip(tip);
      }

      // 2. Random active tip
      const count = await this.prisma.dailyTip.count({ where: { isActive: true } });
      if (count > 0) {
        const skip = Math.floor(Math.random() * count);
        const tip = await this.prisma.dailyTip.findFirst({ where: { isActive: true }, skip });
        if (tip) return this.mapTip(tip);
      }
    }

    // Fallback: in-memory tips
    if (recentSymptoms.length > 0) {
      const topSymptom = recentSymptoms.sort((a, b) => b.occurrences - a.occurrences)[0];
      return this.getSymptomRelatedTip(topSymptom);
    }
    return this.getSeasonalTip();
  }

  // Get next unanswered quiz
  async getNextQuiz(userId: string) {
    if (!this.prisma) return null;

    const answeredIds = (
      await this.prisma.quizSubmission.findMany({
        where: { userId },
        select: { quizId: true },
      })
    ).map((s) => s.quizId);

    return this.prisma.quizQuestion.findFirst({
      where: { isActive: true, id: { notIn: answeredIds.length > 0 ? answeredIds : ["none"] } },
      orderBy: { createdAt: "asc" },
    });
  }

  // Submit quiz answer
  async submitQuiz(userId: string, quizId: string, selectedIndex: number) {
    if (!this.prisma) return null;

    const quiz = await this.prisma.quizQuestion.findUnique({ where: { id: quizId } });
    if (!quiz) return null;

    const isCorrect = selectedIndex === quiz.correctIndex;
    const rewardEarned = isCorrect ? quiz.rewardAmount : 0;

    await this.prisma.quizSubmission.create({
      data: { userId, quizId, selectedIndex, isCorrect, rewardEarned },
    });

    if (isCorrect) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: rewardEarned } },
      });
    }

    return { isCorrect, rewardEarned, correctIndex: quiz.correctIndex, explanation: quiz.explanation, explanationKo: quiz.explanationKo };
  }

  private mapTip(tip: any): DailyTip {
    return {
      id: tip.id, title: tip.title, titleKo: tip.titleKo,
      content: tip.content, contentKo: tip.contentKo,
      category: tip.category, relatedSnomedCodes: tip.relatedSnomedCodes,
    };
  }

  private getSymptomRelatedTip(symptom: SymptomTrend): DailyTip {
    const tipMap: Record<string, DailyTip> = {
      "25064002": {
        id: "tip-headache-01", title: "Managing Recurring Headaches", titleKo: "Managing Recurring Headaches",
        content: "If you experience headaches frequently, keeping a headache diary helps identify triggers. Track: time of day, food consumed, sleep quality, stress level, and screen time.",
        contentKo: "If you experience headaches frequently, keeping a headache diary helps identify triggers. Track the time of day, food consumed, sleep quality, stress level, and screen time.",
        category: "neurological", relatedSnomedCodes: ["25064002"],
      },
      "386661006": {
        id: "tip-fever-01", title: "When to Worry About Fever", titleKo: "When to Worry About Fever",
        content: "A fever is your body's natural defense. Adults: seek care if >39.4°C, lasting >3 days, or with severe headache/rash.",
        contentKo: "A fever is your body's natural defense mechanism. Adults: seek care if it exceeds 39.4°C, lasts more than 3 days, or is accompanied by a severe headache or rash.",
        category: "general", relatedSnomedCodes: ["386661006"],
      },
      "267036007": {
        id: "tip-fatigue-01", title: "Fighting Chronic Fatigue", titleKo: "Fighting Chronic Fatigue",
        content: "Chronic fatigue can be improved with: regular sleep schedule, morning sunlight exposure, iron-rich foods, and 30 min daily walking.",
        contentKo: "Chronic fatigue can be improved with a regular sleep schedule, morning sunlight exposure, iron-rich foods, and 30 minutes of daily walking.",
        category: "lifestyle", relatedSnomedCodes: ["267036007", "84229001"],
      },
    };

    return tipMap[symptom.snomedCode] || {
      id: "tip-general-01", title: "Stay Hydrated", titleKo: "Stay Hydrated",
      content: "Drinking 8 glasses of water daily supports overall health and helps your body recover.",
      contentKo: "Drinking 8 glasses of water daily supports overall health and helps your body recover.",
      category: "general",
    };
  }

  private getSeasonalTip(): DailyTip {
    const month = new Date().getMonth();
    if (month >= 11 || month <= 1) {
      return {
        id: "tip-winter-01", title: "Winter Respiratory Care", titleKo: "Winter Respiratory Care",
        content: "Keep indoor humidity 40-60%, ventilate regularly, and wash hands frequently to prevent respiratory infections.",
        contentKo: "Keep indoor humidity at 40-60%, ventilate regularly, and wash hands frequently to prevent respiratory infections.",
        category: "seasonal",
      };
    }
    if (month >= 2 && month <= 4) {
      return {
        id: "tip-spring-01", title: "Spring Allergy Prevention", titleKo: "Spring Allergy Prevention",
        content: "Monitor pollen counts, keep windows closed during high-pollen days, and shower after outdoor activities.",
        contentKo: "Monitor pollen counts, keep windows closed on high-pollen days, and shower after outdoor activities.",
        category: "seasonal",
      };
    }
    if (month >= 5 && month <= 8) {
      return {
        id: "tip-summer-01", title: "Summer Hydration", titleKo: "Summer Hydration",
        content: "In summer heat, drink water every 20 minutes during outdoor activities. Watch for signs of heat exhaustion.",
        contentKo: "In summer heat, drink water every 20 minutes during outdoor activities. Watch for early signs of heat exhaustion.",
        category: "seasonal",
      };
    }
    return {
      id: "tip-autumn-01", title: "Seasonal Transition Care", titleKo: "Seasonal Transition Care",
      content: "Temperature changes can weaken immunity. Layer clothing and maintain regular sleep patterns.",
      contentKo: "Temperature changes can weaken immunity. Dress in layers and maintain regular sleep patterns.",
      category: "seasonal",
    };
  }
}

export const educationEngine = new EducationEngine();
