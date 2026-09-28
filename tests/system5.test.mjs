// System 5 — Brand EPR Marketplace Portal — engine & marketplace tests.
//
// Exercises the complete EPR loop:
//   1. Auto-generation of tradeable EPR certificates on verified recycling completion
//   2. Category pricing tiers & weight fallback resolution
//   3. Cryptographic SHA-256 tamper-evident verification hashing
//   4. Marketplace purchasing & double-purchase prevention
//   5. CPCB obligation fulfillment & compliance tracking
//   6. Activity feed & notification dispatches
//
// Run with: node --test tests/system5.test.mjs
// Or suite: node --test --test-concurrency=1 tests/*.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const FIXTURE_COLLECTORS = () => [
  { id: "COL-01", name: "Green Recyclers, Zone A", type: "RECYCLER", address: "Zone A", latitude: null, longitude: null, serviceArea: ["Zone A"], capacity: 10, assignedCount: 0, operatingStatus: "ACTIVE", verificationStatus: "VERIFIED", acceptedCategories: [], contact: {} },
];

const FIXTURE_PRODUCERS = () => [
  {
    id: "PROD-001",
    name: "TechVista India Pvt. Ltd.",
    gstin: "23AABCU9603R1ZM",
    cpcbRegistration: "CPCB/EPR/EE/2026/001",
    categories: ["Consumer Electronics", "Smartphone", "Laptop", "Battery / Power"],
    state: "Madhya Pradesh",
    contact: { name: "Rajesh Kumar", email: "epr@techvista.example" },
    registeredAt: "2026-01-15T00:00:00.000Z",
  },
];

