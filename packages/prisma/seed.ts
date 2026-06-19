// DB Seed Script — initial data seed
// Usage: npx tsx packages/prisma/seed.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Daily Tips (20) ──
  const tips = [
    { title: "Stay Hydrated", titleKo: "Stay Hydrated", content: "Aim for 8 glasses of water daily. Proper hydration aids digestion, circulation, and brain function.", contentKo: "Aim for 8 glasses of water daily. Proper hydration aids digestion, circulation, and brain function.", category: "general", relatedSnomedCodes: [] },
    { title: "Sleep Hygiene", titleKo: "Sleep Hygiene", content: "Keep a consistent sleep schedule. Avoid screens 1 hour before bed.", contentKo: "Keep a consistent sleep schedule. Avoid screens 1 hour before bed.", category: "sleep", relatedSnomedCodes: ["193462001"] },
    { title: "Walking Benefits", titleKo: "Walking Benefits", content: "Just 30 minutes of daily walking reduces heart disease risk by 35%.", contentKo: "Just 30 minutes of daily walking reduces heart disease risk by 35%.", category: "exercise", relatedSnomedCodes: [] },
    { title: "Headache Prevention", titleKo: "Headache Prevention", content: "Regular meals, hydration, and managing screen time can prevent tension headaches.", contentKo: "Regular meals, hydration, and managing screen time can prevent tension headaches.", category: "neurological", relatedSnomedCodes: ["25064002"] },
    { title: "Stress Management", titleKo: "Stress Management", content: "Practice 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s. Repeat 4 times.", contentKo: "Practice 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s. Repeat 4 times.", category: "mental", relatedSnomedCodes: ["73595000", "247592009"] },
    { title: "Vitamin D", titleKo: "Vitamin D", content: "Get 15-20 minutes of sunlight daily for vitamin D production. Essential for bone health and immunity.", contentKo: "Get 15-20 minutes of sunlight daily for vitamin D production. Essential for bone health and immunity.", category: "nutrition", relatedSnomedCodes: [] },
    { title: "Hand Washing", titleKo: "Hand Washing", content: "Wash hands for 20 seconds with soap and water. Reduces infection risk by up to 50%.", contentKo: "Wash hands for 20 seconds with soap and water. Reduces infection risk by up to 50%.", category: "hygiene", relatedSnomedCodes: ["386661006"] },
    { title: "Eye Care", titleKo: "Eye Care", content: "Follow the 20-20-20 rule: every 20 min, look at something 20 feet away for 20 seconds.", contentKo: "Follow the 20-20-20 rule: every 20 min, look at something 20 feet (6m) away for 20 seconds.", category: "eye", relatedSnomedCodes: ["246636008", "193570009"] },
    { title: "Gut Health", titleKo: "Gut Health", content: "Include fermented foods like yogurt, kefir, and sauerkraut for beneficial gut bacteria.", contentKo: "Include fermented foods like yogurt, kefir, and sauerkraut to nurture beneficial gut bacteria.", category: "digestive", relatedSnomedCodes: ["3006004", "62315008"] },
    { title: "Blood Pressure Check", titleKo: "Blood Pressure Check", content: "Adults over 40 should check blood pressure at least once a year.", contentKo: "Adults over 40 should check their blood pressure at least once a year.", category: "cardiovascular", relatedSnomedCodes: ["38341003"] },
    { title: "Iron-Rich Foods", titleKo: "Iron-Rich Foods", content: "Combat fatigue with iron-rich foods: spinach, red meat, lentils, and fortified cereals.", contentKo: "Combat fatigue with iron-rich foods like spinach, red meat, and lentils.", category: "nutrition", relatedSnomedCodes: ["84229001", "267036007"] },
    { title: "Stretching", titleKo: "Stretching", content: "5 minutes of stretching every 2 hours reduces muscle tension and improves circulation.", contentKo: "5 minutes of stretching every 2 hours reduces muscle tension and improves circulation.", category: "exercise", relatedSnomedCodes: ["267102003", "161891005"] },
    { title: "Portion Control", titleKo: "Portion Control", content: "Use a smaller plate to naturally reduce portion sizes. Chew slowly for better digestion.", contentKo: "Use a smaller plate to naturally reduce portion sizes. Chewing slowly aids digestion.", category: "nutrition", relatedSnomedCodes: [] },
    { title: "Cold Prevention", titleKo: "Cold Prevention", content: "Zinc lozenges within 24 hours of symptom onset may reduce cold duration by 33%.", contentKo: "Taking zinc lozenges within 24 hours of symptom onset may reduce cold duration by 33%.", category: "general", relatedSnomedCodes: ["49727002", "162397003"] },
    { title: "Mental Health Check", titleKo: "Mental Health Check", content: "It's okay to not be okay. If you feel persistently sad for 2+ weeks, consider talking to a professional.", contentKo: "It's okay to not be okay. If you feel persistently down for more than 2 weeks, consider talking to a professional.", category: "mental", relatedSnomedCodes: ["35489007", "247592009"] },
    { title: "Posture Check", titleKo: "Posture Check", content: "Keep your screen at eye level. Shoulders back, feet flat on the floor.", contentKo: "Keep your screen at eye level, shoulders back, and feet flat on the floor.", category: "musculoskeletal", relatedSnomedCodes: ["161891005", "81680005"] },
    { title: "Allergy Management", titleKo: "Allergy Management", content: "Track your allergy triggers. Common ones: pollen, dust mites, pet dander, mold.", contentKo: "Track your allergy triggers. Common ones include pollen, dust mites, pet dander, and mold.", category: "allergy", relatedSnomedCodes: ["162607003", "271807003"] },
    { title: "Meditation", titleKo: "Meditation", content: "Even 5 minutes of daily meditation reduces cortisol levels and improves focus.", contentKo: "Even 5 minutes of daily meditation reduces cortisol levels and improves focus.", category: "mental", relatedSnomedCodes: ["73595000"] },
    { title: "Heart Rate Zones", titleKo: "Heart Rate Zones", content: "Moderate exercise: 50-70% max heart rate. Vigorous: 70-85%. Calculate: 220 minus your age.", contentKo: "Moderate exercise: 50-70% of max heart rate. Vigorous: 70-85%. Calculate as 220 minus your age.", category: "exercise", relatedSnomedCodes: [] },
    { title: "Dental Health", titleKo: "Dental Health", content: "Brush twice daily, floss once. Poor oral health is linked to heart disease and diabetes.", contentKo: "Brush twice daily and floss once. Poor oral health is linked to heart disease and diabetes.", category: "dental", relatedSnomedCodes: [] },
  ];

  for (const tip of tips) {
    await prisma.dailyTip.create({ data: tip });
  }
  console.log(`  ✅ ${tips.length} daily tips seeded`);

  // ── Quiz Questions (15) ──
  const quizzes = [
    { question: "How many glasses of water should you drink daily?", questionKo: "How many glasses of water should you drink daily?", options: [{ text: "4 glasses", textKo: "4 glasses" }, { text: "8 glasses", textKo: "8 glasses" }, { text: "12 glasses", textKo: "12 glasses" }, { text: "2 glasses", textKo: "2 glasses" }], correctIndex: 1, explanation: "Health experts recommend approximately 8 glasses (~2L) of water daily for adults.", explanationKo: "Health experts recommend approximately 8 glasses (~2L) of water daily for adults.", category: "nutrition", difficulty: "easy", rewardAmount: 5 },
    { question: "Which vitamin is produced by sunlight exposure?", questionKo: "Which vitamin is produced by sunlight exposure?", options: [{ text: "Vitamin A", textKo: "Vitamin A" }, { text: "Vitamin B12", textKo: "Vitamin B12" }, { text: "Vitamin C", textKo: "Vitamin C" }, { text: "Vitamin D", textKo: "Vitamin D" }], correctIndex: 3, explanation: "UVB rays from sunlight trigger vitamin D synthesis in the skin.", explanationKo: "UVB rays from sunlight trigger vitamin D synthesis in the skin.", category: "nutrition", difficulty: "easy", rewardAmount: 5 },
    { question: "What is the recommended daily walking time for heart health?", questionKo: "What is the recommended daily walking time for heart health?", options: [{ text: "10 minutes", textKo: "10 minutes" }, { text: "30 minutes", textKo: "30 minutes" }, { text: "60 minutes", textKo: "60 minutes" }, { text: "90 minutes", textKo: "90 minutes" }], correctIndex: 1, explanation: "30 minutes of brisk walking daily can reduce cardiovascular disease risk by 35%.", explanationKo: "30 minutes of brisk walking daily can reduce cardiovascular disease risk by 35%.", category: "exercise", difficulty: "easy", rewardAmount: 5 },
    { question: "Normal adult body temperature is approximately?", questionKo: "Normal adult body temperature is approximately?", options: [{ text: "35.5°C", textKo: "35.5°C" }, { text: "36.5°C", textKo: "36.5°C" }, { text: "37.5°C", textKo: "37.5°C" }, { text: "38.5°C", textKo: "38.5°C" }], correctIndex: 1, explanation: "Normal body temperature is around 36.5°C (97.7°F), though it can vary slightly.", explanationKo: "Normal body temperature is around 36.5°C (97.7°F), though it can vary slightly.", category: "general", difficulty: "easy", rewardAmount: 5 },
    { question: "How long should you wash your hands to effectively remove germs?", questionKo: "How long should you wash your hands to effectively remove germs?", options: [{ text: "5 seconds", textKo: "5 seconds" }, { text: "10 seconds", textKo: "10 seconds" }, { text: "20 seconds", textKo: "20 seconds" }, { text: "60 seconds", textKo: "60 seconds" }], correctIndex: 2, explanation: "WHO recommends washing hands for at least 20 seconds with soap and water.", explanationKo: "WHO recommends washing hands for at least 20 seconds with soap and water.", category: "hygiene", difficulty: "easy", rewardAmount: 5 },
    { question: "Which of these is NOT a symptom of dehydration?", questionKo: "Which of these is NOT a symptom of dehydration?", options: [{ text: "Dark urine", textKo: "Dark urine" }, { text: "Dizziness", textKo: "Dizziness" }, { text: "Runny nose", textKo: "Runny nose" }, { text: "Headache", textKo: "Headache" }], correctIndex: 2, explanation: "Runny nose is typically a sign of infection or allergy, not dehydration.", explanationKo: "Runny nose is typically a sign of infection or allergy, not dehydration.", category: "general", difficulty: "medium", rewardAmount: 8 },
    { question: "The 20-20-20 rule for eye health means:", questionKo: "The 20-20-20 rule for eye health means:", options: [{ text: "20 blinks, 20 times, 20 minutes", textKo: "20 blinks, 20 times, 20 minutes" }, { text: "Every 20 min, look 20 feet away for 20 sec", textKo: "Every 20 min, look 20 feet away for 20 sec" }, { text: "20 drops, 20 minutes, 20 times", textKo: "20 drops, 20 minutes, 20 times" }, { text: "Rest eyes for 20 min every 20 hours", textKo: "Rest eyes for 20 min every 20 hours" }], correctIndex: 1, explanation: "The 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds to reduce eye strain.", explanationKo: "The 20-20-20 rule: Every 20 minutes, look at something 20 feet (6m) away for 20 seconds to reduce eye strain.", category: "eye", difficulty: "medium", rewardAmount: 8 },
    { question: "What percentage of max heart rate is recommended for moderate exercise?", questionKo: "What percentage of max heart rate is recommended for moderate exercise?", options: [{ text: "30-40%", textKo: "30-40%" }, { text: "50-70%", textKo: "50-70%" }, { text: "80-90%", textKo: "80-90%" }, { text: "95-100%", textKo: "95-100%" }], correctIndex: 1, explanation: "Moderate exercise targets 50-70% of your maximum heart rate (220 - age).", explanationKo: "Moderate exercise targets 50-70% of your maximum heart rate (220 - age).", category: "exercise", difficulty: "medium", rewardAmount: 8 },
    { question: "Which breathing technique is known for stress relief?", questionKo: "Which breathing technique is known for stress relief?", options: [{ text: "2-2-2 breathing", textKo: "2-2-2 breathing" }, { text: "4-7-8 breathing", textKo: "4-7-8 breathing" }, { text: "10-10-10 breathing", textKo: "10-10-10 breathing" }, { text: "1-1-1 breathing", textKo: "1-1-1 breathing" }], correctIndex: 1, explanation: "4-7-8 breathing: Inhale 4 seconds, hold 7 seconds, exhale 8 seconds. Activates parasympathetic system.", explanationKo: "4-7-8 breathing: Inhale 4 seconds, hold 7 seconds, exhale 8 seconds. Activates the parasympathetic system.", category: "mental", difficulty: "medium", rewardAmount: 8 },
    { question: "SNOMED CT is a system for:", questionKo: "SNOMED CT is a system for:", options: [{ text: "Food nutrition tracking", textKo: "Food nutrition tracking" }, { text: "Medical terminology coding", textKo: "Medical terminology coding" }, { text: "Exercise measurement", textKo: "Exercise measurement" }, { text: "Weather forecasting", textKo: "Weather forecasting" }], correctIndex: 1, explanation: "SNOMED CT (Clinical Terms) is a comprehensive medical terminology system used worldwide for clinical documentation.", explanationKo: "SNOMED CT (Clinical Terms) is a comprehensive medical terminology system used worldwide for clinical documentation.", category: "health_tech", difficulty: "hard", rewardAmount: 10 },
    { question: "What is the emergency number in the United States?", questionKo: "What is the emergency number in the United States?", options: [{ text: "112", textKo: "112" }, { text: "119", textKo: "119" }, { text: "911", textKo: "911" }, { text: "999", textKo: "999" }], correctIndex: 2, explanation: "911 is the emergency number in the United States for police, fire, and medical emergencies.", explanationKo: "911 is the emergency number in the United States for police, fire, and medical emergencies.", category: "safety", difficulty: "easy", rewardAmount: 5 },
    { question: "How many hours of sleep do most adults need?", questionKo: "How many hours of sleep do most adults need?", options: [{ text: "4-5 hours", textKo: "4-5 hours" }, { text: "5-6 hours", textKo: "5-6 hours" }, { text: "7-9 hours", textKo: "7-9 hours" }, { text: "10-12 hours", textKo: "10-12 hours" }], correctIndex: 2, explanation: "Most adults need 7-9 hours of sleep per night for optimal health and cognitive function.", explanationKo: "Most adults need 7-9 hours of sleep per night for optimal health and cognitive function.", category: "sleep", difficulty: "easy", rewardAmount: 5 },
    { question: "What does FHIR stand for in healthcare?", questionKo: "What does FHIR stand for in healthcare?", options: [{ text: "Fast Healthcare Interoperability Resources", textKo: "Fast Healthcare Interoperability Resources" }, { text: "Federal Health Information Registry", textKo: "Federal Health Information Registry" }, { text: "First Health Integration Report", textKo: "First Health Integration Report" }, { text: "Foundation for Health IT Research", textKo: "Foundation for Health IT Research" }], correctIndex: 0, explanation: "FHIR (Fast Healthcare Interoperability Resources) is an HL7 standard for exchanging healthcare information electronically.", explanationKo: "FHIR (Fast Healthcare Interoperability Resources) is an HL7 standard for exchanging healthcare information electronically.", category: "health_tech", difficulty: "hard", rewardAmount: 10 },
    { question: "Which mineral deficiency commonly causes fatigue?", questionKo: "Which mineral deficiency commonly causes fatigue?", options: [{ text: "Calcium", textKo: "Calcium" }, { text: "Iron", textKo: "Iron" }, { text: "Sodium", textKo: "Sodium" }, { text: "Potassium", textKo: "Potassium" }], correctIndex: 1, explanation: "Iron deficiency is the most common nutritional deficiency worldwide and a leading cause of fatigue.", explanationKo: "Iron deficiency is the most common nutritional deficiency worldwide and a leading cause of fatigue.", category: "nutrition", difficulty: "medium", rewardAmount: 8 },
    { question: "What is the ideal indoor humidity range?", questionKo: "What is the ideal indoor humidity range?", options: [{ text: "10-20%", textKo: "10-20%" }, { text: "40-60%", textKo: "40-60%" }, { text: "70-80%", textKo: "70-80%" }, { text: "90-100%", textKo: "90-100%" }], correctIndex: 1, explanation: "40-60% indoor humidity is ideal. Too low causes dry skin/respiratory issues; too high promotes mold.", explanationKo: "40-60% indoor humidity is ideal. Too low causes dry skin and respiratory issues; too high promotes mold.", category: "general", difficulty: "medium", rewardAmount: 8 },
  ];

  for (const quiz of quizzes) {
    await prisma.quizQuestion.create({ data: { ...quiz, options: quiz.options as any } });
  }
  console.log(`  ✅ ${quizzes.length} quiz questions seeded`);

  // ── Courses (3) ──
  const courses = [
    {
      title: "Understanding Your Body", titleKo: "Understanding Your Body",
      description: "Learn the basics of how your body works and common health indicators.",
      descriptionKo: "Learn the basics of how your body works and common health indicators.",
      category: "basics", totalReward: 50,
      modules: [
        { id: 0, title: "Vital Signs 101", titleKo: "Vital Signs 101", content: "Learn about body temperature, heart rate, blood pressure, and respiratory rate." },
        { id: 1, title: "Understanding Pain", titleKo: "Understanding Pain", content: "Different types of pain and when to seek medical attention." },
        { id: 2, title: "Sleep Science", titleKo: "Sleep Science", content: "Sleep cycles, circadian rhythm, and tips for better sleep." },
        { id: 3, title: "Nutrition Basics", titleKo: "Nutrition Basics", content: "Macronutrients, micronutrients, and balanced diet principles." },
        { id: 4, title: "Exercise Fundamentals", titleKo: "Exercise Fundamentals", content: "Types of exercise, heart rate zones, and weekly recommendations." },
      ],
    },
    {
      title: "Chronic Disease Prevention", titleKo: "Chronic Disease Prevention",
      description: "Understanding and preventing common chronic diseases.",
      descriptionKo: "Understanding and preventing common chronic diseases.",
      category: "prevention", totalReward: 50,
      modules: [
        { id: 0, title: "Heart Health", titleKo: "Heart Health", content: "Risk factors and prevention strategies for cardiovascular disease." },
        { id: 1, title: "Diabetes Awareness", titleKo: "Diabetes Awareness", content: "Type 1, Type 2 diabetes prevention and blood sugar management." },
        { id: 2, title: "Mental Health", titleKo: "Mental Health", content: "Recognizing anxiety, depression, and stress management techniques." },
        { id: 3, title: "Cancer Screening", titleKo: "Cancer Screening", content: "Recommended screening schedules by age and gender." },
      ],
    },
    {
      title: "Digital Health Literacy", titleKo: "Digital Health Literacy",
      description: "Navigate health information in the digital age.",
      descriptionKo: "Navigate health information in the digital age.",
      category: "digital_health", totalReward: 30,
      modules: [
        { id: 0, title: "Health Data Privacy", titleKo: "Health Data Privacy", content: "Understanding your health data rights and how data is protected." },
        { id: 1, title: "Reading Lab Results", titleKo: "Reading Lab Results", content: "How to interpret common blood test results." },
        { id: 2, title: "Telehealth Guide", titleKo: "Telehealth Guide", content: "When and how to use telemedicine services." },
      ],
    },
  ];

  for (const course of courses) {
    await prisma.course.create({ data: { ...course, modules: course.modules as any } });
  }
  console.log(`  ✅ ${courses.length} courses seeded`);

  console.log("✅ Database seeding complete!");
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
