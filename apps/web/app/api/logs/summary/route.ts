import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/logs/summary?date=2026-04-08&range=day|week|month
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dateStr = request.nextUrl.searchParams.get('date');
  const range = request.nextUrl.searchParams.get('range') || 'day';

  const baseDate = dateStr ? new Date(dateStr) : new Date();
  baseDate.setHours(0, 0, 0, 0);

  let startDate: Date;
  let endDate: Date;

  if (range === 'week') {
    const day = baseDate.getDay();
    startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - day); // Sunday
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else if (range === 'month') {
    startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  } else {
    startDate = new Date(baseDate);
    endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 1);
  }

  const where = { userId: user.userId, createdAt: { gte: startDate, lt: endDate } };

  const [water, meals, exercises, sleeps, moods, meditations, pointsData] = await Promise.all([
    prisma.waterLog.aggregate({ where, _sum: { amountMl: true }, _count: true }),
    prisma.mealLog.findMany({ where: { ...where }, orderBy: { createdAt: 'asc' } }),
    prisma.exerciseLog.findMany({ where: { ...where }, orderBy: { createdAt: 'asc' } }),
    prisma.sleepLog.findMany({ where: { ...where }, orderBy: { createdAt: 'desc' } }),
    prisma.moodLog.findMany({ where: { ...where }, orderBy: { createdAt: 'desc' } }),
    prisma.meditationLog.findMany({ where: { ...where }, orderBy: { createdAt: 'desc' } }),
    prisma.user.findUnique({ where: { id: user.userId }, select: { tokenBalance: true } }),
  ]);

  return NextResponse.json({
    range,
    startDate,
    endDate,
    water: {
      totalMl: water._sum.amountMl || 0,
      count: water._count,
      goalReached: (water._sum.amountMl || 0) >= 2000,
    },
    meals: {
      logs: meals,
      totalCalories: meals.reduce((s, m) => s + (m.calories || 0), 0),
      count: meals.length,
    },
    exercise: {
      logs: exercises,
      totalMin: exercises.reduce((s, e) => s + e.durationMin, 0),
      totalKm: exercises.reduce((s, e) => s + (e.distanceKm || 0), 0),
    },
    sleep: {
      logs: sleeps,
    },
    mood: {
      logs: moods,
      average: moods.length > 0 ? moods.reduce((s, m) => s + m.score, 0) / moods.length : null,
    },
    meditation: {
      logs: meditations,
      totalMin: meditations.reduce((s, m) => s + m.durationMin, 0),
    },
    points: pointsData?.tokenBalance || 0,
  });
}
