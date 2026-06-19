'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Moon, Dumbbell, Smile, AlertTriangle, Activity } from 'lucide-react';
import AgentChat from '@/components/AgentChat';
import { AgentHero } from '@/components/ui/AgentHero';

const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };
const GATEKEEPER = '#3b82f6';

const SYMPTOMS = [
  { label: 'Headache', icon: '🧠' },
  { label: 'Chest pain', icon: '❤️' },
  { label: 'Fever', icon: '🌡️' },
  { label: 'Stomach pain', icon: '🫃' },
  { label: 'Dizziness', icon: '💫' },
  { label: 'Back pain', icon: '🦴' },
  { label: 'Sore throat', icon: '🗣️' },
  { label: 'Skin rash', icon: '🩹' },
];

const TRIAGE = [
  { color: '#ef4444', level: 'Emergency', time: 'Call 119 / 911 now', desc: 'Life-threatening — severe chest pain, stroke signs, breathing failure.' },
  { color: '#f97316', level: 'Urgent', time: 'ER within 2–4 hours', desc: 'Rapidly worsening symptoms that cannot wait until tomorrow.' },
  { color: '#eab308', level: 'Routine', time: 'Clinic within 1–7 days', desc: 'Stable but persistent — needs a doctor\'s evaluation.' },
  { color: '#22c55e', level: 'Self-care', time: 'Rest & monitor', desc: 'Likely to resolve on its own with hydration, sleep, or OTC care.' },
];

export default function SymptomCheckPage() {
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [chatPrefill, setChatPrefill] = useState<string>('');

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) loadSummary(t);
  }, []);

  async function loadSummary(t: string) {
    const res = await fetch('/api/logs/summary?range=week', { headers: { Authorization: `Bearer ${t}` } });
    const data = await res.json();
    setSummary(data);
  }

  const moodAvg = summary?.mood?.average;
  const sleepLogs = summary?.sleep?.logs || [];
  const exerciseMin = summary?.exercise?.totalMin || 0;
  const warnings: string[] = [];
  if (moodAvg && moodAvg < 3) warnings.push('Mood has trended low this week — factor into triage.');
  if (exerciseMin < 30) warnings.push('Very low activity this week (<30 min).');
  if (sleepLogs.length === 0) warnings.push('No sleep data recorded in the last 7 days.');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      {!token && (
        <div className="mb-6 rounded-2xl glass px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Preview mode — connect your wallet for personalized triage.</p>
          <a href="/login" className="text-xs font-medium text-accent hover:text-text-primary transition-colors">Connect →</a>
        </div>
      )}

      <AgentHero
        eyebrow="Agent · 02"
        title="Symptom Check"
        titleAccent="."
        description="Your AI Gatekeeper triages symptoms using SNOMED CT and your personal health context. It decides self-care, clinic, or ER — and backs every call with reasoning."
        accentColor={GATEKEEPER}
        icon={<ShieldCheck size={20} className="text-agent-gatekeeper" />}
        stats={[
          { label: 'This week', value: `${exerciseMin}m` },
          { label: 'Alerts', value: `${warnings.length}` },
        ]}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 sm:gap-6">
        {/* Context panel */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          {/* This Week */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-agent-gatekeeper" />
              <h3 className="text-sm font-medium text-text-primary">Your week so far</h3>
            </div>
            <div className="space-y-3">
              <Row icon={<Moon size={14} className="text-indigo-400" />} label="Sleep" value={sleepLogs.length > 0 ? `${sleepLogs.length} nights` : 'No data'} />
              <Row icon={<Dumbbell size={14} className="text-agent-nurse" />} label="Exercise" value={`${exerciseMin} min`} />
              <Row icon={<Smile size={14} className="text-agent-mindcare" />} label="Avg Mood" value={moodAvg ? `${moodAvg.toFixed(1)} / 5` : 'No data'} />
            </div>
            <p className="text-xs text-text-muted mt-4 leading-relaxed">
              The Gatekeeper reads this before answering. More logs = sharper triage.
            </p>
          </div>

          {/* Alerts */}
          {warnings.length > 0 && (
            <div className="card p-5" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-400" />
                <h3 className="text-sm font-medium text-amber-400">Context alerts</h3>
              </div>
              <ul className="space-y-2">
                {warnings.map((w, i) => (
                  <li key={i} className="text-sm text-text-secondary leading-relaxed flex gap-2">
                    <span className="text-amber-400">•</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Common Symptoms — click to prefill */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-1">Tap a symptom</h3>
            <p className="text-xs text-text-muted mb-4">We\'ll start a conversation with AI Gatekeeper.</p>
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOMS.map(s => (
                <button key={s.label}
                  onClick={() => setChatPrefill(`I have ${s.label.toLowerCase()}. Can you help me figure out what to do?`)}
                  className="glass-subtle hover:bg-black/[0.06] rounded-xl px-3 py-2.5 flex items-center gap-2 text-left transition-all active:scale-[0.98]">
                  <span className="text-base">{s.icon}</span>
                  <span className="text-sm text-text-primary">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Triage guide */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-4">How we triage</h3>
            <div className="space-y-3">
              {TRIAGE.map(t => (
                <div key={t.level} className="flex gap-3">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: t.color }} />
                  <div>
                    <p className="text-sm text-text-primary font-medium">{t.level} · <span className="text-text-secondary font-normal">{t.time}</span></p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Chat */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-5 flex flex-col h-[640px] max-h-[80vh]">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-subtle shrink-0">
            <div className="w-9 h-9 rounded-xl bg-agent-gatekeeper/10 border border-agent-gatekeeper/20 flex items-center justify-center">
              <ShieldCheck size={16} className="text-agent-gatekeeper" />
            </div>
            <div>
              <p className="text-base font-medium text-text-primary">AI Gatekeeper</p>
              <p className="text-[11px] text-text-muted">Symptom triage · SNOMED CT / ICD-11</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <AgentChat agentType="gatekeeper" initialMessage={chatPrefill} key={chatPrefill} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">{icon}<span className="text-sm text-text-secondary">{label}</span></div>
      <span className="text-sm text-text-primary font-mono">{value}</span>
    </div>
  );
}
