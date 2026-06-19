'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import * as LucideIcons from 'lucide-react';

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  className?: string;
}

export function StatCard({ icon, label, value, sublabel, color = '#00e87b', className = '' }: StatCardProps) {
  const IconComp = (LucideIcons as any)[icon] || LucideIcons.Activity;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className={`relative rounded-[16px] border border-black/[0.07] bg-[#0d1525]/60 backdrop-blur-xl p-5
        transition-all duration-300 hover:border-black/[0.1] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-[1px] ${className}`}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <IconComp size={20} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-mono font-semibold tracking-[0.08em] uppercase text-[#8494a7] mb-1">
            {label}
          </p>
          <p className="text-2xl font-mono font-bold text-[#e8ecf4] tabular-nums leading-none">
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-[#4a5568] mt-1.5">{sublabel}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
