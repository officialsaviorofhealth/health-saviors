// SNOMED CT Common Symptom Lookup — 65+ entries
export interface SnomedEntry {
  display: string;
  displayKo: string;
  icdCode: string;
}

export const SNOMED_LOOKUP: Record<string, SnomedEntry> = {
  // ── Head & Neurological ──
  "25064002":  { display: "Headache", displayKo: "Headache", icdCode: "R51" },
  "37796009":  { display: "Migraine", displayKo: "Migraine", icdCode: "G43.9" },
  "404640003": { display: "Dizziness", displayKo: "Dizziness", icdCode: "R42" },
  "60862001":  { display: "Tinnitus", displayKo: "Tinnitus", icdCode: "H93.19" },
  "246636008": { display: "Blurred vision", displayKo: "Blurred vision", icdCode: "H53.8" },
  "81680005":  { display: "Neck pain", displayKo: "Neck pain", icdCode: "M54.2" },
  "3723001":   { display: "Vertigo", displayKo: "Vertigo", icdCode: "R42" },

  // ── Respiratory ──
  "49727002":  { display: "Cough", displayKo: "Cough", icdCode: "R05" },
  "162397003": { display: "Sore throat", displayKo: "Sore throat", icdCode: "R07.0" },
  "267036007": { display: "Shortness of breath", displayKo: "Shortness of breath", icdCode: "R06.00" },
  "68962001":  { display: "Runny nose", displayKo: "Runny nose", icdCode: "R09.81" },
  "64531003":  { display: "Nasal congestion", displayKo: "Nasal congestion", icdCode: "R09.81" },
  "162607003": { display: "Sneezing", displayKo: "Sneezing", icdCode: "R06.7" },
  "28743005":  { display: "Productive cough", displayKo: "Productive cough", icdCode: "R05.09" },
  "56018004":  { display: "Wheezing", displayKo: "Wheezing", icdCode: "R06.2" },

  // ── Cardiovascular ──
  "29857009":  { display: "Chest pain", displayKo: "Chest pain", icdCode: "R07.9" },
  "23924001":  { display: "Tight chest", displayKo: "Tight chest", icdCode: "R07.89" },
  "162116003": { display: "Palpitations", displayKo: "Palpitations", icdCode: "R00.2" },
  "45007003":  { display: "Low blood pressure", displayKo: "Low blood pressure", icdCode: "I95.9" },
  "38341003":  { display: "High blood pressure", displayKo: "High blood pressure", icdCode: "I10" },
  "271594007": { display: "Syncope", displayKo: "Syncope", icdCode: "R55" },

  // ── Gastrointestinal ──
  "422587007": { display: "Nausea", displayKo: "Nausea", icdCode: "R11.0" },
  "422400008": { display: "Vomiting", displayKo: "Vomiting", icdCode: "R11.10" },
  "62315008":  { display: "Diarrhea", displayKo: "Diarrhea", icdCode: "R19.7" },
  "22253000":  { display: "Abdominal pain", displayKo: "Abdominal pain", icdCode: "R10.9" },
  "3006004":   { display: "Constipation", displayKo: "Constipation", icdCode: "K59.00" },
  "279079003": { display: "Bloating", displayKo: "Bloating", icdCode: "R14.0" },
  "271681002": { display: "Stomach ache", displayKo: "Stomach ache", icdCode: "R10.13" },
  "16331000":  { display: "Heartburn", displayKo: "Heartburn", icdCode: "R12" },
  "248490000": { display: "Loss of appetite", displayKo: "Loss of appetite", icdCode: "R63.0" },
  "386661006": { display: "Fever", displayKo: "Fever", icdCode: "R50.9" },

  // ── Musculoskeletal ──
  "57676002":  { display: "Joint pain", displayKo: "Joint pain", icdCode: "M25.50" },
  "161891005": { display: "Back pain", displayKo: "Back pain", icdCode: "M54.9" },
  "267102003": { display: "Sore muscles", displayKo: "Sore muscles", icdCode: "M79.10" },
  "30989003":  { display: "Knee pain", displayKo: "Knee pain", icdCode: "M25.56" },
  "53627009":  { display: "Shoulder pain", displayKo: "Shoulder pain", icdCode: "M25.51" },
  "34840004":  { display: "Wrist pain", displayKo: "Wrist pain", icdCode: "M25.53" },
  "298325004": { display: "Hip pain", displayKo: "Hip pain", icdCode: "M25.55" },
  "95388000":  { display: "Numbness", displayKo: "Numbness", icdCode: "R20.2" },

  // ── Skin ──
  "271807003": { display: "Rash", displayKo: "Rash", icdCode: "R21" },
  "418363000": { display: "Itching", displayKo: "Itching", icdCode: "L29.9" },
  "271767006": { display: "Hives", displayKo: "Hives", icdCode: "L50.9" },
  "74964007":  { display: "Acne", displayKo: "Acne", icdCode: "L70.0" },
  "95320005":  { display: "Eczema", displayKo: "Eczema", icdCode: "L30.9" },
  "271757001": { display: "Bruising", displayKo: "Bruising", icdCode: "T14.8" },

  // ── Eye & Ear ──
  "75971007":  { display: "Eye pain", displayKo: "Eye pain", icdCode: "H57.10" },
  "193570009": { display: "Dry eyes", displayKo: "Dry eyes", icdCode: "H04.12" },
  "77465006":  { display: "Ear pain", displayKo: "Ear pain", icdCode: "H92.09" },
  "60862001x": { display: "Hearing loss", displayKo: "Hearing loss", icdCode: "H91.9" },

  // ── Urinary ──
  "49650001":  { display: "Dysuria", displayKo: "Dysuria", icdCode: "R30.0" },
  "162116003x": { display: "Frequent urination", displayKo: "Frequent urination", icdCode: "R35.0" },
  "34436003":  { display: "Blood in urine", displayKo: "Blood in urine", icdCode: "R31.9" },

  // ── Mental Health ──
  "247592009": { display: "Anxiety", displayKo: "Anxiety", icdCode: "F41.9" },
  "35489007":  { display: "Depression", displayKo: "Depression", icdCode: "F32.9" },
  "193462001": { display: "Insomnia", displayKo: "Insomnia", icdCode: "G47.00" },
  "73595000":  { display: "Stress", displayKo: "Stress", icdCode: "F43.9" },
  "5794003":   { display: "Panic attack", displayKo: "Panic attack", icdCode: "F41.0" },

  // ── General ──
  "84229001":  { display: "Fatigue", displayKo: "Fatigue", icdCode: "R53.83" },
  "43724002":  { display: "Chills", displayKo: "Chills", icdCode: "R68.83" },
  "36955009":  { display: "Loss of taste", displayKo: "Loss of taste", icdCode: "R43.2" },
  "44169009":  { display: "Loss of smell", displayKo: "Loss of smell", icdCode: "R43.0" },
  "84229001x": { display: "Weight gain", displayKo: "Weight gain", icdCode: "R63.5" },
  "89362005":  { display: "Weight loss", displayKo: "Weight loss", icdCode: "R63.4" },
  "271823003": { display: "Night sweats", displayKo: "Night sweats", icdCode: "R61" },
  "267036008": { display: "Swollen lymph nodes", displayKo: "Swollen lymph nodes", icdCode: "R59.9" },
  "267082004": { display: "Edema", displayKo: "Edema", icdCode: "R60.9" },

  // ── Women's Health ──
  "431237007": { display: "Menstrual cramps", displayKo: "Menstrual cramps", icdCode: "N94.6" },
  "289530006": { display: "Irregular periods", displayKo: "Irregular periods", icdCode: "N92.6" },
  "64779008":  { display: "Hot flashes", displayKo: "Hot flashes", icdCode: "N95.1" },
};
