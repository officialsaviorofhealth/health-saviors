'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Dumbbell, Smile, Plus, Check, ChevronLeft, ChevronRight, Calendar, Heart, Flame, ArrowRight, Undo2, Moon } from 'lucide-react';
import AgentChat from '@/components/AgentChat';
import { AgentHero } from '@/components/ui/AgentHero';
import { useToast, ToastStack } from '@/components/ui/Toast';

const fadeIn = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };
const MOODS = [
  { emoji: '😫', label: 'Awful', tip: 'I will check in on you' },
  { emoji: '😟', label: 'Low', tip: 'Mind Care is listening' },
  { emoji: '😐', label: 'Okay', tip: 'A small win can shift this' },
  { emoji: '🙂', label: 'Good', tip: 'Keep the momentum' },
  { emoji: '😄', label: 'Great', tip: 'Lock it in' },
];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NURSE = '#22c55e';
function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }

export default function WellnessHubPage() {
  const [token, setToken] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date());
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [waterMl, setWaterMl] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [exercises, setExercises] = useState<any[]>([]);
  const [mood, setMood] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [exType, setExType] = useState('walking');
  const [exMin, setExMin] = useState('');
  const [showExForm, setShowExForm] = useState(false);
  const [waterLoading, setWaterLoading] = useState(false);
  const [exLoading, setExLoading] = useState(false);
  const [moodLoading, setMoodLoading] = useState(false);
  const { messages, push } = useToast();

  const isToday = toDateStr(selectedDate) === toDateStr(new Date());
  const totalExMin = exercises.reduce((s, e) => s + e.durationMin, 0);

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) { loadDay(t, selectedDate); loadLoggedDates(t); }
  }, []);
  useEffect(() => { if (token) loadDay(token, selectedDate); }, [selectedDate]);
  useEffect(() => { if (token) loadLoggedDates(token); }, [calMonth]);

  const hdrs = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

  function onStreak(data: any) { if (data.streak) setStreak(data.streak); }

  async function loadDay(t: string, date: Date) {
    const d = toDateStr(date);
    const [w, e, m] = await Promise.all([
      fetch(`/api/logs/water?date=${d}`, { headers: hdrs(t) }).then(r => r.json()),
      fetch(`/api/logs/exercise?date=${d}`, { headers: hdrs(t) }).then(r => r.json()),
      fetch(`/api/logs/mood?date=${d}`, { headers: hdrs(t) }).then(r => r.json()),
    ]);
    setWaterMl(w.totalMl || 0); setWaterCount(w.logs?.length || 0);
    setExercises(e.logs || []); setMood(m.logs?.[0]?.score || null);
  }

  async function loadLoggedDates(t: string) {
    const start = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const data = await fetch(`/api/logs/summary?range=month&date=${start}`, { headers: hdrs(t) }).then(r => r.json());
    const dates = new Set<string>();
    [...(data.meals?.logs || []), ...(data.exercise?.logs || []), ...(data.mood?.logs || []), ...(data.meditation?.logs || [])]
      .forEach((l: any) => { if (l.createdAt) dates.add(toDateStr(new Date(l.createdAt))); });
    setLoggedDates(dates);
  }

  async function addWater() {
    if (!token || !isToday || waterLoading) return; setWaterLoading(true);
    const data = await fetch('/api/logs/water', { method: 'POST', headers: hdrs(token), body: JSON.stringify({ amountMl: 250 }) }).then(r => r.json());
    setWaterMl(data.totalMl); setWaterCount(c => c + 1); onStreak(data); setWaterLoading(false);
    const reachedGoal = data.totalMl >= 2000 && waterMl < 2000;
    push({
      title: '+250ml water logged',
      subtitle: reachedGoal ? '2L goal reached — bonus unlocked.' : `Today: ${data.totalMl}ml of 2,000ml goal.`,
      points: data.awarded || (reachedGoal ? 50 : 10),
      accent: '#3b82f6',
    });
  }

  async function undoWater() {
    if (!token || !isToday || waterLoading || waterCount === 0) return;
    setWaterLoading(true);
    try {
      const res = await fetch('/api/logs/water', { method: 'DELETE', headers: hdrs(token) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({ title: 'Undo failed', subtitle: data.error || `Server returned ${res.status}`, accent: '#ef4444' });
        return;
      }
      setWaterMl(data.totalMl ?? 0);
      setWaterCount(c => Math.max(0, c - 1));
      push({ title: `−${data.removedMl || 250}ml removed`, subtitle: `Today: ${data.totalMl}ml of 2,000ml.`, accent: '#3b82f6' });
    } finally {
      setWaterLoading(false);
    }
  }

  async function addExercise() {
    if (!token || !exMin || !isToday || exLoading) return; setExLoading(true);
    const min = parseInt(exMin);
    const data = await fetch('/api/logs/exercise', { method: 'POST', headers: hdrs(token), body: JSON.stringify({ exerciseType: exType, durationMin: min }) }).then(r => r.json());
    setExercises(e => [...e, data.log]); setExMin(''); setShowExForm(false); onStreak(data); setExLoading(false);
    push({
      title: `${exType.charAt(0).toUpperCase() + exType.slice(1)} · ${min} min`,
      subtitle: 'Saved to today\'s log. Your AI Nurse will factor this into the weekly summary.',
      points: data.awarded || 50,
      accent: NURSE,
    });
  }

  async function setMoodScore(score: number) {
    if (!token || !isToday || moodLoading) return; setMoodLoading(true);
    const data = await fetch('/api/logs/mood', { method: 'POST', headers: hdrs(token), body: JSON.stringify({ score }) }).then(r => r.json());
    setMood(score); onStreak(data); setMoodLoading(false);
    const m = MOODS[score - 1];
    push({
      title: `Mood: ${m.label} ${m.emoji}`,
      subtitle: `${m.tip}. Mind Care will tailor today's session.`,
      points: data.awarded || 10,
      accent: '#a855f7',
    });
  }

  const calDays = useMemo(() => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay(), total = new Date(y, m + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < first; i++) days.push(null);
    for (let i = 1; i <= total; i++) days.push(i);
    return days;
  }, [calMonth]);

  const waterPct = Math.min(waterMl / 2000 * 100, 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      <ToastStack messages={messages} />
      {!token && (
        <div className="mb-6 rounded-2xl glass px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Preview mode — connect your wallet to log activities and earn H2E.</p>
          <a href="/login" className="text-xs font-medium text-accent hover:text-text-primary transition-colors">Connect →</a>
        </div>
      )}

      <AgentHero
        eyebrow="Agent · 01"
        title="Wellness Hub"
        titleAccent="."
        description="Your AI Nurse turns daily logs — water, exercise, mood — into a personalized health rhythm. Every action becomes a streak. Every streak earns H2E."
        accentColor={NURSE}
        icon={<Heart size={20} className="text-agent-nurse fill-agent-nurse/20" />}
        stats={[
          { label: 'Streak', value: `${streak}d` },
          { label: 'Today', value: `${waterCount + exercises.length + (mood ? 1 : 0)}/3` },
        ]}
      />

      {/* Bento — 3 columns asymmetric */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1.2fr_1fr] gap-4 sm:gap-6">

        {/* Calendar */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-black/[0.05] rounded-lg"><ChevronLeft size={15} className="text-text-muted" /></button>
            <span className="text-sm font-medium text-text-primary">{calMonth.toLocaleDateString('en', { year: 'numeric', month: 'long' })}</span>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-black/[0.05] rounded-lg"><ChevronRight size={15} className="text-text-muted" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((d, i) => <div key={i} className="text-center text-[11px] text-text-muted py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const dObj = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
              const ds = toDateStr(dObj);
              const sel = toDateStr(selectedDate) === ds;
              const tod = toDateStr(new Date()) === ds;
              const logged = loggedDates.has(ds);
              const future = dObj > new Date();
              return (
                <button key={day} onClick={() => !future && setSelectedDate(dObj)} disabled={future}
                  className={`relative aspect-square rounded-lg text-sm flex items-center justify-center transition-all
                    ${sel ? 'bg-agent-nurse/20 text-agent-nurse font-medium' : tod ? 'bg-black/[0.06] text-text-primary font-medium' : future ? 'text-text-muted/30' : 'text-text-secondary hover:bg-black/[0.03]'}`}>
                  {day}
                  {logged && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-agent-nurse" />}
                </button>
              );
            })}
          </div>

          {streak > 0 && (
            <div className="mt-5 pt-4 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-orange-400" />
                <p className="font-display text-2xl text-text-primary">{streak} <span className="text-base text-text-secondary">day streak</span></p>
              </div>
              <p className="text-xs text-text-muted">{streak % 3 === 0 ? `Next bonus at day ${streak + 3}` : `${3 - (streak % 3)}d to next H2E reward`}</p>
            </div>
          )}
          {!isToday && <button onClick={() => { setSelectedDate(new Date()); setCalMonth(new Date()); }} className="mt-3 w-full text-sm text-accent hover:text-text-primary transition-colors flex items-center justify-center gap-1">Back to today <ArrowRight size={12} /></button>}
        </motion.div>

        {/* Logs */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          {!isToday && <div className="text-sm text-text-muted glass-subtle rounded-xl px-4 py-2.5 flex items-center gap-2"><Calendar size={13} /> Viewing {selectedDate.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>}

          {/* Water */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Droplets size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-base font-medium text-text-primary">Hydration</p>
                  <p className="text-xs text-text-muted">Goal: 2L · Each cup = +10 H2E</p>
                </div>
              </div>
              {isToday && (
                <div className="flex items-center gap-2">
                  {waterCount > 0 && (
                    <button onClick={undoWater} disabled={waterLoading}
                      className="px-3 py-3 rounded-full bg-black/[0.04] border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-50 transition text-sm flex items-center gap-1.5"
                      title="Undo last cup">
                      <Undo2 size={14} />
                    </button>
                  )}
                  <button onClick={addWater} disabled={waterLoading}
                    className="px-5 py-3 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20 disabled:opacity-50 transition-all text-sm font-medium flex items-center gap-2 active:scale-[0.98]">
                    {waterLoading ? <span className="inline-block w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /> : <><Plus size={14} /> 250ml cup</>}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="font-display text-4xl text-text-primary">{(waterMl / 1000).toFixed(1)}<span className="text-xl text-text-secondary">L</span></p>
              <span className="text-sm text-text-muted">/ 2.0L · {waterCount} cups</span>
            </div>
            <div className="w-full h-2 bg-black/[0.03] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${waterPct}%` }} />
            </div>
            {waterMl >= 2000 && <p className="text-sm text-agent-nurse mt-3 flex items-center gap-1.5"><Check size={14} /> Daily goal reached — bonus +50 H2E earned today.</p>}
          </div>

          {/* Exercise */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-agent-nurse/10 border border-agent-nurse/20 flex items-center justify-center">
                  <Dumbbell size={18} className="text-agent-nurse" />
                </div>
                <div>
                  <p className="text-base font-medium text-text-primary">Exercise</p>
                  <p className="text-xs text-text-muted">Each session = +50 H2E</p>
                </div>
              </div>
              {isToday && (
                <button onClick={() => setShowExForm(!showExForm)}
                  className="px-5 py-3 rounded-full bg-agent-nurse/10 border border-agent-nurse/30 text-agent-nurse hover:bg-agent-nurse/20 transition-all text-sm font-medium flex items-center gap-2 active:scale-[0.98]">
                  <Plus size={14} /> Log session
                </button>
              )}
            </div>
            <p className="font-display text-4xl text-text-primary mb-3">{totalExMin}<span className="text-xl text-text-secondary"> min</span></p>
            {exercises.length === 0 && !showExForm && (
              <p className="text-sm text-text-muted">No sessions yet. Even 10 minutes counts.</p>
            )}
            {exercises.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2.5 border-t border-border-subtle text-sm">
                <span className="text-text-primary capitalize">{e.exerciseType}</span>
                <span className="text-text-secondary text-mono">{e.durationMin} min</span>
              </div>
            ))}
            {showExForm && isToday && (
              <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {['walking', 'running', 'cycling', 'gym', 'yoga'].map(t => (
                    <button key={t} onClick={() => setExType(t)}
                      className={`px-4 py-2 rounded-full text-sm capitalize transition-colors ${exType === t ? 'bg-agent-nurse/20 text-agent-nurse border border-agent-nurse/30' : 'glass-subtle text-text-secondary'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={exMin} onChange={e => setExMin(e.target.value)} type="number" placeholder="Minutes"
                    className="flex-1 bg-bg-card border border-border rounded-xl px-4 py-3 text-base text-text-primary placeholder-text-muted focus:outline-none" />
                  <button onClick={addExercise} disabled={!exMin || exLoading} className="px-6 py-3 rounded-xl bg-agent-nurse text-bg text-base font-medium disabled:opacity-30 active:scale-[0.98]">
                    {exLoading ? <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin inline-block" /> : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sleep — quick log (replaces duplicate Mood; mood lives in Mind Space) */}
          <SleepCard token={token} isToday={isToday} push={push} onStreak={onStreak} />

          {/* Cross-link: Mood lives in Mind Space (avoid duplication) */}
          <a href="/mindspace"
            className="card p-4 flex items-center gap-3 hover:border-accent transition group">
            <div className="w-10 h-10 rounded-xl bg-agent-mindcare/10 border border-agent-mindcare/20 flex items-center justify-center shrink-0">
              <Smile size={18} className="text-agent-mindcare" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Mood &amp; meditation</p>
              <p className="text-xs text-text-muted mt-0.5">Track how you're feeling and run a 5-min breathing session in Mind Space.</p>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition shrink-0" />
          </a>
        </motion.div>

        {/* Chat */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-5 flex flex-col h-[600px] max-h-[80vh]">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-subtle shrink-0">
            <div className="w-9 h-9 rounded-xl bg-agent-nurse/10 border border-agent-nurse/20 flex items-center justify-center">
              <Heart size={16} className="text-agent-nurse fill-agent-nurse/20" />
            </div>
            <div>
              <p className="text-base font-medium text-text-primary">AI Nurse</p>
              <p className="text-[11px] text-text-muted">Online · responds in seconds</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <AgentChat agentType="nurse" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Sleep tracking card ────────────────────────────────────────
// Minimal sleep log: pick bedtime / wake time + quality 1-5.
// Posts to /api/logs/sleep which already exists.
function SleepCard({
  token, isToday, push, onStreak,
}: {
  token: string | null;
  isToday: boolean;
  push: (msg: any) => void;
  onStreak: (data: any) => void;
}) {
  const [today, setToday] = useState<{ hours: number; quality: number | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [bedtime, setBedtime] = useState('23:00');
  const [waketime, setWaketime] = useState('07:00');
  const [quality, setQuality] = useState(4);
  const [busy, setBusy] = useState(false);

  // Fetch today's sleep on mount
  useEffect(() => {
    if (!token) return;
    fetch('/api/logs/sleep', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.log) {
          const hours = (new Date(d.log.wakeTime).getTime() - new Date(d.log.bedtime).getTime()) / 3600000;
          setToday({ hours: Math.round(hours * 10) / 10, quality: d.log.quality });
        }
      })
      .catch(() => {});
  }, [token]);

  async function save() {
    if (!token || busy) return;
    setBusy(true);
    try {
      // Build full datetimes — bedtime might be yesterday, wake is today
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      const [bh, bm] = bedtime.split(':').map(Number);
      const [wh, wm] = waketime.split(':').map(Number);
      // If wake is before bedtime, bedtime is yesterday
      const bedDate = bh > wh ? new Date(`${yesterdayStr}T${bedtime}:00`) : new Date(`${todayStr}T${bedtime}:00`);
      const wakeDate = new Date(`${todayStr}T${waketime}:00`);

      const res = await fetch('/api/logs/sleep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bedtime: bedDate.toISOString(), wakeTime: wakeDate.toISOString(), quality }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({ title: 'Save failed', subtitle: data.error || `${res.status}`, accent: '#ef4444' });
        return;
      }
      const hours = (wakeDate.getTime() - bedDate.getTime()) / 3600000;
      setToday({ hours: Math.round(hours * 10) / 10, quality });
      onStreak(data);
      setOpen(false);
      push({
        title: `${hours.toFixed(1)}h sleep logged`,
        subtitle: `Quality ${quality}/5 · AI Nurse will factor this in.`,
        points: data.awarded || 20,
        accent: '#6366F1',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Moon size={18} className="text-indigo-500" />
          </div>
          <div>
            <p className="text-base font-medium text-text-primary">Sleep</p>
            <p className="text-xs text-text-muted">
              {today
                ? `Last night: ${today.hours}h · quality ${today.quality ?? '—'}/5`
                : 'Track to give AI Nurse the full picture'}
            </p>
          </div>
        </div>
        {isToday && (
          <button onClick={() => setOpen(o => !o)}
            className="px-5 py-3 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/20 transition text-sm font-medium flex items-center gap-2 active:scale-[0.98]">
            <Plus size={14} /> {today ? 'Update' : 'Log sleep'}
          </button>
        )}
      </div>

      {today && (
        <p className="font-display text-4xl text-text-primary">
          {today.hours}<span className="text-xl text-text-secondary">h</span>
        </p>
      )}

      {open && isToday && (
        <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-text-muted block mb-1">Bedtime</span>
              <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)}
                className="w-full bg-bg-card border border-border rounded-xl px-3 py-2.5 text-base text-text-primary focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs text-text-muted block mb-1">Wake time</span>
              <input type="time" value={waketime} onChange={e => setWaketime(e.target.value)}
                className="w-full bg-bg-card border border-border rounded-xl px-3 py-2.5 text-base text-text-primary focus:outline-none" />
            </label>
          </div>
          <div>
            <span className="text-xs text-text-muted block mb-1.5">Quality</span>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setQuality(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    quality === n
                      ? 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30'
                      : 'bg-bg-card text-text-secondary border border-border-subtle hover:border-border'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={busy}
            className="w-full px-5 py-3 rounded-xl bg-indigo-500 text-white font-semibold disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2">
            {busy
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving</>
              : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
