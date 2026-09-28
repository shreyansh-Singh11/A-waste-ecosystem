import test from "node:test";
import assert from "node:assert/strict";
import * as auctionEngine from "../smartAutomation/auctionEngine.mjs";

test("Auction Phase 2 — Full Lifecycle: Grade → Harvest → Lot → Bid → Close → Settle", () => {
  // 1. Grade a device — Grade A (fully functional)
  const gradeA = auctionEngine.gradeDevice({
    itemId: "ITEM-TEST-AUCTION-01",
    screenCondition: "Good",
    casingCondition: "Good",
    batteryState: "Normal",
    bootsReliably: true,
    category: "Laptop",
    model: "Dell Latitude 5420",
  });
  assert.equal(gradeA.grade, "A");
  assert.equal(gradeA.liIonHazard, false);
  assert.equal(gradeA.quarantineTag, null);

  // 2. Grade a device — Grade C with Li-Ion hazard (bloated battery)
  const gradeC = auctionEngine.gradeDevice({
    itemId: "ITEM-TEST-AUCTION-02",
    screenCondition: "Good",
    casingCondition: "Good",
    batteryState: "Bloated",
    bootsReliably: true,
    category: "Smartphone",
  });
  assert.equal(gradeC.grade, "C");
  assert.equal(gradeC.liIonHazard, true);
  assert.ok(gradeC.quarantineTag, "Bloated battery must get quarantine tag");

  // 3. Grade B — functional but cosmetic issues
  const gradeB = auctionEngine.gradeDevice({
    itemId: "ITEM-TEST-AUCTION-03",
    screenCondition: "Cracked",
    casingCondition: "Good",
    batteryState: "Normal",
    bootsReliably: true,
    category: "Smartphone",
  });
  assert.equal(gradeB.grade, "B");

  // 4. Calculate harvest value for a laptop
  const harvest = auctionEngine.calculateHarvestValue({
    category: "Laptop",
    model: "Dell Latitude 5420",
    weightKg: 2.1,
  });
  assert.ok(harvest.components.length > 0, "Should have recoverable components");
  assert.ok(harvest.totalRecoverableValue > 0, "Total value should be positive");
  assert.ok(harvest.harvestViable, "Laptop should be harvest-viable");

  // 5. Create auction lot
  const lot = auctionEngine.createAuctionLot({
    sellerId: "KABADIWALA-TEST-01",
    items: [
      { itemId: "ITEM-TEST-AUCTION-01", category: "Laptop", weightKg: 2.1 },
      { itemId: "ITEM-TEST-AUCTION-03", category: "Smartphone", weightKg: 0.2 },
    ],
    reservePrice: 500,
  });
  assert.ok(lot.lotId, "Lot ID should be generated");
  assert.equal(lot.status, "OPEN");
  assert.ok(Math.abs(lot.totalWeightKg - 2.3) < 0.001, "totalWeightKg ≈ 2.3");
  assert.ok(lot.endsAt, "Auction end time must be set");
  assert.ok(lot.indicativePriceBand.low > 0, "Price band should be calculated");

  // 6. Place bids from two recyclers
  const bid1 = auctionEngine.placeBid({
    lotId: lot.lotId,
    bidderId: "RECYCLER-TEST-A",
    bidPricePerKg: 50,
  });
  assert.ok(bid1.bidId, "Bid ID should be generated");
  assert.equal(bid1.totalBids, 1);

  const bid2 = auctionEngine.placeBid({
    lotId: lot.lotId,
    bidderId: "RECYCLER-TEST-B",
    bidPricePerKg: 75, // higher bid — should become leading
  });
  assert.equal(bid2.totalBids, 2);
  assert.ok(bid2.currentLeadingBid >= 75 * 2.3, "Leading bid should reflect higher bidder");

  // 7. Close auction — highest bidder wins
  const closed = auctionEngine.closeAuction({ lotId: lot.lotId });
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.winnerId, "RECYCLER-TEST-B");
  assert.ok(closed.finalPrice > 0, "Final price should be positive");
  assert.equal(closed.escrowLocked, true);

  // 8. Settle payment via UPI
  const settlement = auctionEngine.settlePayment({
    lotId: lot.lotId,
    verifiedWeightKg: 2.25, // weighbridge-verified (slightly less than declared)
    upiVpa: "kabadiwala-test@upi",
  });
  assert.ok(settlement.settlementId, "Settlement ID should be generated");
  assert.equal(settlement.status, "SETTLED");
  assert.equal(settlement.payoutAmount, Math.round(75 * 2.25 * 100) / 100);
  assert.equal(settlement.upiVpa, "kabadiwala-test@upi");

  // 9. Audit trail must capture all steps
  const trail = auctionEngine.getAuctionAuditTrail({ lotId: lot.lotId });
  assert.ok(trail.length >= 4, "Audit should capture lot creation, bids, close, settlement");
});
