// Server-side helper for sending Web Push notifications.
// Subscriptions whose endpoint returns 404/410 are auto-deleted from DB.
import webpush from 'web-push';
import { prisma } from './prisma';

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) {
    console.warn('Web Push: VAPID keys not configured — skipping send.');
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;          // where clicking the notification takes the user
  tag?: string;          // collapse duplicates with same tag
  icon?: string;
  image?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
  actions?: { action: string; title: string }[];
  data?: Record<string, any>;
}

export type NotificationCategory = 'rewards' | 'reminders' | 'agentFollowups' | 'community';

/**
 * Send a push to a single user's subscriptions, respecting their notification prefs.
 * Returns the number of subscriptions successfully reached.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  category?: NotificationCategory,
): Promise<number> {
  if (!ensureConfigured()) return 0;

  // Respect notification preferences
  if (category) {
    const prefs = await prisma.notificationPrefs.findUnique({ where: { userId } });
    // Default = enabled if no prefs row yet
    if (prefs && (prefs as any)[category] === false) return 0;
  }

  // Always log the notification so it shows up in the bell dropdown — even if
  // OS push delivery fails (e.g. user blocked notifications or has no subs yet).
  prisma.notification.create({
    data: {
      userId,
      category: category || null,
      title: payload.title,
      body: payload.body || null,
      url: payload.url || null,
      icon: payload.icon || null,
    },
  }).catch(() => {});

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const json = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        json,
        { TTL: 60 * 60 * 24 } // 24h
      );
      // Bump lastUsed for analytics
      prisma.pushSubscription.update({
        where: { id: s.id },
        data: { lastUsed: new Date() },
      }).catch(() => {});
      delivered++;
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription is dead — clean it up
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.warn('Push send failed:', status, err?.body || err?.message);
      }
    }
  }));

  return delivered;
}
