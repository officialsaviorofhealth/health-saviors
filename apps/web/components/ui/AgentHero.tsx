'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  description: string;
  accentColor: string;
  icon: ReactNode;
  stats?: { label: string; value: string }[];
}

export function AgentHero({ eyebrow, title, titleAccent, description, accentColor, icon, stats }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative pb-10 sm:pb-14 pt-4"
    >
      <div
        className="absolute -top-8 -right-10 w-[420px] h-[420px] rounded-full blur-[140px] pointer-events-none opacity-50"
        style={{ background: `${accentColor}20` }}
      />
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center glass-subtle"
              style={{ boxShadow: `inset 0 0 0 1px ${accentColor}40` }}
            >
              {icon}
            </div>
            <p className="text-[11px] font-mono tracking-[0.22em] uppercase" style={{ color: accentColor }}>
              {eyebrow}
            </p>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl text-text-primary">
            {title}
            {titleAccent && <span style={{ color: accentColor }}> {titleAccent}</span>}
          </h1>
          <p className="text-base sm:text-lg text-text-secondary mt-5 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>

        {stats && stats.length > 0 && (
          <div className="flex gap-6 md:gap-10">
            {stats.map(s => (
              <div key={s.label} className="text-right md:text-left">
                <p className="font-display text-3xl sm:text-4xl text-text-primary">{s.value}</p>
                <p className="text-xs text-text-muted mt-1 tracking-wide uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.header>
  );
}
