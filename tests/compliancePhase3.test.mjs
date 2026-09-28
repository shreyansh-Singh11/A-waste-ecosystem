import test from "node:test";
import assert from "node:assert/strict";
import * as compliance from "../smartAutomation/complianceEngine.mjs";

test("Phase 3 — Compliance Engine: Compost, User-Fee, Anomaly Scan, Swachh Score", () => {
  // 1. Record compost batch
  const compost = compliance.recordCompostBatch({
    facilityId: "MRF-TEST-CENTRAL",
    inputWeightKg: 500,
    outputKg: 150,
    outputType: "COMPOST",
    buyerId: "FARM-TEST-01",
  });
  assert.ok(compost.batchId, "Compost batch ID should be generated");
  assert.equal(compost.conversionRate, 30);
  assert.equal(compost.status, "SOLD");

  // 2. Record another batch without buyer
  const biogas = compliance.recordCompostBatch({
    facilityId: "MRF-TEST-CENTRAL",
    inputWeightKg: 300,
    outputKg: 80,
    outputType: "BIOGAS",
  });
  assert.equal(biogas.status, "PRODUCED");

  // 3. Query compost batches
  const batches = compliance.getCompostBatches();
  assert.ok(batches.length >= 2, "Should have at least 2 compost batches");

  // 4. Record user fee
  const testHhId = `HH-TEST-${Date.now()}`;
  const fee = compliance.recordUserFee({
    householdId: testHhId,
    amountINR: 100,
    monthYear: "2026-09",
    paymentMethod: "UPI",
  });
  assert.ok(fee.receiptId, "Receipt ID should be generated");
  assert.equal(fee.status, "PAID");
  assert.equal(fee.amountINR, 100);

  // 5. Duplicate fee should throw
  assert.throws(() => {
    compliance.recordUserFee({
      householdId: testHhId,
      amountINR: 100,
      monthYear: "2026-09",
    });
  }, /already paid/);

  // 6. Query user fee ledger
  const ledger = compliance.getUserFeeLedger();
  assert.ok(ledger.length >= 1, "Should have at least 1 fee record");

  // 7. Run anomaly scan (should return 0 new flags since our test data is clean)
  const scan = compliance.runAnomalyScan();
  assert.equal(typeof scan.totalOpen, "number");
  assert.equal(typeof scan.newFlags, "number");

  // 8. Compute Swachh Survekshan score
  const score = compliance.computeSwachhScore();
  assert.ok(score.totalScore >= 0, "Total score should be non-negative");
  assert.equal(score.maxScore, 4200);
  assert.equal(score.breakdown.length, 8, "Should have 8 indicators");
  assert.ok(score.percentage >= 0 && score.percentage <= 100, "Percentage should be 0-100");

  // 9. Cross-track summary
  const summary = compliance.getCrossTrackSummary();
  assert.ok(summary.municipal, "Should have municipal section");
  assert.ok(summary.medical, "Should have medical section");
  assert.ok(summary.ewaste, "Should have ewaste section");
  assert.ok(summary.anomalies, "Should have anomalies section");
  assert.ok(summary.municipal.totalCompostKg >= 230, "Compost total should include our test batches");
  assert.ok(summary.municipal.totalFeeRevenue >= 100, "Fee revenue should include our test payment");

  // 10. Anomaly resolution & query
  const allFlags = compliance.getAnomalyFlags();
  if (allFlags.length > 0) {
    const resolved = compliance.resolveAnomaly({
      flagId: allFlags[0].flagId,
      resolution: "Test resolution verified by officer",
    });
    assert.equal(resolved.status, "RESOLVED");
    assert.equal(resolved.resolution, "Test resolution verified by officer");
  }
  assert.throws(() => {
    compliance.resolveAnomaly({ flagId: "NON-EXISTENT-ID" });
  }, /not found/);

  // 11. Hazardous Risk Index (HRI) — Report 1 Worked Example
  const hriTest = compliance.calculateHRI({
    totalWasteWeightKg: 1000,
    divertedLeadKg: 0.50,
    divertedMercuryKg: 0.02,
    divertedCadmiumKg: 0.10
  });
  assert.equal(hriTest.basicHRI, 0.062);
  assert.equal(hriTest.gramsDivertedPer100Kg, 62);
  assert.equal(hriTest.weightedHRI, 0.12);
  assert.equal(hriTest.weights.wPb, 1);
  assert.equal(hriTest.weights.wHg, 10);
  assert.equal(hriTest.weights.wCd, 5);

  // 12. Sanitation Worker Safety Package (Report 1, Section 4)
  const safety = compliance.getWorkerSafetyMetrics();
  assert.equal(safety.baselineStudy.musculoskeletalDisordersPct, 76.6);
  assert.equal(safety.baselineStudy.cutsAndSharpsInjuriesPct, 26.9);
  assert.equal(safety.baselineStudy.baselinePpeUsagePct, 3.9);
  assert.equal(safety.baselineStudy.lackingSafetyTrainingPct, 96.1);
  assert.ok(safety.platformEnforcedPackage.safetyChecklist.length >= 6);
});
