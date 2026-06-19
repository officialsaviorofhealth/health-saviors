/**
 * Demo Conversation Flows for AI Health Journal Telegram Bot
 *
 * Pre-scripted conversation flows that showcase all major bot features.
 * Each scenario tells a complete interaction story.
 */

export interface ConversationMessage {
  role: "user" | "bot";
  text: string;
  /** Optional delay in ms before this message appears (for demo runner) */
  delay?: number;
  /** Optional: inline keyboard buttons to show (bot messages only) */
  buttons?: Array<{ text: string; callbackData?: string }>;
}

export interface ConversationScenario {
  id: string;
  title: string;
  description: string;
  messages: ConversationMessage[];
}

// ── Scenario 1: New User Onboarding ────────────────────────────

const newUserOnboarding: ConversationScenario = {
  id: "new-user-onboarding",
  title: "New User First Interaction",
  description: "A new user starts the bot, goes through onboarding, and makes their first health entry.",
  messages: [
    {
      role: "user",
      text: "/start",
      delay: 0,
    },
    {
      role: "bot",
      text: `Welcome to AI Health Journal!

I'm your AI health assistant. Log your health status every day, get AI analysis, and earn Health Points (H2E).

Key features:
  - Symptom logging & AI analysis (SNOMED CT coding)
  - Health quizzes & educational content
  - Streak bonuses & rewards
  - Personalized health reports

To get started, tell me how you're feeling today!
e.g. "I have a bit of a headache and feel tired today"`,
      delay: 500,
      buttons: [
        { text: "English", callbackData: "lang_en" },
        { text: "Spanish", callbackData: "lang_es" },
      ],
    },
    {
      role: "user",
      text: "English",
      delay: 1000,
    },
    {
      role: "bot",
      text: `Language set to English.

Data consent notice:
Your health data is encrypted with AES-256 and stored securely.
Your personal data is never shared with third parties without your consent.

Do you consent to data collection and AI analysis?`,
      delay: 800,
      buttons: [
        { text: "I agree", callbackData: "consent_yes" },
        { text: "Learn more", callbackData: "consent_detail" },
      ],
    },
    {
      role: "user",
      text: "I agree",
      delay: 1500,
    },
    {
      role: "bot",
      text: `Consent confirmed. Thank you!

Your registration is complete.
  Wallet address: 0xTG0000...001
  Level: 1 (Health Beginner)
  Points: 0 H2E

Now, tell me how you're feeling!`,
      delay: 800,
    },
    {
      role: "user",
      text: "I have a bit of a headache and a fever today",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Headache [SNOMED: 25064002] -- Severity: Moderate
  - Fever [SNOMED: 386661006] -- Severity: Moderate

AI Analysis:
This may be an early sign of an upper respiratory infection. When a headache and fever appear together, adequate rest and hydration are important.

Recommendations:
  1. Check your temperature; if it exceeds 38.5C, consider taking an antipyretic
  2. Stay well hydrated (more than 2L per day)
  3. If symptoms persist for more than 3 days, see a physician

Urgency: Low (0.3/1.0)
Detail Score: 7/10

+15 H2E earned! (includes first-entry bonus)
Streak: 1 day`,
      delay: 1500,
    },
    {
      role: "user",
      text: "Thanks! Let me try a health quiz too",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Today's Health Quiz

Q: How many glasses of water should you drink per day?

  A. 4 glasses
  B. 8 glasses
  C. 12 glasses
  D. 2 glasses

Reward: 5 H2E`,
      delay: 1000,
      buttons: [
        { text: "A", callbackData: "quiz_0" },
        { text: "B", callbackData: "quiz_1" },
        { text: "C", callbackData: "quiz_2" },
        { text: "D", callbackData: "quiz_3" },
      ],
    },
    {
      role: "user",
      text: "B",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Correct!

Health experts recommend about 8 glasses (~2L) of water per day for adults. Staying well hydrated is especially important when you have a headache.

+5 H2E earned!

Current points: 20 H2E
Level: 1 (Health Beginner)`,
      delay: 1000,
    },
  ],
};

// ── Scenario 2: Daily Health Check with Quiz ───────────────────

const dailyQuizInteraction: ConversationScenario = {
  id: "daily-quiz",
  title: "Daily Quiz Interaction",
  description: "Returning user does daily check-in, takes a quiz, and earns streak rewards.",
  messages: [
    {
      role: "user",
      text: "/quiz",
      delay: 0,
    },
    {
      role: "bot",
      text: `Today's Health Quiz (Difficulty: Intermediate)

Q: What is the recommended maximum heart rate range for moderate-intensity exercise?

  A. 30-40%
  B. 50-70%
  C. 80-90%
  D. 95-100%

Reward: 8 H2E`,
      delay: 800,
      buttons: [
        { text: "A", callbackData: "quiz_0" },
        { text: "B", callbackData: "quiz_1" },
        { text: "C", callbackData: "quiz_2" },
        { text: "D", callbackData: "quiz_3" },
      ],
    },
    {
      role: "user",
      text: "B",
      delay: 3000,
    },
    {
      role: "bot",
      text: `Correct!

Moderate-intensity exercise targets 50-70% of your maximum heart rate (220 - age).
e.g. For a 30-year-old, max heart rate is 190, so the moderate range is 95-133 bpm

+8 H2E earned!

You've completed today's quiz.
A new quiz will be ready tomorrow!`,
      delay: 1000,
    },
    {
      role: "user",
      text: "I'm a bit tired today and my joints feel stiff. I think I overdid my workout yesterday.",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Fatigue [SNOMED: 84229001] -- Severity: Mild
  - Joint pain [SNOMED: 57676002] -- Severity: Mild

AI Analysis:
This appears to be related to post-exercise muscle soreness (DOMS). These are temporary symptoms that can follow an intense workout.

Recommendations:
  1. Do light stretching and use a foam roller
  2. Get enough protein (1.6-2.2g per kg of body weight)
  3. Focus on recovery today with light activity

Pattern Insight:
  "Your workout intensity appears to have increased over the past week. Follow the principle of progressive overload and increase your training volume by no more than 10% per week."

Urgency: Very Low (0.1/1.0)
Detail Score: 7/10

+18 H2E earned!
Streak: 14 days (2x bonus!)`,
      delay: 1500,
    },
  ],
};

