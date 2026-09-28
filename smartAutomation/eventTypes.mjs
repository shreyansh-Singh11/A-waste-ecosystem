// All event names the Decision Engine understands, in one place.
// Anything that changes an item's state in this project should be
// expressed as one of these events — nothing else should be
// hand-writing status changes directly into items.json.
export const EVENT_TYPES = Object.freeze({
  ITEM_CREATED: "ITEM_CREATED",
  AI_IDENTIFIED: "AI_IDENTIFIED",
  COLLECTION_REQUESTED: "COLLECTION_REQUESTED",
  COLLECTION_ASSIGNED: "COLLECTION_ASSIGNED",
  QR_SCANNED: "QR_SCANNED",
  COLLECTION_CONFIRMED: "COLLECTION_CONFIRMED",
  ITEM_RECEIVED: "ITEM_RECEIVED",
  ITEM_VERIFIED: "ITEM_VERIFIED",
  ITEM_SORTED: "ITEM_SORTED",
  PROCESSING_STARTED: "PROCESSING_STARTED",
  RECYCLING_COMPLETED: "RECYCLING_COMPLETED",
  ITEM_RECYCLED: "ITEM_RECYCLED", // the resulting state after RECYCLING_COMPLETED — see README note
  EXCEPTION_DETECTED: "EXCEPTION_DETECTED",

  // ---- System 1: Collection & Recycler additions ----
  COLLECTION_SCHEDULED: "COLLECTION_SCHEDULED",
  CENTRE_CAPACITY_CHANGED: "CENTRE_CAPACITY_CHANGED",

  // ---- System 2: Credit, Reward & Verification additions ----
  REWARD_CLAIM_REQUESTED: "REWARD_CLAIM_REQUESTED",

  // ---- System 5: EPR Marketplace additions ----
  EPR_CERTIFICATE_GENERATED: "EPR_CERTIFICATE_GENERATED",
  EPR_CERTIFICATE_PURCHASED: "EPR_CERTIFICATE_PURCHASED",
});

// Alert types stored in data/alerts.json when something needs a human's
// attention. Kept intentionally simple — one flat list, no notification
// service, no email/SMS integration.
export const ALERT_TYPES = Object.freeze({
  HIGH_PRIORITY_COLLECTION: "HIGH_PRIORITY_COLLECTION",
  NO_COLLECTOR_AVAILABLE: "NO_COLLECTOR_AVAILABLE",
  INVALID_QR: "INVALID_QR",
  DUPLICATE_SCAN: "DUPLICATE_SCAN",
  UNAUTHORIZED_ACTION: "UNAUTHORIZED_ACTION",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  LOW_AI_CONFIDENCE: "LOW_AI_CONFIDENCE",
  PROCESSING_DELAY: "PROCESSING_DELAY",
  RECYCLING_COMPLETED: "RECYCLING_COMPLETED",

  // ---- System 1 additions ----
  NO_ELIGIBLE_COLLECTOR: "NO_ELIGIBLE_COLLECTOR",
  COLLECTOR_OVERLOADED: "COLLECTOR_OVERLOADED",
  DUPLICATE_ACTIVE_REQUEST: "DUPLICATE_ACTIVE_REQUEST",
  INVALID_REQUEST_STATUS_TRANSITION: "INVALID_REQUEST_STATUS_TRANSITION",

  // ---- System 2 additions (also written to data/suspiciousActivity.json) ----
  RECYCLING_WITHOUT_VERIFICATION: "RECYCLING_WITHOUT_VERIFICATION",
  DUPLICATE_CREDIT_ATTEMPT: "DUPLICATE_CREDIT_ATTEMPT",
  DUPLICATE_REWARD_CLAIM: "DUPLICATE_REWARD_CLAIM",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  REWARD_UNAVAILABLE: "REWARD_UNAVAILABLE",
  REPEATED_QR_SCANS: "REPEATED_QR_SCANS",

  // ---- System 3 additions (created by governmentAnalytics.mjs's compliance scan) ----
  REQUEST_UNASSIGNED_TOO_LONG: "REQUEST_UNASSIGNED_TOO_LONG",
  DELAYED_COLLECTION: "DELAYED_COLLECTION",
  DELAYED_RECYCLING: "DELAYED_RECYCLING",
  NON_COMPLIANT_RECYCLER_ACTIVE: "NON_COMPLIANT_RECYCLER_ACTIVE",
  INACTIVE_RECYCLER_ACTIVE: "INACTIVE_RECYCLER_ACTIVE",

  // ---- System 4 additions (automatic reassignment) ----
  AUTOMATIC_REASSIGNMENT: "AUTOMATIC_REASSIGNMENT",
  NO_REASSIGNMENT_AVAILABLE: "NO_REASSIGNMENT_AVAILABLE",

  // ---- System 5 additions (EPR Marketplace) ----
  EPR_CERTIFICATE_GENERATED: "EPR_CERTIFICATE_GENERATED",
  EPR_OBLIGATION_NEAR_DEADLINE: "EPR_OBLIGATION_NEAR_DEADLINE",
  EPR_OBLIGATION_NON_COMPLIANT: "EPR_OBLIGATION_NON_COMPLIANT",
  DUPLICATE_CERTIFICATE_PURCHASE: "DUPLICATE_CERTIFICATE_PURCHASE",
  EPR_CERTIFICATE_UNAVAILABLE: "EPR_CERTIFICATE_UNAVAILABLE",
});

// Labels for the live Smart Automation activity feed (data/activityFeed.json).
// Kept as plain, presentation-ready strings — the feed is meant to be
// displayed as-is, not re-interpreted by the frontend.
export const ACTIVITY_LABELS = Object.freeze({
  ITEM_REGISTERED: "New e-waste registered",
  AI_IDENTIFIED: "AI identification completed",
  ITEM_CONFIRMED: "Item confirmed by owner",
  PRIORITY_CALCULATED: "Priority calculated",
  COLLECTOR_MATCHED: "Collector matched",
  PICKUP_ASSIGNED: "Pickup assigned",
  PICKUP_SCHEDULED: "Pickup scheduled",
  QR_SCANNED: "QR code scanned",
  ITEM_COLLECTED: "Item collected",
  VERIFICATION_COMPLETED: "Verification completed",
  RECYCLER_ASSIGNED: "Item sent to recycler",
  RECYCLING_COMPLETED: "Recycling completed",
  CREDITS_AWARDED: "Credits awarded",
  SUSPICIOUS_ACTIVITY: "Suspicious activity detected",
  AUTOMATIC_REASSIGNMENT: "Automatic reassignment triggered",
  EXCEPTION_RESOLVED: "Exception resolved",
  NO_COLLECTOR_AVAILABLE: "No eligible collector found",
  EPR_CERTIFICATE_GENERATED: "EPR certificate generated",
  EPR_CERTIFICATE_PURCHASED: "EPR certificate purchased",
});
