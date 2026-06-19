// One-shot backfill: estimate calories for every meal log that has calories=null
// Usage: npx tsx scripts/backfill-meal-calories.ts
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env BEFORE importing PrismaClient (which auto-loads .env at import time)
function loadEnv(path: string) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
      if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}
// apps/web/.env wins (has Neon URL); fall through to root .env if missing keys
loadEnv(join(process.cwd(), '.env'));
const _save = { ...process.env };
loadEnv(join(process.cwd(), '../../.env'));
// Restore apps/web values (don't let root .env override)
for (const [k, v] of Object.entries(_save)) {
  if (v !== undefined) process.env[k] = v;
}

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { default: OpenAI } = await import('openai');
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL! } },
  });
  const xai = new OpenAI({
    apiKey: process.env.XAI_API_KEY || process.env.GROQ_API_KEY || '',
    baseURL: 'https://api.x.ai/v1',
  });
  const XAI_MODEL = process.env.XAI_MODEL || 'grok-4-fast-non-reasoning';

  async function estimate(mealType: string, description: string) {
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
            'If multiple items are listed (commas, "and", "+", newlines), sum them. ' +
            'Use realistic typical-portion estimates. Always return a calories number greater than 0.',
        },
        { role: 'user', content: `Meal type: ${mealType}\nDescription: ${description}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    const round = (v: any) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : null);
    return {
      calories: round(parsed.calories),
      protein: round(parsed.protein),
      carbs: round(parsed.carbs),
      fat: round(parsed.fat),
    };
  }

  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Model: ${XAI_MODEL}\n`);

  const missing = await prisma.mealLog.findMany({
    where: { calories: null },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${missing.length} meal logs without calories.\n`);

  let ok = 0;
  let fail = 0;
  for (const log of missing) {
    try {
      const est = await estimate(log.mealType, log.description);
      if (est.calories == null) {
        console.warn(`  · skipped (no estimate): "${log.description}"`);
        fail++;
        continue;
      }
      await prisma.mealLog.update({
        where: { id: log.id },
        data: {
          calories: est.calories,
          protein: log.protein ?? est.protein,
          carbs: log.carbs ?? est.carbs,
          fat: log.fat ?? est.fat,
        },
      });
      console.log(`  ✓ ${log.mealType} "${log.description.slice(0, 50)}" → ${est.calories} kcal`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ "${log.description.slice(0, 50)}": ${err?.message || err}`);
      fail++;
    }
  }
  console.log(`\nDone. Updated ${ok}, failed ${fail}.`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
