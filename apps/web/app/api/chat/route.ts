import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { agents, buildPersonalizedPrompt, UserContext } from '@/lib/agents';
import { createEncounter } from '@/lib/fhir';

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});

const XAI_MODEL = process.env.XAI_MODEL || 'grok-4-fast-non-reasoning';

// Each agent uses tuned parameters for its domain
const AGENT_MODELS: Record<string, { model: string; temperature: number; maxTokens: number }> = {
  nurse: {
    model: XAI_MODEL,
    temperature: 0.75,
    maxTokens: 1024,
  },
  gatekeeper: {
    model: XAI_MODEL,
    temperature: 0.3,
    maxTokens: 1200,
  },
  nutritionist: {
    model: XAI_MODEL,
    temperature: 0.6,
    maxTokens: 1024,
  },
  mindcare: {
    model: XAI_MODEL,
    temperature: 0.8,
    maxTokens: 1024,
  },
};

const DEFAULT_MODEL = { model: XAI_MODEL, temperature: 0.7, maxTokens: 1024 };

// ── Extract meals + nutrition from a user chat message (for AI Nutritionist) ──
// Detects mentions like "had a chicken salad for lunch", "ate pizza for dinner", etc.
// Returns an array of { mealType, description, calories, protein, carbs, fat }.
type ExtractedMeal = {
  mealType: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

// Repair common JSON glitches the LLM sometimes produces (trailing quotes, commas, etc.)
function tryParseJson(raw: string): any | null {
  if (!raw) return null;
  // Strip code fences
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Pull out the outermost JSON object
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) cleaned = m[0];

  // Attempt 1: direct parse
  try { return JSON.parse(cleaned); } catch {}

  // Attempt 2: fix common artifacts
  let repaired = cleaned
    // remove dangling quotes right before closing brace/bracket: `5"}` → `5}`
    .replace(/(\d|true|false|null)"\s*([}\]])/g, '$1$2')
    // remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, '$1')
    // collapse runs of double quotes
    .replace(/""+/g, '"');
  try { return JSON.parse(repaired); } catch {}

  // Attempt 3: extract just the meals array, then build minimal JSON
  const arrMatch = repaired.match(/"meals"\s*:\s*(\[[\s\S]*?\])/);
  if (arrMatch) {
    try { return { meals: JSON.parse(arrMatch[1]) }; } catch {}
  }
  return null;
}

async function extractMealsFromMessage(userMessage: string, history: { role: string; content: string }[] = []): Promise<ExtractedMeal[]> {
  if (!userMessage?.trim()) return [];
  const apiKeyAvailable = !!(process.env.XAI_API_KEY || process.env.GROQ_API_KEY);
  if (!apiKeyAvailable) return [];

  // Quick gate: if the message clearly has no food-talk keywords, skip the LLM call.
  const foodHints = /\b(ate|eat|eaten|eating|had|having|breakfast|lunch|dinner|snack|meal|brunch|drank|drink|drinking|salad|pizza|bread|rice|chicken|beef|pork|fish|coffee|tea|smoothie|juice|toast|egg|eggs|milk|yogurt|cereal|sandwich|burger|pasta|steak|sushi|ramen|noodle|noodles|soup|stew|fruit|vegetables|protein|cookie|cake|chocolate|water|wine|beer|cheese|butter|oatmeal|granola|bagel|wrap|taco|burrito|pho|curry|kebab)\b/i;
  if (!foodHints.test(userMessage)) return [];

  // Provide a tiny history window so multi-turn meal logging keeps context (e.g. "and also eggs" right after talking about breakfast)
  const recentTurns = history.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content.slice(0, 200)}`).join('\n');

  const systemPrompt =
    'You extract meals the user has ALREADY EATEN from their LATEST message. ' +
    'Respond with ONLY a JSON object: {"meals":[{"mealType":"breakfast|lunch|dinner|snack","description":"...","calories":<int>,"protein":<int>,"carbs":<int>,"fat":<int>}]}. ' +
    'Rules:\n' +
    '1) Extract ONLY consumed meals (past tense / just now). Skip questions, future plans, recipes.\n' +
    '2) Each distinct meal occasion = one entry. Items eaten together = one entry with combined description.\n' +
    '3) If the LATEST user message references the SAME meal as the previous turn (e.g. "and I also had eggs" right after talking about breakfast), use that same mealType. Otherwise, infer from explicit time words ("breakfast", "lunch", "dinner", "snack"), then from the current local time: 6-10am=breakfast, 11am-2pm=lunch, 5-9pm=dinner, otherwise=snack.\n' +
    '4) Calories/protein/carbs/fat must be realistic integers based on typical portion sizes. Never quote numbers — write them as bare numbers.\n' +
    '5) If NO meal was consumed in the latest message, return {"meals":[]}.';

  try {
    const completion = await xai.chat.completions.create({
      model: XAI_MODEL,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' as const },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            `Current time (UTC): ${new Date().toISOString()}\n` +
            (recentTurns ? `Recent conversation (for context only, do NOT extract from these):\n${recentTurns}\n\n` : '') +
            `LATEST user message to extract from:\n${userMessage}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = tryParseJson(raw);
    if (!parsed?.meals || !Array.isArray(parsed.meals)) {
      if (raw) console.warn('Meal extraction: unparseable output:', raw.slice(0, 200));
      return [];
    }

    const round = (v: any) => {
      if (typeof v === 'string') v = parseInt(v, 10);
      return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.round(v) : null;
    };
    const validTypes = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

    return parsed.meals
      .filter((m: any) => m && typeof m.description === 'string' && m.description.trim().length > 0)
      .map((m: any) => ({
        mealType: validTypes.has(m.mealType) ? m.mealType : 'snack',
        description: String(m.description).trim().slice(0, 200),
        calories: round(m.calories),
        protein: round(m.protein),
        carbs: round(m.carbs),
        fat: round(m.fat),
      }))
      .slice(0, 5);
  } catch (err) {
    console.error('Meal extraction failed:', (err as any)?.message || err);
    return [];
  }
}

