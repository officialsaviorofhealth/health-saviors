// Medication Reminder System
// Supports: manual input, AI-parsed from chat, hospital_sync (future)
// Prisma DI for database-backed storage

import type { PrismaClient } from "@prisma/client";

interface ReminderFrequency {
  times: string[];
  instruction: string;
}

interface MedicationReminder {
  id: string; userId: string; medicationName: string;
  dosage?: string; frequency: ReminderFrequency;
  startDate: string; endDate?: string;
  source: string; isActive: boolean; createdAt: Date;
}

interface FHIRMedicationStatement {
  medicationCodeableConcept?: { text?: string; coding?: { display?: string }[] };
  dosage?: { text?: string }[];
  effectivePeriod?: { start?: string; end?: string };
}

export class ReminderService {
  private prisma: PrismaClient | null = null;

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Create reminder from manual input
  async createManual(userId: string, data: {
    medicationName: string; dosage?: string; frequency: ReminderFrequency;
    startDate: string; endDate?: string;
  }): Promise<MedicationReminder> {
    if (this.prisma) {
      const reminder = await this.prisma.medicationReminder.create({
        data: {
          userId, medicationName: data.medicationName,
          dosage: data.dosage || null,
          frequency: data.frequency as any,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          source: "manual",
        },
      });
      return {
        id: reminder.id, userId, medicationName: data.medicationName,
        dosage: data.dosage, frequency: data.frequency,
        startDate: data.startDate, endDate: data.endDate,
        source: "manual", isActive: true, createdAt: reminder.createdAt,
      };
    }
    return { id: "new", userId, ...data, source: "manual", isActive: true, createdAt: new Date() };
  }

  // Auto-create from AI chat extraction
  async createFromAIParsed(userId: string, medication: {
    name: string; dosage?: string; frequency?: string;
  }): Promise<MedicationReminder | null> {
    const freq = this.parseFrequency(medication.frequency || "");
    if (!freq) return null;

    return this.createManual(userId, {
      medicationName: medication.name,
      dosage: medication.dosage,
      frequency: freq,
      startDate: new Date().toISOString().split("T")[0],
    });
  }

  // Parse frequency text
  parseFrequency(text: string): ReminderFrequency | null {
    const patterns: Array<{ regex: RegExp; times: string[]; instruction: string }> = [
      { regex: /three times a day|3 times a day|tid/i, times: ["08:00", "13:00", "19:00"], instruction: "Three times daily" },
      { regex: /twice a day|2 times a day|bid/i, times: ["08:00", "20:00"], instruction: "Twice daily" },
      { regex: /once a day|1 time a day|qd/i, times: ["08:00"], instruction: "Once daily" },
      { regex: /after meals|after food/i, times: ["08:30", "12:30", "19:30"], instruction: "After meals" },
      { regex: /before meals|before food/i, times: ["07:30", "11:30", "18:30"], instruction: "Before meals" },
      { regex: /before sleep|before bedtime/i, times: ["22:00"], instruction: "Before bed" },
      { regex: /morning/i, times: ["08:00"], instruction: "In the morning" },
      { regex: /evening/i, times: ["19:00"], instruction: "In the evening" },
      { regex: /every\s*(\d+)\s*hours/i, times: ["08:00", "14:00", "20:00"], instruction: "Every 6 hours" },
      { regex: /twice|two times/i, times: ["08:00", "20:00"], instruction: "Twice daily" },
      { regex: /three times/i, times: ["08:00", "13:00", "19:00"], instruction: "Three times daily" },
      { regex: /once|daily/i, times: ["08:00"], instruction: "Once daily" },
      { regex: /bedtime|before bed/i, times: ["22:00"], instruction: "At bedtime" },
    ];

    for (const p of patterns) {
      if (p.regex.test(text)) {
        return { times: p.times, instruction: p.instruction };
      }
    }
    return null;
  }

  // Create from hospital FHIR prescription
  async createFromHospitalSync(userId: string, prescription: FHIRMedicationStatement): Promise<MedicationReminder | null> {
    const medName = prescription.medicationCodeableConcept?.text || prescription.medicationCodeableConcept?.coding?.[0]?.display;
    if (!medName) return null;

    const dosageText = prescription.dosage?.[0]?.text || "";
    const freq = this.parseFrequency(dosageText);

    return this.createManual(userId, {
      medicationName: medName,
      dosage: dosageText,
      frequency: freq || { times: ["08:00"], instruction: "Verification needed" },
      startDate: prescription.effectivePeriod?.start || new Date().toISOString().split("T")[0],
      endDate: prescription.effectivePeriod?.end,
    });
  }

  // Get active reminders for user
  async getActive(userId: string): Promise<MedicationReminder[]> {
    if (!this.prisma) return [];

    const reminders = await this.prisma.medicationReminder.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return reminders.map((r) => ({
      id: r.id, userId: r.userId, medicationName: r.medicationName,
      dosage: r.dosage || undefined, frequency: r.frequency as ReminderFrequency,
      startDate: r.startDate.toISOString().split("T")[0],
      endDate: r.endDate?.toISOString().split("T")[0],
      source: r.source, isActive: r.isActive, createdAt: r.createdAt,
    }));
  }

  // Get due reminders for notification
  async getDueReminders(userId: string, currentTime: string): Promise<MedicationReminder[]> {
    const active = await this.getActive(userId);
    return active.filter((r) => {
      const currentMinutes = timeToMinutes(currentTime);
      return r.frequency.times.some((t) => {
        const diff = Math.abs(currentMinutes - timeToMinutes(t));
        return diff <= 30;
      });
    });
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const reminderService = new ReminderService();
