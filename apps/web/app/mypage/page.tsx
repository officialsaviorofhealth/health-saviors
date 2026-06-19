'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User as UserIcon, Coins, Flame, Edit3, Save, X, Settings,
  Heart, ShieldCheck, LogOut, Bell, Smartphone, FileText,
} from 'lucide-react';
import { useToast, ToastStack } from '@/components/ui/Toast';

const ACCENT = '#10B981';
const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

interface UserState {
  id?: string;
  displayName?: string;
  walletAddress?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  tokenBalance?: number;
  chronicConditions?: string[];
  profileComplete?: boolean;
}

export default function MyPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserState | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', age: '', heightCm: '', weightKg: '' });
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0);
  const { messages, push } = useToast();

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (!t) { router.push('/login?next=/mypage'); return; }
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    // Refresh from server
    refresh(t);
  }, []);

  const refresh = useCallback(async (t: string) => {
    try {
      const [meRes, waterRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/logs/water', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }
      if (waterRes.ok) {
        const w = await waterRes.json();
        setStreak(w?.streak || 0);
      }
    } catch {}
  }, []);

  function startEdit() {
    setDraft({
      displayName: user?.displayName || '',
      age: String(user?.age || ''),
      heightCm: String(user?.heightCm || ''),
      weightKg: String(user?.weightKg || ''),
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: draft.displayName.trim(),
          age: Number(draft.age),
          heightCm: Number(draft.heightCm),
          weightKg: Number(draft.weightKg),
          chronicConditions: user?.chronicConditions || [],
          dataConsent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        push({ title: 'Update failed', subtitle: data.error || `${res.status}`, accent: '#ef4444' });
        return;
      }
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      setEditing(false);
      push({ title: 'Profile updated', accent: ACCENT });
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    if (!confirm('Disconnect your wallet and sign out?')) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/';
  }

  if (!token || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-text-muted text-sm">
        <span className="inline-block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const wallet = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`
    : '—';
  const initial = (user.displayName || '?').slice(0, 1).toUpperCase();
  const bmi = (user.heightCm && user.weightKg)
    ? (user.weightKg / Math.pow(user.heightCm / 100, 2)).toFixed(1)
    : '—';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      <ToastStack messages={messages} />

      {/* Header */}
      <motion.header variants={fadeIn} initial="hidden" animate="visible" className="card p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-2xl font-semibold shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-2xl text-text-primary">{user.displayName || 'Set your name'}</p>
            <p className="text-xs text-text-muted font-mono mt-1 truncate">{wallet}</p>
            <div className="flex items-center gap-3 mt-3 text-sm">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <Coins size={13} className="text-accent" />
                <span className="font-mono tabular-nums">{(user.tokenBalance ?? 0).toLocaleString()}</span> H2E
              </span>
              {streak > 0 && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Flame size={13} className="text-orange-500" />
                  <span className="font-mono tabular-nums">{streak}</span>d streak
                </span>
              )}
            </div>
          </div>
          {!editing && (
            <button onClick={startEdit}
              className="px-3 py-2 rounded-full text-xs font-medium border border-border hover:border-accent hover:text-accent transition flex items-center gap-1.5">
              <Edit3 size={12} /> Edit
            </button>
          )}
        </div>
      </motion.header>

      {/* Profile fields */}
      <motion.section variants={fadeIn} initial="hidden" animate="visible" className="card p-6 mb-5">
        <p className="text-base font-semibold text-text-primary mb-4">Health profile</p>
        {editing ? (
          <div className="space-y-3">
            <Field label="Display name">
              <input value={draft.displayName} onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-base text-text-primary focus:outline-none" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Age">
                <input type="number" value={draft.age} onChange={e => setDraft(d => ({ ...d, age: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-base text-text-primary focus:outline-none" />
              </Field>
              <Field label="Height (cm)">
                <input type="number" value={draft.heightCm} onChange={e => setDraft(d => ({ ...d, heightCm: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-base text-text-primary focus:outline-none" />
              </Field>
              <Field label="Weight (kg)">
                <input type="number" value={draft.weightKg} onChange={e => setDraft(d => ({ ...d, weightKg: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-base text-text-primary focus:outline-none" />
              </Field>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} disabled={busy}
                className="px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {busy ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
                Save
              </button>
              <button onClick={() => setEditing(false)} disabled={busy}
                className="px-5 py-2.5 rounded-full border border-border text-text-secondary text-sm hover:text-text-primary transition flex items-center gap-2">
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <Stat label="Age" value={user.age ?? '—'} />
            <Stat label="Height" value={user.heightCm ? `${user.heightCm} cm` : '—'} />
            <Stat label="Weight" value={user.weightKg ? `${user.weightKg} kg` : '—'} />
            <Stat label="BMI" value={bmi} />
          </dl>
        )}

        {!editing && user.chronicConditions && user.chronicConditions.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border-subtle">
            <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Conditions</p>
            <div className="flex flex-wrap gap-1.5">
              {user.chronicConditions.map(c => (
                <span key={c} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  {c.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* Settings */}
      <motion.section variants={fadeIn} initial="hidden" animate="visible" className="card p-3 mb-5">
        <Row href="/notifications" Icon={Bell} title="Notifications" desc="Push categories &amp; subscribed devices" />
        <Row href="/notifications" Icon={Smartphone} title="Install as app" desc="PWA installation guide" />
        <Row href="/dashboard" Icon={Settings} title="Dashboard" desc="Streaks, charts, agent activity" />
      </motion.section>

      {/* Legal */}
      <motion.section variants={fadeIn} initial="hidden" animate="visible" className="card p-3 mb-5">
        <Row href="/privacy" Icon={FileText} title="Privacy Policy" />
        <Row href="/terms" Icon={FileText} title="Terms of Service" />
      </motion.section>

      {/* Logout */}
      <button onClick={logout}
        className="w-full px-5 py-3 rounded-2xl border border-border text-red-500 text-sm font-medium hover:border-red-500/50 hover:bg-red-500/5 transition flex items-center justify-center gap-2">
        <LogOut size={14} /> Disconnect wallet
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="text-base font-mono tabular-nums text-text-primary mt-0.5">{String(value)}</dd>
    </div>
  );
}

function Row({ href, Icon, title, desc }: { href: string; Icon: typeof Bell; title: string; desc?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-black/[0.03] transition">
      <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {desc && <p className="text-xs text-text-muted mt-0.5">{desc}</p>}
      </div>
      <span className="text-text-muted">›</span>
    </Link>
  );
}
