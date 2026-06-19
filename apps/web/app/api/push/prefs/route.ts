import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const ALLOWED = ['rewards', 'reminders', 'agentFollowups', 'community'] as const;

// GET /api/push/prefs — current preferences (creates row with defaults if missing)
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.userId },
    update: {},
    create: { userId: user.userId },
  });

  return NextResponse.json({ prefs });
}

// PATCH /api/push/prefs — toggle individual categories
export async function PATCH(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const data: Record<string, boolean> = {};
  for (const key of ALLOWED) {
    if (typeof body[key] === 'boolean') data[key] = body[key];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.userId },
    update: data,
    create: { userId: user.userId, ...data },
  });

  return NextResponse.json({ prefs });
}
