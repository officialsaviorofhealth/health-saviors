'use client';

import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface SectionHeaderProps {
  overline?: string;
  title: string;
  titleAccent?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  overline,
  title,
  titleAccent,
  subtitle,
  align = 'left',
  className = '',
}: SectionHeaderProps) {
  const alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start';

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className={`flex flex-col gap-3 mb-8 ${alignClass} ${className}`}
    >
      {overline && (
        <motion.p
          variants={fadeInUp}
          className="text-[11px] font-mono font-semibold tracking-[0.12em] uppercase text-[#00e87b]"
        >
          {overline}
        </motion.p>
      )}
      <motion.h2
        variants={fadeInUp}
        className="text-[28px] sm:text-[36px] font-bold text-[#e8ecf4] leading-[1.15] tracking-[-0.02em]"
      >
        {title}
        {titleAccent && (
          <span className="bg-gradient-to-r from-[#00e87b] to-[#00c9a7] bg-clip-text text-transparent">
            {' '}{titleAccent}
          </span>
        )}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={fadeInUp}
          className="text-[15px] text-[#8494a7] leading-relaxed max-w-2xl"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
