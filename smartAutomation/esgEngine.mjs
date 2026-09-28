/*
  ============================================================
  ESG, CARBON CREDIT MARKETPLACE & CONTRACTOR SETTLEMENT ENGINE
  (Phase 4)
  ============================================================
  Synthesizes multi-track greenhouse gas (GHG) reductions across
  Municipal, Medical, and E-Waste streams to mint tradeable
  Verified Carbon Credits (VCCs), manage corporate ESG offsets,
  and enforce performance-linked "Pay-for-Processing" contractor
  tipping fee settlements.

  Data files:
    data/carbonCredits.json       — Minted Verified Carbon Credits (VCC)
    data/carbonTransactions.json  — Corporate ESG purchase and retirement certificates
    data/contractorSettlements.json — Concessionaire Pay-for-Processing vouchers
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function loadJson(file, fallback) {
  const fp = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return fallback;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}
function saveJson(file, data) {
  const fp = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

// ============================================================
// 1. MULTI-TRACK GHG OFFSET & CARBON VALUATION
// ============================================================
// Standard IPCC / CPCB Emission Avoidance Coefficients:
// - Municipal Organic Waste: 0.85 kg CO2e / kg wet waste diverted to compost/biogas (methane avoidance)
// - Municipal Dry Recyclables: 1.35 kg CO2e / kg sorted plastics/paper (virgin raw material avoidance)
// - Medical Waste: 1.10 kg CO2e / kg autoclaved & recycled polymers
// - E-Waste Precious Metals & Reuse: 3.20 kg CO2e / kg recovered metals (avoided virgin mining)

export function calculateMultiTrackCarbonOffsets() {
  const compost = loadJson("compostOfftake.json", []);
  const mrfInv = loadJson("municipalMrfInventory.json", []);
  const medManifests = loadJson("medicalManifests.json", []);
  const auctionSettlements = loadJson("auctionSettlements.json", []);
  const deviceGrades = loadJson("deviceGrades.json", []);

  // 1. Municipal Organic (Compost + Biogas)
  const totalOrganicKg = compost.reduce((sum, c) => sum + (c.inputWeightKg || c.outputKg || 0), 0);
  const organicCo2eKg = Math.round(totalOrganicKg * 0.85 * 100) / 100;

  // 2. Municipal Dry Recyclables Sorted at MRF
  const totalSortedKg = mrfInv.reduce((sum, b) => sum + (b.totalSortedKg || 0), 0);
  const dryRecycledCo2eKg = Math.round(totalSortedKg * 1.35 * 100) / 100;

  // 3. Bio-Medical Waste Autoclaved & Disinfected
  const treatedMedKg = medManifests
    .filter(m => m.status === "TREATED" || m.status === "CERTIFIED")
    .reduce((sum, m) => sum + (m.weightKg || 0), 0);
  const medicalCo2eKg = Math.round(treatedMedKg * 1.10 * 100) / 100;

  // 4. E-Waste Metals Salvage & Re-use
  const settledWeightKg = auctionSettlements.reduce((sum, s) => sum + (s.verifiedWeightKg || 0), 0);
  const ewasteCo2eKg = Math.round((settledWeightKg > 0 ? settledWeightKg : deviceGrades.length * 1.5) * 3.20 * 100) / 100;

  const totalKgCo2e = Math.round((organicCo2eKg + dryRecycledCo2eKg + medicalCo2eKg + ewasteCo2eKg) * 100) / 100;
  const totalMetricTonnes = Math.round((totalKgCo2e / 1000) * 1000) / 1000;

  // 1 Carbon Credit = 1 Metric Tonne of CO2e avoided
  const mintableCredits = Math.floor(totalMetricTonnes);

  return {
    streams: {
      municipalOrganic: {
        totalKg: totalOrganicKg,
        co2eKg: organicCo2eKg,
        factor: "0.85 kg CO2e / kg (Methane Landfill Avoidance)"
      },
      municipalDry: {
        totalKg: totalSortedKg,
        co2eKg: dryRecycledCo2eKg,
        factor: "1.35 kg CO2e / kg (Virgin Resin & Pulp Substitution)"
      },
      medicalBMW: {
        totalKg: treatedMedKg,
        co2eKg: medicalCo2eKg,
        factor: "1.10 kg CO2e / kg (Sterilized Polymer Recovery)"
      },
      ewasteCircular: {
        totalKg: settledWeightKg || deviceGrades.length * 1.5,
        co2eKg: ewasteCo2eKg,
        factor: "3.20 kg CO2e / kg (Avoided Virgin Ore Smelting)"
      }
    },
    totals: {
      totalKgCo2e,
      totalMetricTonnes,
      mintableCredits,
      estimatedMarketValueINR: mintableCredits * 1500 // standard baseline ₹1,500/credit
    }
  };
}

// ============================================================
// 2. VERIFIED CARBON CREDIT (VCC) MINTING REGISTRY
// ============================================================

export function mintCarbonCredits({ count, vintageYear = "2026", standard = "Verra / Gold Standard Aligned", pricePerCreditINR = 1500, note = "Decentralized Tri-Track Municipal & Industrial Waste Offsets" }) {
  const offsets = calculateMultiTrackCarbonOffsets();
  const existingCredits = loadJson("carbonCredits.json", []);

  const availableToMint = Math.max(1, count || (offsets.totals.mintableCredits - existingCredits.length));
  const newCredits = [];

  for (let i = 0; i < availableToMint; i++) {
    const serialNumber = `VCC-${vintageYear}-MP-${String(existingCredits.length + i + 1).padStart(5, "0")}`;
    const hashData = `${serialNumber}|${vintageYear}|${standard}|${pricePerCreditINR}|${Date.now()}`;
    const verificationHash = crypto.createHash("sha256").update(hashData).digest("hex");

    newCredits.push({
      creditId: crypto.randomUUID(),
      serialNumber,
      vintageYear,
      standard,
      pricePerCreditINR,
      status: "AVAILABLE", // AVAILABLE | RETIRED
      mintedAt: new Date().toISOString(),
      verificationHash,
      metadata: {
        co2eTonnes: 1.0,
        projectRegion: "Madhya Pradesh, India",
        note
      }
    });
  }

  const all = [...existingCredits, ...newCredits];
  saveJson("carbonCredits.json", all);
  return { mintedCount: newCredits.length, credits: newCredits };
}

export function getCarbonCredits() {
  return loadJson("carbonCredits.json", []);
}

// ============================================================
// 3. CORPORATE ESG OFFSET PURCHASE & RETIREMENT MARKETPLACE
// ============================================================

export function purchaseCarbonCredits({ creditIds, buyerCorp, buyerGst, contactEmail }) {
  if (!buyerCorp) throw new Error("buyerCorp is required for ESG certificate issuance");
  if (!Array.isArray(creditIds) || creditIds.length === 0) {
    throw new Error("creditIds array is required");
  }

  const allCredits = loadJson("carbonCredits.json", []);
  const transactions = loadJson("carbonTransactions.json", []);

  const purchased = [];
  let totalAmountINR = 0;

  for (const id of creditIds) {
    const cred = allCredits.find(c => c.creditId === id);
    if (!cred) throw new Error(`Credit ${id} not found in registry`);
    if (cred.status !== "AVAILABLE") {
      throw new Error(`Credit ${cred.serialNumber} is already ${cred.status}`);
    }
    cred.status = "RETIRED";
    cred.retiredTo = buyerCorp;
    cred.retiredAt = new Date().toISOString();
    purchased.push(cred);
    totalAmountINR += (cred.pricePerCreditINR || 1500);
  }

  const certificateId = `ESG-CERT-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const certificateHash = crypto.createHash("sha256")
    .update(`${certificateId}|${buyerCorp}|${buyerGst || "N/A"}|${purchased.map(c => c.serialNumber).join(",")}`)
    .digest("hex");

  const txnRecord = {
    certificateId,
    buyerCorp,
    buyerGst: buyerGst || "UNREGISTERED",
    contactEmail: contactEmail || null,
    creditsCount: purchased.length,
    creditSerialNumbers: purchased.map(c => c.serialNumber),
    totalAmountINR,
    currency: "INR",
    verificationHash: certificateHash,
    status: "CONFIRMED",
    issuedAt: new Date().toISOString()
  };

  transactions.push(txnRecord);
  saveJson("carbonCredits.json", allCredits);
  saveJson("carbonTransactions.json", transactions);

  return txnRecord;
}

export function getCarbonTransactions() {
  return loadJson("carbonTransactions.json", []);
}

// ============================================================
// 4. PERFORMANCE-LINKED "PAY-FOR-PROCESSING" CONTRACTOR SETTLEMENT
// ============================================================
// Concessionaire Payout Model:
// - Base Collection Fee: ₹30 per doorstep household pickup serviced
// - Source Segregation Bonus: ₹400 / Tonne if ward segregation rate >= 80%
// - Landfill Penalty: ₹800 / Tonne for any residual landfill dumping exceeding 15% threshold

export function calculateContractorSettlement({
  contractorId = "CONCESSIONAIRE-MP-CENTRAL",
  monthYear = "2026-09",
  baseRatePerPickup = 30,
  bonusPerSegregatedTon = 400,
  penaltyPerExcessLandfillTon = 800
} = {}) {
  const shifts = loadJson("municipalShifts.json", []);
  const trips = loadJson("municipalTrips.json", []);

  // Pickups under this contractor's shifts
  let totalPickups = 0;
  let segregatedPickups = 0;
  let totalPickupWeightKg = 0;

  for (const s of shifts) {
    if (s.pickups && Array.isArray(s.pickups)) {
      for (const p of s.pickups) {
        totalPickups++;
        totalPickupWeightKg += (p.weightKg || 0);
        if (p.segregationStatus && p.segregationStatus.startsWith("SEGREGATED")) {
          segregatedPickups++;
        }
      }
    }
  }

  const segregationRatePct = totalPickups > 0 ? Math.round((segregatedPickups / totalPickups) * 100) : 0;
  const segregatedTons = (totalPickupWeightKg * (segregationRatePct / 100)) / 1000;

  // Weighbridge & Landfill Gatepass audit
  let totalDeliveredWeightKg = 0;
  let excessLandfillTons = 0;

  for (const t of trips) {
    if (t.netWeightKg) totalDeliveredWeightKg += t.netWeightKg;
    if (t.gatePass && t.gatePass.residualWeightKg) {
      const residualPct = (t.gatePass.residualWeightKg / (t.netWeightKg || 1000)) * 100;
      if (residualPct > 15) {
        const excessKg = t.gatePass.residualWeightKg - ((t.netWeightKg || 1000) * 0.15);
        if (excessKg > 0) excessLandfillTons += (excessKg / 1000);
      }
    }
  }

  // Financial Computations
  const baseEarningsINR = totalPickups * baseRatePerPickup;
  const isBonusEligible = segregationRatePct >= 80;
  const segregationBonusINR = isBonusEligible ? Math.round(segregatedTons * bonusPerSegregatedTon) : 0;
  const landfillPenaltyINR = Math.round(excessLandfillTons * penaltyPerExcessLandfillTon);

  const netPayoutINR = Math.max(0, baseEarningsINR + segregationBonusINR - landfillPenaltyINR);

  return {
    contractorId,
    monthYear,
    metrics: {
      totalPickups,
      segregatedPickups,
      segregationRatePct,
      totalPickupWeightKg,
      totalDeliveredWeightKg,
      excessLandfillTons: Math.round(excessLandfillTons * 100) / 100
    },
    financialBreakdown: {
      baseRatePerPickup,
      baseEarningsINR,
      isBonusEligible,
      bonusPerSegregatedTon,
      segregationBonusINR,
      penaltyPerExcessLandfillTon,
      landfillPenaltyINR,
      netPayoutINR
    },
    status: "DRAFT_CALCULATED"
  };
}

export function settleContractorInvoice({
  contractorId = "CONCESSIONAIRE-MP-CENTRAL",
  monthYear = "2026-09",
  baseRatePerPickup,
  bonusPerSegregatedTon,
  penaltyPerExcessLandfillTon,
  paymentRef
} = {}) {
  const calc = calculateContractorSettlement({
    contractorId,
    monthYear,
    baseRatePerPickup,
    bonusPerSegregatedTon,
    penaltyPerExcessLandfillTon
  });

  const settlements = loadJson("contractorSettlements.json", []);
  const voucherId = `VOUCH-SWM-${monthYear}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const voucher = {
    voucherId,
    contractorId: calc.contractorId,
    monthYear: calc.monthYear,
    metrics: calc.metrics,
    financialBreakdown: calc.financialBreakdown,
    netPayoutINR: calc.financialBreakdown.netPayoutINR,
    paymentRef: paymentRef || `NEFT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    status: "SETTLED",
    settledAt: new Date().toISOString()
  };

  settlements.push(voucher);
  saveJson("contractorSettlements.json", settlements);
  return voucher;
}

export function getContractorSettlements() {
  return loadJson("contractorSettlements.json", []);
}

// ============================================================
// 5. CONSOLIDATED ESG SUMMARY & METRICS
// ============================================================

export function getEsgSummary() {
  const offsets = calculateMultiTrackCarbonOffsets();
  const credits = loadJson("carbonCredits.json", []);
  const transactions = loadJson("carbonTransactions.json", []);
  const settlements = loadJson("contractorSettlements.json", []);

  const totalCreditsMinted = credits.length;
  const availableCredits = credits.filter(c => c.status === "AVAILABLE").length;
  const retiredCredits = credits.filter(c => c.status === "RETIRED").length;

  const totalCarbonRevenueINR = transactions.reduce((sum, t) => sum + (t.totalAmountINR || 0), 0);
  const totalContractorPayoutsINR = settlements.reduce((sum, s) => sum + (s.netPayoutINR || 0), 0);

  return {
    offsets,
    marketplace: {
      totalCreditsMinted,
      availableCredits,
      retiredCredits,
      totalCarbonRevenueINR,
      transactionCount: transactions.length
    },
    contractorSettlements: {
      totalSettlements: settlements.length,
      totalContractorPayoutsINR
    }
  };
}
