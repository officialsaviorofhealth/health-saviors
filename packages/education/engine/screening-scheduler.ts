// Health Screening Schedule Engine
// Age + gender + history based recommendations

export interface ScreeningRecommendation {
  id: string;
  name: string;
  description: string;
  frequency: string;
  ageRange: { min: number; max?: number };
  gender?: "M" | "F" | "all";
  nextDueDate?: string;
  priority: "routine" | "important" | "urgent";
}

// National Screening Standards
export const SCREENING_SCHEDULE: ScreeningRecommendation[] = [
  {
    id: "general-checkup", name: "General Health Checkup",
    description: "Comprehensive health screening",
    frequency: "Every 2 years",
    ageRange: { min: 20 }, gender: "all", priority: "routine",
  },
  {
    id: "stomach-cancer", name: "Stomach Cancer Screening",
    description: "Upper endoscopy",
    frequency: "Every 2 years",
    ageRange: { min: 40 }, gender: "all", priority: "important",
  },
  {
    id: "colon-cancer", name: "Colorectal Cancer Screening",
    description: "Fecal occult blood test",
    frequency: "Every year",
    ageRange: { min: 50 }, gender: "all", priority: "important",
  },
  {
    id: "breast-cancer", name: "Breast Cancer Screening",
    description: "Mammography",
    frequency: "Every 2 years",
    ageRange: { min: 40 }, gender: "F", priority: "important",
  },
  {
    id: "cervical-cancer", name: "Cervical Cancer Screening",
    description: "Pap smear",
    frequency: "Every 2 years",
    ageRange: { min: 20 }, gender: "F", priority: "important",
  },
  {
    id: "liver-cancer", name: "Liver Cancer Screening",
    description: "Ultrasound + AFP blood test",
    frequency: "Every 6 months",
    ageRange: { min: 40 }, gender: "all", priority: "important",
  },
  {
    id: "lung-cancer", name: "Lung Cancer Screening",
    description: "Low-dose CT scan (high risk)",
    frequency: "Every 2 years",
    ageRange: { min: 54, max: 74 }, gender: "all", priority: "routine",
  },
  {
    id: "dental", name: "Dental Checkup",
    description: "Dental examination",
    frequency: "Every year",
    ageRange: { min: 20 }, gender: "all", priority: "routine",
  },
  {
    id: "bone-density", name: "Bone Density Test",
    description: "DEXA scan",
    frequency: "Every 2 years",
    ageRange: { min: 54 }, gender: "F", priority: "routine",
  },
];

export class ScreeningScheduler {
  getRecommendations(age: number, gender: "M" | "F"): ScreeningRecommendation[] {
    return SCREENING_SCHEDULE.filter(s => {
      if (age < s.ageRange.min) return false;
      if (s.ageRange.max && age > s.ageRange.max) return false;
      if (s.gender && s.gender !== "all" && s.gender !== gender) return false;
      return true;
    });
  }

  getUpcoming(recommendations: ScreeningRecommendation[], lastScreenings: Record<string, string>): ScreeningRecommendation[] {
    const now = new Date();
    return recommendations.map(r => {
      const last = lastScreenings[r.id];
      if (!last) return { ...r, nextDueDate: "overdue", priority: "urgent" as const };
      const lastDate = new Date(last);
      const monthsInterval = r.frequency.includes("6 months") ? 6 : r.frequency.includes("year") ? 12 : 24;
      const nextDue = new Date(lastDate);
      nextDue.setMonth(nextDue.getMonth() + monthsInterval);
      const isOverdue = nextDue < now;
      return {
        ...r,
        nextDueDate: nextDue.toISOString().split("T")[0],
        priority: isOverdue ? "urgent" as const : r.priority,
      };
    }).sort((a, b) => {
      const order = { urgent: 0, important: 1, routine: 2 };
      return order[a.priority] - order[b.priority];
    });
  }
}

export const screeningScheduler = new ScreeningScheduler();
