// Agent Debate Service — Multi-agent AI health discussion panel
//
// Multiple AI agents analyze a user's health data (including wearables) and
// debate findings while the user spectates the conversation.

import { randomUUID } from "crypto";

// ── Types ──

export interface DebateAgent {
  id: string;
  name: string;
  emoji: string;
  specialty: string;
  systemPrompt: string;
}

export interface DebateMessage {
  agentId: string;
  agentName: string;
  emoji: string;
  content: string;
  replyTo?: string; // agentId this message responds to
  confidence: number;
  timestamp: number;
  round: number;
}

export interface DebateContext {
  userSymptoms?: string;
  wearableData?: {
    heartRate?: { avg: number; min: number; max: number; resting: number };
    sleep?: { duration: number; deepSleep: number; remSleep: number; quality: string };
    steps?: { today: number; weekAvg: number };
    bloodOxygen?: number;
    stress?: number;
  };
  recentEntries?: Array<{ date: string; symptoms: string[]; severity: number }>;
}

export interface DebateResult {
  id: string;
  topic: string;
  context: DebateContext;
  messages: DebateMessage[];
  consensus: string;
  keyInsights: string[];
  pointsEarned: number;
  totalRounds: number;
}

// ── Debate Agents Definition ──

const DEBATE_AGENTS: DebateAgent[] = [
  {
    id: "coach",
    name: "Health Coach",
    emoji: "🏃",
    specialty: "overall wellness, lifestyle, exercise, recovery",
    systemPrompt: `You are a certified Health Coach on a multi-agent health panel. Your role is to provide holistic wellness assessments. Focus on:
- Overall lifestyle balance (activity, rest, nutrition)
- Exercise recovery and training load
- Daily habit optimization
- Long-term health trajectory
Always reference specific wearable data values when available. Be encouraging but data-driven.`,
  },
  {
    id: "nutrition",
    name: "Nutritionist",
    emoji: "🥗",
    specialty: "dietary patterns, nutrient deficiencies, meal timing",
    systemPrompt: `You are a registered Nutritionist on a multi-agent health panel. Your role is to analyze dietary connections to health data. Focus on:
- Nutrient deficiency indicators from symptoms
- Blood oxygen and heart rate correlations to diet
- Meal timing impact on sleep quality
- Hydration markers
- Anti-inflammatory dietary patterns
Reference wearable metrics to support dietary recommendations.`,
  },
  {
    id: "sleep",
    name: "Sleep Expert",
    emoji: "😴",
    specialty: "sleep quality, circadian rhythm, sleep hygiene",
    systemPrompt: `You are a Sleep Medicine Specialist on a multi-agent health panel. Your role is to deeply analyze sleep patterns. Focus on:
- Sleep architecture (deep sleep vs REM ratios)
- Circadian rhythm alignment
- Sleep efficiency and fragmentation
- Impact of daytime activity on sleep quality
- Heart rate variability during sleep
Always cite specific sleep duration, deep sleep, and REM numbers from the data.`,
  },
  {
    id: "mental",
    name: "Mental Wellness",
    emoji: "🧠",
    specialty: "stress, mood, cognitive function, emotional well-being",
    systemPrompt: `You are a Mental Health & Wellness Specialist on a multi-agent health panel. Your role is to assess psychological and cognitive dimensions. Focus on:
- Stress level interpretation and coping
- Sleep-mood connections
- Activity levels and endorphin patterns
- Cognitive load and burnout indicators
- Anxiety or depression screening signals
Reference stress scores, sleep quality, and heart rate patterns when discussing mental state.`,
  },
  {
    id: "triage",
    name: "Safety Triage",
    emoji: "🚨",
    specialty: "urgency assessment, emergency detection, red flags",
    systemPrompt: `You are a Medical Safety Triage Specialist on a multi-agent health panel. Your critical role is to detect urgent or dangerous patterns. Focus on:
- Abnormal vital signs (heart rate, blood oxygen)
- Dangerous symptom combinations
- Escalation thresholds (when to see a doctor immediately)
- Drug interaction risks if medications are mentioned
- Wearable data anomalies that could indicate emergencies
Be direct and clear. If something is dangerous, say so plainly. If everything looks safe, confirm that too.`,
  },
  {
    id: "moderator",
    name: "Panel Moderator",
    emoji: "🎙️",
    specialty: "synthesis, follow-up questions, consensus building",
    systemPrompt: `You are the Panel Moderator on a multi-agent health panel. Your role is to orchestrate the discussion. Focus on:
- Synthesizing key points from all specialists
- Identifying areas of agreement and disagreement
- Asking targeted follow-up questions to specialists
- Building actionable consensus recommendations
- Prioritizing the most important findings
Summarize clearly and ensure the user walks away with concrete next steps.`,
  },
];

// ── Helper: Get agent by ID ──

function getAgent(id: string): DebateAgent {
  return DEBATE_AGENTS.find((a) => a.id === id)!;
}

// ── Helper: Build context summary for prompts ──

