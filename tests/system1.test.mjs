// System 1 — Automated Collection & Recycler System — engine-level tests.
//
// NOTE ON APPROACH: this sandbox has no network access, so `npm install`
// cannot fetch express/qrcode/multer/etc. and the real HTTP server
// (server.js) cannot be booted here. decisionEngine.mjs and
// matchingEngine.mjs only depend on Node built-ins (fs, path, crypto,
// url) though, so these tests call processEvent() directly — the exact
// same function server.js's routes call — which still exercises 100%
// of the real business logic (matching, transitions, duplicate
// prevention, credit awarding, request/item sync). Only the HTTP layer
// itself is untested here; run `npm install && npm start` plus the
// manual flow in README.md to exercise that layer once dependencies
// can be installed.
//
// Run with: node --test tests/system1.test.mjs
//
// If running this alongside other test files in the same command
// (e.g. `node --test tests/`), pass --test-concurrency=1 — all test
// files here read/write the same on-disk data/*.json files, and
// Node runs separate test files in parallel by default, which causes
// cross-file races on that shared state. Each file's OWN tests are
// safe to run concurrently with each other (beforeEach fully resets
// the files before every test); it's only multiple FILES at once
// that need --test-concurrency=1.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const FIXTURE_COLLECTORS = () => ([
  { id: "COL-01", name: "Green Recyclers, Zone A", type: "RECYCLER", address: "Zone A", latitude: null, longitude: null, serviceArea: ["Zone A"], capacity: 2, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
  { id: "COL-02", name: "EcoCollect, Zone B", type: "COLLECTION_CENTRE", address: "Zone B", latitude: null, longitude: null, serviceArea: ["Zone B"], capacity: 2, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
  { id: "COL-03", name: "Unverified Centre", type: "COLLECTION_CENTRE", address: "Zone A", latitude: null, longitude: null, serviceArea: ["Zone A"], capacity: 10, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "PENDING", acceptedCategories: [], contact: {} },
  { id: "COL-04", name: "Inactive Centre", type: "COLLECTION_CENTRE", address: "Zone A", latitude: null, longitude: null, serviceArea: ["Zone A"], capacity: 10, assignedCount: 0, operatingStatus: "INACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
]);

function resetData(collectors = FIXTURE_COLLECTORS()) {
  fs.writeFileSync(path.join(DATA_DIR, "items.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectionRequests.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "wallets.json"), "{}");
  fs.writeFileSync(path.join(DATA_DIR, "alerts.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "statusHistory.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "transactions.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(collectors, null, 2));
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

// decisionEngine.mjs resolves its own paths relative to its own file
// location (not cwd), so we can import it directly regardless of where
// `node --test` is invoked from.
const { processEvent } = await import("../smartAutomation/decisionEngine.mjs");
const { EVENT_TYPES } = await import("../smartAutomation/eventTypes.mjs");
const { findBestCollector } = await import("../smartAutomation/matchingEngine.mjs");

async function registerItem(owner = "testuser", category = null) {
  const result = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner, category } });
  assert.equal(result.success, true);
  return result.item;
}

async function requestCollection(itemId, data = {}) {
  return processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId, data });
}

beforeEach(() => resetData());

test("1. collection request creation succeeds and creates a CollectionRequest record", async () => {
  const item = await registerItem("alice");
  const result = await requestCollection(item.id, { pickupAddress: "12 Main St", serviceArea: "Zone A" });
  assert.equal(result.success, true);
  assert.equal(result.newStatus, "BOOKED");
  assert.equal(result.request.status, "ASSIGNED");
  assert.equal(result.request.itemId, item.id);
  assert.ok(result.request.assignedCollector);

  const stored = loadJson("collectionRequests.json");
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, result.request.id);
});

test("2. duplicate active collection request is rejected", async () => {
  const item = await registerItem("bob");
  await requestCollection(item.id);
  const result2 = await requestCollection(item.id);
  assert.equal(result2.success, false);
  assert.equal(result2.exception, "DUPLICATE_ACTIVE_REQUEST");
});

