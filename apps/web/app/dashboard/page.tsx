'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Droplets, UtensilsCrossed, Dumbbell, Moon, Smile, Brain, Coins,
  Heart, ShieldCheck, Apple, Trophy, Flame, TrendingUp, Calendar, Target
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };

type Range = 'day' | 'week' | 'month';

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('week');
  const [data, setData] = useState<any>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) loadAll(t);
  }, []);

  useEffect(() => { if (token) loadRange(token, range); }, [range]);

  const hdrs = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function loadAll(t: string) {
    setLoading(true);
    await Promise.all([loadRange(t, range), loadToday(t), loadAgents(t), loadWeekly(t)]);
    setLoading(false);
  }

  async function loadRange(t: string, r: Range) {
    const d = await fetch(`/api/logs/summary?range=${r}`, { headers: hdrs(t) }).then(r => r.json());
    setData(d);
  }

  async function loadToday(t: string) {
    const d = await fetch('/api/logs/summary?range=day', { headers: hdrs(t) }).then(r => r.json());
    setTodayData(d);
  }

  async function loadAgents(t: string) {
    try {
      const d = await fetch('/api/agents', { headers: hdrs(t) }).then(r => r.json());
      setAgents(d.agents || []);
    } catch {}
  }

  async function loadWeekly(t: string) {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const d = await fetch(`/api/logs/summary?date=${dateStr}&range=day`, { headers: hdrs(t) }).then(r => r.json());
      days.push({
        date: date.toLocaleDateString('en', { weekday: 'short' }),
        water: (d.water?.totalMl || 0) / 1000,
        calories: d.meals?.totalCalories || 0,
        exercise: d.exercise?.totalMin || 0,
        mood: d.mood?.average || 0,
        meditation: d.meditation?.totalMin || 0,
      });
    }
    setWeeklyData(days);

    // Calculate streak from weekly data
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.water > 0 || d.calories > 0 || d.exercise > 0 || d.mood > 0 || d.meditation > 0) s++;
      else break;
    }
    setStreak(s);
  }

  // token optional — preview mode for unauthenticated visitors
  if (token && (loading || !data)) return <div className="min-h-[100dvh] flex items-center justify-center"><div className="w-6 h-6 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" /></div>;
  const safeData = data || { points: 0 };

  // Today's completion score
  const todayChecks = [
    (todayData?.water?.totalMl || 0) >= 500,
    (todayData?.meals?.count || 0) >= 1,
    (todayData?.exercise?.totalMin || 0) >= 1,
    (todayData?.mood?.logs?.length || 0) >= 1,
    (todayData?.meditation?.totalMin || 0) >= 1,
  ];
  const todayScore = Math.round((todayChecks.filter(Boolean).length / todayChecks.length) * 100);
  const radialData = [{ value: todayScore, fill: todayScore >= 80 ? '#22c55e' : todayScore >= 50 ? '#f59e0b' : '#ef4444' }];

  const agentColors: Record<string, { color: string; icon: typeof Heart; label: string }> = {
    nurse: { color: '#22c55e', icon: Heart, label: 'Nurse' },
    gatekeeper: { color: '#3b82f6', icon: ShieldCheck, label: 'Gatekeeper' },
    nutritionist: { color: '#f59e0b', icon: Apple, label: 'Nutritionist' },
    mindcare: { color: '#a855f7', icon: Brain, label: 'Mind Care' },
  };

  const tooltipStyle = { background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 };

  return (
    <div className="max-w-6xl mx-auto px-4 pt-2 pb-8 space-y-6">
      {!token && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Preview dashboard — connect wallet to see your real data and earn H2E.</p>
          <Link href="/login" className="text-xs font-medium text-accent hover:text-text-primary transition-colors">Connect →</Link>
        </div>
      )}

      {/* Daily Mission — top priority */}
      <motion.div initial="hidden" animate="visible" variants={fadeIn}
        className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(200,168,126,0.12), rgba(168,85,247,0.08))', border: '1px solid rgba(200,168,126,0.25)' }}>
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-accent" />
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-accent">Daily Mission</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-light text-text-primary tracking-tight">
              {todayScore >= 80 ? 'Legendary day. Keep going.' : todayScore >= 50 ? 'Halfway there — finish strong.' : 'Log one thing to start your streak.'}
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Complete all 5 activities today for <span className="text-accent font-mono">+50 H2E</span> · Streak bonus at 3 days.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-3xl font-light text-text-primary font-mono">{todayChecks.filter(Boolean).length}<span className="text-lg text-text-muted">/5</span></p>
              <p className="text-xs text-text-muted">completed</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-5 gap-1.5 sm:gap-2 mt-6">
          {[
            { label: 'Water', href: '/wellness', done: todayChecks[0] },
            { label: 'Meal', href: '/nutrition', done: todayChecks[1] },
            { label: 'Exercise', href: '/wellness', done: todayChecks[2] },
            { label: 'Mood', href: '/mindspace', done: todayChecks[3] },
            { label: 'Mind', href: '/mindspace', done: todayChecks[4] },
          ].map(m => (
            <Link key={m.label} href={m.href}
              className={`rounded-xl px-1 py-2.5 sm:p-3 flex flex-col items-center gap-1 text-center transition-all active:scale-[0.98] ${m.done ? 'bg-accent/15 border border-accent/30' : 'bg-black/[0.03] border border-black/[0.08] hover:bg-black/[0.06]'}`}>
              <span className={`text-sm leading-none ${m.done ? 'text-accent' : 'text-text-muted'}`}>
                {m.done ? '✓' : '○'}
              </span>
              <span className={`text-[10px] sm:text-xs font-medium leading-tight whitespace-nowrap ${m.done ? 'text-accent' : 'text-text-secondary'}`}>
                {m.label}
              </span>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={stagger} className="flex items-center justify-between flex-wrap gap-3">
        <motion.div variants={fadeIn}>
          <h1 className="text-3xl font-light text-text-primary font-[Outfit]">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">Your complete health overview</p>
        </motion.div>
        <motion.div variants={fadeIn} className="flex items-center gap-1 bg-bg-card rounded-full p-1">
          {(['day', 'week', 'month'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors active:scale-[0.98] ${range === r ? 'bg-black/[0.08] text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
              {r}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Top Row: Points + Streak + Today Score */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeIn} className="card rounded-2xl p-5 flex flex-col items-center justify-center">
          <Coins size={20} className="text-accent mb-2" />
          <span className="text-2xl font-light text-text-primary font-mono">{(safeData.points || 0).toLocaleString()}</span>
          <span className="text-xs text-text-secondary">H2E Points</span>
        </motion.div>

        <motion.div variants={fadeIn} className="card rounded-2xl p-5 flex flex-col items-center justify-center">
          <Flame size={20} className="text-orange-400 mb-2" />
          <span className="text-2xl font-light text-text-primary font-mono">{streak}</span>
          <span className="text-xs text-text-secondary">Day Streak</span>
          <div className="flex gap-2 mt-2">
            {[10, 30, 100].map(m => (
              <span key={m} className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${streak >= m ? 'bg-agent-nutritionist/20 text-agent-nutritionist' : 'bg-bg-card text-text-muted'}`}>{m}d{streak >= m ? '✓' : ''}</span>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeIn} className="card rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="w-20 h-20 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-light text-text-primary font-mono">{todayScore}%</span>
            </div>
          </div>
          <span className="text-xs text-text-secondary mt-1">Today's Score</span>
        </motion.div>
      </motion.div>

      {/* Today's Checklist */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-text-secondary" />
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Today's Activity</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Water', icon: Droplets, color: '#3b82f6', done: todayChecks[0], value: `${((todayData?.water?.totalMl || 0) / 1000).toFixed(1)}L` },
            { label: 'Meals', icon: UtensilsCrossed, color: '#f59e0b', done: todayChecks[1], value: `${todayData?.meals?.count || 0} meals` },
            { label: 'Exercise', icon: Dumbbell, color: '#22c55e', done: todayChecks[2], value: `${todayData?.exercise?.totalMin || 0} min` },
            { label: 'Mood', icon: Smile, color: '#a855f7', done: todayChecks[3], value: todayData?.mood?.logs?.[0] ? ['', '😫', '😟', '😐', '🙂', '😄'][todayData.mood.logs[0].score] : '—' },
            { label: 'Meditation', icon: Brain, color: '#a855f7', done: todayChecks[4], value: `${todayData?.meditation?.totalMin || 0} min` },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-3 text-center transition-all ${item.done ? 'bg-black/[0.05] border border-black/[0.1]' : 'bg-bg-card border border-border-subtle'}`}>
              <item.icon size={16} className="mx-auto mb-1" style={{ color: item.done ? item.color : '#555' }} />
              <p className="text-xs text-text-primary font-mono">{item.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Agents Status */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-accent" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">AI Agents</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['nurse', 'gatekeeper', 'nutritionist', 'mindcare'].map(type => {
            const agent = agents.find(a => a.agentType === type);
            const ac = agentColors[type];
            const Icon = ac.icon;
            const links: Record<string, string> = { nurse: '/wellness', gatekeeper: '/symptoms', nutritionist: '/nutrition', mindcare: '/mindspace' };
            return (
              <Link key={type} href={links[type]}
                className="card-flat rounded-xl p-4 hover:bg-black/[0.05] transition-all group active:scale-[0.98]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ac.color}10`, border: `1px solid ${ac.color}20` }}>
                    <Icon size={14} style={{ color: ac.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">{agent?.nickname || ac.label}</p>
                    <p className="text-xs text-text-muted capitalize">{ac.label}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Messages</span>
                    <span className="text-text-primary font-mono">{agent?.totalMessages || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Conversations</span>
                    <span className="text-text-primary font-mono">{agent?.conversationCount || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Last active</span>
                    <span className="text-text-primary">{agent?.lastInteraction ? new Date(agent.lastInteraction).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Weekly Charts */}
      {weeklyData.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="visible">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} className="text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">7-Day Trends</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div variants={fadeIn} className="card rounded-2xl p-5">
              <h3 className="text-xs text-text-secondary mb-3 flex items-center gap-2"><Droplets size={12} className="text-agent-gatekeeper" /> Water (L)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={weeklyData}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="water" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div variants={fadeIn} className="card rounded-2xl p-5">
              <h3 className="text-xs text-text-secondary mb-3 flex items-center gap-2"><Dumbbell size={12} className="text-agent-nurse" /> Exercise (min)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="exercise" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div variants={fadeIn} className="card rounded-2xl p-5">
              <h3 className="text-xs text-text-secondary mb-3 flex items-center gap-2"><UtensilsCrossed size={12} className="text-agent-nutritionist" /> Calories</h3>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={weeklyData}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="calories" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div variants={fadeIn} className="card rounded-2xl p-5">
              <h3 className="text-xs text-text-secondary mb-3 flex items-center gap-2"><Smile size={12} className="text-agent-mindcare" /> Mood & Meditation</h3>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={weeklyData}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="mood" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} name="Mood (1-5)" />
                  <Area type="monotone" dataKey="meditation" stroke="#6366f1" fill="#6366f1" fillOpacity={0.05} strokeWidth={1.5} name="Meditation (min)" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Milestone Progress */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Streak Milestones</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { days: 3, reward: 100, label: '3 Days' },
            { days: 10, reward: 500, label: '10 Days' },
            { days: 30, reward: '2,000', label: '30 Days' },
            { days: 100, reward: '10,000', label: '100 Days' },
          ].map(m => (
            <div key={m.days} className={`rounded-xl p-3 text-center border transition-all ${streak >= m.days ? 'bg-agent-nutritionist/10 border-agent-nutritionist/20' : 'bg-bg-card border-border-subtle'}`}>
              <p className={`text-lg ${streak >= m.days ? 'text-agent-nutritionist' : 'text-text-muted'}`}>{streak >= m.days ? '✓' : '🔒'}</p>
              <p className="text-xs text-text-primary mt-1">{m.label}</p>
              <p className="text-xs text-text-muted font-mono">+{m.reward} H2E</p>
              {streak < m.days && streak > 0 && (
                <div className="mt-1.5">
                  <div className="w-full h-1 bg-black/[0.04] rounded-full">
                    <div className="h-full bg-agent-nutritionist/40 rounded-full" style={{ width: `${Math.min((streak / m.days) * 100, 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-text-muted mt-0.5 font-mono">{m.days - streak}d left</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
