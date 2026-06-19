'use client';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'premium' | 'live' | 'info';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-black/[0.05] text-[#8494a7] border-black/[0.07]',
  success: 'bg-[#00e87b]/10 text-[#00e87b] border-[#00e87b]/20',
  warning: 'bg-[#f0a030]/10 text-[#f0a030] border-[#f0a030]/20',
  error: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
  premium: 'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20',
  live: 'bg-[#00e87b]/10 text-[#00e87b] border-[#00e87b]/20',
  info: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
};

const sizeStyles = {
  sm: 'text-[9px] px-2 py-0.5',
  md: 'text-[10px] px-2.5 py-1',
};

export function Badge({ variant = 'default', size = 'sm', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold tracking-[0.06em] uppercase rounded-full border
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {variant === 'live' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e87b] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00e87b]" />
        </span>
      )}
      {children}
    </span>
  );
}
