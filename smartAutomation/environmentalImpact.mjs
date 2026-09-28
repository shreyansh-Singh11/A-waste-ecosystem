/*
  ============================================================
  ENVIRONMENTAL IMPACT ENGINE — System 4
  ============================================================
  Pure functions, no file I/O (same pattern as matchingEngine.mjs and
  creditEngine.mjs) — takes an item (+ optional verified weight), returns
  an ESTIMATED environmental impact. All factors live in
  RULES.environmentalImpact.factors so tuning them never means touching
  logic here.

  These are sector-average estimates, not device-level lab
  measurements. Every value returned is explicitly labeled `estimated:
  true` and callers (API responses, UI) must not present these as
  scientifically precise.
*/
import { RULES } from "./rules.mjs";

function factorsFor(category) {
  const table = RULES.environmentalImpact.factors;
  return table[category] || table.default;
}

/**
 * @param {object} item - needs .category; optionally .weightKg (a
 *   verified weight captured at recycling time)
 * @returns {{ co2SavedKg: number, materialRecoveredKg: number,
 *   hazardousHandled: boolean, category: string, estimated: true,
 *   methodology: string }}
 */
export function calculateImpact(item, verificationData = {}) {
  const category = item.category || "Uncategorized";
  const base = factorsFor(category);
  const weightKg = typeof verificationData.weightKg === "number" ? verificationData.weightKg
    : typeof item.weightKg === "number" ? item.weightKg : null;

  // Flat per-unit estimate by default; if a real verified weight is
  // ever supplied, scale the per-unit factor by weight instead of
  // using it as-is (weight is a multiplier on the category baseline,
  // not a replacement for it — this project has no per-kg material
  // composition table).
  const scale = weightKg !== null ? Math.max(weightKg, 0.1) / 1 : 1;

  return {
    category,
    co2SavedKg: Math.round(base.co2SavedKg * scale * 100) / 100,
    materialRecoveredKg: Math.round(base.materialRecoveredKg * scale * 100) / 100,
    hazardousHandled: !!base.hazardous,
    estimated: true,
    methodology: weightKg !== null
      ? `Estimated from category baseline for "${category}", scaled by verified weight (${weightKg}kg).`
      : `Estimated per-unit average for category "${category}". No verified weight was captured.`,
  };
}

/**
 * Aggregates impact across a set of items that already carry a stored
 * `.environmentalImpact` (i.e. items that have completed recycling —
 * unrecycled items have no impact yet, by design). Used for user,
 * collector, recycler, and government-level rollups.
 */
export function aggregateImpact(items) {
  const withImpact = items.filter((it) => it.environmentalImpact);
  const totals = withImpact.reduce(
    (acc, it) => {
      acc.co2SavedKg += it.environmentalImpact.co2SavedKg || 0;
      acc.materialRecoveredKg += it.environmentalImpact.materialRecoveredKg || 0;
      if (it.environmentalImpact.hazardousHandled) acc.hazardousItemsHandled += 1;
      return acc;
    },
    { co2SavedKg: 0, materialRecoveredKg: 0, hazardousItemsHandled: 0 }
  );
  return {
    itemsRecycled: withImpact.length,
    co2SavedKg: Math.round(totals.co2SavedKg * 100) / 100,
    materialRecoveredKg: Math.round(totals.materialRecoveredKg * 100) / 100,
    hazardousItemsHandled: totals.hazardousItemsHandled,
    estimated: true,
  };
}