interface ChatRequest {
  message: string;
  agentType: string;
  conversationId?: string;
}

// Fetch user context from database
async function fetchUserContext(userId: string): Promise<UserContext | undefined> {
  try {
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        chronicConditions: { where: { isActive: true } },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            messages: {
              where: { role: 'user' },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!userProfile) return undefined;

    const chronicConditions = userProfile.chronicConditions.map(c => ({
      code: c.conditionCode,
      name: c.conditionName,
    }));

    const recentTopics: string[] = [];
    for (const conv of userProfile.conversations) {
      if (conv.messages.length > 0) {
        const firstMsg = conv.messages[0].content;
        recentTopics.push(firstMsg.length > 80 ? firstMsg.substring(0, 80) + '...' : firstMsg);
      }
    }

    // Prefer the user's chosen nickname; fall back to a friendly default.
    // Never expose the wallet address in conversation.
    const username =
      (userProfile.displayName && userProfile.displayName.trim()) ||
      'there';

    return {
      username,
      age: userProfile.age || 0,
      heightCm: userProfile.heightCm || 170,
      weightKg: userProfile.weightKg || 70,
      chronicConditions,
      recentTopics,
      conversationCount: userProfile.conversations.length,
      memberSince: new Date(userProfile.createdAt).toLocaleDateString(),
    };
  } catch (error) {
    console.error('Error fetching user context:', error);
    return undefined;
  }
}

