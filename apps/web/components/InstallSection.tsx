'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Share2, Copy, Check, AlertTriangle, Apple, ChevronRight, Sparkles, Globe,
} from 'lucide-react';
import type { ToastMessage } from '@/components/ui/Toast';
import { useInstallEnv, useInstallPrompt } from '@/lib/install-detect';

type PushToast = (msg: Omit<ToastMessage, 'id'>) => void;

const ACCENT = '#10B981';
const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

interface Props {
  /** Optional toast pusher — when provided, success/error feedback is surfaced. */
  push?: PushToast;
  /** Hide the installed-state confirmation card (caller may already show it). */
  hideInstalledCard?: boolean;
}

// Self-contained install UI. Renders the platform-appropriate steps:
//   - Already installed → confirmation card (toggleable via prop)
//   - In-app browser → warning + URL copy
//   - iOS non-Safari → "open in Safari" hint + URL copy
//   - iOS Safari → 3-step share-sheet guide
//   - Android (canPrompt) → big install button
//   - Android (no prompt yet) → manual steps
//   - Desktop (canPrompt) → install button
//   - Desktop (no prompt) → address-bar guide
export function InstallSection({ push, hideInstalledCard = false }: Props) {
  const env = useInstallEnv();
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.origin : '';

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      push?.({ title: 'Copy failed', subtitle: 'Please copy the URL directly from the address bar.', accent: '#ef4444' });
    }
  }

  async function tryInstall() {
    if (!canPrompt) {
      push?.({ title: 'Auto-install not available', subtitle: 'Follow the steps below to install manually.', accent: '#ef4444' });
      return;
    }
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') push?.({ title: 'Installed!', subtitle: 'Launch the app from your home screen.', accent: ACCENT });
      else if (outcome === 'dismissed') push?.({ title: 'Install cancelled', subtitle: 'You can try again anytime.', accent: ACCENT });
    } finally {
      setBusy(false);
    }
  }

  if (!env) {
    return (
      <div className="card p-6 flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Loading…
      </div>
    );
  }

  const alreadyInstalled = env.standalone || installed;

  if (alreadyInstalled) {
    if (hideInstalledCard) return null;
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Check size={20} className="text-accent" />
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">App installed</p>
            <p className="text-sm text-text-secondary mt-0.5">You're running Health Saviors as a standalone app.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // In-app browser (KakaoTalk / Instagram / Naver / Facebook / Line / WebView)
  if (env.inInAppBrowser) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-text-primary">Can't install inside {browserLabel(env.browser)}</p>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              {env.platform === 'ios'
                ? 'Tap the ⋯ or Share button at the top right and choose "Open in ' + safariName(env) + '".'
                : 'Tap the ⋯ menu at the top right → "Open in another browser" → choose Chrome.'}
            </p>
          </div>
        </div>
        <UrlCopyBox url={url} copied={copied} onCopy={copyUrl} />
        <p className="text-xs text-text-muted mt-3 leading-relaxed">
          Copy the URL, then open {env.platform === 'ios' ? 'Safari' : 'Chrome'} directly and paste it into the address bar.
        </p>
      </motion.div>
    );
  }

  // iOS non-Safari (Chrome / Firefox / etc.)
  if (env.isIosOther) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Apple size={20} className="text-amber-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">iOS can only install via Safari</p>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              You're currently in {browserLabel(env.browser)}. Copy the URL below, then open Safari and paste it.
            </p>
          </div>
        </div>
        <UrlCopyBox url={url} copied={copied} onCopy={copyUrl} />
        <a href={url}
          className="mt-3 flex items-center justify-between p-4 rounded-2xl bg-accent text-white hover:bg-accent-hover transition shadow shadow-accent/30">
          <span className="flex items-center gap-3">
            <Globe size={18} />
            <span className="font-semibold">Try opening in your default browser</span>
          </span>
          <ChevronRight size={18} />
        </a>
      </motion.div>
    );
  }

  // iOS Safari — manual share-sheet flow
  if (env.isIosSafari) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
        <p className="text-base font-semibold text-text-primary mb-1">Install in three quick steps</p>
        <p className="text-sm text-text-secondary mb-5">iOS doesn't support one-tap install — follow these in Safari to enable push notifications.</p>
        <ol className="space-y-3">
          <Step n={1} title="Tap the Share button">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Share2 size={14} className="text-accent" /> The
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-bg border border-border text-text-primary"><Share2 size={11} /></span>
              icon at the bottom center of the screen
            </div>
          </Step>
          <Step n={2} title='Choose "Add to Home Screen"'>
            <p className="text-sm text-text-secondary">Scroll down in the share sheet to find it.</p>
          </Step>
          <Step n={3} title='Tap "Add" in the top right'>
            <p className="text-sm text-text-secondary">You can keep the default name.</p>
          </Step>
        </ol>
        <div className="mt-5 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-2">
          <Sparkles size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Required for push notifications on iOS 16.4+.
          </p>
        </div>
      </motion.div>
    );
  }

  // Android — programmatic when available
  if (env.platform === 'android') {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
        {canPrompt ? (
          <>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Download size={20} className="text-accent" />
              </div>
              <div>
                <p className="text-base font-semibold text-text-primary">Install with one tap</p>
                <p className="text-sm text-text-secondary mt-0.5">Required for the most reliable push notifications.</p>
              </div>
            </div>
            <button onClick={tryInstall} disabled={busy}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-accent text-white text-base font-semibold shadow-lg shadow-accent/30 hover:bg-accent-hover transition disabled:opacity-40">
              {busy
                ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Installing...</>
                : <><Download size={18} /> Install Health Saviors</>}
            </button>
            <p className="text-xs text-text-muted text-center mt-3">Tap to bring up the system install dialog.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-text-primary">Auto-install not ready</p>
                <p className="text-sm text-text-secondary mt-0.5">Install manually with these steps.</p>
              </div>
            </div>
            <ol className="space-y-3">
              <Step n={1} title="Open the browser menu (⋮)" />
              <Step n={2} title='Select "Install app" or "Add to home screen"' />
              <Step n={3} title='Tap "Install" or "Add"' />
            </ol>
          </>
        )}
      </motion.div>
    );
  }

  // Desktop
  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
      {canPrompt ? (
        <>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Download size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">Install as a desktop app</p>
              <p className="text-sm text-text-secondary mt-0.5">Standalone window with more reliable notifications.</p>
            </div>
          </div>
          <button onClick={tryInstall} disabled={busy}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-accent text-white text-base font-semibold shadow-lg shadow-accent/30 hover:bg-accent-hover transition disabled:opacity-40">
            {busy
              ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Installing...</>
              : <><Download size={18} /> Install desktop app</>}
          </button>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-text-primary mb-3">Install from the address bar</p>
          <ol className="space-y-3">
            <Step n={1} title="Click the ⊕ install icon on the right of the address bar" />
            <Step n={2} title='Or open the menu → "Install Health Saviors"' />
            <Step n={3} title='Click "Install"' />
          </ol>
          <p className="text-xs text-text-muted mt-4">
            Works in Chrome / Edge / Brave / Arc / Opera. Firefox does not officially support PWA installs.
          </p>
        </>
      )}
    </motion.div>
  );
}

