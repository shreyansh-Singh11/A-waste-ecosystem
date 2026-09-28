/*
  ============================================================
  KABADIWALA B2B REVERSE AUCTION ENGINE
  ============================================================
  Phase 2 of the e-waste tri-track system. Follows the same
  loadJson/saveJson/appendAudit pattern as municipalEngine.mjs.

  Lifecycle:  gradeDevice → calculateHarvestValue → createAuctionLot →
              placeBid (×N, 4-hour window) → closeAuction → settlePayment

  Data files: data/deviceGrades.json, data/auctionLots.json,
              data/auctionBids.json, data/auctionSettlements.json,
              data/auctionAuditLogs.json
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const GRADES_FILE = path.join(DATA_DIR, "deviceGrades.json");
const LOTS_FILE = path.join(DATA_DIR, "auctionLots.json");
const BIDS_FILE = path.join(DATA_DIR, "auctionBids.json");
const SETTLEMENTS_FILE = path.join(DATA_DIR, "auctionSettlements.json");
const AUDIT_FILE = path.join(DATA_DIR, "auctionAuditLogs.json");

// ------------------------------------------------------------
// Shared file helpers (same pattern as every other engine)
// ------------------------------------------------------------
function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function appendAudit(action, entityId, actorId, details = {}) {
  const logs = loadJson(AUDIT_FILE, []);
  logs.push({
    id: crypto.randomUUID(),
    action,
    entityId,
    actorId: actorId || "SYSTEM",
    details,
    timestamp: new Date().toISOString(),
  });
  saveJson(AUDIT_FILE, logs);
}

// ============================================================
// 1. DEVICE QUALITY GRADING (3-Tier A/B/C + Li-Ion Triage)
// ============================================================
// Grading flowchart from the deliverable report:
//   Step 1: Does it boot? If yes → candidate for A/B.
//   Step 2: Screen condition (Good/Cracked/Broken).
//   Step 3: Casing condition (Good/Dented/Damaged).
//   Step 4: Battery state (Normal/Degraded/Bloated).
//     Bloated Li-Ion → immediate QUARANTINE, grade C, fire-hazard flag.
//   Step 5: Grade = A if boots+good screen+good casing+normal battery;
//           B if boots but has cosmetic/battery issues; C otherwise.

/**
 * @param {{ itemId: string, screenCondition: 'Good'|'Cracked'|'Broken',
 *           casingCondition: 'Good'|'Dented'|'Damaged',
 *           batteryState: 'Normal'|'Degraded'|'Bloated',
 *           bootsReliably: boolean,
 *           category?: string, model?: string }} input
 */
export function gradeDevice(input) {
  const { itemId, screenCondition, casingCondition, batteryState, bootsReliably } = input;
  if (!itemId) throw new Error("itemId is required");

  // Li-Ion bloated battery → instant quarantine
  const liIonHazard = batteryState === "Bloated";
  let grade, recommendation;

  if (liIonHazard) {
    grade = "C";
    recommendation = "QUARANTINE — bloated Li-Ion cell detected. Route to fire-safe hazmat bay.";
  } else if (!bootsReliably) {
    grade = "C";
    recommendation = "Non-functional. Route to component harvesting / shredder.";
  } else if (screenCondition === "Good" && casingCondition === "Good" && batteryState === "Normal") {
    grade = "A";
    recommendation = "Fully functional, cosmetically sound. Eligible for refurbishment & resale.";
  } else {
    grade = "B";
    recommendation = "Functional with cosmetic/battery issues. Eligible for parts harvesting or discounted resale.";
  }

  const record = {
    gradeId: crypto.randomUUID(),
    itemId,
    grade,
    recommendation,
    liIonHazard,
    quarantineTag: liIonHazard ? `HAZMAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}` : null,
    screenCondition, casingCondition, batteryState, bootsReliably,
    category: input.category || null,
    model: input.model || null,
    gradedAt: new Date().toISOString(),
  };

  const grades = loadJson(GRADES_FILE, []);
  grades.push(record);
  saveJson(GRADES_FILE, grades);
  appendAudit("DEVICE_GRADED", record.gradeId, null, { itemId, grade, liIonHazard });

  return record;
}

