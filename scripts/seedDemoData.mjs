/**
 * CirculaSync / EcoTrack 360 — Live Demo State Seeder
 *
 * Populates realistic live demo data across Neon Cloud PostgreSQL & JSON flat-files
 * so evaluators and jury members see a vibrant, populated, real-time platform.
 *
 * Usage:
 *   npm run seed
 *   # or: node scripts/seedDemoData.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "..", "data");

const prisma = new PrismaClient();

function saveJson(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadJson(fileName, fallback = []) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return fallback;
  }
}

async function main() {
  console.log("===============================================================");
  console.log("🌱 Priming CirculaSync Live Demo State (Jury Evaluation Ready)");
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log("===============================================================\n");

  try {
    await prisma.$connect();
    console.log("✅ Connected to Neon Cloud PostgreSQL database.");
  } catch (err) {
    console.warn("⚠️ Warning: PostgreSQL connection failed, updating local flat-files only.", err.message);
  }

  // 1. Ensure Demo Users
  console.log("👤 Ensuring demo users (Citizen rahul123, Collector, Government, Admin, Producer)...");
  const users = [
    { id: "usr-01", email: "rahul123@ecotrack.local", role: "CITIZEN", name: "Rahul Sharma", token: "demo-user-token" },
    { id: "usr-02", email: "collector01@ecotrack.local", role: "COLLECTOR", name: "Bhopal Central Facility", token: "demo-collector-token" },
    { id: "usr-03", email: "gov@mppcb.gov.in", role: "GOVERNMENT", name: "MPPCB Admin", token: "demo-gov-token", state: "Madhya Pradesh", district: "Bhopal" },
    { id: "admin1", email: "admin@ecotrack.local", role: "ADMIN", name: "Platform Admin", token: "demo-admin-token" },
    { id: "prod-techvista", email: "epr@techvista.example", role: "PRODUCER", name: "TechVista EPR Manager", token: "demo-producer-token", producerId: "PROD-001" }
  ];
  saveJson("users.json", users.map(u => ({
    id: u.id,
    username: u.email.split("@")[0],
    name: u.name,
    role: u.role,
    token: u.token,
    ...(u.producerId ? { producerId: u.producerId } : {}),
    ...(u.state ? { state: u.state, district: u.district } : {})
  })));

  // 2. Citizen rahul123 Wallet & Card
  console.log("💳 Seeding Citizen rahul123 Eco-Wallet & Items...");
  const wallets = [
    { owner: "rahul123", balance: 1450, totalEarned: 2200, totalRedeemed: 750, updatedAt: new Date().toISOString() }
  ];
  saveJson("wallets.json", wallets);

  const existingItems = loadJson("items.json", []);
  const rahulItems = [
    {
      id: "EW-2026-000101",
      owner: "rahul123",
      device: "Apple iPhone 12 Pro",
      category: "Smartphone",
      age: "3 years",
      condition: "Working, light scratches",
      physicalGrade: "GRADE A",
      lifecycleRecommendation: "REFURBISH",
      metals: { goldGrams: 0.034, silverGrams: 0.35, copperGrams: 15.2, salvageValueINR: 2850 },
      status: "VERIFIED",
      verified: true,
      registeredAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      verifiedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "EW-2026-000102",
      owner: "rahul123",
      device: "Dell Latitude E7470",
      category: "Laptop",
      age: "5 years",
      condition: "Dead battery, display intact",
      physicalGrade: "GRADE B",
      lifecycleRecommendation: "HARVEST_COMPONENTS",
      metals: { goldGrams: 0.12, silverGrams: 1.1, copperGrams: 85.0, salvageValueINR: 4200 },
      status: "COLLECTED",
      verified: false,
      registeredAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  // Merge items
  const mergedItems = [...rahulItems, ...existingItems.filter(i => !i.id.startsWith("EW-2026-00010"))];
  saveJson("items.json", mergedItems);

  // 3. Live 90-Second Reverse Auction Lot
  console.log("🔨 Seeding Live Reverse Auction Lot (Closing in 90 seconds)...");
  const auctionLots = loadJson("auctionLots.json", []);
  const liveLot = {
    lotId: "LOT-AUCTION-DEMO-LIVE",
    title: "High-Yield Grade A/B Smartphone Harvest Batch",
    itemCount: 15,
    totalWeightKg: 4.8,
    estimatedSalvageINR: 32000,
    currentHighestBid: 28500,
    highestBidderId: "RECYCLER-GREEN-CORE-INDORE",
    status: "ACTIVE_BIDDING",
    createdAt: new Date().toISOString(),
    closingAt: new Date(Date.now() + 90000).toISOString() // 90 seconds from now
  };
  const mergedLots = [liveLot, ...auctionLots.filter(l => l.lotId !== "LOT-AUCTION-DEMO-LIVE")];
  saveJson("auctionLots.json", mergedLots);

  // 4. Live Emergency HAZMAT Alert
  console.log("☣️  Seeding Emergency HAZMAT Containment Incident (Ward 12)...");
  const hazmats = loadJson("hazmatIncidents.json", []);
  const activeHazmat = {
    incidentId: "HAZ-2026-0926-01",
    incidentType: "LITHIUM_ION_THERMAL_RUNAWAY",
    severity: "HIGH",
    perimeterLockCode: "9412",
    location: { ward: "Ward 12 (Industrial Zone)", coordinates: [23.235, 77.412] },
    description: "Swollen lithium battery pack thermal smoke detected during conveyor sorting intake.",
    reporterId: "CONVEYOR-OPTICAL-CAM-02",
    status: "ACTIVE_CONTAINMENT",
    sopActions: [
      { step: 1, action: "De-energize Conveyor Belt Actuator", status: "COMPLETED" },
      { step: 2, action: "Deploy Class D Dry Powder Foam Extinguisher", status: "IN_PROGRESS" },
      { step: 3, action: "Seal Fire-Resistant Quarantine Cask #4", status: "PENDING" }
    ],
    multiChannelBroadcast: { smsDispatched: 14, sirenTriggered: true },
    triggeredAt: new Date().toISOString()
  };
  const mergedHazmats = [activeHazmat, ...hazmats.filter(h => h.incidentId !== "HAZ-2026-0926-01")];
  saveJson("hazmatIncidents.json", mergedHazmats);

  // 5. Eulerian Snake Route for Ward 7
  console.log("🐍 Seeding Eulerian Snake Route (Zero-Skipped Streets Guarantee)...");
  const snakeRoutes = loadJson("snakeRoutes.json", []);
  const activeRoute = {
    routeId: "SNAKE-ROUTE-WARD-07",
    wardId: "Ward 07 (Arera Colony)",
    vehicleId: "MP-04-SWM-4412",
    status: "ACTIVE_DISPATCH",
    totalHouseholdsCovered: 384,
    zeroSkippedStreetGuarantee: true,
    telemetryMetrics: {
      totalDistanceKm: 18.4,
      fuelSavedLiters: 4.2,
      co2AvoidedKg: 11.3,
      currentSpeedKmph: 18.5
    },
    waypoints: [
      { lat: 23.215, lng: 77.432, street: "Lane 1 - E-1 Sector", status: "COMPLETED" },
      { lat: 23.218, lng: 77.435, street: "Lane 2 - E-2 Sector", status: "IN_PROGRESS" },
      { lat: 23.222, lng: 77.439, street: "Alley 3 - Link Road", status: "PENDING" }
    ],
    generatedAt: new Date().toISOString()
  };
  const mergedRoutes = [activeRoute, ...snakeRoutes.filter(r => r.routeId !== "SNAKE-ROUTE-WARD-07")];
  saveJson("snakeRoutes.json", mergedRoutes);

  // 6. Sync with Neon Cloud PostgreSQL if reachable
  try {
    if (prisma.user) {
      for (const u of users) {
        await prisma.user.upsert({
          where: { email: u.email },
          update: { name: u.name, role: u.role },
          create: { name: u.name, email: u.email, role: u.role }
        });
      }
    }
    if (prisma.snakeRoute) {
      await prisma.snakeRoute.upsert({
        where: { routeId: activeRoute.routeId },
        update: { telemetryMetrics: activeRoute.telemetryMetrics, waypoints: activeRoute.waypoints },
        create: {
          routeId: activeRoute.routeId,
          wardId: activeRoute.wardId,
          vehicleId: activeRoute.vehicleId,
          totalHouseholdsCovered: activeRoute.totalHouseholdsCovered,
          zeroSkippedStreetGuarantee: true,
          telemetryMetrics: activeRoute.telemetryMetrics,
          waypoints: activeRoute.waypoints
        }
      });
    }
    if (prisma.hazmatIncident) {
      await prisma.hazmatIncident.upsert({
        where: { incidentId: activeHazmat.incidentId },
        update: { status: activeHazmat.status, sopActions: activeHazmat.sopActions },
        create: {
          incidentId: activeHazmat.incidentId,
          incidentType: activeHazmat.incidentType,
          severity: activeHazmat.severity,
          perimeterLockCode: activeHazmat.perimeterLockCode,
          location: activeHazmat.location,
          description: activeHazmat.description,
          reporterId: activeHazmat.reporterId,
          status: activeHazmat.status,
          sopActions: activeHazmat.sopActions,
          multiChannelBroadcast: activeHazmat.multiChannelBroadcast
        }
      });
    }
    console.log("✅ Neon PostgreSQL live demo models synced successfully.");
  } catch (dbErr) {
    console.warn("ℹ️ Note: Database sync skipped (running local demo mode):", dbErr.message);
  }

  console.log("\n===============================================================");
  console.log("🎉 LIVE DEMO STATE SUCCESSFULLY PRIMED!");
  console.log("👉 Open http://localhost:3000 to begin presentation.");
  console.log("• Citizen Account: rahul123 (Auto-loaded on /user)");
  console.log("• Live Reverse Auction: http://localhost:3000/collector (closes in 90s)");
  console.log("• Zero-Skip Snake Route: http://localhost:3000/government (Tab 2: Fleet)");
  console.log("• Active HAZMAT Alert: http://localhost:3000/government (Tab 5: Safety)");
  console.log("===============================================================\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Error seeding demo state:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
