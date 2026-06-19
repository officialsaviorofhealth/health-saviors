'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Download, X, Smartphone } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// A small floating banner that nudges the user to the dedicated /install page.
// Shows on Android (any browser) and iOS (any browser). Hidden when:
//   - already installed (standalone)
//   - already on /install or /login or /signup
//   - dismissed within 7 days
export function InstallPrompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Don't pester users on these routes
    if (pathname === '/notifications' || pathname === '/install' || pathname === '/login' || pathname === '/signup') return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (standalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const ua = navigator.userAgent;
    const isMobile = /iPad|iPhone|iPod|Android/i.test(ua);
    const isIos = /iPad|iPhone|iPod/.test(ua);

    if (isMobile) {
      // Slight delay so we don't pop up before the page even renders
      const t = setTimeout(() => { setIosHint(isIos); setShow(true); }, 2500);
      return () => clearTimeout(t);
    }

    // Desktop: only show when the browser is install-ready
    const onBefore = (e: Event) => { e.preventDefault(); setShow(true); };
    window.addEventListener('beforeinstallprompt', onBefore);
    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, [pathname]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-40 animate-fade-up">
      <div className="card p-4 flex items-start gap-3 shadow-lg">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          {iosHint ? <Smartphone size={18} className="text-accent" /> : <Download size={18} className="text-accent" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">Install as an app</p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            Add to your home screen for faster launches and reliable push notifications.
          </p>
          <Link href="/notifications"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition shadow shadow-accent/30">
            <Download size={13} /> Open install guide
          </Link>
        </div>
        <button onClick={dismiss}
          className="text-text-muted hover:text-text-primary p-1 -mr-1 -mt-1 shrink-0" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
