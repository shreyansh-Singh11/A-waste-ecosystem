/*
  ============================================================
  GOVERNMENT ANALYTICS — System 3 (Government Command, Analytics &
  Integration System)
  ============================================================
  Two kinds of functions here, same separation as matchingEngine.mjs
  and creditEngine.mjs:

  1. Pure "build*" functions — take already-loaded data arrays, return
     computed statistics. No file I/O, easy to unit test, and usable
     from any caller (server.js routes call these directly since
     they're read-only queries, not lifecycle events).

  2. `runComplianceScan()` — the one impure function here. It reads
     collection requests / collectors and CREATES GovernmentAlert
     entries for anything past its threshold (delayed collection,
     delayed recycling, requests unassigned too long, overloaded
     centres). It reuses decisionEngine.mjs's own createAlertIfNotOpen
     so the dedup rule ("no duplicate alerts for the same unresolved
     event") is enforced in exactly one place, not reimplemented here.

  Every number here comes from the real data files — nothing in this
  module is hardcoded or mocked.
*/
import { RULES } from "./rules.mjs";
import { createAlertIfNotOpen } from "./decisionEngine.mjs";
import { aggregateImpact } from "./environmentalImpact.mjs";

function hoursSince(isoString) {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / 3600000;
}

function dayKey(isoString) {
  return isoString ? isoString.slice(0, 10) : null; // YYYY-MM-DD
}

/**
 * Applies the standard district/state/date-range/category/recycler/
 * collector/status filters the spec asks government users be able to
 * apply. All filters are optional; an unset filter passes everything.
 */
export function filterRequests(requests, filters = {}) {
  const { state, district, from, to, category, recyclerId, collectorId, status, items = [] } = filters;
  const itemById = new Map(items.map((it) => [it.id, it]));
  return requests.filter((r) => {
    if (state && r.state !== state) return false;
    if (district && r.district !== district) return false;
    if (status && r.status !== status) return false;
    if ((recyclerId || collectorId) && r.assignedCollector !== (recyclerId || collectorId)) return false;
    if (from && new Date(r.requestedAt) < new Date(from)) return false;
    if (to && new Date(r.requestedAt) > new Date(to)) return false;
    if (category) {
      const item = itemById.get(r.itemId);
      if (!item || item.category !== category) return false;
    }
    return true;
  });
}

export function buildDashboard({ items, requests, collectors, alerts, suspicious }) {
  const totalCollected = requests.filter((r) => ["COLLECTED", "VERIFIED", "SENT_TO_RECYCLER", "RECYCLED"].includes(r.status)).length;
  const totalRecycled = requests.filter((r) => r.status === "RECYCLED").length;
  const recyclingRate = totalCollected > 0 ? Math.round((totalRecycled / totalCollected) * 1000) / 10 : 0;

  const pendingRequests = requests.filter((r) => r.status === "REQUESTED").length;
  const overloadedCentres = collectors.filter((c) => c.capacity > 0 && c.assignedCount / c.capacity >= RULES.government.overloadedCapacityRatio);
  const delayedRecycling = requests.filter((r) =>
    ["VERIFIED", "SENT_TO_RECYCLER"].includes(r.status) && hoursSince(r.history?.slice(-1)[0]?.timestamp) > RULES.government.delayedRecyclingHours
  );

  const openSuspicious = suspicious.filter((s) => s.status === "OPEN");

  // District / state rollups
  const byKey = (arr, keyFn) => {
    const map = {};
    for (const r of arr) {
      const key = keyFn(r) || "Unspecified";
      if (!map[key]) map[key] = { total: 0, recycled: 0 };
      map[key].total += 1;
      if (r.status === "RECYCLED") map[key].recycled += 1;
    }
    return map;
  };

  return {
    totals: {
      totalItemsRegistered: items.length,
      totalCollectionRequests: requests.length,
      totalCollected,
      totalRecycled,
      recyclingRatePercent: recyclingRate,
      pendingRequests,
      activeCollectionCentres: collectors.filter((c) => c.operatingStatus === "ACTIVE").length,
      overloadedCentres: overloadedCentres.length,
      delayedRecyclingCount: delayedRecycling.length,
      openSuspiciousActivity: openSuspicious.length,
      openAlerts: alerts.filter((a) => a.status === "OPEN").length,
    },
    // SYSTEM 4 — platform-wide Environmental Impact Engine rollup.
    // Computed straight from the real per-item impact data recorded at
    // RECYCLING_COMPLETED — nothing here is estimated a second time or
    // hardcoded; see environmentalImpact.mjs for the per-item methodology.
    environmentalImpact: aggregateImpact(items),
    districtStats: byKey(requests, (r) => r.district),
    stateStats: byKey(requests, (r) => r.state),
  };
}