// ── Fetch today's health logs for AI context ──
async function fetchTodayLogs(userId: string): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const where = { userId, createdAt: { gte: today, lt: tomorrow } };

  const [water, meals, exercises, sleeps, moods, meditations] = await Promise.all([
    prisma.waterLog.aggregate({ where, _sum: { amountMl: true }, _count: true }),
    prisma.mealLog.findMany({ where: { ...where }, orderBy: { createdAt: 'asc' } }),
    prisma.exerciseLog.findMany({ where: { ...where }, orderBy: { createdAt: 'asc' } }),
    prisma.sleepLog.findMany({ where: { ...where }, take: 1, orderBy: { createdAt: 'desc' } }),
    prisma.moodLog.findMany({ where: { ...where }, orderBy: { createdAt: 'desc' }, take: 3 }),
    prisma.meditationLog.findMany({ where: { ...where }, orderBy: { createdAt: 'desc' } }),
  ]);

  let context = `\n\n--- TODAY'S HEALTH LOG (${new Date().toLocaleDateString()}) ---`;
  context += `\nWater: ${water._sum.amountMl || 0}ml (${water._count} cups) — goal: 2000ml`;

  if (meals.length > 0) {
    context += `\nMeals (${meals.length}):`;
    meals.forEach(m => {
      context += `\n  • ${m.mealType}: ${m.description}${m.calories ? ` (${m.calories} kcal)` : ''}`;
    });
    const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
    if (totalCal > 0) context += `\n  Total calories: ${totalCal} kcal`;
  } else {
    context += `\nMeals: No meals logged yet today.`;
  }

  if (exercises.length > 0) {
    context += `\nExercise:`;
    exercises.forEach(e => {
      context += `\n  • ${e.exerciseType}: ${e.durationMin} min${e.distanceKm ? ` (${e.distanceKm} km)` : ''}`;
    });
    context += `\n  Total: ${exercises.reduce((s, e) => s + e.durationMin, 0)} min`;
  } else {
    context += `\nExercise: None logged today.`;
  }

  if (sleeps.length > 0) {
    const s = sleeps[0];
    const hours = Math.round((new Date(s.wakeTime).getTime() - new Date(s.bedtime).getTime()) / 3600000 * 10) / 10;
    context += `\nSleep: ${hours}h (quality: ${s.quality || 'N/A'}/5)`;
  } else {
    context += `\nSleep: Not logged today.`;
  }

  if (moods.length > 0) {
    const moodEmojis = ['', '😫', '😟', '😐', '🙂', '😄'];
    context += `\nMood: ${moodEmojis[moods[0].score]} (${moods[0].score}/5)`;
    if (moods[0].note) context += ` — "${moods[0].note}"`;
  } else {
    context += `\nMood: Not logged today.`;
  }

  if (meditations.length > 0) {
    const totalMin = meditations.reduce((s, m) => s + m.durationMin, 0);
    context += `\nMeditation: ${totalMin} min today (${meditations.length} sessions)`;
  }

  context += `\n\nIMPORTANT: Use this data proactively. Comment on what the user has or hasn't logged. Offer specific advice based on their actual data. If something is missing, gently encourage them to log it.`;

  return context;
}

// ── Domain Guard: each agent only answers questions in its specialty ──
const AGENT_DOMAINS: Record<string, { keywords: RegExp; scope: string; redirect: Record<string, string> }> = {
  nurse: {
    keywords: /sleep|stress|habit|tired|fatigue|exercise|routine|check.?in|mood|energy|lifestyle|medication|weight|walk|walking|jog|running|hike|gym|workout|yoga|stretch|cycling|biking/i,
    scope: 'wellness, lifestyle coaching, daily health check-ins, habit tracking, and general health questions',
    redirect: {
      gatekeeper: 'For symptom triage and hospital guidance, please switch to **AI Gatekeeper**.',
      nutritionist: 'For diet and meal planning, please switch to **AI Nutritionist**.',
      mindcare: 'For mental health and emotional support, please switch to **AI Mind Care**.',
    },
  },
  gatekeeper: {
    keywords: /pain|symptom|hurt|ache|sore|fever|bleed|swollen|numb|dizzy|vomit|nausea|rash|emergency|hospital|doctor|cough|runny|throat|stomach|headache|migraine|cramp|injury|sprain/i,
    scope: 'symptom triage, urgency classification, hospital department recommendation, and emergency guidance',
    redirect: {
      nurse: 'For wellness coaching and daily check-ins, please switch to **AI Nurse**.',
      nutritionist: 'For nutrition advice and meal planning, please switch to **AI Nutritionist**.',
      mindcare: 'For emotional support and stress management, please switch to **AI Mind Care**.',
    },
  },
  nutritionist: {
    keywords: /food|eat|ate|diet|meal|nutrition|calorie|recipe|cook|vitamin|protein|carb|fat|supplement|breakfast|lunch|dinner|snack|hungry|drink|drank/i,
    scope: 'diet planning, nutrition guidance, meal recommendations, and dietary analysis',
    redirect: {
      nurse: 'For wellness coaching and health check-ins, please switch to **AI Nurse**.',
      gatekeeper: 'For symptom assessment and hospital guidance, please switch to **AI Gatekeeper**.',
      mindcare: 'For emotional support and stress management, please switch to **AI Mind Care**.',
    },
  },
  mindcare: {
    keywords: /anxious|anxiety|depress|sad|lonely|stress|emotion|feel|feeling|mental|therapy|mindful|breath|meditat|panic|cry|overwhelm|burnout|grief|worried|nervous/i,
    scope: 'mental wellness, stress management, emotional support, mindfulness, and mood tracking',
    redirect: {
      nurse: 'For physical health check-ins and lifestyle coaching, please switch to **AI Nurse**.',
      gatekeeper: 'For symptom assessment and hospital guidance, please switch to **AI Gatekeeper**.',
      nutritionist: 'For diet and nutrition advice, please switch to **AI Nutritionist**.',
    },
  },
};

