'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, BellOff, Check, AlertTriangle, Sparkles,
  Heart, MessageSquare, Trophy, Clock, Send,
} from 'lucide-react';
import { AgentHero } from '@/components/ui/AgentHero';
import { useToast, ToastStack } from '@/components/ui/Toast';
import { InstallSection } from '@/components/InstallSection';
import { getPushState, subscribeToPush, unsubscribeFromPush, sendTestPush, handleExpiredSession, type PushState } from '@/lib/push-client';

const ACCENT = '#10B981';
const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

const CATEGORIES = [
  { key: 'rewards' as const, icon: Trophy, color: '#F59E0B',
    label: 'Streak rewards', desc: 'When you earn H2E from streaks or milestones.',
    example: '🔥 7-day streak! +50 H2E earned. Keep it going — your 10-day milestone unlocks a bonus.' },
  { key: 'reminders' as const, icon: Clock, color: '#3B82F6',
    label: 'Daily reminders', desc: 'Gentle nudges to log water, meals, or your mood.',
    example: '💧 You haven’t logged water today. A quick glass keeps your streak alive!' },
  { key: 'agentFollowups' as const, icon: Heart, color: '#10B981',
    label: 'AI agent follow-ups', desc: 'Your nurse / nutritionist / mindcare may check in proactively.',
    example: '🩺 Your AI Nurse: How did you sleep last night? Let’s check in on your energy today.' },
  { key: 'community' as const, icon: MessageSquare, color: '#A855F7',
    label: 'Community activity', desc: 'Likes and comments on your posts.',
    example: '💬 Alex commented on your post: “This really helped me, thank you!”' },
];

interface Prefs { rewards: boolean; reminders: boolean; agentFollowups: boolean; community: boolean }
interface Sub { id: string; userAgent: string | null; createdAt: string; lastUsed: string }

