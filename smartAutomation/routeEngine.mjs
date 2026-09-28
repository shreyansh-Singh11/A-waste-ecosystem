/*
  ============================================================
  SYSTEM 6 — Van Route Optimization & GIS Engine (Option B)
  ============================================================
  Algorithmic routing solver for municipal and recycler e-waste
  collection vehicles. Implements:
    1. Precise Haversine geodesic distance calculation
    2. Priority-weighted Travelling Salesperson Problem (TSP)
       heuristic solver using Nearest Neighbor with urgency weighting
    3. Logistics KPIs: total distance, estimated trip duration,
       fuel saved (litres), and transport CO2 emissions avoided
    4. Polyline geometry generation for Leaflet OpenStreetMap rendering
*/

/**
 * Calculates geodesic distance in kilometers between two GPS coordinates
 * using the Haversine spherical formula.
 *
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in km, rounded to 2 decimal places
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Resolves GPS coordinates for a collection request. If coordinates are
 * missing, falls back to representative coordinates based on district/serviceArea.
 *
 * @param {object} req - Collection request record
 * @returns {{ latitude: number, longitude: number, isEstimated: boolean }}
 */
export function resolveRequestCoordinates(req) {
  if (typeof req.pickupLat === "number" && typeof req.pickupLng === "number") {
    return { latitude: req.pickupLat, longitude: req.pickupLng, isEstimated: false };
  }

  // Fallback spatial anchors for demo areas in Madhya Pradesh
  const ANCHORS = {
    "Bhopal Central": { latitude: 23.2450, longitude: 77.4150 },
    "MP Nagar, Bhopal": { latitude: 23.2325, longitude: 77.4310 },
    "Arera Colony, Bhopal": { latitude: 23.2160, longitude: 77.4250 },
    "Kolar Road, Bhopal": { latitude: 23.1850, longitude: 77.4120 },
    "Indore Central": { latitude: 22.7196, longitude: 75.8577 },
    "Vijay Nagar, Indore": { latitude: 22.7533, longitude: 75.8937 },
    "Rajwada, Indore": { latitude: 22.7180, longitude: 75.8550 },
    "default": { latitude: 23.2599, longitude: 77.4126 },
  };

  const key = req.serviceArea || req.district || "default";
  const anchor = ANCHORS[key] || ANCHORS.default;
  return { latitude: anchor.latitude, longitude: anchor.longitude, isEstimated: true };
}

/**
 * Optimizes a collection vehicle's pickup route starting from the
 * collector depot, visiting all assigned pickups in optimal sequence,
 * and returning to the depot.
 *
 * Employs a Priority-Weighted Nearest Neighbor heuristic:
 *   - High priority (hazardous / waiting >24h): distance cost multiplied by 0.60
 *     (draws urgent pickups significantly earlier in the schedule)
 *   - Medium priority: distance cost multiplied by 0.85
 *   - Normal priority: distance cost multiplier 1.00
 *
 * @param {object} collector - Collector profile with latitude and longitude
 * @param {Array<object>} requests - Array of collection requests assigned to this vehicle
 * @returns {object} Full route plan including stops, metrics, and polyline coordinates
 */
