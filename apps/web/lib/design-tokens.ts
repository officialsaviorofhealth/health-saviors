export const colors = {
  bg: {
    primary: '#050a12',
    secondary: '#0a1120',
    card: '#0d1525',
    elevated: '#111b2e',
    glass: 'rgba(13, 21, 37, 0.6)',
  },
  accent: {
    primary: '#00e87b',
    primaryMuted: '#00c96a',
    primaryGlow: 'rgba(0, 232, 123, 0.12)',
    gold: '#f0a030',
    goldGlow: 'rgba(240, 160, 48, 0.10)',
  },
  semantic: {
    error: '#ef4444',
    warning: '#eab308',
    success: '#00e87b',
    info: '#3b82f6',
  },
  text: {
    primary: '#e8ecf4',
    secondary: '#8494a7',
    muted: '#4a5568',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.08)',
    hover: 'rgba(0, 232, 123, 0.2)',
  },
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
} as const;

export const shadows = {
  card: '0 1px 3px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)',
  cardHover: '0 4px 12px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,232,123,0.1)',
  glow: '0 0 40px rgba(0,232,123,0.08), 0 0 80px rgba(0,232,123,0.04)',
  glowStrong: '0 0 60px rgba(0,232,123,0.12), 0 0 120px rgba(0,232,123,0.06)',
} as const;

// Agent icon mappings (replace emojis with Lucide icon names)
export const agentIcons: Record<string, string> = {
  coach: 'Activity',
  nutrition: 'Apple',
  sleep: 'Moon',
  mental: 'Brain',
  triage: 'AlertCircle',
  moderator: 'Shield',
  cardio: 'Heart',
  neuro: 'Brain',
  wellness: 'Activity',
  medical: 'Dna',
};

// Agent accent colors
export const agentColors: Record<string, string> = {
  coach: '#00e87b',
  nutrition: '#f0a030',
  sleep: '#a855f7',
  mental: '#3b82f6',
  triage: '#ef4444',
  moderator: '#8494a7',
  cardio: '#ef4444',
  neuro: '#f0a030',
};
