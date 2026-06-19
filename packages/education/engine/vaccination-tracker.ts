// Vaccination Tracker — Immunization history + schedule

export interface Vaccination {
  id: string;
  name: string;
  doses: number;              // Total doses needed
  interval?: string;          // Between doses
  ageGroup: string;
  category: "routine" | "seasonal" | "travel";
}

export interface VaccinationRecord {
  vaccinationId: string;
  doseNumber: number;
  dateAdministered: string;
  provider?: string;
  lotNumber?: string;
}

export const VACCINATION_SCHEDULE: Vaccination[] = [
  // Seasonal
  { id: "influenza", name: "Influenza (Flu)", doses: 1, ageGroup: "all", category: "seasonal" },
  { id: "covid19", name: "COVID-19", doses: 2, interval: "3-8 weeks", ageGroup: "12+", category: "routine" },

  // Adult routine
  { id: "tdap", name: "Tdap (Tetanus/Diphtheria/Pertussis)", doses: 1, ageGroup: "adult", category: "routine" },
  { id: "hpv", name: "HPV", doses: 2, interval: "6 months", ageGroup: "9-26", category: "routine" },
  { id: "shingles", name: "Shingles (Zoster)", doses: 2, interval: "2-6 months", ageGroup: "50+", category: "routine" },
  { id: "pneumococcal", name: "Pneumococcal", doses: 1, ageGroup: "65+", category: "routine" },

  // Travel
  { id: "hepatitis-a", name: "Hepatitis A", doses: 2, interval: "6 months", ageGroup: "all", category: "travel" },
  { id: "hepatitis-b", name: "Hepatitis B", doses: 3, interval: "0-1-6 months", ageGroup: "all", category: "routine" },
  { id: "typhoid", name: "Typhoid", doses: 1, ageGroup: "all", category: "travel" },
  { id: "japanese-encephalitis", name: "Japanese Encephalitis", doses: 2, interval: "28 days", ageGroup: "all", category: "travel" },
];

export class VaccinationTracker {
  getSchedule(age: number): Vaccination[] {
    return VACCINATION_SCHEDULE.filter(v => {
      if (v.ageGroup === "all") return true;
      if (v.ageGroup === "adult" && age >= 18) return true;
      if (v.ageGroup.includes("+")) {
        const minAge = parseInt(v.ageGroup);
        return age >= minAge;
      }
      if (v.ageGroup.includes("-")) {
        const [min, max] = v.ageGroup.split("-").map(Number);
        return age >= min && age <= max;
      }
      return false;
    });
  }

  getNextDose(vaccination: Vaccination, records: VaccinationRecord[]): {
    needed: boolean; doseNumber: number; message: string;
  } {
    const received = records.filter(r => r.vaccinationId === vaccination.id).length;
    if (received >= vaccination.doses) {
      return { needed: false, doseNumber: 0, message: "Complete" };
    }
    return {
      needed: true, doseNumber: received + 1,
      message: `Dose ${received + 1} of ${vaccination.doses} needed`,
    };
  }

  // Family management: track for all family members
  getFamilySchedule(familyMembers: Array<{ name: string; age: number }>): Record<string, Vaccination[]> {
    const result: Record<string, Vaccination[]> = {};
    for (const member of familyMembers) {
      result[member.name] = this.getSchedule(member.age);
    }
    return result;
  }
}

export const vaccinationTracker = new VaccinationTracker();
