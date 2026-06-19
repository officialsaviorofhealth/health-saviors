/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vital Light palette
        bg: { DEFAULT: '#F0F4F8', raised: '#FFFFFF', card: '#FFFFFF' },
        border: { subtle: '#F1F5F9', DEFAULT: '#E2E8F0', hover: '#CBD5E1' },
        text: { primary: '#0F172A', secondary: '#64748B', muted: '#94A3B8' },
        accent: { DEFAULT: '#10B981', soft: 'rgba(16,185,129,0.08)', muted: 'rgba(16,185,129,0.18)' },
        agent: { nurse: '#10B981', gatekeeper: '#3B82F6', nutritionist: '#F59E0B', mindcare: '#A855F7' },
        matte: { DEFAULT: '#F0F4F8', light: '#FFFFFF', lighter: '#F8FAFC' },
        skin: { DEFAULT: '#e5d0c3', light: '#f0e0d5', dark: '#c4a898', muted: 'rgba(229,208,195,0.15)' },
        titanium: { DEFAULT: '#0F172A', dark: '#64748B', darker: '#94A3B8', light: '#0F172A' },
        status: { green: '#10B981', blue: '#3B82F6', amber: '#F59E0B', red: '#EF4444', purple: '#A855F7', orange: '#F97316' },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      fontSize: {
        'display': ['4.5rem', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-lg': ['6rem', { lineHeight: '0.92', letterSpacing: '-0.03em' }],
        'display-xl': ['8rem', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
        'heading': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'heading-lg': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
