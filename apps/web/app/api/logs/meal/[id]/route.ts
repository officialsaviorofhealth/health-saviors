import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4-fast-non-reasoning';

async function estimate(mealType: string, description: string) {
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
            'If multiple items are listed (commas, "and", "+", "with", or newlines), sum them. ' +
            'Use realistic typical-portion estimates. Always return a calories number greater than 0.',
        },
        { role: 'user', content: `Meal type: ${mealType}\nDescription: ${description}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '';
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

// PATCH /api/logs/meal/[id] — edit a meal log; re-estimates calories if description or mealType changed
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.mealLog.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
  if (existing.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const description = typeof body.description === 'string' ? body.description.trim() : existing.description;
  const mealType = typeof body.mealType === 'string' ? body.mealType : existing.mealType;

  if (!description) return NextResponse.json({ error: 'description cannot be empty' }, { status: 400 });

  // Re-estimate when text or meal type changes (or when explicitly requested)
  const shouldReestimate =
    body.reestimate === true ||
    description !== existing.description ||
    mealType !== existing.mealType;

  let calories = body.calories ?? existing.calories;
  let protein = body.protein ?? existing.protein;
  let carbs = body.carbs ?? existing.carbs;
  let fat = body.fat ?? existing.fat;

  if (shouldReestimate) {
    const est = await estimate(mealType, description);
    calories = est.calories ?? null;
    protein = est.protein ?? null;
    carbs = est.carbs ?? null;
    fat = est.fat ?? null;
  }

  const log = await prisma.mealLog.update({
    where: { id: params.id },
    data: { description, mealType, calories, protein, carbs, fat },
  });

  return NextResponse.json({ log });
}

// DELETE /api/logs/meal/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.mealLog.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
  if (existing.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.mealLog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
