import test from "node:test";
import assert from "node:assert/strict";
import * as edgeEngine from "../smartAutomation/edgeOperationsEngine.mjs";

test("Phase 7 — Edge AI Vision Inspector, Snake Route Optimizer, HAZMAT Emergency & Offline Sync", async (t) => {
  // 1. AI Vision Conveyor/Hopper Contamination Inspection (SSQI)
  const wetScan = edgeEngine.inspectWasteFeed({
    stream: "MUNICIPAL_WET",
    sampleWeightKg: 300,
    facilityId: "MRF-BHOPAL-CENTRAL",
    vehicleId: "MP-04-HE-8821"
  });

  assert.ok(wetScan.scanId.startsWith("VISION-SCAN-"), "Should generate serialized scanId");
  assert.equal(wetScan.sampleWeightKg, 300);
  assert.ok(wetScan.metrics.ssqiScore >= 0 && wetScan.metrics.ssqiScore <= 100, "SSQI score must be in [0, 100]");
  assert.ok(wetScan.metrics.qualityGrade, "Quality grade assigned");
  assert.ok(wetScan.detectedForeignItems.length > 0, "Identifies foreign contamination items");
  assert.ok(wetScan.confidenceScorePct >= 90);

  const dryScan = edgeEngine.inspectWasteFeed({
    stream: "MUNICIPAL_DRY",
    sampleWeightKg: 180,
    facilityId: "MRF-BHOPAL-CENTRAL"
  });
  assert.equal(dryScan.stream, "MUNICIPAL_DRY");

  const recentScans = edgeEngine.getRecentVisionScans({ limit: 10 });
  assert.ok(recentScans.length >= 2);

  // 2. Smart "Snake" Serpentine Route Optimizer
  const snakeRoute = edgeEngine.generateSnakeRoute({
    wardId: "Ward 12 (Arera Colony)",
    vehicleId: "MP-04-HE-3301",
    totalHouses: 500
  });

  assert.ok(snakeRoute.routeId.startsWith("SNAKE-RT-"), "Generates SNAKE-RT id");
  assert.equal(snakeRoute.zeroSkippedStreetGuarantee, true);
  assert.ok(snakeRoute.waypoints.length >= 6, "Must generate sequence of waypoints");
  assert.equal(snakeRoute.waypoints[0].type, "START_DEPOT");
  assert.equal(snakeRoute.waypoints[snakeRoute.waypoints.length - 1].type, "UNLOAD_DESTINATION");

  // Environmental metrics verification
  assert.ok(snakeRoute.telemetryMetrics.distanceSavedKm > 0, "Computes distance saved");
  assert.ok(snakeRoute.telemetryMetrics.dieselSavedLiters > 0, "Computes diesel saved");
  assert.ok(snakeRoute.telemetryMetrics.co2AvoidedKg > 0, "Computes CO2 avoided");
  assert.equal(snakeRoute.telemetryMetrics.fuelEfficiencyGainPct, 31.0);

  const allRoutes = edgeEngine.getActiveSnakeRoutes();
  assert.ok(allRoutes.length >= 1);

  // 3. Emergency HAZMAT Incident & Disaster Response Protocol
  const hazmat = edgeEngine.triggerHazmatAlert({
    incidentType: "BATTERY_THERMAL_RUNAWAY",
    severity: "LEVEL_2_ELEVATED",
    reporterId: "INSP-HAZMAT-DUTY",
    description: "Swollen Li-Ion battery pack thermal inflation"
  });

  assert.ok(hazmat.incidentId.startsWith("HAZMAT-INCIDENT-"));
  assert.equal(hazmat.status, "ACTIVE_CONTAINMENT");
  assert.ok(hazmat.perimeterLockCode.startsWith("HAZMAT-LOCK-RADIUS-"));
  assert.ok(hazmat.sopActions.length >= 3, "Tailored SOP safety checklist generated");
  assert.equal(hazmat.multiChannelBroadcast.fireDepartmentNotified, true);
  assert.equal(hazmat.multiChannelBroadcast.spcbEmergencyDutyNotified, true);

  // Resolve Incident
  const resolved = edgeEngine.resolveHazmatAlert({
    incidentId: hazmat.incidentId,
    clearedBy: "CHIEF-DISASTER-OFFICER",
    containmentNotes: "Unit submerged in Pyro-Gel vermiculite tank and isolated"
  });

  assert.equal(resolved.status, "RESOLVED");
  assert.ok(resolved.resolvedAt);

  const incidents = edgeEngine.getActiveHazmatIncidents();
  assert.ok(incidents.length >= 1);

  // 4. Offline-First Field Worker Queue & Sync Engine
  const offlineTx = edgeEngine.queueOfflineTransaction({
    workerId: "WRK-FIELD-OFFLINE-01",
    actionType: "OFFLINE_PICKUP_SCAN",
    payload: {
      householdId: "HH-SHAH-201",
      weightKg: 6.2,
      segregated: true
    },
    offlineTimestamp: "2026-09-25T16:00:00.000Z"
  });

  assert.ok(offlineTx.entryId.startsWith("OFFLINE-TX-"));
  assert.equal(offlineTx.status, "PENDING_SYNC");
  assert.ok(offlineTx.clientHash.length === 64, "Calculates SHA-256 clientHash");

  const queuePreSync = edgeEngine.getOfflineQueueStatus("WRK-FIELD-OFFLINE-01");
  assert.ok(queuePreSync.pendingSync >= 1);

  // Sync to Cloud
  const syncReceipt = edgeEngine.syncOfflineQueue({ workerId: "WRK-FIELD-OFFLINE-01" });
  assert.ok(syncReceipt.syncedTransactionsCount >= 1);
  assert.equal(syncReceipt.syncIntegrityStatus, "CRYPTOGRAPHICALLY_VERIFIED_CHECKSUM_OK");

  const queuePostSync = edgeEngine.getOfflineQueueStatus("WRK-FIELD-OFFLINE-01");
  assert.equal(queuePostSync.pendingSync, 0);
  assert.ok(queuePostSync.synchronized >= 1);
});
