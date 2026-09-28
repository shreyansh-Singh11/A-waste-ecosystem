import test from "node:test";
import assert from "node:assert/strict";
import * as municipalEngine from "../smartAutomation/municipalEngine.mjs";
import * as medicalEngine from "../smartAutomation/medicalEngine.mjs";

test("Municipal Waste Engine - End to End Lifecycle", () => {
  // 1. Create shift
  const shift = municipalEngine.createShift({
    driverId: "MDRV-TEST-01",
    vehicleId: "MP-04-TEST-1234",
    wardId: "Ward-Test-Area",
  });
  assert.ok(shift.shiftId, "Shift ID should be generated");
  assert.equal(shift.status, "ACTIVE");

  // 2. Record pickup
  const pickup = municipalEngine.recordPickup({
    shiftId: shift.shiftId,
    householdId: "HH-TEST-001",
    weightKg: 5.5,
    segregationStatus: "SEGREGATED_WET_DRY",
    gpsLat: 23.2,
    gpsLng: 77.4,
  });
  assert.ok(pickup.pickupId, "Pickup ID should be generated");
  assert.equal(pickup.status, "COLLECTED");

  // 2b. Demo Household Anti-Cheat verification
  // Rejects when staff attempts to log demo household without scanning physical doorstep QR
  assert.throws(() => {
    municipalEngine.recordPickup({
      shiftId: shift.shiftId,
      householdId: "HH-15-101",
      weightKg: 4.2,
      householdQr: "FAKE-OR-MISSING-QR",
    });
  }, /Anti-Cheat Verification Failed/);

  // Succeeds when staff scans the assigned demo QR code
  const demoPickup = municipalEngine.recordPickup({
    shiftId: shift.shiftId,
    householdId: "HH-15-101",
    weightKg: 4.2,
    segregationStatus: "SEGREGATED_WET_DRY",
    householdQr: "MUNI-HH-WARD15-101-SECURE",
  });
  assert.equal(demoPickup.qrVerified, true);
  assert.equal(demoPickup.status, "COLLECTED");

  // 3. Lock trip to MRF facility
  const trip = municipalEngine.lockTrip({
    shiftId: shift.shiftId,
    destinationFacilityId: "MRF-TEST-CENTRAL",
  });
  assert.ok(trip.tripId, "Trip ID should be generated");
  assert.equal(trip.status, "IN_TRANSIT");

  // 4. Record weighbridge delivery
  const wb = municipalEngine.recordWeighbridge({
    tripId: trip.tripId,
    facilityId: "MRF-TEST-CENTRAL",
    grossWeightKg: 3000,
    tareWeightKg: 2000,
  });
  assert.equal(wb.netWeightKg, 1000);
  assert.equal(wb.status, "DELIVERED");

  // 5. Landfill Gate Pass - should reject if residual > 15%
  assert.throws(() => {
    municipalEngine.generateGatePass({
      tripId: trip.tripId,
      residualWeightKg: 250, // 250 / 1000 = 25% > 15% threshold
    });
  }, /Gate pass REJECTED/);

  // 6. Landfill Gate Pass - should accept if residual <= 15%
  const gp = municipalEngine.generateGatePass({
    tripId: trip.tripId,
    residualWeightKg: 100, // 100 / 1000 = 10% <= 15%
  });
  assert.ok(gp.gatePassId, "Gate pass should be generated");
  assert.equal(gp.status, "APPROVED");

  // 7. MRF sorting
  const sorting = municipalEngine.logMrfSorting({
    facilityId: "MRF-TEST-CENTRAL",
    materials: [
      { type: "PET_BOTTLES", weightKg: 200 },
      { type: "CARDBOARD", weightKg: 300 },
    ],
  });
  assert.equal(sorting.totalSortedKg, 500);

  // 8. Recycler marketplace order
  const order = municipalEngine.createRecyclerOrder({
    mrfId: "MRF-TEST-CENTRAL",
    materialType: "PET_BOTTLES",
    weightKg: 200,
    pricePerKg: 35,
    recyclerId: "RECYC-TEST-01",
  });
  assert.equal(order.totalPrice, 7000);
  assert.equal(order.status, "PENDING");

  // 9. Full chain of custody audit trail
  const trail = municipalEngine.getAuditTrail({ shiftId: shift.shiftId });
  assert.ok(trail.length >= 4, "Audit trail should capture all mutations");
});

test("Medical (BMW) Engine - End to End Lifecycle", () => {
  // 1. Create manifest
  const manifest = medicalEngine.createManifest({
    hospitalId: "HOSP-TEST-01",
    wasteType: "RED",
    colorCode: "Red (Recyclable Plastics)",
    weightKg: 25.0,
    qrTag: "QR-TEST-BMW-01",
  });
  assert.ok(manifest.batchCode, "Batch code generated");
  assert.equal(manifest.status, "COLLECTED");

  // 2. Assign transport
  const trn = medicalEngine.assignTransport({
    batchCode: manifest.batchCode,
    vehicleId: "MP-BMW-TEST-99",
    driverId: "DRV-BMW-TEST",
  });
  assert.ok(trn.transportId, "Transport ID generated");
  assert.equal(trn.status, "IN_TRANSIT");

  // 3. Facility arrival weighbridge
  const arr = medicalEngine.recordFacilityArrival({
    batchCode: manifest.batchCode,
    facilityId: "CBWTF-TEST",
    grossWeightKg: 2025,
    tareWeightKg: 2000,
  });
  assert.equal(arr.netWeightKg, 25);
  assert.equal(arr.status, "RECEIVED");

  // 4. Treatment verification
  const trt = medicalEngine.recordTreatment({
    batchCode: manifest.batchCode,
    facilityId: "CBWTF-TEST",
    method: "AUTOCLAVE",
    weightProcessedKg: 25,
    temperatureC: 121,
    pressureBar: 2.1,
    durationMinutes: 60,
  });
  assert.ok(trt.treatmentId, "Treatment ID generated");
  assert.equal(trt.status, "TREATED");

  // 5. Digital treatment certificate
  const cert = medicalEngine.issueCertificate({
    batchCode: manifest.batchCode,
    treatmentId: trt.treatmentId,
  });
  assert.ok(cert.certificateCode, "Certificate code generated");

  // 6. Staff training
  const training = medicalEngine.logStaffTraining({
    staffId: "STF-TEST-01",
    hospitalId: "HOSP-TEST-01",
    trainingType: "Hepatitis B Vaccination",
    completionDate: "2026-09-24",
    expiryDate: "2027-09-24",
  });
  assert.ok(training.trainingId, "Training ID generated");

  // 7. Audit trail
  const trail = medicalEngine.getAuditTrail({ batchCode: manifest.batchCode });
  assert.ok(trail.length >= 4, "Medical audit trail must track all steps");
});