function detectBestAgent(message: string): string | null {
  const scores: Record<string, number> = {};
  for (const [agentId, domain] of Object.entries(AGENT_DOMAINS)) {
    const matches = message.match(domain.keywords);
    scores[agentId] = matches ? matches.length : 0;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) return best[0];
  return null;
}

// ── Call xAI (Grok) API with domain guard ──
async function callGroqAI(
  agentType: string,
  message: string,
  history: { role: string; content: string }[],
  userContext?: UserContext,
  userId?: string
): Promise<{ response: string; metadata?: any; redirectTo?: string }> {
  const agent = agents[agentType];
  if (!agent) return { response: "I'm not sure how to help with that. Could you try again?" };

  // Domain guard: reject off-topic questions before calling LLM
  const domain = AGENT_DOMAINS[agentType];
  const isGreeting = /^(hi|hello|hey|good\s*morning|good\s*afternoon|good\s*evening|howdy|sup)\b/i.test(message.trim());
  const isFollowUp = history.length > 0;

  if (domain && !isGreeting && !isFollowUp) {
    const bestAgent = detectBestAgent(message);
    if (bestAgent && bestAgent !== agentType && domain.redirect[bestAgent]) {
      return {
        response: `That question is outside my specialty. I'm focused on **${domain.scope}**.\n\n${domain.redirect[bestAgent]}\n\nYou can switch agents using the tabs at the top.`,
        redirectTo: bestAgent,
      };
    }
  }

  let systemPrompt = userContext
    ? buildPersonalizedPrompt(agent.systemPrompt, userContext)
    : agent.systemPrompt;

  // Inject today's health log data
  if (userId) {
    const todayLogs = await fetchTodayLogs(userId);
    systemPrompt += todayLogs;
  }

  // Add domain boundary to system prompt so LLM also enforces it
  const boundedPrompt = systemPrompt + `\n\n--- DOMAIN BOUNDARY ---\nYour specialty is: ${domain?.scope || 'general health'}.\nIf the user asks something clearly outside your domain, politely tell them which agent to use instead:\n- Physical symptoms/triage → AI Gatekeeper\n- Diet/nutrition/meals → AI Nutritionist\n- Mental health/emotions → AI Mind Care\n- Wellness/lifestyle/habits → AI Nurse\nDo NOT attempt to answer questions outside your specialty. Redirect the user.`;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: boundedPrompt },
  ];

  for (const msg of history.slice(-10)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  messages.push({ role: 'user', content: message });

  try {
    const modelConfig = AGENT_MODELS[agentType] || DEFAULT_MODEL;
    const completion = await xai.chat.completions.create({
      model: modelConfig.model,
      messages,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
      top_p: 0.9,
    });

    const responseText = completion.choices[0]?.message?.content || "I'm having trouble responding right now.";

    let metadata: any = undefined;
    if (agentType === 'gatekeeper') {
      metadata = extractTriageMetadata(responseText);
    }

    return { response: responseText, metadata };
  } catch (error: any) {
    console.error('xAI API error:', error?.message || error);
    return {
      response: "I'm experiencing a brief connection issue. Please try again in a moment.",
    };
  }
}