function buildContextSummary(context: DebateContext): string {
  const parts: string[] = [];

  if (context.userSymptoms) {
    parts.push(`**User's reported symptoms:** ${context.userSymptoms}`);
  }

  if (context.wearableData) {
    const w = context.wearableData;
    parts.push("**Wearable Data:**");

    if (w.heartRate) {
      parts.push(
        `- Heart Rate: avg ${w.heartRate.avg}bpm, resting ${w.heartRate.resting}bpm, min ${w.heartRate.min}bpm, max ${w.heartRate.max}bpm`
      );
    }
    if (w.sleep) {
      parts.push(
        `- Sleep: ${w.sleep.duration}h total, ${w.sleep.deepSleep}h deep sleep, ${w.sleep.remSleep}h REM, quality: ${w.sleep.quality}`
      );
    }
    if (w.steps) {
      parts.push(
        `- Steps: ${w.steps.today.toLocaleString()} today, weekly avg ${w.steps.weekAvg.toLocaleString()}`
      );
    }
    if (w.bloodOxygen !== undefined) {
      parts.push(`- Blood Oxygen (SpO2): ${w.bloodOxygen}%`);
    }
    if (w.stress !== undefined) {
      parts.push(`- Stress Level: ${w.stress}/100`);
    }
  }

  if (context.recentEntries && context.recentEntries.length > 0) {
    parts.push("**Recent Health Entries:**");
    for (const entry of context.recentEntries.slice(0, 5)) {
      parts.push(
        `- ${entry.date}: ${entry.symptoms.join(", ")} (severity: ${entry.severity}/10)`
      );
    }
  }

  return parts.length > 0
    ? parts.join("\n")
    : "No specific health data provided. Provide general wellness guidance.";
}

// ── AI Response Generator ──
// Uses real AI API when available, falls back to intelligent mock responses.

async function generateAgentResponse(
  agent: DebateAgent,
  context: DebateContext,
  previousMessages: DebateMessage[],
  round: number
): Promise<{ content: string; confidence: number }> {
  const contextSummary = buildContextSummary(context);

  // Build conversation history for this agent
  const conversationHistory = previousMessages
    .map(
      (m) =>
        `[${m.emoji} ${m.agentName} (Round ${m.round})]: ${m.content}`
    )
    .join("\n\n");

  const prompt = buildAgentPrompt(agent, contextSummary, conversationHistory, round);

  // ── Try real AI API first ──
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey && process.env.AGENT_DEBATE_USE_AI === "true") {
    try {
      return await callAIAPI(apiKey, agent, prompt);
    } catch (err) {
      console.warn(`[AgentDebate] AI API call failed for ${agent.id}, using mock fallback:`, err);
    }
  }

  // ── Smart mock fallback ──
  return generateMockResponse(agent, context, previousMessages, round);
}

function buildAgentPrompt(
  agent: DebateAgent,
  contextSummary: string,
  conversationHistory: string,
  round: number
): string {
  let prompt = `${agent.systemPrompt}\n\n--- PATIENT DATA ---\n${contextSummary}\n\n`;

  if (conversationHistory) {
    prompt += `--- PANEL DISCUSSION SO FAR ---\n${conversationHistory}\n\n`;
  }

  switch (round) {
    case 1:
      prompt += `This is ROUND 1. Give your initial analysis based on the patient data. Reference specific numbers from the wearable data. Keep it to 2-3 focused paragraphs.`;
      break;
    case 2:
      prompt += `This is ROUND 2. Review what other panelists have said. Reference their findings by name. Note agreements, disagreements, or additional insights they may have missed. Keep it concise.`;
      break;
    case 3:
      if (agent.id === "moderator") {
        prompt += `This is ROUND 3 (FINAL). As moderator, synthesize ALL panelists' findings into a clear summary. List the top 3-5 actionable recommendations. Note any areas where the panel disagreed and provide guidance.`;
      } else {
        prompt += `This is ROUND 3 (FINAL). Add any final critical thoughts. If the moderator asked you a follow-up, address it. Keep it brief — 1-2 paragraphs max.`;
      }
      break;
  }

  return prompt;
}

async function callAIAPI(
  apiKey: string,
  agent: DebateAgent,
  prompt: string
): Promise<{ content: string; confidence: number }> {
  // LLM provider (OpenAI-compatible chat completions, e.g. Groq / xAI Grok)
  if (process.env.LLM_API_KEY) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AGENT_DEBATE_MODEL || "llama-3.3-70b-versatile",
        max_tokens: 600,
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`LLM API error: ${res.status}`);
    const data = (await res.json()) as any;
    const content = data.choices?.[0]?.message?.content || "No response generated.";
    return {
      content,
      confidence: 0.85 + Math.random() * 0.1,
    };
  }

  // OpenAI API
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AGENT_DEBATE_MODEL || "gpt-4o-mini",
        max_tokens: 600,
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = (await res.json()) as any;
    const content = data.choices?.[0]?.message?.content || "No response generated.";
    return {
      content,
      confidence: 0.85 + Math.random() * 0.1,
    };
  }

  throw new Error("No AI API key configured");
}

