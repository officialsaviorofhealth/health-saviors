// Reward Service — Points-based reward calculation with streak + multiplier
// Converted from token-based (ethers.js) to simple DB points system
import { REWARD_AMOUNTS, STREAK_MULTIPLIERS, STREAK_BONUSES } from "../../../../packages/shared/types";

export class RewardService {
  calculateReward(detailScore: number, streakDays: number): {
    base: number; detailBonus: number; multiplier: number; streakBonus: number; total: number;
  } {
    const base = REWARD_AMOUNTS.daily_checkin;
    const detailBonus = detailScore >= 5 ? REWARD_AMOUNTS.detail_bonus : 0;
    const multiplier = this.getMultiplier(streakDays);
    const subtotal = ((base + detailBonus) * multiplier) / 100;
    const streakBonus = STREAK_BONUSES[streakDays] || 0;
    const total = subtotal + streakBonus;
    return { base, detailBonus, multiplier, streakBonus, total };
  }

  private getMultiplier(streak: number): number {
    for (const entry of STREAK_MULTIPLIERS) {
      if (streak >= entry.days) return entry.multiplier;
    }
    return 100;
  }
}

export const rewardService = new RewardService();
