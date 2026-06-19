// Medication Interaction Checker — drug interaction detection engine
// Rule-based common drug interaction database
// Reference: FDA common interaction pairs

interface InteractionRule {
  drugs: string[];       // any 2+ match triggers
  severity: "info" | "warning" | "critical";
  message: string;
  messageKo: string;
  mechanism?: string;
}

interface InteractionResult {
  severity: "info" | "warning" | "critical";
  medications: string[];
  message: string;
  messageKo: string;
}

// ── Common drug interaction database ──
const INTERACTION_RULES: InteractionRule[] = [
  // ── Critical Interactions ──
  {
    drugs: ["warfarin", "aspirin"],
    severity: "critical",
    message: "Warfarin + Aspirin: Significantly increased bleeding risk. Consult your doctor immediately.",
    messageKo: "Warfarin + Aspirin: Significantly increased bleeding risk. Consult your doctor immediately.",
    mechanism: "Both affect blood clotting through different mechanisms",
  },
  {
    drugs: ["metformin", "alcohol"],
    severity: "critical",
    message: "Metformin + Alcohol: Risk of lactic acidosis. Avoid alcohol while taking metformin.",
    messageKo: "Metformin + Alcohol: Risk of lactic acidosis. Avoid alcohol while taking metformin.",
    mechanism: "Alcohol impairs lactate clearance",
  },
  {
    drugs: ["ssri", "SSRI", "maoi", "MAOI", "serotonin"],
    severity: "critical",
    message: "SSRI + MAOI: Risk of serotonin syndrome, a life-threatening condition. Never combine these medications.",
    messageKo: "SSRI + MAOI: Risk of serotonin syndrome, a life-threatening condition. Never combine these medications.",
    mechanism: "Excessive serotonin accumulation",
  },
  {
    drugs: ["lithium", "ibuprofen", "advil"],
    severity: "critical",
    message: "Lithium + Ibuprofen: NSAIDs can increase lithium levels to toxic range.",
    messageKo: "Lithium + Ibuprofen: NSAIDs can increase lithium levels to toxic range.",
    mechanism: "NSAIDs reduce renal lithium clearance",
  },

  // ── Warning Interactions ──
  {
    drugs: ["aspirin", "ibuprofen", "naproxen"],
    severity: "warning",
    message: "Aspirin + NSAIDs: Increased risk of GI bleeding. Take with food and consult your doctor.",
    messageKo: "Aspirin + NSAIDs: Increased risk of GI bleeding. Take with food and consult your doctor.",
  },
  {
    drugs: ["ace inhibitor", "ACE", "enalapril", "lisinopril", "potassium"],
    severity: "warning",
    message: "ACE inhibitor + Potassium: Risk of hyperkalemia (dangerously high potassium).",
    messageKo: "ACE inhibitor + Potassium: Risk of hyperkalemia (dangerously high potassium).",
  },
  {
    drugs: ["statin", "atorvastatin", "grapefruit"],
    severity: "warning",
    message: "Statins + Grapefruit: Grapefruit can increase statin levels, raising risk of muscle damage.",
    messageKo: "Statins + Grapefruit: Grapefruit can increase statin levels, raising risk of muscle damage.",
  },
  {
    drugs: ["methotrexate", "nsaid", "NSAID", "ibuprofen"],
    severity: "warning",
    message: "Methotrexate + NSAIDs: NSAIDs can reduce methotrexate excretion, increasing toxicity risk.",
    messageKo: "Methotrexate + NSAIDs: NSAIDs can reduce methotrexate excretion, increasing toxicity risk.",
  },
  {
    drugs: ["acetaminophen", "tylenol", "alcohol"],
    severity: "warning",
    message: "Acetaminophen + Alcohol: Increased risk of liver damage. Limit to recommended dose.",
    messageKo: "Acetaminophen + Alcohol: Increased risk of liver damage. Limit to recommended dose.",
  },
  {
    drugs: ["antihistamine", "cetirizine", "benzodiazepine", "zolpidem"],
    severity: "warning",
    message: "Antihistamine + Sedatives: Combined drowsiness effect. Avoid driving or operating machinery.",
    messageKo: "Antihistamine + Sedatives: Combined drowsiness effect. Avoid driving or operating machinery.",
  },
  {
    drugs: ["omeprazole", "clopidogrel", "plavix"],
    severity: "warning",
    message: "Omeprazole + Clopidogrel: PPI may reduce the antiplatelet effect of clopidogrel.",
    messageKo: "Omeprazole + Clopidogrel: PPI may reduce the antiplatelet effect of clopidogrel.",
  },

  // ── Info ──
  {
    drugs: ["iron", "calcium"],
    severity: "info",
    message: "Iron + Calcium: Take at different times for better absorption (2+ hours apart).",
    messageKo: "Iron + Calcium: Take at different times for better absorption (2+ hours apart).",
  },
  {
    drugs: ["thyroid", "levothyroxine", "calcium", "iron"],
    severity: "info",
    message: "Levothyroxine + Calcium/Iron: Take thyroid medication on empty stomach, 4 hours before supplements.",
    messageKo: "Levothyroxine + Calcium/Iron: Take thyroid medication on empty stomach, 4 hours before supplements.",
  },
  {
    drugs: ["antibiotic", "probiotic", "probiotics"],
    severity: "info",
    message: "Antibiotics + Probiotics: Take probiotics 2+ hours after antibiotics for effectiveness.",
    messageKo: "Antibiotics + Probiotics: Take probiotics 2+ hours after antibiotics for effectiveness.",
  },
  {
    drugs: ["blood pressure", "amlodipine", "lisinopril", "losartan"],
    severity: "info",
    message: "Multiple blood pressure medications detected. Ensure your doctor is aware of all medications.",
    messageKo: "Multiple blood pressure medications detected. Ensure your doctor is aware of all medications.",
  },
];

