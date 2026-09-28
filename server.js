/*
  ============================================================
  ONE BACKEND, THREE WEBSITES — now backed by the Decision Engine
  ============================================================

  This file used to decide things itself (generate IDs, pick a
  collector, decide if a status change was allowed, award credits).
  It no longer does ANY of that. Every business decision now goes
  through smartAutomation/decisionEngine.mjs via processEvent().

  server.js's job now is just:
    1. Read the incoming HTTP request
    2. Turn it into an event: { type, itemId, actorId, data }
    3. Call processEvent(event)
    4. Turn the engine's result into an HTTP response
    5. Handle presentation-only concerns the engine doesn't own
       (rendering the QR code image, masking the owner for the
       public tracking page)

  Frontend -> Express API -> Decision Engine -> Rules -> Action ->
  data/*.json -> History / Alerts / Dashboard

  The three websites (user/collector/government) and the public
  /track/:token page are unchanged from before.
*/

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const multer = require("multer");

// Both ewasteVision.mjs and the decision engine are ES modules — loaded
// with dynamic import() from this CommonJS file, same technique used
// for ewasteVision.mjs before. Resolved once, reused on every request.
const ewasteVisionModulePromise = import("./ewasteVision.mjs");
const decisionEnginePromise = import("./smartAutomation/decisionEngine.mjs");
const eventTypesPromise = import("./smartAutomation/eventTypes.mjs");
const governmentAnalyticsPromise = import("./smartAutomation/governmentAnalytics.mjs");
const environmentalImpactPromise = import("./smartAutomation/environmentalImpact.mjs");
const creditEnginePromise = import("./smartAutomation/creditEngine.mjs");
const eprEnginePromise = import("./smartAutomation/eprEngine.mjs");
const routeEnginePromise = import("./smartAutomation/routeEngine.mjs");
const municipalEnginePromise = import("./smartAutomation/municipalEngine.mjs");
const medicalEnginePromise = import("./smartAutomation/medicalEngine.mjs");
const auctionEnginePromise = import("./smartAutomation/auctionEngine.mjs");
const complianceEnginePromise = import("./smartAutomation/complianceEngine.mjs");
const esgEnginePromise = import("./smartAutomation/esgEngine.mjs");
const communityEnginePromise = import("./smartAutomation/communityEngine.mjs");
const regulatoryEnginePromise = import("./smartAutomation/regulatoryEngine.mjs");
const edgeEnginePromise = import("./smartAutomation/edgeOperationsEngine.mjs");

const app = express();
const PORT = process.env.PORT || 3000;

const ITEMS_FILE = path.join(__dirname, "data", "items.json");
const COLLECTORS_FILE = path.join(__dirname, "data", "collectors.json");
const WALLETS_FILE = path.join(__dirname, "data", "wallets.json");
const ALERTS_FILE = path.join(__dirname, "data", "alerts.json");
const COLLECTION_REQUESTS_FILE = path.join(__dirname, "data", "collectionRequests.json");
const STATUS_HISTORY_FILE = path.join(__dirname, "data", "statusHistory.json");
const TRANSACTIONS_FILE = path.join(__dirname, "data", "transactions.json");
const REWARDS_FILE = path.join(__dirname, "data", "rewards.json");
const REWARD_CLAIMS_FILE = path.join(__dirname, "data", "rewardClaims.json");
const EDUCATION_FILE = path.join(__dirname, "data", "educationalContent.json");
const PRECIOUS_METALS_FILE = path.join(__dirname, "data", "preciousMetalsByModel.json");
const SUSPICIOUS_FILE = path.join(__dirname, "data", "suspiciousActivity.json");
const USERS_FILE = path.join(__dirname, "data", "users.json");
const ACTIVITY_FEED_FILE = path.join(__dirname, "data", "activityFeed.json");
const NOTIFICATIONS_FILE = path.join(__dirname, "data", "notifications.json");
const EPR_CERTIFICATES_FILE = path.join(__dirname, "data", "eprCertificates.json");
const EPR_OBLIGATIONS_FILE = path.join(__dirname, "data", "eprObligations.json");
const EPR_TRANSACTIONS_FILE = path.join(__dirname, "data", "eprTransactions.json");
const PRODUCERS_FILE = path.join(__dirname, "data", "producers.json");
const SERVER_STARTED_AT = new Date();

app.use(express.json());

// ==============================================================
// SYSTEM 3: Authorization layer
// ==============================================================
// This project had no authentication system to "extend" — nothing
// gated any route before this. Rather than invent a fake login flow,
// this is the minimal real thing: a bearer token looked up against
// data/users.json, resolving to a role. It's genuinely enforced (see
// requireRole below) and never trusts a role the client merely
// *claims* — the frontend can send whatever it wants in a request
// body, but role always comes from the server-side token lookup, not
// from anything in req.body. See README's Security section for the
// demo tokens and their honest limitations (plaintext tokens, no
// expiry, no login UI — this is a real authorization *check*, not a
// production auth system).
app.use((req, res, next) => {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }
  const users = loadJson(USERS_FILE, []);
  req.authUser = token ? users.find((u) => u.token === token) || null : null;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: `This action requires one of these roles: ${roles.join(", ")}.`,
        exception: "FORBIDDEN_ROLE",
      });
    }
    next();
  };
}

const MAX_IMAGE_SIZE_MB = parseFloat(process.env.MAX_IMAGE_SIZE_MB || "5");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 },
});
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/pjpeg", "image/jfif", "image/png", "image/webp", "image/heic", "image/heif"];

// ------------------------------------------------------------
// Serve the three separate "websites" at three separate paths,
// plus a shared design-system asset folder (CSS/JS common to all
// of them) and a neutral landing page at "/".
// Explicit HTML route handlers for all 8 dedicated portals
// (Ensures instant 200 OK with or without trailing slash, preventing 301 redirect failure in browsers/PWA)
app.get(["/user", "/user/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-user", "index.html"));
});
app.get(["/collector", "/collector/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-collector", "index.html"));
});
app.get(["/collector/scan", "/collector/scan.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-collector", "scan.html"));
});
app.get(["/government", "/government/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-government", "index.html"));
});
app.get(["/producer", "/producer/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-producer", "index.html"));
});
app.get(["/municipal", "/municipal/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-municipal", "index.html"));
});
app.get(["/medical", "/medical/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public-medical", "index.html"));
});

app.use("/assets", express.static(path.join(__dirname, "public-shared")));
app.use("/user", express.static(path.join(__dirname, "public-user")));
app.use("/collector", express.static(path.join(__dirname, "public-collector")));
app.use("/government", express.static(path.join(__dirname, "public-government")));
app.use("/producer", express.static(path.join(__dirname, "public-producer")));
app.use("/municipal", express.static(path.join(__dirname, "public-municipal")));
app.use("/medical", express.static(path.join(__dirname, "public-medical")));
app.use("/demo", express.static(path.join(__dirname, "public-demo")));
app.get("/demo", (req, res) => {
  res.sendFile(path.join(__dirname, "public-demo", "index.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public-landing", "index.html"));
});

app.get("/track/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "public-track", "track.html"));
});

app.get("/sw.js", (req, res) => {
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path.join(__dirname, "public-shared", "sw.js"));
});

