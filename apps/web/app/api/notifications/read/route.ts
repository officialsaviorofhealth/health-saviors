import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/notifications/read
// Body: { id?: string }   — if id is omitted, marks ALL unread as read
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : null;

  const where = id
    ? { id, userId: user.userId }
    : { userId: user.userId, read: false };

  const r = await prisma.notification.updateMany({ where, data: { read: true } });
  return NextResponse.json({ ok: true, marked: r.count });
}
