// Platform / browser detection for the PWA install flow.
// Lives in a hook so it stays SSR-safe (returns null until mounted).

import { useEffect, useState } from 'react';

export type Platform = 'ios' | 'android' | 'desktop' | 'unknown';
export type Browser =
  | 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung'
  | 'kakaotalk' | 'naver' | 'instagram' | 'facebook' | 'line'
  | 'webview' | 'other';

export interface InstallEnv {
  platform: Platform;
  browser: Browser;
  standalone: boolean;       // already running as installed app
  canPrompt: boolean;        // beforeinstallprompt event available
  isIosSafari: boolean;
  isIosOther: boolean;       // iOS Chrome/Firefox/Naver/etc — must redirect to Safari to install
  inInAppBrowser: boolean;   // KakaoTalk / Instagram / Naver / Facebook in-app browser
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectPlatform(ua: string): Platform {
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Mac|Win|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

function detectBrowser(ua: string): Browser {
  // Order matters — more specific UAs first
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/NAVER\(inapp|inapp; naver/i.test(ua)) return 'naver';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  if (/Line\//i.test(ua)) return 'line';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg(e|A|iOS)?\//i.test(ua)) return 'edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  // Chrome detection: Chrome, CriOS (iOS Chrome) — but exclude Safari
  if (/CriOS|Chrome\//i.test(ua) && !/SamsungBrowser/i.test(ua)) return 'chrome';
  // Safari detection: must NOT contain Chrome/CriOS/Edge
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Edge|Edg|Android/i.test(ua)) return 'safari';
  // WebView heuristics (iOS WkWebView leaves no clear marker; Android wv)
  if (/wv\)/.test(ua)) return 'webview';
  return 'other';
}

export function useInstallEnv(): InstallEnv | null {
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    const platform = detectPlatform(ua);
    const browser = detectBrowser(ua);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const isIosSafari = platform === 'ios' && browser === 'safari';
    const isIosOther = platform === 'ios' && !isIosSafari;
    const inInAppBrowser =
      browser === 'kakaotalk' || browser === 'naver' ||
      browser === 'instagram' || browser === 'facebook' ||
      browser === 'line' || browser === 'webview';

    setEnv({
      platform,
      browser,
      standalone,
      canPrompt: false,
      isIosSafari,
      isIosOther,
      inInAppBrowser,
    });

    // Listen for the install prompt — only fires on Android Chrome/Edge/Samsung
    const onBefore = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferredPrompt(ev);
      setEnv(prev => prev ? { ...prev, canPrompt: true } : prev);
    };
    window.addEventListener('beforeinstallprompt', onBefore);

    // After successful install, the page also gets `appinstalled`
    const onInstalled = () => {
      setEnv(prev => prev ? { ...prev, standalone: true, canPrompt: false } : prev);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Stash the deferred event on env via attaching the handler
  // We expose it through a separate function below.
  return env ? { ...env, canPrompt: !!deferredPrompt && env.canPrompt } : env;
}

// Separate hook for the prompt handler — keeps useInstallEnv pure-ish
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferred) return 'unavailable';
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferred(null);
    return outcome;
  }

  return { canPrompt: !!deferred, installed, promptInstall };
}
