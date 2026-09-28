// ============================================================
// ALL RULE CONFIGURATION LIVES HERE — nowhere else.
// If you need to change a threshold, weight, or the allowed status
// flow, this is the only file to touch.
// ============================================================
export const RULES = {
  // Only these forward, single-step transitions are ever allowed.
  // Anything not listed here (skipping a stage, going backward, or
  // acting on RECYCLED) is rejected by the engine automatically.
  statusTransitions: {
    REGISTERED: ["BOOKED"],
    BOOKED: ["COLLECTED"],
    COLLECTED: ["RECEIVED"],
    RECEIVED: ["SORTED"],
    SORTED: ["PROCESSING"],
    PROCESSING: ["RECYCLED"],
    RECYCLED: [], // terminal — nothing can follow it
  },

  // Gemini confidence thresholds (0-1). Configurable via .env so you
  // don't have to edit code to tune them.
  aiConfidence: {
    autoAccept: parseFloat(process.env.AI_CONFIDENCE_AUTO_ACCEPT || "0.8"),
    needsConfirmation: parseFloat(process.env.AI_CONFIDENCE_NEEDS_CONFIRMATION || "0.5"),
  },

  // Simple, extensible collection-priority scoring. No real GPS/distance
  // data exists in this project, so distance isn't a factor yet — this
  // is intentionally the hook where it would plug in later.
  priority: {
    hazardousWeight: 40, // flat bonus if item.category is hazardous
    urgencyWeight: 30,   // multiplied by an optional 0-1 urgency value from the user
    waitingTimeWeightPerHour: 2,
    waitingTimeCapHours: 24, // waiting bonus stops growing after this many hours
    thresholds: { high: 50, medium: 25 }, // score >= high -> HIGH, >= medium -> MEDIUM, else LOW
  },

  // Which categories count as "hazardous" for priority scoring.
  // Matches the category vocabulary already used by the AI identification feature.
  hazardousCategories: ["Battery / Power"],

  // ============================================================
  // SYSTEM 2 — Centralized credit calculation config. This is the
  // ONLY place credit numbers live — see creditEngine.mjs's
  // calculateCredits(), which is the ONLY function allowed to read
  // these. Nothing else in the app hardcodes a credit value.
  // ============================================================
  credits: {
    // Base credits by outcome (same values the project used before
    // System 2 existed, kept as the "base" tier now).
    base: { Reused: 40, Refurbished: 30, Recycled: 20, default: 20 },
    // Flat bonus if the item's category is hazardous (reuses
    // hazardousCategories above) — hazardous e-waste is more
    // important to see properly recycled, so it's worth more.
    hazardousBonus: 10,
    // Small bonus per kg if a weight was supplied at verification —
    // 0 by default since this demo has no real scale integration.
    perKgBonus: 0,

    // Precious-metal recovery bonus: on top of the flat outcome/
    // hazardous credits above, a device earns extra credits
    // proportional to the estimated gold/silver/palladium/copper it
    // contains (see data/preciousMetalsByModel.json). Only applied
    // when the citizen supplied a deviceModel that resolves to an
    // entry in that file — items with no matching model get 0 bonus
    // here, same as before this feature existed.
    preciousMetals: {
      // Illustrative reference prices (INR/gram) — a real deployment
      // would pull these from a live commodities feed instead of a
      // fixed constant, but a static reference point is enough for
      // a proportional, explainable bonus in this demo.
      pricePerGramINR: { gold: 6200, silver: 82, palladium: 3100, copper: 0.75 },
      // Recoverable metal value (INR) -> credits. Deliberately small
      // so this stays a bonus, not the dominant credit source.
      valueToCreditsRate: 0.02,
      // Safety cap so no single device's metal content can dwarf the
      // rest of the credit scale (e.g. a high-copper appliance).
      maxBonus: 50,
      // Falls back to a generic per-category estimate (from the same
      // data file) when the citizen's exact model isn't in the
      // database — keeps the feature useful without needing every
      // model on Earth catalogued.
      categoryFallback: {
        "Smartphone": "Generic Smartphone",
        "Laptop": "Generic Laptop",
        "Computing Device": "Generic Desktop",
        "Monitor": "Generic Monitor",
        "Battery / Power": "Generic Battery",
      },
    },
  },

  // ============================================================
  // SYSTEM 2 — Reward claim rules.
  // ============================================================
  rewards: {
    // A reward can only be claimed once per user unless the reward
    // record itself sets `repeatable: true`.
    defaultRepeatable: false,
  },

  // ============================================================
  // SYSTEM 1 — Collection Request lifecycle (mirrors the item's
  // 7-stage lifecycle 1:1 but with the vocabulary the collection/
  // recycler workflow spec asks for). This is intentionally a
  // SEPARATE transition table from statusTransitions above — the
  // CollectionRequest is a distinct record, kept in sync by the
  // engine (see decisionEngine.mjs syncCollectionRequest), not a
  // second independent state machine someone has to keep consistent
  // by hand.
  // ============================================================
  collectionRequestTransitions: {
    REQUESTED: ["ASSIGNED"],
    ASSIGNED: ["SCHEDULED", "COLLECTED"], // COLLECTED allowed directly: old clients could scan
    SCHEDULED: ["COLLECTED"],
    COLLECTED: ["VERIFIED"],
    VERIFIED: ["SENT_TO_RECYCLER"],
    SENT_TO_RECYCLER: ["RECYCLED"],
    RECYCLED: [],
  },

  // Deterministic matching-engine weights (higher = more important).
  // Order of elimination is: eligibility -> category -> service area ->
  // capacity -> distance -> workload (see matchingEngine.mjs). These
  // weights only affect the score used to rank collectors that already
  // survived every eligibility filter.
  matching: {
    serviceAreaMatchBonus: 30,
    distanceWeight: -1, // score -= distance_km * |distanceWeight|; no GPS -> 0 contribution
    workloadWeight: -20, // score -= (assignedCount / capacity) * 20 -> prefers least-loaded
    maxDistanceKm: 100, // collectors farther than this (when GPS is known) are filtered out entirely
  },

  // ============================================================
  // SYSTEM 3 — Government alert thresholds. All in hours; how long a
  // request may sit in a given phase before it's flagged as delayed.
  // ============================================================
  government: {
    unassignedRequestHours: 24, // REQUESTED with no eligible collector for this long
    delayedCollectionHours: 48, // ASSIGNED/SCHEDULED but not yet COLLECTED
    delayedRecyclingHours: 72, // VERIFIED/SENT_TO_RECYCLER but not yet RECYCLED
    overloadedCapacityRatio: 0.9, // matches CENTRE_CAPACITY_CHANGED's threshold above
  },

  // ============================================================
  // SYSTEM 4 — Environmental Impact Engine config. ONE place per
  // category for the estimated CO2 avoided (kg) and material
  // recovered (kg) when a unit of that category is recycled — see
  // smartAutomation/environmentalImpact.mjs, the only module allowed
  // to read this. These are widely-used sector-average estimates
  // (based on published e-waste recycling studies), not device-level
  // lab measurements — always surfaced to the user as "estimated".
  // `perKgMultiplier` lets a real verified weight (if ever captured)
  // scale the estimate instead of using the flat per-unit figure.
  // `default` is used for any category not listed below.
  // ============================================================
  environmentalImpact: {
    factors: {
      "Computing Device": { co2SavedKg: 120, materialRecoveredKg: 4.5, hazardous: false },
      Laptop: { co2SavedKg: 120, materialRecoveredKg: 4.5, hazardous: false },
      Smartphone: { co2SavedKg: 55, materialRecoveredKg: 0.15, hazardous: false },
      "Consumer Electronics": { co2SavedKg: 80, materialRecoveredKg: 3, hazardous: false },
      "Small Household Appliance": { co2SavedKg: 45, materialRecoveredKg: 5, hazardous: false },
      "Large Household Appliance": { co2SavedKg: 200, materialRecoveredKg: 25, hazardous: false },
      "Battery / Power": { co2SavedKg: 15, materialRecoveredKg: 0.3, hazardous: true },
      Monitor: { co2SavedKg: 90, materialRecoveredKg: 6, hazardous: true },
      default: { co2SavedKg: 30, materialRecoveredKg: 2, hazardous: false },
    },
    perKgMultiplier: 1, // if a verified weightKg is supplied, factors scale per kg instead of per unit
  },

  // ============================================================
  // SYSTEM 4 — Anomaly / fraud-detection thresholds.
  // ============================================================
  fraud: {
    repeatedScanWindowMinutes: 10, // flag if this many QR scans happen on the same item within this window
    repeatedScanThreshold: 3,
  },

  // ============================================================
  // SYSTEM 5 — EPR (Extended Producer Responsibility) Marketplace.
  // India's E-Waste (Management) Rules, 2022 mandate that electronics
  // producers meet annual recycling weight targets per category. Our
  // platform auto-generates EPR certificates when items complete
  // verified recycling, and producers purchase those certificates to
  // fulfil their CPCB obligations. These pricing tiers and weight
  // defaults are calibrated to Indian CPCB category schedules.
  // ============================================================
  epr: {
    // INR per kg of verified recycled weight, by e-waste category.
    // Hazardous categories (Battery, Monitor) carry a handling premium.
    pricePerKg: {
      "Battery / Power": 55,
      "Monitor": 40,
      "Computing Device": 30,
      "Laptop": 30,
      "Smartphone": 35,
      "Consumer Electronics": 25,
      "Small Household Appliance": 20,
      "Large Household Appliance": 15,
      default: 25,
    },
    // Assumed weight (kg) when no verified weight was captured at the
    // facility. Based on typical device weights for each category.
    defaultWeightKg: {
      "Smartphone": 0.18,
      "Laptop": 2.0,
      "Computing Device": 7.0,
      "Monitor": 5.0,
      "Consumer Electronics": 2.5,
      "Small Household Appliance": 4.0,
      "Large Household Appliance": 20.0,
      "Battery / Power": 0.5,
      default: 2.0,
    },
    // Flag an obligation as "approaching deadline" this many days before expiry
    nearDeadlineDays: 60,
  },
};
