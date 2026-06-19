import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push';

// POST /api/push/test — send a sample notification to the current user (for the settings UI)
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const delivered = await sendPushToUser(user.userId, {
    title: '🦊 Test from Health Saviors',
    body: 'Push notifications are working! Tap to open the dashboard.',
    url: '/dashboard',
    tag: 'test',
    requireInteraction: false,
  });

  if (delivered === 0) {
    return NextResponse.json({
      ok: false,
      error: 'No active subscriptions, or VAPID keys not configured.',
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true, delivered });
}
