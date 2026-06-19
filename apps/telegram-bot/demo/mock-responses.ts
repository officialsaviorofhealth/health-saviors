/**
 * Mock API Responses for Demo Mode
 *
 * Provides realistic mock responses when the backend API is not running.
 * Supports keyword-based symptom detection in English.
 */

import type {
  ChatResponse,
  AnalyticsDashboard,
  QuizResponse,
  QuizSubmitResponse,
  UserProfile,
} from "../src/api-client";

// ── Symptom Detection Keywords ─────────────────────────────────

interface SymptomKeyword {
  keywords: string[];
  snomedCode: string;
  icdCode: string;
  displayName: string;
  bodySite?: string;
}

const symptomKeywords: SymptomKeyword[] = [
  { keywords: ["headache", "head hurts", "head ache", "migraine", "temples"], snomedCode: "25064002", icdCode: "R51", displayName: "Headache", bodySite: "Head" },
  { keywords: ["fatigue", "tired", "exhausted", "no energy", "worn out"], snomedCode: "84229001", icdCode: "R53.83", displayName: "Fatigue" },
  { keywords: ["fever", "feverish", "temperature", "chills"], snomedCode: "386661006", icdCode: "R50.9", displayName: "Fever" },
  { keywords: ["sore throat", "throat hurts", "throat pain", "scratchy throat"], snomedCode: "162397003", icdCode: "R07.0", displayName: "Sore throat", bodySite: "Throat" },
  { keywords: ["cough", "coughing"], snomedCode: "49727002", icdCode: "R05", displayName: "Cough" },
  { keywords: ["nausea", "nauseous", "queasy"], snomedCode: "422587007", icdCode: "R11.0", displayName: "Nausea" },
  { keywords: ["joint pain", "joints", "joint ache"], snomedCode: "57676002", icdCode: "M25.50", displayName: "Joint pain" },
  { keywords: ["dizzy", "dizziness", "lightheaded", "vertigo"], snomedCode: "404640003", icdCode: "R42", displayName: "Dizziness" },
  { keywords: ["shortness of breath", "can't breathe", "hard to breathe", "short of breath"], snomedCode: "267036007", icdCode: "R06.00", displayName: "Shortness of breath" },
  { keywords: ["insomnia", "can't sleep", "trouble sleeping", "sleep", "couldn't sleep"], snomedCode: "193462001", icdCode: "G47.00", displayName: "Insomnia" },
  { keywords: ["depression", "depressed", "sad", "down", "no motivation"], snomedCode: "35489007", icdCode: "F32.9", displayName: "Depression" },
  { keywords: ["muscle", "sore muscles", "achy", "stiff", "sore"], snomedCode: "267102003", icdCode: "M79.10", displayName: "Sore muscles" },
  { keywords: ["abdominal", "stomach", "stomach ache", "stomach hurts", "belly", "tummy"], snomedCode: "22253000", icdCode: "R10.9", displayName: "Abdominal pain", bodySite: "Abdomen" },
  { keywords: ["diarrhea"], snomedCode: "62315008", icdCode: "R19.7", displayName: "Diarrhea" },
  { keywords: ["itch", "itchy", "itching", "allergy"], snomedCode: "418363000", icdCode: "L29.9", displayName: "Itching" },
  { keywords: ["nasal", "stuffy nose", "blocked nose", "congestion"], snomedCode: "64531003", icdCode: "R09.81", displayName: "Nasal congestion", bodySite: "Nose" },
  { keywords: ["sneez", "sneezing"], snomedCode: "162607003", icdCode: "R06.7", displayName: "Sneezing" },
  { keywords: ["bloat", "bloated", "distended", "gas"], snomedCode: "279079003", icdCode: "R14.0", displayName: "Bloating", bodySite: "Abdomen" },
  { keywords: ["stress", "stressed"], snomedCode: "73595000", icdCode: "F43.9", displayName: "Stress" },
  { keywords: ["back pain", "backache", "lower back", "back hurts"], snomedCode: "161891005", icdCode: "M54.9", displayName: "Back pain", bodySite: "Lower back" },
  { keywords: ["neck pain", "neck stiff", "stiff neck", "neck hurts"], snomedCode: "81680005", icdCode: "M54.2", displayName: "Neck pain", bodySite: "Neck" },
  { keywords: ["chest pain", "chest hurts", "chest tight", "chest pressure"], snomedCode: "29857009", icdCode: "R07.9", displayName: "Chest pain", bodySite: "Chest" },
  { keywords: ["knee"], snomedCode: "30989003", icdCode: "M25.56", displayName: "Knee pain", bodySite: "Knee" },
  { keywords: ["shoulder"], snomedCode: "53627009", icdCode: "M25.51", displayName: "Shoulder pain", bodySite: "Shoulder" },
  { keywords: ["runny nose"], snomedCode: "68962001", icdCode: "R09.81", displayName: "Runny nose", bodySite: "Nose" },
  { keywords: ["blurred vision", "blurry vision", "vision blurry", "blurry"], snomedCode: "246636008", icdCode: "H53.8", displayName: "Blurred vision" },
  { keywords: ["numb", "numbness", "tingling"], snomedCode: "95388000", icdCode: "R20.2", displayName: "Numbness" },
  { keywords: ["vomit", "vomiting", "threw up", "throwing up"], snomedCode: "422400008", icdCode: "R11.10", displayName: "Vomiting" },
  { keywords: ["rash", "hives"], snomedCode: "271767006", icdCode: "L50.9", displayName: "Hives/Rash" },
  { keywords: ["anxiet", "anxious", "worried", "tense"], snomedCode: "247592009", icdCode: "F41.9", displayName: "Anxiety" },
  { keywords: ["palpitation", "heart pounding", "racing heart"], snomedCode: "162116003", icdCode: "R00.2", displayName: "Palpitations" },
];

