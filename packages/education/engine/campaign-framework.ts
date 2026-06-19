// Seasonal Campaign Framework
// Configurable campaigns with time-limited rewards

export interface Campaign {
  id: string;
  title: string;
  description: string;
  type: "seasonal" | "challenge" | "special";
  startDate: string; endDate: string;
  tasks: CampaignTask[];
  totalRewardH2E: number;
  badgeReward?: string;  // SBT badge type
  isActive: boolean;
}

export interface CampaignTask {
  id: string;
  description: string;
  type: "daily_checkin" | "quiz" | "streak" | "education" | "referral";
  target: number;       // How many times to complete
  rewardH2E: number;
}

export const CAMPAIGN_TEMPLATES: Campaign[] = [
  {
    id: "winter-health-2026",
    title: "Winter Health Challenge",
    description: "Stay healthy during winter with daily check-ins and respiratory care education.",
    type: "seasonal", startDate: "2026-12-01", endDate: "2026-02-28",
    tasks: [
      { id: "w1", description: "Log health 7 days in a row", type: "streak", target: 7, rewardH2E: 50 },
      { id: "w2", description: "Complete 3 winter health quizzes", type: "quiz", target: 3, rewardH2E: 30 },
      { id: "w3", description: "Read 5 respiratory care tips", type: "education", target: 5, rewardH2E: 20 },
    ],
    totalRewardH2E: 100, badgeReward: "WINTER_WARRIOR", isActive: true,
  },
  {
    id: "new-year-detox-2026",
    title: "New Year Health Reset",
    description: "Start the new year with healthy habits.",
    type: "challenge", startDate: "2026-01-01", endDate: "2026-01-31",
    tasks: [
      { id: "ny1", description: "30-day streak", type: "streak", target: 30, rewardH2E: 300 },
      { id: "ny2", description: "Complete nutrition course", type: "education", target: 1, rewardH2E: 50 },
      { id: "ny3", description: "Refer 3 friends", type: "referral", target: 3, rewardH2E: 150 },
    ],
    totalRewardH2E: 500, badgeReward: "NEW_YEAR_HERO", isActive: false,
  },
];

export class CampaignFramework {
  getActiveCampaigns(): Campaign[] {
    const now = new Date().toISOString().split("T")[0];
    return CAMPAIGN_TEMPLATES.filter(c => c.isActive && c.startDate <= now && c.endDate >= now);
  }

  checkTaskCompletion(task: CampaignTask, userProgress: number): { completed: boolean; progress: number; percentage: number } {
    const completed = userProgress >= task.target;
    return { completed, progress: Math.min(userProgress, task.target), percentage: Math.min((userProgress / task.target) * 100, 100) };
  }

  getCampaignProgress(campaign: Campaign, userTaskProgress: Record<string, number>): {
    totalTasks: number; completedTasks: number; earnedH2E: number; percentage: number;
  } {
    let completed = 0; let earned = 0;
    for (const task of campaign.tasks) {
      const progress = userTaskProgress[task.id] || 0;
      if (progress >= task.target) { completed++; earned += task.rewardH2E; }
    }
    return {
      totalTasks: campaign.tasks.length, completedTasks: completed,
      earnedH2E: earned, percentage: (completed / campaign.tasks.length) * 100,
    };
  }
}

export const campaignFramework = new CampaignFramework();
