'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, ArrowUpRight, Activity, Droplets, Apple, Dumbbell, Smile,
  Flame, Coins, ChevronRight, ShieldCheck, Brain, LayoutDashboard,
} from 'lucide-react';
import Link from 'next/link';

const hubs = [
  { name: 'Wellness', href: '/wellness', color: '#10B981', tag: '01', desc: 'Daily check-ins, water, exercise', Icon: Heart },
  { name: 'Symptoms', href: '/symptoms', color: '#3B82F6', tag: '02', desc: 'Triage with AI Gatekeeper', Icon: ShieldCheck },
  { name: 'Nutrition', href: '/nutrition', color: '#F59E0B', tag: '03', desc: 'Meals, calories, AI estimate', Icon: Apple },
  { name: 'Mind', href: '/mindspace', color: '#A855F7', tag: '04', desc: 'Mood, meditation, breathing', Icon: Brain },
  { name: 'Dashboard', href: '/dashboard', color: '#EF4444', tag: '05', desc: 'Trends + H2E balance', Icon: LayoutDashboard },
];

const fadeUp = (d = 0) => ({
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: d, ease: [0.16, 1, 0.3, 1] } },
});

interface UserStored {
  displayName?: string;
  profileComplete?: boolean;
  tokenBalance?: number;
}

interface TodaySummary {
  waterMl: number;
  mealCount: number;
  exerciseMin: number;
  moodLogged: boolean;
  streak: number;
}

