// System 6 — GIS Map & Van Route Optimization Engine — automated tests (Option B)
//
// Exercises:
//   1. Haversine distance accuracy
//   2. Coordinate resolution (explicit vs fallback anchors)
//   3. Empty requests & single stop edge cases
//   4. Multi-stop TSP tour generation (Depot -> Stop 1..N -> Depot)
//   5. Priority-weighting (hazardous/urgent pickups prioritized)
//   6. Logistics KPIs: distance, time, fuel saved, transport CO2 avoided
//   7. Polyline coordinates generation for Leaflet rendering
//   8. Depot coordinate fallback
//   9. Deterministic route sequencing
//  10. Return leg back to facility depot
//
// Run with: node --test tests/system6.test.mjs
// Or full suite: node --test --test-concurrency=1 tests/*.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const {
  calculateDistanceKm,
  resolveRequestCoordinates,
  optimizeCollectionRoute,
} = await import("../smartAutomation/routeEngine.mjs");

test("1. calculateDistanceKm precision with Haversine formula", () => {
  // Bhopal collector (MP Nagar area) to Arera Colony (~2.5 km)
  const dist = calculateDistanceKm(23.2325, 77.4310, 23.2160, 77.4250);
  assert.ok(dist > 1.5 && dist < 3.0, `Expected distance ~2 km, got ${dist}`);

  // Identical coordinates return 0
  assert.equal(calculateDistanceKm(23.2599, 77.4126, 23.2599, 77.4126), 0);
});

test("2. resolveRequestCoordinates handles explicit coordinates and fallback anchors", () => {
  // Explicit coordinates
  const explicit = resolveRequestCoordinates({ pickupLat: 23.2200, pickupLng: 77.4100 });
  assert.equal(explicit.latitude, 23.2200);
  assert.equal(explicit.longitude, 77.4100);
  assert.equal(explicit.isEstimated, false);

  // Fallback anchor by service area
  const fallback = resolveRequestCoordinates({ serviceArea: "Bhopal Central" });
  assert.equal(fallback.latitude, 23.2450);
  assert.equal(fallback.longitude, 77.4150);
  assert.equal(fallback.isEstimated, true);
});

test("3. optimizeCollectionRoute gracefully handles empty requests array", () => {
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2599, longitude: 77.4126 };
  const route = optimizeCollectionRoute(collector, []);

  assert.equal(route.totalStops, 0);
  assert.equal(route.totalDistanceKm, 0);
  assert.equal(route.kmSaved, 0);
  assert.equal(route.estimatedDurationMinutes, 0);
  assert.equal(route.stops.length, 0);
  assert.equal(route.polylineCoordinates.length, 1);
});

test("4. Single pickup route correctly computes roundtrip (Depot -> Stop -> Depot)", () => {
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2599, longitude: 77.4126 };
  const requests = [
    { id: "CR-01", itemId: "EW-01", pickupAddress: "MP Nagar", pickupLat: 23.2325, pickupLng: 77.4310 },
  ];

  const oneWay = calculateDistanceKm(23.2599, 77.4126, 23.2325, 77.4310);
  const route = optimizeCollectionRoute(collector, requests);

  assert.equal(route.totalStops, 1);
  assert.equal(route.stops[0].stopNumber, 1);
  assert.equal(route.polylineCoordinates.length, 3); // Depot -> Stop 1 -> Depot
  assert.equal(route.totalDistanceKm, Math.round(oneWay * 2 * 100) / 100);
  assert.ok(route.estimatedDurationMinutes > 0);
});

test("5. Multi-stop route links all stops and returns to depot", () => {
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2599, longitude: 77.4126 };
  const requests = [
    { id: "CR-01", itemId: "EW-01", pickupAddress: "Stop A", pickupLat: 23.2400, pickupLng: 77.4100 },
    { id: "CR-02", itemId: "EW-02", pickupAddress: "Stop B", pickupLat: 23.2200, pickupLng: 77.4200 },
    { id: "CR-03", itemId: "EW-03", pickupAddress: "Stop C", pickupLat: 23.2000, pickupLng: 77.4300 },
  ];

  const route = optimizeCollectionRoute(collector, requests);
  assert.equal(route.totalStops, 3);
  assert.equal(route.stops.length, 3);
  assert.equal(route.polylineCoordinates.length, 5); // Depot + 3 stops + Depot
  assert.ok(route.totalDistanceKm > 0);
  assert.ok(route.returnLegDistanceKm > 0);
});