// ── AI Response Templates ──────────────────────────────────────

interface AIResponseTemplate {
  triggerSymptoms: string[];   // SNOMED codes that trigger this template
  response: string;
  urgencyScore: number;
  detailScore: number;
  isSafetyAlert: boolean;
}

const aiResponseTemplates: AIResponseTemplate[] = [
  {
    triggerSymptoms: ["29857009", "267036007"],  // Chest pain + SOB
    response: "[URGENT SAFETY ALERT]\nChest pain combined with shortness of breath may indicate a cardiovascular emergency.\n\nTake immediate action:\n1. Call your local emergency number\n2. Chew one aspirin if available\n3. Sit or recline in a comfortable position",
    urgencyScore: 0.95,
    detailScore: 9,
    isSafetyAlert: true,
  },
  {
    triggerSymptoms: ["25064002", "73595000"],  // Headache + Stress
    response: "This appears to be a tension headache caused by stress. Try the 4-7-8 breathing technique: inhale 4 seconds, hold 7 seconds, exhale 8 seconds. Regular stretching and adequate hydration can also help.",
    urgencyScore: 0.35,
    detailScore: 7,
    isSafetyAlert: false,
  },
  {
    triggerSymptoms: ["25064002", "193462001"],  // Headache + Insomnia
    response: "Sleep deprivation appears to be contributing to your headaches. Establishing a consistent sleep schedule and avoiding screens before bed is important.",
    urgencyScore: 0.3,
    detailScore: 7,
    isSafetyAlert: false,
  },
  {
    triggerSymptoms: ["162607003", "64531003"],  // Sneezing + Nasal congestion
    response: "These appear to be allergic rhinitis symptoms. Wash your face after going outside and consider nasal irrigation. Take antihistamines if needed and avoid going out on high pollen days.",
    urgencyScore: 0.2,
    detailScore: 7,
    isSafetyAlert: false,
  },
  {
    triggerSymptoms: ["22253000", "62315008"],  // Abdominal pain + Diarrhea
    response: "You're experiencing gastrointestinal symptoms. Avoid spicy or greasy foods and stay well hydrated. Probiotics may help. If symptoms persist for more than 3 days, see a gastroenterologist.",
    urgencyScore: 0.35,
    detailScore: 8,
    isSafetyAlert: false,
  },
  {
    triggerSymptoms: ["162397003", "49727002", "386661006"],  // Sore throat + Cough + Fever
    response: "These symptoms suggest an upper respiratory infection (cold). Rest and hydration are key. Take antipyretics if temperature exceeds 38.5C. See a doctor if symptoms persist beyond 5 days.",
    urgencyScore: 0.3,
    detailScore: 8,
    isSafetyAlert: false,
  },
  {
    triggerSymptoms: ["267102003"],  // Sore muscles
    response: "This appears to be exercise-induced muscle soreness (DOMS). Light stretching, foam rolling, and adequate protein intake will aid recovery.",
    urgencyScore: 0.1,
    detailScore: 6,
    isSafetyAlert: false,
  },
  {
    triggerSymptoms: ["35489007"],  // Depression
    response: "If depressive feelings persist, please consider speaking with a mental health professional. Reach out to your local crisis hotline. You are not alone.",
    urgencyScore: 0.5,
    detailScore: 7,
    isSafetyAlert: true,
  },
];

// ── Helper: Detect Symptoms from Message ───────────────────────

