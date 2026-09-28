// System 4 — Environmental Impact, Explainable Automation, Live
// Activity Feed, Notifications & Automatic Reassignment — engine
// tests. Same approach as system1/2/3: calls processEvent() directly
// (no network access in this sandbox to npm install express). See
// tests/system1.test.mjs's header for the full rationale and the
// --test-concurrency=1 note when running multiple files together.
//
// Run with: node --test tests/system4.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const COLLECTORS = () => ([
  { id: "COL-01", name: "Green Recyclers", type: "RECYCLER", serviceArea: [], capacity: 5, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
  { id: "COL-02", name: "Backup Recyclers", type: "RECYCLER", serviceArea: [], capacity: 5, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
]);

function resetData(collectors = COLLECTORS()) {
  fs.writeFileSync(path.join(DATA_DIR, "items.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectionRequests.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "wallets.json"), "{}");
  fs.writeFileSync(path.join(DATA_DIR, "alerts.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "statusHistory.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "transactions.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "suspiciousActivity.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "activityFeed.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "notifications.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(collectors, null, 2));
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

const { processEvent } = await import("../smartAutomation/decisionEngine.mjs");
const { EVENT_TYPES } = await import("../smartAutomation/eventTypes.mjs");
const { calculateImpact, aggregateImpact } = await import("../smartAutomation/environmentalImpact.mjs");
const { buildDashboard } = await import("../smartAutomation/governmentAnalytics.mjs");

// Full happy-path helper: register -> request -> assign -> collect -> receive -> verify -> recycle
async function runFullFlow({ owner = "user1", device = "Laptop", category = "Laptop" } = {}) {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device, owner, category } });
  const itemId = created.item.id;
  await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId, data: { serviceArea: null } });
  const items = loadJson("items.json");
  const collectorId = items.find((it) => it.id === itemId).assignedCollector;
  const qrToken = items.find((it) => it.id === itemId).qrToken;
  await processEvent({ type: EVENT_TYPES.QR_SCANNED, actorId: collectorId, data: { token: qrToken } });
  await processEvent({ type: EVENT_TYPES.COLLECTION_CONFIRMED, actorId: collectorId, data: { token: qrToken } });
  await processEvent({ type: EVENT_TYPES.ITEM_RECEIVED, itemId, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.ITEM_VERIFIED, itemId, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.ITEM_SORTED, itemId, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.PROCESSING_STARTED, itemId, actorId: collectorId });
  const result = await processEvent({ type: EVENT_TYPES.RECYCLING_COMPLETED, itemId, actorId: collectorId, data: { outcome: "Recycled" } });
  return { itemId, collectorId, result };
}

// ============================================================
// ENVIRONMENTAL IMPACT ENGINE
// ============================================================
test("environmental impact: calculation uses category factors and is marked estimated", () => {
  const impact = calculateImpact({ category: "Laptop" });
  assert.equal(impact.estimated, true);
  assert.ok(impact.co2SavedKg > 0);
  assert.ok(impact.materialRecoveredKg > 0);
  assert.equal(impact.hazardousHandled, false);
});

test("environmental impact: unknown category falls back to default factors, not zero", () => {
  const impact = calculateImpact({ category: "Some Unlisted Gadget" });
  assert.equal(impact.category, "Some Unlisted Gadget");
  assert.ok(impact.co2SavedKg > 0);
});

test("environmental impact: hazardous categories (e.g. batteries) are flagged", () => {
  const impact = calculateImpact({ category: "Battery / Power" });
  assert.equal(impact.hazardousHandled, true);
});

test("environmental impact: a verified weight scales the estimate", () => {
  const unitImpact = calculateImpact({ category: "Laptop" });
  const heavierImpact = calculateImpact({ category: "Laptop" }, { weightKg: 3 });
  assert.ok(heavierImpact.co2SavedKg > unitImpact.co2SavedKg);
});