test("6. Priority-weighting pulls urgent/hazardous pickups earlier in route sequence", () => {
  // Depot at [23.2500, 77.4000]
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2500, longitude: 77.4000 };

  // Stop 1 is slightly closer (1.5 km) but LOW priority
  // Stop 2 is slightly farther (1.8 km) but HIGH priority (hazardous battery)
  // With 0.6 priority discount on Stop 2, its effective cost (1.8 * 0.6 = 1.08) beats Stop 1 (1.5 * 1.0 = 1.5)
  const requests = [
    { id: "CR-LOW", itemId: "EW-LOW", pickupAddress: "Nearby Low Priority", pickupLat: 23.2400, pickupLng: 77.4100, priority: { score: 10, level: "LOW" } },
    { id: "CR-HIGH", itemId: "EW-HIGH", pickupAddress: "Farther High Priority", pickupLat: 23.2350, pickupLng: 77.4120, priority: { score: 80, level: "HIGH" } },
  ];

  const route = optimizeCollectionRoute(collector, requests);
  assert.equal(route.stops[0].id, "CR-HIGH", "High-priority stop must be visited first due to priority discount");
  assert.equal(route.stops[1].id, "CR-LOW", "Lower-priority stop visited second");
});

test("7. Fuel saved and CO2 avoided are calculated proportionally to km saved", () => {
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2599, longitude: 77.4126 };
  // Zig-zag input order that benefits significantly from TSP re-ordering
  const requests = [
    { id: "CR-01", itemId: "EW-01", pickupLat: 23.1850, pickupLng: 77.4120 }, // Far South (Kolar)
    { id: "CR-02", itemId: "EW-02", pickupLat: 23.2450, pickupLng: 77.4150 }, // Near Depot
    { id: "CR-03", itemId: "EW-03", pickupLat: 23.1860, pickupLng: 77.4130 }, // Far South (Kolar)
    { id: "CR-04", itemId: "EW-04", pickupLat: 23.2460, pickupLng: 77.4160 }, // Near Depot
  ];

  const route = optimizeCollectionRoute(collector, requests);
  assert.ok(route.unoptimizedDistanceKm >= route.totalDistanceKm);
  if (route.kmSaved > 0) {
    assert.equal(route.fuelSavedLitres, Math.round(route.kmSaved * 0.12 * 100) / 100);
    assert.equal(route.co2SavedKg, Math.round(route.fuelSavedLitres * 2.68 * 100) / 100);
  }
});

test("8. Depot coordinate fallback when collector coordinates are null", () => {
  const collectorWithoutCoords = { id: "COL-99", name: "Virtual Centre", latitude: null, longitude: null };
  const requests = [
    { id: "CR-01", itemId: "EW-01", pickupAddress: "MP Nagar", pickupLat: 23.2325, pickupLng: 77.4310 },
  ];

  const route = optimizeCollectionRoute(collectorWithoutCoords, requests);
  assert.ok(typeof route.depot.latitude === "number");
  assert.ok(typeof route.depot.longitude === "number");
  assert.equal(route.totalStops, 1);
});

test("9. Route polyline coordinates form a closed loop", () => {
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2599, longitude: 77.4126 };
  const requests = [
    { id: "CR-01", itemId: "EW-01", pickupLat: 23.2325, pickupLng: 77.4310 },
    { id: "CR-02", itemId: "EW-02", pickupLat: 23.2160, pickupLng: 77.4250 },
  ];

  const route = optimizeCollectionRoute(collector, requests);
  const poly = route.polylineCoordinates;

  // First and last points must be the collector depot coordinates
  assert.deepEqual(poly[0], [23.2599, 77.4126]);
  assert.deepEqual(poly[poly.length - 1], [23.2599, 77.4126]);
});

test("10. Route optimization algorithm is deterministic", () => {
  const collector = { id: "COL-01", name: "Green Recyclers", latitude: 23.2599, longitude: 77.4126 };
  const requests = [
    { id: "CR-01", itemId: "EW-01", pickupAddress: "A", pickupLat: 23.2420, pickupLng: 77.4020 },
    { id: "CR-02", itemId: "EW-02", pickupAddress: "B", pickupLat: 23.2160, pickupLng: 77.4250 },
    { id: "CR-03", itemId: "EW-03", pickupAddress: "C", pickupLat: 23.2325, pickupLng: 77.4310 },
  ];

  const run1 = optimizeCollectionRoute(collector, requests);
  const run2 = optimizeCollectionRoute(collector, requests);

  assert.deepEqual(run1.stops.map((s) => s.id), run2.stops.map((s) => s.id));
  assert.equal(run1.totalDistanceKm, run2.totalDistanceKm);
  assert.deepEqual(run1.polylineCoordinates, run2.polylineCoordinates);
});