// ============================================================
// 2. RIGHT-TO-REPAIR COMPONENT HARVESTING CALCULATOR
// ============================================================
// Evaluates recoverable value using economic golden rule from
// the deliverable reports. ponytail: static price table for demo,
// upgrade path = live commodities API feed.

const COMPONENT_VALUES = {
  // Category → recoverable components with avg INR value per device
  "Smartphone": [
    { component: "Display (OLED/LCD)", avgValueINR: 1200 },
    { component: "RAM (2-8 GB)", avgValueINR: 150 },
    { component: "Storage (eMMC/UFS)", avgValueINR: 200 },
    { component: "Battery (Li-Ion)", avgValueINR: 80 },
    { component: "Copper (PCB)", avgValueINR: 25 },
    { component: "Gold traces (PCB)", avgValueINR: 45 },
  ],
  "Laptop": [
    { component: "Display (IPS/TN)", avgValueINR: 2500 },
    { component: "RAM (SO-DIMM)", avgValueINR: 600 },
    { component: "SSD / HDD", avgValueINR: 800 },
    { component: "Battery (Li-Ion pack)", avgValueINR: 350 },
    { component: "Copper (PCB + wiring)", avgValueINR: 120 },
    { component: "Gold traces (PCB)", avgValueINR: 90 },
    { component: "Palladium (connectors)", avgValueINR: 40 },
  ],
  "Computing Device": [
    { component: "RAM (DIMM)", avgValueINR: 500 },
    { component: "HDD / SSD", avgValueINR: 700 },
    { component: "PSU (copper/aluminium)", avgValueINR: 200 },
    { component: "Copper (PCB + wiring)", avgValueINR: 350 },
    { component: "Gold traces (PCB)", avgValueINR: 150 },
    { component: "Steel casing", avgValueINR: 60 },
  ],
  "Consumer Electronics": [
    { component: "Copper (PCB + wiring)", avgValueINR: 80 },
    { component: "Plastics (recyclable)", avgValueINR: 30 },
    { component: "Gold traces (PCB)", avgValueINR: 20 },
  ],
  default: [
    { component: "Copper (PCB)", avgValueINR: 50 },
    { component: "Plastics", avgValueINR: 20 },
    { component: "Ferrous metals", avgValueINR: 15 },
  ],
};

/**
 * @param {{ category: string, model?: string, weightKg?: number }} input
 */
export function calculateHarvestValue(input) {
  const { category, model, weightKg } = input;
  if (!category) throw new Error("category is required");
  const components = COMPONENT_VALUES[category] || COMPONENT_VALUES.default;
  // ponytail: weight multiplier is linear for demo; upgrade = per-component weight curves
  const weightMultiplier = weightKg ? Math.max(0.5, Math.min(weightKg / 2, 3)) : 1;
  const adjusted = components.map(c => ({
    ...c,
    estimatedValueINR: Math.round(c.avgValueINR * weightMultiplier),
  }));
  const totalRecoverableValue = adjusted.reduce((s, c) => s + c.estimatedValueINR, 0);
  // Harvesting is viable if total value exceeds ₹200 (labour cost threshold)
  const harvestViable = totalRecoverableValue > 200;
  return { category, model: model || null, weightKg: weightKg || null, components: adjusted, totalRecoverableValue, harvestViable };
}

// ============================================================
// 3. AUCTION LOT LIFECYCLE — 4-hour B2B reverse auction
// ============================================================
const AUCTION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * @param {{ sellerId: string, items: Array<{itemId:string,category:string,weightKg:number}>,
 *           reservePrice: number, photoUrls?: string[], categoryMix?: string }} input
 */