function deviceLabel(ua: string | null) {
  if (!ua) return 'Unknown device';
  if (/iPhone|iPad/.test(ua)) return 'iOS device';
  if (/Android/.test(ua)) return 'Android device';
  if (/Mac/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Browser';
}

export default function NotificationsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [installed, setInstalled] = useState(false);
  const { messages, push } = useToast();

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (typeof window !== 'undefined') {
      setInstalled(window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true);
    }
    refresh(t);
  }, []);

  const headers = useCallback((t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }), []);

  async function refresh(t: string | null) {
    setPushState(await getPushState());
    if (t) {
      const [p, s] = await Promise.all([
        fetch('/api/push/prefs', { headers: headers(t) }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/push/subscribe', { headers: headers(t) }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (p?.prefs) setPrefs({
        rewards: p.prefs.rewards,
        reminders: p.prefs.reminders,
        agentFollowups: p.prefs.agentFollowups,
        community: p.prefs.community,
      });
      if (s?.subscriptions) setSubs(s.subscriptions);
    }
  }

  async function enableNotifications() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const r = await subscribeToPush(token);
      if (r.ok) {
        push({ title: 'Notifications enabled', subtitle: 'You will hear from us only when it matters.', accent: ACCENT });
        await refresh(token);
      } else if (r.expired) {
        push({ title: 'Session expired', subtitle: 'Redirecting to login…', accent: '#ef4444' });
        setTimeout(handleExpiredSession, 800);
      } else {
        push({ title: 'Could not enable notifications', subtitle: r.error, accent: '#ef4444' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!token || busy) return;
    if (!confirm('Disable push notifications on this device?')) return;
    setBusy(true);
    try {
      await unsubscribeFromPush(token);
      push({ title: 'Notifications disabled on this device', accent: ACCENT });
      await refresh(token);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!token || testing) return;
    setTesting(true);
    try {
      const r = await sendTestPush(token);
      if (r.ok) {
        push({ title: 'Test sent', subtitle: 'Check your device — should appear within a few seconds.', accent: ACCENT });
      } else if (r.expired) {
        push({ title: 'Session expired', subtitle: 'Redirecting to login…', accent: '#ef4444' });
        setTimeout(handleExpiredSession, 800);
      } else {
        push({ title: 'Test failed', subtitle: r.error || '', accent: '#ef4444' });
      }
    } finally {
      setTesting(false);
    }
  }

  async function togglePref(key: keyof Prefs, next: boolean) {
    if (!token || !prefs) return;
    setPrefs({ ...prefs, [key]: next }); // optimistic
    const res = await fetch('/api/push/prefs', {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ [key]: next }),
    });
    if (res.status === 401) {
      push({ title: 'Session expired', subtitle: 'Redirecting to login…', accent: '#ef4444' });
      setTimeout(handleExpiredSession, 800);
      return;
    }
    if (!res.ok) {
      setPrefs({ ...prefs }); // revert
      push({ title: 'Update failed', accent: '#ef4444' });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      <ToastStack messages={messages} />

      {!token && (
        <div className="mb-6 rounded-2xl glass px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Connect your wallet to manage notifications.</p>
          <a href="/login" className="text-xs font-semibold text-accent hover:text-accent-hover">Connect →</a>
        </div>
      )}

      <AgentHero
        eyebrow="Settings · App & Notifications"
        title="Set up & stay in the loop"
        titleAccent="🔔"
        description="Install Health Saviors as an app and turn on push notifications — both done from one place. Get pinged about your streaks, reminders, and AI follow-ups even when the app is closed."
        accentColor={ACCENT}
        icon={<Bell size={20} className="text-accent" />}
        stats={[
          { label: 'PWA', value: installed ? 'Installed' : '—' },
          { label: 'Push', value: pushState === 'subscribed' ? 'On' : 'Off' },
        ]}
      />

      <div className="grid gap-5">
        {/* Step 1 — Install (always shown; renders 'installed' confirmation when standalone) */}
        <section>
          <SectionLabel n={1} title="Install the app" desc="Required on iPhone for push, recommended everywhere else." />
          <InstallSection push={push} />
        </section>

        <SectionLabel n={2} title="Notifications" desc="Pick which events ping your device." className="-mb-3 mt-2" />
        {/* Status card */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
          {pushState === 'unsupported' ? (
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-text-primary">Not supported in this browser</p>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                  Try Chrome, Edge, Firefox, or Safari (iOS 16.4+). On iPhone you must <strong>install the app to your home screen first</strong> — see the install prompt.
                </p>
              </div>
            </div>
          ) : pushState === 'denied' ? (
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <BellOff size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-text-primary">Notifications are blocked</p>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                  Open your browser's site settings (lock icon in the address bar) and allow notifications for this site.
                </p>
              </div>
            </div>
          ) : pushState === 'subscribed' ? (
            <div>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Bell size={20} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text-primary">Notifications are on</p>
                    <p className="text-sm text-text-secondary mt-0.5">{subs.length} device{subs.length === 1 ? '' : 's'} subscribed.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={sendTest} disabled={testing}
                    className="px-4 py-2 rounded-full text-sm font-medium border border-border hover:border-accent hover:text-accent transition flex items-center gap-2 disabled:opacity-40">
                    {testing
                      ? <><span className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Sending</>
                      : <><Send size={13} /> Send test</>}
                  </button>
                  <button onClick={disableNotifications} disabled={busy}
                    className="px-4 py-2 rounded-full text-sm font-medium text-text-secondary border border-border hover:border-red-500/50 hover:text-red-500 transition disabled:opacity-40">
                    Turn off
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // default or granted-no-sub
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-bg border border-border flex items-center justify-center">
                  <BellOff size={20} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-base font-semibold text-text-primary">Notifications are off</p>
                  <p className="text-sm text-text-secondary mt-0.5">Get pings for streak rewards, daily reminders, and AI follow-ups.</p>
                </div>
              </div>
              <button onClick={enableNotifications} disabled={busy || !token}
                className="px-5 py-3 rounded-full bg-accent text-white text-sm font-semibold shadow shadow-accent/30 hover:bg-accent-hover transition disabled:opacity-40 flex items-center gap-2">
                {busy
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enabling</>
                  : <><Bell size={14} /> Enable notifications</>}
              </button>
            </div>
          )}
        </motion.div>

        {/* Category preferences */}
        {pushState === 'subscribed' && prefs && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-accent" />
              <p className="text-base font-semibold text-text-primary">What to notify me about</p>
            </div>
            <p className="text-sm text-text-secondary mb-4">Pick the categories you want to hear about. Disabling a category stops new pushes immediately.</p>
            <div className="space-y-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const on = prefs[cat.key];
                return (
                  <div key={cat.key}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border-subtle hover:border-border transition">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>
                        <Icon size={18} style={{ color: cat.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{cat.label}</p>
                        <p className="text-xs text-text-muted">{cat.desc}</p>
                        <p className="mt-1.5 text-[11px] text-text-secondary bg-black/[0.03] rounded-lg px-2.5 py-1.5 leading-snug">
                          <span className="text-text-muted">e.g. </span>{cat.example}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => togglePref(cat.key, !on)}
                      className={`relative w-11 h-6 rounded-full transition shrink-0 ${on ? 'bg-accent' : 'bg-border'}`}
                      aria-label={on ? 'Disable' : 'Enable'}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Subscribed devices */}
        {pushState === 'subscribed' && subs.length > 0 && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-6">
            <p className="text-base font-semibold text-text-primary mb-3">Subscribed devices</p>
            <ul className="space-y-2">
              {subs.map(s => (
                <li key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-bg border border-border-subtle">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">{deviceLabel(s.userAgent)}</p>
                    <p className="text-[11px] text-text-muted">Subscribed {new Date(s.createdAt).toLocaleDateString()} · last used {new Date(s.lastUsed).toLocaleDateString()}</p>
                  </div>
                  <Check size={14} className="text-accent shrink-0" />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ n, title, desc, className = '' }: { n: number; title: string; desc?: string; className?: string }) {
  return (
    <div className={`flex items-start gap-3 mb-3 ${className}`}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-accent/10 text-accent border border-accent/20">{n}</div>
      <div>
        <p className="text-base font-semibold text-text-primary">{title}</p>
        {desc && <p className="text-xs text-text-muted mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}
