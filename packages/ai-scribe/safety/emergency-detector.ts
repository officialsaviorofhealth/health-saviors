// Emergency Symptom Detection — Rule-based safety layer
// Rule-based safety layer that complements the AI's detection

import type { SafetyAlert } from "../../shared/types";

interface EmergencyRule {
  keywords: { ko: string[]; en: string[] };
  guidance: { ko: string; en: string };
  emergencyNumber: string;
}

export const EMERGENCY_RULES: EmergencyRule[] = [
  {
    keywords: {
      ko: ["chest hurts", "chest ache", "heart hurts"],
      en: ["chest pain", "chest pressure", "heart attack", "chest tightness"],
    },
    guidance: {
      ko: "🚨 Chest pain may indicate a cardiac emergency. Call 911 immediately or go to the nearest ER. Stay still and remain calm.",
      en: "🚨 Chest pain may indicate a cardiac emergency. Call 911 immediately or go to the nearest ER. Stay still and remain calm.",
    },
    emergencyNumber: "911",
  },
  {
    keywords: {
      ko: ["can't catch breath", "trouble breathing", "out of breath"],
      en: ["can't breathe", "difficulty breathing", "shortness of breath", "breathing problem"],
    },
    guidance: {
      ko: "🚨 Breathing difficulty requires immediate medical attention. Call 911. Sit upright and try to stay calm.",
      en: "🚨 Breathing difficulty requires immediate medical attention. Call 911. Sit upright and try to stay calm.",
    },
    emergencyNumber: "911",
  },
  {
    keywords: {
      ko: ["not conscious", "blacked out", "loss of consciousness"],
      en: ["unconscious", "fainted", "passed out", "lost consciousness", "collapsed"],
    },
    guidance: {
      ko: "🚨 Loss of consciousness is an emergency. Call 911 immediately. Place the person on their side and clear their airway.",
      en: "🚨 Loss of consciousness is an emergency. Call 911 immediately. Place the person on their side and clear their airway.",
    },
    emergencyNumber: "911",
  },
  {
    keywords: {
      ko: ["bleeding a lot", "heavy blood loss", "bleeding won't stop"],
      en: ["heavy bleeding", "severe bleeding", "won't stop bleeding", "massive blood"],
    },
    guidance: {
      ko: "🚨 Severe bleeding is an emergency. Apply firm pressure with a clean cloth and call 911.",
      en: "🚨 Severe bleeding is an emergency. Apply firm pressure with a clean cloth and call 911.",
    },
    emergencyNumber: "911",
  },
  {
    keywords: {
      ko: ["don't want to live", "want to end it", "hurt myself"],
      en: ["want to die", "suicidal", "kill myself", "end my life", "self-harm"],
    },
    guidance: {
      ko: "Professional support is available. Please call the Suicide & Crisis Lifeline at 988. Available 24/7.",
      en: "Professional support is available. Please call the Suicide & Crisis Lifeline at 988. Available 24/7.",
    },
    emergencyNumber: "988",
  },
];

export function checkEmergency(input: string, language: "ko" | "en"): SafetyAlert | null {
  const normalizedInput = input.toLowerCase();

  for (const rule of EMERGENCY_RULES) {
    const keywords = [...rule.keywords.ko, ...rule.keywords.en];
    const triggered = keywords.filter((kw) => normalizedInput.includes(kw.toLowerCase()));

    if (triggered.length > 0) {
      return {
        isEmergency: true,
        triggerSymptoms: triggered,
        guidance: rule.guidance[language],
        emergencyNumber: rule.emergencyNumber,
      };
    }
  }

  return null;
}