export function optimizeCollectionRoute(collector, requests = []) {
  const depotLat = typeof collector.latitude === "number" ? collector.latitude : 23.2599;
  const depotLng = typeof collector.longitude === "number" ? collector.longitude : 77.4126;

  const depot = {
    id: collector.id,
    name: collector.name,
    address: collector.address || "Collection Facility Depot",
    latitude: depotLat,
    longitude: depotLng,
  };

  if (!requests || requests.length === 0) {
    return {
      collectorId: collector.id,
      collectorName: collector.name,
      depot,
      stops: [],
      polylineCoordinates: [[depotLat, depotLng]],
      totalStops: 0,
      totalDistanceKm: 0,
      unoptimizedDistanceKm: 0,
      kmSaved: 0,
      estimatedDurationMinutes: 0,
      fuelSavedLitres: 0,
      co2SavedKg: 0,
      algorithm: "Priority-Weighted Nearest Neighbor TSP",
    };
  }

  // Prepare candidate stops with resolved coordinates
  const candidates = requests.map((r) => {
    const coords = resolveRequestCoordinates(r);
    return {
      id: r.id,
      itemId: r.itemId,
      userId: r.userId,
      pickupAddress: r.pickupAddress || r.serviceArea || "Citizen Residence",
      serviceArea: r.serviceArea || "Local Area",
      priority: r.priority || { score: 10, level: "LOW" },
      latitude: coords.latitude,
      longitude: coords.longitude,
      isEstimated: coords.isEstimated,
    };
  });

  // Calculate unoptimized baseline distance (sequential order + return)
  let unoptimizedDistanceKm = 0;
  let prevLat = depotLat;
  let prevLng = depotLng;
  for (const c of candidates) {
    unoptimizedDistanceKm += calculateDistanceKm(prevLat, prevLng, c.latitude, c.longitude);
    prevLat = c.latitude;
    prevLng = c.longitude;
  }
  unoptimizedDistanceKm += calculateDistanceKm(prevLat, prevLng, depotLat, depotLng);
  unoptimizedDistanceKm = Math.round(unoptimizedDistanceKm * 100) / 100;

  // Solve route with Priority-Weighted Nearest Neighbor
  const orderedStops = [];
  const remaining = candidates.slice();
  let currentLat = depotLat;
  let currentLng = depotLng;
  let totalDistanceKm = 0;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let minWeightedCost = Infinity;
    let actualDistanceForBest = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const dist = calculateDistanceKm(currentLat, currentLng, candidate.latitude, candidate.longitude);

      // Priority factor: lower multiplier gives higher priority
      let factor = 1.0;
      if (candidate.priority.level === "HIGH") factor = 0.60;
      else if (candidate.priority.level === "MEDIUM") factor = 0.85;

      const weightedCost = dist * factor;
      if (weightedCost < minWeightedCost) {
        minWeightedCost = weightedCost;
        bestIndex = i;
        actualDistanceForBest = dist;
      }
    }

    const nextStop = remaining.splice(bestIndex, 1)[0];
    totalDistanceKm += actualDistanceForBest;
    orderedStops.push({
      stopNumber: orderedStops.length + 1,
      ...nextStop,
      distanceFromPreviousKm: Math.round(actualDistanceForBest * 100) / 100,
    });

    currentLat = nextStop.latitude;
    currentLng = nextStop.longitude;
  }

  // Return leg back to depot
  const returnLegDistance = calculateDistanceKm(currentLat, currentLng, depotLat, depotLng);
  totalDistanceKm += returnLegDistance;
  totalDistanceKm = Math.round(totalDistanceKm * 100) / 100;

  // Savings & Environmental impact calculation
  const kmSaved = Math.max(0, Math.round((unoptimizedDistanceKm - totalDistanceKm) * 100) / 100);
  // Average urban collection van speed = 25 km/h + 10 mins loading/handling per stop
  const travelMinutes = (totalDistanceKm / 25) * 60;
  const handlingMinutes = orderedStops.length * 10;
  const estimatedDurationMinutes = Math.round(travelMinutes + handlingMinutes);

  // Commercial diesel van: ~0.12 litres/km. 1L diesel = 2.68 kg CO2
  const fuelSavedLitres = Math.round(kmSaved * 0.12 * 100) / 100;
  const co2SavedKg = Math.round(fuelSavedLitres * 2.68 * 100) / 100;

  // Generate continuous polyline coordinates: Depot -> Stop 1 -> ... -> Stop N -> Depot
  const polylineCoordinates = [
    [depotLat, depotLng],
    ...orderedStops.map((s) => [s.latitude, s.longitude]),
    [depotLat, depotLng],
  ];

  return {
    collectorId: collector.id,
    collectorName: collector.name,
    depot,
    stops: orderedStops,
    returnLegDistanceKm: Math.round(returnLegDistance * 100) / 100,
    polylineCoordinates,
    totalStops: orderedStops.length,
    totalDistanceKm,
    unoptimizedDistanceKm,
    kmSaved,
    estimatedDurationMinutes,
    fuelSavedLitres,
    co2SavedKg,
    algorithm: "Priority-Weighted Nearest Neighbor TSP",
  };
}
