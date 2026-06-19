export type AgentType = 'nurse' | 'gatekeeper' | 'nutritionist' | 'mindcare';

export interface Agent {
  id: AgentType;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentType: AgentType;
  timestamp: Date;
  metadata?: {
    triageLevel?: 'emergency' | 'urgent' | 'routine' | 'self-care';
    department?: string;
    riskScore?: number;
    tags?: string[];
  };
}

export interface Conversation {
  id: string;
  agentType: AgentType;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  age: number;
  heightCm: number;
  weightKg: number;
  tokenBalance: number;
  chronicConditions: string[];
}

export interface SignupData {
  username: string;
  password: string;
  age: number;
  heightCm: number;
  weightKg: number;
  chronicConditions: string[];
  dataConsent: boolean;
}

export const CHRONIC_CONDITIONS = [
  { code: 'diabetes', label: 'Diabetes' },
  { code: 'hypertension', label: 'Hypertension' },
  { code: 'heart_disease', label: 'Heart Disease' },
  { code: 'asthma_copd', label: 'Asthma / COPD' },
  { code: 'arthritis', label: 'Arthritis' },
  { code: 'depression_anxiety', label: 'Depression / Anxiety' },
  { code: 'allergies', label: 'Allergies' },
  { code: 'obesity', label: 'Obesity' },
  { code: 'thyroid', label: 'Thyroid Disorder' },
  { code: 'kidney_disease', label: 'Kidney Disease' },
];