export function createAuctionLot(input) {
  const { sellerId, items, reservePrice } = input;
  if (!sellerId || !items || !items.length) throw new Error("sellerId and items[] are required");
  if (typeof reservePrice !== "number" || reservePrice <= 0) throw new Error("reservePrice must be a positive number");

  const totalWeightKg = Math.round(items.reduce((s, i) => s + (i.weightKg || 0), 0) * 10000) / 10000;
  const now = new Date();
  const lot = {
    lotId: crypto.randomUUID(),
    sellerId,
    items,
    totalWeightKg,
    reservePrice,
    indicativePriceBand: { low: Math.round(reservePrice * 0.8), high: Math.round(reservePrice * 1.5) },
    photoUrls: input.photoUrls || [],
    categoryMix: input.categoryMix || items.map(i => i.category).join(", "),
    status: "OPEN",
    createdAt: now.toISOString(),
    endsAt: new Date(now.getTime() + AUCTION_DURATION_MS).toISOString(),
    topBidId: null,
    topBidPrice: 0,
    totalBids: 0,
  };

  const lots = loadJson(LOTS_FILE, []);
  lots.push(lot);
  saveJson(LOTS_FILE, lots);
  appendAudit("AUCTION_LOT_CREATED", lot.lotId, sellerId, { itemCount: items.length, reservePrice });

  return lot;
}

/**
 * @param {{ lotId: string, bidderId: string, bidPricePerKg: number }} input
 */
export function placeBid(input) {
  const { lotId, bidderId, bidPricePerKg } = input;
  if (!lotId || !bidderId) throw new Error("lotId and bidderId are required");
  if (typeof bidPricePerKg !== "number" || bidPricePerKg <= 0) throw new Error("bidPricePerKg must be positive");

  const lots = loadJson(LOTS_FILE, []);
  const lot = lots.find(l => l.lotId === lotId);
  if (!lot) throw new Error(`Lot ${lotId} not found`);
  if (lot.status !== "OPEN") throw new Error(`Lot ${lotId} is ${lot.status}, not OPEN`);

  // Check expiry
  if (new Date() > new Date(lot.endsAt)) {
    lot.status = "EXPIRED";
    saveJson(LOTS_FILE, lots);
    throw new Error(`Auction for lot ${lotId} has expired`);
  }

  const totalBidPrice = Math.round(bidPricePerKg * lot.totalWeightKg * 100) / 100;

  const bid = {
    bidId: crypto.randomUUID(),
    lotId,
    bidderId,
    bidPricePerKg,
    totalBidPrice,
    placedAt: new Date().toISOString(),
  };

  const bids = loadJson(BIDS_FILE, []);
  bids.push(bid);
  saveJson(BIDS_FILE, bids);

  // Update lot's leading bid
  if (totalBidPrice > lot.topBidPrice) {
    lot.topBidId = bid.bidId;
    lot.topBidPrice = totalBidPrice;
  }
  lot.totalBids = (lot.totalBids || 0) + 1;
  saveJson(LOTS_FILE, lots);

  appendAudit("BID_PLACED", bid.bidId, bidderId, { lotId, bidPricePerKg, totalBidPrice });

  return {
    bidId: bid.bidId,
    currentLeadingBid: lot.topBidPrice,
    totalBids: lot.totalBids,
  };
}

/**
 * @param {{ lotId: string }} input
 */
