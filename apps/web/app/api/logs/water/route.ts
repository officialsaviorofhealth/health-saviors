import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { checkAndAwardStreakRewards } from '@/lib/points';
import { onWaterLogged } from '@/lib/push-triggers';

// POST /api/logs/water — log water intake
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amountMl = body.amountMl || 250;

  const log = await prisma.waterLog.create({
    data: { userId: user.userId, amountMl },
  });

  const { streak, awarded } = await checkAndAwardStreakRewards(user.userId);

  // Check daily goal (2000ml)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTotal = await prisma.waterLog.aggregate({
    where: { userId: user.userId, createdAt: { gte: today } },
    _sum: { amountMl: true },
  });

  const totalMl = todayTotal._sum.amountMl || 0;

  // Fire-and-forget push if 2L goal just crossed
  onWaterLogged(user.userId, totalMl, amountMl).catch(() => {});

  return NextResponse.json({ log, totalMl, goalReached: totalMl >= 2000, streak, awarded });
}

// DELETE /api/logs/water — undo the most recent cup logged today
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = await prisma.waterLog.findFirst({
    where: { userId: user.userId, createdAt: { gte: today } },
    orderBy: { createdAt: 'desc' },
  });
  if (!last) return NextResponse.json({ error: 'Nothing to undo today' }, { status: 404 });

  await prisma.waterLog.delete({ where: { id: last.id } });

  // Recompute today's total
  const totalAgg = await prisma.waterLog.aggregate({
    where: { userId: user.userId, createdAt: { gte: today } },
    _sum: { amountMl: true },
  });
  const totalMl = totalAgg._sum.amountMl || 0;

  return NextResponse.json({ ok: true, removedMl: last.amountMl, totalMl });
}

// GET /api/logs/water?date=2026-04-08 — get today's water logs
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dateStr = request.nextUrl.searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const logs = await prisma.waterLog.findMany({
    where: { userId: user.userId, createdAt: { gte: date, lt: nextDay } },
    orderBy: { createdAt: 'asc' },
  });

  const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);

  return NextResponse.json({ logs, totalMl, goalReached: totalMl >= 2000 });
}
