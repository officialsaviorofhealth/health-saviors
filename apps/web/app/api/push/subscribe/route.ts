import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/push/subscribe — save a Web Push subscription for the current user
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const sub = body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent') || '';

  // Upsert by endpoint (a single browser produces a stable endpoint per origin)
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: {
      userId: user.userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent.slice(0, 500),
      lastUsed: new Date(),
    },
    create: {
      userId: user.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent.slice(0, 500),
    },
  });

  // Ensure prefs row exists with defaults
  await prisma.notificationPrefs.upsert({
    where: { userId: user.userId },
    update: {},
    create: { userId: user.userId },
  });

  return NextResponse.json({ ok: true, id: saved.id });
}

// DELETE /api/push/subscribe?endpoint=... — unsubscribe a specific subscription
// (Or all of the user's subs if no endpoint provided.)
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const endpoint = request.nextUrl.searchParams.get('endpoint');
  const where = endpoint
    ? { endpoint, userId: user.userId }
    : { userId: user.userId };

  const result = await prisma.pushSubscription.deleteMany({ where });
  return NextResponse.json({ ok: true, removed: result.count });
}

// GET /api/push/subscribe — count of active subscriptions for this user
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: user.userId },
    select: { id: true, userAgent: true, createdAt: true, lastUsed: true },
    orderBy: { lastUsed: 'desc' },
  });
  return NextResponse.json({ subscriptions: subs });
}