// Extract triage metadata from gatekeeper responses
function extractTriageMetadata(text: string): any | undefined {
  const lower = text.toLowerCase();
  let triageLevel: string | undefined;
  let department: string | undefined;

  if (lower.includes('emergency') || lower.includes('🔴') || lower.includes('call 119') || lower.includes('call 911')) {
    triageLevel = 'emergency';
  } else if (lower.includes('urgent') || lower.includes('🟠') || lower.includes('er ')) {
    triageLevel = 'urgent';
  } else if (lower.includes('routine') || lower.includes('🟡') || lower.includes('clinic')) {
    triageLevel = 'routine';
  } else if (lower.includes('self-care') || lower.includes('🟢') || lower.includes('rest')) {
    triageLevel = 'self-care';
  }

  const deptPatterns = [
    { pattern: /cardiology|cardiac/i, dept: 'Cardiology' },
    { pattern: /neurology|neural/i, dept: 'Neurology' },
    { pattern: /gastro/i, dept: 'Gastroenterology' },
    { pattern: /derma|skin/i, dept: 'Dermatology' },
    { pattern: /orthop|bone|joint/i, dept: 'Orthopedics' },
    { pattern: /internal/i, dept: 'Internal Medicine' },
    { pattern: /psych|mental/i, dept: 'Psychiatry' },
    { pattern: /ent|ear|nose|throat/i, dept: 'ENT' },
    { pattern: /ophthal|eye|vision/i, dept: 'Ophthalmology' },
  ];

  for (const { pattern, dept } of deptPatterns) {
    if (pattern.test(text)) {
      department = dept;
      break;
    }
  }

  if (triageLevel) {
    const riskScores: Record<string, number> = { emergency: 9, urgent: 7, routine: 4, 'self-care': 2 };
    return { triageLevel, department, riskScore: riskScores[triageLevel] || 3 };
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    let { message, agentType, conversationId } = body;

    if (!message || !agentType) {
      return NextResponse.json({ error: 'Message and agentType are required' }, { status: 400 });
    }

    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Smart routing: when caller passes agentType="auto" (e.g. Telegram bot),
    // pick the most relevant agent based on message keywords. Default to nurse if unsure.
    let routedFromAuto = false;
    if (agentType === 'auto') {
      routedFromAuto = true;
      const detected = detectBestAgent(message);
      agentType = detected || 'nurse';
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { profileComplete: true },
    });
    if (!dbUser || !dbUser.profileComplete) {
      return NextResponse.json(
        { error: 'Profile not complete.', code: 'PROFILE_INCOMPLETE' },
        { status: 403 }
      );
    }

    let dbConversationId: string | null = null;
    let history: { role: string; content: string }[] = [];

    const userContext = await fetchUserContext(user.userId);

    const isValidUUID = conversationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);

    if (isValidUUID) {
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.userId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });
      if (conv) {
        dbConversationId = conv.id;
        history = conv.messages.map(m => ({ role: m.role, content: m.content }));
      }
    }

    if (!dbConversationId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingToday = await prisma.conversation.findFirst({
        where: { userId: user.userId, agentType, createdAt: { gte: today } },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
        orderBy: { createdAt: 'desc' },
      });

      if (existingToday) {
        dbConversationId = existingToday.id;
        history = existingToday.messages.map(m => ({ role: m.role, content: m.content }));
      } else {
        const conv = await prisma.conversation.create({
          data: { userId: user.userId, agentType },
        });
        dbConversationId = conv.id;
      }
    }

    await prisma.message.create({
      data: {
        conversationId: dbConversationId,
        role: 'user',
        content: message,
        agentType,
      },
    });

    // Call chat AI and (for nutritionist) meal extraction in parallel
    const isNutritionist = agentType === 'nutritionist';
    const [result, extractedMealsRaw] = await Promise.all([
      callGroqAI(agentType, message, history, userContext, user.userId),
      isNutritionist ? extractMealsFromMessage(message, history).catch(() => []) : Promise.resolve([] as ExtractedMeal[]),
    ]);

    await prisma.message.create({
      data: {
        conversationId: dbConversationId,
        role: 'assistant',
        content: result.response,
        agentType,
        metadata: result.metadata || undefined,
      },
    });

    await prisma.userAgent.updateMany({
      where: { userId: user.userId, agentType },
      data: {
        totalMessages: { increment: 2 },
        lastInteraction: new Date(),
      },
    });

    if (result.metadata?.triageLevel) {
      await prisma.healthRecord.create({
        data: {
          userId: user.userId,
          resourceType: 'Encounter',
          fhirResource: createEncounter({
            patientId: user.userId,
            agentType,
            triageLevel: result.metadata.triageLevel,
            department: result.metadata.department,
          }),
          sourceAgent: agentType,
          sourceConversationId: dbConversationId,
        },
      });
    }

    // Persist any meals extracted in parallel above
    let savedMeals: any[] = [];
    if (extractedMealsRaw.length > 0) {
      try {
        savedMeals = await Promise.all(
          extractedMealsRaw.map(m =>
            prisma.mealLog.create({
              data: {
                userId: user.userId,
                mealType: m.mealType,
                description: m.description,
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
              },
            })
          )
        );
      } catch (err) {
        console.error('Auto meal-log failed:', (err as any)?.message || err);
      }
    }

    return NextResponse.json({
      ...result,
      conversationId: dbConversationId,
      savedMeals,
      // Tell the caller which agent actually handled this — useful for Telegram/auto routing
      agentType,
      routedFromAuto,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
