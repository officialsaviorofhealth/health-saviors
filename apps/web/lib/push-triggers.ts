// Push notification triggers — fired AFTER each log save.
// Each trigger is a "milestone push": only fires when a meaningful threshold is crossed,
// to avoid notification fatigue. All are safe to call from any POST route (fire-and-forget).
import { prisma } from './prisma';
import { sendPushToUser } from './push';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfTomorrow = () => { const d = startOfToday(); d.setDate(d.getDate() + 1); return d; };

// Has the user already received a push with this `tag` today? (Dedup)
async function alreadyPushedToday(userId: string, tag: string): Promise<boolean> {
  // We track by writing a marker into TokenTransaction (cheap, already exists).
  // The `description` includes the tag so we can search.
  const today = startOfToday();
  const t = startOfTomorrow();
  const existing = await prisma.tokenTransaction.findFirst({
    where: {
      userId,
      type: 'DAILY_LOG',
      description: { contains: `[push:${tag}]` },
      createdAt: { gte: today, lt: t },
    },
  });
  return !!existing;
}

async function markPushed(userId: string, tag: string): Promise<void> {
  // Zero-amount marker — doesn't change balance
  await prisma.tokenTransaction.create({
    data: {
      userId,
      amount: 0,
      type: 'DAILY_LOG',
      description: `[push:${tag}] notification sent`,
    },
  }).catch(() => {});
}

// ── Water: when total crosses 2 000 ml for the first time today ──
export async function onWaterLogged(userId: string, totalToday: number, justAdded: number): Promise<void> {
  const before = totalToday - justAdded;
  if (before >= 2000 || totalToday < 2000) return;
  if (await alreadyPushedToday(userId, 'water-goal')) return;

  await sendPushToUser(userId, {
    title: '💧 Daily 2L goal hit!',
    body: `You drank ${(totalToday / 1000).toFixed(1)}L today and earned a +50 H2E bonus. 🎉`,
    url: '/wellness',
    tag: 'water-goal',
  }, 'rewards');
  await markPushed(userId, 'water-goal');
}

// ── Meal: when all 3 main meals (breakfast/lunch/dinner) logged today ──
export async function onMealLogged(userId: string): Promise<void> {
  const meals = await prisma.mealLog.findMany({
    where: { userId, createdAt: { gte: startOfToday(), lt: startOfTomorrow() } },
    select: { mealType: true, calories: true },
  });
  const types = new Set(meals.map(m => m.mealType));
  const hasAllThree = types.has('breakfast') && types.has('lunch') && types.has('dinner');
  if (!hasAllThree) return;
  if (await alreadyPushedToday(userId, 'meals-complete')) return;

  const totalKcal = meals.reduce((s, m) => s + (m.calories || 0), 0);
  await sendPushToUser(userId, {
    title: '🍽 All 3 meals logged today',
    body: `${totalKcal} kcal total · your Nutritionist will factor this into the weekly summary.`,
    url: '/nutrition',
    tag: 'meals-complete',
  }, 'rewards');
  await markPushed(userId, 'meals-complete');
}

// ── Exercise: when weekly total crosses WHO 150 min ──
const WEEKLY_GOAL_MIN = 150;
export async function onExerciseLogged(userId: string, justAdded: number): Promise<void> {
  // Sum minutes from past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const week = await prisma.exerciseLog.findMany({
    where: { userId, createdAt: { gte: sevenDaysAgo } },
    select: { durationMin: true },
  });
  const totalMin = week.reduce((s, e) => s + e.durationMin, 0);
  const before = totalMin - justAdded;
  if (before >= WEEKLY_GOAL_MIN || totalMin < WEEKLY_GOAL_MIN) return;
  // Use weekly tag so it only fires once per ISO week
  const isoWeek = `${new Date().getUTCFullYear()}-W${Math.ceil((Date.now() - new Date(new Date().getUTCFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
  const tag = `exercise-week-${isoWeek}`;

  // For weekly tag we need a longer dedup window — check past 7 days
  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existing = await prisma.tokenTransaction.findFirst({
    where: { userId, type: 'DAILY_LOG', description: { contains: `[push:${tag}]` }, createdAt: { gte: sevenAgo } },
  });
  if (existing) return;

  await sendPushToUser(userId, {
    title: '🏃‍♂️ Weekly exercise goal hit!',
    body: `${totalMin} min this week — past the WHO 150 min recommendation. 💪`,
    url: '/wellness',
    tag,
  }, 'rewards');
  await prisma.tokenTransaction.create({
    data: { userId, amount: 0, type: 'DAILY_LOG', description: `[push:${tag}] notification sent` },
  }).catch(() => {});
}

// ── Sleep: when a "good night" is logged (≥7h, quality ≥4) ──
export async function onSleepLogged(userId: string, hours: number, quality: number | null): Promise<void> {
  if (hours < 7 || (quality ?? 0) < 4) return;
  if (await alreadyPushedToday(userId, 'good-sleep')) return;

  await sendPushToUser(userId, {
    title: '😴 Restful sleep logged',
    body: `${hours.toFixed(1)}h · quality ${quality}/5 — you're taking good care of yourself.`,
    url: '/wellness',
    tag: 'good-sleep',
  }, 'rewards');
  await markPushed(userId, 'good-sleep');
}

// ── AI follow-up: detect low-mood pattern and have MindCare check in ──
const LOW_MOOD_THRESHOLD = 2;        // score 1 or 2
const LOW_MOOD_DAYS_TRIGGER = 2;     // 2 consecutive low days
export async function onMoodLogged(userId: string, score: number): Promise<void> {
  if (score > LOW_MOOD_THRESHOLD) return; // only react to low scores

  // Look at last 3 days of mood scores. If 2+ consecutive days are low, push from MindCare.
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recent = await prisma.moodLog.findMany({
    where: { userId, createdAt: { gte: threeDaysAgo } },
    orderBy: { createdAt: 'desc' },
    select: { score: true, createdAt: true },
  });

  // Group by day, take min score per day (worst of the day)
  const byDay = new Map<string, number>();
  for (const m of recent) {
    const day = m.createdAt.toISOString().slice(0, 10);
    const cur = byDay.get(day);
    if (cur === undefined || m.score < cur) byDay.set(day, m.score);
  }

  // Sorted descending by date
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  let consecutiveLow = 0;
  for (const [, s] of days) {
    if (s <= LOW_MOOD_THRESHOLD) consecutiveLow++;
    else break;
  }
  if (consecutiveLow < LOW_MOOD_DAYS_TRIGGER) return;
  if (await alreadyPushedToday(userId, 'mindcare-followup')) return;

  await sendPushToUser(userId, {
    title: '🧠 Mind Care checking in',
    body: `Your mood has been low recently. Want to try a 5-min breathing session together?`,
    url: '/mindspace',
    tag: 'mindcare-followup',
    requireInteraction: true,
  }, 'agentFollowups');
  await markPushed(userId, 'mindcare-followup');
}