export function closeAuction(input) {
  const { lotId } = input;
  if (!lotId) throw new Error("lotId is required");

  const lots = loadJson(LOTS_FILE, []);
  const lot = lots.find(l => l.lotId === lotId);
  if (!lot) throw new Error(`Lot ${lotId} not found`);
  if (lot.status !== "OPEN") throw new Error(`Lot ${lotId} is already ${lot.status}`);

  const bids = loadJson(BIDS_FILE, []);
  const lotBids = bids.filter(b => b.lotId === lotId);

  if (lotBids.length === 0) {
    lot.status = "NO_BIDS";
    saveJson(LOTS_FILE, lots);
    appendAudit("AUCTION_CLOSED_NO_BIDS", lotId, "SYSTEM", {});
    return { lotId, status: "NO_BIDS", winnerId: null, finalPrice: 0, escrowLocked: false };
  }

  // Highest total bid wins (reverse auction = recyclers bidding UP for scrap)
  const winningBid = lotBids.reduce((best, b) => b.totalBidPrice > best.totalBidPrice ? b : best, lotBids[0]);

  lot.status = "CLOSED";
  lot.winnerId = winningBid.bidderId;
  lot.winningBidId = winningBid.bidId;
  lot.finalPrice = winningBid.totalBidPrice;
  lot.escrowLocked = true;
  lot.closedAt = new Date().toISOString();
  saveJson(LOTS_FILE, lots);

  appendAudit("AUCTION_CLOSED", lotId, "SYSTEM", {
    winnerId: winningBid.bidderId,
    finalPrice: winningBid.totalBidPrice,
  });

  return {
    lotId,
    status: "CLOSED",
    winnerId: winningBid.bidderId,
    finalPrice: winningBid.totalBidPrice,
    escrowLocked: true,
  };
}

// ============================================================
// 4. INSTANT UPI SETTLEMENT SIMULATION
// ============================================================

/**
 * @param {{ lotId: string, verifiedWeightKg: number, upiVpa: string }} input
 */
export function settlePayment(input) {
  const { lotId, verifiedWeightKg, upiVpa } = input;
  if (!lotId || !upiVpa) throw new Error("lotId and upiVpa are required");
  if (typeof verifiedWeightKg !== "number" || verifiedWeightKg <= 0) throw new Error("verifiedWeightKg must be positive");

  const lots = loadJson(LOTS_FILE, []);
  const lot = lots.find(l => l.lotId === lotId);
  if (!lot) throw new Error(`Lot ${lotId} not found`);
  if (lot.status !== "CLOSED") throw new Error(`Lot ${lotId} must be CLOSED to settle (current: ${lot.status})`);

  // Payout = winning bid's price-per-kg × verified weight (weighbridge-adjusted)
  const bids = loadJson(BIDS_FILE, []);
  const winningBid = bids.find(b => b.bidId === lot.winningBidId);
  if (!winningBid) throw new Error("Winning bid record not found");

  const payoutAmount = Math.round(winningBid.bidPricePerKg * verifiedWeightKg * 100) / 100;

  const settlement = {
    settlementId: crypto.randomUUID(),
    lotId,
    sellerId: lot.sellerId,
    buyerId: lot.winnerId,
    verifiedWeightKg,
    pricePerKg: winningBid.bidPricePerKg,
    payoutAmount,
    upiVpa,
    status: "SETTLED",
    settledAt: new Date().toISOString(),
  };

  const settlements = loadJson(SETTLEMENTS_FILE, []);
  settlements.push(settlement);
  saveJson(SETTLEMENTS_FILE, settlements);

  lot.status = "SETTLED";
  lot.settlementId = settlement.settlementId;
  saveJson(LOTS_FILE, lots);

  appendAudit("PAYMENT_SETTLED", settlement.settlementId, lot.sellerId, {
    lotId, payoutAmount, upiVpa, verifiedWeightKg,
  });

  return settlement;
}

// ============================================================
// 5. QUERY HELPERS
// ============================================================
export function getOpenAuctions() {
  return loadJson(LOTS_FILE, []).filter(l => l.status === "OPEN");
}
export function getAllAuctions() {
  return loadJson(LOTS_FILE, []);
}
export function getAuctionBids(input) {
  const { lotId } = input || {};
  const bids = loadJson(BIDS_FILE, []);
  return lotId ? bids.filter(b => b.lotId === lotId) : bids;
}
export function getSettlements() {
  return loadJson(SETTLEMENTS_FILE, []);
}
export function getDeviceGrades() {
  return loadJson(GRADES_FILE, []);
}
export function getAuctionAuditTrail(input) {
  const logs = loadJson(AUDIT_FILE, []);
  if (input && input.lotId) return logs.filter(l => l.entityId === input.lotId || (l.details && l.details.lotId === input.lotId));
  return logs;
}
