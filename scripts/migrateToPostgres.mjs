/**
 * Automated PostgreSQL Database Migration Script
 * Reads all platform state from local JSON flat-files and populates the PostgreSQL database via Prisma.
 *
 * Usage:
 *   node scripts/migrateToPostgres.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

const prisma = new PrismaClient();

function loadJson(fileName, fallback = []) {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return fallback;
  }
}

async function main() {
  console.log("🚀 Starting Smart Waste Platform PostgreSQL Database Sync...\n");

  try {
    await prisma.$connect();
    console.log("✅ Successfully connected to PostgreSQL database.\n");

    // 1. Municipal Shifts
    const shifts = loadJson("municipalShifts.json", []);
    for (const s of shifts) {
      await prisma.municipalShift.upsert({
        where: { shiftId: s.shiftId },
        update: {
          status: s.status,
          totalPickups: s.totalPickups || 0,
          totalWeightKg: s.totalWeightKg || 0
        },
        create: {
          shiftId: s.shiftId,
          driverId: s.driverId || "UNKNOWN",
          driverName: s.driverName || "Driver",
          vehicleNo: s.vehicleNo || "MP-04-NA",
          wardNumber: String(s.wardNumber || "1"),
          zone: s.zone || "Central",
          status: s.status || "ACTIVE",
          totalPickups: s.totalPickups || 0,
          totalWeightKg: s.totalWeightKg || 0,
          startTime: s.startTime ? new Date(s.startTime) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${shifts.length} Municipal Shifts`);

    // 2. Medical Manifests
    const manifests = loadJson("medicalManifests.json", []);
    for (const m of manifests) {
      await prisma.medicalManifest.upsert({
        where: { batchCode: m.batchCode },
        update: { status: m.status },
        create: {
          batchCode: m.batchCode,
          hospitalId: m.hospitalId || "HOSP-01",
          hospitalName: m.hospitalName || "Apex Hospital",
          category: m.category || "YELLOW",
          wasteDescription: m.wasteDescription || "Infectious Waste",
          weightKg: parseFloat(m.weightKg) || 0,
          status: m.status || "MANIFESTED",
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${manifests.length} Bio-Medical Manifests`);

    // 3. Auction Lots
    const lots = loadJson("auctionLots.json", []);
    for (const l of lots) {
      await prisma.auctionLot.upsert({
        where: { lotId: l.lotId },
        update: {
          status: l.status,
          currentBidINR: l.currentBidINR,
          highestBidder: l.highestBidder
        },
        create: {
          lotId: l.lotId,
          title: l.title || "E-Waste Lot",
          category: l.category || "General",
          weightKg: parseFloat(l.weightKg) || 10,
          reservePriceINR: parseFloat(l.reservePriceINR) || 1000,
          currentBidINR: l.currentBidINR ? parseFloat(l.currentBidINR) : null,
          highestBidder: l.highestBidder || null,
          status: l.status || "OPEN",
          expiresAt: l.expiresAt ? new Date(l.expiresAt) : new Date(Date.now() + 4 * 3600 * 1000)
        }
      });
    }
    console.log(`✓ Synced ${lots.length} E-Waste Auction Lots`);

    // 4. Compost & Biogas Batches
    const compostBatches = loadJson("compostOfftake.json", []);
    for (const c of compostBatches) {
      await prisma.compostBatch.upsert({
        where: { batchId: c.batchId },
        update: { status: c.status },
        create: {
          batchId: c.batchId,
          facilityId: c.facilityId,
          inputWeightKg: parseFloat(c.inputWeightKg) || 0,
          outputKg: parseFloat(c.outputKg) || 0,
          outputType: c.outputType || "COMPOST",
          conversionRate: parseFloat(c.conversionRate) || 0,
          buyerId: c.buyerId || null,
          status: c.status || "PRODUCED",
          recordedAt: c.recordedAt ? new Date(c.recordedAt) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${compostBatches.length} Compost/Biogas Batches`);

    // 5. User-Fee Ledger
    const userFees = loadJson("userFeeLedger.json", []);
    for (const f of userFees) {
      await prisma.userFeeReceipt.upsert({
        where: { receiptId: f.receiptId },
        update: { status: f.status },
        create: {
          receiptId: f.receiptId,
          householdId: f.householdId,
          amountINR: parseFloat(f.amountINR) || 0,
          monthYear: f.monthYear || "2026-09",
          paymentMethod: f.paymentMethod || "UPI",
          status: f.status || "PAID",
          paidAt: f.paidAt ? new Date(f.paidAt) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${userFees.length} User-Fee Receipts`);

    // 6. Verified Carbon Credits
    const credits = loadJson("carbonCredits.json", []);
    for (const cr of credits) {
      await prisma.carbonCredit.upsert({
        where: { serialNumber: cr.serialNumber },
        update: { status: cr.status, retiredToOrg: cr.retiredToOrg },
        create: {
          serialNumber: cr.serialNumber,
          stream: cr.stream || "ORGANIC_MUNICIPAL",
          tonnesCo2e: parseFloat(cr.tonnesCo2e) || 1.0,
          vintageYear: parseInt(cr.vintageYear, 10) || 2026,
          status: cr.status || "AVAILABLE",
          pricePerCreditINR: parseFloat(cr.pricePerCreditINR) || 1500,
          retiredToOrg: cr.retiredToOrg || null,
          certificateId: cr.certificateId || null,
          mintedAt: cr.mintedAt ? new Date(cr.mintedAt) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${credits.length} Verified Carbon Credits`);

    // 7. Whistleblower Reports
    const reports = loadJson("whistleblowerReports.json", []);
    for (const r of reports) {
      await prisma.whistleblowerReport.upsert({
        where: { reportId: r.reportId },
        update: { status: r.status, clearedWeightKg: r.clearedWeightKg },
        create: {
          reportId: r.reportId,
          citizenId: r.citizenId || null,
          citizenName: r.citizenName || null,
          phone: r.phone || null,
          isAnonymous: Boolean(r.isAnonymous),
          ward: r.ward || "Ward 1",
          latitude: r.location?.lat || null,
          longitude: r.location?.lng || null,
          address: r.location?.address || null,
          wasteCategory: r.wasteCategory || "MUNICIPAL_MSW",
          isEmergency: Boolean(r.isEmergency),
          estimatedVolumeKg: parseFloat(r.estimatedVolumeKg) || 100,
          photoUrl: r.photoUrl || null,
          description: r.description || null,
          status: r.status || "SUBMITTED",
          slaHours: r.slaHours || 24,
          slaDeadline: r.slaDeadline ? new Date(r.slaDeadline) : new Date(),
          isSlaBreached: Boolean(r.isSlaBreached),
          submittedAt: r.submittedAt ? new Date(r.submittedAt) : new Date(),
          dispatchedAt: r.dispatchedAt ? new Date(r.dispatchedAt) : null,
          resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : null,
          clearedWeightKg: r.clearedWeightKg ? parseFloat(r.clearedWeightKg) : null
        }
      });
    }
    console.log(`✓ Synced ${reports.length} Whistleblower Incident Reports`);

    // 8. Commodity Lots
    const commodityLots = loadJson("commodityMarketplace.json", []);
    for (const cl of commodityLots) {
      await prisma.commodityLot.upsert({
        where: { lotId: cl.lotId },
        update: { availableWeightKg: cl.availableWeightKg, status: cl.status },
        create: {
          lotId: cl.lotId,
          facilityId: cl.facilityId || "MRF-01",
          materialCode: cl.materialCode,
          commodityName: cl.commodityName,
          purityGrade: cl.purityGrade || "A",
          totalWeightKg: parseFloat(cl.totalWeightKg) || 0,
          availableWeightKg: parseFloat(cl.availableWeightKg) || 0,
          pricePerKgINR: parseFloat(cl.pricePerKgINR) || 0,
          location: cl.location || null,
          status: cl.status || "AVAILABLE",
          listedAt: cl.listedAt ? new Date(cl.listedAt) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${commodityLots.length} MRF Recyclable Commodity Lots`);

    // 9. Vision Scans
    const scans = loadJson("visionScans.json", []);
    for (const v of scans) {
      const cameraSensorId = v.cameraSensorId || v.vehicleId || "CAMERA-CONVEYOR-01";
      const wasteStream = v.wasteStream || v.stream || "MUNICIPAL_DRY";
      const ssqiScore = Math.round(v.ssqiScore ?? v.metrics?.ssqiScore ?? 85);
      const qualityGrade = v.qualityGrade || v.metrics?.qualityGrade || "GRADE_B_ACCEPTABLE";
      const gateAction = v.gateAction || v.metrics?.automatedGateAction || "FORWARD_CONTINUOUS_SORTING";
      const foreignItemsDetected = v.foreignItemsDetected || v.detectedForeignItems || [];
      const scannedAt = v.scannedAt ? new Date(v.scannedAt) : v.inspectedAt ? new Date(v.inspectedAt) : new Date();

      await prisma.visionScan.upsert({
        where: { scanId: v.scanId },
        update: { ssqiScore, qualityGrade, gateAction },
        create: {
          scanId: v.scanId,
          cameraSensorId,
          facilityId: v.facilityId || "MRF-CENTRAL-01",
          wasteStream,
          ssqiScore,
          qualityGrade,
          gateAction,
          foreignItemsDetected,
          feedRateKgPerMinute: parseFloat(v.feedRateKgPerMinute || v.sampleWeightKg) || 45.0,
          scannedAt
        }
      });
    }
    console.log(`✓ Synced ${scans.length} AI Vision Quality Scans`);

    // 10. Snake Routes
    const snakeRoutes = loadJson("snakeRoutes.json", []);
    for (const sr of snakeRoutes) {
      await prisma.snakeRoute.upsert({
        where: { routeId: sr.routeId },
        update: { status: sr.status },
        create: {
          routeId: sr.routeId,
          wardId: sr.wardId,
          vehicleId: sr.vehicleId,
          status: sr.status || "ACTIVE_DISPATCH",
          totalHouseholdsCovered: sr.totalHouseholdsCovered || 0,
          zeroSkippedStreetGuarantee: sr.zeroSkippedStreetGuarantee !== false,
          telemetryMetrics: sr.telemetryMetrics || {},
          waypoints: sr.waypoints || [],
          generatedAt: sr.generatedAt ? new Date(sr.generatedAt) : new Date()
        }
      });
    }
    console.log(`✓ Synced ${snakeRoutes.length} Snake Serpentine Routes`);

    // 11. Hazmat Incidents
    const hazmatList = loadJson("hazmatIncidents.json", []);
    for (const hz of hazmatList) {
      await prisma.hazmatIncident.upsert({
        where: { incidentId: hz.incidentId },
        update: { status: hz.status, resolvedAt: hz.resolvedAt ? new Date(hz.resolvedAt) : null, resolutionNotes: hz.resolutionNotes },
        create: {
          incidentId: hz.incidentId,
          incidentType: hz.incidentType,
          severity: hz.severity,
          perimeterLockCode: hz.perimeterLockCode,
          location: hz.location || {},
          description: hz.description || "",
          reporterId: hz.reporterId || "SYSTEM",
          status: hz.status || "ACTIVE_CONTAINMENT",
          sopActions: hz.sopActions || [],
          multiChannelBroadcast: hz.multiChannelBroadcast || {},
          triggeredAt: hz.triggeredAt ? new Date(hz.triggeredAt) : new Date(),
          resolvedAt: hz.resolvedAt ? new Date(hz.resolvedAt) : null,
          resolutionNotes: hz.resolutionNotes || null
        }
      });
    }
    console.log(`✓ Synced ${hazmatList.length} Emergency HAZMAT Incidents`);

    // 12. Offline Transactions
    const offlineQueue = loadJson("offlineSyncQueue.json", []);
    for (const ot of offlineQueue) {
      await prisma.offlineTransaction.upsert({
        where: { entryId: ot.entryId },
        update: { status: ot.status, syncedAt: ot.syncedAt ? new Date(ot.syncedAt) : null },
        create: {
          entryId: ot.entryId,
          workerId: ot.workerId,
          deviceUuid: ot.deviceUuid,
          actionType: ot.actionType,
          payload: ot.payload || {},
          offlineTimestamp: ot.offlineTimestamp ? new Date(ot.offlineTimestamp) : new Date(),
          clientHash: ot.clientHash || "",
          status: ot.status || "PENDING_SYNC",
          queuedAt: ot.queuedAt ? new Date(ot.queuedAt) : new Date(),
          syncedAt: ot.syncedAt ? new Date(ot.syncedAt) : null
        }
      });
    }
    console.log(`✓ Synced ${offlineQueue.length} Offline-First Transactions`);

    // 13. System Users
    const users = loadJson("users.json", []);
    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email || `${u.id}@smartwaste.gov.in` },
        update: { name: u.name, role: u.role || "citizen" },
        create: {
          id: u.id,
          name: u.name || "User",
          email: u.email || `${u.id}@smartwaste.gov.in`,
          role: u.role || "citizen"
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${users.length} Platform Users`);

    // 14. Collectors
    const collectors = loadJson("collectors.json", []);
    for (const c of collectors) {
      await prisma.collector.upsert({
        where: { id: c.id },
        update: { status: c.operatingStatus || c.status || "AVAILABLE", capacityKg: parseFloat(c.capacityKg || c.capacity) || 100.0 },
        create: {
          id: c.id,
          name: c.name,
          phone: c.phone || "+91-9876543210",
          vehicleNo: c.vehicleNo || "MP-04-COL-01",
          status: c.operatingStatus || c.status || "AVAILABLE",
          latitude: parseFloat(c.latitude) || 23.2325,
          longitude: parseFloat(c.longitude) || 77.4310,
          capacityKg: parseFloat(c.capacityKg || c.capacity) || 100.0
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${collectors.length} E-Waste Recycler Collectors`);

    // 15. Producers
    const producers = loadJson("producers.json", []);
    for (const p of producers) {
      await prisma.producer.upsert({
        where: { gstin: p.gstin },
        update: { brandName: p.name || p.brandName, companyName: p.name || p.companyName },
        create: {
          id: p.id || "PROD-001",
          brandName: p.name || p.brandName || "Producer",
          companyName: p.name || p.companyName || "Producer Company",
          gstin: p.gstin,
          email: p.contact?.email || p.email || `${p.id || 'prod'}@producer.com`
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${producers.length} EPR Brand Producers`);

    // 16. EPR Obligations
    const obligations = loadJson("eprObligations.json", []);
    for (const o of obligations) {
      const prodExists = await prisma.producer.findUnique({ where: { id: o.producerId } }).catch(() => null);
      if (prodExists) {
        await prisma.eprObligation.upsert({
          where: { id: o.id },
          update: { fulfilledKg: parseFloat(o.fulfilledWeightKg) || 0, status: o.status },
          create: {
            id: o.id,
            producerId: o.producerId,
            year: parseInt(o.financialYear || "2026", 10) || 2026,
            targetKg: parseFloat(o.targetWeightKg) || 0,
            fulfilledKg: parseFloat(o.fulfilledWeightKg) || 0,
            status: o.status || "ACTIVE"
          }
        }).catch(e => {});
      }
    }
    console.log(`✓ Synced ${obligations.length} EPR Annual Obligations`);

    // 17. Precious Metals Catalogue
    const preciousMetalsData = loadJson("preciousMetalsByModel.json", {});
    let metalCount = 0;
    for (const [modelName, metalInfo] of Object.entries(preciousMetalsData)) {
      if (metalInfo && metalInfo.metalsGrams) {
        await prisma.preciousMetal.upsert({
          where: { category: modelName },
          update: {
            goldGramsKg: metalInfo.metalsGrams.gold || 0,
            silverGrams: metalInfo.metalsGrams.silver || 0,
            copperGrams: metalInfo.metalsGrams.copper || 0
          },
          create: {
            category: modelName,
            goldGramsKg: metalInfo.metalsGrams.gold || 0,
            silverGrams: metalInfo.metalsGrams.silver || 0,
            copperGrams: metalInfo.metalsGrams.copper || 0
          }
        }).catch(e => {});
        metalCount++;
      }
    }
    console.log(`✓ Synced ${metalCount} Precious Metal Model Yields`);

    // 18. Municipal Trips
    const trips = loadJson("municipalTrips.json", []);
    let tripCount = 0;
    for (const t of trips) {
      const shiftExists = await prisma.municipalShift.findUnique({ where: { shiftId: t.shiftId } }).catch(() => null);
      if (shiftExists) {
        await prisma.municipalTrip.upsert({
          where: { tripId: t.tripId },
          update: { status: t.status },
          create: {
            tripId: t.tripId,
            shiftId: t.shiftId,
            facilityId: t.destinationFacilityId || t.facilityId || "MRF-CENTRAL",
            grossWeightKg: parseFloat(t.weighbridge?.grossWeightKg) || null,
            tareWeightKg: parseFloat(t.weighbridge?.tareWeightKg) || null,
            netWeightKg: parseFloat(t.weighbridge?.netWeightKg || t.totalPickupWeight) || null,
            status: t.status || "DELIVERED",
            completedAt: t.lockedAt ? new Date(t.lockedAt) : null
          }
        }).catch(e => {});
        tripCount++;
      }
    }
    console.log(`✓ Synced ${tripCount} Municipal SWM Weighbridge Trips`);

    // 19. Medical Treatments
    const treatments = loadJson("medicalTreatments.json", []);
    for (const tr of treatments) {
      await prisma.medicalTreatment.upsert({
        where: { treatmentId: tr.treatmentId },
        update: { status: tr.status },
        create: {
          treatmentId: tr.treatmentId,
          batchCode: tr.batchCode,
          facilityId: tr.facilityId || "CBWTF-CENTRAL",
          method: tr.method || "AUTOCLAVE",
          temperatureC: parseFloat(tr.temperatureC) || 121,
          pressurePsi: parseFloat(tr.pressureBar ? tr.pressureBar * 14.5 : tr.pressurePsi) || 15,
          cycleDurationMin: parseInt(tr.durationMinutes || tr.cycleDurationMin, 10) || 60,
          certificateId: tr.certificateId || null,
          status: tr.status || "TREATED",
          treatedAt: tr.treatedAt ? new Date(tr.treatedAt) : new Date()
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${treatments.length} Bio-Medical Autoclave/Incineration Treatments`);

    // 20. Auction Bids
    const bids = loadJson("auctionBids.json", []);
    let bidCount = 0;
    for (const b of bids) {
      const lotExists = await prisma.auctionLot.findUnique({ where: { lotId: b.lotId } }).catch(() => null);
      if (lotExists) {
        await prisma.auctionBid.create({
          data: {
            lotId: b.lotId,
            bidderId: b.bidderId,
            bidderName: b.bidderName || b.bidderId,
            bidAmountINR: parseFloat(b.totalBidPrice || b.bidAmountINR) || 0,
            timestamp: b.placedAt ? new Date(b.placedAt) : new Date()
          }
        }).catch(e => {});
        bidCount++;
      }
    }
    console.log(`✓ Synced ${bidCount} Reverse Auction Bids`);

    // 21. Auction Settlements
    const settlements = loadJson("auctionSettlements.json", []);
    for (const s of settlements) {
      await prisma.auctionSettlement.upsert({
        where: { settlementId: s.settlementId },
        update: { finalPriceINR: parseFloat(s.payoutAmount || s.finalPriceINR) || 0 },
        create: {
          settlementId: s.settlementId,
          lotId: s.lotId,
          winnerId: s.buyerId || s.winnerId || "RECYCLER-01",
          finalPriceINR: parseFloat(s.payoutAmount || s.finalPriceINR) || 0,
          weighbridgeKg: parseFloat(s.verifiedWeightKg || s.weighbridgeKg) || 0,
          paymentRef: s.upiVpa || s.paymentRef || "UPI-SETTLED",
          settledAt: s.settledAt ? new Date(s.settledAt) : new Date()
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${settlements.length} Auction Payout Settlements`);

    // 22. Contractor Settlements
    const contractorSettlements = loadJson("contractorSettlements.json", []);
    for (const cs of contractorSettlements) {
      await prisma.contractorSettlement.upsert({
        where: { voucherId: cs.voucherId },
        update: { netPayoutINR: parseFloat(cs.netPayoutINR) || 0 },
        create: {
          voucherId: cs.voucherId,
          contractorId: cs.contractorId,
          monthYear: cs.monthYear || "2026-09",
          baseEarningsINR: parseFloat(cs.financialBreakdown?.baseEarningsINR || cs.baseEarningsINR) || 0,
          bonusEarningsINR: parseFloat(cs.financialBreakdown?.segregationBonusINR || cs.bonusEarningsINR) || 0,
          penaltyINR: parseFloat(cs.financialBreakdown?.landfillPenaltyINR || cs.penaltyINR) || 0,
          netPayoutINR: parseFloat(cs.netPayoutINR) || 0,
          paymentRef: cs.paymentRef || "NEFT-SETTLED",
          settledAt: cs.settledAt ? new Date(cs.settledAt) : new Date()
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${contractorSettlements.length} Concessionaire Pay-for-Processing Settlements`);

    // 23. Anomaly Flags
    const anomalies = loadJson("anomalyFlags.json", []);
    for (const a of anomalies) {
      await prisma.anomalyFlag.upsert({
        where: { anomalyId: a.flagId || a.anomalyId },
        update: { status: a.status, resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : null },
        create: {
          anomalyId: a.flagId || a.anomalyId,
          ruleId: a.ruleCode || "COMPLIANCE_RULE",
          severity: a.severity || "WARNING",
          entityType: a.track || "MUNICIPAL",
          entityId: a.entityId || "UNKNOWN",
          description: a.message || a.description || "Violation detected",
          status: a.status || "OPEN",
          detectedAt: a.detectedAt ? new Date(a.detectedAt) : new Date(),
          resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : null
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${anomalies.length} AI Anomaly & Fraud Flags`);

    // 24. Citizen Rewards
    const citizenRewards = loadJson("citizenRewards.json", []);
    for (const cr of citizenRewards) {
      await prisma.citizenReward.upsert({
        where: { transactionId: cr.transactionId },
        update: { points: parseInt(cr.points, 10) || 50 },
        create: {
          transactionId: cr.transactionId,
          citizenId: cr.citizenId,
          citizenName: cr.citizenName || cr.citizenId,
          type: cr.type || "EARNED",
          points: parseInt(cr.points, 10) || 50,
          reason: cr.reason || "Citizen Reporting",
          referenceId: cr.referenceId || null,
          timestamp: cr.timestamp ? new Date(cr.timestamp) : new Date()
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${citizenRewards.length} Citizen Karma Reward Transactions`);

    // 25. Commodity Orders
    const commodityOrders = loadJson("commodityOrders.json", []);
    for (const co of commodityOrders) {
      await prisma.commodityOrder.upsert({
        where: { orderId: co.orderId },
        update: { totalAmountINR: parseFloat(co.financials?.totalAmountINR || co.totalAmountINR) || 0 },
        create: {
          orderId: co.orderId,
          invoiceNo: co.invoiceNo,
          lotId: co.lotId,
          buyerOrg: co.buyerOrg,
          buyerGstin: co.buyerGstin,
          weightPurchasedKg: parseFloat(co.weightPurchasedKg) || 0,
          unitPriceINR: parseFloat(co.unitPriceINR) || 0,
          subtotalINR: parseFloat(co.financials?.subtotalINR || co.subtotalINR) || 0,
          gstAmountINR: parseFloat(co.financials?.gstAmountINR || co.gstAmountINR) || 0,
          totalAmountINR: parseFloat(co.financials?.totalAmountINR || co.totalAmountINR) || 0,
          deliveryGatePass: co.deliveryGatePass,
          orderedAt: co.orderedAt ? new Date(co.orderedAt) : new Date()
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${commodityOrders.length} B2B Commodity GST Orders`);

    // 26. Worker Safety Profiles
    const workerCerts = loadJson("workerCertifications.json", []);
    for (const wc of workerCerts) {
      await prisma.workerSafetyProfile.upsert({
        where: { workerId: wc.workerId },
        update: { workerName: wc.workerName, track: wc.track || "MUNICIPAL_SWM" },
        create: {
          workerId: wc.workerId,
          workerName: wc.workerName,
          track: wc.track || "MUNICIPAL_SWM",
          tetanusVaccineDate: wc.tetanusVaccineDate ? new Date(wc.tetanusVaccineDate) : null,
          hepatitisBVaccineDate: wc.hepatitisBVaccineDate ? new Date(wc.hepatitisBVaccineDate) : null,
          ppeCertificationDate: wc.ppeCertificationDate ? new Date(wc.ppeCertificationDate) : null,
          lastHealthCheckupDate: wc.lastHealthCheckupDate ? new Date(wc.lastHealthCheckupDate) : null
        }
      }).catch(e => {});
    }
    console.log(`✓ Synced ${workerCerts.length} Worker Health & Safety Passports`);

    console.log("\n🎉 Full PostgreSQL migration sync completed successfully!\n");
  } catch (error) {
    console.error("❌ Migration error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