// ── Scenario 3: Health Report Request ──────────────────────────

const healthReport: ConversationScenario = {
  id: "health-report",
  title: "Health Report Request",
  description: "User requests their analytics dashboard and weekly/monthly report.",
  messages: [
    {
      role: "user",
      text: "/report",
      delay: 0,
    },
    {
      role: "bot",
      text: `Alex's Health Dashboard

Profile:
  Level: 5 (Health Manager)
  Streak: 14 days
  Total Points: 2,450 H2E

This month's summary:
  Entries logged: 24
  Average detail: 6.2/10
  Best detail: 9/10

Most reported symptoms (last 30 days):
  1. Headache -- 8 times (mild to severe)
  2. Fatigue -- 5 times (mild to moderate)
  3. Neck pain -- 3 times (mild to moderate)
  4. Insomnia -- 2 times (mild to moderate)
  5. Stress -- 2 times (moderate)

Symptom trends:
  Headache frequency change: 4x/week -> 1x/week (75% reduction!)
  Fatigue improvement: moderate -> mild

Would you like to see a detailed report?`,
      delay: 1000,
      buttons: [
        { text: "Weekly Report", callbackData: "report_weekly" },
        { text: "Monthly Report", callbackData: "report_monthly" },
        { text: "Symptom Trends", callbackData: "report_trends" },
      ],
    },
    {
      role: "user",
      text: "Monthly Report",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Alex's Monthly Health Report (February 2026)

1. Health Score: 78/100 (+15 vs. last month)

2. Symptom Analysis:
   - Headaches dropped significantly from early month (4x/week) to late month (1x/week)
   - Strong correlation between stress and headaches (r=0.82)
   - Fatigue decreased as sleep quality improved

3. AI Health Insight:
   "Analyzing Alex's health data over the past month, we observed a pattern of
   headaches concentrated on weekdays. After introducing stretching, yoga, and a
   consistent sleep schedule, headache frequency dropped by more than 80%."

4. Recommendations:
   Lifestyle:
     - Maintain a consistent sleep pattern
     - Stretch once every hour during work

   Medical Consultation:
     - Consider a neurology consultation for recurring headaches

   Prevention:
     - Prepare antihistamines for the upcoming spring allergy season

5. Rewards Summary:
   Earned this month: 450 H2E
   Streak bonus: 200 H2E
   Quiz rewards: 30 H2E

Keep up your health logging streak!`,
      delay: 2000,
    },
    {
      role: "user",
      text: "Show me the headache trend in more detail",
      delay: 2500,
    },
    {
      role: "bot",
      text: `Headache (SNOMED: 25064002) Trend Analysis

Frequency (weekly):
  Week 1 (2/1-2/7):   |||| 4 times
  Week 2 (2/8-2/14):  |||||| 5 times (peak)
  Week 3 (2/15-2/21): || 2 times
  Week 4 (2/22-2/28): | 1 time

Severity change:
  Week 1: mild -> mild
  Week 2: moderate -> severe (peak)
  Week 3: mild -> mild
  Week 4: mild

Related factors:
  - High-stress days: 85% headache occurrence
  - Less than 6 hours of sleep: 70% headache occurrence
  - Days with stretching: 15% headache occurrence

Accompanying symptoms:
  - Fatigue (60% co-occurrence)
  - Neck pain (40% co-occurrence)
  - Dizziness (20% co-occurrence)

Overall assessment: Improving`,
      delay: 1500,
    },
  ],
};

// ── Scenario 4: Medication Interaction Warning ─────────────────

const medicationCheck: ConversationScenario = {
  id: "medication-check",
  title: "Medication Interaction Warning",
  description: "User reports taking a new medication, and the bot detects a potential interaction.",
  messages: [
    {
      role: "user",
      text: "I took a cold medicine today because my nose is stuffy and I have a cough. I also took a headache pill at the same time.",
      delay: 0,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Nasal congestion [SNOMED: 64531003] -- Severity: Moderate
  - Cough [SNOMED: 49727002] -- Severity: Mild
  - Headache [SNOMED: 25064002] -- Severity: Mild

Medications detected:
  - Cold medicine (multi-symptom)
  - Headache medicine (pain reliever)

Medication Interaction Warning:
  Multi-symptom cold medicines may already contain an antipyretic/analgesic ingredient (acetaminophen).
  Taking it together with a headache pill (such as Tylenol) risks an acetaminophen overdose.

  Recommendations:
    1. Check the cold medicine's ingredient list to see whether it contains acetaminophen
    2. Maximum daily acetaminophen dose: 4,000mg
    3. If you confirm overlapping ingredients, stop taking the headache pill
    4. If you're unsure, ask a pharmacist

  Pharmacist hotline: contact your local pharmacy

Urgency: Medium (0.5/1.0)

+20 H2E earned!`,
      delay: 1500,
    },
    {
      role: "user",
      text: "The cold medicine ingredients say acetaminophen 500mg",
      delay: 2500,
    },
    {
      role: "bot",
      text: `Medication Interaction Check

Cold medicine: contains acetaminophen 500mg
Headache pill: Tylenol 500mg (estimated)

Total acetaminophen intake: about 1,000mg (single dose)

Notes:
  - Your current dose is within the safe range
  - Wait at least 4-6 hours before your next dose
  - Do not exceed a total of 4,000mg of acetaminophen today
  - Since the cold medicine already contains a pain reliever, an additional headache pill may not be necessary

Would you like to add this to your current medication list?`,
      delay: 1500,
      buttons: [
        { text: "Add to medication list", callbackData: "med_add" },
        { text: "No thanks", callbackData: "med_skip" },
      ],
    },
    {
      role: "user",
      text: "Add to medication list",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Medication registered.

Your current medications:
  1. Magnesium 400mg -- before bed (active)
  2. Vitamin B Complex -- after breakfast (active)
  3. Omega-3 1000mg -- after breakfast (active)
  4. Cold medicine -- newly added (active)

Reminders will be set. I'll notify you at dosing times!`,
      delay: 1000,
    },
  ],
};

