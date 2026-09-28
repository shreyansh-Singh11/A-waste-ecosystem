import test from "node:test";
import assert from "node:assert/strict";
import * as regulatoryEngine from "../smartAutomation/regulatoryEngine.mjs";

test("Phase 6 — CPCB/SPCB Statutory Returns, Merkle Audit Chain, Fleet Telemetry & DB Health", async (t) => {
  // 1. CPCB Form 3 (E-Waste Management Rules 2026)
  const form3 = regulatoryEngine.generateCpcbForm3();
  assert.ok(form3.formTitle.includes("FORM 3"), "Should be Form 3");
  assert.equal(form3.reportingYear, 2026);
  assert.ok(form3.productSchedules.length >= 4, "Should cover at least 4 product schedules");
  assert.ok(form3.aggregateMetrics.compliancePercentage >= 100, "Should satisfy compliance threshold");
  assert.ok(form3.materialRecoveryYields.reclaimedGoldGrams > 0, "Tracks gold yield");
  assert.ok(form3.digitalSignature.length === 64, "SHA-256 digital signature should be 64 hex characters");
  assert.ok(form3.verificationHash.length === 16, "Verification hash should be 16 chars");

  // 2. CPCB Form 4 (Bio-Medical Waste Management Rules 2016)
  const form4 = regulatoryEngine.generateCpcbForm4();
  assert.ok(form4.formTitle.includes("FORM 4"), "Should be Form 4");
  assert.ok(form4.streamWiseTreatmentSummaryKg.totalTreatedKg > 0);
  assert.ok(form4.streamWiseTreatmentSummaryKg.yellowIncinerationKg > 0);
  assert.ok(form4.streamWiseTreatmentSummaryKg.redAutoclaveShreddingKg > 0);
  assert.ok(form4.operatingParametersValidation.autoclaveTemperatureC.includes("121"), "Validates 121C autoclave standard");
  assert.equal(form4.chainOfCustodyAudit.complianceStatus, "CPCB_100_PERCENT_CERTIFIED");
  assert.ok(form4.digitalSignature.length === 64);

  // 3. CPCB Form 5 (Solid Waste Management Rules 2016)
  const form5 = regulatoryEngine.generateCpcbForm5();
  assert.ok(form5.formTitle.includes("FORM 5"), "Should be Form 5");
  assert.ok(form5.wasteGenerationAndProcessingTonsPerDay.landfillDiversionRatePct >= 85, "Diversion rate >= 85%");
  assert.ok(form5.swachhSurvekshanScorecardRef.starRatingGarbageFreeCity.includes("7-Star"));
  assert.ok(form5.digitalSignature.length === 64);

  // 4. Immutable Cryptographic Merkle Audit Chain
  const auditChain = regulatoryEngine.generateCryptographicAuditChain({ limit: 25 });
  assert.ok(auditChain.totalBlocks > 0, "Should generate audit blocks");
  assert.equal(auditChain.merkleRoot.length, 64, "Merkle root must be a 64-char SHA-256 hash");
  assert.ok(auditChain.chain.length > 0);
  
  // Verify block hash linkage
  for (let i = 1; i < auditChain.chain.length; i++) {
    assert.equal(
      auditChain.chain[i].prevHash,
      auditChain.chain[i - 1].hash,
      `Block ${i} prevHash must match Block ${i-1} hash`
    );
  }

  // 5. Cryptographic Integrity Verifier
  const verification = regulatoryEngine.verifyAuditIntegrity();
  assert.equal(verification.isValid, true, "Chain must be cryptographically valid");
  assert.equal(verification.status, "CRYPTOGRAPHICALLY_VERIFIED");
  assert.equal(verification.tamperResistantStatus, "IMMUTABLE_CHAIN_INTACT");

  // 6. Fleet Telemetry & Geofence Corridor Radar
  const fleet = regulatoryEngine.getFleetTelemetry();
  assert.ok(fleet.vehicles.length >= 4, "Should track at least 4 active fleet vehicles");
  assert.ok(fleet.vehicles.some(v => v.track === "MUNICIPAL_COMPACTOR"));
  assert.ok(fleet.vehicles.some(v => v.track === "BIO_MEDICAL_SECURE_VAN"));
  assert.ok(fleet.vehicles.every(v => v.geofenceStatus === "CORRIDOR_COMPLIANT"));

  // 7. Spatial Dumping Hotspot Density
  const hotspots = regulatoryEngine.getDumpingHotspots();
  assert.ok(hotspots.length >= 1, "Should identify at least 1 ward hotspot");
  assert.ok(hotspots[0].severityScore > 0);

  // 8. Database Health & Status
  const dbStatus = await regulatoryEngine.getDatabaseStatus();
  assert.ok(dbStatus.isHealthy, "Database status should be healthy");
  assert.ok(dbStatus.status === "CONNECTED_LIVE" || dbStatus.status === "LOCAL_FALLBACK_MODE");
});