function detectSymptoms(message: string): Array<{
  snomedCode: string;
  icdCode: string;
  name: string;
  severity: string;
  bodySite?: string;
}> {
  const lowerMsg = message.toLowerCase();
  const detected: Array<{
    snomedCode: string;
    icdCode: string;
    name: string;
    severity: string;
    bodySite?: string;
  }> = [];

  for (const symptom of symptomKeywords) {
    for (const keyword of symptom.keywords) {
      if (lowerMsg.includes(keyword.toLowerCase())) {
        // Determine severity based on intensity keywords
        let severity = "mild";
        if (
          lowerMsg.includes("severe") ||
          lowerMsg.includes("terrible") ||
          lowerMsg.includes("really bad") ||
          lowerMsg.includes("so much") ||
          lowerMsg.includes("very")
        ) {
          severity = "severe";
        } else if (
          lowerMsg.includes("slight") ||
          lowerMsg.includes("mild") ||
          lowerMsg.includes("a bit") ||
          lowerMsg.includes("a little") ||
          lowerMsg.includes("somewhat")
        ) {
          severity = "mild";
        } else {
          severity = "moderate";
        }

        detected.push({
          snomedCode: symptom.snomedCode,
          icdCode: symptom.icdCode,
          name: symptom.displayName,
          severity,
          bodySite: symptom.bodySite,
        });
        break; // Only match first keyword per symptom
      }
    }
  }

  return detected;
}

// ── Helper: Find Best AI Response ──────────────────────────────

function findBestResponse(
  detectedCodes: string[],
): { text: string; urgencyScore: number; detailScore: number; isSafetyAlert: boolean } {
  // Try to find a template that matches the most detected symptoms
  let bestMatch: AIResponseTemplate | null = null;
  let bestMatchCount = 0;

  for (const template of aiResponseTemplates) {
    const matchCount = template.triggerSymptoms.filter((code) =>
      detectedCodes.includes(code),
    ).length;
    if (matchCount > bestMatchCount && matchCount === template.triggerSymptoms.length) {
      bestMatch = template;
      bestMatchCount = matchCount;
    }
  }

  if (bestMatch) {
    return {
      text: bestMatch.response,
      urgencyScore: bestMatch.urgencyScore,
      detailScore: bestMatch.detailScore,
      isSafetyAlert: bestMatch.isSafetyAlert,
    };
  }

  // Default generic response
  return {
    text:
      "Your symptoms have been recorded. Monitor any changes closely and visit a healthcare provider if symptoms worsen. Rest and stay hydrated.",
    urgencyScore: 0.2,
    detailScore: 6,
    isSafetyAlert: false,
  };
}

// ── Mock User Data ─────────────────────────────────────────────

interface MockUser {
  id: string;
  walletAddress: string;
  streakDays: number;
  level: number;
  totalPoints: string;
  language: "ko" | "en";
  name: string;
}

const mockUsers: Record<string, MockUser> = {
  default: {
    id: "d1000000-0000-0000-0000-000000000001",
    walletAddress: "0xTG00000000000000000000000000000tg_demo_001",
    streakDays: 14,
    level: 5,
    totalPoints: "2450",
    language: "en",
    name: "Alex",
  },
};

let currentUser: MockUser = mockUsers.default;

// ── Mock Quiz Pool ─────────────────────────────────────────────

interface MockQuiz {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
  rewardAmount: number;
}