// ── Helpers (private to this component) ──

function browserLabel(b: string) {
  const map: Record<string, string> = {
    safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox',
    samsung: 'Samsung Internet', kakaotalk: 'KakaoTalk', naver: 'Naver app',
    instagram: 'Instagram', facebook: 'Facebook', line: 'LINE',
    webview: 'WebView', other: 'this browser',
  };
  return map[b] || 'this browser';
}

function safariName(env: { platform: string }) {
  return env.platform === 'ios' ? 'Safari' : 'Chrome';
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-accent/10 text-accent border border-accent/20">{n}</div>
      <div className="flex-1 mt-0.5">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {children && <div className="mt-1.5">{children}</div>}
      </div>
    </li>
  );
}

function UrlCopyBox({ url, copied, onCopy }: { url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-2xl bg-bg border border-border">
      <Globe size={16} className="text-text-muted shrink-0" />
      <input value={url} readOnly
        className="flex-1 bg-transparent text-sm text-text-primary font-mono truncate focus:outline-none"
        onFocus={(e) => e.currentTarget.select()} />
      <button onClick={onCopy}
        className="px-3 py-1.5 rounded-full bg-accent text-white text-xs font-semibold shadow shadow-accent/25 hover:bg-accent-hover transition flex items-center gap-1.5 shrink-0">
        {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
      </button>
    </div>
  );
}