// ── Smart Mock Response Generator ──
// Generates realistic, data-aware responses based on actual context values.

function generateMockResponse(
  agent: DebateAgent,
  context: DebateContext,
  previousMessages: DebateMessage[],
  round: number
): { content: string; confidence: number } {
  const w = context.wearableData;
  const symptoms = context.userSymptoms || "general wellness check";
  const entries = context.recentEntries || [];

  // Round-specific mock generators per agent
  const generators: Record<string, (round: number) => { en: string; confidence: number }> = {

    // ── Health Coach ──
    coach: (round) => {
      if (round === 1) {
        const stepsComment = w?.steps
          ? w.steps.today < 5000
            ? `Your step count of ${w.steps.today.toLocaleString()} today is below the recommended 7,000-10,000 range. Your weekly average of ${w.steps.weekAvg.toLocaleString()} suggests this might be a pattern rather than a one-off day.`
            : w.steps.today >= 10000
              ? `Great job on ${w.steps.today.toLocaleString()} steps today! Your weekly average of ${w.steps.weekAvg.toLocaleString()} shows consistent activity.`
              : `Your ${w.steps.today.toLocaleString()} steps today are moderate. Weekly average of ${w.steps.weekAvg.toLocaleString()} — there's room to push toward 10,000.`
          : "No step data available, but physical activity tracking would help me give better guidance.";

        const hrComment = w?.heartRate
          ? `Resting heart rate of ${w.heartRate.resting}bpm is ${w.heartRate.resting < 60 ? "excellent — athlete-level fitness" : w.heartRate.resting <= 72 ? "within a healthy range" : w.heartRate.resting <= 85 ? "slightly elevated, which could indicate stress, deconditioning, or fatigue" : "concerning and warrants monitoring — consider consulting a physician"}.`
          : "";

        const sleepComment = w?.sleep
          ? `With ${w.sleep.duration} hours of sleep (quality: ${w.sleep.quality}), ${w.sleep.duration < 6 ? "you're significantly sleep-deprived, which impacts recovery, cognition, and metabolism" : w.sleep.duration < 7 ? "you're slightly under the 7-9 hour recommendation" : "you're hitting a solid sleep window"}.`
          : "";

        return {
          en: `Looking at the overall picture for "${symptoms}": ${stepsComment} ${hrComment} ${sleepComment} My initial recommendation is to focus on consistency — regular movement, adequate sleep, and managing any reported symptoms with a balanced approach.`,
          confidence: 0.82,
        };
      }

      if (round === 2) {
        const sleepExpertRef = previousMessages.find((m) => m.agentId === "sleep");
        const nutritionRef = previousMessages.find((m) => m.agentId === "nutrition");
        return {
          en: `I agree with ${sleepExpertRef ? "the Sleep Expert's concern about sleep quality" : "the panel's observations so far"}. ${nutritionRef ? "The Nutritionist raises a valid point about dietary factors — " : ""}From a holistic coaching perspective, ${w?.stress && w.stress > 60 ? `the stress level of ${w.stress}/100 combined with ${w?.sleep?.quality || "poor"} sleep quality creates a negative feedback loop that undermines recovery` : "the data suggests a manageable wellness profile, but there are optimization opportunities"}. I'd suggest a phased approach: first address sleep hygiene, then gradually increase activity levels.`,
          confidence: 0.85,
        };
      }

      // Round 3
      return {
        en: `To wrap up my perspective: the key lifestyle factor here is ${w?.sleep && w.sleep.duration < 7 ? "sleep deficit" : w?.steps && w.steps.today < 5000 ? "insufficient physical activity" : "maintaining the current positive trajectory"}. A simple daily action plan would be: (1) ${w?.sleep && w.sleep.duration < 7 ? "set a fixed bedtime 30 minutes earlier" : "maintain current sleep schedule"}, (2) aim for ${w?.steps ? Math.max(w.steps.weekAvg + 1000, 8000).toLocaleString() : "8,000"} steps daily, (3) incorporate 5-10 minutes of stress-reduction (deep breathing, short walk). Small, consistent changes compound over time.`,
        confidence: 0.88,
      };
    },

    // ── Nutritionist ──
    nutrition: (round) => {
      if (round === 1) {
        const sleepDietLink = w?.sleep
          ? w.sleep.duration < 6
            ? `Sleep deprivation of only ${w.sleep.duration} hours often drives increased cortisol, which triggers cravings for high-sugar, high-fat foods. This creates a metabolic stress cycle.`
            : `With ${w.sleep.duration} hours of sleep, your metabolic hormones (leptin, ghrelin) should be reasonably balanced.`
          : "";

        const stepsCalorie = w?.steps
          ? `At ${w.steps.today.toLocaleString()} steps, your estimated additional caloric expenditure is roughly ${Math.round(w.steps.today * 0.04)} kcal. ${w.steps.today > 8000 ? "Make sure you're fueling adequately for this activity level." : "Consider whether reduced activity is linked to energy intake patterns."}`
          : "";

        const oxygenNote = w?.bloodOxygen !== undefined
          ? w.bloodOxygen < 95
            ? `Blood oxygen at ${w.bloodOxygen}% is below optimal. Iron-rich foods (leafy greens, legumes, lean red meat) and vitamin C for absorption could help if this isn't a respiratory issue.`
            : `Blood oxygen at ${w.bloodOxygen}% is normal — no immediate nutritional red flags there.`
          : "";

        return {
          en: `From a nutritional standpoint regarding "${symptoms}": ${sleepDietLink} ${stepsCalorie} ${oxygenNote} Key dietary focus areas: ensure adequate hydration (minimum 2L/day), consider anti-inflammatory foods if chronic symptoms are present, and maintain regular meal timing to stabilize blood sugar.`,
          confidence: 0.80,
        };
      }

      if (round === 2) {
        const mentalRef = previousMessages.find((m) => m.agentId === "mental");
        return {
          en: `Building on the panel's insights — ${mentalRef ? "the Mental Wellness specialist's point about stress is critical from a nutritional angle. Chronic stress depletes B vitamins, magnesium, and vitamin C." : "I want to highlight the gut-brain axis connection."} ${w?.heartRate && w.heartRate.resting > 75 ? `The elevated resting heart rate of ${w.heartRate.resting}bpm could benefit from magnesium-rich foods (dark chocolate, almonds, avocados) and omega-3 fatty acids.` : "Heart rate data looks stable from a nutritional perspective."} I'd also recommend tracking meal timing against sleep quality — many users see improvements by finishing their last meal 3 hours before bed.`,
          confidence: 0.83,
        };
      }

      return {
        en: `Final nutritional recommendations: (1) Prioritize anti-inflammatory foods — berries, fatty fish, leafy greens, turmeric; (2) ${w?.sleep && w.sleep.duration < 7 ? "Add tryptophan-rich foods in the evening (turkey, bananas, warm milk) to support sleep" : "Maintain balanced macronutrient ratios at each meal"}; (3) Consider magnesium supplementation (200-400mg at bedtime) given the stress and sleep data. These changes should show measurable improvements within 2-3 weeks.`,
        confidence: 0.86,
      };
    },

    // ── Sleep Expert ──
    sleep: (round) => {
      if (round === 1) {
        if (!w?.sleep) {
          return {
            en: `No sleep data available for analysis. I strongly recommend connecting a wearable device that tracks sleep stages. Without sleep data, I can only note that the reported symptoms of "${symptoms}" could have a significant sleep component. ${w?.heartRate ? `The resting heart rate of ${w.heartRate.resting}bpm ${w.heartRate.resting > 75 ? "suggests possible sleep disruption or autonomic imbalance" : "doesn't immediately suggest sleep issues"}.` : ""}`,
            confidence: 0.55,
          };
        }

        const sleepDur = w.sleep.duration;
        const deepPct = ((w.sleep.deepSleep / sleepDur) * 100).toFixed(0);
        const remPct = ((w.sleep.remSleep / sleepDur) * 100).toFixed(0);
        const deepIdeal = sleepDur >= 7 ? (sleepDur * 0.2).toFixed(1) : "1.5-2.0";

        const assessment = sleepDur < 5
          ? "severely deficient"
          : sleepDur < 6
            ? "significantly below optimal"
            : sleepDur < 7
              ? "slightly below the recommended 7-9 hours"
              : "within a healthy range";

        const deepAnalysis = w.sleep.deepSleep < 1
          ? `Deep sleep of only ${w.sleep.deepSleep}h (${deepPct}%) is critically low. You should be getting at least ${deepIdeal}h. This affects physical recovery, immune function, and memory consolidation.`
          : w.sleep.deepSleep < 1.5
            ? `Deep sleep at ${w.sleep.deepSleep}h (${deepPct}%) is below ideal. Target is ${deepIdeal}h for proper cellular repair.`
            : `Deep sleep at ${w.sleep.deepSleep}h (${deepPct}%) is reasonable.`;

        const remAnalysis = w.sleep.remSleep < 1
          ? `REM sleep of ${w.sleep.remSleep}h (${remPct}%) is insufficient — this impacts emotional regulation and learning.`
          : `REM sleep at ${w.sleep.remSleep}h (${remPct}%) is ${parseFloat(remPct) >= 20 ? "healthy" : "slightly low"}.`;

        return {
          en: `Sleep analysis for "${symptoms}": Total sleep of ${sleepDur} hours is ${assessment}. ${deepAnalysis} ${remAnalysis} Quality rated "${w.sleep.quality}" — ${w.sleep.quality === "poor" || w.sleep.quality === "bad" ? "this is a major concern. Poor sleep quality multiplies health risks regardless of duration." : w.sleep.quality === "fair" ? "there's meaningful room for improvement here." : "this is encouraging."} ${w?.heartRate ? `Resting HR of ${w.heartRate.resting}bpm during the day ${w.heartRate.resting > 80 ? "suggests your body may not be achieving adequate parasympathetic recovery during sleep" : "is consistent with reasonable sleep recovery"}.` : ""}`,
          confidence: 0.90,
        };
      }

      if (round === 2) {
        const coachRef = previousMessages.find((m) => m.agentId === "coach");
        const stressComment = w?.stress
          ? `The stress level of ${w.stress}/100 directly impacts sleep onset latency and sleep architecture. ${w.stress > 60 ? "This is almost certainly fragmenting deep sleep cycles." : "This moderate level shouldn't be a primary sleep disruptor."}`
          : "";

        return {
          en: `${coachRef ? "The Health Coach's point about consistency is spot-on from a circadian perspective — irregular sleep schedules are as damaging as short sleep." : "I want to add a circadian rhythm perspective."} ${stressComment} ${w?.sleep ? `Looking at the sleep architecture ratio: ${w.sleep.deepSleep}h deep vs ${w.sleep.remSleep}h REM — ${w.sleep.deepSleep > w.sleep.remSleep ? "your body is prioritizing physical recovery over cognitive processing" : "the balance suggests cognitive processing demand, possibly from stress or high mental load"}.` : ""} Key protocol: consistent wake time (even weekends), bright light exposure within 30 minutes of waking, and no screens 60 minutes before bed.`,
          confidence: 0.88,
        };
      }

      return {
        en: `Final sleep recommendations: ${w?.sleep ? `Given your ${w.sleep.duration}h total and ${w.sleep.quality} quality` : "Based on available data"}, implement the "10-3-2-1-0" rule: 10h before bed — no caffeine; 3h — no food; 2h — no work; 1h — no screens; 0 — the number of times you hit snooze. This simple framework addresses multiple sleep disruptors simultaneously.`,
        confidence: 0.91,
      };
    },

    // ── Mental Wellness ──
    mental: (round) => {
      if (round === 1) {
        const stressAssess = w?.stress !== undefined
          ? w.stress > 75
            ? `Your stress level of ${w.stress}/100 is in the high-risk zone. This significantly impacts cognitive function, emotional regulation, and physical health.`
            : w.stress > 50
              ? `Stress at ${w.stress}/100 is moderately elevated. This is the "yellow zone" — manageable but warrants attention before it escalates.`
              : `Stress level of ${w.stress}/100 is within a manageable range. Your nervous system appears to be coping well.`
          : "No direct stress measurement available.";

        const sleepMoodLink = w?.sleep
          ? `Sleep quality of "${w.sleep.quality}" with ${w.sleep.duration}h total directly impacts mood regulation. ${w.sleep.remSleep < 1.5 ? `Only ${w.sleep.remSleep}h of REM sleep is concerning — REM is critical for emotional processing and memory consolidation. This may contribute to irritability, difficulty concentrating, or emotional reactivity.` : "REM sleep appears adequate for basic emotional processing."}`
          : "";

        const hrAnxiety = w?.heartRate
          ? w.heartRate.resting > 80
            ? `Resting heart rate of ${w.heartRate.resting}bpm (max ${w.heartRate.max}bpm) could indicate chronic sympathetic nervous system activation — essentially, your body may be in a prolonged "fight or flight" state.`
            : `Resting heart rate of ${w.heartRate.resting}bpm suggests your autonomic nervous system is reasonably balanced.`
          : "";

        return {
          en: `Mental wellness assessment for "${symptoms}": ${stressAssess} ${sleepMoodLink} ${hrAnxiety} ${entries.length > 0 ? `Looking at your recent health entries, ${entries.filter(e => e.severity >= 6).length > 2 ? "the pattern of multiple high-severity entries is a flag for potential burnout or chronic stress accumulation" : "symptom severity has been mostly manageable"}.` : ""} I recommend monitoring your mood alongside physical symptoms — they're often more connected than people realize.`,
          confidence: 0.84,
        };
      }

      if (round === 2) {
        const triageRef = previousMessages.find((m) => m.agentId === "triage");
        const sleepRef = previousMessages.find((m) => m.agentId === "sleep");
        return {
          en: `${triageRef ? "I appreciate the Safety Triage's watchfulness. " : ""}${sleepRef ? "The Sleep Expert's analysis reinforces my concern — " : ""}The mind-body connection here is clear: ${w?.stress && w?.sleep ? `a stress level of ${w.stress}/100 paired with ${w.sleep.quality} sleep quality creates a vicious cycle. High stress disrupts sleep, and poor sleep amplifies stress perception by up to 60%.` : "stress and sleep quality are deeply interconnected, and addressing one usually improves the other."} I'd also flag that symptoms of "${symptoms}" can have a significant psychosomatic component — this doesn't mean they're "not real," but rather that addressing the psychological dimension often accelerates physical recovery.`,
          confidence: 0.86,
        };
      }

      return {
        en: `Final mental wellness perspective: the most impactful intervention is often the simplest. I recommend: (1) 5 minutes of box breathing (4-4-4-4 pattern) when stress peaks, (2) brief journaling before bed — even 3 sentences about your day, (3) ${w?.steps && w.steps.today < 5000 ? "a 20-minute walk — exercise is as effective as SSRIs for mild-moderate depression" : "maintaining your activity level, which is already supporting your mental health"}. Consider this panel discussion itself as a form of health awareness that benefits your psychological well-being.`,
        confidence: 0.87,
      };
    },

    // ── Safety Triage ──
    triage: (round) => {
      if (round === 1) {
        const alerts: string[] = [];

        if (w?.heartRate) {
          if (w.heartRate.resting > 100) {
            alerts.push(`ALERT: Resting heart rate of ${w.heartRate.resting}bpm exceeds 100bpm (tachycardia threshold). If persistent, seek medical evaluation.`);
          } else if (w.heartRate.resting < 50) {
            alerts.push(`ALERT: Resting heart rate of ${w.heartRate.resting}bpm is below 50bpm (bradycardia). Unless you're a trained athlete, this warrants investigation.`);
          }
          if (w.heartRate.max > 180) {
            alerts.push(`CAUTION: Max heart rate of ${w.heartRate.max}bpm is very high. Was this during intense exercise? If it occurred at rest, seek immediate evaluation.`);
          }
        }

        if (w?.bloodOxygen !== undefined) {
          if (w.bloodOxygen < 90) {
            alerts.push(`URGENT: Blood oxygen at ${w.bloodOxygen}% is critically low. Values below 90% require immediate medical attention. Go to an emergency room or call emergency services.`);
          } else if (w.bloodOxygen < 94) {
            alerts.push(`CAUTION: Blood oxygen at ${w.bloodOxygen}% is below normal range (95-100%). Monitor closely and consult a physician if it doesn't improve.`);
          }
        }

        if (w?.sleep && w.sleep.duration < 4) {
          alerts.push(`WARNING: Only ${w.sleep.duration} hours of sleep is severely inadequate. Chronic severe sleep deprivation increases risk of accidents, immune dysfunction, and cardiovascular events.`);
        }

        // Check recent entries for escalating severity
        const highSeverityEntries = entries.filter((e) => e.severity >= 7);
        if (highSeverityEntries.length >= 3) {
          alerts.push(`PATTERN ALERT: ${highSeverityEntries.length} recent entries with severity >= 7/10. This escalating pattern warrants professional medical evaluation.`);
        }

        if (alerts.length === 0) {
          return {
            en: `Safety triage for "${symptoms}": No immediate red flags detected in the available data. ${w?.heartRate ? `Heart rate range ${w.heartRate.min}-${w.heartRate.max}bpm with resting ${w.heartRate.resting}bpm is within acceptable bounds.` : ""} ${w?.bloodOxygen !== undefined ? `Blood oxygen at ${w.bloodOxygen}% is normal.` : ""} While no urgent issues are present, continue monitoring and report any sudden changes — especially chest pain, difficulty breathing, sudden severe headache, or vision changes.`,
            confidence: 0.92,
          };
        }

        return {
          en: `Safety triage for "${symptoms}":\n\n${alerts.join("\n\n")}\n\nIMPORTANT DISCLAIMER: This AI panel is for educational purposes only. It does not replace professional medical advice. If you're experiencing any of the flagged conditions, please consult a healthcare provider promptly.`,
          confidence: 0.95,
        };
      }

      if (round === 2) {
        return {
          en: `Reviewing the panel's findings from a safety perspective: ${previousMessages.some((m) => m.content.toLowerCase().includes("concern") || m.content.toLowerCase().includes("elevated") || m.content.toLowerCase().includes("low")) ? "Several panelists have flagged concerning patterns. While individual findings may be mild, the combination deserves attention." : "The panel consensus appears to indicate a stable health profile."} I want to reiterate: ${w?.heartRate && w.heartRate.resting > 85 ? `a resting heart rate consistently above 85bpm (yours: ${w.heartRate.resting}bpm) over time is an independent cardiovascular risk factor` : "current vitals are within safe ranges"}. No immediate emergency signals, but ${entries.length > 0 && entries.some((e) => e.severity >= 6) ? "the recurring symptom pattern should not be ignored — schedule a check-up within the next 2 weeks" : "maintain regular check-ups as preventive care"}.`,
          confidence: 0.90,
        };
      }

      return {
        en: `Final safety assessment: Current status — ${w?.bloodOxygen !== undefined && w.bloodOxygen < 94 ? "CAUTION ADVISED" : "STABLE, NO IMMEDIATE RISK"}. Continue monitoring all wearable metrics. Red flags to watch for: (1) resting heart rate suddenly exceeding 100bpm or dropping below 50bpm, (2) blood oxygen below 94%, (3) sudden severe symptoms not previously reported. Remember: this panel provides health insights, not medical diagnoses. When in doubt, see a doctor.`,
        confidence: 0.93,
      };
    },

    // ── Moderator ──
    moderator: (round) => {
      if (round === 1) {
        return {
          en: `Welcome to the Health Panel Discussion. I'm your moderator, and I'll be coordinating our ${DEBATE_AGENTS.length - 1} specialists as they analyze the health data for "${symptoms}". ${w ? "We have wearable data available, which will give our panel concrete numbers to work with." : "No wearable data was provided, so our analysis will be based on reported symptoms."} ${entries.length > 0 ? `We also have ${entries.length} recent health entries for context.` : ""} Let me set the stage: each specialist will now share their initial assessment, focusing on their area of expertise. Specialists — please reference specific data points in your analysis.`,
          confidence: 0.90,
        };
      }

      if (round === 2) {
        const agentNames = previousMessages
          .filter((m) => m.round === 1 && m.agentId !== "moderator")
          .map((m) => m.agentName);

        return {
          en: `Excellent initial assessments from ${agentNames.join(", ")}. I'm noticing several cross-cutting themes: ${w?.sleep && w.sleep.duration < 7 ? "(1) Sleep is a recurring concern across multiple specialists — this seems to be a foundational issue. " : ""}${w?.stress && w.stress > 50 ? "(2) The stress-health feedback loop was highlighted by both Mental Wellness and the Sleep Expert. " : ""}${w?.heartRate && w.heartRate.resting > 75 ? "(3) The slightly elevated resting heart rate has both nutritional and mental health dimensions. " : ""}Specialists — for Round 2, please respond to each other's findings. Where do you agree? Where do you see things differently? And what connections might we be missing?`,
          confidence: 0.88,
        };
      }

      // Round 3 — Final synthesis
      const allAgentMessages = previousMessages.filter((m) => m.agentId !== "moderator");
      const hasAlerts = allAgentMessages.some(
        (m) => m.agentId === "triage" && (m.content.includes("ALERT") || m.content.includes("URGENT") || m.content.includes("CAUTION"))
      );

      return {
        en: `PANEL SYNTHESIS — Final Summary for "${symptoms}"\n\n${hasAlerts ? "SAFETY NOTE: Our Triage specialist has flagged concerns that should be addressed with a healthcare provider.\n\n" : ""}After ${previousMessages.length} exchanges across our panel of ${DEBATE_AGENTS.length - 1} specialists, here is the consensus:\n\n${w?.sleep && w.sleep.duration < 7 ? "1. SLEEP is the highest-priority area. Multiple specialists agree that improving sleep duration and quality would have cascading positive effects on other health dimensions.\n" : ""}${w?.stress && w.stress > 50 ? "2. STRESS MANAGEMENT is essential. The stress-sleep-mood triangle needs to be addressed holistically rather than in isolation.\n" : ""}${w?.steps && w.steps.today < 7000 ? "3. PHYSICAL ACTIVITY could be increased to support both physical recovery and mental health.\n" : ""}${w?.heartRate && w.heartRate.resting > 75 ? "4. HEART RATE monitoring should continue — the slightly elevated resting rate may normalize as sleep and stress improve.\n" : ""}\nThe panel recommends starting with the intervention that feels most achievable. Small wins build momentum. Track your progress using this app and come back for another panel review in 1-2 weeks.`,
        confidence: 0.92,
      };
    },
  };

  const gen = generators[agent.id];
  if (!gen) {
    return {
      content: `[${agent.name}] Analysis in progress...`,
      confidence: 0.5,
    };
  }

  const result = gen(round);
  return {
    content: result.en,
    confidence: result.confidence,
  };
}