export function buildPerformance({ requests, collectors, statusHistory }) {
  return collectors.map((c) => {
    const assigned = requests.filter((r) => r.assignedCollector === c.id);
    const completed = assigned.filter((r) => ["COLLECTED", "VERIFIED", "SENT_TO_RECYCLER", "RECYCLED"].includes(r.status));
    const verified = assigned.filter((r) => ["VERIFIED", "SENT_TO_RECYCLER", "RECYCLED"].includes(r.status));
    const recycled = assigned.filter((r) => r.status === "RECYCLED");
    const delayed = assigned.filter((r) =>
      (["ASSIGNED", "SCHEDULED"].includes(r.status) && hoursSince(r.history?.slice(-1)[0]?.timestamp) > RULES.government.delayedCollectionHours) ||
      (["VERIFIED", "SENT_TO_RECYCLER"].includes(r.status) && hoursSince(r.history?.slice(-1)[0]?.timestamp) > RULES.government.delayedRecyclingHours)
    );

    // Average time from ASSIGNED to RECYCLED, in hours, over this
    // collector's own recorded transitions in the audit table.
    const relevantHistory = statusHistory.filter((h) => assigned.some((r) => r.id === h.requestId));
    const byRequest = {};
    for (const h of relevantHistory) {
      if (!byRequest[h.requestId]) byRequest[h.requestId] = {};
      if (h.newStatus === "ASSIGNED") byRequest[h.requestId].start = h.timestamp;
      if (h.newStatus === "RECYCLED") byRequest[h.requestId].end = h.timestamp;
    }
    const completedDurations = Object.values(byRequest)
      .filter((r) => r.start && r.end)
      .map((r) => (new Date(r.end) - new Date(r.start)) / 3600000);
    const avgProcessingHours = completedDurations.length > 0
      ? Math.round((completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length) * 10) / 10
      : null;

    return {
      collectorId: c.id,
      name: c.name,
      type: c.type,
      complianceStatus: c.verificationStatus,
      operatingStatus: c.operatingStatus,
      capacityUtilizationPercent: c.capacity > 0 ? Math.round((c.assignedCount / c.capacity) * 1000) / 10 : 0,
      assignedRequests: assigned.length,
      completedCollections: completed.length,
      verificationRatePercent: assigned.length > 0 ? Math.round((verified.length / assigned.length) * 1000) / 10 : 0,
      recyclingCompletionRatePercent: assigned.length > 0 ? Math.round((recycled.length / assigned.length) * 1000) / 10 : 0,
      avgProcessingHours,
      delayedCases: delayed.length,
    };
  });
}

export function buildTrends({ requests, items }) {
  const itemById = new Map(items.map((it) => [it.id, it]));
  const collectedByDay = {};
  const recycledByDay = {};
  const categoryDistribution = {};

  for (const r of requests) {
    const item = itemById.get(r.itemId);
    const category = item?.category || "Uncategorized";
    categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

    for (const h of r.history || []) {
      if (h.newStatus === "COLLECTED") {
        const key = dayKey(h.timestamp);
        collectedByDay[key] = (collectedByDay[key] || 0) + 1;
      }
      if (h.newStatus === "RECYCLED") {
        const key = dayKey(h.timestamp);
        recycledByDay[key] = (recycledByDay[key] || 0) + 1;
      }
    }
  }

  return { collectedByDay, recycledByDay, categoryDistribution };
}

// ----------------------------------------------------------------
// COMPLIANCE SCAN — the only impure function in this module. Creates
// GovernmentAlert entries (via decisionEngine's own alert store, so
// they show up in the exact same /api/suspicious-activity-adjacent
// alert feed as everything else) for anything past its threshold.
// Safe to call repeatedly (e.g. on every dashboard load) — dedup is
// handled by createAlertIfNotOpen.
// ----------------------------------------------------------------
export function runComplianceScan({ requests, collectors }) {
  const createdAlerts = [];

  for (const r of requests) {
    if (r.status === "RECYCLED") continue;
    const lastTransitionAt = r.history?.slice(-1)[0]?.timestamp;
    const hoursInPhase = hoursSince(lastTransitionAt);

    if (r.status === "REQUESTED" && hoursInPhase > RULES.government.unassignedRequestHours) {
      const alert = createAlertIfNotOpen("REQUEST_UNASSIGNED_TOO_LONG", `Request ${r.id} has been unassigned for ${Math.round(hoursInPhase)}h (item ${r.itemId})`, "high", r.id);
      if (alert) createdAlerts.push(alert);
    }
    if (["ASSIGNED", "SCHEDULED"].includes(r.status) && hoursInPhase > RULES.government.delayedCollectionHours) {
      const alert = createAlertIfNotOpen("DELAYED_COLLECTION", `Request ${r.id} has been ${r.status} for ${Math.round(hoursInPhase)}h without collection`, "medium", r.id);
      if (alert) createdAlerts.push(alert);
    }
    if (["VERIFIED", "SENT_TO_RECYCLER"].includes(r.status) && hoursInPhase > RULES.government.delayedRecyclingHours) {
      const alert = createAlertIfNotOpen("DELAYED_RECYCLING", `Request ${r.id} has been ${r.status} for ${Math.round(hoursInPhase)}h without recycling completion`, "medium", r.id);
      if (alert) createdAlerts.push(alert);
    }
  }

  for (const c of collectors) {
    if (c.capacity > 0 && c.assignedCount / c.capacity >= RULES.government.overloadedCapacityRatio) {
      const alert = createAlertIfNotOpen("COLLECTOR_OVERLOADED", `Collector ${c.id} at ${c.assignedCount}/${c.capacity} capacity`, "high", c.id);
      if (alert) createdAlerts.push(alert);
    }
    if (c.verificationStatus !== "VERIFIED" && c.assignedCount > 0) {
      const alert = createAlertIfNotOpen("NON_COMPLIANT_RECYCLER_ACTIVE", `Collector ${c.id} has ${c.assignedCount} active assignments but is not VERIFIED`, "high", c.id);
      if (alert) createdAlerts.push(alert);
    }
    if (c.operatingStatus !== "ACTIVE" && c.assignedCount > 0) {
      const alert = createAlertIfNotOpen("INACTIVE_RECYCLER_ACTIVE", `Collector ${c.id} has ${c.assignedCount} active assignments but is ${c.operatingStatus}`, "high", c.id);
      if (alert) createdAlerts.push(alert);
    }
  }

  return createdAlerts;
}
