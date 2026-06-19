'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Heart, Brain, Apple, ShieldCheck, Sparkles, Swords, TrendingUp,
  ShoppingBag, Database, Coins, Users, Rocket, ArrowRight, Activity,
  Bot, Lock, Cpu, Calendar, Check
} from 'lucide-react';

const fadeIn = (d = 0) => ({
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: d, ease: [0.16, 1, 0.3, 1] } },
});

function Section({
  id, eyebrow, title, subtitle, children,
}: {
  id: string; eyebrow: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeIn(0)}
      className="scroll-mt-24 py-20 sm:py-28 border-b border-border-subtle last:border-0"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <p className="text-[11px] font-mono tracking-[0.24em] uppercase text-accent mb-4">{eyebrow}</p>
        <h2 className="text-3xl sm:text-5xl font-light text-text-primary tracking-[-0.02em] leading-[1.05]">{title}</h2>
        {subtitle && (
          <p className="text-base sm:text-lg text-text-secondary mt-5 leading-relaxed max-w-2xl">{subtitle}</p>
        )}
        <div className="mt-12 sm:mt-16">{children}</div>
      </div>
    </motion.section>
  );
}

const features = [
  { icon: Heart, color: '#22c55e', title: 'AI Nurse', desc: 'Proactive health check-ins, daily wellness coaching, and HL7 FHIR-based health records.' },
  { icon: ShieldCheck, color: '#3b82f6', title: 'AI Gatekeeper', desc: 'Symptom triage with SNOMED CT / ICD-11 mapping. Decides self-care vs. hospital referral.' },
  { icon: Apple, color: '#f59e0b', title: 'AI Nutritionist', desc: 'Meal analysis, calorie + macro estimation, personalized dietary recommendations.' },
  { icon: Brain, color: '#a855f7', title: 'AI Mind Care', desc: 'Mental wellness companion with guided meditation, breathing, and mood tracking.' },
];

const pillars = [
  { icon: Swords, color: '#ef4444', title: 'Agent Battle Arena', desc: 'AI agents compete on health topics. Users vote, winners earn H2E. 15% platform fee.' },
  { icon: TrendingUp, color: '#3b82f6', title: 'Prediction Market', desc: 'Bet H2E on verifiable health outcomes (steps, sleep, trends). 18% platform fee.' },
  { icon: ShoppingBag, color: '#f59e0b', title: 'Health Commerce', desc: 'AI-recommended supplements, wearables, and wellness services. 10–20% affiliate.' },
  { icon: Database, color: '#22c55e', title: 'Data Intelligence', desc: 'Anonymized cohort data sold to pharma/insurers. Users earn 50%, platform 30%.' },
  { icon: Coins, color: '#c8a87e', title: 'H2E Token Economy', desc: 'BEP-20 on BSC. Earn by logging, burn by purchasing. Streak-based rewards.' },
  { icon: Lock, color: '#a855f7', title: 'Privacy-First', desc: 'AES-256-GCM, k-anonymity ≥ 10, differential privacy, GDPR / HIPAA / PIPA compliant.' },
];

const stack = [
  { label: 'Frontend', value: 'Next.js 14 · TypeScript · TailwindCSS · wagmi v2 · RainbowKit' },
  { label: 'Backend', value: 'Hono · tRPC · Prisma · Redis · BullMQ' },
  { label: 'AI / Medical', value: 'Groq Llama 3.3 70B · xAI Grok · FHIR R4 · SNOMED CT' },
  { label: 'Blockchain', value: 'BSC · Solidity 0.8+ · Foundry · OpenZeppelin · BEP-20' },
  { label: 'Storage', value: 'PostgreSQL · TimescaleDB · IPFS (Pinata) · BNB Greenfield' },
  { label: 'Privacy', value: 'AES-256-GCM · Lit Protocol · DID · zk-SNARKs (planned)' },
];

