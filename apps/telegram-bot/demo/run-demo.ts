#!/usr/bin/env tsx
/**
 * Demo Runner — Simulates Telegram Bot Interactions in the Console
 *
 * Usage:
 *   npx tsx apps/telegram-bot/demo/run-demo.ts                  # Run all scenarios
 *   npx tsx apps/telegram-bot/demo/run-demo.ts onboarding       # Run specific scenario
 *   npx tsx apps/telegram-bot/demo/run-demo.ts --list            # List available scenarios
 *   npx tsx apps/telegram-bot/demo/run-demo.ts --interactive     # Interactive mock chat
 *   npx tsx apps/telegram-bot/demo/run-demo.ts --fast            # Skip delays
 *
 * Output is formatted for easy screenshot capture and presentation.
 */

import { demoConversations, scenarioIds, type ConversationMessage } from "./conversations";
import { mockChat, mockGetQuiz, mockSubmitQuiz, mockAnalytics, mockGetDailyTip, resetMockState } from "./mock-responses";

// ── ANSI Color Codes ───────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const WHITE = "\x1b[37m";
const BG_BLUE = "\x1b[44m";
const BG_GREEN = "\x1b[42m";
const BG_GRAY = "\x1b[100m";

// ── Configuration ──────────────────────────────────────────────

const args = process.argv.slice(2);
const isFast = args.includes("--fast");
const isInteractive = args.includes("--interactive");
const isList = args.includes("--list");
const scenarioFilter = args.find((a) => !a.startsWith("--"));

// ── Helpers ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  if (isFast) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printSeparator() {
  console.log(DIM + "─".repeat(72) + RESET);
}

function printDoubleSeparator() {
  console.log(BOLD + CYAN + "═".repeat(72) + RESET);
}

function printHeader(title: string) {
  console.log("");
  printDoubleSeparator();
  console.log(BOLD + CYAN + `  ${title}` + RESET);
  printDoubleSeparator();
  console.log("");
}

function printUserMessage(text: string) {
  console.log(`  ${BG_GREEN}${BOLD} USER ${RESET} ${GREEN}${text}${RESET}`);
}

function printBotMessage(text: string) {
  const lines = text.split("\n");
  console.log(`  ${BG_BLUE}${BOLD} BOT  ${RESET}`);
  for (const line of lines) {
    console.log(`  ${BLUE}|${RESET} ${line}`);
  }
}

function printButtons(buttons: Array<{ text: string }>) {
  const btnStr = buttons.map((b) => `[${b.text}]`).join("  ");
  console.log(`  ${DIM}${MAGENTA}  ${btnStr}${RESET}`);
}

function printTimestamp() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  console.log(`  ${DIM}${time}${RESET}`);
}

// ── List Scenarios ─────────────────────────────────────────────

function listScenarios() {
  printHeader("Available Demo Scenarios");
  for (const [key, scenario] of Object.entries(demoConversations)) {
    console.log(
      `  ${BOLD}${GREEN}${key}${RESET}`,
    );
    console.log(
      `    ${scenario.title}`,
    );
    console.log(
      `    ${DIM}${scenario.description}${RESET}`,
    );
    console.log(
      `    ${DIM}Messages: ${scenario.messages.length}${RESET}`,
    );
    console.log("");
  }
  console.log(`${DIM}Run a specific scenario: npx tsx apps/telegram-bot/demo/run-demo.ts <scenario-key>${RESET}`);
  console.log(`${DIM}Run all scenarios: npx tsx apps/telegram-bot/demo/run-demo.ts${RESET}`);
}

// ── Run a Single Scenario ──────────────────────────────────────

async function runScenario(key: string) {
  const scenario = demoConversations[key];
  if (!scenario) {
    console.error(`Scenario not found: ${key}`);
    console.error(`Available scenarios: ${Object.keys(demoConversations).join(", ")}`);
    process.exit(1);
  }

  printHeader(`${scenario.title}`);
  console.log(`  ${DIM}${scenario.description}${RESET}`);
  console.log("");
  printSeparator();

  for (const message of scenario.messages) {
    await sleep(message.delay || 500);

    printTimestamp();

    if (message.role === "user") {
      printUserMessage(message.text);
    } else {
      printBotMessage(message.text);
      if (message.buttons) {
        printButtons(message.buttons);
      }
    }

    console.log("");
    printSeparator();
  }

  console.log(`\n  ${BOLD}${GREEN}[Scenario Complete]${RESET}\n`);
}

// ── Interactive Mock Chat Mode ─────────────────────────────────

