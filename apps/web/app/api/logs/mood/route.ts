import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { checkAndAwardStreakRewards } from '@/lib/points';
import { onMoodLogged } from '@/lib/push-triggers';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { score, note } = body;

  if (!score || score < 1 || score > 5) {
    return NextResponse.json({ error: 'score (1-5) required' }, { status: 400 });
  }

  const log = await prisma.moodLog.create({
    data: { userId: user.userId, score, note },
  });

  const { streak, awarded } = await checkAndAwardStreakRewards(user.userId);

  onMoodLogged(user.userId, score).catch(() => {});

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

  const logs = await prisma.moodLog.findMany({
    where: { userId: user.userId, createdAt: { gte: date, lt: nextDay } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ logs });
}