const team = [
  { name: 'Team Alpha', role: 'AI Scribe', desc: 'NLP → FHIR R4 pipeline. Medical terminology, safety rails, model orchestration.' },
  { name: 'Team Bravo', role: 'Smart Contracts', desc: 'H2E token, HealthReward, DataMarketplace, DataConsent, SBT badges on BSC.' },
  { name: 'Team Charlie', role: 'Frontend', desc: 'Next.js app, wallet UX, dashboards, meditation, community surfaces.' },
  { name: 'Team Delta', role: 'Backend', desc: 'Hono/tRPC API, job queues, hospital adapter plugins, analytics.' },
  { name: 'Team Echo', role: 'Learn-to-Earn', desc: 'Education modules, reminder engine, streak & reward logic.' },
];

const roadmap = [
  {
    phase: 'Q2 2026',
    tag: 'NOW',
    title: 'Core Launch',
    items: [
      'Daily health logging (water, meal, exercise, sleep, mood, meditation)',
      'Four AI agents live: Nurse, Gatekeeper, Nutritionist, Mind Care',
      'H2E token on BSC testnet · streak rewards (3/10/30/100 day)',
      'Community board with likes / comments',
    ],
  },
  {
    phase: 'Q3 2026',
    tag: 'NEXT',
    title: 'Agent Battle Arena',
    items: [
      'Battle creation + entry fee tiers (Bronze → Diamond)',
      'Spectator voting + streak rewards',
      'Leaderboards (agent / voter) · seasonal tournaments',
      'H2E mainnet migration',
    ],
  },
  {
    phase: 'Q4 2026',
    tag: 'SOON',
    title: 'Prediction Market + Commerce',
    items: [
      'YES/NO markets with oracle verification (Apple Health, Google Fit)',
      'Affiliate commerce storefront with H2E discount burn',
      'Wearable adapter (Apple Health, Google Fit, Fitbit, Oura)',
      'Telegram / Slack / Discord proactive agents',
    ],
  },
  {
    phase: 'Q1 2027',
    tag: 'FUTURE',
    title: 'Data Intelligence B2B',
    items: [
      'Anonymized cohort marketplace (pharma, insurers, research)',
      'Differential privacy pipeline · ISO 27001 cert',
      'zk-SNARK consent proofs',
      'Enterprise subscription tier ($99/mo)',
    ],
  },
  {
    phase: '2027+',
    tag: 'VISION',
    title: 'Agent Economy',
    items: [
      'Open agent SDK — third-party developers publish agents',
      'Revenue sharing for agent creators',
      'Cross-chain H2E bridges',
      '350K MAU · $15M ARR target',
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 sm:px-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/[0.05] blur-[160px] pointer-events-none" />
        <motion.div initial="hidden" animate="visible" variants={fadeIn(0)} className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5 mb-8">
            <Activity size={12} className="text-accent" />
            <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">Health2Earn · BSC</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-light text-text-primary tracking-[-0.03em] leading-[0.95]">
            Your AI health team,
            <br />
            <span className="text-gradient-health">rewarded on-chain.</span>
          </h1>
          <p className="text-base sm:text-xl text-text-secondary mt-8 leading-relaxed max-w-2xl mx-auto">
            Health Saviors is an AI Agent health intelligence platform. Log your health, chat with
            specialist AI agents, and earn H2E tokens for every streak.
          </p>

          {/* In-page nav */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-12">
            {[
              { href: '#what', label: 'What it is' },
              { href: '#features', label: 'Features' },
              { href: '#project', label: 'Project' },
              { href: '#team', label: 'Team' },
              { href: '#roadmap', label: 'Roadmap' },
            ].map(x => (
              <a key={x.href} href={x.href}
                className="px-4 py-2 rounded-full border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-hover transition-all">
                {x.label}
              </a>
            ))}
          </div>
        </motion.div>
      </section>

      {/* What is Health Saviors */}
      <Section
        id="what"
        eyebrow="01 · Overview"
        title="What is Health Saviors?"
        subtitle="A next-generation health intelligence platform where AI agents analyze your data, compete for the best insight, and a token economy rewards every healthy habit."
      >
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Bot, title: 'AI Agent Intelligence', desc: 'Four specialist agents collaborate on your health — each grounded in FHIR R4 records.' },
            { icon: Sparkles, title: 'Gamified Wellness', desc: 'Streak-based rewards, mission cards, leaderboards — making daily tracking feel like a game.' },
            { icon: Coins, title: 'Earn While You Heal', desc: 'Every log, every session, every battle can earn H2E — a real BEP-20 asset on BSC.' },
            { icon: Lock, title: 'You Own Your Data', desc: 'Explicit consent per data package. Withdraw anytime. Anonymized before any B2B use.' },
          ].map(x => (
            <div key={x.title} className="card rounded-2xl p-6 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <x.icon size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="text-base font-medium text-text-primary">{x.title}</h3>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">{x.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Features — AI Agents */}
      <Section
        id="features"
        eyebrow="02 · Features"
        title="Four specialist AI agents."
        subtitle="Each agent is purpose-built for one dimension of health. They share a single FHIR-based record so advice stays consistent."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map(f => (
            <div key={f.title} className="card rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-medium text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-text-muted mb-6">Economy pillars</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pillars.map(p => (
              <div key={p.title} className="rounded-xl border border-border-subtle p-5 hover:border-border-hover transition-colors">
                <p.icon size={16} style={{ color: p.color }} className="mb-3" />
                <h4 className="text-sm font-medium text-text-primary">{p.title}</h4>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Project description */}
      <Section
        id="project"
        eyebrow="03 · Project"
        title="How the project is built."
        subtitle="A turborepo monorepo with five domain packages and three apps. Designed from day one for hospital plug-ins, wearable ingest, and chain-abstraction."
      >
        <div className="grid gap-3">
          {stack.map(s => (
            <div key={s.label} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 p-5 rounded-xl border border-border-subtle">
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-accent sm:w-32 shrink-0">{s.label}</span>
              <span className="text-sm text-text-secondary font-mono">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 card rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Cpu size={16} className="text-accent" />
            <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-text-muted">Market · TAM</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { v: '$550B', l: 'Digital Health 2026' },
              { v: '$45B', l: 'Healthcare AI' },
              { v: '$1.2B', l: 'SAM (KR + SEA)' },
              { v: '350K', l: 'Target MAU Y3' },
            ].map(x => (
              <div key={x.l}>
                <p className="text-2xl sm:text-3xl font-light text-text-primary">{x.v}</p>
                <p className="text-xs text-text-muted mt-1">{x.l}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Team */}
      <Section
        id="team"
        eyebrow="04 · Team"
        title="Five squads, one platform."
        subtitle="Health Saviors ships as a coordinated monorepo. Each squad owns a domain end-to-end."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          {team.map(t => (
            <div key={t.name} className="card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Users size={14} className="text-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted">{t.name}</p>
                  <h3 className="text-base font-medium text-text-primary">{t.role}</h3>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Roadmap */}
      <Section
        id="roadmap"
        eyebrow="05 · Roadmap"
        title="Where we are going."
        subtitle="Sourced from our internal strategy plan (BM Revenue Strategy v1.0 · March 2026)."
      >
        <div className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/30 via-border to-transparent" />
          <div className="space-y-8">
            {roadmap.map((r, i) => (
              <div key={r.phase} className="relative pl-10">
                <div className="absolute left-0 top-1.5 w-7 h-7 rounded-full bg-bg border-2 border-accent/40 flex items-center justify-center">
                  <Calendar size={12} className="text-accent" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-text-muted">{r.phase}</span>
                  <span className="text-[9px] font-mono tracking-[0.2em] uppercase px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                    {r.tag}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-light text-text-primary tracking-tight">{r.title}</h3>
                <ul className="mt-4 space-y-2">
                  {r.items.map(it => (
                    <li key={it} className="flex items-start gap-3 text-sm text-text-secondary">
                      <Check size={14} className="text-accent/80 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn(0)} className="max-w-xl mx-auto">
          <Rocket size={20} className="text-accent mx-auto mb-5" />
          <h2 className="text-3xl sm:text-4xl font-light text-text-primary tracking-[-0.02em]">Ready to try it?</h2>
          <p className="text-base text-text-secondary mt-4">You can explore without a wallet. Connect when you are ready to earn.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link href="/dashboard" className="px-6 py-3 rounded-full bg-text-primary text-bg text-sm font-medium hover:bg-accent transition-colors inline-flex items-center gap-2">
              Open Dashboard <ArrowRight size={14} />
            </Link>
            <Link href="/login" className="px-6 py-3 rounded-full border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-hover transition-all">
              Connect Wallet
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
