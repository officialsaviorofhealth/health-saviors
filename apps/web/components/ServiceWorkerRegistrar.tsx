'use client';

import { useEffect } from 'react';

// Registers /sw.js once when the app loads. Updates check on each load.
// Intentionally silent — UI for install/notifications lives in a separate component.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register on idle so it never blocks first paint
    const reg = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(r => {
          // Force update check on every load (cheap)
          r.update().catch(() => {});
        })
        .catch(err => {
          console.warn('SW register failed:', err);
        });
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(reg);
    } else {
      window.addEventListener('load', reg, { once: true });
    }

    // Re-subscribe when the push subscription is invalidated by the browser
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pushsubscriptionchange') {
        // The push settings page handles re-subscribe on next visit; nothing else to do here.
        console.log('Push subscription changed — user will be re-subscribed on next visit to settings.');
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
