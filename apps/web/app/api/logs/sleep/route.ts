import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { checkAndAwardStreakRewards } from '@/lib/points';
import { onSleepLogged } from '@/lib/push-triggers';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { bedtime, wakeTime, quality } = body;

  if (!bedtime || !wakeTime) {
    return NextResponse.json({ error: 'bedtime and wakeTime required' }, { status: 400 });
  }

  const bedDate = new Date(bedtime);
  const wakeDate = new Date(wakeTime);
  const log = await prisma.sleepLog.create({
    data: { userId: user.userId, bedtime: bedDate, wakeTime: wakeDate, quality },
  });

  const { streak, awarded } = await checkAndAwardStreakRewards(user.userId);

  const hours = (wakeDate.getTime() - bedDate.getTime()) / 3600000;
  onSleepLogged(user.userId, hours, typeof quality === 'number' ? quality : null).catch(() => {});

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

  const logs = await prisma.sleepLog.findMany({
    where: { userId: user.userId, createdAt: { gte: date, lt: nextDay } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  return NextResponse.json({ log: logs[0] || null });
}