test("3. recycler eligibility: unverified and inactive centres are never matched", async () => {
  // Fill COL-01 and COL-02 to capacity (2 each) so only COL-03 (unverified)
  // and COL-04 (inactive) have room — matching must still fail.
  for (let i = 0; i < 4; i++) {
    const it = await registerItem(`filler${i}`);
    await requestCollection(it.id);
  }
  const item = await registerItem("carol");
  const result = await requestCollection(item.id);
  assert.equal(result.success, false);
  assert.equal(result.exception, "NO_COLLECTOR_AVAILABLE");
  assert.equal(result.request.status, "REQUESTED"); // stays pending, not silently dropped

  const alerts = loadJson("alerts.json");
  assert.ok(alerts.some((a) => a.type === "NO_ELIGIBLE_COLLECTOR"));
});

test("4. automatic matching assigns an eligible collector deterministically (least-loaded)", async () => {
  const item = await registerItem("dave");
  const result = await requestCollection(item.id);
  assert.ok(["COL-01", "COL-02"].includes(result.request.assignedCollector));

  // Second request should go to the OTHER collector (both start equally
  // loaded, so after one assignment the least-loaded one differs).
  const item2 = await registerItem("dave2");
  const result2 = await requestCollection(item2.id);
  assert.notEqual(result2.request.assignedCollector, result.request.assignedCollector);
});

test("5. capacity handling: collector cannot exceed capacity", async () => {
  resetData([{ ...FIXTURE_COLLECTORS()[0], capacity: 1 }, { ...FIXTURE_COLLECTORS()[1], capacity: 1 }]);
  const a = await registerItem("owner-a");
  const b = await registerItem("owner-b");
  const c = await registerItem("owner-c");
  await requestCollection(a.id);
  await requestCollection(b.id);
  const result3 = await requestCollection(c.id);
  assert.equal(result3.success, false);
  assert.equal(result3.exception, "NO_COLLECTOR_AVAILABLE"); // both collectors now at capacity 1/1
});

test("6. invalid status transitions are rejected (cannot skip stages)", async () => {
  const item = await registerItem("erin");
  const result = await processEvent({
    type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, data: { outcome: "Recycled" },
  });
  assert.equal(result.success, false);
  assert.equal(result.exception, "INVALID_STATUS_TRANSITION");
});

test("7. complete collection workflow end-to-end, including request<->item sync", async () => {
  const item = await registerItem("frank");
  const created = await requestCollection(item.id);
  assert.equal(created.request.status, "ASSIGNED");
  const collectorId = created.request.assignedCollector;
  const requestId = created.request.id;

  const sched = await processEvent({
    type: EVENT_TYPES.COLLECTION_SCHEDULED, data: { requestId, pickupTime: "2026-09-01T10:00:00Z" },
  });
  assert.equal(sched.success, true);
  assert.equal(sched.newStatus, "SCHEDULED");

  const scan = await processEvent({ type: EVENT_TYPES.QR_SCANNED, actorId: collectorId, data: { token: item.qrToken } });
  assert.equal(scan.success, true);
  assert.equal(scan.canConfirm, true);

  const confirm = await processEvent({ type: EVENT_TYPES.COLLECTION_CONFIRMED, actorId: collectorId, data: { token: item.qrToken } });
  assert.equal(confirm.success, true);
  assert.equal(confirm.newStatus, "COLLECTED");

  let reqNow = loadJson("collectionRequests.json").find((r) => r.id === requestId);
  assert.equal(reqNow.status, "COLLECTED");

  const received = await processEvent({ type: EVENT_TYPES.ITEM_RECEIVED, itemId: item.id, actorId: collectorId });
  assert.equal(received.success, true);

  const verified = await processEvent({ type: EVENT_TYPES.ITEM_VERIFIED, itemId: item.id, actorId: collectorId });
  assert.equal(verified.success, true);

  reqNow = loadJson("collectionRequests.json").find((r) => r.id === requestId);
  assert.equal(reqNow.status, "VERIFIED");

  const sorted = await processEvent({ type: EVENT_TYPES.ITEM_SORTED, itemId: item.id, actorId: collectorId });
  assert.equal(sorted.success, true);

  const processing = await processEvent({ type: EVENT_TYPES.PROCESSING_STARTED, itemId: item.id, actorId: collectorId });
  assert.equal(processing.success, true);

  reqNow = loadJson("collectionRequests.json").find((r) => r.id === requestId);
  assert.equal(reqNow.status, "SENT_TO_RECYCLER");

  const recycled = await processEvent({
    type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Recycled" },
  });
  assert.equal(recycled.success, true);
  assert.equal(recycled.creditsAwarded, 20);

  reqNow = loadJson("collectionRequests.json").find((r) => r.id === requestId);
  assert.equal(reqNow.status, "RECYCLED");

  const wallets = loadJson("wallets.json");
  assert.equal(wallets.frank.balance, 20);

  // history/audit table has one entry per transition (spec requirement:
  // "every transition recorded in a history/audit table")
  const history = loadJson("statusHistory.json").filter((h) => h.requestId === requestId);
  const seenTransitions = history.map((h) => h.newStatus);
  for (const expected of ["REQUESTED", "ASSIGNED", "SCHEDULED", "COLLECTED", "VERIFIED", "SENT_TO_RECYCLER", "RECYCLED"]) {
    assert.ok(seenTransitions.includes(expected), `missing ${expected} in audit trail: ${seenTransitions}`);
  }
});

