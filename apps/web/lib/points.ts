import { prisma } from './prisma';
import { sendPushToUser } from './push';

// Streak-based reward system
// No per-action points. Rewards given at streak milestones.
export const STREAK_REWARDS = {
  EVERY_3_DAYS: 100,     // every 3-day streak
  MILESTONE_10: 500,     // 10-day streak bonus
  MILESTONE_30: 2000,    // 30-day streak bonus
  MILESTONE_100: 10000,  // 100-day streak bonus
  COMMUNITY_POST: 20,    // community post (standalone)
} as const;

export async function awardPoints(
  userId: string,
  amount: number,
  type: 'DAILY_LOG' | 'DAILY_MISSION' | 'WEEKLY_MISSION' | 'CHALLENGE_REWARD' | 'MEDITATION_REWARD',
  description: string
) {
  await prisma.$transaction([
    prisma.tokenTransaction.create({
      data: { userId, amount, type, description },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: amount } },
    }),
  ]);
}

// Calculate streak: how many consecutive days the user has logged at least 1 activity
export async function calculateStreak(userId: string): Promise<number> {
  // Get all distinct dates where user logged anything
  const [water, meals, exercises, sleeps, moods, meditations] = await Promise.all([
    prisma.waterLog.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.mealLog.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.exerciseLog.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.sleepLog.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.moodLog.findMany({ where: { userId }, select: { createdAt: true } }),
    prisma.meditationLog.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  const allDates = new Set<string>();
  [...water, ...meals, ...exercises, ...sleeps, ...moods, ...meditations].forEach(log => {
    allDates.add(new Date(log.createdAt).toISOString().split('T')[0]);
  });

  // Count consecutive days backwards from today
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (allDates.has(dateStr)) {
      streak++;
    } else {
      // allow today to be missing (user might not have logged yet today)
      if (i === 0) continue;
      break;
    }
  }

  return streak;
}

// Check and award streak rewards. Call this after any log action.
export async function checkAndAwardStreakRewards(userId: string): Promise<{ streak: number; awarded: number }> {
  const streak = await calculateStreak(userId);
  let awarded = 0;

  // Check if 3-day reward already given for this cycle
  // We track by checking if a reward was already given today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayRewards = await prisma.tokenTransaction.findFirst({
    where: {
      userId,
      type: 'DAILY_LOG',
      createdAt: { gte: today, lt: tomorrow },
    },
  });

  // Skip if already rewarded today
  if (todayRewards) return { streak, awarded: 0 };

  // Every 3 days
  if (streak > 0 && streak % 3 === 0) {
    await awardPoints(userId, STREAK_REWARDS.EVERY_3_DAYS, 'DAILY_LOG', `${streak}-day streak! +${STREAK_REWARDS.EVERY_3_DAYS} points`);
    awarded += STREAK_REWARDS.EVERY_3_DAYS;
    // Fire-and-forget push (respects user's `rewards` notification pref)
    sendPushToUser(userId, {
      title: `🔥 ${streak}-day streak!`,
      body: `+${STREAK_REWARDS.EVERY_3_DAYS} H2E earned. Keep it going.`,
      url: '/dashboard',
      tag: `streak-${streak}`,
    }, 'rewards').catch(() => {});
  }

  // Milestone bonuses (only awarded once per milestone)
  const milestones = [
    { days: 10, reward: STREAK_REWARDS.MILESTONE_10 },
    { days: 30, reward: STREAK_REWARDS.MILESTONE_30 },
    { days: 100, reward: STREAK_REWARDS.MILESTONE_100 },
  ];

  for (const { days, reward } of milestones) {
    if (streak === days) {
      // Check if this milestone was already awarded
      const existing = await prisma.tokenTransaction.findFirst({
        where: {
          userId,
          type: 'CHALLENGE_REWARD',
          description: { contains: `${days}-day milestone` },
        },
      });
      if (!existing) {
        await awardPoints(userId, reward, 'CHALLENGE_REWARD', `${days}-day milestone! +${reward} points`);
        awarded += reward;
        sendPushToUser(userId, {
          title: `🏆 ${days}-day milestone unlocked!`,
          body: `+${reward.toLocaleString()} H2E bonus. You're on fire.`,
          url: '/dashboard',
          tag: `milestone-${days}`,
          requireInteraction: true,
        }, 'rewards').catch(() => {});
      }
    }
  }

  return { streak, awarded };
}
