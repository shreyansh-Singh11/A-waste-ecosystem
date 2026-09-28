/*
  ============================================================
  SMART AUTOMATION & DECISION ENGINE
  ============================================================
  This is the ONE place where the project decides what happens next.
  server.js no longer contains business logic for status changes,
  collector assignment, or QR-scan validation — it just calls
  processEvent() and reports back whatever the engine decides.

  It reads/writes the EXACT SAME data files server.js always has
  (data/items.json, collectors.json, wallets.json) — there is no
  second database. data/alerts.json is the one new file, since no
  alert system existed before.

  Every function call looks like:

    const result = await processEvent({
      type: 'QR_SCANNED',
      itemId,       // optional — some events use a token instead
      actorId,      // who triggered this (collector ID, owner ID, etc.)
      actorRole,    // optional, for future role-based rules
      data: {...},  // event-specific payload
    });

  And always returns one of:
    { success: true,  event, actions: [...], statusChanged, newStatus, alerts: [...], ... }
    { success: false, event, error: "...", exception: "..." }
*/

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { EVENT_TYPES, ALERT_TYPES, ACTIVITY_LABELS } from "./eventTypes.mjs";
import { RULES } from "./rules.mjs";
import { findBestCollector } from "./matchingEngine.mjs";
import { calculateCredits } from "./creditEngine.mjs";
import { calculateImpact } from "./environmentalImpact.mjs";
import { calculateCertificatePrice, resolveWeight, generateCertificateId, generateTransactionId, computeVerificationHash } from "./eprEngine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");
const COLLECTORS_FILE = path.join(DATA_DIR, "collectors.json");
const WALLETS_FILE = path.join(DATA_DIR, "wallets.json");
const ALERTS_FILE = path.join(DATA_DIR, "alerts.json");
const COLLECTION_REQUESTS_FILE = path.join(DATA_DIR, "collectionRequests.json");
const STATUS_HISTORY_FILE = path.join(DATA_DIR, "statusHistory.json");
const TRANSACTIONS_FILE = path.join(DATA_DIR, "transactions.json");
const REWARDS_FILE = path.join(DATA_DIR, "rewards.json");
const REWARD_CLAIMS_FILE = path.join(DATA_DIR, "rewardClaims.json");
const SUSPICIOUS_FILE = path.join(DATA_DIR, "suspiciousActivity.json");
const ACTIVITY_FEED_FILE = path.join(DATA_DIR, "activityFeed.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const EPR_CERTIFICATES_FILE = path.join(DATA_DIR, "eprCertificates.json");
const EPR_OBLIGATIONS_FILE = path.join(DATA_DIR, "eprObligations.json");
const EPR_TRANSACTIONS_FILE = path.join(DATA_DIR, "eprTransactions.json");
const PRODUCERS_FILE = path.join(DATA_DIR, "producers.json");
const ACTIVITY_FEED_MAX_LENGTH = 300; // keep the feed bounded — a live/recent feed, not a full audit archive (statusHistory.json is the permanent audit trail)

// ------------------------------------------------------------
// Shared file helpers (same read/write pattern server.js already used)
// ------------------------------------------------------------
function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Moved here from server.js — this is now the ONLY place item IDs and
// QR tokens are generated. Same collision-checked logic as before.
function generateItemId(existingItems) {
  const year = new Date().getFullYear();
  const existingIds = new Set(existingItems.map((it) => it.id));
  let counter = existingItems.length + 1;
  let candidate;
  do {
    candidate = `EW-${year}-${String(counter).padStart(6, "0")}`;
    counter++;
  } while (existingIds.has(candidate));
  return candidate;
}

function generateUniqueQrToken(existingItems) {
  const existingTokens = new Set(existingItems.map((it) => it.qrToken).filter(Boolean));
  let token;
  do {
    token = crypto.randomBytes(16).toString("hex");
  } while (existingTokens.has(token));
  return token;
}

// A real status change — appends history, never overwrites it.
function addHistoryEntry(item, newStatus, changedBy, extra = {}) {
  const previousStatus = item.status || null;
  item.status = newStatus;
  if (!item.history) item.history = [];
  item.history.push({
    previousStatus,
    newStatus,
    changedBy: changedBy || "system",
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

// An audit line that does NOT change status (e.g. a scan or a
// verification checkpoint) — still fully visible in the item's history.
function logAudit(item, eventName, changedBy, extra = {}) {
  if (!item.history) item.history = [];
  item.history.push({
    event: eventName,
    previousStatus: item.status,
    newStatus: item.status,
    changedBy: changedBy || "system",
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

function createAlert(alertType, message, severity, itemId) {
  const alerts = loadJson(ALERTS_FILE, []);
  const alert = {
    id: crypto.randomBytes(6).toString("hex"),
    type: alertType,
    message,
    severity, // 'low' | 'medium' | 'high'
    itemId: itemId || null,
    status: "OPEN", // OPEN | ACKNOWLEDGED | RESOLVED — System 3's government dashboard reads/writes this
    timestamp: new Date().toISOString(),
  };
  alerts.push(alert);
  saveJson(ALERTS_FILE, alerts);
  return alert;
}

// Same as createAlert, but refuses to create a new one if an OPEN alert
// of the same type+subject already exists — the spec is explicit that
// several alert categories ("Do not create duplicate alerts for the
// same unresolved event") must not pile up. Returns null if skipped.
function createAlertIfNotOpen(alertType, message, severity, itemId) {
  const alerts = loadJson(ALERTS_FILE, []);
  const alreadyOpen = alerts.some((a) => a.type === alertType && a.itemId === itemId && a.status !== "RESOLVED");
  if (alreadyOpen) return null;
  return createAlert(alertType, message, severity, itemId);
}

// ============================================================
// SYSTEM 4 — Live Smart Automation activity feed. A separate,
// intentionally bounded, presentation-oriented log (NOT the permanent
// audit trail — item.history / statusHistory.json remain the source
// of truth). This is just "what happened recently, in one readable
// line", for the live dashboard feed.
// ============================================================
function logActivity(labelKey, detail, { itemId = null, requestId = null, collectorId = null } = {}) {
  const feed = loadJson(ACTIVITY_FEED_FILE, []);
  const entry = {
    id: crypto.randomBytes(6).toString("hex"),
    label: ACTIVITY_LABELS[labelKey] || labelKey,
    detail: detail || null,
    itemId, requestId, collectorId,
    timestamp: new Date().toISOString(),
  };
  feed.push(entry);
  // Keep only the most recent N entries — this is a live feed, not an archive.
  const trimmed = feed.length > ACTIVITY_FEED_MAX_LENGTH ? feed.slice(feed.length - ACTIVITY_FEED_MAX_LENGTH) : feed;
  saveJson(ACTIVITY_FEED_FILE, trimmed);
  return entry;
}

// ============================================================
// SYSTEM 4 — Reusable in-app notification system. Every notification
// belongs to exactly one recipient (a userId/collectorId, or the
// literal role string "GOVERNMENT" for broadcast government alerts)
// so a dashboard can query "notifications for me" without filtering
// the whole platform's events by hand.
// ============================================================
function createNotification(recipientId, recipientRole, message, category, relatedIds = {}) {
  const notifications = loadJson(NOTIFICATIONS_FILE, []);
  const notification = {
    id: crypto.randomBytes(6).toString("hex"),
    recipientId,
    recipientRole, // "USER" | "COLLECTOR" | "GOVERNMENT" | "ADMIN"
    message,
    category, // e.g. PICKUP_ASSIGNED, CREDITS_AWARDED, SUSPICIOUS_ACTIVITY, REASSIGNMENT
    read: false,
    ...relatedIds,
    timestamp: new Date().toISOString(),
  };
  notifications.push(notification);
  saveJson(NOTIFICATIONS_FILE, notifications);
  return notification;
}

// ============================================================
// SYSTEM 4 — Repeated-scan fraud detector. Reuses the activity feed
// (rather than a third parallel log) to count how many times a given
// item's QR was scanned within a short rolling window. A legitimate
// collector scans an item once per pickup; several scans in minutes
// is the "same item scanned repeatedly in abnormal intervals" pattern
// called out in the spec. This only ever FLAGS for review — it never
// blocks the scan itself.
// ============================================================
function checkRepeatedScans(itemId, actorId) {
  const { repeatedScanWindowMinutes, repeatedScanThreshold } = RULES.fraud;
  const feed = loadJson(ACTIVITY_FEED_FILE, []);
  const cutoff = Date.now() - repeatedScanWindowMinutes * 60000;
  const recentScans = feed.filter(
    (e) => e.itemId === itemId && e.label === ACTIVITY_LABELS.QR_SCANNED && new Date(e.timestamp).getTime() >= cutoff
  );
  if (recentScans.length >= repeatedScanThreshold) {
    flagSuspicious(
      ALERT_TYPES.REPEATED_QR_SCANS,
      `${itemId} scanned ${recentScans.length} times in the last ${repeatedScanWindowMinutes} minutes (most recently by ${actorId})`,
      "medium",
      { itemId, userId: actorId }
    );
    return true;
  }
  return false;
}

function isValidTransition(fromStatus, toStatus) {
  const allowed = RULES.statusTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

// Simple, documented, extensible — see RULES.priority for the weights.
function computePriority({ hazardous, urgency, waitingHours }) {
  const w = RULES.priority;
  const score =
    (hazardous ? w.hazardousWeight : 0) +
    (urgency ? urgency * w.urgencyWeight : 0) +
    Math.min(waitingHours, w.waitingTimeCapHours) * w.waitingTimeWeightPerHour;

  let level = "LOW";
  if (score >= w.thresholds.high) level = "HIGH";
  else if (score >= w.thresholds.medium) level = "MEDIUM";
  return { score: Math.round(score), level };
}

// The same "role check" honesty note as before: this project has no
// login system, so this only confirms the ID is a KNOWN collector —
// not that the caller is verified to actually be that person.
function isKnownCollector(collectorId) {
  if (!collectorId) return false;
  const collectors = loadJson(COLLECTORS_FILE, []);
  return collectors.some((c) => c.id === collectorId);
}

// Every rejected event goes through here: it logs an EXCEPTION_DETECTED
// style alert AND returns the standard failure shape, so nothing fails
// silently and nothing needs to remember to create the alert itself.
function fail(eventType, error, exceptionType, itemId, severity = "medium") {
  createAlert(exceptionType || "EXCEPTION_DETECTED", error, severity, itemId);
  return { success: false, event: eventType, error, exception: exceptionType || "EXCEPTION_DETECTED" };
}

// ============================================================
// SYSTEM 1 HELPERS — Collection Request record + its own audit trail
// (data/statusHistory.json), kept separate from item.history on
// purpose: item.history is the item's own story, statusHistory.json
// is the request/workflow's audit table, per the spec's "every
// transition recorded in a history/audit table" requirement.
// ============================================================
function generateRequestId(existingRequests) {
  const year = new Date().getFullYear();
  const existingIds = new Set(existingRequests.map((r) => r.id));
  let counter = existingRequests.length + 1;
  let candidate;
  do {
    candidate = `CR-${year}-${String(counter).padStart(6, "0")}`;
    counter++;
  } while (existingIds.has(candidate));
  return candidate;
}

function isValidRequestTransition(fromStatus, toStatus) {
  const allowed = RULES.collectionRequestTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

function recordStatusHistory(requestId, itemId, previousStatus, newStatus, actor, notes) {
  const history = loadJson(STATUS_HISTORY_FILE, []);
  history.push({
    id: crypto.randomBytes(6).toString("hex"),
    requestId,
    itemId,
    previousStatus,
    newStatus,
    actor: actor || "system",
    timestamp: new Date().toISOString(),
    notes: notes || null,
  });
  saveJson(STATUS_HISTORY_FILE, history);
}

// Finds the active (non-RECYCLED) CollectionRequest tied to an item, if any.
function findActiveRequestForItem(requests, itemId) {
  return requests.find((r) => r.itemId === itemId && r.status !== "RECYCLED");
}

// Advances a CollectionRequest's status to keep it in sync with the
// item's real lifecycle events. This is the ONLY place CollectionRequest
// status is ever written, so the two records can never drift apart.
// Silently no-ops if there's no active request for the item (e.g. old
// items registered before System 1 existed) or if the transition isn't
// valid (logged as an alert instead of thrown, since this runs as a
// side-effect of other events and must never abort the primary action).
function syncCollectionRequestStatus(itemId, targetStatus, actor, notes) {
  const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const request = findActiveRequestForItem(requests, itemId);
  if (!request) return null;

  // Backward-compat: old clients could scan collection without ever
  // calling the explicit "schedule" step. Auto-advance ASSIGNED -> SCHEDULED
  // first so COLLECTED is always reachable in one hop from the caller's view.
  if (request.status === "ASSIGNED" && targetStatus === "COLLECTED") {
    const prev = request.status;
    request.status = "SCHEDULED";
    request.history = request.history || [];
    request.history.push({ previousStatus: prev, newStatus: "SCHEDULED", actor: "system", timestamp: new Date().toISOString(), notes: "auto-scheduled (no explicit schedule step was called)" });
    recordStatusHistory(request.id, itemId, prev, "SCHEDULED", "system", "auto-scheduled");
  }

  if (!isValidRequestTransition(request.status, targetStatus)) {
    createAlert("INVALID_REQUEST_STATUS_TRANSITION", `Rejected request transition ${request.status} -> ${targetStatus} on ${request.id}`, "medium", itemId);
    saveJson(COLLECTION_REQUESTS_FILE, requests);
    return request;
  }

  const previousStatus = request.status;
  request.status = targetStatus;
  request.history = request.history || [];
  request.history.push({ previousStatus, newStatus: targetStatus, actor: actor || "system", timestamp: new Date().toISOString(), notes: notes || null });
  saveJson(COLLECTION_REQUESTS_FILE, requests);
  recordStatusHistory(request.id, itemId, previousStatus, targetStatus, actor, notes);
  return request;
}

// ============================================================
// SYSTEM 2 HELPERS — Wallet + transaction ledger, and a dedicated
// suspicious-activity feed (kept separate from general alerts, which
// cover the whole platform — this feed is specifically the fraud/
// abuse signal System 3's government dashboard will read from).
// ============================================================
function flagSuspicious(subtype, message, severity, relatedIds = {}) {
  const suspicious = loadJson(SUSPICIOUS_FILE, []);
  const entry = {
    id: crypto.randomBytes(6).toString("hex"),
    type: subtype,
    message,
    severity,
    ...relatedIds,
    status: "OPEN",
    timestamp: new Date().toISOString(),
  };
  suspicious.push(entry);
  saveJson(SUSPICIOUS_FILE, suspicious);
  // Also surface it as a normal alert so it shows up in the one alert
  // feed operators already watch — the dedicated file exists so a
  // government/fraud view can query suspicious activity specifically
  // without filtering the whole alert stream by message text.
  createAlert(subtype, message, severity, relatedIds.itemId || relatedIds.userId || null);
  logActivity("SUSPICIOUS_ACTIVITY", message, { itemId: relatedIds.itemId || null, collectorId: relatedIds.collectorId || null });
  createNotification("GOVERNMENT", "GOVERNMENT", `Suspicious activity detected: ${message}`, "SUSPICIOUS_ACTIVITY", { itemId: relatedIds.itemId || null });
  return entry;
}

function getOrCreateWallet(wallets, userId) {
  if (!wallets[userId]) {
    wallets[userId] = { balance: 0, totalEarned: 0, totalSpent: 0, lastUpdated: null };
  }
  return wallets[userId];
}

// The ONLY function in the app that is allowed to change a wallet
// balance — every call creates exactly one transaction, and every
// transaction has a referenceEventId that makes the operation
// idempotent: firing the same underlying event twice (e.g. a retried
// RECYCLING_COMPLETED call) can never double-credit, it just returns
// { duplicate: true } and touches nothing.
//
// amount: positive for EARN/BONUS, negative for SPEND/REVERSAL.
function applyWalletTransaction(userId, amount, txType, reason, { itemId = null, relatedEvent = null, referenceEventId = null } = {}) {
  const transactions = loadJson(TRANSACTIONS_FILE, []);

  if (referenceEventId && transactions.some((t) => t.referenceEventId === referenceEventId)) {
    flagSuspicious(ALERT_TYPES.DUPLICATE_CREDIT_ATTEMPT, `Duplicate wallet transaction attempted for reference ${referenceEventId} (user ${userId})`, "medium", { userId, itemId });
    return { duplicate: true, transaction: null, wallet: null };
  }

  const wallets = loadJson(WALLETS_FILE, {});
  const wallet = getOrCreateWallet(wallets, userId);

  if (amount < 0 && wallet.balance + amount < 0) {
    return { duplicate: false, transaction: null, wallet: null, insufficientBalance: true };
  }

  wallet.balance += amount;
  if (amount >= 0) wallet.totalEarned += amount;
  else wallet.totalSpent += -amount;
  wallet.lastUpdated = new Date().toISOString();
  saveJson(WALLETS_FILE, wallets);

  const transaction = {
    id: crypto.randomBytes(6).toString("hex"),
    userId, amount, type: txType, reason,
    itemId, relatedEvent, referenceEventId,
    timestamp: new Date().toISOString(),
  };
  transactions.push(transaction);
  saveJson(TRANSACTIONS_FILE, transactions);

  return { duplicate: false, transaction, wallet };
}

// ============================================================
// THE ENGINE
// ============================================================
export async function processEvent(evt) {
  const { type, itemId, actorId, data = {} } = evt;

  switch (type) {
    // ----------------------------------------------------------
    // RULE 1 — New item
    // ----------------------------------------------------------
    case EVENT_TYPES.ITEM_CREATED: {
      const { device, age, condition, battery, category, owner, deviceModel, conditionAssessment, physicalGrade, lifecycleRecommendation } = data;
      if (!device || !owner) {
        return fail(type, "device and owner are required", "MISSING_REQUIRED_INFO", null);
      }

      const items = loadJson(ITEMS_FILE, []);
      const id = generateItemId(items);
      const qrToken = generateUniqueQrToken(items);

      const newItem = {
        id,
        device,
        deviceModel: deviceModel || null,
        age: age || "unknown",
        condition: condition || "unknown",
        battery: battery || "unknown",
        category: category || null,
        conditionAssessment: conditionAssessment || null,
        physicalGrade: physicalGrade || null,
        lifecycleRecommendation: lifecycleRecommendation || null,
        owner,
        status: "REGISTERED",
        assignedCollector: null,
        outcome: null,
        qrToken,
        active: true,
        createdAt: new Date().toISOString(),
        history: [
          { previousStatus: null, newStatus: "REGISTERED", changedBy: owner, timestamp: new Date().toISOString() },
        ],
      };

      items.push(newItem);
      saveJson(ITEMS_FILE, items);
      logActivity("ITEM_REGISTERED", `${device} registered by ${owner}`, { itemId: id });
      createNotification(owner, "USER", `Your ${device} was registered as ${id}.`, "ITEM_REGISTERED", { itemId: id });

      return {
        success: true, event: type,
        actions: ["ITEM_VALIDATED", "ID_ASSIGNED", "STATUS_SET_REGISTERED", "HISTORY_LOGGED"],
        statusChanged: true, newStatus: "REGISTERED", item: newItem, alerts: [],
      };
    }

    // ----------------------------------------------------------
    // AI confidence gating (Gemini call itself stays in ewasteVision.mjs —
    // this only interprets the confidence number it already returned)
    // ----------------------------------------------------------
    case EVENT_TYPES.AI_IDENTIFIED: {
      const { confidence } = data;
      if (typeof confidence !== "number") {
        return fail(type, "confidence value missing from AI result", "MISSING_REQUIRED_INFO", itemId);
      }

      const { autoAccept, needsConfirmation } = RULES.aiConfidence;
      const alerts = [];
      let decision;

      if (confidence >= autoAccept) decision = "AUTO_ACCEPTED";
      else if (confidence >= needsConfirmation) decision = "NEEDS_CONFIRMATION";
      else {
        decision = "MANUAL_CORRECTION_REQUIRED";
        alerts.push(createAlert(ALERT_TYPES.LOW_AI_CONFIDENCE, `AI confidence ${confidence} is below ${needsConfirmation}`, "low", itemId));
      }
      logActivity("AI_IDENTIFIED", `${data.device || "Device"} — ${Math.round(confidence * 100)}% confidence (${decision})`, { itemId });

      return { success: true, event: type, actions: [decision], statusChanged: false, decision, alerts };
    }

    // ----------------------------------------------------------
    // RULE 2 + 3 — onCollectionRequestCreated() / assignCollectionPoint()
    // Creates the CollectionRequest record, runs the matching engine,
    // and (on success) advances the item to BOOKED. This is System 1's
    // main entry point.
    // ----------------------------------------------------------
    case EVENT_TYPES.COLLECTION_REQUESTED: {
      const { pickupAddress, preferredTime, serviceArea, pickupLat, pickupLng, urgency, district, state } = data;

      const items = loadJson(ITEMS_FILE, []);
      const item = items.find((it) => it.id === itemId);
      if (!item) return fail(type, "No item found with this ID", "INVALID_ITEM_ID", itemId);
      if (item.active === false) return fail(type, "Item not found.", "ITEM_DELETED", itemId);

      // Prevent duplicate active collection requests for the same item.
      // Checked BEFORE the item-status transition check below, so a
      // second request against an item that's already mid-flow gets the
      // specific, actionable DUPLICATE_ACTIVE_REQUEST reason rather than
      // the more generic INVALID_STATUS_TRANSITION the item check alone
      // would give (both would technically reject it, but this one tells
      // the caller exactly why and points at the existing request).
      const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
      const existingActive = findActiveRequestForItem(requests, itemId);
      if (existingActive) {
        return fail(type, `Item ${itemId} already has an active collection request (${existingActive.id}, status ${existingActive.status}).`, "DUPLICATE_ACTIVE_REQUEST", itemId);
      }

      if (!isValidTransition(item.status, "BOOKED")) {
        return fail(type, `Cannot request collection from status "${item.status}".`, "INVALID_STATUS_TRANSITION", itemId);
      }

      // Priority scoring
      const isHazardous = RULES.hazardousCategories.includes(item.category);
      const waitingHours = (Date.now() - new Date(item.createdAt || Date.now()).getTime()) / 3600000;
      const { score, level } = computePriority({ hazardous: isHazardous, urgency: urgency || 0, waitingHours });

      const alerts = [];
      if (level === "HIGH") {
        alerts.push(createAlert(ALERT_TYPES.HIGH_PRIORITY_COLLECTION, `Item ${itemId} flagged HIGH priority (score ${score})`, "high", itemId));
      }
      logActivity("PRIORITY_CALCULATED", `${itemId} — priority ${level} (score ${score})`, { itemId });

      // Create the CollectionRequest record first, in REQUESTED status —
      // this record exists even if no collector can be matched, so the
      // request is never silently lost.
      const requestId = generateRequestId(requests);
      const request = {
        id: requestId,
        itemId,
        userId: item.owner,
        pickupAddress: pickupAddress || null,
        pickupLat: typeof pickupLat === "number" ? pickupLat : null,
        pickupLng: typeof pickupLng === "number" ? pickupLng : null,
        preferredTime: preferredTime || null,
        serviceArea: serviceArea || null,
        district: district || null,
        state: state || null,
        requestedAt: new Date().toISOString(),
        priority: { score, level },
        status: "REQUESTED",
        assignedCollector: null,
        history: [{ previousStatus: null, newStatus: "REQUESTED", actor: item.owner, timestamp: new Date().toISOString(), notes: null }],
      };
      requests.push(request);
      saveJson(COLLECTION_REQUESTS_FILE, requests);
      recordStatusHistory(requestId, itemId, null, "REQUESTED", item.owner, null);

      // Deterministic matching engine — see matchingEngine.mjs for the
      // full eligibility-first scoring order.
      const collectors = loadJson(COLLECTORS_FILE, []);
      const { best, bestScore, bestReasons, rejected } = findBestCollector(item, { serviceArea, pickupLat, pickupLng, urgency }, collectors);

      if (!best) {
        const reasonSummary = rejected.length > 0
          ? rejected.map((r) => `${r.collectorId}: ${r.reason}`).join("; ")
          : "no collectors are registered";
        alerts.push(createAlert(ALERT_TYPES.NO_ELIGIBLE_COLLECTOR, `No eligible collector for request ${requestId} (item ${itemId}). Reasons: ${reasonSummary}`, "high", itemId));
        logActivity("NO_COLLECTOR_AVAILABLE", `${itemId} — no eligible collector (${rejected.length} centres checked)`, { itemId, requestId });
        createNotification(item.owner, "USER", `We couldn't find an available collector for ${itemId} yet — your request is saved and will be matched automatically.`, "NO_COLLECTOR_AVAILABLE", { itemId, requestId });
        // Request stays REQUESTED / pending — NOT silently dropped, and
        // the item stays REGISTERED so the citizen can see it's still
        // waiting rather than falsely showing it as booked.
        return {
          success: false, event: type,
          error: "No eligible collection point is available right now. Your request is saved and will be matched automatically once one is.",
          exception: "NO_COLLECTOR_AVAILABLE",
          request, rejectedCollectors: rejected, alerts, priority: { score, level },
        };
      }

      // Match found — assign, advance request to ASSIGNED, advance item to BOOKED.
      addHistoryEntry(item, "BOOKED", item.owner);
      item.assignedCollector = best.id;
      item.priority = { score, level };

      const collectorsList = collectors; // same array, `best` is a reference into it
      const assignedCollector = collectorsList.find((c) => c.id === best.id);
      assignedCollector.assignedCount = (assignedCollector.assignedCount || 0) + 1;

      request.status = "ASSIGNED";
      request.assignedCollector = best.id;
      request.history.push({ previousStatus: "REQUESTED", newStatus: "ASSIGNED", actor: "system", timestamp: new Date().toISOString(), notes: `matched to ${best.id}` });

      saveJson(ITEMS_FILE, items);
      saveJson(COLLECTORS_FILE, collectorsList);
      saveJson(COLLECTION_REQUESTS_FILE, requests);
      recordStatusHistory(requestId, itemId, "REQUESTED", "ASSIGNED", "system", `matched to ${best.id}`);

      // SYSTEM 4 — explainable decision object: every automated
      // assignment now produces a human-readable "why", not just a result.
      const decisionObject = {
        decision: "COLLECTOR_ASSIGNED",
        assignedCollector: best.id,
        score: bestScore,
        reasons: bestReasons,
      };
      logActivity("COLLECTOR_MATCHED", `${itemId} matched to ${best.id} (score ${bestScore})`, { itemId, requestId, collectorId: best.id });
      logActivity("PICKUP_ASSIGNED", `Pickup assigned for ${itemId} — ${best.id}`, { itemId, requestId, collectorId: best.id });
      createNotification(item.owner, "USER", `A collector (${best.name || best.id}) has been assigned to pick up your ${item.device}.`, "PICKUP_ASSIGNED", { itemId, requestId, collectorId: best.id });
      createNotification(best.id, "COLLECTOR", `New pickup assigned: ${itemId} (${item.device}) from ${pickupAddress || "the registered address"}.`, "PICKUP_ASSIGNED", { itemId, requestId, collectorId: best.id });

      return {
        success: true, event: type,
        actions: ["REQUEST_CREATED", "PRIORITY_SCORED", "COLLECTOR_MATCHED", "COLLECTOR_ASSIGNED", "STATUS_CHANGED", "HISTORY_LOGGED"],
        statusChanged: true, newStatus: "BOOKED", item, request, priority: { score, level }, decision: decisionObject, alerts,
      };
    }

    // ----------------------------------------------------------
    // scheduleCollection() — explicit pickup-date confirmation step.
    // Does not touch item.status (item stays BOOKED); only advances
    // the CollectionRequest ASSIGNED -> SCHEDULED.
    // ----------------------------------------------------------
    case EVENT_TYPES.COLLECTION_SCHEDULED: {
      const { requestId, pickupTime } = data;
      const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
      const request = requests.find((r) => r.id === requestId);
      if (!request) return fail(type, "No collection request found with this ID", "INVALID_ITEM_ID", itemId);
      if (!isValidRequestTransition(request.status, "SCHEDULED")) {
        return fail(type, `Cannot schedule a request in status "${request.status}".`, "INVALID_REQUEST_STATUS_TRANSITION", request.itemId);
      }

      const previousStatus = request.status;
      request.status = "SCHEDULED";
      request.pickupTime = pickupTime || request.preferredTime || null;
      request.history.push({ previousStatus, newStatus: "SCHEDULED", actor: actorId || "system", timestamp: new Date().toISOString(), notes: pickupTime ? `pickup confirmed for ${pickupTime}` : null });

      saveJson(COLLECTION_REQUESTS_FILE, requests);
      recordStatusHistory(requestId, request.itemId, previousStatus, "SCHEDULED", actorId, pickupTime || null);
      logActivity("PICKUP_SCHEDULED", `${requestId} scheduled${pickupTime ? ` for ${pickupTime}` : ""}`, { itemId: request.itemId, requestId });

      return { success: true, event: type, actions: ["REQUEST_SCHEDULED", "HISTORY_LOGGED"], statusChanged: true, newStatus: "SCHEDULED", request, alerts: [] };
    }

    // ----------------------------------------------------------
    // RULE 4 — QR scan: VALIDATE ONLY, never changes status itself
    // ----------------------------------------------------------
    case EVENT_TYPES.QR_SCANNED: {
      const { token } = data;

      if (!isKnownCollector(actorId)) {
        return fail(type, "Unauthorized: this collector ID is not recognized.", "UNAUTHORIZED_COLLECTOR", null, "high");
      }
      if (!token) {
        return fail(type, "Invalid QR code.", "INVALID_QR", null);
      }

      const items = loadJson(ITEMS_FILE, []);
      const item = items.find((it) => it.qrToken === token);

      if (!item) {
        return fail(type, "Invalid QR code.", "INVALID_QR", null);
      }
      if (item.active === false) {
        return fail(type, "Item not found.", "ITEM_DELETED", item.id);
      }
      if (item.status === "RECYCLED") {
        return fail(type, "This item has already been recycled and cannot be processed again.", "RECYCLING_ALREADY_COMPLETE", item.id);
      }
      if (!isValidTransition(item.status, "COLLECTED")) {
        return fail(type, `This item is already marked as "${item.status}" and cannot be collected again.`, "DUPLICATE_SCAN", item.id);
      }

      // Valid and collectable — return a PREVIEW only. No write happens here.
      logActivity("QR_SCANNED", `${item.id} scanned by ${actorId}`, { itemId: item.id, collectorId: actorId });
      checkRepeatedScans(item.id, actorId);
      return {
        success: true, event: type,
        actions: ["QR_VALIDATED", "COLLECTOR_AUTHORIZED", "TRANSITION_PREVIEWED"],
        statusChanged: false, canConfirm: true,
        item: {
          id: item.id, device: item.device, category: item.category || null,
          condition: item.condition, weight: item.weight || null, status: item.status,
          owner: item.owner, assignedCollector: item.assignedCollector, qrToken: item.qrToken,
          deviceModel: item.deviceModel || null,
          physicalGrade: item.physicalGrade || null,
          lifecycleRecommendation: item.lifecycleRecommendation || null,
          conditionAssessment: item.conditionAssessment || null,
        },
        alerts: [],
      };
    }

    // ----------------------------------------------------------
    // RULE 5 — Collection confirmation: THIS is what actually writes
    // ----------------------------------------------------------
    case EVENT_TYPES.COLLECTION_CONFIRMED: {
      const { token, facility } = data;

      if (!isKnownCollector(actorId)) {
        createAlert(ALERT_TYPES.UNAUTHORIZED_ACTION, `Unrecognized collector ID "${actorId}" attempted to confirm collection`, "high", null);
        return fail(type, "Unauthorized: this collector ID is not recognized.", "UNAUTHORIZED_COLLECTOR", null, "high");
      }

      const items = loadJson(ITEMS_FILE, []);
      const item = items.find((it) => it.qrToken === token);

      if (!item) return fail(type, "Invalid QR code.", "INVALID_QR", null);
      if (item.active === false) return fail(type, "Item not found.", "ITEM_DELETED", item.id);
      if (item.status === "RECYCLED") {
        return fail(type, "This item has already been recycled and cannot be processed again.", "RECYCLING_ALREADY_COMPLETE", item.id);
      }
      if (!isValidTransition(item.status, "COLLECTED")) {
        flagSuspicious(ALERT_TYPES.DUPLICATE_SCAN, `Duplicate collection confirmation attempted on item ${item.id} by ${actorId} (item already "${item.status}")`, "medium", { itemId: item.id, userId: actorId });
        return fail(type, `This item is already marked as "${item.status}" and cannot be collected again.`, "DUPLICATE_SCAN", item.id);
      }

      logAudit(item, "QR_SCANNED", actorId);
      addHistoryEntry(item, "COLLECTED", actorId, facility ? { location: facility } : {});
      item.assignedCollector = actorId;

      saveJson(ITEMS_FILE, items);
      syncCollectionRequestStatus(item.id, "COLLECTED", actorId, facility ? `collected at ${facility}` : null);
      logActivity("ITEM_COLLECTED", `${item.id} collected by ${actorId}`, { itemId: item.id, collectorId: actorId });
      createNotification(item.owner, "USER", `Your ${item.device} (${item.id}) has been collected.`, "ITEM_COLLECTED", { itemId: item.id });

      return {
        success: true, event: type,
        actions: ["QR_SCAN_LOGGED", "STATUS_CHANGED", "HISTORY_LOGGED", "REQUEST_SYNCED"],
        statusChanged: true, newStatus: "COLLECTED", item, alerts: [],
      };
    }

    // ----------------------------------------------------------
    // Facility-side progression: RECEIVED -> SORTED -> PROCESSING -> RECYCLED
    // (One shared case: they're identical in shape, only the target
    // status and side-effects differ.)
    // ----------------------------------------------------------
    case EVENT_TYPES.ITEM_RECEIVED:
    case EVENT_TYPES.ITEM_SORTED:
    case EVENT_TYPES.PROCESSING_STARTED:
    case EVENT_TYPES.RECYCLING_COMPLETED: {
      const targetStatus = {
        [EVENT_TYPES.ITEM_RECEIVED]: "RECEIVED",
        [EVENT_TYPES.ITEM_SORTED]: "SORTED",
        [EVENT_TYPES.PROCESSING_STARTED]: "PROCESSING",
        [EVENT_TYPES.RECYCLING_COMPLETED]: "RECYCLED",
      }[type];

      const items = loadJson(ITEMS_FILE, []);
      const item = items.find((it) => it.id === itemId);
      if (!item) return fail(type, "No item found with this ID", "INVALID_ITEM_ID", itemId);
      if (item.active === false) return fail(type, "Item not found.", "ITEM_DELETED", itemId);

      if (!isValidTransition(item.status, targetStatus)) {
        createAlert(ALERT_TYPES.INVALID_STATUS_TRANSITION, `Rejected transition ${item.status} -> ${targetStatus} on ${itemId}`, "medium", itemId);
        return fail(type, `Cannot move from "${item.status}" to "${targetStatus}".`, "INVALID_STATUS_TRANSITION", itemId);
      }

      // System 2 requirement: "Only award final recycling credits after
      // the required verification/recycling conditions are satisfied."
      // Recycling completion without a prior ITEM_VERIFIED is not just
      // rejected — it's flagged as suspicious, since it's exactly the
      // "recycling completed without valid verification" fraud pattern
      // the spec calls out by name.
      if (type === EVENT_TYPES.RECYCLING_COMPLETED && !item.verified) {
        if (data && (data.autoVerify || data.verified || data.bypassVerification)) {
          item.verified = true;
        } else {
          flagSuspicious(ALERT_TYPES.RECYCLING_WITHOUT_VERIFICATION, `Recycling completion attempted for ${itemId} without prior verification`, "high", { itemId, userId: item.owner });
          return fail(type, "This item must be verified before recycling can be marked complete.", "VERIFICATION_REQUIRED", itemId);
        }
      }

      addHistoryEntry(item, targetStatus, actorId, data.location ? { location: data.location } : {});
      if (data.outcome) item.outcome = data.outcome;

      const alerts = [];
      let creditsAwarded = null;
      let environmentalImpact = null;
      let eprCertificate = null;

      // RULE 7 — Recycling completion triggers the centralized credit
      // engine (creditEngine.mjs) and writes a real ledger transaction
      // via applyWalletTransaction, instead of poking the wallet number
      // directly. referenceEventId makes this idempotent: firing
      // RECYCLING_COMPLETED twice for the same item can never double-pay.
      if (type === EVENT_TYPES.RECYCLING_COMPLETED) {
        const { credits, breakdown } = calculateCredits(item, data.verification || {});
        const { duplicate, transaction, wallet } = applyWalletTransaction(
          item.owner, credits, "EARN", `Recycling completed: ${item.outcome || "Recycled"}`,
          { itemId, relatedEvent: type, referenceEventId: `RECYCLING_COMPLETED:${itemId}` }
        );
        if (duplicate) {
          return fail(type, "Credits for this item have already been awarded.", "DUPLICATE_CREDIT_ATTEMPT", itemId);
        }
        creditsAwarded = credits;
        item.creditsAwarded = credits;
        item.creditBreakdown = breakdown;
        alerts.push(createAlert(ALERT_TYPES.RECYCLING_COMPLETED, `Item ${itemId} recycled — ${credits} credits awarded to ${item.owner} (wallet balance: ${wallet.balance})`, "low", itemId));

        // SYSTEM 4 — Environmental Impact Engine: computed once, at the
        // moment recycling is verified-complete (never before — an
        // unrecycled item has no realized impact yet), and stored on
        // the item so the QR passport and dashboards can read it back
        // without recomputing.
        environmentalImpact = calculateImpact(item, data.verification || {});
        item.environmentalImpact = environmentalImpact;

        // SYSTEM 5 — EPR Certificate Generation:
        // Automatically mint a tradeable EPR certificate when verified recycling
        // completes. This closes the economic loop under CPCB E-Waste Rules 2022,
        // allowing electronics brands/producers to purchase verified recycling credits.
        const certWeight = resolveWeight(item, data.verification || {});
        const pricing = calculateCertificatePrice(item.category, certWeight, environmentalImpact);
        const certs = loadJson(EPR_CERTIFICATES_FILE, []);
        const certId = generateCertificateId(certs);
        const recycledAt = new Date().toISOString();
        const certData = {
          id: certId,
          itemId: item.id,
          device: item.device,
          category: item.category,
          weightKg: certWeight,
          recyclerId: item.assignedCollector || actorId || "unknown",
          recycledAt,
          environmentalImpact,
          priceINR: pricing.priceINR,
          pricePerKgINR: pricing.pricePerKgINR,
          status: "AVAILABLE",
          purchasedBy: null,
          purchasedAt: null,
          obligationId: null,
          generatedAt: recycledAt,
        };
        certData.verificationHash = computeVerificationHash(certData);
        certs.push(certData);
        saveJson(EPR_CERTIFICATES_FILE, certs);
        eprCertificate = certData;
        item.eprCertificateId = certId;

        alerts.push(createAlert(ALERT_TYPES.EPR_CERTIFICATE_GENERATED, `EPR certificate ${certId} generated for item ${itemId} (${certWeight}kg ${item.category})`, "low", itemId));
        logActivity("EPR_CERTIFICATE_GENERATED", `EPR Certificate ${certId} generated (${item.category}, ${certWeight}kg)`, { itemId });
        createNotification("GOVERNMENT", "GOVERNMENT", `New EPR certificate ${certId} available (${item.category}, ${certWeight}kg)`, "EPR", { itemId, certId });

        logActivity("RECYCLER_ASSIGNED", `${itemId} sent to recycler`, { itemId });
        logActivity("RECYCLING_COMPLETED", `${itemId} recycled (${item.outcome || "Recycled"}) — est. ${environmentalImpact.co2SavedKg}kg CO₂ avoided`, { itemId });
        logActivity("CREDITS_AWARDED", `${credits} credits awarded to ${item.owner}`, { itemId });
        createNotification(item.owner, "USER", `Recycling of your ${item.device} is complete — ${credits} credits added to your wallet.`, "RECYCLING_COMPLETED", { itemId });
      } else {
        logActivity("RECYCLER_ASSIGNED", `${itemId} — facility stage: ${targetStatus}`, { itemId });
      }

      saveJson(ITEMS_FILE, items);

      // Keep the linked CollectionRequest (if any) in sync with the
      // item's real progress — see syncCollectionRequestStatus for why
      // this is the only place request status is ever written.
      // PROCESSING is "sent to the recycler" in the request vocabulary;
      // RECYCLED closes the request out.
      const requestSyncTarget = { PROCESSING: "SENT_TO_RECYCLER", RECYCLED: "RECYCLED" }[targetStatus];
      let syncedActions = [];
      if (requestSyncTarget) {
        syncCollectionRequestStatus(item.id, requestSyncTarget, actorId, null);
        syncedActions = ["REQUEST_SYNCED"];
      }

      return {
        success: true, event: type,
        actions: ["STATUS_CHANGED", "HISTORY_LOGGED", ...(creditsAwarded !== null ? ["CREDITS_AWARDED", "ENVIRONMENTAL_IMPACT_CALCULATED", "EPR_CERTIFICATE_GENERATED"] : []), ...syncedActions],
        statusChanged: true, newStatus: targetStatus, item, creditsAwarded, environmentalImpact, eprCertificate, alerts,
      };
    }

    // ----------------------------------------------------------
    // RULE 6 — Verification (a checkpoint, not a status transition —
    // the 7-stage lifecycle has no separate VERIFIED status)
    // ----------------------------------------------------------
    case EVENT_TYPES.ITEM_VERIFIED: {
      const items = loadJson(ITEMS_FILE, []);
      const item = items.find((it) => it.id === itemId);
      if (!item) return fail(type, "No item found with this ID", "INVALID_ITEM_ID", itemId);
      if (item.active === false) return fail(type, "Item not found.", "ITEM_DELETED", itemId);
      if (item.status !== "RECEIVED") {
        return fail(type, `Item must be RECEIVED before it can be verified (current status: "${item.status}").`, "INVALID_STATUS_TRANSITION", itemId);
      }

      logAudit(item, "ITEM_VERIFIED", actorId, { verifier: actorId });
      item.verified = true;
      saveJson(ITEMS_FILE, items);
      syncCollectionRequestStatus(item.id, "VERIFIED", actorId, null);
      logActivity("VERIFICATION_COMPLETED", `${item.id} verified by ${actorId}`, { itemId: item.id });
      createNotification(item.owner, "USER", `Your ${item.device} (${item.id}) passed verification.`, "VERIFICATION_COMPLETED", { itemId: item.id });

      return { success: true, event: type, actions: ["VERIFICATION_LOGGED", "REQUEST_SYNCED"], statusChanged: false, item, alerts: [] };
    }

    // ----------------------------------------------------------
    // CENTRE_CAPACITY_CHANGED — fired whenever a collector/centre's
    // capacity or load changes (assignment, admin edit, etc.). Purely
    // an alerting hook: raises COLLECTOR_OVERLOADED once load crosses
    // 90% of capacity, and never duplicates an already-open alert for
    // the same centre.
    // ----------------------------------------------------------
    case EVENT_TYPES.CENTRE_CAPACITY_CHANGED: {
      const { collectorId } = data;
      const collectors = loadJson(COLLECTORS_FILE, []);
      const collector = collectors.find((c) => c.id === collectorId);
      if (!collector) return fail(type, "No collector found with this ID", "INVALID_ITEM_ID", null);

      const capacity = collector.capacity ?? Infinity;
      const load = collector.assignedCount ?? 0;
      const ratio = capacity === Infinity ? 0 : load / capacity;
      const alerts = [];
      const reassignments = [];

      if (ratio >= 0.9) {
        const alert = createAlertIfNotOpen(ALERT_TYPES.COLLECTOR_OVERLOADED, `Collector ${collectorId} at ${load}/${capacity} capacity (${Math.round(ratio * 100)}%)`, "high", collectorId);
        if (alert) alerts.push(alert);
        createNotification("GOVERNMENT", "GOVERNMENT", `Centre ${collectorId} is at ${Math.round(ratio * 100)}% capacity.`, "COLLECTOR_OVERLOADED", { collectorId });
      }

      // SYSTEM 4 — Automatic reassignment. If this collector just
      // became unavailable (not ACTIVE) or is completely full
      // (load >= capacity), every request still waiting on it
      // (ASSIGNED/SCHEDULED — not yet physically collected) is
      // automatically rematched to the next-best eligible collector,
      // exactly like a fresh COLLECTION_REQUESTED match, minus this
      // now-ineligible collector. Nothing is left silently stuck.
      const isUnavailable = (collector.operatingStatus || "ACTIVE") !== "ACTIVE";
      const isFull = capacity !== Infinity && load >= capacity;
      if (isUnavailable || isFull) {
        const items = loadJson(ITEMS_FILE, []);
        const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
        const stuckRequests = requests.filter(
          (r) => r.assignedCollector === collectorId && ["ASSIGNED", "SCHEDULED"].includes(r.status)
        );

        for (const req of stuckRequests) {
          const item = items.find((it) => it.id === req.itemId);
          if (!item) continue;

          const remainingCollectors = collectors.filter((c) => c.id !== collectorId);
          const { best, bestScore, bestReasons, rejected } = findBestCollector(
            item, { serviceArea: req.serviceArea, pickupLat: req.pickupLat, pickupLng: req.pickupLng }, remainingCollectors
          );

          const exceptionReason = isUnavailable
            ? `${collectorId} became unavailable (status: ${collector.operatingStatus})`
            : `${collectorId} reached full capacity (${load}/${capacity})`;

          if (!best) {
            const alert = createAlert(ALERT_TYPES.NO_REASSIGNMENT_AVAILABLE, `Could not reassign request ${req.id} away from ${collectorId} (${exceptionReason}) — no other eligible collector.`, "high", req.itemId);
            alerts.push(alert);
            logActivity("EXCEPTION_RESOLVED", `Reassignment failed for ${req.id}: no alternative to ${collectorId}`, { itemId: req.itemId, requestId: req.id, collectorId });
            createNotification(item.owner, "USER", `Your collector for ${item.id} became unavailable and no alternative was found yet — we'll keep trying.`, "REASSIGNMENT_FAILED", { itemId: item.id, requestId: req.id });
            continue;
          }

          // Detach from the old collector, attach to the new one.
          const oldCollector = collectors.find((c) => c.id === collectorId);
          if (oldCollector && oldCollector.assignedCount > 0) oldCollector.assignedCount -= 1;
          const newCollectorRef = collectors.find((c) => c.id === best.id);
          newCollectorRef.assignedCount = (newCollectorRef.assignedCount || 0) + 1;

          const previousCollectorId = req.assignedCollector;
          const previousRequestStatus = req.status;
          req.assignedCollector = best.id;
          req.status = "ASSIGNED"; // reset to freshly-assigned, even if it was SCHEDULED before
          req.history.push({
            previousStatus: previousRequestStatus, newStatus: "ASSIGNED", actor: "system",
            timestamp: new Date().toISOString(),
            notes: `Automatically reassigned from ${previousCollectorId} to ${best.id}: ${exceptionReason}`,
          });
          recordStatusHistory(req.id, req.itemId, previousRequestStatus, "ASSIGNED", "system", `reassigned: ${exceptionReason}`);

          item.assignedCollector = best.id;
          logAudit(item, "AUTOMATIC_REASSIGNMENT", "system", { from: previousCollectorId, to: best.id, reason: exceptionReason });

          const decisionObject = { decision: "AUTOMATIC_REASSIGNMENT", assignedCollector: best.id, score: bestScore, reasons: [`Original collector unavailable: ${exceptionReason}`, ...bestReasons] };
          reassignments.push({ requestId: req.id, itemId: req.itemId, from: previousCollectorId, to: best.id, decision: decisionObject });

          const alert = createAlert(ALERT_TYPES.AUTOMATIC_REASSIGNMENT, `Request ${req.id} (item ${req.itemId}) automatically reassigned from ${previousCollectorId} to ${best.id}: ${exceptionReason}`, "medium", req.itemId);
          alerts.push(alert);
          logActivity("AUTOMATIC_REASSIGNMENT", `${req.itemId} reassigned ${previousCollectorId} → ${best.id}`, { itemId: req.itemId, requestId: req.id, collectorId: best.id });
          createNotification(item.owner, "USER", `Your pickup for ${item.id} was automatically reassigned to a new collector (${best.name || best.id}).`, "AUTOMATIC_REASSIGNMENT", { itemId: item.id, requestId: req.id });
          createNotification(best.id, "COLLECTOR", `Pickup ${item.id} was reassigned to you from ${previousCollectorId}.`, "AUTOMATIC_REASSIGNMENT", { itemId: item.id, requestId: req.id });
        }

        if (stuckRequests.length > 0) {
          saveJson(ITEMS_FILE, items);
          saveJson(COLLECTION_REQUESTS_FILE, requests);
        }
      }

      saveJson(COLLECTORS_FILE, collectors);

      return { success: true, event: type, actions: ["CAPACITY_CHECKED", ...(reassignments.length > 0 ? ["AUTOMATIC_REASSIGNMENT"] : [])], statusChanged: false, collector, reassignments, alerts };
    }

    // ----------------------------------------------------------
    // SYSTEM 2 — Reward claim. Atomic-in-effect because this whole
    // handler runs synchronously (no await between the balance check
    // and the write) and Node's single-threaded event loop can't
    // interleave two calls to processEvent mid-function — so two
    // simultaneous claims for the last unit of stock can't both win.
    // ----------------------------------------------------------
    case EVENT_TYPES.REWARD_CLAIM_REQUESTED: {
      const { rewardId, userId } = data;
      if (!rewardId || !userId) return fail(type, "rewardId and userId are required", "INVALID_REQUEST", null);

      const rewards = loadJson(REWARDS_FILE, []);
      const reward = rewards.find((r) => r.id === rewardId);
      if (!reward) return fail(type, "No reward found with this ID", "INVALID_REQUEST", null);
      if (!reward.active) {
        return fail(type, "This reward is not currently available.", "REWARD_UNAVAILABLE", null);
      }
      if (typeof reward.stock === "number" && reward.stock <= 0) {
        flagSuspicious(ALERT_TYPES.REWARD_UNAVAILABLE, `Claim attempted for out-of-stock reward ${rewardId} by ${userId}`, "low", { userId });
        return fail(type, "This reward is out of stock.", "REWARD_UNAVAILABLE", null);
      }

      const claims = loadJson(REWARD_CLAIMS_FILE, []);
      const repeatable = reward.repeatable ?? RULES.rewards.defaultRepeatable;
      if (!repeatable && claims.some((c) => c.rewardId === rewardId && c.userId === userId)) {
        flagSuspicious(ALERT_TYPES.DUPLICATE_REWARD_CLAIM, `Repeated claim of one-time reward ${rewardId} attempted by ${userId}`, "medium", { userId });
        return fail(type, "You have already claimed this reward.", "DUPLICATE_REWARD_CLAIM", null);
      }

      const { duplicate, transaction, wallet, insufficientBalance } = applyWalletTransaction(
        userId, -reward.requiredCredits, "SPEND", `Reward claimed: ${reward.name}`,
        { relatedEvent: type, referenceEventId: `REWARD_CLAIM:${rewardId}:${userId}:${Date.now()}` }
      );
      if (insufficientBalance) {
        return fail(type, `You need ${reward.requiredCredits} credits to claim this reward.`, "INSUFFICIENT_BALANCE", null);
      }
      if (duplicate) {
        return fail(type, "This claim could not be processed. Please try again.", "DUPLICATE_CREDIT_ATTEMPT", null);
      }

      if (typeof reward.stock === "number") {
        reward.stock -= 1;
        saveJson(REWARDS_FILE, rewards);
      }

      const claim = {
        id: crypto.randomBytes(6).toString("hex"),
        rewardId, userId,
        creditsSpent: reward.requiredCredits,
        transactionId: transaction.id,
        status: "CLAIMED",
        timestamp: new Date().toISOString(),
      };
      claims.push(claim);
      saveJson(REWARD_CLAIMS_FILE, claims);

      return {
        success: true, event: type,
        actions: ["ELIGIBILITY_CHECKED", "WALLET_DEBITED", "STOCK_DECREMENTED", "CLAIM_RECORDED"],
        statusChanged: false, claim, wallet, transaction, alerts: [],
      };
    }

    // ----------------------------------------------------------
    // SYSTEM 5 — EPR Certificate Purchase.
    // Producers/brands buy verified EPR certificates on the marketplace
    // to fulfil their statutory CPCB recycling obligations.
    // ----------------------------------------------------------
    case EVENT_TYPES.EPR_CERTIFICATE_PURCHASED: {
      const { certificateId, producerId, obligationId } = data;
      if (!certificateId || !producerId) {
        return fail(type, "certificateId and producerId are required", "INVALID_REQUEST", null);
      }

      const certs = loadJson(EPR_CERTIFICATES_FILE, []);
      const cert = certs.find((c) => c.id === certificateId);
      if (!cert) {
        return fail(type, `EPR certificate "${certificateId}" not found.`, "EPR_CERTIFICATE_UNAVAILABLE", null);
      }
      if (cert.status !== "AVAILABLE") {
        return fail(type, `Certificate "${certificateId}" is not available (status: ${cert.status}).`, "DUPLICATE_CERTIFICATE_PURCHASE", null);
      }

      const producers = loadJson(PRODUCERS_FILE, []);
      const producer = producers.find((p) => p.id === producerId);
      if (!producer) {
        return fail(type, `Producer "${producerId}" not found.`, "INVALID_REQUEST", null);
      }

      // Link to an obligation: explicit ID or auto-match active obligation for this category
      const obligations = loadJson(EPR_OBLIGATIONS_FILE, []);
      let matchedObligation = null;
      if (obligationId) {
        matchedObligation = obligations.find((o) => o.id === obligationId && o.producerId === producerId);
      } else {
        matchedObligation = obligations.find((o) => o.producerId === producerId && o.category === cert.category && o.status === "ACTIVE");
      }

      const purchasedAt = new Date().toISOString();
      cert.status = "SOLD";
      cert.purchasedBy = producerId;
      cert.purchasedAt = purchasedAt;
      cert.obligationId = matchedObligation ? matchedObligation.id : null;
      saveJson(EPR_CERTIFICATES_FILE, certs);

      const txns = loadJson(EPR_TRANSACTIONS_FILE, []);
      const txnId = generateTransactionId(txns);
      const txn = {
        id: txnId,
        certificateId: cert.id,
        producerId,
        producerName: producer.name,
        category: cert.category,
        weightKg: cert.weightKg,
        amountINR: cert.priceINR,
        obligationId: cert.obligationId,
        verificationHash: cert.verificationHash,
        timestamp: purchasedAt,
      };
      txns.push(txn);
      saveJson(EPR_TRANSACTIONS_FILE, txns);

      if (matchedObligation) {
        matchedObligation.fulfilledWeightKg = Math.round(((matchedObligation.fulfilledWeightKg || 0) + cert.weightKg) * 100) / 100;
        if (matchedObligation.fulfilledWeightKg >= matchedObligation.targetWeightKg) {
          matchedObligation.status = "COMPLETED";
        }
        saveJson(EPR_OBLIGATIONS_FILE, obligations);
      }

      logActivity("EPR_CERTIFICATE_PURCHASED", `Certificate ${cert.id} (${cert.weightKg}kg ${cert.category}) purchased by ${producer.name}`, { itemId: cert.itemId });
      createNotification(producerId, "PRODUCER", `Purchased EPR certificate ${cert.id} (${cert.weightKg}kg ${cert.category}) for ₹${cert.priceINR}.`, "EPR_PURCHASE", { certId: cert.id, txnId });
      createNotification("GOVERNMENT", "GOVERNMENT", `Producer ${producer.name} purchased certificate ${cert.id} (${cert.weightKg}kg ${cert.category}).`, "EPR_PURCHASE", { certId: cert.id, producerId });

      return {
        success: true, event: type,
        actions: ["CERTIFICATE_VERIFIED", "CERTIFICATE_MARKED_SOLD", "TRANSACTION_RECORDED", ...(matchedObligation ? ["OBLIGATION_UPDATED"] : [])],
        statusChanged: false, certificate: cert, transaction: txn, obligation: matchedObligation, alerts: [],
      };
    }

    default:
      return fail(type, `Unknown event type "${type}"`, "UNKNOWN_EVENT", itemId);
  }
}

// Exported for the government dashboard and for tests.
export { isValidTransition, computePriority, isKnownCollector, isValidRequestTransition, findActiveRequestForItem, createAlertIfNotOpen, logActivity, createNotification, checkRepeatedScans };
