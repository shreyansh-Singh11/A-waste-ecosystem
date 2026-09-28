/*
  ============================================================
  MATCHING ENGINE — System 1 (Automated Collection & Recycler System)
  ============================================================
  Pure function, no file I/O — takes an item + request data + the
  current collector list, returns a ranked eligibility result. This
  keeps it independently unit-testable and keeps decisionEngine.mjs
  responsible only for persistence.

  Elimination order (a collector must pass ALL of these to be
  considered at all — this is "eligibility first"):
    1. operatingStatus === "ACTIVE"
    2. verificationStatus === "VERIFIED"
    3. category compatibility (acceptedCategories empty = accepts all,
       for backward compatibility with collectors that predate this
       field)
    4. service area match (serviceArea empty = accepts all areas)
    5. available capacity (assignedCount < capacity)
    6. within maxDistanceKm, IF both item and collector have lat/lng
       (no GPS on either side -> distance is simply not a filter)

  Collectors that survive are then SCORED (higher is better) using:
    + serviceAreaMatchBonus  (exact zone match)
    - distance penalty        (if GPS known on both sides)
    - workload penalty        (assignedCount / capacity ratio)

  Returns:
    { eligible: [...scoredCollectorsDescending], best: collector|null,
      rejected: [{ collectorId, reason }, ...] }
*/
import { RULES } from "./rules.mjs";

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * @param {object} item - the EWasteItem (needs .category; optionally
 *   .pickupLat/.pickupLng if the request supplied a geocoded pickup point)
 * @param {object} requestData - { serviceArea, pickupLat, pickupLng, urgency }
 * @param {object[]} collectors - full contents of data/collectors.json
 * @param {object} [weights] - defaults to RULES.matching
 */
export function findBestCollector(item, requestData, collectors, weights = RULES.matching) {
  const rejected = [];
  const hasPickupGps = typeof requestData.pickupLat === "number" && typeof requestData.pickupLng === "number";

  const survivors = [];
  for (const c of collectors) {
    // 1. operating status
    const operatingStatus = c.operatingStatus || "ACTIVE"; // default for legacy records
    if (operatingStatus !== "ACTIVE") {
      rejected.push({ collectorId: c.id, reason: `not active (status: ${operatingStatus})` });
      continue;
    }
    // 2. verification/compliance
    const verificationStatus = c.verificationStatus || "VERIFIED"; // default for legacy records
    if (verificationStatus !== "VERIFIED") {
      rejected.push({ collectorId: c.id, reason: `not verified (status: ${verificationStatus})` });
      continue;
    }
    // 3. category compatibility
    const acceptedCategories = c.acceptedCategories || [];
    if (item.category && acceptedCategories.length > 0 && !acceptedCategories.includes(item.category)) {
      rejected.push({ collectorId: c.id, reason: `does not accept category "${item.category}"` });
      continue;
    }
    // 4. service area
    const serviceArea = c.serviceArea || [];
    if (requestData.serviceArea && serviceArea.length > 0 && !serviceArea.includes(requestData.serviceArea)) {
      rejected.push({ collectorId: c.id, reason: `outside service area (requested: ${requestData.serviceArea})` });
      continue;
    }
    // 5. capacity
    const capacity = c.capacity ?? c.maxCapacity ?? Infinity;
    const assignedCount = c.assignedCount ?? c.currentLoad ?? 0;
    if (assignedCount >= capacity) {
      rejected.push({ collectorId: c.id, reason: `at capacity (${assignedCount}/${capacity})` });
      continue;
    }
    // 6. distance
    let distanceKm = null;
    if (hasPickupGps && typeof c.latitude === "number" && typeof c.longitude === "number") {
      distanceKm = haversineKm(requestData.pickupLat, requestData.pickupLng, c.latitude, c.longitude);
      if (distanceKm > weights.maxDistanceKm) {
        rejected.push({ collectorId: c.id, reason: `too far (${distanceKm.toFixed(1)}km > ${weights.maxDistanceKm}km)` });
        continue;
      }
    }

    const workloadRatio = capacity === Infinity ? 0 : assignedCount / capacity;
    let score = 100;
    const reasons = [];
    if (item.category) {
      reasons.push(
        acceptedCategories.length > 0
          ? `Category "${item.category}" accepted`
          : `Category accepted (centre accepts all categories)`
      );
    }
    if (requestData.serviceArea && serviceArea.includes(requestData.serviceArea)) {
      score += weights.serviceAreaMatchBonus;
      reasons.push(`Service area matched (${requestData.serviceArea})`);
    } else if (serviceArea.length === 0) {
      reasons.push("Serves all areas (no service-area restriction)");
    }
    const capacityPercent = capacity === Infinity ? null : Math.round(((capacity - assignedCount) / capacity) * 100);
    if (capacityPercent !== null) reasons.push(`Available capacity: ${capacityPercent}%`);
    if (distanceKm !== null) {
      score += distanceKm * weights.distanceWeight;
      reasons.push(`Distance: ${distanceKm.toFixed(1)} km`);
    }
    score += workloadRatio * weights.workloadWeight;
    reasons.push(`Workload: ${Math.round(workloadRatio * 100)}% of capacity in use`);

    survivors.push({ collector: c, score: Math.round(score * 100) / 100, distanceKm, workloadRatio, reasons });
  }

  survivors.sort((a, b) => b.score - a.score);
  if (survivors.length > 0) {
    // The winner's reason list gets one more line explaining *why it
    // won* relative to the field, not just why it was eligible.
    if (survivors.length > 1) {
      survivors[0].reasons.push(`Best available match among ${survivors.length} eligible centres`);
    } else {
      survivors[0].reasons.push("Only eligible centre for this request");
    }
  }

  return {
    eligible: survivors,
    best: survivors.length > 0 ? survivors[0].collector : null,
    bestScore: survivors.length > 0 ? survivors[0].score : null,
    bestReasons: survivors.length > 0 ? survivors[0].reasons : [],
    rejected,
  };
}