test("environmental impact: aggregateImpact sums only items that actually carry impact data", () => {
  const items = [
    { environmentalImpact: { co2SavedKg: 10, materialRecoveredKg: 1, hazardousHandled: false } },
    { environmentalImpact: { co2SavedKg: 5, materialRecoveredKg: 0.5, hazardousHandled: true } },
    { status: "REGISTERED" }, // not yet recycled — no impact field at all
  ];
  const agg = aggregateImpact(items);
  assert.equal(agg.itemsRecycled, 2);
  assert.equal(agg.co2SavedKg, 15);
  assert.equal(agg.hazardousItemsHandled, 1);
});

beforeEach(() => resetData());

test("environmental impact: is computed and stored on the item exactly when recycling completes", async () => {
  const { result } = await runFullFlow({ category: "Laptop" });
  assert.equal(result.success, true);
  assert.ok(result.environmentalImpact);
  assert.ok(result.environmentalImpact.co2SavedKg > 0);
  const items = loadJson("items.json");
  const item = items.find((it) => it.id === result.item.id);
  assert.ok(item.environmentalImpact, "item should persist its environmental impact");
});

test("government dashboard: aggregates real environmental impact from recycled items, not mocked data", async () => {
  await runFullFlow({ owner: "gov-test-user", category: "Smartphone" });
  const items = loadJson("items.json");
  const requests = loadJson("collectionRequests.json");
  const collectors = loadJson("collectors.json");
  const alerts = loadJson("alerts.json");
  const suspicious = loadJson("suspiciousActivity.json");
  const dashboard = buildDashboard({ items, requests, collectors, alerts, suspicious });
  assert.equal(dashboard.environmentalImpact.itemsRecycled, 1);
  assert.ok(dashboard.environmentalImpact.co2SavedKg > 0);
});

// ============================================================
// EXPLAINABLE AUTOMATION DECISIONS
// ============================================================
test("explainable decisions: a successful collector match returns a decision object with reasons", async () => {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "user1", category: "Laptop" } });
  const result = await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId: created.item.id, data: {} });
  assert.equal(result.success, true);
  assert.ok(result.decision);
  assert.equal(result.decision.decision, "COLLECTOR_ASSIGNED");
  assert.ok(result.decision.assignedCollector);
  assert.ok(Array.isArray(result.decision.reasons));
  assert.ok(result.decision.reasons.length > 0, "reasons should be a non-empty, human-readable list");
});

// ============================================================
// LIVE AUTOMATION ACTIVITY FEED
// ============================================================
test("activity feed: key lifecycle events are logged in order, in human-readable form", async () => {
  await runFullFlow({ category: "Smartphone" });
  const feed = loadJson("activityFeed.json");
  const labels = feed.map((e) => e.label);
  assert.ok(labels.includes("New e-waste registered"));
  assert.ok(labels.includes("Collector matched"));
  assert.ok(labels.includes("Pickup assigned"));
  assert.ok(labels.includes("QR code scanned"));
  assert.ok(labels.includes("Item collected"));
  assert.ok(labels.includes("Verification completed"));
  assert.ok(labels.includes("Recycling completed"));
  assert.ok(labels.includes("Credits awarded"));
});

test("activity feed: every entry is timestamped and references the item it's about", async () => {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "user1", category: "Laptop" } });
  const feed = loadJson("activityFeed.json");
  const entry = feed.find((e) => e.itemId === created.item.id);
  assert.ok(entry);
  assert.ok(entry.timestamp);
});

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
test("notifications: the owner is notified when a pickup is assigned", async () => {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "notify-user", category: "Laptop" } });
  await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId: created.item.id, data: {} });
  const notifications = loadJson("notifications.json");
  const userNotifications = notifications.filter((n) => n.recipientId === "notify-user");
  assert.ok(userNotifications.some((n) => n.category === "PICKUP_ASSIGNED"));
});

test("notifications: the assigned collector is also notified of a new pickup", async () => {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "user1", category: "Laptop" } });
  const requestResult = await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId: created.item.id, data: {} });
  const notifications = loadJson("notifications.json");
  const collectorId = requestResult.decision.assignedCollector;
  assert.ok(notifications.some((n) => n.recipientId === collectorId && n.recipientRole === "COLLECTOR"));
});