// ── NSAID list for broader matching ──
const NSAID_NAMES = [
  "ibuprofen", "naproxen", "diclofenac",
  "celecoxib", "indomethacin", "advil",
  "motrin", "aleve",
];

export class MedicationInteractionChecker {
  // Check all medications for known interactions
  checkInteractions(medications: string[], language: "ko" | "en" = "ko"): InteractionResult[] {
    if (medications.length < 2) return [];

    const normalizedMeds = medications.map(m => m.toLowerCase().trim());
    const results: InteractionResult[] = [];
    const seen = new Set<string>();

    for (const rule of INTERACTION_RULES) {
      const matchedDrugs = this.findMatchingDrugs(normalizedMeds, rule.drugs);
      if (matchedDrugs.length >= 2) {
        const key = matchedDrugs.sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          severity: rule.severity,
          medications: matchedDrugs,
          message: rule.message,
          messageKo: rule.messageKo,
        });
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return results;
  }

  // Check if a new medication conflicts with existing ones
  checkNewMedication(newMed: string, existingMeds: string[], language: "ko" | "en" = "ko"): InteractionResult[] {
    return this.checkInteractions([newMed, ...existingMeds], language);
  }

  // Detect if any input contains NSAID mentions
  isNSAID(medication: string): boolean {
    const lower = medication.toLowerCase();
    return NSAID_NAMES.some(n => lower.includes(n)) || /nsaid/i.test(lower);
  }

  private findMatchingDrugs(normalizedMeds: string[], rulePatterns: string[]): string[] {
    const matched: string[] = [];
    const ruleNormalized = rulePatterns.map(p => p.toLowerCase());

    for (const med of normalizedMeds) {
      for (const pattern of ruleNormalized) {
        if (med.includes(pattern) || pattern.includes(med)) {
          if (!matched.includes(med)) matched.push(med);
          break;
        }
      }
    }
    return matched;
  }
}

export const medicationInteractionChecker = new MedicationInteractionChecker();