const mockQuizPool: MockQuiz[] = [
  {
    id: "demo-quiz-001",
    question: "What is NOT a major source of Vitamin D?",
    options: ["Sunlight", "Salmon", "Milk", "Apples"],
    correctIndex: 3,
    explanation: "Apples are rich in vitamin C, but not a significant source of vitamin D. Major sources are sunlight, fatty fish, and fortified dairy.",
    difficulty: "easy",
    rewardAmount: 5,
  },
  {
    id: "demo-quiz-002",
    question: "What is the recommended daily walking time for heart health?",
    options: ["10 minutes", "30 minutes", "60 minutes", "90 minutes"],
    correctIndex: 1,
    explanation: "30 minutes of brisk walking daily can reduce cardiovascular disease risk by 35%.",
    difficulty: "easy",
    rewardAmount: 5,
  },
  {
    id: "demo-quiz-003",
    question: "How many hours of sleep do most adults need?",
    options: ["4-5 hours", "5-6 hours", "7-9 hours", "10-12 hours"],
    correctIndex: 2,
    explanation: "Most adults need 7-9 hours of sleep per night for optimal health and cognitive function.",
    difficulty: "easy",
    rewardAmount: 5,
  },
  {
    id: "demo-quiz-004",
    question: "Which breathing technique is known for stress relief?",
    options: ["2-2-2 breathing", "4-7-8 breathing", "10-10-10 breathing", "1-1-1 breathing"],
    correctIndex: 1,
    explanation: "4-7-8 breathing: Inhale 4 seconds, hold 7 seconds, exhale 8 seconds. Activates parasympathetic system.",
    difficulty: "medium",
    rewardAmount: 8,
  },
  {
    id: "demo-quiz-005",
    question: "What percentage of max heart rate is recommended for moderate exercise?",
    options: ["30-40%", "50-70%", "80-90%", "95-100%"],
    correctIndex: 1,
    explanation: "Moderate exercise targets 50-70% of your maximum heart rate (220 - age).",
    difficulty: "medium",
    rewardAmount: 8,
  },
  {
    id: "demo-quiz-006",
    question: "Which mineral deficiency commonly causes fatigue?",
    options: ["Calcium", "Iron", "Sodium", "Potassium"],
    correctIndex: 1,
    explanation: "Iron deficiency is the most common nutritional deficiency worldwide and a leading cause of fatigue.",
    difficulty: "medium",
    rewardAmount: 8,
  },
  {
    id: "demo-quiz-007",
    question: "What is SNOMED CT?",
    options: ["Food nutrition tracking", "Medical terminology coding", "Exercise measurement", "Weather forecasting"],
    correctIndex: 1,
    explanation: "SNOMED CT (Clinical Terms) is a comprehensive medical terminology system used worldwide for clinical documentation.",
    difficulty: "hard",
    rewardAmount: 10,
  },
];

let quizIndex = 0;

// ── Public Mock API Functions ──────────────────────────────────

/**
 * Mock chat endpoint — accepts a free-text health message and returns
 * AI-analyzed response with detected symptoms and SNOMED codes.
 */
export function mockChat(
  message: string,
  language: "ko" | "en" = "en",
): ChatResponse {
  const detected = detectSymptoms(message);
  const detectedCodes = detected.map((d) => d.snomedCode);
  const aiResult = findBestResponse(detectedCodes);

  const pointsEarned = Math.max(10, detected.length * 5 + aiResult.detailScore);

  if (detected.length === 0) {
    // No symptoms detected — could be a wellness check or general message
    return {
      success: true,
      data: {
        entryId: `demo-entry-${Date.now()}`,
        aiResult: {
          symptoms: [],
          medications: [],
          urgencyLevel: "low",
          detailScore: 4,
          educationResponse:
            "You seem to be in good health. Sharing more details about your mood or activities will help me provide more accurate analysis.",
          patternInsights: [
            "Consistent health tracking is important. Keep your daily records going!",
          ],
        },
        rewardEarned: 10,
        currentStreak: currentUser.streakDays,
      },
    };
  }

  return {
    success: true,
    data: {
      entryId: `demo-entry-${Date.now()}`,
      aiResult: {
        symptoms: detected.map((d) => ({
          name: d.name,
          snomedCode: d.snomedCode,
          icdCode: d.icdCode,
          severity: d.severity,
          bodySite: d.bodySite,
        })),
        medications: [],
        urgencyLevel:
          aiResult.urgencyScore >= 0.7
            ? "high"
            : aiResult.urgencyScore >= 0.4
              ? "medium"
              : "low",
        detailScore: aiResult.detailScore,
        educationResponse: aiResult.text,
        safetyAlert: aiResult.isSafetyAlert
          ? "Please consult a medical professional immediately for this symptom combination."
          : undefined,
        medicationWarnings:
          message.includes("medication") || message.includes("medicine") || message.includes("pill")
            ? [
                "Watch for ingredient overlap when taking multiple medications. Acetaminophen in particular is found in many products.",
              ]
            : undefined,
        patternInsights: [
          `${detected[0].name} symptoms have been recurring over the past 30 days.`,
        ],
        scoreBreakdown: {
          symptomDetail: Math.min(4, detected.length * 2),
          temporalInfo: message.match(/today|yesterday|morning|evening/) ? 2 : 0,
          contextInfo: message.length > 50 ? 2 : 1,
          bodyLocation: detected.some((d) => d.bodySite) ? 1 : 0,
          severityInfo: detected.some((d) => d.severity !== "moderate") ? 1 : 0,
        },
      },
      rewardEarned: pointsEarned,
      currentStreak: currentUser.streakDays,
    },
  };
}

/**
 * Mock analytics dashboard endpoint.
 */
