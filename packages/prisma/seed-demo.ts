// Demo Data Seed Script — demo data seed
// Usage: npx tsx packages/prisma/seed-demo.ts
//
// Creates 3 demo users with 30 days of realistic health data:
//   User 1 (Minsu Kim): Office worker with recurring headaches + fatigue (stress pattern)
//   User 2 (Seoyeon Lee): Seasonal allergies + digestive issues
//   User 3 (John Smith): Active lifestyle, exercise-related muscle soreness, good overall health

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────

/** Returns a Date object for `daysAgo` days before today (2026-03-01). */
function daysAgo(n: number): Date {
  const d = new Date("2026-03-01T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Returns a FHIR R4 Condition entry for a symptom. */
function fhirCondition(snomedCode: string, display: string, severity: string) {
  return {
    resource: {
      resourceType: "Condition",
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: snomedCode,
            display,
          },
        ],
      },
      severity: {
        coding: [
          {
            system: "http://snomed.info/sct",
            display: severity,
          },
        ],
      },
    },
  };
}

/** Builds a minimal FHIR R4 Bundle from symptom entries. */
function fhirBundle(
  symptoms: Array<{ snomedCode: string; display: string; severity: string }>,
): object {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: symptoms.map((s) => fhirCondition(s.snomedCode, s.display, s.severity)),
  };
}

// ── Demo User Definitions ──────────────────────────────────────

const DEMO_USER_1_ID = "d1000000-0000-0000-0000-000000000001";
const DEMO_USER_2_ID = "d2000000-0000-0000-0000-000000000002";
const DEMO_USER_3_ID = "d3000000-0000-0000-0000-000000000003";

const demoUsers = [
  {
    id: DEMO_USER_1_ID,
    walletAddress: "0xTG00000000000000000000000000000tg_demo_001",
    streakDays: 14,
    totalPoints: BigInt(2450),
    level: 5,
    dataConsent: true,
    referralCode: "MINSU2026",
    lastCheckinDate: daysAgo(0),
    createdAt: daysAgo(45),
  },
  {
    id: DEMO_USER_2_ID,
    walletAddress: "0xTG00000000000000000000000000000tg_demo_002",
    streakDays: 7,
    totalPoints: BigInt(1200),
    level: 3,
    dataConsent: true,
    referralCode: "SEOYEON26",
    lastCheckinDate: daysAgo(0),
    createdAt: daysAgo(30),
  },
  {
    id: DEMO_USER_3_ID,
    walletAddress: "0xTG00000000000000000000000000000tg_demo_003",
    streakDays: 21,
    totalPoints: BigInt(4800),
    level: 8,
    dataConsent: true,
    referralCode: "JOHN2026X",
    lastCheckinDate: daysAgo(0),
    createdAt: daysAgo(60),
  },
];

// ── Health Entry Templates ─────────────────────────────────────
// Each entry specifies: daysAgo, rawInput, symptoms, aiResponse, detailScore, urgencyScore, pointsEarned

interface SymptomDef {
  snomedCode: string;
  icdCode: string;
  displayName: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  bodySite?: string;
}

interface EntryDef {
  daysAgo: number;
  rawInput: string;
  symptoms: SymptomDef[];
  aiResponse: string;
  detailScore: number;
  urgencyScore: number;
  pointsEarned: number;
}

// ────────────────────────────────────────────────────────────────
// USER 1: Minsu Kim (Office Worker — Stress Headaches + Fatigue)
// Story: Chronic tension headaches on weekdays, worsening mid-month,
//        then improving after lifestyle changes.
// ────────────────────────────────────────────────────────────────

