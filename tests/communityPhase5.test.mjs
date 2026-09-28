import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as communityEngine from "../smartAutomation/communityEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

test("Phase 5 — Citizen Whistleblower, AI Forecasting, Recyclables Exchange & Worker Safety Engine", async (t) => {
  const citizenId1 = "CITIZEN-TEST-" + Date.now();
  const citizenId2 = "CITIZEN-TEST-EMERG-" + Date.now();

  // 1. Citizen Whistleblower — Standard Municipal Dump Report
  const stdReport = communityEngine.reportOpenDump({
    citizenId: citizenId1,
    citizenName: "Priya Sharma",
    phone: "+91-98930-11223",
    ward: "Ward 12 (Arera Colony)",
    lat: 23.215,
    lng: 77.435,
    address: "Near E-4 Community Park",
    wasteCategory: "MUNICIPAL_MSW",
    estimatedVolumeKg: 200,
    isAnonymous: false,
    description: "Plastic packaging and unsegregated garbage pile"
  });

  assert.ok(stdReport.reportId.startsWith("DUMP-REP-"), "Should generate serialized DUMP-REP id");
  assert.equal(stdReport.status, "SUBMITTED");
  assert.equal(stdReport.slaHours, 24, "Municipal waste gets standard 24h SLA");
  assert.equal(stdReport.karmaPointsAwarded, 50, "Awards 50 base karma points");

  // 2. Citizen Whistleblower — Emergency Bio-Medical Dump Report (6h SLA)
  const emergReport = communityEngine.reportOpenDump({
    citizenId: citizenId2,
    citizenName: "Sunil Joshi",
    phone: "+91-98930-44556",
    ward: "Ward 07 (Bairagarh)",
    lat: 23.280,
    lng: 77.340,
    address: "Hospital perimeter drainage line",
    wasteCategory: "BIO_MEDICAL_HAZARD",
    estimatedVolumeKg: 60,
    isAnonymous: false,
    description: "Red bio-medical waste bags with used disposable kits"
  });

  assert.equal(emergReport.isEmergency, true, "Bio-medical is flagged as emergency");
  assert.equal(emergReport.slaHours, 6, "Hazardous waste gets strict 6h emergency SLA");

  // 3. Crew Dispatch
  const dispatched = communityEngine.dispatchCleanupCrew({
    reportId: stdReport.reportId,
    crewId: "CREW-ARERA-02",
    vehicleId: "MP-04-CL-5501",
    notes: "Deploying hydraulic loader"
  });

  assert.equal(dispatched.status, "DISPATCHED");
  assert.equal(dispatched.cleanupCrew.crewId, "CREW-ARERA-02");

  // 4. Verify & Close Dump with photo & weight
  const verified = communityEngine.verifyAndCloseDump({
    reportId: stdReport.reportId,
    afterPhotoUrl: "/assets/images/clean_arera.jpg",
    actualWeightClearedKg: 215,
    verifiedByOfficer: "INSP-ALOK-VERMA"
  });

  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.clearedWeightKg, 215);
  assert.equal(verified.isSlaBreached, false, "Cleaned within 24h SLA target");
  assert.equal(verified.karmaPointsAwarded, 100, "Citizen earns 50 bonus points for on-time verification");

  // 5. Query Dump Reports
  const allReports = communityEngine.getDumpReports();
  assert.ok(allReports.length >= 2, "Should return at least 2 reports");
  const filtered = communityEngine.getDumpReports({ ward: "Ward 12 (Arera Colony)" });
  assert.ok(filtered.some(r => r.reportId === stdReport.reportId));

  // 6. Citizen Karma Balance & User-Fee Rebate
  const karmaBal = communityEngine.getCitizenKarmaBalance(citizenId1);
  assert.equal(karmaBal.currentBalance, 100, "Should have 100 earned karma coins");
  assert.equal(karmaBal.rebateValueINR, 100.0, "1 coin = 1 INR discount");

  const rebate = communityEngine.redeemKarmaForUserFeeDiscount({
    citizenId: citizenId1,
    householdId: "HH-ARERA-102",
    pointsToRedeem: 50,
    monthYear: "2026-09"
  });
  assert.equal(rebate.status, "REBATE_APPLIED");
  assert.equal(rebate.discountAmountINR, 50);
  assert.equal(rebate.remainingBalance, 50);

  // 7. AI Facility Capacity Load Forecasting
  const mrfForecast = communityEngine.forecastFacilityLoad({
    facilityId: "MRF-BHOPAL-CENTRAL",
    forecastDays: 7
  });

  assert.equal(mrfForecast.facilityId, "MRF-BHOPAL-CENTRAL");
  assert.equal(mrfForecast.designCapacityKgPerDay, 25000);
  assert.equal(mrfForecast.forecastPeriodDays, 7);
  assert.equal(mrfForecast.dailyForecast.length, 7);
  assert.ok(mrfForecast.forecastSummary.totalProjectedKg > 100000, "7-day total should be > 100k kg");
  assert.ok(mrfForecast.forecastSummary.averageUtilizationPct > 50, "Average utilization should be realistic");
  assert.ok(mrfForecast.forecastSummary.aiRecommendation.length > 10, "Provides actionable AI recommendation");

  const allForecasts = communityEngine.getAllFacilitiesForecast(7);
  assert.equal(allForecasts.length, 4, "Forecasts for MRF, Compost, CBWTF, and E-Waste");

  // 8. B2B Recyclables Commodity Exchange (Listing & Ordering)
  const lot = communityEngine.listCommodityLot({
    facilityId: "MRF-BHOPAL-CENTRAL",
    materialCode: "HDPE_RIGID_REGRIND",
    purityGrade: "A",
    weightKg: 2000,
    pricePerKgINR: 46.0,
    location: "Bay 4 Regrind Staging"
  });

  assert.ok(lot.lotId.startsWith("COMMODITY-LOT-"));
  assert.equal(lot.availableWeightKg, 2000);
  assert.equal(lot.estimatedTotalValueINR, 92000);

  // Place B2B Purchase Order
  const po = communityEngine.placeCommodityOrder({
    lotId: lot.lotId,
    buyerOrg: "EcoPlast Polymeric Converters LLP",
    buyerGstin: "23AABCE5544L1Z2",
    buyerContact: "procurement@ecoplast.in",
    requestedWeightKg: 1000,
    offeredPricePerKg: 46.0
  });

  assert.ok(po.orderId.startsWith("B2B-PO-"));
  assert.ok(po.invoiceNo.startsWith("GST-INV-2026-"));
  assert.equal(po.weightPurchasedKg, 1000);
  assert.equal(po.financials.subtotalINR, 46000);
  assert.equal(po.financials.gstAmountINR, 8280, "18% GST = 8280");
  assert.equal(po.financials.totalAmountINR, 54280);
  assert.equal(po.financials.municipalRevenueINR, 46000);

  const market = communityEngine.getCommodityMarketplace();
  assert.ok(market.standardCommodities.length >= 5);
  assert.ok(market.lots.length >= 1);

  // 9. Worker Health & Shift Pass Safety Enforcement (Report 1 alignment)
  // Compliant worker
  const safeWorker = communityEngine.recordWorkerHealthProfile({
    workerId: "WRK-PASS-TEST-SAFE",
    workerName: "Vikram Rathore",
    track: "MUNICIPAL_SWM",
    tetanusVaccineDate: "2025-08-01",
    hepatitisBVaccineDate: "2024-05-10",
    ppeCertificationDate: "2026-01-15",
    lastHealthCheckupDate: "2026-07-01"
  });

  const safeCheck = communityEngine.validateWorkerShiftEligibility("WRK-PASS-TEST-SAFE");
  assert.equal(safeCheck.isEligible, true);
  assert.ok(safeCheck.passId.startsWith("PASS-ELIGIBLE-"));
  assert.equal(safeCheck.deficiencies.length, 0);

  // Non-compliant worker with expired vaccine
  const expiredWorker = communityEngine.recordWorkerHealthProfile({
    workerId: "WRK-PASS-TEST-EXP",
    workerName: "Mohan Lal",
    track: "BIO_MEDICAL",
    tetanusVaccineDate: "2020-01-01", // > 3 years expired
    hepatitisBVaccineDate: "2018-01-01", // > 5 years expired
    ppeCertificationDate: "2023-01-01", // > 1 year expired
    lastHealthCheckupDate: "2023-01-01"
  });

  const expCheck = communityEngine.validateWorkerShiftEligibility("WRK-PASS-TEST-EXP");
  assert.equal(expCheck.isEligible, false, "Must block worker with expired safety credentials");
  assert.equal(expCheck.passId, "PASS-BLOCKED-RENEWAL");
  assert.ok(expCheck.deficiencies.length >= 2, "Lists specific expired certifications");
});
