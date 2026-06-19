'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles = {
  primary:
    'bg-[#00e87b] text-[#050a12] font-semibold shadow-[0_0_20px_rgba(0,232,123,0.15)] hover:shadow-[0_0_30px_rgba(0,232,123,0.25)] hover:bg-[#00d46f] active:bg-[#00c064]',
  secondary:
    'bg-transparent border border-black/[0.1] text-[#e8ecf4] hover:border-[#00e87b]/30 hover:text-[#00e87b] hover:shadow-[0_0_20px_rgba(0,232,123,0.05)]',
  ghost:
    'bg-transparent text-[#8494a7] hover:text-[#e8ecf4] hover:bg-black/[0.03]',
};

const sizeStyles = {
  sm: 'text-xs px-3.5 py-1.5 rounded-lg',
  md: 'text-sm px-5 py-2.5 rounded-xl',
  lg: 'text-sm px-7 py-3.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 font-mono tracking-wide
          transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
