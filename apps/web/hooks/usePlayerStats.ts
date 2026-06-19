"use client";
import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerStats {
  vitality: number;      // Coach + Nutrition
  recovery: number;      // Sleep
  cognitive: number;     // Mental + Moderator
  readiness: number;     // Triage
  totalScore: number;
  universeRank: number;  // percentile (e.g. 5.21 = top 5.21%)
  level: number;
  xp: number;            // XP within current level
  xpToNext: number;
  h2eEarned: number;
  streakDays: number;
  totalSessions: number;
}

export interface LedgerEntry {
  id: string;
  timestamp: number;     // epoch ms
  type: "upload" | "text" | "debate" | "wearable";
  agentTag: string;      // primary agent
  outcome: string;       // e.g. "+2% Vitality"
  details?: string;
  h2eEarned: number;
}

export interface StatModifier {
  agentId: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "h2e_player_stats";
const LEDGER_KEY = "h2e_ledger";
const MAX_STAT = 100;
const MAX_LEDGER = 200;

// Agent → Stat mapping
const AGENT_STAT_MAP: Record<string, keyof Pick<PlayerStats, "vitality" | "recovery" | "cognitive" | "readiness">> = {
  coach: "vitality",
  nutrition: "vitality",
  sleep: "recovery",
  mental: "cognitive",
  moderator: "cognitive",
  triage: "readiness",
};

// XP required per level (exponential curve)
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

// Universe rank from total score (simulated normal distribution)
// Higher score → lower percentile (top X%)
function calcUniverseRank(totalScore: number): number {
  // Sigmoid-based: at score 0 → 50%, score 200 → ~5%, score 400 → ~0.1%
  const z = (totalScore - 80) / 60; // mean=80, std=60
  // CDF approximation
  const cdf = 1 / (1 + Math.exp(-0.07056 * Math.pow(z, 3) - 1.5976 * z));
  const percentile = (1 - cdf) * 100;
  return Math.max(0.01, Math.min(99.99, parseFloat(percentile.toFixed(2))));
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

function defaultStats(): PlayerStats {
  return {
    vitality: 12,
    recovery: 8,
    cognitive: 10,
    readiness: 15,
    totalScore: 45,
    universeRank: 42.3,
    level: 1,
    xp: 0,
    xpToNext: 100,
    h2eEarned: 0,
    streakDays: 0,
    totalSessions: 0,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayerStats() {
  const [stats, setStats] = useState<PlayerStats>(defaultStats);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStats(JSON.parse(raw));
      const rawLedger = localStorage.getItem(LEDGER_KEY);
      if (rawLedger) setLedger(JSON.parse(rawLedger));
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  }, [ledger, loaded]);

  // -----------------------------------------------------------------------
  // Apply stat modifiers from a completed debate
  // -----------------------------------------------------------------------

  const applyDebateResult = useCallback((
    modifiers: StatModifier[],
    topic: string,
    h2eReward: number,
  ) => {
    setStats((prev) => {
      const next = { ...prev };
      const changes: string[] = [];

      for (const mod of modifiers) {
        const statKey = AGENT_STAT_MAP[mod.agentId];
        if (!statKey) continue;

        // Calculate modifier: confidence → points
        let points = 0;
        if (mod.confidence >= 0.9) points = 3;
        else if (mod.confidence >= 0.8) points = 2;
        else if (mod.confidence >= 0.7) points = 1;

        if (points > 0) {
          const oldVal = next[statKey] as number;
          const newVal = Math.min(MAX_STAT, oldVal + points);
          (next as Record<string, number>)[statKey] = newVal;
          const pctChange = ((points / Math.max(oldVal, 1)) * 100).toFixed(0);
          changes.push(`+${pctChange}% ${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`);
        }
      }

      // Recalculate total & rank
      next.totalScore = next.vitality + next.recovery + next.cognitive + next.readiness;
      next.universeRank = calcUniverseRank(next.totalScore);

      // XP & Level
      const xpGained = h2eReward + modifiers.length * 5;
      next.xp += xpGained;
      next.h2eEarned += h2eReward;
      next.totalSessions += 1;

      // Level up check
      while (next.xp >= next.xpToNext) {
        next.xp -= next.xpToNext;
        next.level += 1;
        next.xpToNext = xpForLevel(next.level);
      }

      // Streak (simplified: if session today, increment)
      const today = new Date().toDateString();
      const lastSession = localStorage.getItem("h2e_last_session");
      if (lastSession !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastSession === yesterday) {
          next.streakDays += 1;
        } else if (!lastSession) {
          next.streakDays = 1;
        } else {
          next.streakDays = 1; // reset
        }
        localStorage.setItem("h2e_last_session", today);
      }

      // Add ledger entry
      const primaryAgent = modifiers.reduce((best, m) =>
        m.confidence > best.confidence ? m : best, modifiers[0]);

      const entry: LedgerEntry = {
        id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: "debate",
        agentTag: primaryAgent.agentId.toUpperCase(),
        outcome: changes.slice(0, 2).join(", ") || "+XP",
        details: topic,
        h2eEarned: h2eReward,
      };

      setLedger((prev) => [entry, ...prev].slice(0, MAX_LEDGER));

      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Stat percentages (for progress bars, 0-100)
  // -----------------------------------------------------------------------

  const statBars = {
    vitality: { value: stats.vitality, max: MAX_STAT, pct: (stats.vitality / MAX_STAT) * 100 },
    recovery: { value: stats.recovery, max: MAX_STAT, pct: (stats.recovery / MAX_STAT) * 100 },
    cognitive: { value: stats.cognitive, max: MAX_STAT, pct: (stats.cognitive / MAX_STAT) * 100 },
    readiness: { value: stats.readiness, max: MAX_STAT, pct: (stats.readiness / MAX_STAT) * 100 },
  };

  return {
    stats,
    ledger,
    loaded,
    statBars,
    applyDebateResult,
  };
}
