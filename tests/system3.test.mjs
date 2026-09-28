// System 3 — Government Command, Analytics & Integration System —
// engine-level tests. Same approach as system1/system2: exercises the
// real logic (governmentAnalytics.mjs + decisionEngine.mjs) directly,
// since this sandbox has no network access to npm install express and
// boot the actual HTTP server. See tests/system1.test.mjs's header for
// the full rationale — RBAC itself (the requireRole Express
// middleware) lives in server.js and is NOT covered by these tests for
// that reason; it's a thin, directly-readable check (see server.js's
// requireRole function) that this file can't reach without Express
// installed.
//
// Run with: node --test tests/system3.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const COLLECTORS = () => ([
  { id: "COL-01", name: "Green Recyclers", type: "RECYCLER", district: "Bhopal", state: "Madhya Pradesh", serviceArea: [], capacity: 2, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
  { id: "COL-02", name: "EcoCollect", type: "COLLECTION_CENTRE", district: "Indore", state: "Madhya Pradesh", serviceArea: [], capacity: 2, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
]);

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
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(COLLECTORS(), null, 2));
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

const { processEvent } = await import("../smartAutomation/decisionEngine.mjs");
const { EVENT_TYPES } = await import("../smartAutomation/eventTypes.mjs");
const { buildDashboard, buildPerformance, buildTrends, filterRequests, runComplianceScan } = await import("../smartAutomation/governmentAnalytics.mjs");

beforeEach(() => resetData());

async function registerAndRequest(owner, { district, state, category } = {}) {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner, category } });
  const item = created.item;
  const req = await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId: item.id, data: { district, state } });
  return { item, request: req.request, collectorId: req.request?.assignedCollector };
}

async function takeToRecycled(owner, opts = {}) {
  const { item, request, collectorId } = await registerAndRequest(owner, opts);
  await processEvent({ type: EVENT_TYPES.COLLECTION_CONFIRMED, actorId: collectorId, data: { token: item.qrToken } });
  await processEvent({ type: EVENT_TYPES.ITEM_RECEIVED, itemId: item.id, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.ITEM_VERIFIED, itemId: item.id, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.ITEM_SORTED, itemId: item.id, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.PROCESSING_STARTED, itemId: item.id, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Recycled" } });
  return { item, request };
}

test("dashboard totals are computed from real data, not hardcoded", async () => {
  await takeToRecycled("alice", { district: "Bhopal", state: "Madhya Pradesh" });
  await registerAndRequest("bob", { district: "Indore", state: "Madhya Pradesh" }); // stays REQUESTED/ASSIGNED

  const items = loadJson("items.json");
  const requests = loadJson("collectionRequests.json");
  const collectors = loadJson("collectors.json");
  const alerts = loadJson("alerts.json");
  const suspicious = loadJson("suspiciousActivity.json");

  const dashboard = buildDashboard({ items, requests, collectors, alerts, suspicious });
  assert.equal(dashboard.totals.totalItemsRegistered, 2);
  assert.equal(dashboard.totals.totalCollectionRequests, 2);
  assert.equal(dashboard.totals.totalRecycled, 1);
  assert.equal(dashboard.totals.totalCollected, 1); // only alice reached COLLECTED+
});

test("district/state filtering matches only requests tagged with that district/state", async () => {
  await registerAndRequest("alice", { district: "Bhopal", state: "Madhya Pradesh" });
  await registerAndRequest("bob", { district: "Indore", state: "Madhya Pradesh" });

  const requests = loadJson("collectionRequests.json");
  const bhopalOnly = filterRequests(requests, { district: "Bhopal" });
  assert.equal(bhopalOnly.length, 1);
  assert.equal(bhopalOnly[0].userId, "alice");
});

test("category filter uses the linked item's real category, not a stored copy", async () => {
  await registerAndRequest("alice", { category: "Battery / Power" });
  await registerAndRequest("bob", { category: "Screens / Displays" });

  const items = loadJson("items.json");
  const requests = loadJson("collectionRequests.json");
  const filtered = filterRequests(requests, { category: "Battery / Power", items });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].userId, "alice");
});

test("recycler/centre performance reflects real assignment + completion counts", async () => {
  await takeToRecycled("alice", { district: "Bhopal" }); // goes to whichever collector matching picks
  const requests = loadJson("collectionRequests.json");
  const collectors = loadJson("collectors.json");
  const statusHistory = loadJson("statusHistory.json");

  const performance = buildPerformance({ requests, collectors, statusHistory });
  const assignedCollectorId = requests[0].assignedCollector;
  const perf = performance.find((p) => p.collectorId === assignedCollectorId);
  assert.equal(perf.assignedRequests, 1);
  assert.equal(perf.completedCollections, 1);
  assert.equal(perf.recyclingCompletionRatePercent, 100);
  assert.ok(perf.avgProcessingHours !== null);
});

test("trends: category distribution and recycled-by-day are computed from real transitions", async () => {
  await takeToRecycled("alice", { category: "Battery / Power" });
  const items = loadJson("items.json");
  const requests = loadJson("collectionRequests.json");
  const trends = buildTrends({ requests, items });
  assert.equal(trends.categoryDistribution["Battery / Power"], 1);
  const totalRecycledEntries = Object.values(trends.recycledByDay).reduce((a, b) => a + b, 0);
  assert.equal(totalRecycledEntries, 1);
});

test("compliance scan flags overloaded centres, and does not duplicate the alert on a second scan", async () => {
  const collectors = COLLECTORS();
  collectors[0].assignedCount = 2; // 2/2 = 100% >= 90% threshold
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(collectors, null, 2));

  const first = runComplianceScan({ requests: [], collectors });
  assert.ok(first.some((a) => a.type === "COLLECTOR_OVERLOADED"));

  const second = runComplianceScan({ requests: [], collectors });
  assert.equal(second.length, 0); // already OPEN, not duplicated
});

test("compliance scan flags a delayed collection request past the threshold", async () => {
  const oldTimestamp = new Date(Date.now() - 100 * 3600000).toISOString(); // 100h ago
  const requests = [{
    id: "CR-TEST-1", itemId: "EW-TEST-1", status: "ASSIGNED", assignedCollector: "COL-01",
    history: [{ previousStatus: "REQUESTED", newStatus: "ASSIGNED", timestamp: oldTimestamp }],
  }];
  const alerts = runComplianceScan({ requests, collectors: COLLECTORS() });
  assert.ok(alerts.some((a) => a.type === "DELAYED_COLLECTION"));
});

test("compliance scan flags a request unassigned too long", async () => {
  const oldTimestamp = new Date(Date.now() - 48 * 3600000).toISOString();
  const requests = [{
    id: "CR-TEST-2", itemId: "EW-TEST-2", status: "REQUESTED", assignedCollector: null,
    history: [{ previousStatus: null, newStatus: "REQUESTED", timestamp: oldTimestamp }],
  }];
  const alerts = runComplianceScan({ requests, collectors: COLLECTORS() });
  assert.ok(alerts.some((a) => a.type === "REQUEST_UNASSIGNED_TOO_LONG"));
});

test("compliance scan flags an inactive collector that still has active assignments", async () => {
  const collectors = COLLECTORS();
  collectors[0].operatingStatus = "INACTIVE";
  collectors[0].assignedCount = 1;
  const alerts = runComplianceScan({ requests: [], collectors });
  assert.ok(alerts.some((a) => a.type === "INACTIVE_RECYCLER_ACTIVE"));
});