export function mockAnalytics(
  userId?: string,
  language: "ko" | "en" = "en",
): AnalyticsDashboard {
  const levelTitles: Record<number, { title: string }> = {
    1: { title: "Health Beginner" },
    2: { title: "Health Learner" },
    3: { title: "Health Tracker" },
    4: { title: "Health Enthusiast" },
    5: { title: "Health Manager" },
    6: { title: "Health Advocate" },
    7: { title: "Health Mentor" },
    8: { title: "Health Expert" },
    9: { title: "Health Master" },
    10: { title: "Health Champion" },
  };

  const user = currentUser;
  const levelInfo = levelTitles[user.level] || levelTitles[1]!;

  return {
    success: true,
    data: {
      streak: {
        current: user.streakDays,
        best: Math.max(user.streakDays, 21),
        multiplier: user.streakDays >= 21 ? 2.5 : user.streakDays >= 14 ? 2.0 : user.streakDays >= 7 ? 1.5 : 1.0,
      },
      level: {
        current: user.level,
        title: levelInfo.title,
        progress: 0.65,
      },
      points: {
        total: user.totalPoints,
        thisWeek: 180,
        thisMonth: 680,
      },
      entries: {
        total: 24,
        thisWeek: 5,
        thisMonth: 18,
      },
      recentSymptoms: [
        {
          displayName: "Headache",
          severity: "mild",
          snomedCode: "25064002",
          onsetDate: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          displayName: "Fatigue",
          severity: "mild",
          snomedCode: "84229001",
          onsetDate: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          displayName: "Neck pain",
          severity: "mild",
          snomedCode: "81680005",
          onsetDate: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    },
  };
}

/**
 * Mock daily quiz endpoint.
 */
export function mockGetQuiz(language: "ko" | "en" = "en"): QuizResponse {
  const quiz = mockQuizPool[quizIndex % mockQuizPool.length]!;
  return {
    success: true,
    data: {
      id: quiz.id,
      question: quiz.question,
      options: quiz.options,
      difficulty: quiz.difficulty,
      rewardAmount: quiz.rewardAmount,
    },
  };
}

/**
 * Mock quiz submission endpoint.
 */
export function mockSubmitQuiz(
  quizId: string,
  selectedIndex: number,
): QuizSubmitResponse {
  const quiz = mockQuizPool.find((q) => q.id === quizId) || mockQuizPool[0]!;
  const isCorrect = selectedIndex === quiz.correctIndex;

  // Advance to next quiz for subsequent calls
  quizIndex++;

  return {
    success: true,
    data: {
      correct: isCorrect,
      correctIndex: quiz.correctIndex,
      explanation: quiz.explanation,
      rewardEarned: isCorrect ? quiz.rewardAmount : 0,
    },
  };
}

/**
 * Mock user registration / profile endpoint.
 */
export function mockRegisterUser(telegramUserId: string): UserProfile {
  return {
    success: true,
    data: {
      id: currentUser.id,
      walletAddress: currentUser.walletAddress,
      streakDays: currentUser.streakDays,
      level: currentUser.level,
      totalPoints: currentUser.totalPoints,
      language: currentUser.language,
    },
  };
}

/**
 * Mock daily tip endpoint.
 */
export function mockGetDailyTip(language: "ko" | "en" = "en") {
  const tips = [
    {
      id: "demo-tip-001",
      title: "Stay Hydrated",
      content: "Aim for 8 glasses of water daily. Proper hydration aids digestion, circulation, and brain function.",
      category: "general",
      rewardH2E: 2,
    },
    {
      id: "demo-tip-002",
      title: "Headache Prevention",
      content: "Regular meals, hydration, and managing screen time can prevent tension headaches.",
      category: "neurological",
      rewardH2E: 2,
    },
    {
      id: "demo-tip-003",
      title: "Sleep Hygiene",
      content: "Keep a consistent sleep schedule. Avoid screens 1 hour before bed.",
      category: "sleep",
      rewardH2E: 2,
    },
  ];

  const tip = tips[Math.floor(Date.now() / 86400000) % tips.length]!;
  return { success: true, data: tip };
}

/**
 * Switch the current mock user context.
 */
export function setMockUser(user: Partial<MockUser>) {
  currentUser = { ...currentUser, ...user };
}

/**
 * Reset mock state (quiz index, user, etc.).
 */
export function resetMockState() {
  quizIndex = 0;
  currentUser = mockUsers.default;
}

// ── Aggregated Mock API Object ─────────────────────────────────

export const mockResponses = {
  chat: mockChat,
  analytics: mockAnalytics,
  quiz: mockGetQuiz,
  submitQuiz: mockSubmitQuiz,
  register: mockRegisterUser,
  dailyTip: mockGetDailyTip,
  setUser: setMockUser,
  reset: resetMockState,
};
