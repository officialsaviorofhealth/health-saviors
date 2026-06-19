'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Heart, ShieldCheck, Apple, Brain, Coins, ChevronRight, X, Sparkles, Bell,
} from 'lucide-react';

const STORAGE_KEY = 'onboarding-seen-v1';

interface Step {
  emoji: string;
  title: string;
  body: React.ReactNode;
  action?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Welcome to Health Saviors',
    body: (
      <>
        Four AI specialists track your wellness, triage symptoms, plan meals, and care for your mind —
        all sharing your daily logs so the advice gets sharper the more you use it.
      </>
    ),
  },
  {
    emoji: '👥',
    title: 'Meet your 4 agents',
    body: (
      <ul className="space-y-2.5 text-sm">
        <li className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-lg bg-agent-nurse/10 border border-agent-nurse/30 flex items-center justify-center shrink-0 mt-0.5">
            <Heart size={13} className="text-agent-nurse" />
          </span>
          <span><strong className="text-text-primary">Nurse</strong> — daily check-ins, water, exercise habits</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-lg bg-agent-gatekeeper/10 border border-agent-gatekeeper/30 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck size={13} className="text-agent-gatekeeper" />
          </span>
          <span><strong className="text-text-primary">Gatekeeper</strong> — symptom triage, when to see a doctor</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-lg bg-agent-nutritionist/10 border border-agent-nutritionist/30 flex items-center justify-center shrink-0 mt-0.5">
            <Apple size={13} className="text-agent-nutritionist" />
          </span>
          <span><strong className="text-text-primary">Nutritionist</strong> — meal logging with AI calorie estimates</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-lg bg-agent-mindcare/10 border border-agent-mindcare/30 flex items-center justify-center shrink-0 mt-0.5">
            <Brain size={13} className="text-agent-mindcare" />
          </span>
          <span><strong className="text-text-primary">Mind Care</strong> — mood tracking, breathing, meditation</span>
        </li>
      </ul>
    ),
  },
  {
    emoji: '🔥',
    title: 'Streaks earn H2E',
    body: (
      <>
        Log <strong>any</strong> activity — water, a meal, exercise, mood — and you build a streak.
        Every 3 days you earn <span className="inline-flex items-center gap-1 text-accent font-semibold"><Coins size={11} /> +100 H2E</span>,
        with bigger bonuses at 10/30/100 days. Your streak and balance live in the top right of every page.
      </>
    ),
  },
  {
    emoji: '💬',
    title: 'Tell the AI what you ate',
    body: (
      <>
        In the <strong>Nutrition</strong> tab type <em>"had grilled chicken salad for lunch"</em> in chat —
        the Nutritionist auto-extracts calories, protein, carbs, and saves it to your meal diary. No more manual logging.
      </>
    ),
  },
  {
    emoji: '🔔',
    title: 'Optional: install + push',
    body: (
      <>
        Add Health Saviors to your home screen for offline access and push notifications about streak milestones,
        2L hydration, agent follow-ups, and more.
      </>
    ),
    action: { label: 'Install & enable notifications', href: '/notifications' },
  },
];

// First-run onboarding tour. Stores a seen flag in localStorage so it never
// appears twice. Only ever shown to logged-in users (a logged-out tour is noise).
export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem('token');
    setToken(t);
    if (!t) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const id = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(id);
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setOpen(false);
  }

  if (!token) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl border border-border max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Progress + close */}
            <div className="flex items-center justify-between px-5 pt-5">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span key={i}
                    className={`h-1 rounded-full transition-all ${
                      i === step ? 'w-8 bg-accent' :
                      i < step  ? 'w-4 bg-accent/40' :
                                  'w-4 bg-border'
                    }`} />
                ))}
              </div>
              <button onClick={dismiss}
                className="text-text-muted hover:text-text-primary p-1 -mr-1"
                aria-label="Skip onboarding">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pt-6 pb-4 flex-1 overflow-y-auto">
              <div className="text-5xl mb-4 select-none">{s.emoji}</div>
              <h2 className="font-display text-2xl text-text-primary mb-2">{s.title}</h2>
              <div className="text-sm text-text-secondary leading-relaxed">{s.body}</div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3 border-t border-border-subtle">
              <button onClick={dismiss}
                className="text-xs text-text-muted hover:text-text-primary transition">
                Skip
              </button>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {step > 0 && (
                  <button onClick={() => setStep(p => p - 1)}
                    className="px-4 py-2 rounded-full text-xs font-medium border border-border text-text-secondary hover:text-text-primary transition">
                    Back
                  </button>
                )}
                {s.action && isLast && (
                  <Link href={s.action.href} onClick={dismiss}
                    className="px-4 py-2 rounded-full text-xs font-semibold border border-border hover:border-accent hover:text-accent transition flex items-center gap-1.5">
                    <Bell size={11} /> {s.action.label}
                  </Link>
                )}
                <button onClick={() => isLast ? dismiss() : setStep(p => p + 1)}
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-accent text-white shadow shadow-accent/30 hover:bg-accent-hover transition flex items-center gap-1.5">
                  {isLast
                    ? <><Sparkles size={11} /> Get started</>
                    : <>Next <ChevronRight size={11} /></>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
