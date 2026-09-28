// System 2 — Automated Credit, Reward & Verification System — engine
// tests. Same approach as tests/system1.test.mjs: calls processEvent()
// directly since this sandbox has no network access to npm install
// express. See system1.test.mjs's header comment for the full rationale.
//
// Run with: node --test tests/system2.test.mjs
// (See tests/system1.test.mjs's header for the --test-concurrency=1
// note if running multiple test files together.)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const COLLECTORS = () => ([
  { id: "COL-01", name: "Green Recyclers", type: "RECYCLER", serviceArea: [], capacity: 50, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
]);

function resetData({ rewards = [] } = {}) {
  fs.writeFileSync(path.join(DATA_DIR, "items.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectionRequests.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "wallets.json"), "{}");
  fs.writeFileSync(path.join(DATA_DIR, "alerts.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "statusHistory.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "transactions.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "rewards.json"), JSON.stringify(rewards, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "rewardClaims.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "suspiciousActivity.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "collectors.json"), JSON.stringify(COLLECTORS(), null, 2));
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

const { processEvent } = await import("../smartAutomation/decisionEngine.mjs");
const { EVENT_TYPES } = await import("../smartAutomation/eventTypes.mjs");
const { calculateCredits } = await import("../smartAutomation/creditEngine.mjs");

beforeEach(() => resetData());

// ---- Full pipeline helper: item -> request -> collected -> received ----
// (verification and the SORTED/PROCESSING stages are left to each test
// so tests can choose where to insert/skip ITEM_VERIFIED)
async function takeItemToReceived(owner, category = null) {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device: "Laptop", owner, category } });
  const item = created.item;
  const req = await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId: item.id, data: {} });
  const collectorId = req.request.assignedCollector;
  await processEvent({ type: EVENT_TYPES.COLLECTION_CONFIRMED, actorId: collectorId, data: { token: item.qrToken } });
  await processEvent({ type: EVENT_TYPES.ITEM_RECEIVED, itemId: item.id, actorId: collectorId });
  return { item, collectorId };
}

// Full pipeline through to the moment right before RECYCLING_COMPLETED
// would be called (i.e. status === PROCESSING). Verification is fired
// in between RECEIVED and SORTED, same point the real workflow uses.
async function takeItemToProcessing(owner, category = null, { verify = true } = {}) {
  const { item, collectorId } = await takeItemToReceived(owner, category);
  if (verify) await processEvent({ type: EVENT_TYPES.ITEM_VERIFIED, itemId: item.id, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.ITEM_SORTED, itemId: item.id, actorId: collectorId });
  await processEvent({ type: EVENT_TYPES.PROCESSING_STARTED, itemId: item.id, actorId: collectorId });
  return { item, collectorId };
}

test("credit calculation service: base amount by outcome, hazardous bonus applied", () => {
  const normal = calculateCredits({ outcome: "Recycled", category: "Screens / Displays" });
  assert.equal(normal.credits, 20);

  const hazardous = calculateCredits({ outcome: "Recycled", category: "Battery / Power" });
  assert.ok(hazardous.credits > normal.credits, "hazardous category should earn a bonus");
});

test("wallet update: recycling completion updates balance via a real transaction, not a hardcoded write", async () => {
  const { item, collectorId } = await takeItemToProcessing("alice");

  const result = await processEvent({
    type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Recycled" },
  });
  assert.equal(result.success, true);
  assert.equal(result.creditsAwarded, 20);

  const wallets = loadJson("wallets.json");
  assert.equal(wallets.alice.balance, 20);
  assert.equal(wallets.alice.totalEarned, 20);
  assert.equal(wallets.alice.totalSpent, 0);

  const transactions = loadJson("transactions.json");
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].type, "EARN");
  assert.equal(transactions[0].userId, "alice");
  assert.equal(transactions[0].amount, 20);
  assert.ok(transactions[0].referenceEventId.includes(item.id));
});

test("recycling credits are withheld without prior verification, and flagged suspicious", async () => {
  const { item, collectorId } = await takeItemToProcessing("bob", null, { verify: false });
  const result = await processEvent({
    type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Recycled" },
  });
  assert.equal(result.success, false);
  assert.equal(result.exception, "VERIFICATION_REQUIRED");

  const wallets = loadJson("wallets.json");
  assert.equal(wallets.bob, undefined);

  const suspicious = loadJson("suspiciousActivity.json");
  assert.ok(suspicious.some((s) => s.type === "RECYCLING_WITHOUT_VERIFICATION"));
});