export default function HomePage() {
  const [user, setUser] = useState<UserStored | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState<TodaySummary | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const t = localStorage.getItem('token');
      const stored = localStorage.getItem('user');
      if (t && stored) {
        setToken(t);
        setUser(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const headers = useCallback((t: string) => ({ Authorization: `Bearer ${t}` }), []);

  // Pull today's stats once we know the user is logged in. Fail-safe — silently skip on 401/network.
  useEffect(() => {
    if (!token || !user?.profileComplete) return;
    const date = new Date().toISOString().split('T')[0];
    (async () => {
      try {
        const [w, e, m, d] = await Promise.all([
          fetch(`/api/logs/water?date=${date}`, { headers: headers(token) }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/logs/exercise?date=${date}`, { headers: headers(token) }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/logs/mood?date=${date}`, { headers: headers(token) }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/logs/meal?date=${date}`, { headers: headers(token) }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        setToday({
          waterMl: w?.totalMl || 0,
          mealCount: d?.logs?.length || 0,
          exerciseMin: e?.logs?.reduce((s: number, x: any) => s + (x.durationMin || 0), 0) || 0,
          moodLogged: (m?.logs?.length || 0) > 0,
          streak: w?.streak || e?.streak || m?.streak || d?.streak || 0,
        });
      } catch {}
    })();
  }, [token, user?.profileComplete, headers]);

  const isLoggedIn = mounted && !!user;
  const needsProfile = isLoggedIn && !user?.profileComplete;

  // ── Logged-in: useful "Today" dashboard ──
  if (isLoggedIn) {
    return <LoggedInHome user={user!} today={today} needsProfile={needsProfile} />;
  }

  // ── Logged-out: marketing landing (also default during SSR / before mount) ──
  return <MarketingLanding />;
}

// ────────────────────────────────────────────────────────────
// Logged-in home — quick "Today" view + hub grid + agent status
// ────────────────────────────────────────────────────────────

function LoggedInHome({ user, today, needsProfile }: { user: UserStored; today: TodaySummary | null; needsProfile: boolean }) {
  const greeting = useGreeting();
  const name = user.displayName || 'friend';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-2">
      {needsProfile && (
        <motion.div initial="hidden" animate="visible" variants={fadeUp(0)}
          className="card p-4 mb-5 flex items-center justify-between gap-3 border-amber-500/30 bg-amber-500/5">
          <div>
            <p className="text-sm font-semibold text-text-primary">Finish setting up your profile</p>
            <p className="text-xs text-text-muted mt-0.5">Add your name, age, height & weight so your AI agents can personalize.</p>
          </div>
          <Link href="/signup" className="px-4 py-2 rounded-full bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition shrink-0">
            Continue →
          </Link>
        </motion.div>
      )}

      {/* Greeting */}
      <motion.header initial="hidden" animate="visible" variants={fadeUp(0)} className="mb-6">
        <p className="text-sm text-text-secondary">{greeting},</p>
        <h1 className="font-display text-3xl sm:text-4xl text-text-primary mt-0.5">
          {name}.
          {today && today.streak > 0 && (
            <span className="ml-3 align-middle inline-flex items-center gap-1.5 text-base text-orange-500 font-medium">
              <Flame size={16} /> {today.streak}-day streak
            </span>
          )}
        </h1>
      </motion.header>

      {/* Today panel */}
      <motion.section initial="hidden" animate="visible" variants={fadeUp(0.05)} className="card p-5 sm:p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">Today</p>
          {typeof user.tokenBalance === 'number' && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Coins size={12} className="text-accent" />
              <span className="font-mono tabular-nums">{user.tokenBalance.toLocaleString()}</span>
              <span className="text-text-muted">H2E</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TodayStat
            href="/wellness"
            color="#3B82F6"
            Icon={Droplets}
            label="Water"
            value={today ? `${(today.waterMl / 1000).toFixed(1)}L` : '—'}
            sub={today ? `of 2.0L` : 'tap to log'}
            progress={today ? Math.min(today.waterMl / 2000, 1) : 0}
          />
          <TodayStat
            href="/nutrition"
            color="#F59E0B"
            Icon={Apple}
            label="Meals"
            value={today ? `${today.mealCount}` : '—'}
            sub={today ? `of 3` : 'tap to log'}
            progress={today ? Math.min(today.mealCount / 3, 1) : 0}
          />
          <TodayStat
            href="/wellness"
            color="#10B981"
            Icon={Dumbbell}
            label="Exercise"
            value={today ? `${today.exerciseMin}m` : '—'}
            sub={today ? `today` : 'tap to log'}
            progress={today ? Math.min(today.exerciseMin / 30, 1) : 0}
          />
          <TodayStat
            href="/mindspace"
            color="#A855F7"
            Icon={Smile}
            label="Mood"
            value={today ? (today.moodLogged ? '✓' : '—') : '—'}
            sub={today ? (today.moodLogged ? 'logged' : 'not yet') : 'tap to log'}
            progress={today?.moodLogged ? 1 : 0}
          />
        </div>
      </motion.section>

      {/* Hub grid */}
      <motion.section initial="hidden" animate="visible" variants={fadeUp(0.1)} className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted px-1">Continue</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hubs.map(h => {
            const Icon = h.Icon;
            return (
              <Link key={h.name} href={h.href}
                className="card p-5 group hover:border-accent transition-all flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${h.color}15`, border: `1px solid ${h.color}30` }}>
                  <Icon size={20} style={{ color: h.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-text-primary">{h.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{h.desc}</p>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition shrink-0" />
              </Link>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}

function TodayStat({ href, color, Icon, label, value, sub, progress }: {
  href: string;
  color: string;
  Icon: typeof Droplets;
  label: string;
  value: string;
  sub: string;
  progress: number;
}) {
  return (
    <Link href={href}
      className="block p-3 rounded-2xl border border-border-subtle hover:border-border transition group">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
      </div>
      <p className="font-display text-2xl text-text-primary tabular-nums">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>
      <div className="mt-2 h-1 rounded-full bg-black/[0.04] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%`, background: color }} />
      </div>
    </Link>
  );
}

function useGreeting() {
  const [g, setG] = useState('Good day');
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setG('Up late');
    else if (h < 12) setG('Good morning');
    else if (h < 18) setG('Good afternoon');
    else setG('Good evening');
  }, []);
  return g;
}

// ────────────────────────────────────────────────────────────
// Logged-out home — original marketing landing
// ────────────────────────────────────────────────────────────

function MarketingLanding() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[20%] -left-40 w-[560px] h-[560px] rounded-full bg-accent/[0.05] blur-[140px] pointer-events-none float-slow" />
      <div className="absolute bottom-[10%] -right-40 w-[480px] h-[480px] rounded-full bg-agent-mindcare/[0.04] blur-[140px] pointer-events-none" />

      <div className="absolute top-[22%] right-0 w-[60%] pointer-events-none opacity-[0.08]">
        <svg viewBox="0 0 1400 80" className="w-full h-16 ecg-line" preserveAspectRatio="none">
          <polyline fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            points="0,40 180,40 260,40 280,12 300,68 315,4 325,76 335,22 355,40 520,40 600,40 620,12 640,68 655,4 665,76 675,22 695,40 860,40 940,40 960,12 980,68 995,4 1005,76 1015,22 1035,40 1200,40 1280,40 1300,12 1320,68 1335,4 1345,76 1355,22 1375,40 1400,40" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-center w-full py-10 sm:py-14 lg:py-20">
          <div>
            <motion.div initial="hidden" animate="visible" variants={fadeUp(0)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass mb-8">
              <Activity size={11} className="text-accent" />
              <span className="text-[10px] font-mono tracking-[0.22em] uppercase text-text-secondary">
                Health2Earn · BSC · Live
              </span>
            </motion.div>

            <motion.h1 initial="hidden" animate="visible" variants={fadeUp(0.1)}
              className="font-display text-[3.25rem] sm:text-[5rem] lg:text-[7rem] text-text-primary leading-[0.95]">
              Health
              <br />
              <span className="text-gradient-health">Saviors.</span>
            </motion.h1>

            <motion.p initial="hidden" animate="visible" variants={fadeUp(0.25)}
              className="text-base sm:text-lg text-text-secondary mt-6 max-w-[48ch] leading-relaxed">
              AI agents that read your data, reward your habits, and keep you moving.
              Logs on-chain. Streaks pay out. Your health, on your terms.
            </motion.p>

            <motion.div initial="hidden" animate="visible" variants={fadeUp(0.4)}
              className="mt-8 flex items-center gap-3 flex-wrap">
              <Link href="/login" className="btn-primary group">
                Connect Wallet
                <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link href="/about" className="btn-ghost">
                Learn More
              </Link>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={fadeUp(0.55)}
              className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
              {[
                { v: '4', l: 'AI Agents' },
                { v: '100%', l: 'On-chain Rewards' },
                { v: '47K+', l: 'Streak Goal MAU' },
              ].map(x => (
                <div key={x.l}>
                  <p className="font-display text-2xl sm:text-3xl text-text-primary">{x.v}</p>
                  <p className="text-xs text-text-muted mt-1 tracking-wide">{x.l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="relative">
            <motion.div initial="hidden" animate="visible" variants={fadeUp(0.35)}
              className="relative aspect-square w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-[65%] h-[65%] rounded-full border border-accent/10 animate-ping" style={{ animationDuration: '3.2s' }} />
                <div className="absolute w-[45%] h-[45%] rounded-full border border-accent/15 animate-ping" style={{ animationDuration: '2.6s', animationDelay: '0.3s' }} />
                <div className="absolute w-[28%] h-[28%] rounded-full bg-accent/5" />
                <Heart size={56} className="text-accent fill-accent/20 heartbeat-icon relative z-10" />
              </div>

              {hubs.slice(0, 4).map((hub, i) => {
                const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
                const r = 44;
                const left = 50 + Math.cos(angle) * r;
                const top = 50 + Math.sin(angle) * r;
                return (
                  <Link key={hub.name} href={hub.href}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${left}%`, top: `${top}%` }}>
                    <div className="glass rounded-full px-3.5 py-1.5 flex items-center gap-2 transition-transform group-hover:scale-105">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hub.color }} />
                      <span className="text-xs text-text-primary">{hub.name}</span>
                    </div>
                  </Link>
                );
              })}
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={fadeUp(0.6)}
              className="glass rounded-2xl p-5 absolute lg:-bottom-4 lg:-left-8 bottom-0 left-0 right-0 mx-auto max-w-xs hidden sm:block">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted">Today's Mission</span>
                <Link href="/login" className="text-[10px] text-accent hover:text-text-primary transition-colors">
                  Start →
                </Link>
              </div>
              <p className="text-sm text-text-primary">Log one habit to start your streak.</p>
              <div className="mt-3 flex items-center gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="flex-1 h-1 rounded-full bg-black/[0.05]" />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div initial="hidden" animate="visible" variants={fadeUp(0.7)}
        className="relative border-t border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <span className="text-[10px] font-mono tracking-[0.24em] uppercase text-text-muted">Jump in</span>
            <div className="flex items-center gap-1 flex-wrap">
              {hubs.map(hub => (
                <Link key={hub.name} href={hub.href}
                  className="group px-4 py-2 rounded-full hover:bg-black/[0.03] transition-all">
                  <span className="flex items-center gap-2.5">
                    <span className="text-[9px] font-mono text-text-muted">{hub.tag}</span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hub.color }} />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {hub.name}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