// ── Scenario 5: Exercise Pool Participation ────────────────────

const exercisePool: ConversationScenario = {
  id: "exercise-pool",
  title: "Exercise Pool Participation",
  description: "User participates in the Health2Earn exercise pool challenge.",
  messages: [
    {
      role: "user",
      text: "/pool",
      delay: 0,
    },
    {
      role: "bot",
      text: `This Week's Exercise Pool Challenge

#12 "10K Steps a Day Challenge"
  Period: 2026-02-24 ~ 2026-03-02
  Participants: 127
  Total prize: 5,000 H2E

Goal: Walk 10,000+ steps for 7 days in a row

Current rankings:
  1. HealthWalker (68,432 steps)
  2. FitJohn (65,210 steps)
  3. Alex (42,350 steps) -- you

Today's steps: 6,230 (3,770 to go)

Would you like to participate?`,
      delay: 1000,
      buttons: [
        { text: "Update today's record", callbackData: "pool_update" },
        { text: "View rankings", callbackData: "pool_ranking" },
        { text: "View new challenges", callbackData: "pool_new" },
      ],
    },
    {
      role: "user",
      text: "Update today's record",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Please enter your step count.

If a wearable device is connected, it's recorded automatically.
To enter manually, just type a number.

e.g. 12500`,
      delay: 800,
    },
    {
      role: "user",
      text: "11200",
      delay: 1500,
    },
    {
      role: "bot",
      text: `Today's step count has been updated!

  Today's steps: 11,200
  Goal reached: 10,000+ steps!
  Weekly total: 53,550 steps

Ranking change: 3rd -> 3rd (held)

  +25 H2E earned today (10K steps challenge bonus)

You've hit your goal 3 days in a row! Keep it up!`,
      delay: 1000,
    },
  ],
};