const user1Entries: EntryDef[] = [
  // Week 1: Baseline — mild headaches start appearing
  {
    daysAgo: 29,
    rawInput: "My head has been a little achy since this afternoon. I was staring at my monitor for a long time at work.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
    ],
    aiResponse: "This looks like a mild tension headache. Try the 20-20-20 rule (every 20 minutes, look at something 20 feet away for 20 seconds). Staying well hydrated also helps.",
    detailScore: 6, urgencyScore: 0.2, pointsEarned: 15,
  },
  {
    daysAgo: 27,
    rawInput: "I didn't sleep well last night. Feeling a bit tired.",
    symptoms: [
      { snomedCode: "193462001", icdCode: "G47.00", displayName: "Insomnia", severity: "mild" },
      { snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue", severity: "mild" },
    ],
    aiResponse: "Poor sleep quality can lead to fatigue. Try cutting back on caffeine and screen time before bed. Keeping a regular sleep schedule is important.",
    detailScore: 5, urgencyScore: 0.15, pointsEarned: 12,
  },
  {
    daysAgo: 26,
    rawInput: "My neck is a little stiff today and I have a headache again.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
      { snomedCode: "81680005", icdCode: "M54.2", displayName: "Neck pain", severity: "mild", bodySite: "Neck" },
    ],
    aiResponse: "Neck stiffness together with a headache is a classic pattern for cervicogenic tension headache. Check your monitor height and chair posture.",
    detailScore: 7, urgencyScore: 0.25, pointsEarned: 18,
  },
  {
    daysAgo: 24,
    rawInput: "I feel okay today. Doing some stretching helped a bit.",
    symptoms: [],
    aiResponse: "Glad the stretching helped. Making a habit of 5 minutes of stretching every 2 hours can help prevent neck strain.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  // Week 2: Escalation — headaches worsen, stress and insomnia compound
  {
    daysAgo: 22,
    rawInput: "I'm really stressed because of a project deadline. The headache is back and my temples are throbbing.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "moderate", bodySite: "Temporal region" },
      { snomedCode: "73595000", icdCode: "F43.9", displayName: "Stress", severity: "moderate" },
    ],
    aiResponse: "Your stress-related tension headache is worsening to a moderate level. Try the 4-7-8 breathing technique: inhale for 4 seconds, hold for 7, exhale for 8. You need regular breaks during work.",
    detailScore: 8, urgencyScore: 0.4, pointsEarned: 20,
  },
  {
    daysAgo: 21,
    rawInput: "I barely slept last night. My head hurts and my whole body feels exhausted. My vision is blurry too.",
    symptoms: [
      { snomedCode: "193462001", icdCode: "G47.00", displayName: "Insomnia", severity: "moderate" },
      { snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue", severity: "moderate" },
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "moderate", bodySite: "Head" },
      { snomedCode: "246636008", icdCode: "H53.8", displayName: "Blurred vision", severity: "mild" },
    ],
    aiResponse: "I'm seeing a pattern where insomnia, headache, and fatigue are worsening together. The blurred vision also appears to be related to prolonged screen use and lack of sleep. I recommend getting plenty of rest this weekend. If symptoms persist for more than a week, I recommend consulting a neurologist.",
    detailScore: 9, urgencyScore: 0.5, pointsEarned: 25,
  },
  {
    daysAgo: 20,
    rawInput: "I took some headache medicine and it helped a bit. But I'm still tired.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
      { snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue", severity: "moderate" },
    ],
    aiResponse: "The headache eased after taking medication, but the underlying fatigue persists. To prevent medication-overuse headache, limit pain reliever use to no more than 2-3 times per week.",
    detailScore: 7, urgencyScore: 0.35, pointsEarned: 18,
  },
  {
    daysAgo: 19,
    rawInput: "My neck is stiff and my shoulders hurt too. My stress level stays high.",
    symptoms: [
      { snomedCode: "81680005", icdCode: "M54.2", displayName: "Neck pain", severity: "moderate", bodySite: "Neck" },
      { snomedCode: "53627009", icdCode: "M25.51", displayName: "Shoulder pain", severity: "moderate", bodySite: "Shoulder" },
      { snomedCode: "73595000", icdCode: "F43.9", displayName: "Stress", severity: "moderate" },
    ],
    aiResponse: "Your neck and shoulder pain are accompanied by stress. This looks like a myofascial tension pattern, so I recommend warm compresses and neck stretches. If it persists long-term, consider seeing an orthopedic specialist.",
    detailScore: 8, urgencyScore: 0.45, pointsEarned: 22,
  },
  // Week 2 peak: worst day
  {
    daysAgo: 17,
    rawInput: "My headache is really bad. My temples are pounding, I'm dizzy, and I feel nauseous too. I can't get any work done.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "severe", bodySite: "Temporal region" },
      { snomedCode: "404640003", icdCode: "R42", displayName: "Dizziness", severity: "moderate" },
      { snomedCode: "422587007", icdCode: "R11.0", displayName: "Nausea", severity: "moderate" },
    ],
    aiResponse: "A severe headache accompanied by dizziness and nausea raises the possibility of a migraine. Rest in a quiet, dark place. If headaches this severe recur, I strongly recommend seeing a neurologist. It would be safe to rule out other causes with brain imaging.",
    detailScore: 9, urgencyScore: 0.7, pointsEarned: 28,
  },
  {
    daysAgo: 16,
    rawInput: "A bit better than yesterday. After taking a day off, the headache eased, but I'm still tired.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
      { snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue", severity: "moderate" },
    ],
    aiResponse: "It's a good sign that your headache decreased after resting. Since the fatigue still lingers, please get plenty of sleep this weekend as well.",
    detailScore: 6, urgencyScore: 0.3, pointsEarned: 15,
  },
  // Week 3: Recovery begins — lifestyle changes take effect
  {
    daysAgo: 15,
    rawInput: "I rested well over the weekend. I feel much better. I even went for a light walk.",
    symptoms: [],
    aiResponse: "Plenty of rest and a light walk helped your recovery. I'd love for you to keep up this pattern. Try including outdoor activity every weekend.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 13,
    rawInput: "I had a slight headache today, but it got better after stretching. I'm stretching every 2 hours now.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
    ],
    aiResponse: "Regular stretching is proving effective at preventing your headaches. Keep up this habit. It's encouraging that your headache frequency is decreasing.",
    detailScore: 7, urgencyScore: 0.15, pointsEarned: 18,
  },
  {
    daysAgo: 12,
    rawInput: "I feel okay today. I started doing yoga in the evenings.",
    symptoms: [],
    aiResponse: "Yoga is very effective for relieving stress and releasing myofascial tension. Breath-focused yoga (vinyasa or hatha) is especially helpful for preventing headaches.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 10,
    rawInput: "I'm sleeping well. I've fixed my bedtime at 11pm.",
    symptoms: [],
    aiResponse: "Setting a regular bedtime is the most effective way to improve insomnia. Better sleep quality will lead to improvements in your overall health.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 9,
    rawInput: "A slight headache came on but went away quickly. Drinking more water definitely seems to have helped.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
    ],
    aiResponse: "Increasing your water intake is contributing to a reduction in headache frequency and intensity. Keep drinking at least 2L of water a day consistently.",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
  // Week 4: Stable — much improved
  {
    daysAgo: 7,
    rawInput: "I only had a headache once this week! I think it's thanks to the yoga and stretching.",
    symptoms: [],
    aiResponse: "Your headache frequency has dropped noticeably. Regular exercise, stretching, and sleep management are paying off. Keep up these lifestyle habits consistently.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 5,
    rawInput: "A little tired today but no headache. I went to bed a bit late last night.",
    symptoms: [
      { snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue", severity: "mild" },
    ],
    aiResponse: "The fatigue showed up from the late bedtime, but having no headache is a good sign. If possible, try to keep your bedtime back at 11pm.",
    detailScore: 5, urgencyScore: 0.1, pointsEarned: 12,
  },
  {
    daysAgo: 3,
    rawInput: "Feeling great today. Full of energy, no headache. I worked out too.",
    symptoms: [],
    aiResponse: "Your overall health has improved significantly. Your headache frequency has decreased by more than 80% compared to a month ago. Please keep up your current health habits.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 1,
    rawInput: "My neck is a little stiff but overall I feel good. I went to a yoga class.",
    symptoms: [
      { snomedCode: "81680005", icdCode: "M54.2", displayName: "Neck pain", severity: "mild", bodySite: "Neck" },
    ],
    aiResponse: "Mild neck stiffness is a temporary symptom after using the muscles. Adding cool-down stretches after yoga can help prevent it.",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
  {
    daysAgo: 0,
    rawInput: "Doing well again today. 14-day logging streak!",
    symptoms: [],
    aiResponse: "Congratulations on reaching a 14-day health logging streak! Your consistent health management is leading to reduced headache frequency and better sleep quality. Keep it up!",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
];

// ────────────────────────────────────────────────────────────────
// USER 2: Seoyeon Lee (Seasonal Allergies + Digestive Issues)
// Story: Spring allergy onset, digestive problems from stress/eating,
//        then allergy medication helps, digestive issues improve.
// ────────────────────────────────────────────────────────────────

const user2Entries: EntryDef[] = [
  // Week 1: Early allergy signs
  {
    daysAgo: 29,
    rawInput: "I was sneezing a lot this morning. My nose feels a bit stuffy.",
    symptoms: [
      { snomedCode: "162607003", icdCode: "R06.7", displayName: "Sneezing", severity: "mild" },
      { snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", severity: "mild", bodySite: "Nose" },
    ],
    aiResponse: "With spring approaching, it looks like your allergy symptoms are starting. Wash your face and hands thoroughly after going out, and use an air purifier when ventilating indoors.",
    detailScore: 6, urgencyScore: 0.15, pointsEarned: 15,
  },
  {
    daysAgo: 27,
    rawInput: "My nose keeps running. My eyes are a bit itchy too.",
    symptoms: [
      { snomedCode: "68962001", icdCode: "R09.81", displayName: "Runny nose", severity: "mild", bodySite: "Nose" },
      { snomedCode: "418363000", icdCode: "L29.9", displayName: "Itching", severity: "mild", bodySite: "Eyes" },
    ],
    aiResponse: "These are symptoms of allergic rhinitis and conjunctivitis. Rinse your eyes with artificial tears and consider taking an antihistamine. On days with high pollen counts, avoid going outside.",
    detailScore: 7, urgencyScore: 0.2, pointsEarned: 18,
  },
  {
    daysAgo: 25,
    rawInput: "I had spicy food for lunch and now my stomach feels bloated.",
    symptoms: [
      { snomedCode: "279079003", icdCode: "R14.0", displayName: "Bloating", severity: "mild", bodySite: "Abdomen" },
    ],
    aiResponse: "Spicy food can irritate the stomach. Drink warm water after meals and choose foods that are easy to digest.",
    detailScore: 5, urgencyScore: 0.1, pointsEarned: 12,
  },
  // Week 2: Allergies worsen, digestive issues appear
  {
    daysAgo: 22,
    rawInput: "I'm sneezing more than 20 times a day. My congestion is bad too, and my throat hurts a little.",
    symptoms: [
      { snomedCode: "162607003", icdCode: "R06.7", displayName: "Sneezing", severity: "moderate" },
      { snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", severity: "moderate", bodySite: "Nose" },
      { snomedCode: "162397003", icdCode: "R07.0", displayName: "Sore throat", severity: "mild", bodySite: "Throat" },
    ],
    aiResponse: "Your allergy symptoms are worsening. Try nasal irrigation (a saline rinse) and take your antihistamine consistently. The sore throat may be caused by postnasal drip (mucus running down the back of the nose).",
    detailScore: 8, urgencyScore: 0.35, pointsEarned: 22,
  },
  {
    daysAgo: 21,
    rawInput: "My nose was blocked at night so I couldn't sleep. I'm tired.",
    symptoms: [
      { snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", severity: "moderate", bodySite: "Nose" },
      { snomedCode: "193462001", icdCode: "G47.00", displayName: "Insomnia", severity: "mild" },
      { snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue", severity: "mild" },
    ],
    aiResponse: "Nighttime nasal congestion is lowering your sleep quality. Use a nasal spray before bed and sleep with your head raised on a higher pillow to slightly elevate your upper body.",
    detailScore: 7, urgencyScore: 0.3, pointsEarned: 18,
  },
  {
    daysAgo: 19,
    rawInput: "My stomach hurts often and I had diarrhea. I think I'm stressed too.",
    symptoms: [
      { snomedCode: "22253000", icdCode: "R10.9", displayName: "Abdominal pain", severity: "moderate", bodySite: "Abdomen" },
      { snomedCode: "62315008", icdCode: "R19.7", displayName: "Diarrhea", severity: "moderate" },
      { snomedCode: "73595000", icdCode: "F43.9", displayName: "Stress", severity: "mild" },
    ],
    aiResponse: "Stress and changes in eating habits are causing digestive symptoms. There's a possibility of irritable bowel syndrome (IBS). Cut back on spicy and greasy foods, and try taking probiotics. If symptoms persist for more than a week, I recommend seeing a gastroenterologist.",
    detailScore: 8, urgencyScore: 0.4, pointsEarned: 22,
  },
  {
    daysAgo: 18,
    rawInput: "I got some hives on my arm. It's itchy. I think it's because of allergies.",
    symptoms: [
      { snomedCode: "271767006", icdCode: "L50.9", displayName: "Hives", severity: "moderate", bodySite: "Upper arm" },
      { snomedCode: "418363000", icdCode: "L29.9", displayName: "Itching", severity: "moderate", bodySite: "Upper arm" },
    ],
    aiResponse: "Hives have appeared as an allergic reaction. Take an antihistamine and be careful not to scratch the affected area. If the hives spread to your face or neck, go to the emergency room immediately.",
    detailScore: 7, urgencyScore: 0.45, pointsEarned: 20,
  },
  // Week 3: Medication starts, improvement begins
  {
    daysAgo: 16,
    rawInput: "I went to the ENT clinic. I got an allergy prescription. I started doing nasal rinses too.",
    symptoms: [
      { snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", severity: "moderate", bodySite: "Nose" },
      { snomedCode: "162607003", icdCode: "R06.7", displayName: "Sneezing", severity: "mild" },
    ],
    aiResponse: "Visiting the clinic was a good decision. Take the prescribed medication regularly, and doing nasal rinses every morning and evening should be effective.",
    detailScore: 7, urgencyScore: 0.25, pointsEarned: 18,
  },
  {
    daysAgo: 14,
    rawInput: "The congestion got a bit better after taking the medicine. But I still get occasional stomach pain.",
    symptoms: [
      { snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", severity: "mild", bodySite: "Nose" },
      { snomedCode: "22253000", icdCode: "R10.9", displayName: "Abdominal pain", severity: "mild", bodySite: "Abdomen" },
    ],
    aiResponse: "The allergy medication is starting to work. Since the abdominal pain still lingers, avoid irritating foods and eat regular meals. Probiotics can also help.",
    detailScore: 7, urgencyScore: 0.2, pointsEarned: 18,
  },
  {
    daysAgo: 12,
    rawInput: "I felt a bit nauseous today. I think it's because I skipped breakfast.",
    symptoms: [
      { snomedCode: "422587007", icdCode: "R11.0", displayName: "Nausea", severity: "mild" },
    ],
    aiResponse: "Nausea can occur on an empty stomach. Don't skip breakfast, and I recommend eating at least a small meal. Taking allergy medication on an empty stomach can irritate the stomach, so take it after meals.",
    detailScore: 5, urgencyScore: 0.15, pointsEarned: 12,
  },
  {
    daysAgo: 11,
    rawInput: "My stomach felt better after having a warm fermented-vegetable stew. I guess fermented foods help.",
    symptoms: [],
    aiResponse: "The probiotics in fermented foods support gut health. Regularly eating fermented foods like yogurt, sauerkraut, and miso can be effective at easing digestive symptoms.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  // Week 4: Significant improvement
  {
    daysAgo: 9,
    rawInput: "My allergy symptoms are much better! I'm hardly sneezing, and the congestion has improved.",
    symptoms: [
      { snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", severity: "mild", bodySite: "Nose" },
    ],
    aiResponse: "Your allergies are well managed. Keep taking your medication and doing nasal rinses, and check the pollen forecast to prepare in advance.",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
  {
    daysAgo: 7,
    rawInput: "My digestion is good. I'm taking probiotics every day too.",
    symptoms: [],
    aiResponse: "Your digestive symptoms have stabilized. Consistent probiotic intake and regular meals are paying off. Keep up this habit.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 5,
    rawInput: "Maybe because it's raining today, my nose is a bit tickly. I sneezed a few times.",
    symptoms: [
      { snomedCode: "162607003", icdCode: "R06.7", displayName: "Sneezing", severity: "mild" },
    ],
    aiResponse: "Humidity changes after rain can temporarily trigger allergies. If you keep taking your medication, it should improve quickly.",
    detailScore: 5, urgencyScore: 0.1, pointsEarned: 12,
  },
  {
    daysAgo: 3,
    rawInput: "Feeling good today! Both my allergies and digestion are fine.",
    symptoms: [],
    aiResponse: "Your overall condition is stable. Since the spring allergy season continues, keep up your preventive medication and lifestyle management.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 1,
    rawInput: "I had a late-night snack and now my stomach feels bloated. I should hold back.",
    symptoms: [
      { snomedCode: "279079003", icdCode: "R14.0", displayName: "Bloating", severity: "mild", bodySite: "Abdomen" },
    ],
    aiResponse: "Late-night eating puts a strain on your digestive system. It's especially good to avoid eating 2-3 hours before bed. A light tea (chamomile or peppermint) can help.",
    detailScore: 5, urgencyScore: 0.1, pointsEarned: 12,
  },
  {
    daysAgo: 0,
    rawInput: "Reached a 7-day logging streak today! Both my allergies and digestion are well managed.",
    symptoms: [],
    aiResponse: "Congratulations on a 7-day health logging streak! Your allergy symptoms have improved greatly, and your digestive symptoms have stabilized. Consistent management is key!",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
];

// ────────────────────────────────────────────────────────────────
// USER 3: John Smith (Active Lifestyle — Exercise & Good Health)
// Story: Regular exercise with occasional muscle soreness, minor cough
//        from cold weather running, overall excellent health.
// ────────────────────────────────────────────────────────────────

const user3Entries: EntryDef[] = [
  {
    daysAgo: 29,
    rawInput: "Ran 5K this morning. Feeling great! Slight soreness in calves.",
    symptoms: [
      { snomedCode: "267102003", icdCode: "M79.10", displayName: "Sore muscles", severity: "mild", bodySite: "Calf" },
    ],
    aiResponse: "Mild muscle soreness after a 5K run is normal (DOMS - Delayed Onset Muscle Soreness). Make sure to stretch post-run and stay hydrated. Great job keeping active!",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
  {
    daysAgo: 28,
    rawInput: "Good day. Did some yoga for recovery. Calves feel better.",
    symptoms: [],
    aiResponse: "Active recovery with yoga is excellent for muscle recovery. This helps reduce inflammation and improve flexibility. Keep alternating high and low intensity days.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 26,
    rawInput: "Weight training today. Hit a new PR on deadlifts! Feeling some lower back tightness.",
    symptoms: [
      { snomedCode: "161891005", icdCode: "M54.9", displayName: "Back pain", severity: "mild", bodySite: "Lower back" },
    ],
    aiResponse: "Congratulations on the PR! Mild lower back tightness after heavy deadlifts is common. Make sure your form is correct — consider videoing your lifts. Apply ice if needed and do gentle stretches.",
    detailScore: 7, urgencyScore: 0.15, pointsEarned: 18,
  },
  {
    daysAgo: 24,
    rawInput: "Morning run in cold weather. Got a bit of a dry cough afterward.",
    symptoms: [
      { snomedCode: "49727002", icdCode: "R05", displayName: "Cough", severity: "mild", bodySite: "Throat/Chest" },
    ],
    aiResponse: "Dry cough after running in cold weather is common (exercise-induced bronchospasm). Try breathing through a scarf or buff to warm the air. If it persists, consider seeing a doctor to rule out exercise-induced asthma.",
    detailScore: 6, urgencyScore: 0.15, pointsEarned: 15,
  },
  {
    daysAgo: 22,
    rawInput: "Feeling amazing after a rest day. Slept 8 hours solid.",
    symptoms: [],
    aiResponse: "Excellent! 8 hours of quality sleep is optimal for recovery and performance. Rest days are crucial for muscle repair and preventing overtraining. Your body is recovering well.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 21,
    rawInput: "Knee felt a bit sore during squats today. Stopped early to be safe.",
    symptoms: [
      { snomedCode: "30989003", icdCode: "M25.56", displayName: "Knee pain", severity: "mild", bodySite: "Right knee" },
    ],
    aiResponse: "Smart decision to stop early when you noticed knee discomfort. This could be patellar tendinitis from increased load. Reduce squat weight by 20%, focus on form, and add knee mobility exercises. If pain persists beyond 3 days, see a sports medicine doctor.",
    detailScore: 7, urgencyScore: 0.2, pointsEarned: 18,
  },
  {
    daysAgo: 19,
    rawInput: "Swam 1500m today instead of running. Knee feels much better. Shoulders are a bit tight.",
    symptoms: [
      { snomedCode: "53627009", icdCode: "M25.51", displayName: "Shoulder pain", severity: "mild", bodySite: "Shoulder" },
    ],
    aiResponse: "Swimming is a great low-impact alternative when managing knee issues. Shoulder tightness from swimming is normal — focus on rotator cuff stretches post-swim. Your cross-training approach is very smart.",
    detailScore: 7, urgencyScore: 0.1, pointsEarned: 18,
  },
  {
    daysAgo: 17,
    rawInput: "10K run today! Felt strong throughout. No knee pain at all. Minor calf tightness.",
    symptoms: [
      { snomedCode: "267102003", icdCode: "M79.10", displayName: "Sore muscles", severity: "mild", bodySite: "Calf" },
    ],
    aiResponse: "Great progress with the 10K! No knee pain is an excellent sign. Minor calf tightness is expected after longer distances. Use a foam roller and consider compression socks for recovery.",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
  {
    daysAgo: 16,
    rawInput: "Sore all over from yesterday's run. Good kind of sore though.",
    symptoms: [
      { snomedCode: "267102003", icdCode: "M79.10", displayName: "Sore muscles", severity: "mild", bodySite: "Legs" },
    ],
    aiResponse: "DOMS (Delayed Onset Muscle Soreness) after a 10K is normal. Light movement, stretching, and adequate protein intake (1.6-2.2g/kg body weight) will aid recovery.",
    detailScore: 5, urgencyScore: 0.1, pointsEarned: 12,
  },
  {
    daysAgo: 14,
    rawInput: "Headache this morning. Probably didn't drink enough water yesterday during training.",
    symptoms: [
      { snomedCode: "25064002", icdCode: "R51", displayName: "Headache", severity: "mild", bodySite: "Head" },
    ],
    aiResponse: "Dehydration headaches are common in athletes. Aim to drink water before, during, and after exercise. A good rule: 500ml 2 hours before, 200ml every 20 minutes during, and 500ml after training.",
    detailScore: 6, urgencyScore: 0.15, pointsEarned: 15,
  },
  {
    daysAgo: 12,
    rawInput: "Interval training today. Pushed hard. Heart rate hit 185. Felt a bit dizzy at the end.",
    symptoms: [
      { snomedCode: "404640003", icdCode: "R42", displayName: "Dizziness", severity: "mild" },
    ],
    aiResponse: "Brief dizziness after very high intensity intervals can result from rapid blood pressure changes. Cool down gradually instead of stopping abruptly. If dizziness occurs frequently during exercise, get a cardiac evaluation for safety.",
    detailScore: 7, urgencyScore: 0.3, pointsEarned: 18,
  },
  {
    daysAgo: 10,
    rawInput: "Easy recovery day. 30 minute walk and stretching. Feel fully recovered.",
    symptoms: [],
    aiResponse: "Excellent recovery management. The balance between intense training and recovery days is key to long-term fitness progress and injury prevention.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 9,
    rawInput: "Woke up with a sore throat. Might be getting a cold from the cold weather runs.",
    symptoms: [
      { snomedCode: "162397003", icdCode: "R07.0", displayName: "Sore throat", severity: "mild", bodySite: "Throat" },
    ],
    aiResponse: "Upper respiratory infections are more common in athletes during heavy training periods due to temporary immune suppression. Rest, vitamin C, zinc, and warm fluids. Reduce training intensity until symptoms resolve.",
    detailScore: 6, urgencyScore: 0.2, pointsEarned: 15,
  },
  {
    daysAgo: 8,
    rawInput: "Sore throat still there. Added cough. Resting today. No training.",
    symptoms: [
      { snomedCode: "162397003", icdCode: "R07.0", displayName: "Sore throat", severity: "mild", bodySite: "Throat" },
      { snomedCode: "49727002", icdCode: "R05", displayName: "Cough", severity: "mild" },
    ],
    aiResponse: "Good call on resting. Follow the 'neck check' rule: if symptoms are above the neck (sore throat, runny nose), light exercise is OK. If below the neck (chest congestion, body aches), rest completely.",
    detailScore: 7, urgencyScore: 0.25, pointsEarned: 18,
  },
  {
    daysAgo: 6,
    rawInput: "Feeling better. Throat is almost back to normal. Did a light 20 min walk.",
    symptoms: [
      { snomedCode: "162397003", icdCode: "R07.0", displayName: "Sore throat", severity: "mild", bodySite: "Throat" },
    ],
    aiResponse: "Recovery is progressing well. Gradually increase activity over the next few days. Full training can resume once all symptoms have resolved for 24 hours.",
    detailScore: 5, urgencyScore: 0.1, pointsEarned: 12,
  },
  {
    daysAgo: 5,
    rawInput: "Back to training! Easy 3K run. Felt good, no throat issues.",
    symptoms: [],
    aiResponse: "Great to hear you're back! Wise to start easy. Gradually build back to your pre-illness training volume over the next week. Your body is recovering well.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 4,
    rawInput: "Weight training — upper body focus. Felt strong. No issues.",
    symptoms: [],
    aiResponse: "Solid return to weight training. Upper body focus while continuing to ease back into running is a smart approach. Keep monitoring how you feel.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 3,
    rawInput: "5K run at a good pace. Felt back to normal. Legs felt powerful.",
    symptoms: [],
    aiResponse: "Excellent comeback! Your fitness baseline is strong, allowing for quick recovery. Continue your balanced training approach.",
    detailScore: 5, urgencyScore: 0.05, pointsEarned: 12,
  },
  {
    daysAgo: 2,
    rawInput: "Hip flexor felt tight after stretching session. Need to work on flexibility.",
    symptoms: [
      { snomedCode: "298325004", icdCode: "M25.55", displayName: "Hip pain", severity: "mild", bodySite: "Hip" },
    ],
    aiResponse: "Hip flexor tightness is very common in runners. Daily hip mobility work (90/90 stretches, pigeon pose, hip circles) will help. Consider adding dynamic stretching before runs.",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
  {
    daysAgo: 1,
    rawInput: "Rest day. Ate well, slept 8.5 hours. Feeling ready for tomorrow's long run.",
    symptoms: [],
    aiResponse: "Excellent pre-run preparation. Quality nutrition and sleep are the foundation of athletic performance. Your consistent healthy habits are reflected in your quick recovery.",
    detailScore: 4, urgencyScore: 0.05, pointsEarned: 10,
  },
  {
    daysAgo: 0,
    rawInput: "15K long run completed! New personal distance record. 21 day streak! Feeling unstoppable.",
    symptoms: [
      { snomedCode: "267102003", icdCode: "M79.10", displayName: "Sore muscles", severity: "mild", bodySite: "Legs" },
    ],
    aiResponse: "Incredible achievement — 15K personal record and 21-day streak! Mild muscle soreness is expected. Focus on recovery: protein, hydration, sleep. You're building an impressive fitness foundation!",
    detailScore: 6, urgencyScore: 0.1, pointsEarned: 15,
  },
];

// ── Medication Reminders ───────────────────────────────────────

interface MedicationDef {
  userId: string;
  medicationName: string;
  dosage: string;
  frequency: { times: string[]; instruction: string };
  startDate: Date;
  endDate?: Date;
  source: string;
  isActive: boolean;
}

const medicationReminders: MedicationDef[] = [
  // User 1: Minsu Kim — pain reliever and supplements
  {
    userId: DEMO_USER_1_ID,
    medicationName: "Tylenol (Acetaminophen)",
    dosage: "500mg",
    frequency: { times: ["08:00", "20:00"], instruction: "As needed for headache / after meals" },
    startDate: daysAgo(22),
    endDate: daysAgo(10),
    source: "ai_parsed",
    isActive: false,
  },
  {
    userId: DEMO_USER_1_ID,
    medicationName: "Magnesium",
    dosage: "400mg",
    frequency: { times: ["21:00"], instruction: "Before bed / for sleep quality" },
    startDate: daysAgo(20),
    source: "manual",
    isActive: true,
  },
  {
    userId: DEMO_USER_1_ID,
    medicationName: "Vitamin B Complex",
    dosage: "1 tablet",
    frequency: { times: ["08:00"], instruction: "After breakfast" },
    startDate: daysAgo(15),
    source: "manual",
    isActive: true,
  },
  {
    userId: DEMO_USER_1_ID,
    medicationName: "Omega-3",
    dosage: "1000mg",
    frequency: { times: ["08:00"], instruction: "After breakfast" },
    startDate: daysAgo(15),
    source: "manual",
    isActive: true,
  },
  // User 2: Seoyeon Lee — allergy meds and probiotics
  {
    userId: DEMO_USER_2_ID,
    medicationName: "Cetirizine",
    dosage: "10mg",
    frequency: { times: ["08:00"], instruction: "After breakfast / antihistamine" },
    startDate: daysAgo(16),
    source: "hospital_sync",
    isActive: true,
  },
  {
    userId: DEMO_USER_2_ID,
    medicationName: "Fluticasone Nasal Spray",
    dosage: "50mcg, 2 sprays",
    frequency: { times: ["08:00", "20:00"], instruction: "Nasal spray morning and evening" },
    startDate: daysAgo(16),
    source: "hospital_sync",
    isActive: true,
  },
  {
    userId: DEMO_USER_2_ID,
    medicationName: "Probiotics (Lactobacillus)",
    dosage: "1 capsule",
    frequency: { times: ["08:00"], instruction: "On empty stomach or before meals" },
    startDate: daysAgo(14),
    source: "manual",
    isActive: true,
  },
  {
    userId: DEMO_USER_2_ID,
    medicationName: "Antacid (Almagel)",
    dosage: "15ml",
    frequency: { times: ["12:30", "19:30"], instruction: "30 min after meals / for heartburn" },
    startDate: daysAgo(19),
    endDate: daysAgo(10),
    source: "ai_parsed",
    isActive: false,
  },
  // User 3: John — sports supplements
  {
    userId: DEMO_USER_3_ID,
    medicationName: "Vitamin D3",
    dosage: "2000 IU",
    frequency: { times: ["08:00"], instruction: "With breakfast" },
    startDate: daysAgo(60),
    source: "manual",
    isActive: true,
  },
  {
    userId: DEMO_USER_3_ID,
    medicationName: "Fish Oil (Omega-3)",
    dosage: "1200mg",
    frequency: { times: ["08:00"], instruction: "With food" },
    startDate: daysAgo(60),
    source: "manual",
    isActive: true,
  },
  {
    userId: DEMO_USER_3_ID,
    medicationName: "Zinc",
    dosage: "25mg",
    frequency: { times: ["20:00"], instruction: "With dinner, during cold" },
    startDate: daysAgo(9),
    endDate: daysAgo(5),
    source: "ai_parsed",
    isActive: false,
  },
  {
    userId: DEMO_USER_3_ID,
    medicationName: "Creatine Monohydrate",
    dosage: "5g",
    frequency: { times: ["08:00"], instruction: "Daily, with water" },
    startDate: daysAgo(30),
    source: "manual",
    isActive: true,
  },
  {
    userId: DEMO_USER_3_ID,
    medicationName: "Magnesium Glycinate",
    dosage: "300mg",
    frequency: { times: ["21:00"], instruction: "Before bed, for recovery" },
    startDate: daysAgo(30),
    source: "manual",
    isActive: true,
  },
];

// ── Reward Transactions ────────────────────────────────────────

interface PointTransactionDef {
  userId: string;
  amount: number;
  type: string;
  description: string;
  daysAgo: number;
}

const pointTransactions: PointTransactionDef[] = [
  // User 1 rewards
  { userId: DEMO_USER_1_ID, amount: 50, type: "HEALTH_LOG", description: "Daily health entry", daysAgo: 29 },
  { userId: DEMO_USER_1_ID, amount: 100, type: "STREAK_BONUS", description: "7-day streak bonus (1.5x)", daysAgo: 22 },
  { userId: DEMO_USER_1_ID, amount: 200, type: "STREAK_BONUS", description: "14-day streak bonus (2.0x)", daysAgo: 15 },
  { userId: DEMO_USER_1_ID, amount: 30, type: "QUIZ_CORRECT", description: "Quiz reward (nutrition)", daysAgo: 20 },
  { userId: DEMO_USER_1_ID, amount: 50, type: "DAILY_TIP_VIEW", description: "Course completed: Understanding Your Body", daysAgo: 10 },
  // User 2 rewards
  { userId: DEMO_USER_2_ID, amount: 50, type: "HEALTH_LOG", description: "Daily health entry", daysAgo: 29 },
  { userId: DEMO_USER_2_ID, amount: 100, type: "STREAK_BONUS", description: "7-day streak bonus (1.5x)", daysAgo: 22 },
  { userId: DEMO_USER_2_ID, amount: 25, type: "QUIZ_CORRECT", description: "Quiz reward (general)", daysAgo: 18 },
  { userId: DEMO_USER_2_ID, amount: 15, type: "REFERRAL", description: "Referral bonus", daysAgo: 5 },
  // User 3 rewards
  { userId: DEMO_USER_3_ID, amount: 50, type: "HEALTH_LOG", description: "Daily health entry", daysAgo: 29 },
  { userId: DEMO_USER_3_ID, amount: 100, type: "STREAK_BONUS", description: "7-day streak bonus (1.5x)", daysAgo: 22 },
  { userId: DEMO_USER_3_ID, amount: 200, type: "STREAK_BONUS", description: "14-day streak bonus (2.0x)", daysAgo: 15 },
  { userId: DEMO_USER_3_ID, amount: 300, type: "STREAK_BONUS", description: "21-day streak bonus (2.5x)", daysAgo: 8 },
  { userId: DEMO_USER_3_ID, amount: 50, type: "DAILY_TIP_VIEW", description: "Course completed: Digital Health Literacy", daysAgo: 12 },
  { userId: DEMO_USER_3_ID, amount: 80, type: "QUIZ_CORRECT", description: "Quiz reward (exercise)", daysAgo: 10 },
];

// ── Main Seed Function ─────────────────────────────────────────

async function seedDemoData() {
  console.log("=== Demo Data Seed Script ===");
  console.log("Seeding demo data for 3 users with 30 days of health records...\n");

  // 1. Clean existing demo data
  console.log("[1/7] Cleaning existing demo data...");
  const demoUserIds = [DEMO_USER_1_ID, DEMO_USER_2_ID, DEMO_USER_3_ID];

  // Delete in correct order due to foreign key constraints
  for (const userId of demoUserIds) {
    await prisma.quizSubmission.deleteMany({ where: { userId } });
    await prisma.courseProgress.deleteMany({ where: { userId } });
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.medicationReminder.deleteMany({ where: { userId } });
    await prisma.dataConsent.deleteMany({ where: { userId } });

    // Delete symptom logs for this user's health entries
    const entryIds = await prisma.healthEntry.findMany({
      where: { userId },
      select: { id: true },
    });
    if (entryIds.length > 0) {
      await prisma.symptomLog.deleteMany({
        where: { entryId: { in: entryIds.map((e) => e.id) } },
      });
    }
    await prisma.healthEntry.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  console.log("  Existing demo data cleaned.\n");

  // 2. Create demo users
  console.log("[2/7] Creating demo users...");
  for (const user of demoUsers) {
    await prisma.user.create({ data: user });
  }
  console.log(`  Created ${demoUsers.length} demo users.\n`);

  // 3. Create health entries and symptom logs
  console.log("[3/7] Creating health entries and symptom logs...");

  async function createEntriesForUser(userId: string, entries: EntryDef[]) {
    let entryCount = 0;
    let symptomCount = 0;

    for (const entry of entries) {
      const entryDate = daysAgo(entry.daysAgo);
      const symptoms = entry.symptoms.map((s) => ({
        snomedCode: s.snomedCode,
        display: s.displayName,
        severity: s.severity,
      }));
      const bundle = fhirBundle(symptoms);

      const healthEntry = await prisma.healthEntry.create({
        data: {
          userId,
          rawInput: entry.rawInput,
          fhirBundle: bundle,
          aiResponse: entry.aiResponse,
          detailScore: entry.detailScore,
          urgencyScore: entry.urgencyScore,
          pointsEarned: entry.pointsEarned,
          entryDate,
          createdAt: entryDate,
        },
      });
      entryCount++;

      // Create symptom logs
      for (const symptom of entry.symptoms) {
        await prisma.symptomLog.create({
          data: {
            entryId: healthEntry.id,
            snomedCode: symptom.snomedCode,
            icdCode: symptom.icdCode,
            displayName: symptom.displayName,
            severity: symptom.severity,
            bodySite: symptom.bodySite ?? null,
            onsetDate: entryDate,
          },
        });
        symptomCount++;
      }
    }

    return { entryCount, symptomCount };
  }

  const u1Stats = await createEntriesForUser(DEMO_USER_1_ID, user1Entries);
  const u2Stats = await createEntriesForUser(DEMO_USER_2_ID, user2Entries);
  const u3Stats = await createEntriesForUser(DEMO_USER_3_ID, user3Entries);

  const totalEntries = u1Stats.entryCount + u2Stats.entryCount + u3Stats.entryCount;
  const totalSymptoms = u1Stats.symptomCount + u2Stats.symptomCount + u3Stats.symptomCount;
  console.log(`  Created ${totalEntries} health entries.`);
  console.log(`  Created ${totalSymptoms} symptom logs.\n`);

  // 4. Create medication reminders
  console.log("[4/7] Creating medication reminders...");
  for (const med of medicationReminders) {
    await prisma.medicationReminder.create({
      data: {
        userId: med.userId,
        medicationName: med.medicationName,
        dosage: med.dosage,
        frequency: med.frequency,
        startDate: med.startDate,
        endDate: med.endDate ?? null,
        source: med.source,
        isActive: med.isActive,
      },
    });
  }
  console.log(`  Created ${medicationReminders.length} medication reminders.\n`);

  // 5. Create quiz submissions (need existing quiz questions)
  console.log("[5/7] Creating quiz submissions...");
  const existingQuizzes = await prisma.quizQuestion.findMany({ take: 15 });

  if (existingQuizzes.length > 0) {
    const quizSubmissions: Array<{
      userId: string;
      quizId: string;
      selectedIndex: number;
      isCorrect: boolean;
      rewardEarned: number;
      createdAt: Date;
    }> = [];

    // User 1: answered 8 quizzes (6 correct)
    for (let i = 0; i < Math.min(8, existingQuizzes.length); i++) {
      const quiz = existingQuizzes[i];
      const isCorrect = i !== 2 && i !== 5; // wrong on 3rd and 6th
      quizSubmissions.push({
        userId: DEMO_USER_1_ID,
        quizId: quiz.id,
        selectedIndex: isCorrect ? quiz.correctIndex : (quiz.correctIndex + 1) % 4,
        isCorrect,
        rewardEarned: isCorrect ? quiz.rewardAmount : 0,
        createdAt: daysAgo(25 - i * 3),
      });
    }

    // User 2: answered 5 quizzes (4 correct)
    for (let i = 0; i < Math.min(5, existingQuizzes.length); i++) {
      const quiz = existingQuizzes[i + 3]; // different set
      if (!quiz) break;
      const isCorrect = i !== 1;
      quizSubmissions.push({
        userId: DEMO_USER_2_ID,
        quizId: quiz.id,
        selectedIndex: isCorrect ? quiz.correctIndex : (quiz.correctIndex + 2) % 4,
        isCorrect,
        rewardEarned: isCorrect ? quiz.rewardAmount : 0,
        createdAt: daysAgo(20 - i * 4),
      });
    }

    // User 3: answered 10 quizzes (9 correct — health-savvy)
    for (let i = 0; i < Math.min(10, existingQuizzes.length); i++) {
      const quiz = existingQuizzes[i];
      const isCorrect = i !== 4; // only wrong on 5th
      quizSubmissions.push({
        userId: DEMO_USER_3_ID,
        quizId: quiz.id,
        selectedIndex: isCorrect ? quiz.correctIndex : (quiz.correctIndex + 1) % 4,
        isCorrect,
        rewardEarned: isCorrect ? quiz.rewardAmount : 0,
        createdAt: daysAgo(28 - i * 2),
      });
    }

    for (const sub of quizSubmissions) {
      try {
        await prisma.quizSubmission.create({ data: sub });
      } catch {
        // Skip duplicates (unique constraint on userId + quizId)
      }
    }
    console.log(`  Created ${quizSubmissions.length} quiz submissions.\n`);
  } else {
    console.log("  No quiz questions found. Run seed.ts first to create quiz questions.\n");
  }

  // 6. Create point transactions
  console.log("[6/7] Creating point transactions...");
  for (const pt of pointTransactions) {
    await prisma.pointTransaction.create({
      data: {
        userId: pt.userId,
        amount: pt.amount,
        type: pt.type as any,
        description: pt.description,
        createdAt: daysAgo(pt.daysAgo),
      },
    });
  }
  console.log(`  Created ${pointTransactions.length} point transactions.\n`);

  // 7. Create course progress
  console.log("[7/7] Creating course progress...");
  const existingCourses = await prisma.course.findMany({ take: 3 });

  if (existingCourses.length > 0) {
    const courseProgressData = [];

    // User 1: completed course 1, started course 2
    if (existingCourses[0]) {
      courseProgressData.push({
        userId: DEMO_USER_1_ID,
        courseId: existingCourses[0].id,
        completedModules: [0, 1, 2, 3, 4],
        isCompleted: true,
        rewardClaimed: true,
        startedAt: daysAgo(20),
        completedAt: daysAgo(10),
      });
    }
    if (existingCourses[1]) {
      courseProgressData.push({
        userId: DEMO_USER_1_ID,
        courseId: existingCourses[1].id,
        completedModules: [0, 1],
        isCompleted: false,
        rewardClaimed: false,
        startedAt: daysAgo(8),
      });
    }

    // User 2: started course 1
    if (existingCourses[0]) {
      courseProgressData.push({
        userId: DEMO_USER_2_ID,
        courseId: existingCourses[0].id,
        completedModules: [0, 1, 2],
        isCompleted: false,
        rewardClaimed: false,
        startedAt: daysAgo(15),
      });
    }

    // User 3: completed course 1 and 3, started course 2
    if (existingCourses[0]) {
      courseProgressData.push({
        userId: DEMO_USER_3_ID,
        courseId: existingCourses[0].id,
        completedModules: [0, 1, 2, 3, 4],
        isCompleted: true,
        rewardClaimed: true,
        startedAt: daysAgo(40),
        completedAt: daysAgo(30),
      });
    }
    if (existingCourses[2]) {
      courseProgressData.push({
        userId: DEMO_USER_3_ID,
        courseId: existingCourses[2].id,
        completedModules: [0, 1, 2],
        isCompleted: true,
        rewardClaimed: true,
        startedAt: daysAgo(25),
        completedAt: daysAgo(12),
      });
    }
    if (existingCourses[1]) {
      courseProgressData.push({
        userId: DEMO_USER_3_ID,
        courseId: existingCourses[1].id,
        completedModules: [0, 1],
        isCompleted: false,
        rewardClaimed: false,
        startedAt: daysAgo(10),
      });
    }

    for (const progress of courseProgressData) {
      try {
        await prisma.courseProgress.create({ data: progress });
      } catch {
        // Skip duplicates
      }
    }
    console.log(`  Created ${courseProgressData.length} course progress records.\n`);
  } else {
    console.log("  No courses found. Run seed.ts first to create courses.\n");
  }

  // Summary
  console.log("=== Demo Data Seed Complete ===");
  console.log("");
  console.log("Demo Users:");
  console.log("  1. Kim Minsu (demo-user-1) — Office worker, stress headaches, Level 5, 14-day streak");
  console.log("  2. Lee Seoyeon (demo-user-2) — Seasonal allergies + digestive issues, Level 3, 7-day streak");
  console.log("  3. John Smith (demo-user-3) — Active athlete, exercise soreness, Level 8, 21-day streak");
  console.log("");
  console.log(`Total: ${totalEntries} health entries, ${totalSymptoms} symptom logs, ${medicationReminders.length} medications, ${pointTransactions.length} point transactions`);
}

seedDemoData()
  .catch((e) => {
    console.error("Demo seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