const FIXTURE_OBLIGATIONS = () => [
  {
    id: "OBL-2026-001",
    producerId: "PROD-001",
    financialYear: "2026-27",
    category: "Laptop",
    targetWeightKg: 10,
    fulfilledWeightKg: 0,
    status: "ACTIVE",
    deadline: "2027-03-31T23:59:59.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "OBL-2026-002",
    producerId: "PROD-001",
    financialYear: "2026-27",
    category: "Smartphone",
    targetWeightKg: 5,
    fulfilledWeightKg: 0,
    status: "ACTIVE",
    deadline: "2027-03-31T23:59:59.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
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
  fs.writeFileSync(path.join(DATA_DIR, "producers.json"), JSON.stringify(FIXTURE_PRODUCERS(), null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "eprObligations.json"), JSON.stringify(FIXTURE_OBLIGATIONS(), null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "eprCertificates.json"), "[]");
  fs.writeFileSync(path.join(DATA_DIR, "eprTransactions.json"), "[]");
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

const { processEvent } = await import("../smartAutomation/decisionEngine.mjs");
const { EVENT_TYPES, ALERT_TYPES } = await import("../smartAutomation/eventTypes.mjs");
const { RULES } = await import("../smartAutomation/rules.mjs");
const {
  calculateCertificatePrice,
  computeVerificationHash,
  verifyCertificateHash,
  checkObligationCompliance,
  buildComplianceReport,
} = await import("../smartAutomation/eprEngine.mjs");

async function recycleItem({ owner = "citizen1", device = "Dell Laptop", category = "Laptop", weightKg = null }) {
  const created = await processEvent({ type: EVENT_TYPES.ITEM_CREATED, data: { device, owner, category } });
  const itemId = created.item.id;
  await processEvent({ type: EVENT_TYPES.COLLECTION_REQUESTED, itemId, data: { serviceArea: "Zone A" } });
  const items = loadJson("items.json");
  const item = items.find((it) => it.id === itemId);
  const colId = item.assignedCollector;
  await processEvent({ type: EVENT_TYPES.QR_SCANNED, actorId: colId, data: { token: item.qrToken } });
  await processEvent({ type: EVENT_TYPES.COLLECTION_CONFIRMED, actorId: colId, data: { token: item.qrToken } });
  await processEvent({ type: EVENT_TYPES.ITEM_RECEIVED, itemId, actorId: colId });
  await processEvent({ type: EVENT_TYPES.ITEM_VERIFIED, itemId, actorId: colId });
  await processEvent({ type: EVENT_TYPES.ITEM_SORTED, itemId, actorId: colId });
  await processEvent({ type: EVENT_TYPES.PROCESSING_STARTED, itemId, actorId: colId });
  const recycled = await processEvent({
    type: EVENT_TYPES.RECYCLING_COMPLETED,
    itemId,
    actorId: colId,
    data: { outcome: "Recycled", verification: weightKg ? { weightKg } : {} },
  });
  return { itemId, recycled };
}

beforeEach(() => {
  resetData();
});

test("1. EPR certificate is auto-generated when verified recycling completes", async () => {
  const { itemId, recycled } = await recycleItem({ weightKg: 2.5 });
  assert.equal(recycled.success, true);
  assert.ok(recycled.eprCertificate, "recycled result must include eprCertificate");
  assert.equal(recycled.eprCertificate.status, "AVAILABLE");
  assert.equal(recycled.eprCertificate.itemId, itemId);
  assert.equal(recycled.eprCertificate.weightKg, 2.5);
  assert.equal(recycled.eprCertificate.category, "Laptop");

  const certs = loadJson("eprCertificates.json");
  assert.equal(certs.length, 1);
  assert.equal(certs[0].id, recycled.eprCertificate.id);
  assert.equal(certs[0].status, "AVAILABLE");
});

test("2. Certificate pricing uses category-specific rates", async () => {
  // Laptop rate is 30/kg
  const { recycled: r1 } = await recycleItem({ category: "Laptop", weightKg: 3.0 });
  assert.equal(r1.eprCertificate.pricePerKgINR, 30);
  assert.equal(r1.eprCertificate.priceINR, 90);

  // Battery / Power carries hazardous premium: 55/kg
  const { recycled: r2 } = await recycleItem({ category: "Battery / Power", weightKg: 2.0 });
  assert.equal(r2.eprCertificate.pricePerKgINR, 55);
  assert.equal(r2.eprCertificate.priceINR, 110);
});

test("3. Default weight fallback is used when no verified weight is captured", async () => {
  // Laptop default weight in rules.mjs is 2.0 kg
  const { recycled } = await recycleItem({ category: "Laptop", weightKg: null });
  assert.equal(recycled.eprCertificate.weightKg, RULES.epr.defaultWeightKg["Laptop"]);
  assert.ok(recycled.eprCertificate.priceINR > 0);
});

test("4. Tamper-evident verification hash integrity", async () => {
  const { recycled } = await recycleItem({ weightKg: 1.5 });
  const cert = recycled.eprCertificate;
  assert.ok(cert.verificationHash.startsWith("sha256:"));

  // Verifying the hash passes
  const verification = verifyCertificateHash(cert);
  assert.equal(verification.valid, true);
  assert.equal(verification.expected, cert.verificationHash);

  // If a field is tampered with, verification fails
  const tamperedCert = { ...cert, weightKg: 999.0 };
  const tamperedVerification = verifyCertificateHash(tamperedCert);
  assert.equal(tamperedVerification.valid, false);
});

test("5. Certificate purchase happy path updates certificate, obligation, and records transaction", async () => {
  const { recycled } = await recycleItem({ category: "Laptop", weightKg: 4.0 });
  const certId = recycled.eprCertificate.id;

  const purchaseResult = await processEvent({
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    data: {
      certificateId: certId,
      producerId: "PROD-001",
    },
  });

  assert.equal(purchaseResult.success, true);
  assert.equal(purchaseResult.certificate.status, "SOLD");
  assert.equal(purchaseResult.certificate.purchasedBy, "PROD-001");
  assert.ok(purchaseResult.transaction);
  assert.equal(purchaseResult.transaction.amountINR, recycled.eprCertificate.priceINR);

  // Certificate on disk is updated
  const certs = loadJson("eprCertificates.json");
  const storedCert = certs.find((c) => c.id === certId);
  assert.equal(storedCert.status, "SOLD");
  assert.equal(storedCert.purchasedBy, "PROD-001");

  // Transaction recorded
  const txns = loadJson("eprTransactions.json");
  assert.equal(txns.length, 1);
  assert.equal(txns[0].certificateId, certId);
  assert.equal(txns[0].producerId, "PROD-001");

  // Linked Laptop obligation fulfilled weight incremented by 4.0 kg
  const obligations = loadJson("eprObligations.json");
  const obl = obligations.find((o) => o.id === "OBL-2026-001");
  assert.equal(obl.fulfilledWeightKg, 4.0);
});

test("6. Double-purchase prevention: already-sold certificate cannot be bought again", async () => {
  const { recycled } = await recycleItem({ category: "Laptop", weightKg: 2.0 });
  const certId = recycled.eprCertificate.id;

  // First purchase succeeds
  const p1 = await processEvent({
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    data: { certificateId: certId, producerId: "PROD-001" },
  });
  assert.equal(p1.success, true);

  // Second purchase fails with DUPLICATE_CERTIFICATE_PURCHASE
  const p2 = await processEvent({
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    data: { certificateId: certId, producerId: "PROD-001" },
  });
  assert.equal(p2.success, false);
  assert.equal(p2.exception, "DUPLICATE_CERTIFICATE_PURCHASE");
});

test("7. Purchasing non-existent certificate fails with EPR_CERTIFICATE_UNAVAILABLE", async () => {
  const res = await processEvent({
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    data: { certificateId: "EPR-CERT-9999-999999", producerId: "PROD-001" },
  });
  assert.equal(res.success, false);
  assert.equal(res.exception, "EPR_CERTIFICATE_UNAVAILABLE");
});

test("8. Obligation compliance calculation reflects purchased certificates", async () => {
  // Laptop target is 10 kg. Buy 2 certificates: 4 kg + 6 kg = 10 kg (100% compliant)
  const { recycled: r1 } = await recycleItem({ category: "Laptop", weightKg: 4.0 });
  const { recycled: r2 } = await recycleItem({ category: "Laptop", weightKg: 6.0 });

  await processEvent({ type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED, data: { certificateId: r1.eprCertificate.id, producerId: "PROD-001" } });
  await processEvent({ type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED, data: { certificateId: r2.eprCertificate.id, producerId: "PROD-001" } });

  const obligations = loadJson("eprObligations.json");
  const certificates = loadJson("eprCertificates.json");
  const comp = checkObligationCompliance(obligations, certificates, "PROD-001");

  const laptopComp = comp.categories.find((c) => c.category === "Laptop");
  assert.equal(laptopComp.targetKg, 10);
  assert.equal(laptopComp.fulfilledKg, 10);
  assert.equal(laptopComp.compliancePct, 100);
  assert.equal(laptopComp.status, "COMPLIANT");
});

test("9. Multiple categories are tracked independently", async () => {
  // Laptop obligation: 10kg, Smartphone obligation: 5kg
  const { recycled: rLaptop } = await recycleItem({ category: "Laptop", weightKg: 5.0 });
  const { recycled: rPhone } = await recycleItem({ category: "Smartphone", weightKg: 5.0 });

  await processEvent({ type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED, data: { certificateId: rLaptop.eprCertificate.id, producerId: "PROD-001" } });
  await processEvent({ type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED, data: { certificateId: rPhone.eprCertificate.id, producerId: "PROD-001" } });

  const obligations = loadJson("eprObligations.json");
  const certificates = loadJson("eprCertificates.json");
  const comp = checkObligationCompliance(obligations, certificates, "PROD-001");

  const laptop = comp.categories.find((c) => c.category === "Laptop");
  assert.equal(laptop.fulfilledKg, 5.0);
  assert.equal(laptop.compliancePct, 50);
  assert.equal(laptop.status, "AT_RISK");

  const phone = comp.categories.find((c) => c.category === "Smartphone");
  assert.equal(phone.fulfilledKg, 5.0);
  assert.equal(phone.compliancePct, 100);
  assert.equal(phone.status, "COMPLIANT");
});

test("10. Full CPCB compliance report generation", async () => {
  const { recycled } = await recycleItem({ category: "Laptop", weightKg: 5.0 });
  await processEvent({ type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED, data: { certificateId: recycled.eprCertificate.id, producerId: "PROD-001" } });

  const producers = loadJson("producers.json");
  const obligations = loadJson("eprObligations.json");
  const certificates = loadJson("eprCertificates.json");
  const transactions = loadJson("eprTransactions.json");

  const report = buildComplianceReport(producers[0], obligations, certificates, transactions);
  assert.equal(report.producer.id, "PROD-001");
  assert.equal(report.summary.totalCertificatesPurchased, 1);
  assert.equal(report.summary.totalWeightRecycledKg, 5.0);
  assert.ok(report.summary.totalSpendINR > 0);
  assert.ok(report.summary.totalCo2SavedKg > 0);
  assert.equal(report.transactions.length, 1);
});

test("11. Activity feed records EPR certificate generation and purchase", async () => {
  const { recycled } = await recycleItem({ category: "Laptop", weightKg: 2.0 });
  const certId = recycled.eprCertificate.id;

  await processEvent({
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    data: { certificateId: certId, producerId: "PROD-001" },
  });

  const feed = loadJson("activityFeed.json");
  const genEntry = feed.find((e) => e.label === "EPR certificate generated");
  assert.ok(genEntry, "feed must include EPR certificate generated entry");

  const buyEntry = feed.find((e) => e.label === "EPR certificate purchased");
  assert.ok(buyEntry, "feed must include EPR certificate purchased entry");
});

test("12. Notification delivery to Government on generation and Producer on purchase", async () => {
  const { recycled } = await recycleItem({ category: "Laptop", weightKg: 2.0 });
  const certId = recycled.eprCertificate.id;

  const notifs = loadJson("notifications.json");
  const govNotif = notifs.find((n) => n.recipientRole === "GOVERNMENT" && n.category === "EPR");
  assert.ok(govNotif, "government must receive notification of new EPR certificate");

  await processEvent({
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    data: { certificateId: certId, producerId: "PROD-001" },
  });

  const notifsAfter = loadJson("notifications.json");
  const prodNotif = notifsAfter.find((n) => n.recipientId === "PROD-001" && n.category === "EPR_PURCHASE");
  assert.ok(prodNotif, "producer must receive notification of certificate purchase");
});