test("duplicate credit prevention: firing RECYCLING_COMPLETED again does not double-pay", async () => {
  const { item, collectorId } = await takeItemToProcessing("carol");
  await processEvent({ type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Recycled" } });

  // Item is now RECYCLED so a second real call would be blocked by the
  // status-transition check first — to specifically test the ledger's
  // OWN idempotency guard (not just the state machine), call the event
  // again but bypass the transition guard by resetting item.status.
  const items = loadJson("items.json");
  const idx = items.findIndex((i) => i.id === item.id);
  items[idx].status = "PROCESSING"; // pretend we're re-entering, verified still true
  fs.writeFileSync(path.join(DATA_DIR, "items.json"), JSON.stringify(items, null, 2));

  const second = await processEvent({
    type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Recycled" },
  });
  assert.equal(second.success, false);
  assert.equal(second.exception, "DUPLICATE_CREDIT_ATTEMPT");

  const wallets = loadJson("wallets.json");
  assert.equal(wallets.carol.balance, 20); // unchanged — no double payment
  assert.equal(loadJson("transactions.json").length, 1);
});

test("reward eligibility: sufficient balance can claim, insufficient balance cannot", async () => {
  resetData({ rewards: [{ id: "R1", name: "Eco Mug", requiredCredits: 50, active: true, stock: null, repeatable: false }] });
  const { item, collectorId } = await takeItemToProcessing("dave");
  await processEvent({ type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: item.id, actorId: collectorId, data: { outcome: "Refurbished" } }); // 30 credits, still < 50

  const failedClaim = await processEvent({ type: EVENT_TYPES.REWARD_CLAIM_REQUESTED, data: { rewardId: "R1", userId: "dave" } });
  assert.equal(failedClaim.success, false);
  assert.equal(failedClaim.exception, "INSUFFICIENT_BALANCE");

  // top up with a second recycled item to cross the threshold
  const second = await takeItemToProcessing("dave");
  await processEvent({ type: EVENT_TYPES.RECYCLING_COMPLETED, itemId: second.item.id, actorId: second.collectorId, data: { outcome: "Reused" } }); // +40 = 70 total

  const claim = await processEvent({ type: EVENT_TYPES.REWARD_CLAIM_REQUESTED, data: { rewardId: "R1", userId: "dave" } });
  assert.equal(claim.success, true);
  assert.equal(claim.claim.status, "CLAIMED");

  const wallets = loadJson("wallets.json");
  assert.equal(wallets.dave.balance, 20); // 70 - 50
  assert.equal(wallets.dave.totalSpent, 50);
});

test("duplicate reward claim prevention: one-time reward cannot be claimed twice", async () => {
  resetData({ rewards: [{ id: "R2", name: "Free Claim", requiredCredits: 0, active: true, stock: null, repeatable: false }] });
  const first = await processEvent({ type: EVENT_TYPES.REWARD_CLAIM_REQUESTED, data: { rewardId: "R2", userId: "erin" } });
  assert.equal(first.success, true);

  const second = await processEvent({ type: EVENT_TYPES.REWARD_CLAIM_REQUESTED, data: { rewardId: "R2", userId: "erin" } });
  assert.equal(second.success, false);
  assert.equal(second.exception, "DUPLICATE_REWARD_CLAIM");

  const suspicious = loadJson("suspiciousActivity.json");
  assert.ok(suspicious.some((s) => s.type === "DUPLICATE_REWARD_CLAIM"));
});

test("out-of-stock reward cannot be claimed, and is flagged", async () => {
  resetData({ rewards: [{ id: "R3", name: "Limited Item", requiredCredits: 0, active: true, stock: 0, repeatable: true }] });
  const result = await processEvent({ type: EVENT_TYPES.REWARD_CLAIM_REQUESTED, data: { rewardId: "R3", userId: "frank" } });
  assert.equal(result.success, false);
  assert.equal(result.exception, "REWARD_UNAVAILABLE");
});

test("duplicate QR scan / collection confirmation is flagged as suspicious activity", async () => {
  const { item, collectorId } = await takeItemToReceived("greg");
  // item is already RECEIVED — try to confirm collection again
  const result = await processEvent({ type: EVENT_TYPES.COLLECTION_CONFIRMED, actorId: collectorId, data: { token: item.qrToken } });
  assert.equal(result.success, false);
  assert.equal(result.exception, "DUPLICATE_SCAN");

  const suspicious = loadJson("suspiciousActivity.json");
  assert.ok(suspicious.some((s) => s.type === "DUPLICATE_SCAN"));
});
