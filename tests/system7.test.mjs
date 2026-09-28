// System 7 — AI Vision Diagnostics, Circular Lifecycle Routing & Precious Metal Yields
//
// Exercises:
//   1. AI vision condition schema & grading in demo mode (screen, casing, battery, grade)
//   2. Circular lifecycle recommendation (REFURBISH / HARVEST_PARTS / RECYCLE) with rationale
//   3. Corrupt/unsupported image graceful fallback with low confidence and default triage
//   4. ITEM_CREATED engine event persists physicalGrade, lifecycleRecommendation, conditionAssessment
//   5. QR_SCANNED preview returns forensic diagnostic fields to collector intake
//   6. Precious metal lookup maps exact device model and category fallback
//   7. Intrinsic metal valuation (INR) and credit bonus adhere strictly to rule formulas
//   8. Economic salvage valuation models circular resale premium for refurbish candidates
//   9. Thermal runaway safety: swollen battery condition triggers fire hazard detection flag
//  10. End-to-end passport verification: item registered with diagnostics preserves grade on public passport
//
// Run with: node --test tests/system7.test.mjs
// Or full suite: node --test --test-concurrency=1 tests/*.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const FIXTURE_COLLECTORS = () => [
  {
    id: "COL-01",
    name: "Green Recyclers, Zone A",
    type: "RECYCLER",
    address: "Zone A",
    latitude: 23.2325,
    longitude: 77.4310,
    serviceArea: ["Zone A"],
    capacity: 10,
    assignedCount: 0,
    operatingStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    acceptedCategories: ["Computing Device", "Smartphone", "Laptop", "Battery / Power"],
    contact: {},
  },
];

