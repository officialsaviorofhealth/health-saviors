import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { checkAndAwardStreakRewards } from '@/lib/points';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { durationMin, sessionType, note } = body;

  if (!durationMin || !sessionType) {
    return NextResponse.json({ error: 'durationMin and sessionType required' }, { status: 400 });
  }

  const log = await prisma.meditationLog.create({
    data: { userId: user.userId, durationMin, sessionType, note },
  });

  const { streak, awarded } = await checkAndAwardStreakRewards(user.userId);

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

  const logs = await prisma.meditationLog.findMany({
    where: { userId: user.userId, createdAt: { gte: date, lt: nextDay } },
    orderBy: { createdAt: 'desc' },
  });

  const totalMin = logs.reduce((sum, l) => sum + l.durationMin, 0);

  return NextResponse.json({ logs, totalMin });
}