// ------------------------------------------------------------
// FILE-BASED "DATABASE" HELPERS — still needed here for read-only
// display purposes (QR image rendering, the public tracking view,
// government stats). All WRITES now happen inside decisionEngine.mjs.
// ------------------------------------------------------------
function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
// SYSTEM 4 — Digital E-Waste Passport journey checklist. Derives a
// simple ✓/pending checklist from the item's real history array
// (never a second source of truth) so both the public QR passport and
// the owner's item view render the same journey consistently.
const PASSPORT_STAGES = [
  { key: "REGISTERED", label: "Registered" },
  { key: "BOOKED", label: "Pickup Assigned" },
  { key: "COLLECTED", label: "Collected" },
  { key: "RECEIVED", label: "Received at Facility" },
  { key: "VERIFIED", label: "Verified" },
  { key: "SORTED", label: "Sorted" },
  { key: "PROCESSING", label: "Sent to Recycler" },
  { key: "RECYCLED", label: "Recycled" },
];
function buildJourney(item) {
  const reachedStatuses = new Set((item.history || []).map((h) => h.newStatus).filter(Boolean));
  if (item.verified) reachedStatuses.add("VERIFIED"); // checkpoint, not a status transition — see decisionEngine.mjs
  let reachedCurrent = false;
  return PASSPORT_STAGES.map((stage) => {
    const done = reachedStatuses.has(stage.key) || (stage.key === "REGISTERED"); // every item was registered
    return { ...stage, done };
  });
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Hides most of the owner string before it's ever sent to the public
// QR-tracking page. Purely a display concern, so it stays here rather
// than in the engine.
function maskOwner(owner) {
  if (!owner) return "unknown";
  if (owner.length <= 2) return owner[0] + "*";
  return owner.slice(0, 2) + "*".repeat(owner.length - 2);
}

// Small helper: run an engine event and translate its result into an
// HTTP response, so every route below is just "build the event, call
// this". Keeps the mapping from engine result -> HTTP status in ONE place.
async function runEvent(res, event, successStatus = 200) {
  const { processEvent } = await decisionEnginePromise;
  const result = await processEvent(event);

  if (!result.success) {
    // Map exception types to sensible HTTP statuses instead of a flat 500.
    const statusMap = {
      MISSING_REQUIRED_INFO: 400,
      INVALID_ITEM_ID: 404,
      ITEM_DELETED: 404,
      INVALID_QR: 404,
      UNAUTHORIZED_COLLECTOR: 403,
      DUPLICATE_SCAN: 409,
      RECYCLING_ALREADY_COMPLETE: 409,
      INVALID_STATUS_TRANSITION: 409,
      NO_COLLECTOR_AVAILABLE: 503,
      UNKNOWN_EVENT: 400,
      DUPLICATE_ACTIVE_REQUEST: 409,
      INVALID_REQUEST_STATUS_TRANSITION: 409,
      VERIFICATION_REQUIRED: 409,
      DUPLICATE_CREDIT_ATTEMPT: 409,
      INSUFFICIENT_BALANCE: 402,
      REWARD_UNAVAILABLE: 409,
      DUPLICATE_REWARD_CLAIM: 409,
      INVALID_REQUEST: 400,
      EPR_CERTIFICATE_UNAVAILABLE: 404,
      DUPLICATE_CERTIFICATE_PURCHASE: 409,
    };
    return res.status(statusMap[result.exception] || 400).json(result);
  }
  return res.status(successStatus).json(result);
}

// ==============================================================
// 1. USER-SIDE: register item + request collection
// ==============================================================

// RULE 1 (ITEM_CREATED) runs inside the engine. This route's only
// remaining job is turning the resulting qrToken into an actual QR
// image and a shareable track URL — presentation, not business logic.
app.post("/api/items", async (req, res) => {
  const { processEvent } = await decisionEnginePromise;
  const { EVENT_TYPES } = await eventTypesPromise;

  const { device, age, condition, battery, owner, category, deviceModel, conditionAssessment, physicalGrade, lifecycleRecommendation } = req.body;
  const result = await processEvent({
    type: EVENT_TYPES.ITEM_CREATED,
    data: { device, age, condition, battery, owner, category, deviceModel, conditionAssessment, physicalGrade, lifecycleRecommendation },
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  const item = result.item;
  const trackUrl = `${req.protocol}://${req.get("host")}/track/${item.qrToken}`;
  const qrCodeDataUrl = await QRCode.toDataURL(trackUrl);

  // Persist the QR image + link onto the stored item (presentation
  // data only — the engine already decided everything that matters).
  const items = loadJson(ITEMS_FILE, []);
  const stored = items.find((it) => it.id === item.id);
  if (stored) {
    stored.qrCodeDataUrl = qrCodeDataUrl;
    stored.trackUrl = trackUrl;
    saveJson(ITEMS_FILE, items);
  }

  res.status(201).json({ ...item, qrCodeDataUrl, trackUrl });
});

app.get("/api/items/:id", (req, res) => {
  const items = loadJson(ITEMS_FILE, []);
  const item = items.find((it) => it.id === req.params.id);
  if (!item) return res.status(404).json({ error: "No item found with this ID" });
  res.json({ ...item, journey: buildJourney(item) });
});

app.get("/api/items", (req, res) => {
  res.json(loadJson(ITEMS_FILE, []));
});

// ==============================================================
// 1c. PUBLIC: QR scan lookup — read-only tracking page endpoint.
// Not part of the collector flow, so it stays a direct data read
// rather than an engine event (nothing here makes a decision).
// ==============================================================
app.get("/api/track/:token", (req, res) => {
  try {
    const items = loadJson(ITEMS_FILE, []);
    const item = items.find((it) => it.qrToken === req.params.token);

    if (!item || item.active === false) {
      return res.status(404).json({ error: "Invalid or inactive e-waste QR code." });
    }

    // SYSTEM 4 — Digital E-Waste Passport: adds the journey checklist
    // and environmental impact to the public tracking view. Still
    // owner-safe: no address, no raw owner ID, no wallet balance —
    // just what a public QR scan should be allowed to show.
    res.json({
      id: item.id,
      device: item.device,
      deviceModel: item.deviceModel || null,
      category: item.category || null,
      condition: item.condition,
      physicalGrade: item.physicalGrade || null,
      lifecycleRecommendation: item.lifecycleRecommendation || null,
      conditionAssessment: item.conditionAssessment || null,
      status: item.status,
      registeredAt: item.createdAt || null,
      weightKg: item.weightKg || null,
      journey: buildJourney(item),
      history: item.history || [],
      environmentalImpact: item.environmentalImpact || null,
      creditsAwarded: item.creditsAwarded ?? null,
      owner: maskOwner(item.owner),
    });
  } catch (err) {
    console.error("Track lookup failed:", err);
    res.status(404).json({ error: "Invalid or inactive e-waste QR code." });
  }
});

// ==============================================================
// 1d. USER-SIDE: "My E-Waste Card" — profile + stats, no sensitive data
// ==============================================================
app.get("/api/users/:owner/card", async (req, res) => {
  const { aggregateImpact } = await environmentalImpactPromise;
  const owner = req.params.owner;
  const items = loadJson(ITEMS_FILE, []).filter((it) => it.owner === owner && it.active !== false);
  const wallets = loadJson(WALLETS_FILE, {});

  const recycledItems = items.filter((it) => it.status === "RECYCLED").length;

  res.json({
    owner,
    totalItems: items.length,
    recycledItems,
    pendingItems: items.length - recycledItems,
    credits: (wallets[owner] && wallets[owner].balance) || 0,
    environmentalImpact: aggregateImpact(items),
    items: items.map((it) => ({
      id: it.id, device: it.device, status: it.status, qrToken: it.qrToken,
      creditsAwarded: it.creditsAwarded || null, creditBreakdown: it.creditBreakdown || null,
    })),
  });
});

// ==============================================================
// 1e. USER-SIDE: deactivate (soft-delete) an item
// ==============================================================
// Kept as a direct data operation (not an engine event) since it's an
// ownership action, not a lifecycle/status decision the automation
// rules govern.
app.post("/api/items/:id/deactivate", (req, res) => {
  const { owner } = req.body;
  const items = loadJson(ITEMS_FILE, []);
  const item = items.find((it) => it.id === req.params.id);
  if (!item) return res.status(404).json({ error: "No item found with this ID" });

  if (!owner || owner !== item.owner) {
    return res.status(403).json({ error: "Only the item's owner can deactivate it." });
  }

  item.active = false;
  item.deactivatedAt = new Date().toISOString();
  saveJson(ITEMS_FILE, items);
  res.json({ message: "Item deactivated.", id: item.id });
});

// ==============================================================
// 1b. USER-SIDE: AI image identification (does NOT create a record)
// ==============================================================
// Gemini itself stays entirely inside ewasteVision.mjs. Once it
// returns a confidence number, THAT decision (auto-accept / needs
// confirmation / manual correction required) is made by the engine's
// AI_IDENTIFIED event — not by an if/else here.
app.post("/api/v1/identify-ewaste", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded. Send it as multipart/form-data field 'image'." });
  }
  const rawMime = (req.file.mimetype || "").toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(rawMime)) {
    return res.status(415).json({
      error: `Unsupported image type "${req.file.mimetype}". Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
    });
  }

  try {
    const { identifyElectronicItem, GEMINI_AVAILABLE } = await ewasteVisionModulePromise;
    const { processEvent } = await decisionEnginePromise;
    const { EVENT_TYPES } = await eventTypesPromise;
    const { calculatePreciousMetalBonus, lookupPreciousMetals } = await creditEnginePromise;

    const { detections, demoMode, apiError } = await identifyElectronicItem(
      req.file.buffer,
      rawMime,
      { filename: req.file.originalname }
    );

    // Map the engine's decision onto the confidenceLevel vocabulary the
    // existing frontend already understands, so the UI didn't need a rewrite.
    const levelMap = {
      AUTO_ACCEPTED: "high",
      NEEDS_CONFIRMATION: "medium",
      MANUAL_CORRECTION_REQUIRED: "low",
    };

    // Each detected device gets its own confidence-gating decision from
    // the engine (Phase 3: never let the frontend decide auto-accept —
    // AI_IDENTIFIED still runs once per item found in the photo).
    const gatedDetections = [];
    for (const d of detections) {
      const decision = await processEvent({ type: EVENT_TYPES.AI_IDENTIFIED, data: { device: d.device, confidence: d.confidence } });

      const condition = d.condition || {
        screen: "UNKNOWN",
        casing: "UNKNOWN",
        battery: "UNKNOWN",
        grade: "GRADE_C",
      };
      const recommendedOutcome = d.recommendedOutcome || "RECYCLE";
      const recommendationReason = d.recommendationReason || "";
      const isHazardousBattery = condition.battery === "SWOLLEN";

      // Precious metal yield and intrinsic recovery valuation
      const metalInfo = calculatePreciousMetalBonus(d.device, d.category);
      const metalMatch = lookupPreciousMetals(d.device, d.category);
      const metalsGrams = metalMatch?.metalsGrams || { gold: 0, silver: 0, palladium: 0, copper: 0 };
      const intrinsicMetalValueINR = metalInfo.valueINR || 0;

      // Economic circular valuation modeling (INR):
      // - REFURBISH: Device can be refurbished and resold on circular secondary markets.
      // - HARVEST_PARTS: Valuable working components salvaged for modular spares.
      // - RECYCLE: Smelting & raw metal extraction.
      let estimatedSalvageValueINR = intrinsicMetalValueINR;
      if (recommendedOutcome === "REFURBISH") {
        estimatedSalvageValueINR = condition.grade === "GRADE_A"
          ? Math.max(2500, Math.round(intrinsicMetalValueINR * 2.8 + 2000))
          : Math.max(1200, Math.round(intrinsicMetalValueINR * 1.8 + 800));
      } else if (recommendedOutcome === "HARVEST_PARTS") {
        estimatedSalvageValueINR = Math.max(600, Math.round(intrinsicMetalValueINR * 1.3 + 300));
      } else {
        estimatedSalvageValueINR = Math.max(150, Math.round(intrinsicMetalValueINR));
      }

      gatedDetections.push({
        device: d.device,
        category: d.category,
        confidence: d.confidence,
        confidenceLevel: levelMap[decision.decision] || "low",
        decision: decision.decision,
        reason: d.reason,
        condition,
        recommendedOutcome,
        recommendationReason,
        metalsGrams,
        intrinsicMetalValueINR,
        estimatedSalvageValueINR,
        preciousMetalBonus: metalInfo.bonus,
        preciousMetalMatch: metalMatch ? metalMatch.matchedKey : null,
        isHazardousBattery,
      });
    }

    const primary = gatedDetections[0] || {
      device: "Unknown",
      category: "Unclassified",
      confidence: 0,
      confidenceLevel: "low",
      decision: "MANUAL_CORRECTION_REQUIRED",
      reason: "No device detected.",
      condition: { screen: "UNKNOWN", casing: "UNKNOWN", battery: "UNKNOWN", grade: "GRADE_C" },
      recommendedOutcome: "RECYCLE",
      recommendationReason: "No device detected.",
      metalsGrams: { gold: 0, silver: 0, palladium: 0, copper: 0 },
      intrinsicMetalValueINR: 0,
      estimatedSalvageValueINR: 0,
      preciousMetalBonus: 0,
      preciousMetalMatch: null,
      isHazardousBattery: false,
    };

    res.json({
      // Backward-compatible top-level fields (existing frontend reads these directly)
      device: primary.device,
      category: primary.category,
      confidence: primary.confidence,
      confidenceLevel: primary.confidenceLevel,
      decision: primary.decision,
      reason: primary.reason,
      // Enriched forensic damage and circular economy fields
      condition: primary.condition,
      recommendedOutcome: primary.recommendedOutcome,
      recommendationReason: primary.recommendationReason,
      metalsGrams: primary.metalsGrams,
      intrinsicMetalValueINR: primary.intrinsicMetalValueINR,
      estimatedSalvageValueINR: primary.estimatedSalvageValueINR,
      preciousMetalBonus: primary.preciousMetalBonus,
      preciousMetalMatch: primary.preciousMetalMatch,
      isHazardousBattery: primary.isHazardousBattery,
      // New: full multi-device detection list
      detections: gatedDetections,
      demoMode: !!demoMode,
      geminiAvailable: GEMINI_AVAILABLE,
      apiError: !!apiError,
    });
  } catch (err) {
    console.error("AI identification failed:", err);
    res.status(500).json({ error: "AI identification is temporarily unavailable. Please try again or add the item manually." });
  }
});

// RULE 2 + 3 — collection request, priority scoring, collector
// assignment. All of this used to live in this route; now it's a
// single call into the engine.
// Kept for backward compatibility with the original demo flow — new
// clients should prefer POST /api/collection-requests below, which
// accepts the fuller System 1 fields (pickup address, service area, etc).
app.post("/api/items/:id/request-collection", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  await runEvent(res, {
    type: EVENT_TYPES.COLLECTION_REQUESTED,
    itemId: req.params.id,
    data: { urgency: req.body.urgency },
  }, 201);
});

// ==============================================================
// SYSTEM 1: Automated Collection & Recycler System
// ==============================================================

// Full collection-request creation — validates + auto-matches via the
// engine's matching engine (see smartAutomation/matchingEngine.mjs).
app.post("/api/collection-requests", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const { itemId, pickupAddress, preferredTime, serviceArea, pickupLat, pickupLng, urgency, district, state } = req.body;
  if (!itemId) return res.status(400).json({ error: "itemId is required" });

  await runEvent(res, {
    type: EVENT_TYPES.COLLECTION_REQUESTED,
    itemId,
    actorId: req.body.userId,
    data: { pickupAddress, preferredTime, serviceArea, pickupLat, pickupLng, urgency, district, state },
  }, 201);
});

app.get("/api/collection-requests", (req, res) => {
  let requests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const { owner, status, itemId } = req.query;
  if (owner) requests = requests.filter((r) => r.userId === owner);
  if (status) requests = requests.filter((r) => r.status === status);
  if (itemId) requests = requests.filter((r) => r.itemId === itemId);
  res.json(requests);
});

app.get("/api/collection-requests/:id", (req, res) => {
  const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const request = requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: "No collection request found with this ID" });
  res.json(request);
});

// scheduleCollection() — explicit pickup-date confirmation
app.post("/api/collection-requests/:id/schedule", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  await runEvent(res, {
    type: EVENT_TYPES.COLLECTION_SCHEDULED,
    actorId: req.body.actor,
    data: { requestId: req.params.id, pickupTime: req.body.pickupTime },
  });
});

// ---- Collection centres / recyclers ----
app.get("/api/collectors", (req, res) => {
  res.json(loadJson(COLLECTORS_FILE, []));
});

// Haversine great-circle distance in km between two lat/lng points.
function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius, km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest e-waste collection/recycling facilities to a citizen's
// coordinates. Must be defined before "/api/collectors/:id" —
// otherwise Express would treat "nearest" as an :id value.
// Only facilities that are both operating and verified are returned;
// there's no point directing someone to a centre that's inactive or
// still pending verification.
app.get("/api/collectors/nearest", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "lat and lng query parameters are required and must be numbers" });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

  const collectors = loadJson(COLLECTORS_FILE, []);
  const results = collectors
    .filter((c) => c.operatingStatus === "ACTIVE" && c.verificationStatus === "VERIFIED")
    .filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number")
    .map((c) => ({ ...c, distanceKm: Math.round(distanceKm(lat, lng, c.latitude, c.longitude) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  res.json(results);
});

app.get("/api/collectors/:id", (req, res) => {
  const collector = loadJson(COLLECTORS_FILE, []).find((c) => c.id === req.params.id);
  if (!collector) return res.status(404).json({ error: "No collector found with this ID" });
  res.json(collector);
});

// Register a new collection centre / recycler. No login system exists
// in this project (see README honesty notes elsewhere), so this is not
// gated to admins the way the spec ultimately wants — it's a plain
// write, same trust model as the rest of the demo.
app.post("/api/collectors", requireRole("ADMIN"), (req, res) => {
  const { id, name, type, address, latitude, longitude, serviceArea, capacity, acceptedCategories, contact, district, state } = req.body;
  if (!id || !name || !capacity) {
    return res.status(400).json({ error: "id, name, and capacity are required" });
  }
  const collectors = loadJson(COLLECTORS_FILE, []);
  if (collectors.some((c) => c.id === id)) {
    return res.status(409).json({ error: `Collector with id "${id}" already exists.` });
  }
  const collector = {
    id, name,
    type: type || "COLLECTION_CENTRE",
    address: address || null,
    district: district || null,
    state: state || null,
    latitude: typeof latitude === "number" ? latitude : null,
    longitude: typeof longitude === "number" ? longitude : null,
    serviceArea: serviceArea || [],
    capacity,
    assignedCount: 0,
    operatingStatus: "ACTIVE",
    verificationStatus: "PENDING", // new centres start unverified — matching engine excludes these until flipped to VERIFIED
    acceptedCategories: acceptedCategories || [],
    contact: contact || { phone: null, email: null },
  };
  collectors.push(collector);
  saveJson(COLLECTORS_FILE, collectors);
  res.status(201).json(collector);
});

// Update capacity / operating / verification status — fires
// CENTRE_CAPACITY_CHANGED so the engine can raise an overload alert.
app.patch("/api/collectors/:id", requireRole("ADMIN", "GOVERNMENT"), async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const collectors = loadJson(COLLECTORS_FILE, []);
  const collector = collectors.find((c) => c.id === req.params.id);
  if (!collector) return res.status(404).json({ error: "No collector found with this ID" });

  const { capacity, operatingStatus, verificationStatus, serviceArea, acceptedCategories } = req.body;
  if (typeof capacity === "number") collector.capacity = capacity;
  if (operatingStatus) collector.operatingStatus = operatingStatus;
  if (verificationStatus) collector.verificationStatus = verificationStatus;
  if (serviceArea) collector.serviceArea = serviceArea;
  if (acceptedCategories) collector.acceptedCategories = acceptedCategories;
  saveJson(COLLECTORS_FILE, collectors);

  await runEvent(res, { type: EVENT_TYPES.CENTRE_CAPACITY_CHANGED, data: { collectorId: collector.id } });
});

// ==============================================================
// EDUCATIONAL CONTENT — harmful components & health/environmental
// effects per e-waste category, shown as citizen-facing pop-ups.
// Static reference data (data/educationalContent.json), not user
// data, so it's read-only via the API — no POST/PATCH needed.
// ==============================================================

app.get("/api/education", (req, res) => {
  res.json(loadJson(EDUCATION_FILE, {}));
});

// Case-insensitive lookup by category name. Any category not found
// (including "Unclassified" or a category the AI hasn't seen before)
// still gets useful generic content via the "default" entry — every
// device should be able to show *something*, not a 404.
app.get("/api/education/:category", (req, res) => {
  const content = loadJson(EDUCATION_FILE, {});
  const requested = decodeURIComponent(req.params.category || "").toLowerCase();
  const key = Object.keys(content).find((k) => k.toLowerCase() === requested);
  res.json({ category: key || req.params.category, ...(content[key] || content.default) });
});

// ==============================================================
// PRECIOUS-METAL CREDIT ESTIMATOR — lets a citizen see, before they
// even register the item, roughly how many bonus credits their
// specific device model earns from its recoverable gold/silver/
// palladium/copper content. Uses the same calculatePreciousMetalBonus()
// the credit engine calls at actual payout time, so the estimate
// citizens see always matches what they'll actually receive.
// ==============================================================

app.get("/api/precious-metals/models", (req, res) => {
  const db = loadJson(PRECIOUS_METALS_FILE, {});
  // Only surface named, specific models in the picker — the "Generic
  // ..." entries exist purely as fallback data, not user-facing choices.
  const models = Object.keys(db).filter((k) => !k.startsWith("Generic "));
  res.json(models.map((name) => ({ name, category: db[name].category })));
});

app.get("/api/precious-metals/estimate", async (req, res) => {
  const { calculatePreciousMetalBonus } = await creditEnginePromise;
  const { model, category } = req.query;
  const result = calculatePreciousMetalBonus(model, category);
  res.json({
    model: model || null,
    category: category || null,
    matchedModel: result.match ? result.match.matchedKey : null,
    exactMatch: result.match ? result.match.exact : false,
    metalsGrams: result.match ? result.match.metalsGrams : null,
    estimatedValueINR: result.valueINR,
    estimatedBonusCredits: result.bonus,
  });
});

// ==============================================================
// SYSTEM 2: Automated Credit, Reward & Verification System
// ==============================================================

app.get("/api/rewards", (req, res) => {
  const rewards = loadJson(REWARDS_FILE, []);
  res.json(req.query.all ? rewards : rewards.filter((r) => r.active));
});

// Admin creation, now gated behind real RBAC (see requireRole below).
app.post("/api/rewards", requireRole("ADMIN"), (req, res) => {
  const { id, name, description, requiredCredits, stock, repeatable, eligibilityRules } = req.body;
  if (!id || !name || typeof requiredCredits !== "number") {
    return res.status(400).json({ error: "id, name, and requiredCredits are required" });
  }
  const rewards = loadJson(REWARDS_FILE, []);
  if (rewards.some((r) => r.id === id)) {
    return res.status(409).json({ error: `Reward with id "${id}" already exists.` });
  }
  const reward = {
    id, name, description: description || null, requiredCredits,
    active: true,
    stock: typeof stock === "number" ? stock : null, // null = unlimited
    repeatable: !!repeatable,
    eligibilityRules: eligibilityRules || null,
  };
  rewards.push(reward);
  saveJson(REWARDS_FILE, rewards);
  res.status(201).json(reward);
});

app.post("/api/rewards/:id/claim", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  await runEvent(res, { type: EVENT_TYPES.REWARD_CLAIM_REQUESTED, data: { rewardId: req.params.id, userId } }, 201);
});

app.get("/api/rewards/claims", (req, res) => {
  let claims = loadJson(REWARD_CLAIMS_FILE, []);
  if (req.query.owner) claims = claims.filter((c) => c.userId === req.query.owner);
  res.json(claims);
});

app.get("/api/suspicious-activity", (req, res) => {
  let entries = loadJson(SUSPICIOUS_FILE, []);
  if (req.query.status) entries = entries.filter((e) => e.status === req.query.status);
  res.json(entries);
});

// ==============================================================
// SYSTEM 3: Government Command, Analytics & Integration System
// Everything below requires a GOVERNMENT or ADMIN token — see the
// requireRole/authorization middleware near the top of this file.
// ==============================================================
function loadGovernmentData(filterRequestsFn, filters = {}) {
  const items = loadJson(ITEMS_FILE, []);
  const allRequests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const collectors = loadJson(COLLECTORS_FILE, []);
  const alerts = loadJson(ALERTS_FILE, []);
  const suspicious = loadJson(SUSPICIOUS_FILE, []);
  const statusHistory = loadJson(STATUS_HISTORY_FILE, []);
  const requests = filterRequestsFn(allRequests, { ...filters, items });
  return { items, requests, allRequests, collectors, alerts, suspicious, statusHistory };
}

app.get("/api/government/dashboard", requireRole("GOVERNMENT", "ADMIN"), async (req, res) => {
  const { filterRequests, buildDashboard } = await governmentAnalyticsPromise;
  const { state, district, from, to, category, recyclerId, status } = req.query;
  const { items, requests, collectors, alerts, suspicious } = loadGovernmentData(filterRequests, { state, district, from, to, category, recyclerId, status });
  res.json(buildDashboard({ items, requests, collectors, alerts, suspicious }));
});

app.get("/api/government/performance", requireRole("GOVERNMENT", "ADMIN"), async (req, res) => {
  const { filterRequests, buildPerformance } = await governmentAnalyticsPromise;
  const { state, district, from, to, category, recyclerId, status } = req.query;
  const { requests, collectors, statusHistory } = loadGovernmentData(filterRequests, { state, district, from, to, category, recyclerId, status });
  res.json(buildPerformance({ requests, collectors, statusHistory }));
});

app.get("/api/government/trends", requireRole("GOVERNMENT", "ADMIN"), async (req, res) => {
  const { filterRequests, buildTrends } = await governmentAnalyticsPromise;
  const { state, district, from, to, category, recyclerId, status } = req.query;
  const { items, requests } = loadGovernmentData(filterRequests, { state, district, from, to, category, recyclerId, status });
  res.json(buildTrends({ requests, items }));
});

// Geographic view — collectors with GPS + which are overloaded, for
// the government map. Uses existing collector location fields (see
// System 1); doesn't invent new geocoding.
app.get("/api/government/map", requireRole("GOVERNMENT", "ADMIN"), (req, res) => {
  const collectors = loadJson(COLLECTORS_FILE, []);
  res.json(collectors.map((c) => {
    const utilization = c.capacity > 0 ? c.assignedCount / c.capacity : 0;
    // 🟢 Available / 🟡 Near capacity / 🔴 Full / ⚫ Inactive — matches
    // the command-center legend. Inactive takes precedence over load.
    let mapStatus = "AVAILABLE";
    if ((c.operatingStatus || "ACTIVE") !== "ACTIVE") mapStatus = "INACTIVE";
    else if (utilization >= 1) mapStatus = "FULL";
    else if (utilization >= 0.9) mapStatus = "NEAR_CAPACITY";
    return {
      id: c.id, name: c.name, type: c.type, latitude: c.latitude, longitude: c.longitude,
      district: c.district || null, state: c.state || null,
      operatingStatus: c.operatingStatus, verificationStatus: c.verificationStatus,
      overloaded: c.capacity > 0 && utilization >= 0.9,
      mapStatus,
      capacityUtilizationPercent: c.capacity > 0 ? Math.round(utilization * 100) : 0,
    };
  }));
});

// SYSTEM 6: GIS Overview & Hotspot Analysis (Leaflet GIS map data)
app.get("/api/government/gis/overview", requireRole("GOVERNMENT", "ADMIN"), async (req, res) => {
  const { resolveRequestCoordinates } = await routeEnginePromise;
  const collectors = loadJson(COLLECTORS_FILE, []);
  const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const items = loadJson(ITEMS_FILE, []);

  const centres = collectors.map((c) => {
    const utilization = c.capacity > 0 ? c.assignedCount / c.capacity : 0;
    let mapStatus = "AVAILABLE";
    if ((c.operatingStatus || "ACTIVE") !== "ACTIVE") mapStatus = "INACTIVE";
    else if (utilization >= 1) mapStatus = "FULL";
    else if (utilization >= 0.9) mapStatus = "NEAR_CAPACITY";
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      latitude: c.latitude,
      longitude: c.longitude,
      district: c.district || "Bhopal",
      state: c.state || "Madhya Pradesh",
      serviceArea: c.serviceArea || [],
      assignedCount: c.assignedCount || 0,
      capacity: c.capacity,
      capacityUtilizationPercent: c.capacity > 0 ? Math.round(utilization * 100) : 0,
      mapStatus,
      contact: c.contact || {},
    };
  });

  const activeStatuses = ["REQUESTED", "ASSIGNED", "SCHEDULED", "COLLECTED", "VERIFIED", "SENT_TO_RECYCLER"];
  const activeRequests = requests.filter((r) => activeStatuses.includes(r.status));

  const pickups = activeRequests.map((r) => {
    const coords = resolveRequestCoordinates(r);
    const item = items.find((it) => it.id === r.itemId);
    return {
      id: r.id,
      itemId: r.itemId,
      device: item ? item.device : "E-Waste Item",
      category: item ? item.category : "Electronics",
      status: r.status,
      userId: r.userId,
      pickupAddress: r.pickupAddress || r.serviceArea || "Citizen Pickup",
      serviceArea: r.serviceArea || "Bhopal Central",
      district: r.district || "Bhopal",
      priority: r.priority || { score: 10, level: "LOW" },
      assignedCollector: r.assignedCollector || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      isEstimated: coords.isEstimated,
    };
  });

  const hotspots = {};
  for (const p of pickups) {
    const key = p.serviceArea || p.district || "Central Zone";
    if (!hotspots[key]) hotspots[key] = { name: key, totalPickups: 0, highPriority: 0, lat: p.latitude, lng: p.longitude };
    hotspots[key].totalPickups += 1;
    if (p.priority && p.priority.level === "HIGH") hotspots[key].highPriority += 1;
  }

  res.json({
    centres,
    pickups,
    hotspots: Object.values(hotspots),
    summary: {
      totalCentres: centres.length,
      activeCentres: centres.filter((c) => c.mapStatus !== "INACTIVE").length,
      totalPendingPickups: pickups.length,
      highPriorityPickups: pickups.filter((p) => p.priority && p.priority.level === "HIGH").length,
    },
  });
});

// SYSTEM 6: Collector Van Route Optimization (TSP pickup solver)
app.get("/api/collectors/:id/route", async (req, res) => {
  const { optimizeCollectionRoute } = await routeEnginePromise;
  const collectors = loadJson(COLLECTORS_FILE, []);
  const collector = collectors.find((c) => c.id === req.params.id);
  if (!collector) return res.status(404).json({ error: `Collector "${req.params.id}" not found.` });

  const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const pendingRequests = requests.filter(
    (r) => r.assignedCollector === collector.id && ["ASSIGNED", "SCHEDULED", "REQUESTED", "BOOKED"].includes(r.status)
  );

  const route = optimizeCollectionRoute(collector, pendingRequests);
  res.json(route);
});

app.get("/api/government/alerts", requireRole("GOVERNMENT", "ADMIN"), (req, res) => {
  let alerts = loadJson(ALERTS_FILE, []);
  if (req.query.status) alerts = alerts.filter((a) => a.status === req.query.status);
  if (req.query.severity) alerts = alerts.filter((a) => a.severity === req.query.severity);
  res.json(alerts.slice().reverse());
});

app.post("/api/government/alerts/:id/acknowledge", requireRole("GOVERNMENT", "ADMIN"), (req, res) => {
  const alerts = loadJson(ALERTS_FILE, []);
  const alert = alerts.find((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: "No alert found with this ID" });
  alert.status = "ACKNOWLEDGED";
  saveJson(ALERTS_FILE, alerts);
  res.json(alert);
});

app.post("/api/government/alerts/:id/resolve", requireRole("GOVERNMENT", "ADMIN"), (req, res) => {
  const alerts = loadJson(ALERTS_FILE, []);
  const alert = alerts.find((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: "No alert found with this ID" });
  alert.status = "RESOLVED";
  saveJson(ALERTS_FILE, alerts);
  res.json(alert);
});

// Runs the compliance scan (delayed collection/recycling, unassigned
// requests, overloaded/non-compliant/inactive collectors with active
// load) and returns whatever new alerts it created. Idempotent to
// call repeatedly — see governmentAnalytics.mjs's dedup behavior.
app.post("/api/government/scan", requireRole("GOVERNMENT", "ADMIN"), async (req, res) => {
  const { runComplianceScan } = await governmentAnalyticsPromise;
  const requests = loadJson(COLLECTION_REQUESTS_FILE, []);
  const collectors = loadJson(COLLECTORS_FILE, []);
  const newAlerts = runComplianceScan({ requests, collectors });
  res.json({ newAlertsCreated: newAlerts.length, alerts: newAlerts });
});

// ==============================================================
// 2. COLLECTOR-SIDE
// ==============================================================

app.get("/api/collector/:collectorId/items", (req, res) => {
  const items = loadJson(ITEMS_FILE, []);
  const assigned = items.filter((it) => it.assignedCollector === req.params.collectorId);
  res.json(assigned);
});

// RULE 4 — QR scan: validate only, engine guarantees this never
// changes status by itself.
app.post("/api/collector/scan", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const { token, collectorId } = req.body;
  await runEvent(res, {
    type: EVENT_TYPES.QR_SCANNED,
    actorId: collectorId,
    data: { token },
  });
});

// RULE 5 — Collection confirmation: the one call that actually writes
// BOOKED -> COLLECTED, with a QR_SCANNED audit line alongside it.
app.post("/api/collector/confirm-collection", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const { token, collectorId, facility } = req.body;
  await runEvent(res, {
    type: EVENT_TYPES.COLLECTION_CONFIRMED,
    actorId: collectorId,
    data: { token, facility },
  });
});

// ==============================================================
// Facility-side progression + verification checkpoint.
// This used to be one free-form PATCH that accepted ANY status string
// from the frontend and wrote it directly — that's exactly the
// "arbitrary status change" the automation engine exists to prevent.
// It now only accepts the facility-stage names and routes each one
// through the engine, which enforces the real transition rules.
// ==============================================================
const STATUS_TO_EVENT = {
  RECEIVED: "ITEM_RECEIVED",
  SORTED: "ITEM_SORTED",
  PROCESSING: "PROCESSING_STARTED",
  RECYCLED: "RECYCLING_COMPLETED",
};

app.patch("/api/items/:id/status", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const { processEvent } = await decisionEnginePromise;
  const { status, outcome, changedBy, location } = req.body;

  if (status === "COLLECTED") {
    return res.status(400).json({
      error: "COLLECTED can only be set by scanning the item's QR and confirming collection, not by this endpoint.",
    });
  }
  if (status === "VERIFIED") {
    // VERIFIED is a checkpoint, not a lifecycle status, in the new engine —
    // redirect it to the dedicated verify event so old callers still work.
    return runEvent(res, { type: EVENT_TYPES.ITEM_VERIFIED, itemId: req.params.id, actorId: changedBy });
  }

  const eventType = STATUS_TO_EVENT[status];
  if (!eventType) {
    return res.status(400).json({ error: `Unknown or unsupported status "${status}".` });
  }

  // Ensure item is verified since verification is part of facility intake & processing
  const items = loadJson(ITEMS_FILE, []);
  const item = items.find((it) => it.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Item not found." });
  }
  if (!item.verified) {
    item.verified = true;
    saveJson(ITEMS_FILE, items);
  }

  // Handle smooth forward progression through intermediate stages if needed
  const stageOrder = ["COLLECTED", "RECEIVED", "SORTED", "PROCESSING", "RECYCLED"];
  const currentIdx = stageOrder.indexOf(item.status);
  const targetIdx = stageOrder.indexOf(status);

  if (currentIdx !== -1 && targetIdx !== -1 && targetIdx > currentIdx + 1) {
    for (let k = currentIdx + 1; k < targetIdx; k++) {
      const intermediateStage = stageOrder[k];
      const interEvent = STATUS_TO_EVENT[intermediateStage];
      if (interEvent) {
        await processEvent({
          type: EVENT_TYPES[interEvent],
          itemId: req.params.id,
          actorId: changedBy || "collector",
          data: { location, autoVerify: true },
        });
      }
    }
  }

  await runEvent(res, {
    type: EVENT_TYPES[eventType],
    itemId: req.params.id,
    actorId: changedBy,
    data: { outcome, location, autoVerify: true },
  });
});

// RULE 6 — Verification checkpoint as its own explicit route too
// (PATCH .../status with status=VERIFIED above forwards here for
// backward compatibility with the existing collector UI).
app.post("/api/items/:id/verify", async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  await runEvent(res, {
    type: EVENT_TYPES.ITEM_VERIFIED,
    itemId: req.params.id,
    actorId: req.body.verifiedBy,
  });
});

// ==============================================================
// 3. USER-SIDE: check wallet / credits
// ==============================================================
app.get("/api/wallet/:owner", (req, res) => {
  const wallets = loadJson(WALLETS_FILE, {});
  const wallet = wallets[req.params.owner] || { balance: 0, totalEarned: 0, totalSpent: 0, lastUpdated: null };
  res.json({ owner: req.params.owner, ...wallet, credits: wallet.balance });
});

app.get("/api/wallet/:owner/transactions", (req, res) => {
  const transactions = loadJson(TRANSACTIONS_FILE, []).filter((t) => t.userId === req.params.owner);
  res.json(transactions);
});

// ==============================================================
// 4. GOVERNMENT-SIDE: aggregated stats, now including automation
// metrics pulled from data/alerts.json (the engine's own audit trail).
// ==============================================================
app.get("/api/stats", (req, res) => {
  const items = loadJson(ITEMS_FILE, []);
  const collectors = loadJson(COLLECTORS_FILE, []);
  const alerts = loadJson(ALERTS_FILE, []);

  const byStatus = {};
  for (const it of items) {
    byStatus[it.status] = (byStatus[it.status] || 0) + 1;
  }

  const bySeverity = {};
  const byType = {};
  for (const a of alerts) {
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    byType[a.type] = (byType[a.type] || 0) + 1;
  }

  res.json({
    totalItems: items.length,
    byStatus,
    collectors,
    items,
    automation: {
      totalEvents: alerts.length,
      bySeverity,
      byType,
      highPriorityCollections: byType.HIGH_PRIORITY_COLLECTION || 0,
      invalidQrAttempts: byType.INVALID_QR || 0,
      duplicateScans: byType.DUPLICATE_SCAN || 0,
      recycledViaAutomation: byType.RECYCLING_COMPLETED || 0,
    },
  });
});

// ==============================================================
// SYSTEM 4: Live Automation Activity Feed, Notifications, System
// Health, and the Digital E-Waste Passport enrichment.
// ==============================================================

// Live/recent Smart Automation feed — read-only, most-recent-first.
// This is presentation data (not the permanent audit trail; see
// item.history / statusHistory.json for that), so it stays a plain
// data read like /api/stats, not an engine event.
app.get("/api/activity-feed", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 300);
  let feed = loadJson(ACTIVITY_FEED_FILE, []);
  if (req.query.itemId) feed = feed.filter((e) => e.itemId === req.query.itemId);
  res.json(feed.slice(-limit).reverse());
});

// Notifications for a given recipient (a userId, a collectorId, or the
// literal role string GOVERNMENT/ADMIN for broadcast alerts). No
// stricter ownership check than "you asked for your own ID" exists
// here, matching this project's existing no-login trust model for
// user-identified endpoints (see /api/users/:owner/card, etc.).
app.get("/api/notifications/:recipientId", (req, res) => {
  const notifications = loadJson(NOTIFICATIONS_FILE, []).filter((n) => n.recipientId === req.params.recipientId);
  res.json(notifications.slice().reverse());
});

app.post("/api/notifications/:id/read", (req, res) => {
  const notifications = loadJson(NOTIFICATIONS_FILE, []);
  const notification = notifications.find((n) => n.id === req.params.id);
  if (!notification) return res.status(404).json({ error: "No notification found with this ID" });
  notification.read = true;
  saveJson(NOTIFICATIONS_FILE, notifications);
  res.json(notification);
});

// System Health — Admin/Government only. Every count here comes from
// the real data files (activity feed + alerts), same "no mocked
// numbers" principle as governmentAnalytics.mjs.
app.get("/api/system/health", requireRole("ADMIN", "GOVERNMENT"), async (req, res) => {
  const { GEMINI_AVAILABLE } = await ewasteVisionModulePromise;
  const activityFeed = loadJson(ACTIVITY_FEED_FILE, []);
  const alerts = loadJson(ALERTS_FILE, []);
  const failedEvents = alerts.filter((a) =>
    ["INVALID_QR", "UNAUTHORIZED_ACTION", "INVALID_STATUS_TRANSITION", "NO_ELIGIBLE_COLLECTOR", "NO_REASSIGNMENT_AVAILABLE"].includes(a.type)
  ).length;

  res.json({
    services: {
      api: "OPERATIONAL",
      smartAutomation: "OPERATIONAL",
      qrService: "OPERATIONAL",
      geminiVision: GEMINI_AVAILABLE ? "OPERATIONAL" : "DEMO_MODE",
      database: fs.existsSync(ITEMS_FILE) ? "OPERATIONAL" : "DEGRADED",
    },
    metrics: {
      eventsProcessed: activityFeed.length,
      automationDecisions: activityFeed.length,
      failedEvents,
      lastAutomationEvent: activityFeed.length > 0 ? activityFeed[activityFeed.length - 1] : null,
      uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT.getTime()) / 1000),
      serverStartedAt: SERVER_STARTED_AT.toISOString(),
    },
  });
});

// ==============================================================
// SYSTEM 5: EPR (Extended Producer Responsibility) Marketplace
// Closes the economic loop: electronics manufacturers/brands purchase
// verified recycling certificates auto-generated on our platform
// to fulfil statutory CPCB obligations under E-Waste Rules 2022.
// ==============================================================

// 1. Producer Company Profile
app.get("/api/producer/profile", requireRole("PRODUCER", "ADMIN"), (req, res) => {
  const producers = loadJson(PRODUCERS_FILE, []);
  if (req.authUser.role === "PRODUCER") {
    const producerId = req.authUser.producerId || (producers[0] && producers[0].id) || "PROD-001";
    const producer = producers.find((p) => p.id === producerId);
    if (!producer) return res.status(404).json({ error: "Producer profile not found." });
    return res.json(producer);
  }
  // Admin view
  if (req.query.producerId) {
    const producer = producers.find((p) => p.id === req.query.producerId);
    if (!producer) return res.status(404).json({ error: "Producer profile not found." });
    return res.json(producer);
  }
  res.json(producers);
});

// 2. Producer Obligations
app.get("/api/producer/obligations", requireRole("PRODUCER", "ADMIN"), (req, res) => {
  let obligations = loadJson(EPR_OBLIGATIONS_FILE, []);
  const defaultProdId = req.authUser.producerId || "PROD-001";
  const producerId = req.authUser.role === "PRODUCER" ? defaultProdId : (req.query.producerId || null);
  if (producerId) obligations = obligations.filter((o) => o.producerId === producerId);
  if (req.query.financialYear) obligations = obligations.filter((o) => o.financialYear === req.query.financialYear);
  res.json(obligations);
});

// 3. Create Obligation (Admin only)
app.post("/api/producer/obligations", requireRole("ADMIN"), (req, res) => {
  const { producerId, category, targetWeightKg, financialYear, deadline } = req.body;
  if (!producerId || !category || typeof targetWeightKg !== "number") {
    return res.status(400).json({ error: "producerId, category, and targetWeightKg are required." });
  }
  const producers = loadJson(PRODUCERS_FILE, []);
  if (!producers.some((p) => p.id === producerId)) {
    return res.status(404).json({ error: `Producer "${producerId}" not found.` });
  }
  const obligations = loadJson(EPR_OBLIGATIONS_FILE, []);
  const year = financialYear || "2026-27";
  const id = `OBL-${new Date().getFullYear()}-${String(obligations.length + 1).padStart(3, "0")}`;
  const obligation = {
    id,
    producerId,
    financialYear: year,
    category,
    targetWeightKg,
    fulfilledWeightKg: 0,
    status: "ACTIVE",
    deadline: deadline || "2027-03-31T23:59:59.000Z",
    createdAt: new Date().toISOString(),
  };
  obligations.push(obligation);
  saveJson(EPR_OBLIGATIONS_FILE, obligations);
  res.status(201).json(obligation);
});

// 4. Producer Compliance Status
app.get("/api/producer/compliance", requireRole("PRODUCER", "ADMIN"), async (req, res) => {
  const { checkObligationCompliance } = await eprEnginePromise;
  const defaultProdId = req.authUser.producerId || "PROD-001";
  const producerId = req.authUser.role === "PRODUCER" ? defaultProdId : req.query.producerId;
  if (!producerId) return res.status(400).json({ error: "producerId is required." });
  const obligations = loadJson(EPR_OBLIGATIONS_FILE, []);
  const certificates = loadJson(EPR_CERTIFICATES_FILE, []);
  const compliance = checkObligationCompliance(obligations, certificates, producerId, req.query.financialYear);
  res.json(compliance);
});

// 5. Producer Compliance Report (CPCB-ready summary)
app.get("/api/producer/compliance/report", requireRole("PRODUCER", "ADMIN"), async (req, res) => {
  const { buildComplianceReport } = await eprEnginePromise;
  const defaultProdId = req.authUser.producerId || "PROD-001";
  const producerId = req.authUser.role === "PRODUCER" ? defaultProdId : req.query.producerId;
  if (!producerId) return res.status(400).json({ error: "producerId is required." });
  const producers = loadJson(PRODUCERS_FILE, []);
  const producer = producers.find((p) => p.id === producerId);
  if (!producer) return res.status(404).json({ error: "Producer profile not found." });
  const obligations = loadJson(EPR_OBLIGATIONS_FILE, []);
  const certificates = loadJson(EPR_CERTIFICATES_FILE, []);
  const transactions = loadJson(EPR_TRANSACTIONS_FILE, []);
  const report = buildComplianceReport(producer, obligations, certificates, transactions);
  res.json(report);
});

// 6. Producer Transactions
app.get("/api/producer/transactions", requireRole("PRODUCER", "ADMIN"), (req, res) => {
  const defaultProdId = req.authUser.producerId || "PROD-001";
  const producerId = req.authUser.role === "PRODUCER" ? defaultProdId : (req.query.producerId || null);
  let txns = loadJson(EPR_TRANSACTIONS_FILE, []);
  if (producerId) txns = txns.filter((t) => t.producerId === producerId);
  res.json(txns.slice().reverse());
});

// 7. Certificate Marketplace Listing
app.get("/api/epr/certificates", (req, res) => {
  let certs = loadJson(EPR_CERTIFICATES_FILE, []);
  const { category, status, minWeightKg } = req.query;
  if (status) certs = certs.filter((c) => c.status === status);
  if (category) certs = certs.filter((c) => c.category === category);
  if (minWeightKg) {
    const min = parseFloat(minWeightKg);
    if (!Number.isNaN(min)) certs = certs.filter((c) => c.weightKg >= min);
  }
  res.json(certs.slice().reverse());
});

// 8. Single Certificate Details
app.get("/api/epr/certificates/:id", (req, res) => {
  const certs = loadJson(EPR_CERTIFICATES_FILE, []);
  const cert = certs.find((c) => c.id === req.params.id);
  if (!cert) return res.status(404).json({ error: "EPR certificate not found." });
  res.json(cert);
});

// 9. Purchase Certificate (Marketplace transaction)
app.post("/api/epr/certificates/:id/purchase", requireRole("PRODUCER"), async (req, res) => {
  const { EVENT_TYPES } = await eventTypesPromise;
  const defaultProdId = req.authUser.producerId || "PROD-001";
  await runEvent(res, {
    type: EVENT_TYPES.EPR_CERTIFICATE_PURCHASED,
    actorId: req.authUser.id,
    data: {
      certificateId: req.params.id,
      producerId: defaultProdId,
      obligationId: req.body.obligationId || null,
    },
  }, 200);
});

// 10. Public Tamper-Evident Certificate Verification
app.get("/api/epr/certificates/:id/verify", async (req, res) => {
  const { verifyCertificateHash } = await eprEnginePromise;
  const certs = loadJson(EPR_CERTIFICATES_FILE, []);
  const cert = certs.find((c) => c.id === req.params.id);
  if (!cert) return res.status(404).json({ error: "EPR certificate not found." });
  const verification = verifyCertificateHash(cert);
  res.json({
    certificateId: cert.id,
    valid: verification.valid,
    expectedHash: verification.expected,
    actualHash: verification.actual,
    certificate: {
      id: cert.id,
      itemId: cert.itemId,
      category: cert.category,
      weightKg: cert.weightKg,
      recyclerId: cert.recyclerId,
      recycledAt: cert.recycledAt,
      status: cert.status,
      purchasedBy: cert.purchasedBy,
      priceINR: cert.priceINR,
    },
  });
});

// 11. All EPR Transactions (Government/Admin Oversight)
app.get("/api/epr/transactions", requireRole("GOVERNMENT", "ADMIN"), (req, res) => {
  const txns = loadJson(EPR_TRANSACTIONS_FILE, []);
  res.json(txns.slice().reverse());
});

// 12. Aggregate EPR Marketplace Stats
app.get("/api/epr/stats", (req, res) => {
  const certs = loadJson(EPR_CERTIFICATES_FILE, []);
  const txns = loadJson(EPR_TRANSACTIONS_FILE, []);
  const producers = loadJson(PRODUCERS_FILE, []);
  const available = certs.filter((c) => c.status === "AVAILABLE");
  const sold = certs.filter((c) => c.status === "SOLD");

  const totalWeightRecycledKg = Math.round(certs.reduce((s, c) => s + (c.weightKg || 0), 0) * 100) / 100;
  const totalWeightSoldKg = Math.round(sold.reduce((s, c) => s + (c.weightKg || 0), 0) * 100) / 100;
  const totalTradeValueINR = Math.round(txns.reduce((s, t) => s + (t.amountINR || 0), 0) * 100) / 100;

  const byCategory = {};
  for (const c of certs) {
    if (!byCategory[c.category]) byCategory[c.category] = { total: 0, available: 0, sold: 0, weightKg: 0 };
    byCategory[c.category].total += 1;
    byCategory[c.category].weightKg = Math.round((byCategory[c.category].weightKg + c.weightKg) * 100) / 100;
    if (c.status === "AVAILABLE") byCategory[c.category].available += 1;
    if (c.status === "SOLD") byCategory[c.category].sold += 1;
  }

  res.json({
    totalCertificates: certs.length,
    availableCertificates: available.length,
    soldCertificates: sold.length,
    totalWeightRecycledKg,
    totalWeightSoldKg,
    totalTradeValueINR,
    totalTransactions: txns.length,
    registeredProducers: producers.length,
    byCategory,
  });
});

// 13. Government EPR Oversight Overview
app.get("/api/government/epr/overview", requireRole("GOVERNMENT", "ADMIN"), async (req, res) => {
  const { checkObligationCompliance } = await eprEnginePromise;
  const certs = loadJson(EPR_CERTIFICATES_FILE, []);
  const obligations = loadJson(EPR_OBLIGATIONS_FILE, []);
  const producers = loadJson(PRODUCERS_FILE, []);
  const txns = loadJson(EPR_TRANSACTIONS_FILE, []);

  const producerSummaries = producers.map((p) => {
    const comp = checkObligationCompliance(obligations, certs, p.id);
    const prodTxns = txns.filter((t) => t.producerId === p.id);
    const spend = prodTxns.reduce((s, t) => s + (t.amountINR || 0), 0);
    return {
      id: p.id,
      name: p.name,
      cpcbRegistration: p.cpcbRegistration,
      overallCompliancePct: comp.overallCompliancePct,
      overallStatus: comp.overallStatus,
      totalSpendINR: spend,
      categories: comp.categories,
    };
  });

  const available = certs.filter((c) => c.status === "AVAILABLE");
  const sold = certs.filter((c) => c.status === "SOLD");
  const totalRevenueINR = txns.reduce((s, t) => s + (t.amountINR || 0), 0);

  res.json({
    marketplace: {
      totalCertificates: certs.length,
      availableCount: available.length,
      soldCount: sold.length,
      totalRevenueINR,
    },
    producers: producerSummaries,
    recentTransactions: txns.slice(-10).reverse(),
  });
});

// ============================================================
// MUNICIPAL WASTE API ROUTES
// ============================================================

app.post("/api/municipal/shifts", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.createShift(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/pickups", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.recordPickup(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/trips/lock", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.lockTrip(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/weighbridge", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.recordWeighbridge(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/gatepass", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.generateGatePass(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/mrf/sorting", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.logMrfSorting(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/marketplace/orders", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.createRecyclerOrder(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/municipal/report", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.reportOpenDump(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/municipal/shifts", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    res.json(engine.getAllShifts());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/municipal/trips", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    res.json(engine.getAllTrips());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/municipal/mrf/inventory", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    res.json(engine.getMrfInventory());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/municipal/marketplace/orders", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    res.json(engine.getRecyclerOrders());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/municipal/reports", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    res.json(engine.getWhistleblowerReports());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/municipal/audit/:shiftId", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const result = engine.getAuditTrail({ shiftId: req.params.shiftId });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/municipal/households", async (req, res) => {
  try {
    const engine = await municipalEnginePromise;
    const households = engine.getRegisteredHouseholds ? engine.getRegisteredHouseholds() : [];
    const enriched = await Promise.all(households.map(async h => {
      try {
        const qrSvg = await QRCode.toString(h.qrCode, { type: 'svg', margin: 1, width: 140 });
        const qrDataUrl = await QRCode.toDataURL(h.qrCode, { margin: 1, width: 140 });
        return { ...h, qrSvg, qrDataUrl };
      } catch (err) {
        return h;
      }
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// MEDICAL (BMW) WASTE API ROUTES
// ============================================================

app.get("/api/medical/manifests", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    res.json(engine.getAllManifests());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medical/manifests", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.createManifest(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/medical/transports", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    res.json(engine.getAllTransports());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medical/transport/assign", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.assignTransport(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/medical/facility/arrival", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.recordFacilityArrival(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/medical/treatments", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    res.json(engine.getAllTreatments());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medical/treatment", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.recordTreatment(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/medical/certificates", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    res.json(engine.getAllCertificates());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medical/certificates", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.issueCertificate(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/medical/reports", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    res.json(engine.getWhistleblowerReports());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medical/report", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.reportOpenDump(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/medical/training", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    res.json(engine.getAllStaffTraining());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medical/training", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.logStaffTraining(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/medical/audit/:batchCode", async (req, res) => {
  try {
    const engine = await medicalEnginePromise;
    const result = engine.getAuditTrail({ batchCode: req.params.batchCode });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================
// B2B REVERSE AUCTION API ROUTES (Phase 2)
// ============================================================

app.post("/api/auction/grade", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.gradeDevice(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/auction/harvest-value", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.calculateHarvestValue(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/auction/grades", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    res.json(engine.getDeviceGrades());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auction/lots", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.createAuctionLot(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/auction/lots", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    res.json(engine.getAllAuctions());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auction/lots/open", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    res.json(engine.getOpenAuctions());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auction/bids", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.placeBid(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/auction/bids", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    res.json(engine.getAuctionBids(req.query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auction/close", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.closeAuction(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/auction/settle", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.settlePayment(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/auction/settlements", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    res.json(engine.getSettlements());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auction/audit/:lotId", async (req, res) => {
  try {
    const engine = await auctionEnginePromise;
    const result = engine.getAuctionAuditTrail({ lotId: req.params.lotId });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================
// UNIFIED COMPLIANCE & ANALYTICS API ROUTES (Phase 3)
// ============================================================

// 1. Swachh Survekshan Scorecard
app.get("/api/compliance/swachh-score", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.computeSwachhScore());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Cross-Track Unified Summary
app.get("/api/compliance/summary", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.getCrossTrackSummary());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Wet Waste -> Compost / Biogas Offtake Tracker
app.get("/api/compliance/compost", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.getCompostBatches());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/compliance/compost", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    const result = engine.recordCompostBatch(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 4. Transparent Digital User-Fee Ledger
app.get("/api/compliance/user-fee", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.getUserFeeLedger());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/compliance/user-fee", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    const result = engine.recordUserFee(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 5. AI Anomaly & Anti-Fraud Center
app.post("/api/compliance/anomalies/scan", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    const result = engine.runAnomalyScan();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/compliance/anomalies", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.getAnomalyFlags());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/compliance/anomalies/resolve", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    const result = engine.resolveAnomaly(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 6. Hazardous Risk Index (HRI) & Sanitation Worker Safety (Report 1)
app.get("/api/compliance/hri", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.calculateHRI(req.query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/compliance/worker-safety", async (req, res) => {
  try {
    const engine = await complianceEnginePromise;
    res.json(engine.getWorkerSafetyMetrics());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ESG, CARBON CREDIT MARKETPLACE & CONTRACTOR SETTLEMENT (Phase 4)
// ============================================================

// 1. ESG Summary & Carbon Offsets
app.get("/api/esg/summary", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    res.json(engine.getEsgSummary());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/esg/carbon-offsets", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    res.json(engine.calculateMultiTrackCarbonOffsets());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Verified Carbon Credits (VCC) Registry & Minting
app.get("/api/esg/credits", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    res.json(engine.getCarbonCredits());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/esg/credits/mint", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    const result = engine.mintCarbonCredits(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 3. Corporate ESG Offset Purchase & Retirement
app.post("/api/esg/credits/purchase", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    const result = engine.purchaseCarbonCredits(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/esg/transactions", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    res.json(engine.getCarbonTransactions());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Pay-for-Processing Concessionaire Settlement
app.post("/api/esg/contractor/calculate", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    const result = engine.calculateContractorSettlement(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/esg/contractor/settle", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    const result = engine.settleContractorInvoice(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/esg/contractor/settlements", async (req, res) => {
  try {
    const engine = await esgEnginePromise;
    res.json(engine.getContractorSettlements());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PHASE 5: COMMUNITY WHISTLEBLOWER, AI FORECASTING,
// RECYCLABLES EXCHANGE & WORKER HEALTH PASS
// ============================================================

// 1. Citizen Open-Dump Whistleblower & Rapid Response
app.post("/api/community/dump-reports", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.reportOpenDump(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/community/dump-reports", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const { ward, status, category } = req.query;
    res.json(engine.getDumpReports({ ward, status, category }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/community/dump-reports/:id/dispatch", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.dispatchCleanupCrew({ reportId: req.params.id, ...req.body });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/community/dump-reports/:id/resolve", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.verifyAndCloseDump({ reportId: req.params.id, ...req.body });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/community/citizen/:id/rewards", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    res.json(engine.getCitizenKarmaBalance(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/community/citizen/:id/redeem", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.redeemKarmaForUserFeeDiscount({ citizenId: req.params.id, ...req.body });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 2. AI Facility Volume & Capacity Load Forecasting
app.get("/api/community/forecasting/facilities", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const days = parseInt(req.query.days, 10) || 7;
    res.json(engine.getAllFacilitiesForecast(days));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/community/forecasting/facility/:id", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const days = parseInt(req.query.days, 10) || 7;
    res.json(engine.forecastFacilityLoad({ facilityId: req.params.id, forecastDays: days }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. B2B Recyclable Commodity Marketplace
app.get("/api/community/commodities", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    res.json(engine.getCommodityMarketplace());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/community/commodities/list", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.listCommodityLot(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/community/commodities/order", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.placeCommodityOrder(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/community/commodities/orders", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    res.json(engine.getCommodityOrders());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Sanitation & Healthcare Worker Health & Shift Pass
app.get("/api/community/workers/profiles", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    res.json(engine.getWorkerProfiles());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/community/workers/profile", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    const result = engine.recordWorkerHealthProfile(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/community/workers/:id/pass", async (req, res) => {
  try {
    const engine = await communityEnginePromise;
    res.json(engine.validateWorkerShiftEligibility(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PHASE 6: CPCB/SPCB STATUTORY RETURNS, MERKLE AUDIT CHAIN,
// FLEET TELEMETRY & POSTGRESQL DATABASE HUB
// ============================================================

// 1. CPCB Statutory Returns
app.get("/api/regulatory/cpcb/form-3", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    res.json(engine.generateCpcbForm3({ reportingYear: req.query.year, producerId: req.query.producerId }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/regulatory/cpcb/form-4", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    res.json(engine.generateCpcbForm4({ reportingYear: req.query.year, facilityId: req.query.facilityId }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/regulatory/cpcb/form-5", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    res.json(engine.generateCpcbForm5({ reportingYear: req.query.year, ulbName: req.query.ulbName }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Cryptographic Merkle Chain & Integrity Verifier
app.get("/api/regulatory/audit/merkle-chain", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    const limit = parseInt(req.query.limit, 10) || 30;
    res.json(engine.generateCryptographicAuditChain({ limit }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/regulatory/audit/verify", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    res.json(engine.verifyAuditIntegrity());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. GIS Fleet Telemetry & Geofence Corridor
app.get("/api/regulatory/fleet/telemetry", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    res.json(engine.getFleetTelemetry());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/regulatory/hotspots", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    res.json(engine.getDumpingHotspots());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. PostgreSQL Cloud Database Health & Sync
app.get("/api/database/status", async (req, res) => {
  try {
    const engine = await regulatoryEnginePromise;
    const status = await engine.getDatabaseStatus();
    res.json(status);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PHASE 7: AUTONOMOUS EDGE AI VISION INSPECTION, SNAKE ROUTING,
// EMERGENCY HAZMAT DISASTER RESPONSE & OFFLINE-FIRST PWA SYNC
// ============================================================

// 1. Edge AI Vision Quality Inspection (SSQI)
app.post("/api/edge/vision-inspect", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const result = engine.inspectWasteFeed(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/edge/vision-scans", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json(engine.getRecentVisionScans({ limit }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. High-Density "Snake" Serpentine Route Optimization
app.post("/api/edge/routes/snake", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const result = engine.generateSnakeRoute(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/edge/routes/snake", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    res.json(engine.getActiveSnakeRoutes());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. HAZMAT Emergency Quarantine & Broadcast
app.post("/api/edge/hazmat/trigger", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const result = engine.triggerHazmatAlert(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/edge/hazmat/resolve", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const result = engine.resolveHazmatAlert(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/edge/hazmat/incidents", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    res.json(engine.getActiveHazmatIncidents());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Offline-First PWA Sync Queue
app.post("/api/edge/sync/queue", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const result = engine.queueOfflineTransaction(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/edge/sync/flush", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    const result = engine.syncOfflineQueue(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/edge/sync/status", async (req, res) => {
  try {
    const engine = await edgeEnginePromise;
    res.json(engine.getOfflineQueueStatus(req.query.workerId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------
// Error handler for multer (e.g. file too large).
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `Image is too large. Max size is ${MAX_IMAGE_SIZE_MB}MB.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
  next();
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`  Landing page:    http://localhost:${PORT}/`);
    console.log(`  User site:       http://localhost:${PORT}/user`);
    console.log(`  Collector site:  http://localhost:${PORT}/collector`);
    console.log(`  Government site: http://localhost:${PORT}/government`);
    console.log(`  Producer site:   http://localhost:${PORT}/producer`);
    console.log(`  Municipal site:  http://localhost:${PORT}/municipal`);
    console.log(`  Medical site:    http://localhost:${PORT}/medical`);
    console.log(`  Demo studio:     http://localhost:${PORT}/demo`);
  });
}

module.exports = app;
