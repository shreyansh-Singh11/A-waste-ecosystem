/**
 * Phase 5 — Community Whistleblower, AI Plant Capacity Forecasting,
 * B2B Recyclables Commodity Marketplace, and Worker Health Safety Pass Engine
 *
 * Implements:
 * 1. Citizen Open-Dump Whistleblower & Rapid Response Dispatch with Swachh Karma Rewards
 * 2. AI Facility Volume & Capacity Load Forecasting (MRF, Compost, CBWTF, E-Waste)
 * 3. B2B Recyclable Commodity Marketplace & Secondary Raw Material Trading (PET, HDPE, OCC, Al)
 * 4. Sanitation & Healthcare Worker Health Pass & Immunization Verification (Report 1 alignment)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

// Helper JSON persistence
function loadJson(fileName, fallback = []) {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${fileName}:`, e.message);
    return fallback;
  }
}

function saveJson(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function appendAudit(action, entityId, actorId, details = {}) {
  const logs = loadJson("municipalAuditLogs.json", []);
  logs.push({
    id: crypto.randomUUID(),
    action,
    entityId,
    actorId,
    timestamp: new Date().toISOString(),
    details
  });
  saveJson("municipalAuditLogs.json", logs);
}

// ============================================================
// 1. CITIZEN OPEN-DUMP WHISTLEBLOWER & RAPID RESPONSE ENGINE
// ============================================================

export function reportOpenDump({
  citizenId,
  citizenName,
  phone,
  ward,
  lat,
  lng,
  address,
  wasteCategory,
  estimatedVolumeKg,
  photoUrl,
  isAnonymous = false,
  description
}) {
  if (!ward) throw new Error("Ward is required for geo-tagging dump report");
  const category = wasteCategory || "MUNICIPAL_MSW";
  
  // High-risk bio-medical or toxic e-waste gets accelerated emergency 6-hour SLA
  const isEmergency = category === "BIO_MEDICAL_HAZARD" || category === "E_WASTE_TOXIC";
  const slaHours = isEmergency ? 6 : 24;
  const now = new Date();
  const slaDeadline = new Date(now.getTime() + slaHours * 3600 * 1000).toISOString();

  const reports = loadJson("whistleblowerReports.json", []);
  const reportId = "DUMP-REP-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  const report = {
    reportId,
    citizenId: citizenId || "CITIZEN-ANON",
    citizenName: isAnonymous ? "Anonymous Citizen Whistleblower" : (citizenName || "Concerned Resident"),
    phone: isAnonymous ? null : (phone || null),
    isAnonymous,
    ward,
    location: {
      lat: lat ?? 23.2599,
      lng: lng ?? 77.4126,
      address: address || `Ward ${ward}, Municipal Limits`
    },
    wasteCategory: category,
    isEmergency,
    estimatedVolumeKg: parseFloat(estimatedVolumeKg) || 150,
    photoUrl: photoUrl || "/assets/images/dump_evidence_sample.jpg",
    description: description || "Illegal open dumping observed on public roadside/open plot",
    status: "SUBMITTED", // SUBMITTED -> DISPATCHED -> CLEANED -> VERIFIED
    slaHours,
    slaDeadline,
    isSlaBreached: false,
    submittedAt: now.toISOString(),
    dispatchedAt: null,
    resolvedAt: null,
    cleanupCrew: null,
    clearedWeightKg: null,
    karmaPointsAwarded: 50
  };

  reports.push(report);
  saveJson("whistleblowerReports.json", reports);

  // Credit Citizen Green Swachh Karma Coins
  if (citizenId && !isAnonymous) {
    awardCitizenKarma({
      citizenId,
      citizenName: report.citizenName,
      points: 50,
      reason: `Reported illegal open dump ${reportId} in Ward ${ward}`,
      referenceId: reportId
    });
  }

  appendAudit("OPEN_DUMP_REPORTED", reportId, citizenId || "ANON", {
    ward,
    category,
    isEmergency,
    slaHours
  });

  return report;
}

export function dispatchCleanupCrew({ reportId, crewId, vehicleId, notes }) {
  const reports = loadJson("whistleblowerReports.json", []);
  const report = reports.find(r => r.reportId === reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  report.status = "DISPATCHED";
  report.dispatchedAt = new Date().toISOString();
  report.cleanupCrew = {
    crewId: crewId || "RAPID-CREW-NORTH",
    vehicleId: vehicleId || "TRUCK-MP-CLEAN-09",
    dispatchedNotes: notes || "Immediate deployment for site sanitization and debris clearing"
  };

  saveJson("whistleblowerReports.json", reports);
  appendAudit("CLEANUP_CREW_DISPATCHED", reportId, crewId, { vehicleId });

  return report;
}

export function verifyAndCloseDump({ reportId, afterPhotoUrl, actualWeightClearedKg, verifiedByOfficer }) {
  const reports = loadJson("whistleblowerReports.json", []);
  const report = reports.find(r => r.reportId === reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const now = new Date();
  report.status = "VERIFIED";
  report.resolvedAt = now.toISOString();
  report.afterPhotoUrl = afterPhotoUrl || "/assets/images/clean_site_sample.jpg";
  report.clearedWeightKg = parseFloat(actualWeightClearedKg) || report.estimatedVolumeKg || 120;
  report.verifiedByOfficer = verifiedByOfficer || "WARD-SANITATION-INSPECTOR";

  // Check SLA turnaround
  const deadline = new Date(report.slaDeadline);
  report.isSlaBreached = now > deadline;

  // Bonus karma if within SLA
  if (!report.isSlaBreached && report.citizenId && !report.isAnonymous) {
    awardCitizenKarma({
      citizenId: report.citizenId,
      citizenName: report.citizenName,
      points: 50,
      reason: `Bonus: Dump ${reportId} sanitized within SLA target`,
      referenceId: reportId
    });
    report.karmaPointsAwarded += 50;
  }

  saveJson("whistleblowerReports.json", reports);
  appendAudit("DUMP_CLEANUP_VERIFIED", reportId, verifiedByOfficer, {
    clearedWeightKg: report.clearedWeightKg,
    isSlaBreached: report.isSlaBreached
  });

  return report;
}

export function getDumpReports({ ward, status, category } = {}) {
  const reports = loadJson("whistleblowerReports.json", []);
  const now = new Date();

  // Dynamic SLA update
  return reports.map(r => {
    const isPastDeadline = now > new Date(r.slaDeadline);
    const isOpen = r.status === "SUBMITTED" || r.status === "DISPATCHED";
    const breached = isPastDeadline && isOpen;
    return {
      ...r,
      isSlaBreached: breached,
      escalationStatus: breached ? "ESCALATED_COMMISSIONER" : (r.isEmergency ? "HIGH_PRIORITY_EMERGENCY" : "STANDARD_DISPATCH")
    };
  }).filter(r => {
    if (ward && r.ward !== ward) return false;
    if (status && r.status !== status) return false;
    if (category && r.wasteCategory !== category) return false;
    return true;
  });
}

// Citizen Green Karma Ledger
export function awardCitizenKarma({ citizenId, citizenName, points, reason, referenceId }) {
  const rewards = loadJson("citizenRewards.json", []);
  const entry = {
    transactionId: "KARMA-TX-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    citizenId,
    citizenName: citizenName || "Resident",
    type: "EARNED",
    points: Math.abs(points),
    reason,
    referenceId,
    timestamp: new Date().toISOString()
  };
  rewards.push(entry);
  saveJson("citizenRewards.json", rewards);
  return entry;
}

export function getCitizenKarmaBalance(citizenId) {
  const rewards = loadJson("citizenRewards.json", []);
  const userEntries = rewards.filter(e => e.citizenId === citizenId);
  const earned = userEntries.filter(e => e.type === "EARNED").reduce((sum, e) => sum + e.points, 0);
  const redeemed = userEntries.filter(e => e.type === "REDEEMED").reduce((sum, e) => sum + e.points, 0);
  return {
    citizenId,
    totalEarnedPoints: earned,
    totalRedeemedPoints: redeemed,
    currentBalance: earned - redeemed,
    rebateValueINR: (earned - redeemed) * 1.0, // 1 point = 1 INR discount
    history: userEntries
  };
}

export function redeemKarmaForUserFeeDiscount({ citizenId, householdId, pointsToRedeem, monthYear }) {
  const balance = getCitizenKarmaBalance(citizenId);
  const pts = parseInt(pointsToRedeem, 10);
  if (pts <= 0) throw new Error("Points to redeem must be greater than 0");
  if (pts > balance.currentBalance) {
    throw new Error(`Insufficient karma balance: have ${balance.currentBalance} points, requested ${pts}`);
  }

  const rewards = loadJson("citizenRewards.json", []);
  const redemptionId = "REBATE-VOUCHER-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  const entry = {
    transactionId: redemptionId,
    citizenId,
    citizenName: balance.history[0]?.citizenName || "Resident",
    type: "REDEEMED",
    points: pts,
    reason: `User-fee rebate voucher applied for ${householdId} (${monthYear || "Current Month"})`,
    referenceId: householdId,
    rebateINR: pts * 1.0,
    timestamp: new Date().toISOString()
  };
  rewards.push(entry);
  saveJson("citizenRewards.json", rewards);

  return {
    redemptionId,
    citizenId,
    householdId,
    pointsRedeemed: pts,
    discountAmountINR: pts * 1.0,
    remainingBalance: balance.currentBalance - pts,
    status: "REBATE_APPLIED"
  };
}


// ============================================================
// 2. AI FACILITY VOLUME & CAPACITY LOAD FORECASTING ENGINE
// ============================================================

const FACILITY_SPECS = {
  "MRF-BHOPAL-CENTRAL": {
    name: "Central Material Recovery Facility (MRF)",
    track: "MUNICIPAL_DRY",
    designCapacityKgPerDay: 25000,
    baselineKg: 18400,
    unit: "Dry Recyclable Polymers & Paper"
  },
  "COMPOST-PLANT-01": {
    name: "Regional Bio-Methanation & Composting Plant",
    track: "MUNICIPAL_WET",
    designCapacityKgPerDay: 30000,
    baselineKg: 22500,
    unit: "Organic Kitchen & Wet Waste"
  },
  "CBWTF-MP-HEALTH": {
    name: "Common Bio-Medical Waste Treatment Facility",
    track: "BIO_MEDICAL",
    designCapacityKgPerDay: 8000,
    baselineKg: 5200,
    unit: "Hazardous & Infectious Bio-Medical Waste"
  },
  "EWASTE-DISMANTLE-01": {
    name: "Authorized E-Waste Dismantling & Smelting Hub",
    track: "E_WASTE",
    designCapacityKgPerDay: 5000,
    baselineKg: 3100,
    unit: "End-of-Life Electronic Hardware"
  }
};

export function forecastFacilityLoad({ facilityId = "MRF-BHOPAL-CENTRAL", forecastDays = 7 }) {
  const spec = FACILITY_SPECS[facilityId] || FACILITY_SPECS["MRF-BHOPAL-CENTRAL"];
  const days = Math.min(Math.max(parseInt(forecastDays, 10) || 7, 3), 30);

  // Day-of-week demand multipliers (reflecting weekly civic and hospital surge curves)
  const dayMultipliers = {
    0: 0.88, // Sunday (Commercial drop)
    1: 1.18, // Monday (Post-weekend collection surge)
    2: 1.04, // Tuesday
    3: 0.98, // Wednesday
    4: 1.02, // Thursday
    5: 1.08, // Friday
    6: 1.12  // Saturday (Household cleanup peak)
  };

  const dailyForecast = [];
  const now = new Date();
  let totalProjectedKg = 0;
  let peakLoadKg = 0;
  let overloadDaysCount = 0;

  for (let i = 0; i < days; i++) {
    const targetDate = new Date(now.getTime() + i * 24 * 3600 * 1000);
    const dayOfWeek = targetDate.getDay();
    const dayName = targetDate.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = targetDate.toISOString().slice(0, 10);

    // Multiplier calculation with slight stochastic variation (+/- 3%)
    const baseMult = dayMultipliers[dayOfWeek] || 1.0;
    const pseudoRandomVar = 1.0 + (((i * 7 + dayOfWeek * 13) % 7) - 3) * 0.015;
    const projectedWeightKg = Math.round(spec.baselineKg * baseMult * pseudoRandomVar);

    const utilizationPct = Math.round((projectedWeightKg / spec.designCapacityKgPerDay) * 1000) / 10;
    let status = "OPTIMAL";
    if (utilizationPct > 90) {
      status = "OVERLOAD_WARNING";
      overloadDaysCount++;
    } else if (utilizationPct >= 75) {
      status = "HEAVY_LOAD";
    }

    if (projectedWeightKg > peakLoadKg) peakLoadKg = projectedWeightKg;
    totalProjectedKg += projectedWeightKg;

    dailyForecast.push({
      date: dateStr,
      day: dayName,
      projectedWeightKg,
      designCapacityKg: spec.designCapacityKgPerDay,
      utilizationPct,
      status
    });
  }

  const averageDailyKg = Math.round(totalProjectedKg / days);
  const averageUtilizationPct = Math.round((averageDailyKg / spec.designCapacityKgPerDay) * 1000) / 10;

  // AI Load-Balancing Recommendation
  let recommendation = "✅ Facility capacity is nominal. Standard maintenance cycles recommended.";
  if (overloadDaysCount > 0) {
    recommendation = `⚠️ BOTTLENECK ALERT: ${overloadDaysCount} day(s) projected to breach 90% design threshold. Divert secondary incoming collection trucks to Auxiliary Hub B or activate 3rd processing shift.`;
  } else if (averageUtilizationPct >= 75) {
    recommendation = "⚡ ELEVATED CAPACITY: Schedule overtime preprocessing team and clear dispatch inventory to prevent staging dock congestion.";
  }

  return {
    facilityId,
    facilityName: spec.name,
    track: spec.track,
    unit: spec.unit,
    designCapacityKgPerDay: spec.designCapacityKgPerDay,
    forecastPeriodDays: days,
    forecastSummary: {
      totalProjectedKg,
      totalProjectedMetricTons: Math.round((totalProjectedKg / 1000) * 10) / 10,
      averageDailyKg,
      peakLoadKg,
      averageUtilizationPct,
      overloadDaysCount,
      aiRecommendation: recommendation
    },
    dailyForecast
  };
}

export function getAllFacilitiesForecast(forecastDays = 7) {
  return Object.keys(FACILITY_SPECS).map(fId => forecastFacilityLoad({ facilityId: fId, forecastDays }));
}


// ============================================================
// 3. B2B RECYCLABLES COMMODITY MARKETPLACE ENGINE
// ============================================================

export const STANDARD_COMMODITIES = [
  { materialCode: "PET_FLAKES_CLEAR", name: "Grade-1 Washed Clear PET Flakes", basePriceINR: 38.5, unit: "kg" },
  { materialCode: "HDPE_RIGID_REGRIND", name: "Natural HDPE Rigid Flakes / Regrind", basePriceINR: 46.0, unit: "kg" },
  { materialCode: "LDPE_FILM_BALED", name: "High-Grade Baled LDPE Packaging Film", basePriceINR: 24.0, unit: "kg" },
  { materialCode: "OCC_CARDBOARD_BALED", name: "Old Corrugated Cardboard (OCC) Bales", basePriceINR: 13.5, unit: "kg" },
  { materialCode: "ALUMINUM_SCRAP_BALED", name: "Baled Used Beverage Cans (UBC Aluminum)", basePriceINR: 142.0, unit: "kg" }
];

export function listCommodityLot({
  facilityId = "MRF-BHOPAL-CENTRAL",
  materialCode,
  purityGrade = "A",
  weightKg,
  pricePerKgINR,
  location
}) {
  if (!materialCode || !weightKg) throw new Error("materialCode and weightKg are required");
  const std = STANDARD_COMMODITIES.find(c => c.materialCode === materialCode);
  const commodityName = std ? std.name : materialCode;
  const rate = parseFloat(pricePerKgINR) || (std ? std.basePriceINR : 30.0);

  const lots = loadJson("commodityMarketplace.json", []);
  const lotId = "COMMODITY-LOT-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  const lot = {
    lotId,
    facilityId,
    materialCode,
    commodityName,
    purityGrade, // A | B | MIXED
    totalWeightKg: parseFloat(weightKg),
    availableWeightKg: parseFloat(weightKg),
    pricePerKgINR: rate,
    estimatedTotalValueINR: Math.round(parseFloat(weightKg) * rate),
    location: location || "Central MRF Logistics Yard, Bay 3",
    status: "AVAILABLE", // AVAILABLE | PARTIALLY_SOLD | SOLD_OUT
    listedAt: new Date().toISOString()
  };

  lots.push(lot);
  saveJson("commodityMarketplace.json", lots);
  appendAudit("COMMODITY_LOT_LISTED", lotId, facilityId, { materialCode, weightKg, rate });

  return lot;
}

export function placeCommodityOrder({
  lotId,
  buyerOrg,
  buyerGstin,
  buyerContact,
  requestedWeightKg,
  offeredPricePerKg
}) {
  if (!buyerOrg || !buyerGstin) throw new Error("Buyer organisation name and GSTIN are required");
  const lots = loadJson("commodityMarketplace.json", []);
  const lot = lots.find(l => l.lotId === lotId);
  if (!lot) throw new Error(`Lot ${lotId} not found`);
  if (lot.status === "SOLD_OUT" || lot.availableWeightKg <= 0) {
    throw new Error(`Lot ${lotId} is completely sold out`);
  }

  const orderWeightKg = Math.min(parseFloat(requestedWeightKg) || lot.availableWeightKg, lot.availableWeightKg);
  const unitRate = parseFloat(offeredPricePerKg) || lot.pricePerKgINR;
  const subtotalINR = Math.round(orderWeightKg * unitRate);
  const gstRatePct = 18; // Standard GST on secondary recyclable raw material
  const gstAmountINR = Math.round(subtotalINR * (gstRatePct / 100));
  const totalAmountINR = subtotalINR + gstAmountINR;

  // Deduct available inventory
  lot.availableWeightKg -= orderWeightKg;
  lot.status = lot.availableWeightKg <= 0 ? "SOLD_OUT" : "PARTIALLY_SOLD";
  saveJson("commodityMarketplace.json", lots);

  const orders = loadJson("commodityOrders.json", []);
  const orderId = "B2B-PO-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  const invoiceNo = "GST-INV-2026-" + crypto.randomUUID().slice(0, 6).toUpperCase();

  const order = {
    orderId,
    invoiceNo,
    lotId,
    facilityId: lot.facilityId,
    commodityName: lot.commodityName,
    materialCode: lot.materialCode,
    buyerOrg,
    buyerGstin,
    buyerContact: buyerContact || "procurement@buyer.in",
    weightPurchasedKg: orderWeightKg,
    unitPriceINR: unitRate,
    financials: {
      subtotalINR,
      gstRatePct,
      gstAmountINR,
      totalAmountINR,
      municipalRevenueINR: subtotalINR // Revenue credited to urban local body
    },
    escrowStatus: "ESCROW_LOCKED",
    deliveryGatePass: "GATEPASS-MRF-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
    orderedAt: new Date().toISOString()
  };

  orders.push(order);
  saveJson("commodityOrders.json", orders);
  appendAudit("COMMODITY_ORDER_PLACED", orderId, buyerOrg, { totalAmountINR, weightPurchasedKg: orderWeightKg });

  return order;
}

export function getCommodityMarketplace() {
  const lots = loadJson("commodityMarketplace.json", []);
  return {
    standardCommodities: STANDARD_COMMODITIES,
    lots: lots.slice().reverse()
  };
}

export function getCommodityOrders() {
  return loadJson("commodityOrders.json", []).slice().reverse();
}


// ============================================================
// 4. SANITATION & HEALTHCARE WORKER HEALTH & SHIFT PASS ENGINE
// ============================================================

export function recordWorkerHealthProfile({
  workerId,
  workerName,
  track = "MUNICIPAL_SWM", // MUNICIPAL_SWM | BIO_MEDICAL
  tetanusVaccineDate,
  hepatitisBVaccineDate,
  ppeCertificationDate,
  lastHealthCheckupDate
}) {
  if (!workerId || !workerName) throw new Error("workerId and workerName required");
  const profiles = loadJson("workerCertifications.json", []);
  let profile = profiles.find(p => p.workerId === workerId);

  const now = new Date();
  const oneYearMs = 365 * 24 * 3600 * 1000;
  const threeYearsMs = 3 * oneYearMs;

  const data = {
    workerId,
    workerName,
    track,
    tetanusVaccineDate: tetanusVaccineDate || now.toISOString().slice(0, 10),
    hepatitisBVaccineDate: hepatitisBVaccineDate || now.toISOString().slice(0, 10),
    ppeCertificationDate: ppeCertificationDate || now.toISOString().slice(0, 10),
    lastHealthCheckupDate: lastHealthCheckupDate || now.toISOString().slice(0, 10),
    updatedAt: now.toISOString()
  };

  if (profile) {
    Object.assign(profile, data);
  } else {
    profile = data;
    profiles.push(profile);
  }

  saveJson("workerCertifications.json", profiles);
  return profile;
}

export function validateWorkerShiftEligibility(workerId) {
  const profiles = loadJson("workerCertifications.json", []);
  let profile = profiles.find(p => p.workerId === workerId);

  // If worker not found, create a compliant default demo profile
  if (!profile) {
    profile = recordWorkerHealthProfile({
      workerId,
      workerName: "Staff " + workerId,
      track: "MUNICIPAL_SWM"
    });
  }

  const now = Date.now();
  const oneYearMs = 365 * 24 * 3600 * 1000;
  const threeYearsMs = 3 * oneYearMs;

  const deficiencies = [];
  const tetanusAge = profile.tetanusVaccineDate ? now - new Date(profile.tetanusVaccineDate).getTime() : Infinity;
  const hepBAge = profile.hepatitisBVaccineDate ? now - new Date(profile.hepatitisBVaccineDate).getTime() : Infinity;
  const ppeAge = profile.ppeCertificationDate ? now - new Date(profile.ppeCertificationDate).getTime() : Infinity;

  if (tetanusAge > threeYearsMs) deficiencies.push("Tetanus toxoid booster expired (> 3 years)");
  if (hepBAge > 5 * oneYearMs) deficiencies.push("Hepatitis B immunization renewal required (> 5 years)");
  if (ppeAge > oneYearMs) deficiencies.push("Mandatory annual PPE & hazard protocol refresher expired");

  const isEligible = deficiencies.length === 0;
  const passId = isEligible ? "PASS-ELIGIBLE-" + crypto.randomUUID().slice(0, 6).toUpperCase() : "PASS-BLOCKED-RENEWAL";

  return {
    workerId: profile.workerId,
    workerName: profile.workerName,
    track: profile.track,
    isEligible,
    passId,
    deficiencies,
    safetyStatus: isEligible ? "VERIFIED_SAFE_FOR_SHIFT" : "RESTRICTED_RENEWAL_REQUIRED",
    records: {
      tetanusVaccineDate: profile.tetanusVaccineDate,
      hepatitisBVaccineDate: profile.hepatitisBVaccineDate,
      ppeCertificationDate: profile.ppeCertificationDate,
      lastHealthCheckupDate: profile.lastHealthCheckupDate
    }
  };
}

export function getWorkerProfiles() {
  return loadJson("workerCertifications.json", []);
}
