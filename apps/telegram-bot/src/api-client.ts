/**
 * API Client — communicates with the AI Health Journal backend
 *
 * All methods accept a telegramUserId which is mapped to a backend
 * user via the bot-managed auth token system.
 */

import { config, type Language } from "./config";

// ── Types ──────────────────────────────────────────────────────

export interface ChatResponse {
  success: boolean;
  data?: {
    entryId: string;
    aiResult: {
      symptoms: Array<{
        name: string;
        snomedCode?: string;
        icdCode?: string;
        severity?: string;
        bodySite?: string;
        onsetDate?: string;
      }>;
      medications: Array<{
        name: string;
        rxNormCode?: string;
        dosage?: string;
      }>;
      urgencyLevel: string;
      detailScore: number;
      educationResponse: string;
      safetyAlert?: string;
      medicationWarnings?: string[];
      patternInsights?: string[];
      scoreBreakdown?: Record<string, number>;
    };
    rewardEarned: number;
    currentStreak: number;
  };
  error?: { code: string; message: string };
}

export interface AnalyticsDashboard {
  success: boolean;
  data?: {
    streak: { current: number; best: number; multiplier: number };
    level: { current: number; title: string; titleKo: string; progress: number };
    points: { total: string; thisWeek: number; thisMonth: number };
    entries: { total: number; thisWeek: number; thisMonth: number };
    recentSymptoms: Array<{
      displayName: string;
      severity: string;
      snomedCode: string;
      onsetDate: string;
    }>;
  };
  error?: { code: string; message: string };
}

export interface QuizResponse {
  success: boolean;
  data?: {
    id: string;
    question: string;
    questionKo: string;
    options: string[];
    difficulty: string;
    rewardAmount: number;
  } | null;
  message?: string;
  error?: { code: string; message: string };
}

export interface QuizSubmitResponse {
  success: boolean;
  data?: {
    correct: boolean;
    correctIndex: number;
    explanation: string;
    explanationKo: string;
    rewardEarned: number;
  };
  error?: { code: string; message: string };
}

export interface UserProfile {
  success: boolean;
  data?: {
    id: string;
    // Phase 2: Token integration
    // walletAddress?: string;
    streakDays: number;
    level: number;
    totalPoints: string;
    language?: string;
  };
  error?: { code: string; message: string };
}

// ── Agent Debate Types ──────────────────────────────────────────

export interface DebateAgent {
  role: string;
  emoji: string;
  name: string;
  nameKo: string;
  confidence: number;
  message: string;
  messageKo: string;
  replyTo?: string;
}

export interface DebateRound {
  round: number;
  title: string;
  titleKo: string;
  agents: DebateAgent[];
}

export interface DebateResult {
  id: string;
  topic: string;
  topicKo: string;
  healthData?: {
    heartRate?: { avg: number; resting: number };
    sleep?: { hours: number; deepHours: number };
    steps?: number;
  };
  rounds: DebateRound[];
  consensus: {
    summary: string;
    summaryKo: string;
  };
  keyInsights: Array<{ text: string; textKo: string }>;
  rewardEarned: number;
  createdAt: string;
}

export interface DebateStartResponse {
  success: boolean;
  data?: DebateResult;
  error?: { code: string; message: string };
}

export interface DebateHistoryResponse {
  success: boolean;
  data?: Array<{
    id: string;
    topic: string;
    topicKo: string;
    createdAt: string;
    agentCount: number;
    roundCount: number;
  }>;
  error?: { code: string; message: string };
}

export interface DebateDetailResponse {
  success: boolean;
  data?: DebateResult;
  error?: { code: string; message: string };
}

// ── Token store (telegramId -> JWT) ────────────────────────────

const tokenStore = new Map<string, string>();

export function setAuthToken(telegramUserId: string, token: string): void {
  tokenStore.set(telegramUserId, token);
}

export function getAuthToken(telegramUserId: string): string | undefined {
  return tokenStore.get(telegramUserId);
}

export function removeAuthToken(telegramUserId: string): void {
  tokenStore.delete(telegramUserId);
}

