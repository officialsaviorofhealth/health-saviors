'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { forwardRef } from 'react';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  variant?: 'default' | 'glow' | 'elevated';
  accentColor?: string;
  hover?: boolean;
  animate?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = 'default',
      accentColor,
      hover = true,
      animate = true,
      padding = 'md',
      className = '',
      children,
      style,
      ...props
    },
    ref
  ) => {
    const base =
      'relative rounded-[16px] border border-black/[0.07] backdrop-blur-xl overflow-hidden';

    const variants = {
      default: 'bg-[#0d1525]/60',
      glow: 'bg-[#0d1525]/60',
      elevated: 'bg-[#111b2e]/70',
    };

    const hoverClass = hover
      ? 'transition-all duration-300 ease-out hover:border-black/[0.1] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4),0_16px_48px_rgba(0,0,0,0.3)] hover:-translate-y-[2px]'
      : '';

    const accentBar = accentColor
      ? `before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]`
      : '';

    const glowOverlay =
      variant === 'glow'
        ? 'after:absolute after:inset-0 after:bg-[radial-gradient(ellipse_at_top,rgba(0,232,123,0.04),transparent_70%)] after:pointer-events-none'
        : '';

    const Comp = animate ? motion.div : 'div';
    const animProps = animate
      ? { variants: fadeInUp, initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-40px' } }
      : {};

    return (
      <Comp
        ref={ref as any}
        className={`${base} ${variants[variant]} ${hoverClass} ${accentBar} ${glowOverlay} ${paddings[padding]} ${className}`}
        style={{
          ...(accentColor
            ? { '--accent-bar': accentColor, borderLeftColor: accentColor, borderLeftWidth: '3px' } as any
            : {}),
          ...style,
        }}
        {...animProps}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

GlassCard.displayName = 'GlassCard';