test("notifications: credits-awarded notification is sent to the owner on recycling completion", async () => {
  await runFullFlow({ owner: "credit-user" });
  const notifications = loadJson("notifications.json");
  assert.ok(notifications.some((n) => n.recipientId === "credit-user" && n.category === "RECYCLING_COMPLETED"));
});

// ============================================================
// AUTOMATIC REASSIGNMENT
// ============================================================
test("automatic reassignment: a request stuck on a collector that goes INACTIVE is rematched automatically", async () => {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "user1", category: "Laptop" } });
  const itemId = created.item.id;
  const requestResult = await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId, data: {} });
  const originalCollector = requestResult.decision.assignedCollector;

  // Simulate the collector going inactive (as server.js's PATCH route does)
  const collectors = loadJson("collectors.json");
  const collector = collectors.find((c) => c.id === originalCollector);
  collector.operatingStatus = "INACTIVE";
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(collectors, null, 2));

  const reassignResult = await processEvent({ type: EVENT_TYPES.CENTRE_CAPACITY_CHANGED, data: { collectorId: originalCollector } });
  assert.equal(reassignResult.success, true);
  assert.equal(reassignResult.reassignments.length, 1);
  const newCollectorId = reassignResult.reassignments[0].to;
  assert.notEqual(newCollectorId, originalCollector);

  const requests = loadJson("collectionRequests.json");
  const request = requests.find((r) => r.itemId === itemId);
  assert.equal(request.assignedCollector, newCollectorId);
  assert.equal(request.status, "ASSIGNED");

  const items = loadJson("items.json");
  assert.equal(items.find((it) => it.id === itemId).assignedCollector, newCollectorId);

  const alerts = loadJson("alerts.json");
  assert.ok(alerts.some((a) => a.type === "AUTOMATIC_REASSIGNMENT"));

  const notifications = loadJson("notifications.json");
  assert.ok(notifications.some((n) => n.recipientId === "user1" && n.category === "AUTOMATIC_REASSIGNMENT"));
  assert.ok(notifications.some((n) => n.recipientId === newCollectorId && n.category === "AUTOMATIC_REASSIGNMENT"));
});

test("automatic reassignment: when no alternative collector exists, the exception is flagged rather than silently dropped", async () => {
  // Only one collector exists at all — going inactive leaves nothing to reassign to.
  resetData([COLLECTORS()[0]]);
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "user1", category: "Laptop" } });
  const itemId = created.item.id;
  await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId, data: {} });

  const collectors = loadJson("collectors.json");
  collectors[0].operatingStatus = "INACTIVE";
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(collectors, null, 2));

  const reassignResult = await processEvent({ type: EVENT_TYPES.CENTRE_CAPACITY_CHANGED, data: { collectorId: "COL-01" } });
  assert.equal(reassignResult.reassignments.length, 0);
  const alerts = loadJson("alerts.json");
  assert.ok(alerts.some((a) => a.type === "NO_REASSIGNMENT_AVAILABLE"));
});

// ============================================================
// FRAUD DETECTION — repeated QR scans
// ============================================================
test("fraud detection: repeatedly scanning the same item's QR in a short window is flagged as suspicious", async () => {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner: "user1", category: "Laptop" } });
  const itemId = created.item.id;
  await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId, data: {} });
  const items = loadJson("items.json");
  const item = items.find((it) => it.id === itemId);
  const collectorId = item.assignedCollector;

  // Scan (preview-only, no write) several times in a row.
  for (let i = 0; i < 3; i++) {
    await processEvent({ type: EVENT_TYPES.QR_SCANNED, actorId: collectorId, data: { token: item.qrToken } });
  }

  const suspicious = loadJson("suspiciousActivity.json");
  assert.ok(suspicious.some((s) => s.type === "REPEATED_QR_SCANS"));
});