// ── Consensus & Insights Generator ──

function generateConsensus(
  context: DebateContext,
  messages: DebateMessage[]
): { consensus: string; keyInsights: string[] } {
  const w = context.wearableData;
  const insights: string[] = [];

  // Sleep insight
  if (w?.sleep) {
    if (w.sleep.duration < 7) {
      insights.push(`Sleep duration of ${w.sleep.duration}h is below the recommended 7-9 hours — this was identified as the top priority by the panel.`);
    }
    if (w.sleep.deepSleep < 1.5) {
      insights.push(`Deep sleep of ${w.sleep.deepSleep}h is insufficient for optimal physical recovery.`);
    }
  }

  // Stress insight
  if (w?.stress !== undefined && w.stress > 50) {
    insights.push(`Stress level of ${w.stress}/100 is creating a negative feedback loop with sleep and recovery.`);
  }

  // Heart rate insight
  if (w?.heartRate && w.heartRate.resting > 75) {
    insights.push(`Resting heart rate of ${w.heartRate.resting}bpm is slightly elevated and should be monitored.`);
  }

  // Activity insight
  if (w?.steps) {
    if (w.steps.today < 5000) {
      insights.push(`Step count of ${w.steps.today.toLocaleString()} is well below the 7,000+ daily target.`);
    }
  }

  // Blood oxygen insight
  if (w?.bloodOxygen !== undefined && w.bloodOxygen < 95) {
    insights.push(`Blood oxygen at ${w.bloodOxygen}% is below the healthy threshold of 95% and requires attention.`);
  }

  // General insights from symptoms
  if (context.userSymptoms) {
    insights.push(`Reported symptoms ("${context.userSymptoms}") should be tracked over time for pattern detection.`);
  }

  // If no specific insights, add general ones
  if (insights.length === 0) {
    insights.push("Overall health metrics are within acceptable ranges. Continue regular monitoring.");
    insights.push("Consider connecting wearable devices for more detailed health analysis.");
  }

  // Build consensus text
  const consensusItems: string[] = [];

  if (w?.sleep && w.sleep.duration < 7) {
    consensusItems.push("prioritize sleep improvement as the foundation for overall health");
  }
  if (w?.stress && w.stress > 50) {
    consensusItems.push("implement daily stress management techniques");
  }
  if (w?.steps && w.steps.today < 7000) {
    consensusItems.push("gradually increase daily physical activity");
  }

  consensusItems.push("continue tracking health metrics and return for follow-up analysis");

  const consensus = `The panel of ${DEBATE_AGENTS.length - 1} health specialists reached consensus on the following action items: ${consensusItems.map((item, i) => `(${i + 1}) ${item}`).join(", ")}. The most impactful single change identified is ${w?.sleep && w.sleep.duration < 7 ? "improving sleep quality and duration" : w?.stress && w.stress > 50 ? "reducing chronic stress levels" : "maintaining consistent healthy habits"}.`;

  return { consensus, keyInsights: insights };
}