async function runInteractive() {
  printHeader("Interactive Demo Mode");
  console.log(`  ${DIM}Type a health message in English.${RESET}`);
  console.log(`  ${DIM}Commands: /quiz, /report, /tip, /quit${RESET}`);
  console.log("");
  printSeparator();
  console.log("");

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`  ${GREEN}You> ${RESET}`, async (input) => {
      const trimmed = input.trim();

      if (!trimmed || trimmed === "/quit" || trimmed === "/exit") {
        console.log(`\n  ${BOLD}${CYAN}Demo session ended. Goodbye!${RESET}\n`);
        rl.close();
        return;
      }

      console.log("");

      if (trimmed === "/quiz") {
        // Show a quiz
        const quiz = mockGetQuiz("en");
        if (quiz.data) {
          const q = quiz.data;
          let quizText = `Today's Health Quiz (Difficulty: ${q.difficulty})\n\n`;
          quizText += `Q: ${q.question}\n\n`;
          for (let i = 0; i < q.options.length; i++) {
            quizText += `  ${String.fromCharCode(65 + i)}. ${q.options[i]}\n`;
          }
          quizText += `\nReward: ${q.rewardAmount} H2E`;
          printBotMessage(quizText);
          console.log("");

          // Ask for answer
          rl.question(`  ${GREEN}Answer (A/B/C/D)> ${RESET}`, (answer) => {
            const idx = answer.trim().toUpperCase().charCodeAt(0) - 65;
            const result = mockSubmitQuiz(q.id, idx);
            if (result.data) {
              const r = result.data;
              let resultText = r.correct ? "Correct!\n\n" : `Incorrect. Correct answer: ${String.fromCharCode(65 + r.correctIndex)}\n\n`;
              resultText += `${r.explanation}\n\n`;
              resultText += `+${r.rewardEarned} H2E earned!`;
              printBotMessage(resultText);
            }
            console.log("");
            printSeparator();
            console.log("");
            prompt();
          });
          return;
        }
      } else if (trimmed === "/report") {
        const analytics = mockAnalytics(undefined, "en");
        if (analytics.data) {
          const d = analytics.data;
          let reportText = `Health Dashboard\n\n`;
          reportText += `Level: ${d.level.current} (${d.level.title})\n`;
          reportText += `Streak: ${d.streak.current} days (best: ${d.streak.best} days)\n`;
          reportText += `Total Points: ${d.points.total} H2E\n`;
          reportText += `Points this week: ${d.points.thisWeek} H2E\n`;
          reportText += `Entries this month: ${d.entries.thisMonth}\n\n`;
          reportText += `Recent symptoms:\n`;
          for (const s of d.recentSymptoms) {
            reportText += `  - ${s.displayName} (${s.severity})\n`;
          }
          printBotMessage(reportText);
        }
        console.log("");
        printSeparator();
        console.log("");
        prompt();
        return;
      } else if (trimmed === "/tip") {
        const tip = mockGetDailyTip("en");
        if (tip.data) {
          const t = tip.data;
          let tipText = `Today's Health Tip\n\n`;
          tipText += `${t.title}\n\n`;
          tipText += `${t.content}\n\n`;
          tipText += `+${t.rewardH2E} H2E earned!`;
          printBotMessage(tipText);
        }
        console.log("");
        printSeparator();
        console.log("");
        prompt();
        return;
      }

      // Regular health message
      const response = mockChat(trimmed, "en");

      if (response.data) {
        const d = response.data;
        let botText = "";

        if (d.aiResult.safetyAlert) {
          botText += `[URGENT SAFETY ALERT]\n\n`;
        }

        if (d.aiResult.symptoms.length > 0) {
          botText += `Detected Symptoms:\n`;
          for (const s of d.aiResult.symptoms) {
            botText += `  - ${s.name} [SNOMED: ${s.snomedCode}] -- Severity: ${s.severity}`;
            if (s.bodySite) botText += ` -- Site: ${s.bodySite}`;
            botText += `\n`;
          }
          botText += `\n`;
        }

        botText += `AI Analysis:\n${d.aiResult.educationResponse}\n\n`;

        if (d.aiResult.medicationWarnings && d.aiResult.medicationWarnings.length > 0) {
          botText += `Medication Warning:\n`;
          for (const w of d.aiResult.medicationWarnings) {
            botText += `  ${w}\n`;
          }
          botText += `\n`;
        }

        if (d.aiResult.patternInsights && d.aiResult.patternInsights.length > 0) {
          botText += `Pattern Insight:\n`;
          for (const p of d.aiResult.patternInsights) {
            botText += `  "${p}"\n`;
          }
          botText += `\n`;
        }

        botText += `Urgency: ${d.aiResult.urgencyLevel} | Detail: ${d.aiResult.detailScore}/10\n`;
        botText += `+${d.rewardEarned} H2E earned! | Streak: ${d.currentStreak} days`;

        printBotMessage(botText);
      }

      console.log("");
      printSeparator();
      console.log("");
      prompt();
    });
  };

  prompt();
}

// ── Run All Scenarios ──────────────────────────────────────────

async function runAll() {
  printHeader("AI Health Journal - Telegram Bot Demo");
  console.log(`  ${DIM}Running all ${Object.keys(demoConversations).length} demo scenarios${RESET}`);
  console.log(`  ${DIM}Date: 2026-03-01${RESET}`);
  console.log("");

  for (const key of Object.keys(demoConversations)) {
    resetMockState();
    await runScenario(key);
    await sleep(1000);
  }

  printDoubleSeparator();
  console.log(`  ${BOLD}${GREEN}All demo scenarios completed!${RESET}`);
  printDoubleSeparator();
  console.log("");
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  if (isList) {
    listScenarios();
    return;
  }

  if (isInteractive) {
    await runInteractive();
    return;
  }

  if (scenarioFilter) {
    // Map common aliases
    const aliasMap: Record<string, string> = {
      onboarding: "newUserOnboarding",
      quiz: "dailyQuizInteraction",
      report: "healthReport",
      medication: "medicationCheck",
      exercise: "exercisePool",
      pool: "exercisePool",
      emergency: "emergencyCase",
      tracking: "symptomTracking",
      english: "englishInteraction",
    };
    const key = aliasMap[scenarioFilter] || scenarioFilter;
    await runScenario(key);
    return;
  }

  await runAll();
}

main().catch((error) => {
  console.error("Demo runner error:", error);
  process.exit(1);
});