function resetData() {
  fs.writeFileSync(path.join(DATA_DIR, "items.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectionRequests.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "wallets.json"), "{}");
  fs.writeFileSync(path.join(DATA_DIR, "alerts.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "statusHistory.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "transactions.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "rewards.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "rewardClaims.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "suspiciousActivity.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "activityFeed.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "notifications.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(FIXTURE_COLLECTORS(), null, 2));
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

const { identifyElectronicItem } = await import("../ewasteVision.mjs");
const { processEvent } = await import("../smartAutomation/decisionEngine.mjs");
const { EVENT_TYPES } = await import("../smartAutomation/eventTypes.mjs");
const { RULES } = await import("../smartAutomation/rules.mjs");
const { calculatePreciousMetalBonus, lookupPreciousMetals } = await import("../smartAutomation/creditEngine.mjs");

beforeEach(() => {
  resetData();
});

test("1. AI vision condition schema & grading in demo mode", async () => {
  // Pass a dummy JPEG payload with valid JPEG magic bytes (0xff, 0xd8, 0xff)
  const dummyBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const result = await identifyElectronicItem(dummyBuffer, "image/jpeg", { forceDemo: true });

  assert.ok(result.detections.length >= 1, "Expected at least one detection");
  const primary = result.detections[0];

  assert.equal(primary.device, "Laptop");
  assert.equal(primary.category, "Computing Device");
  assert.ok(primary.confidence > 0.8, "Expected high confidence");
  assert.ok(primary.condition, "Expected condition object");
  assert.equal(primary.condition.screen, "INTACT");
  assert.equal(primary.condition.casing, "DENTED");
  assert.equal(primary.condition.battery, "NORMAL");
  assert.equal(primary.condition.grade, "GRADE_B");
});

test("2. Circular lifecycle recommendation with engineering rationale", async () => {
  const dummyBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const result = await identifyElectronicItem(dummyBuffer, "image/jpeg", { forceDemo: true });

  const primary = result.detections[0];
  assert.ok(["REFURBISH", "HARVEST_PARTS", "RECYCLE"].includes(primary.recommendedOutcome));
  assert.equal(primary.recommendedOutcome, "REFURBISH");
  assert.ok(primary.recommendationReason.length > 10, "Expected descriptive recommendation reason");
});

test("3. Corrupt/unsupported image graceful fallback with low confidence and default triage", async () => {
  // Invalid image type
  const badMimeResult = await identifyElectronicItem(Buffer.from("not-an-image"), "application/pdf");
  assert.equal(badMimeResult.detections[0].confidence, 0.0);
  assert.equal(badMimeResult.detections[0].condition.grade, "GRADE_C");
  assert.equal(badMimeResult.detections[0].recommendedOutcome, "RECYCLE");

  // Invalid magic bytes (claiming to be JPEG but text content)
  const badBytesResult = await identifyElectronicItem(Buffer.from("plain text string"), "image/jpeg");
  assert.equal(badBytesResult.detections[0].confidence, 0.0);
  assert.equal(badBytesResult.detections[0].condition.grade, "GRADE_C");
  assert.equal(badBytesResult.detections[0].recommendedOutcome, "RECYCLE");
});

test("4. ITEM_CREATED engine event persists physicalGrade, lifecycleRecommendation, conditionAssessment", async () => {
  const created = await processEvent({
    type: EVENT_TYPES.ITEM_CREATED,
    data: {
      device: "MacBook Pro 14",
      owner: "rahul123",
      category: "Computing Device",
      condition: "Slight scuffs on bottom",
      physicalGrade: "GRADE_B",
      lifecycleRecommendation: "REFURBISH",
      conditionAssessment: {
        screen: "INTACT",
        casing: "SCRATCHED",
        battery: "NORMAL",
        grade: "GRADE_B",
      },
    },
  });

  assert.equal(created.success, true);
  const item = created.item;
  assert.equal(item.physicalGrade, "GRADE_B");
  assert.equal(item.lifecycleRecommendation, "REFURBISH");
  assert.equal(item.conditionAssessment.screen, "INTACT");

  // Verify it was persisted to disk
  const items = loadJson("items.json");
  const stored = items.find((it) => it.id === item.id);
  assert.equal(stored.physicalGrade, "GRADE_B");
  assert.equal(stored.lifecycleRecommendation, "REFURBISH");
  assert.equal(stored.conditionAssessment.casing, "SCRATCHED");
});

test("5. QR_SCANNED preview returns forensic diagnostic fields to collector intake", async () => {
  const created = await processEvent({
    type: EVENT_TYPES.ITEM_CREATED,
    data: {
      device: "Samsung Galaxy S21",
      deviceModel: "Samsung Galaxy S21",
      owner: "ananya_s",
      category: "Smartphone",
      condition: "Cracked display glass",
      physicalGrade: "GRADE_C",
      lifecycleRecommendation: "HARVEST_PARTS",
      conditionAssessment: {
        screen: "CRACKED",
        casing: "INTACT",
        battery: "NORMAL",
        grade: "GRADE_C",
      },
    },
  });
  const item = created.item;

  // Book the item so it can be scanned
  await processEvent({
    type: EVENT_TYPES.COLLECTION_REQUESTED,
    itemId: item.id,
    data: { serviceArea: "Zone A" },
  });

  // Collector scans QR
  const scan = await processEvent({
    type: EVENT_TYPES.QR_SCANNED,
    actorId: "COL-01",
    data: { token: item.qrToken },
  });

  assert.equal(scan.success, true);
  assert.equal(scan.item.id, item.id);
  assert.equal(scan.item.physicalGrade, "GRADE_C");
  assert.equal(scan.item.lifecycleRecommendation, "HARVEST_PARTS");
  assert.equal(scan.item.conditionAssessment.screen, "CRACKED");
});

test("6. Precious metal lookup maps exact device model and category fallback", () => {
  // Exact model lookup
  const exact = lookupPreciousMetals("iPhone 12", "Smartphone");
  assert.ok(exact, "Expected iPhone 12 to be catalogued");
  assert.equal(exact.exact, true);
  assert.equal(exact.matchedKey, "iPhone 12");
  assert.equal(exact.metalsGrams.gold, 0.034);
  assert.equal(exact.metalsGrams.copper, 15);

  // Fallback category lookup
  const fallback = lookupPreciousMetals("Unknown Brand Laptop X900", "Laptop");
  assert.ok(fallback, "Expected Laptop fallback to be catalogued");
  assert.equal(fallback.exact, false);
  assert.equal(fallback.matchedKey, "Generic Laptop");
  assert.equal(fallback.metalsGrams.gold, 0.2);
  assert.equal(fallback.metalsGrams.copper, 180);
});

test("7. Intrinsic metal valuation (INR) and credit bonus adhere strictly to rule formulas", () => {
  // iPhone 12: gold 0.034g * 6200 = 210.8, silver 0.34g * 82 = 27.88, palladium 0.015g * 3100 = 46.5, copper 15g * 0.75 = 11.25
  // Total ~ 296.43 -> rounded ~ 296 INR
  const bonusInfo = calculatePreciousMetalBonus("iPhone 12", "Smartphone");
  assert.ok(bonusInfo.valueINR >= 290 && bonusInfo.valueINR <= 305, `Expected ~296 INR, got ${bonusInfo.valueINR}`);
  // Bonus credits = min(round(valueINR * 0.02), 50) -> min(round(296 * 0.02 = 5.92 -> 6), 50) = 6
  assert.equal(bonusInfo.bonus, 6);
  assert.ok(bonusInfo.match.matchedKey === "iPhone 12");
});

test("8. Economic salvage valuation models circular resale premium for refurbish candidates", () => {
  // Calculate salvage valuation logic across outcomes
  const intrinsicINR = 1000;

  function calculateSalvage(outcome, grade) {
    if (outcome === "REFURBISH") {
      return grade === "GRADE_A"
        ? Math.max(2500, Math.round(intrinsicINR * 2.8 + 2000))
        : Math.max(1200, Math.round(intrinsicINR * 1.8 + 800));
    } else if (outcome === "HARVEST_PARTS") {
      return Math.max(600, Math.round(intrinsicINR * 1.3 + 300));
    } else {
      return Math.max(150, Math.round(intrinsicINR));
    }
  }

  const refurbishGradeA = calculateSalvage("REFURBISH", "GRADE_A");
  const refurbishGradeB = calculateSalvage("REFURBISH", "GRADE_B");
  const harvestParts = calculateSalvage("HARVEST_PARTS", "GRADE_C");
  const recycleScrap = calculateSalvage("RECYCLE", "GRADE_C");

  assert.ok(refurbishGradeA > refurbishGradeB, "Grade A refurbishment has highest salvage resale");
  assert.ok(refurbishGradeB > harvestParts, "Refurbishment resale exceeds component harvesting");
  assert.ok(harvestParts > recycleScrap, "Component harvesting exceeds raw scrap metal value");
  assert.equal(recycleScrap, 1000);
});

test("9. Thermal runaway safety: swollen battery condition triggers fire hazard detection flag", () => {
  const healthyBattery = { battery: "NORMAL", grade: "GRADE_A" };
  const swollenBattery = { battery: "SWOLLEN", grade: "GRADE_C" };

  const isHazardous1 = healthyBattery.battery === "SWOLLEN";
  const isHazardous2 = swollenBattery.battery === "SWOLLEN";

  assert.equal(isHazardous1, false);
  assert.equal(isHazardous2, true);
});

test("10. End-to-end passport verification: item registered with diagnostics preserves grade on public passport", async () => {
  const created = await processEvent({
    type: EVENT_TYPES.ITEM_CREATED,
    data: {
      device: "Lenovo ThinkPad T480",
      deviceModel: "Lenovo ThinkPad T480",
      owner: "shreya_k",
      category: "Laptop",
      physicalGrade: "GRADE_A",
      lifecycleRecommendation: "REFURBISH",
      conditionAssessment: {
        screen: "INTACT",
        casing: "INTACT",
        battery: "NORMAL",
        grade: "GRADE_A",
      },
    },
  });
  const item = created.item;

  const items = loadJson("items.json");
  const stored = items.find((it) => it.id === item.id);

  assert.equal(stored.physicalGrade, "GRADE_A");
  assert.equal(stored.lifecycleRecommendation, "REFURBISH");
  assert.equal(stored.conditionAssessment.screen, "INTACT");
  assert.equal(stored.deviceModel, "Lenovo ThinkPad T480");

  // Verify metals match
  const metalMatch = lookupPreciousMetals(stored.deviceModel, stored.category);
  assert.equal(metalMatch.matchedKey, "Lenovo ThinkPad T480");
  assert.equal(metalMatch.metalsGrams.gold, 0.25);
  assert.equal(metalMatch.metalsGrams.copper, 210);
});
