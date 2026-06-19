import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { checkAndAwardStreakRewards } from '@/lib/points';
import { onMealLogged } from '@/lib/push-triggers';

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4-fast-non-reasoning';

// Estimate calories + macros from a free-form meal description (English).
async function estimateNutrition(mealType: string, description: string) {
  if (!description?.trim()) return {};
  if (!process.env.XAI_API_KEY && !process.env.GROQ_API_KEY) return {};

  try {
    const completion = await xai.chat.completions.create({
      model: XAI_MODEL,
      temperature: 0.2,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'You estimate nutrition for meals from short user descriptions in English. ' +
            'Return ONLY a compact JSON object with integer fields: {"calories": kcal, "protein": grams, "carbs": grams, "fat": grams}. ' +
            'No prose, no markdown, no code fences. ' +
            'If the description lists multiple items (separated by commas, "and", "+", "with", or newlines), sum them. ' +
            'Use realistic typical-portion estimates. Always return a calories number greater than 0.',
        },
        {
          role: 'user',
          content: `Meal type: ${mealType}\nDescription: ${description}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '';
    // Be tolerant: strip code fences if model added them
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    const round = (v: any) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : undefined);
    return {
      calories: round(parsed.calories),
      protein: round(parsed.protein),
      carbs: round(parsed.carbs),
      fat: round(parsed.fat),
    };
  } catch (err) {
    console.error('Calorie estimation failed:', (err as any)?.message || err);
    return {};
  }
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { mealType, description, photoUrl } = body;
  let { calories, protein, carbs, fat } = body;

  if (!mealType || !description) {
    return NextResponse.json({ error: 'mealType and description required' }, { status: 400 });
  }

  // Auto-estimate when client did not supply calories
  if (calories == null) {
    const est = await estimateNutrition(mealType, description);
    calories = est.calories ?? null;
    protein = protein ?? est.protein ?? null;
    carbs = carbs ?? est.carbs ?? null;
    fat = fat ?? est.fat ?? null;
  }

  const log = await prisma.mealLog.create({
    data: { userId: user.userId, mealType, description, calories, protein, carbs, fat, photoUrl },
  });

  const { streak, awarded } = await checkAndAwardStreakRewards(user.userId);

  onMealLogged(user.userId).catch(() => {});

  return NextResponse.json({ log, streak, awarded });
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dateStr = request.nextUrl.searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  let logs = await prisma.mealLog.findMany({
    where: { userId: user.userId, createdAt: { gte: date, lt: nextDay } },
    orderBy: { createdAt: 'asc' },
  });

  // Self-heal: backfill calorie estimates for any logs that were saved without them
  const missing = logs.filter(l => l.calories == null);
  if (missing.length > 0) {
    const updates = await Promise.all(
      missing.map(async l => {
        const est = await estimateNutrition(l.mealType, l.description);
        if (est.calories == null) return null;
        return prisma.mealLog.update({
          where: { id: l.id },
          data: {
            calories: est.calories,
            protein: l.protein ?? est.protein ?? null,
            carbs: l.carbs ?? est.carbs ?? null,
            fat: l.fat ?? est.fat ?? null,
          },
        });
      })
    );
    const updatedById = new Map(updates.filter(Boolean).map((u: any) => [u.id, u]));
    logs = logs.map(l => updatedById.get(l.id) || l);
  }

  const totalCalories = logs.reduce((sum, l) => sum + (l.calories || 0), 0);

  return NextResponse.json({ logs, totalCalories });
}
