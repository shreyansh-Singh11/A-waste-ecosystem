/*
  ============================================================
  MUNICIPAL WASTE — SMART COLLECTION & RECYCLING ENGINE
  ============================================================
  Mirrors the same pattern as decisionEngine.mjs:
  - reads/writes JSON files from ../data/municipal*.json
  - generates UUIDs with crypto.randomUUID()
  - every mutation appends an audit entry to municipalAuditLogs.json

  Exports nine functions covering the full municipal waste lifecycle:
  shift creation → household pickup → trip locking → weighbridge →
  gate pass → MRF sorting → recycler marketplace → citizen reporting →
  audit trail query.
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const SHIFTS_FILE = path.join(DATA_DIR, "municipalShifts.json");
const TRIPS_FILE = path.join(DATA_DIR, "municipalTrips.json");
const ROUTES_FILE = path.join(DATA_DIR, "municipalRoutes.json");
const MRF_INVENTORY_FILE = path.join(DATA_DIR, "municipalMrfInventory.json");
const RECYCLER_ORDERS_FILE = path.join(DATA_DIR, "municipalRecyclerOrders.json");
const AUDIT_LOGS_FILE = path.join(DATA_DIR, "municipalAuditLogs.json");
const WHISTLEBLOWER_FILE = path.join(DATA_DIR, "municipalWhistleblower.json");

// ------------------------------------------------------------
// Shared file helpers (same read/write pattern as decisionEngine.mjs)
// ------------------------------------------------------------
function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ------------------------------------------------------------
// Audit-log helper — every public function calls this so the
// municipalAuditLogs.json file is the single chain-of-custody ledger.
// ------------------------------------------------------------
function appendAudit(action, entityId, actorId, details = {}) {
  const logs = loadJson(AUDIT_LOGS_FILE, []);
  const entry = {
    id: crypto.randomUUID(),
    action,
    entityId,
    actorId: actorId || "system",
    timestamp: new Date().toISOString(),
    details,
  };
  logs.push(entry);
  saveJson(AUDIT_LOGS_FILE, logs);
  return entry;
}

// ============================================================
// 1. createShift — start a collection shift
// ============================================================
export function createShift({ driverId, vehicleId, wardId, routeGeoJson }) {
  const shifts = loadJson(SHIFTS_FILE, []);
  const shiftId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const shift = {
    shiftId,
    driverId,
    vehicleId,
    wardId,
    routeGeoJson: routeGeoJson || null,
    status: "ACTIVE",
    startedAt,
    pickups: [],
  };

  shifts.push(shift);
  saveJson(SHIFTS_FILE, shifts);
  appendAudit("SHIFT_CREATED", shiftId, driverId, { vehicleId, wardId });

  return { shiftId, status: "ACTIVE", startedAt };
}

// ============================================================
// Registered Households with Secure Doorstep QR Codes (Anti-Cheat)
// ============================================================
export const REGISTERED_HOUSEHOLDS = [
  {
    householdId: "HH-15-101",
    residentName: "Sunita Sharma",
    address: "Plot 42, Lane 3, Shahpura Sector B, Ward 15",
    wardId: "Ward-15 (Shahpura)",
    qrCode: "MUNI-HH-WARD15-101-SECURE",
    rfidTag: "RFID-HH-15101",
    isDemo: true
  },
  {
    householdId: "HH-15-102",
    residentName: "Rajesh Verma",
    address: "Plot 43, Lane 3, Shahpura Sector B, Ward 15",
    wardId: "Ward-15 (Shahpura)",
    qrCode: "MUNI-HH-WARD15-102-SECURE",
    rfidTag: "RFID-HH-15102",
    isDemo: false
  }
];

export function getRegisteredHouseholds() {
  return REGISTERED_HOUSEHOLDS;
}

// ============================================================
// 2. recordPickup — log a household waste pickup with doorstep QR anti-cheat check
// ============================================================
export function recordPickup({ shiftId, householdId, weightKg, segregationStatus, gpsLat, gpsLng, householdQr, qrCode, timestamp }) {
  const shifts = loadJson(SHIFTS_FILE, []);
  const shift = shifts.find((s) => s.shiftId === shiftId);
  if (!shift) throw new Error(`Shift ${shiftId} not found`);
  if (shift.status !== "ACTIVE") throw new Error(`Shift ${shiftId} is not ACTIVE (current: ${shift.status})`);

  const providedQr = householdQr || qrCode;
  const regHh = REGISTERED_HOUSEHOLDS.find(h => h.householdId.toLowerCase() === (householdId || "").toLowerCase());

  // Anti-cheat verification rule:
  // If household is registered (including Demo Household HH-15-101), doorstep QR is mandatory and must match
  if (regHh) {
    if (!providedQr || providedQr.trim() !== regHh.qrCode) {
      throw new Error(`Anti-Cheat Verification Failed: Doorstep QR code required and must match physical placard at ${householdId}. Scanned: "${providedQr || 'NONE'}" (Expected: "${regHh.qrCode}"). Staff cannot enter false collection records.`);
    }
  }

  const isVerified = !!(regHh && providedQr === regHh.qrCode);
  const pickupId = crypto.randomUUID();
  const ts = timestamp || new Date().toISOString();

  const pickup = {
    pickupId,
    householdId,
    weightKg,
    segregationStatus: segregationStatus || "UNKNOWN",
    householdQr: providedQr || (regHh ? regHh.qrCode : "UNVERIFIED-LEGACY"),
    qrVerified: isVerified,
    gpsLat: gpsLat ?? null,
    gpsLng: gpsLng ?? null,
    timestamp: ts,
    status: "COLLECTED",
  };

  shift.pickups.push(pickup);
  saveJson(SHIFTS_FILE, shifts);
  appendAudit("PICKUP_RECORDED", pickupId, shift.driverId, {
    shiftId,
    householdId,
    weightKg,
    segregationStatus,
    householdQr: pickup.householdQr,
    qrVerified: pickup.qrVerified
  });

  return { pickupId, status: "COLLECTED", qrVerified: pickup.qrVerified, householdId };
}

// ============================================================
// 3. lockTrip — lock the shift's load to a destination facility
// ============================================================
export function lockTrip({ shiftId, destinationFacilityId }) {
  const shifts = loadJson(SHIFTS_FILE, []);
  const shift = shifts.find((s) => s.shiftId === shiftId);
  if (!shift) throw new Error(`Shift ${shiftId} not found`);

  const trips = loadJson(TRIPS_FILE, []);
  const tripId = crypto.randomUUID();

  const totalPickupWeight = shift.pickups.reduce((sum, p) => sum + (p.weightKg || 0), 0);

  const trip = {
    tripId,
    shiftId,
    driverId: shift.driverId,
    vehicleId: shift.vehicleId,
    destinationFacilityId,
    totalPickupWeight,
    status: "IN_TRANSIT",
    lockedAt: new Date().toISOString(),
    weighbridge: null,
    gatePass: null,
  };

  trips.push(trip);
  shift.status = "IN_TRANSIT";
  saveJson(TRIPS_FILE, trips);
  saveJson(SHIFTS_FILE, shifts);
  appendAudit("TRIP_LOCKED", tripId, shift.driverId, { shiftId, destinationFacilityId, totalPickupWeight });

  return { tripId, status: "IN_TRANSIT", destinationFacilityId };
}

// ============================================================
// 4. recordWeighbridge — record gross/tare weights at facility
// ============================================================
export function recordWeighbridge({ tripId, facilityId, grossWeightKg, tareWeightKg }) {
  const trips = loadJson(TRIPS_FILE, []);
  const trip = trips.find((t) => t.tripId === tripId);
  if (!trip) throw new Error(`Trip ${tripId} not found`);
  if (trip.status !== "IN_TRANSIT") throw new Error(`Trip ${tripId} is not IN_TRANSIT (current: ${trip.status})`);

  const netWeightKg = grossWeightKg - tareWeightKg;
  const receiptId = crypto.randomUUID();

  trip.weighbridge = {
    receiptId,
    facilityId,
    grossWeightKg,
    tareWeightKg,
    netWeightKg,
    recordedAt: new Date().toISOString(),
  };
  trip.status = "DELIVERED";

  saveJson(TRIPS_FILE, trips);
  appendAudit("WEIGHBRIDGE_RECORDED", receiptId, facilityId, { tripId, grossWeightKg, tareWeightKg, netWeightKg });

  return { receiptId, netWeightKg, status: "DELIVERED" };
}

// ============================================================
// 5. generateGatePass — landfill gate pass (residual must be < 15%)
// ============================================================
export function generateGatePass({ tripId, residualWeightKg }) {
  const trips = loadJson(TRIPS_FILE, []);
  const trip = trips.find((t) => t.tripId === tripId);
  if (!trip) throw new Error(`Trip ${tripId} not found`);

  // Use weighbridge net weight if available, otherwise fall back to total pickup weight
  const tripTotal = trip.weighbridge ? trip.weighbridge.netWeightKg : trip.totalPickupWeight;

  if (tripTotal <= 0) {
    throw new Error(`Trip ${tripId} has no recorded weight — cannot compute residual threshold`);
  }

  const residualPercent = (residualWeightKg / tripTotal) * 100;

  if (residualPercent >= 15) {
    appendAudit("GATE_PASS_REJECTED", tripId, "system", {
      residualWeightKg,
      tripTotal,
      residualPercent: Math.round(residualPercent * 100) / 100,
      reason: "Residual weight exceeds 15% of trip total",
    });
    throw new Error(
      `Gate pass REJECTED: residual ${residualWeightKg} kg is ${residualPercent.toFixed(1)}% of trip total ${tripTotal} kg (must be < 15%)`
    );
  }

  const gatePassId = crypto.randomUUID();

  trip.gatePass = {
    gatePassId,
    residualWeightKg,
    residualPercent: Math.round(residualPercent * 100) / 100,
    status: "APPROVED",
    issuedAt: new Date().toISOString(),
  };

  saveJson(TRIPS_FILE, trips);
  appendAudit("GATE_PASS_APPROVED", gatePassId, "system", { tripId, residualWeightKg, residualPercent: Math.round(residualPercent * 100) / 100 });

  return { gatePassId, status: "APPROVED" };
}

// ============================================================
// 6. logMrfSorting — log sorted materials at MRF
// ============================================================
export function logMrfSorting({ facilityId, materials }) {
  const inventory = loadJson(MRF_INVENTORY_FILE, []);
  const sortingId = crypto.randomUUID();
  const totalSortedKg = materials.reduce((sum, m) => sum + (m.weightKg || 0), 0);

  const sortingEntry = {
    sortingId,
    facilityId,
    materials: materials.map((m) => ({ type: m.type, weightKg: m.weightKg })),
    totalSortedKg,
    sortedAt: new Date().toISOString(),
  };

  inventory.push(sortingEntry);
  saveJson(MRF_INVENTORY_FILE, inventory);
  appendAudit("MRF_SORTING_LOGGED", sortingId, facilityId, { materialCount: materials.length, totalSortedKg });

  return { sortingId, totalSortedKg };
}

// ============================================================
// 7. createRecyclerOrder — B2B sale order from MRF to recycler
// ============================================================
export function createRecyclerOrder({ mrfId, materialType, weightKg, recyclerId, pricePerKg }) {
  const orders = loadJson(RECYCLER_ORDERS_FILE, []);
  const orderId = crypto.randomUUID();
  const totalPrice = weightKg * pricePerKg;

  const order = {
    orderId,
    mrfId,
    materialType,
    weightKg,
    recyclerId,
    pricePerKg,
    totalPrice,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  saveJson(RECYCLER_ORDERS_FILE, orders);
  appendAudit("RECYCLER_ORDER_CREATED", orderId, mrfId, { materialType, weightKg, recyclerId, totalPrice });

  return { orderId, totalPrice, status: "PENDING" };
}

// ============================================================
// 8. reportOpenDump — citizen whistleblower report
// ============================================================
export function reportOpenDump({ reporterId, photoUrl, gpsLat, gpsLng, description }) {
  const reports = loadJson(WHISTLEBLOWER_FILE, []);
  const reportId = crypto.randomUUID();

  const report = {
    reportId,
    reporterId,
    photoUrl: photoUrl || null,
    gpsLat: gpsLat ?? null,
    gpsLng: gpsLng ?? null,
    description: description || null,
    status: "SUBMITTED",
    submittedAt: new Date().toISOString(),
  };

  reports.push(report);
  saveJson(WHISTLEBLOWER_FILE, reports);
  appendAudit("OPEN_DUMP_REPORTED", reportId, reporterId, { gpsLat, gpsLng, description });

  return { reportId, status: "SUBMITTED" };
}

// ============================================================
// 9. getAuditTrail — full chain-of-custody for a shift
// ============================================================
export function getAuditTrail({ shiftId }) {
  const logs = loadJson(AUDIT_LOGS_FILE, []);

  // Collect all audit entries directly referencing this shiftId
  const shiftLogs = logs.filter(
    (entry) =>
      entry.entityId === shiftId ||
      (entry.details && entry.details.shiftId === shiftId)
  );

  // Also include trip-related entries (weighbridge, gate pass)
  const trips = loadJson(TRIPS_FILE, []);
  const relatedTrips = trips.filter((t) => t.shiftId === shiftId);
  const tripIds = new Set(relatedTrips.map((t) => t.tripId));

  const tripLogs = logs.filter(
    (entry) =>
      tripIds.has(entry.entityId) ||
      (entry.details && tripIds.has(entry.details.tripId))
  );

  // Merge and deduplicate by id, then sort chronologically
  const allEntries = new Map();
  for (const entry of [...shiftLogs, ...tripLogs]) {
    allEntries.set(entry.id, entry);
  }

  return [...allEntries.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// ============================================================
// Query Helpers for UI / Dashboard
// ============================================================
export function getAllShifts() {
  return loadJson(SHIFTS_FILE, []);
}

export function getAllTrips() {
  return loadJson(TRIPS_FILE, []);
}

export function getMrfInventory() {
  return loadJson(MRF_INVENTORY_FILE, []);
}

export function getRecyclerOrders() {
  return loadJson(RECYCLER_ORDERS_FILE, []);
}

export function getWhistleblowerReports() {
  return loadJson(WHISTLEBLOWER_FILE, []);
}