// ── Internal fetch helper ──────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    telegramUserId?: string;
  } = {},
): Promise<T> {
  const { method = "GET", body, telegramUserId } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Bot-Secret": config.botApiSecret,
  };

  // Attach JWT if available for this Telegram user
  if (telegramUserId) {
    const token = tokenStore.get(telegramUserId);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const url = `${config.apiBaseUrl}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as T;
    return json;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown API error";
    console.error(`[api-client] ${method} ${path} failed:`, message);
    return {
      success: false,
      error: { code: "API_UNREACHABLE", message: `Backend unreachable: ${message}` },
    } as T;
  }
}

// ── Public API methods ─────────────────────────────────────────

/**
 * Register or authenticate a Telegram user with the backend.
 * The bot creates a pseudo-address derived from the Telegram user ID,
 * which allows the backend to create/find the user without real wallet auth.
 * Phase 2: Token integration — will add real wallet connection.
 */
export async function registerUser(telegramUserId: string): Promise<UserProfile> {
  // Create deterministic pseudo-address for Telegram users
  // Phase 2: Token integration — replace with real wallet connection
  const pseudoAddress = `0xTG${telegramUserId.padStart(38, "0")}`;

  const connectRes = await apiFetch<{
    success: boolean;
    data?: { token: string; user: UserProfile["data"] };
    error?: { code: string; message: string };
  }>("/auth/connect", {
    method: "POST",
    body: {
      address: pseudoAddress,
      signature: `telegram-bot-${config.botApiSecret}`,
    },
  });

  if (connectRes.success && connectRes.data) {
    // Store the JWT for future requests
    setAuthToken(telegramUserId, connectRes.data.token);
    return { success: true, data: connectRes.data.user };
  }

  return {
    success: false,
    error: connectRes.error || { code: "REGISTER_FAILED", message: "Failed to register" },
  };
}

/**
 * Send a health chat message and get AI analysis back.
 * POST /api/v1/chat
 */
export async function chat(
  telegramUserId: string,
  message: string,
  language: Language = "ko",
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/chat", {
    method: "POST",
    body: { message, language },
    telegramUserId,
  });
}

/**
 * Create a health entry directly (for structured symptom logging).
 * POST /api/v1/chat (uses the same endpoint, which creates entries)
 */
export async function createEntry(
  telegramUserId: string,
  data: { message: string; language?: Language },
): Promise<ChatResponse> {
  return chat(telegramUserId, data.message, data.language || "ko");
}

/**
 * Get analytics dashboard for a user.
 * GET /api/v1/analytics/dashboard
 */
export async function getAnalytics(
  telegramUserId: string,
  language: Language = "ko",
): Promise<AnalyticsDashboard> {
  return apiFetch<AnalyticsDashboard>(`/analytics/dashboard?language=${language}`, {
    telegramUserId,
  });
}

/**
 * Get the next available daily quiz.
 * GET /api/v1/education/quiz
 */
export async function getDailyQuiz(telegramUserId: string): Promise<QuizResponse> {
  return apiFetch<QuizResponse>("/education/quiz", {
    telegramUserId,
  });
}

/**
 * Submit a quiz answer.
 * POST /api/v1/education/quiz/submit
 */
export async function submitQuizAnswer(
  telegramUserId: string,
  quizId: string,
  selectedIndex: number,
): Promise<QuizSubmitResponse> {
  return apiFetch<QuizSubmitResponse>("/education/quiz/submit", {
    method: "POST",
    body: { quizId, selectedIndex },
    telegramUserId,
  });
}

/**
 * Get user profile from the backend.
 * Uses the stored JWT to fetch authenticated user data.
 */
export async function getUserProfile(telegramUserId: string): Promise<UserProfile> {
  return apiFetch<UserProfile>("/analytics/dashboard", {
    telegramUserId,
  });
}

/**
 * Get daily health tip.
 * GET /api/v1/education/tip
 */
export async function getDailyTip(telegramUserId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    title: string;
    titleKo: string;
    content: string;
    contentKo: string;
    category: string;
    rewardH2E: number;
  };
  error?: { code: string; message: string };
}> {
  return apiFetch("/education/tip", { telegramUserId });
}

// ── Agent Debate API methods ────────────────────────────────────

/**
 * Start a new agent debate session.
 * POST /api/v1/agent-debate/start
 */
export async function startDebate(
  telegramUserId: string,
  context: string,
  language: Language = "ko",
): Promise<DebateStartResponse> {
  return apiFetch<DebateStartResponse>("/agent-debate/start", {
    method: "POST",
    body: { context, language },
    telegramUserId,
  });
}

/**
 * Get debate history for a user.
 * GET /api/v1/agent-debate/history
 */
export async function getDebateHistory(
  telegramUserId: string,
  limit: number = 5,
): Promise<DebateHistoryResponse> {
  return apiFetch<DebateHistoryResponse>(`/agent-debate/history?limit=${limit}`, {
    telegramUserId,
  });
}

/**
 * Get full details of a specific debate.
 * GET /api/v1/agent-debate/:id
 */
export async function getDebateDetail(
  telegramUserId: string,
  debateId: string,
): Promise<DebateDetailResponse> {
  return apiFetch<DebateDetailResponse>(`/agent-debate/${debateId}`, {
    telegramUserId,
  });
}
