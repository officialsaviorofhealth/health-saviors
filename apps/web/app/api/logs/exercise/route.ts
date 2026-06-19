import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { checkAndAwardStreakRewards } from '@/lib/points';
import { onExerciseLogged } from '@/lib/push-triggers';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { exerciseType, durationMin, distanceKm, calories, intensity } = body;

  if (!exerciseType || !durationMin) {
    return NextResponse.json({ error: 'exerciseType and durationMin required' }, { status: 400 });
  }

  const log = await prisma.exerciseLog.create({
    data: { userId: user.userId, exerciseType, durationMin, distanceKm, calories, intensity },
  });

  const { streak, awarded } = await checkAndAwardStreakRewards(user.userId);

  onExerciseLogged(user.userId, durationMin).catch(() => {});

  return NextResponse.json({ log, streak, awarded });
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dateStr = request.nextUrl.searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const logs = await prisma.exerciseLog.findMany({
    where: { userId: user.userId, createdAt: { gte: date, lt: nextDay } },
    orderBy: { createdAt: 'asc' },
  });

  const totalMin = logs.reduce((sum, l) => sum + l.durationMin, 0);
  const totalKm = logs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);

  return NextResponse.json({ logs, totalMin, totalKm });
}
