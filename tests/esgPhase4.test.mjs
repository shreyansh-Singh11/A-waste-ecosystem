import test from "node:test";
import assert from "node:assert/strict";
import * as esgEngine from "../smartAutomation/esgEngine.mjs";

test("Phase 4 — ESG Engine: Multi-Track Carbon Offsets, VCC Minting, Corporate ESG Marketplace, and Contractor Settlement", () => {
  // 1. Calculate Multi-Track Carbon Offsets
  const offsets = esgEngine.calculateMultiTrackCarbonOffsets();
  assert.ok(offsets.streams, "Should calculate stream breakdowns");
  assert.ok(offsets.streams.municipalOrganic, "Should include municipal organic");
  assert.ok(offsets.streams.municipalDry, "Should include municipal dry");
  assert.ok(offsets.streams.medicalBMW, "Should include medical BMW");
  assert.ok(offsets.streams.ewasteCircular, "Should include e-waste circular");
  assert.ok(offsets.totals.totalKgCo2e >= 0, "Total CO2e must be non-negative");
  assert.ok(offsets.totals.totalMetricTonnes >= 0, "Metric tonnes must be non-negative");

  // 2. Mint Verified Carbon Credits (VCC)
  const minted = esgEngine.mintCarbonCredits({
    count: 3,
    vintageYear: "2026",
    pricePerCreditINR: 1800,
    note: "Test Minting for Automated Verification"
  });
  assert.equal(minted.mintedCount, 3);
  assert.equal(minted.credits.length, 3);
  assert.equal(minted.credits[0].status, "AVAILABLE");
  assert.ok(minted.credits[0].serialNumber.startsWith("VCC-2026-MP-"));
  assert.ok(minted.credits[0].verificationHash, "Must have cryptographic SHA-256 hash");

  // 3. Query Registry
  const allCredits = esgEngine.getCarbonCredits();
  assert.ok(allCredits.length >= 3, "Registry must contain at least 3 credits");

  // 4. Corporate ESG Purchase & Retirement
  const creditToBuy = minted.credits[0];
  const purchase = esgEngine.purchaseCarbonCredits({
    creditIds: [creditToBuy.creditId],
    buyerCorp: "Tata Consultancy Services (TCS) ESG Division",
    buyerGst: "23AABCT1332L1Z5",
    contactEmail: "esg-reporting@tcs-demo.com"
  });
  assert.ok(purchase.certificateId.startsWith("ESG-CERT-"));
  assert.equal(purchase.creditsCount, 1);
  assert.equal(purchase.totalAmountINR, 1800);
  assert.equal(purchase.buyerCorp, "Tata Consultancy Services (TCS) ESG Division");
  assert.ok(purchase.verificationHash, "Must issue tamper-proof certificate verification hash");

  // 5. Double-purchase prevention
  assert.throws(() => {
    esgEngine.purchaseCarbonCredits({
      creditIds: [creditToBuy.creditId],
      buyerCorp: "Infosys Net-Zero Program"
    });
  }, /already RETIRED/);

  // 6. Query Carbon Transactions
  const txns = esgEngine.getCarbonTransactions();
  assert.ok(txns.length >= 1, "Must capture corporate purchase transaction");

  // 7. Calculate Concessionaire Pay-for-Processing Settlement
  const settlementCalc = esgEngine.calculateContractorSettlement({
    contractorId: "CONCESSIONAIRE-TEST-CENTRAL",
    monthYear: "2026-09",
    baseRatePerPickup: 35,
    bonusPerSegregatedTon: 450,
    penaltyPerExcessLandfillTon: 900
  });
  assert.equal(settlementCalc.contractorId, "CONCESSIONAIRE-TEST-CENTRAL");
  assert.equal(typeof settlementCalc.financialBreakdown.baseEarningsINR, "number");
  assert.equal(typeof settlementCalc.financialBreakdown.netPayoutINR, "number");
  assert.ok(settlementCalc.financialBreakdown.netPayoutINR >= 0, "Payout cannot be negative");

  // 8. Settle Contractor Invoice & Issue Voucher
  const voucher = esgEngine.settleContractorInvoice({
    contractorId: "CONCESSIONAIRE-TEST-CENTRAL",
    monthYear: "2026-09",
    paymentRef: "NEFT-TEST-998877"
  });
  assert.ok(voucher.voucherId.startsWith("VOUCH-SWM-"));
  assert.equal(voucher.status, "SETTLED");
  assert.equal(voucher.paymentRef, "NEFT-TEST-998877");

  // 9. Query Contractor Settlements
  const settlements = esgEngine.getContractorSettlements();
  assert.ok(settlements.length >= 1, "Must contain at least 1 settled voucher");

  // 10. Consolidated ESG Summary
  const summary = esgEngine.getEsgSummary();
  assert.ok(summary.offsets, "Must have offsets breakdown");
  assert.ok(summary.marketplace.totalCreditsMinted >= 3, "Must reflect minted credits");
  assert.ok(summary.marketplace.totalCarbonRevenueINR >= 1800, "Must capture carbon revenue");
  assert.ok(summary.contractorSettlements.totalContractorPayoutsINR >= 0, "Must reflect contractor payouts");
});
