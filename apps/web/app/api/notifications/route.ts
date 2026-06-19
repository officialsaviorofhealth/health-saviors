import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/notifications?limit=20
// Returns recent notifications + unread count for the bell badge.
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 50);

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: user.userId, read: false } }),
  ]);

  return NextResponse.json({
    items: items.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      url: n.url,
      icon: n.icon,
      category: n.category,
      read: n.read,
      createdAt: n.createdAt,
    })),
    unread,
  });
}

// DELETE /api/notifications — clear all notifications for the user
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await prisma.notification.deleteMany({ where: { userId: user.userId } });
  return NextResponse.json({ ok: true, removed: r.count });
}
