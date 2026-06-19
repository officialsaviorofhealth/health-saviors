// Client-side helpers for browser permission + Push subscription lifecycle.
// Lives in lib/ so multiple components (settings page, install prompt) can share.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushState =
  | 'unsupported'         // browser has no SW or PushManager
  | 'denied'              // user blocked permission
  | 'default'             // not yet asked
  | 'granted-no-sub'      // permission granted but no active subscription
  | 'subscribed';

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';

  const perm = Notification.permission;
  if (perm === 'denied') return 'denied';
  if (perm === 'default') return 'default';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'granted-no-sub';
  } catch {
    return 'unsupported';
  }
}

export async function subscribeToPush(token: string): Promise<{ ok: true } | { ok: false; error: string; expired?: boolean }> {
  if (typeof window === 'undefined') return { ok: false, error: 'no window' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push notifications are not supported in this browser.' };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, error: 'Server is missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.' };

  // Make sure the SW is registered + active
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, error: 'Service worker not available yet — try again in a moment.' };
  }

  // Ask permission only if not yet granted
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'Permission denied.' };
  } else if (Notification.permission === 'denied') {
    return { ok: false, error: 'Notifications are blocked. Enable them in your browser settings.' };
  }

  // Reuse existing subscription if any, else create one
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  // Send to server
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (res.status === 401) return { ok: false, error: 'Session expired', expired: true };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || `Server error ${res.status}` };
  }
  return { ok: true };
}

export async function unsubscribeFromPush(token: string): Promise<{ ok: boolean }> {
  if (typeof window === 'undefined') return { ok: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function sendTestPush(token: string): Promise<{ ok: boolean; error?: string; expired?: boolean }> {
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { ok: false, error: 'Session expired', expired: true };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `Server error ${res.status}` };
  return { ok: true };
}

// Clear local session and bounce to /login, preserving the current path so the
// user returns where they were after re-authenticating.
export function handleExpiredSession() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {}
  if (typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname || '/notifications');
    window.location.href = `/login?next=${next}`;
  }
}