// ── Scenario 6: Emergency Detection ────────────────────────────

const emergencyCase: ConversationScenario = {
  id: "emergency-detection",
  title: "Emergency Symptom Detection",
  description: "Bot detects potentially serious symptoms and provides emergency guidance.",
  messages: [
    {
      role: "user",
      text: "My chest hurts so much and I can't breathe well. My left arm feels numb too.",
      delay: 0,
    },
    {
      role: "bot",
      text: `[URGENT SAFETY ALERT]

Detected Symptoms:
  - Chest pain [SNOMED: 29857009] -- Severity: Severe
  - Shortness of breath [SNOMED: 267036007] -- Severity: Severe
  - Numbness [SNOMED: 95388000] -- Severity: Moderate -- Site: Left arm

Warning: Possible cardiovascular emergency

This combination of symptoms may be a classic sign of a myocardial infarction (heart attack).

Take immediate action:
  1. Call your local emergency number (emergency)
  2. If available, chew one aspirin tablet
  3. Sit down or lie in a semi-reclined position
  4. Do not drive yourself to the hospital
  5. Ask someone nearby for help

Emergency numbers:
  Your local emergency number -- fire/emergency medical services
  Your local poison control / medical information line

Urgency: Very High (0.95/1.0)

This analysis is not a medical diagnosis. Seek help from a medical professional immediately.`,
      delay: 500,
    },
    {
      role: "user",
      text: "I called for emergency services. An ambulance is on the way.",
      delay: 3000,
    },
    {
      role: "bot",
      text: `Good decision. While you wait for the ambulance:

  1. Stay in a stable position
  2. Loosen any tight clothing
  3. Breathe slowly and deeply
  4. Have your medication list ready

Your current medications:
  - Magnesium 400mg
  - Vitamin B Complex
  - Omega-3 1000mg

Please share this information with the paramedics.

Wishing you safety. Let me know your status once you reach the hospital.`,
      delay: 1000,
    },
  ],
};

// ── Scenario 7: Multi-day Symptom Tracking ─────────────────────

