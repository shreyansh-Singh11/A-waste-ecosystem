/*
  ============================================================
  CREDIT ENGINE — System 2 (Automated Credit, Reward & Verification)
  ============================================================
  Spec requirement: "Do NOT hard-code credit calculations throughout
  the application. Create a centralized credit calculation service."

  This is that service. It's a pure function — no file I/O, no
  wallet/transaction writing (that stays in decisionEngine.mjs, same
  separation of concerns as matchingEngine.mjs). Every credit number
  in the whole app is either produced by this function or is a
  spend/reversal amount that already came from a stored transaction —
  nowhere else computes a credit value from scratch.
*/
import { RULES } from "./rules.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METALS_FILE = path.join(__dirname, "..", "data", "preciousMetalsByModel.json");

let _metalsCache = null;
function loadMetalsDb() {
  // Cached after first read — this is static reference data, not
  // something that changes at runtime, so there's no need to re-read
  // the file on every credit calculation.
  if (_metalsCache) return _metalsCache;
  try {
    _metalsCache = JSON.parse(readFileSync(METALS_FILE, "utf-8"));
  } catch {
    _metalsCache = {};
  }
  return _metalsCache;
}

/**
 * Looks up a device model (case-insensitive) in the precious-metals
 * database, falling back to a generic per-category entry when the
 * exact model isn't catalogued. Returns null if neither resolves —
 * e.g. no deviceModel was supplied, or the category has no fallback.
 */
export function lookupPreciousMetals(deviceModel, category, rules = RULES.credits.preciousMetals) {
  const db = loadMetalsDb();
  if (deviceModel) {
    const key = Object.keys(db).find((k) => k.toLowerCase() === String(deviceModel).trim().toLowerCase());
    if (key) return { matchedKey: key, exact: true, ...db[key] };
  }
  const fallbackKey = category && rules.categoryFallback[category];
  if (fallbackKey && db[fallbackKey]) {
    return { matchedKey: fallbackKey, exact: false, ...db[fallbackKey] };
  }
  return null;
}

/**
 * Converts a metals-grams entry into an estimated INR value and the
 * resulting (capped) credit bonus, using the centralized reference
 * prices/rate/cap in RULES.credits.preciousMetals.
 */
export function calculatePreciousMetalBonus(deviceModel, category, rules = RULES.credits.preciousMetals) {
  const match = lookupPreciousMetals(deviceModel, category, rules);
  if (!match) return { bonus: 0, valueINR: 0, match: null };

  const valueINR = Object.entries(match.metalsGrams).reduce(
    (sum, [metal, grams]) => sum + grams * (rules.pricePerGramINR[metal] || 0),
    0
  );
  const bonus = Math.min(Math.round(valueINR * rules.valueToCreditsRate), rules.maxBonus);
  return { bonus, valueINR: Math.round(valueINR), match };
}

/**
 * @param {object} item - the EWasteItem (needs .outcome, .category; optionally .deviceModel)
 * @param {object} [verificationData] - optional extra data from the
 *   verification step, e.g. { weightKg }
 * @param {object} [rules] - defaults to RULES.credits / RULES.hazardousCategories
 * @returns {{ credits: number, breakdown: object }}
 */
export function calculateCredits(item, verificationData = {}, rules = RULES.credits) {
  const base = rules.base[item.outcome] ?? rules.base.default;
  const isHazardous = RULES.hazardousCategories.includes(item.category);
  const hazardousBonus = isHazardous ? rules.hazardousBonus : 0;
  const weightBonus = verificationData.weightKg ? verificationData.weightKg * (rules.perKgBonus || 0) : 0;

  // Only awarded when the item has a deviceModel that resolves (exactly
  // or via category fallback) to an entry in the precious-metals
  // database — items with no model info simply get 0 here, unchanged
  // from this feature's absence.
  const metalResult = calculatePreciousMetalBonus(item.deviceModel, item.category, rules.preciousMetals);
  const preciousMetalBonus = metalResult.bonus;

  const credits = Math.round(base + hazardousBonus + weightBonus + preciousMetalBonus);

  return {
    credits,
    breakdown: {
      base, hazardousBonus, weightBonus, preciousMetalBonus,
      preciousMetalValueINR: metalResult.valueINR,
      preciousMetalMatch: metalResult.match ? metalResult.match.matchedKey : null,
      outcome: item.outcome, category: item.category || null,
    },
  };
}