test("category compatibility: collector that doesn't accept the item's category is skipped", async () => {
  resetData([
    { ...FIXTURE_COLLECTORS()[0], acceptedCategories: ["Battery / Power"] },
    { ...FIXTURE_COLLECTORS()[1], acceptedCategories: ["Screens / Displays"] },
  ]);
  const item = await registerItem("greg", "Battery / Power");
  const result = await requestCollection(item.id);
  assert.equal(result.success, true);
  assert.equal(result.request.assignedCollector, "COL-01");
});

test("service area filter excludes out-of-area collectors", async () => {
  const item = await registerItem("hank");
  const result = await requestCollection(item.id, { serviceArea: "Zone B" });
  assert.equal(result.success, true);
  assert.equal(result.request.assignedCollector, "COL-02");
});

test("matchingEngine.findBestCollector reports rejection reasons (no silent failure)", () => {
  const collectors = [
    { id: "X", operatingStatus: "INACTIVE", verificationStatus: "VERIFIED", capacity: 5, assignedCount: 0 },
    { id: "Y", operatingStatus: "ACTIVE", verificationStatus: "PENDING", capacity: 5, assignedCount: 0 },
  ];
  const { best, rejected } = findBestCollector({ category: null }, {}, collectors);
  assert.equal(best, null);
  assert.equal(rejected.length, 2);
  assert.match(rejected[0].reason, /not active|not verified/);
});

test("centre capacity update raises an overload alert near capacity, not duplicated", async () => {
  resetData([{ ...FIXTURE_COLLECTORS()[0], capacity: 10, assignedCount: 9 }, FIXTURE_COLLECTORS()[1]]);
  const first = await processEvent({ type: EVENT_TYPES.CENTRE_CAPACITY_CHANGED, data: { collectorId: "COL-01" } });
  assert.ok(first.alerts.some((a) => a.type === "COLLECTOR_OVERLOADED"));

  const second = await processEvent({ type: EVENT_TYPES.CENTRE_CAPACITY_CHANGED, data: { collectorId: "COL-01" } });
  assert.equal(second.alerts.length, 0); // already-open alert is not duplicated
});

test("existing behavior is unchanged: AI confidence gating still works", async () => {
  const high = await processEvent({ type: EVENT_TYPES.AI_IDENTIFIED, data: { confidence: 0.95 } });
  assert.equal(high.decision, "AUTO_ACCEPTED");
  const low = await processEvent({ type: EVENT_TYPES.AI_IDENTIFIED, data: { confidence: 0.2 } });
  assert.equal(low.decision, "MANUAL_CORRECTION_REQUIRED");
});