const symptomTracking: ConversationScenario = {
  id: "symptom-tracking",
  title: "Multi-day Symptom Progression",
  description: "Shows how the bot tracks symptom progression over multiple days.",
  messages: [
    {
      role: "user",
      text: "My throat is a bit sore and I feel achy",
      delay: 0,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Sore throat [SNOMED: 162397003] -- Severity: Mild
  - Sore muscles [SNOMED: 267102003] -- Severity: Mild

AI Analysis:
This appears to be an early cold symptom. Plenty of rest and warm drinks are recommended.

Let me know how your symptoms change tomorrow, and I'll track the progression to give you a more accurate analysis.

Urgency: Low (0.2/1.0)
+15 H2E earned!`,
      delay: 1200,
    },
    {
      role: "user",
      text: "[Next day] My throat is worse. I've started coughing and my temperature is 37.8C.",
      delay: 3000,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Sore throat [SNOMED: 162397003] -- Severity: Moderate (yesterday: mild -> today: moderate)
  - Cough [SNOMED: 49727002] -- Severity: Mild (new)
  - Fever [SNOMED: 386661006] -- Severity: Mild (37.8C) (new)

Symptom trend:
  Yesterday -> today: sore throat worsened, new symptoms added

AI Analysis:
An upper respiratory infection appears to be progressing. With the added fever and cough, a viral cold is suspected.

Recommendations:
  1. Plenty of rest and hydration
  2. Take an antipyretic if your temperature exceeds 38.5C
  3. Warm honey water or ginger tea can help soothe a sore throat
  4. See a doctor if symptoms persist for more than 5 days

Urgency: Medium (0.35/1.0)
+18 H2E earned!`,
      delay: 1500,
    },
    {
      role: "user",
      text: "[Day 3] I feel a bit better today. My fever is gone and I just have a slight cough left.",
      delay: 3000,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Cough [SNOMED: 49727002] -- Severity: Mild (unchanged)

Symptom trend (over 3 days):
  Day 1: sore throat (mild), sore muscles (mild)
  Day 2: sore throat (moderate), cough (mild), fever (mild) -- peak
  Day 3: cough (mild) -- improving

AI Analysis:
You're on an improving trend! The fever resolving and sore throat clearing are good signs. The remaining cough is part of the recovery process and usually disappears completely within 1-2 weeks.

Recommendations:
  1. Don't overexert yourself; resume activity gradually
  2. See a doctor if the cough persists for more than 2 weeks

Overall assessment: Recovering

Urgency: Very Low (0.1/1.0)
+15 H2E earned!`,
      delay: 1500,
    },
  ],
};

// ── Scenario 8: English Language Interaction ───────────────────

const englishInteraction: ConversationScenario = {
  id: "english-interaction",
  title: "Detailed Workout Logging",
  description: "Demonstrates the bot analyzing a detailed exercise log.",
  messages: [
    {
      role: "user",
      text: "/start",
      delay: 0,
    },
    {
      role: "bot",
      text: `Welcome to AI Health Journal!

I'm your AI health assistant. Track your health daily, get AI-powered analysis, and earn Health2Earn (H2E) rewards.

Please select your language:`,
      delay: 500,
      buttons: [
        { text: "English", callbackData: "lang_en" },
        { text: "Spanish", callbackData: "lang_es" },
      ],
    },
    {
      role: "user",
      text: "English",
      delay: 1000,
    },
    {
      role: "bot",
      text: `Language set to English.

Welcome, John! Ready to log your health today.

Your stats:
  Level: 8 (Health Expert)
  Streak: 21 days
  Points: 4,800 H2E

Tell me how you're feeling!`,
      delay: 800,
    },
    {
      role: "user",
      text: "Ran 15K today! Feeling great but my legs are pretty sore. Also had a slight headache from dehydration.",
      delay: 2000,
    },
    {
      role: "bot",
      text: `Symptoms analyzed.

Detected Symptoms:
  - Sore muscles (SNOMED: 267102003) -- Severity: Mild -- Site: Legs
  - Headache (SNOMED: 25064002) -- Severity: Mild

AI Analysis:
Excellent workout! Muscle soreness (DOMS) after a 15K run is normal and expected. The dehydration headache suggests you need to improve your hydration strategy during longer runs.

Recommendations:
  1. Foam roll and stretch your quads, hamstrings, and calves
  2. Drink 500ml water every 30 minutes during runs over 10K
  3. Consider electrolyte supplementation for runs over an hour
  4. Protein intake within 30 minutes post-run aids recovery

Pattern Insight:
  "Your running distance has progressively increased from 5K to 15K over the past month. This is excellent progress! Continue to increase distance by no more than 10% per week."

Urgency: Very Low (0.1/1.0)
Detail Score: 8/10

+18 H2E earned!
Streak: 21 days (2.5x bonus!)`,
      delay: 1500,
    },
  ],
};

// ── Export All Scenarios ────────────────────────────────────────

export const demoConversations: Record<string, ConversationScenario> = {
  newUserOnboarding,
  dailyQuizInteraction,
  healthReport,
  medicationCheck,
  exercisePool,
  emergencyCase,
  symptomTracking,
  englishInteraction,
};

/** All scenario IDs for easy iteration */
export const scenarioIds = Object.keys(demoConversations);

/** Get a scenario by its ID */
export function getScenario(id: string): ConversationScenario | undefined {
  return Object.values(demoConversations).find((s) => s.id === id);
}