// ── Debate Topic Generator ──

function generateDebateTopic(context: DebateContext): string {
  if (context.userSymptoms) {
    return `Health Panel Analysis: ${context.userSymptoms}`;
  }
  if (context.wearableData) {
    const issues: string[] = [];
    if (context.wearableData.sleep && context.wearableData.sleep.duration < 7) issues.push("sleep patterns");
    if (context.wearableData.stress && context.wearableData.stress > 50) issues.push("stress levels");
    if (context.wearableData.heartRate && context.wearableData.heartRate.resting > 75) issues.push("heart rate");
    if (context.wearableData.steps && context.wearableData.steps.today < 5000) issues.push("activity levels");
    if (issues.length > 0) return `Wearable Data Review: ${issues.join(", ")}`;
  }
  return "General Wellness Panel Review";
}

// ── Main Debate Runner ──

export async function runDebate(
  userId: string,
  context: DebateContext,
  rounds: number = 3
): Promise<DebateResult> {
  const debateId = randomUUID();
  const messages: DebateMessage[] = [];
  const topic = generateDebateTopic(context);

  // Clamp rounds to 1-5
  rounds = Math.max(1, Math.min(5, rounds));

  // Define participation order per round
  // Round 1: Moderator intro, then all specialists
  // Round 2: All specialists respond to each other, then moderator
  // Round 3: Moderator synthesis first, then specialists add final thoughts

  for (let round = 1; round <= rounds; round++) {
    let agentOrder: string[];

    switch (round) {
      case 1:
        agentOrder = ["moderator", "coach", "nutrition", "sleep", "mental", "triage"];
        break;
      case 2:
        agentOrder = ["coach", "nutrition", "sleep", "mental", "triage", "moderator"];
        break;
      default: // Round 3+
        agentOrder = ["moderator", "coach", "nutrition", "sleep", "mental", "triage"];
        break;
    }

    for (const agentId of agentOrder) {
      const agent = getAgent(agentId);
      const response = await generateAgentResponse(agent, context, messages, round);

      // Determine replyTo: in round 2+, reference the most relevant prior speaker
      let replyTo: string | undefined;
      if (round >= 2 && agentId !== "moderator") {
        // Each specialist replies to the specialist who mentioned something relevant to their field
        const otherMessages = messages.filter(
          (m) => m.agentId !== agentId && m.round === round - 1
        );
        if (otherMessages.length > 0) {
          // Simple heuristic: reply to the last speaker from previous round that isn't self
          replyTo = otherMessages[otherMessages.length - 1].agentId;
        }
      }

      messages.push({
        agentId: agent.id,
        agentName: agent.name,
        emoji: agent.emoji,
        content: response.content,
        replyTo,
        confidence: response.confidence,
        timestamp: Date.now(),
        round,
      });
    }
  }

  // Generate consensus and key insights
  const { consensus, keyInsights } = generateConsensus(context, messages);

  // L2E: Learn to Earn — 15 points for watching a full debate
  const pointsEarned = 15;

  return {
    id: debateId,
    topic,
    context,
    messages,
    consensus,
    keyInsights,
    pointsEarned,
    totalRounds: rounds,
  };
}

// ── Exported agent list (for frontend) ──

export function getDebateAgents(): Array<{
  id: string;
  name: string;
  emoji: string;
  specialty: string;
}> {
  return DEBATE_AGENTS.map(({ id, name, emoji, specialty }) => ({
    id,
    name,
    emoji,
    specialty,
  }));
}

export type { DebateAgent, DebateMessage, DebateContext, DebateResult };
