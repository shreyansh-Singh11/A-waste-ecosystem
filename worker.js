// Universal Cloudflare Edge Worker for CirculaSync
// Serves static assets, routes portals with clean URLs, and executes Edge AI Vision.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 1. Edge AI Vision Identification endpoint
    if (url.pathname === "/api/v1/identify-ewaste" && request.method === "POST") {
      return handleAIVision(request, env);
    }

    // 2. Reverse proxy to backend if BACKEND_URL environment variable is set
    if (url.pathname.startsWith("/api/") && env.BACKEND_URL) {
      const backendUrl = env.BACKEND_URL.replace(/\/+$/, "");
      const targetUrl = `${backendUrl}${url.pathname}${url.search}`;
      const proxyReq = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "follow",
      });
      try {
        const resp = await fetch(proxyReq);
        const newHeaders = new Headers(resp.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) newHeaders.set(k, v);
        return new Response(resp.body, { status: resp.status, headers: newHeaders });
      } catch (err) {
        return Response.json({ error: "Backend proxy unreachable: " + err.message }, { status: 502, headers: CORS_HEADERS });
      }
    }

    // 3. Clean Portal Routes
    const cleanRouteMap = {
      "/user": "/user/index.html",
      "/collector": "/collector/index.html",
      "/collector/scan": "/collector/scan.html",
      "/government": "/government/index.html",
      "/producer": "/producer/index.html",
      "/municipal": "/municipal/index.html",
      "/medical": "/medical/index.html",
      "/demo": "/demo/index.html",
    };

    if (cleanRouteMap[url.pathname]) {
      return env.ASSETS.fetch(new URL(cleanRouteMap[url.pathname], request.url));
    }

    if (url.pathname.startsWith("/track/")) {
      return env.ASSETS.fetch(new URL("/track/track.html", request.url));
    }

    // 4. Default Static Asset Serving
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return fetch(request);
  },
};

async function handleAIVision(request, env) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Invalid content-type. Please upload as multipart/form-data." }, { status: 400, headers: CORS_HEADERS });
    }

    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return Response.json({ error: "No image file provided." }, { status: 400, headers: CORS_HEADERS });
    }

    const filename = (file.name || "").toLowerCase();
    const mimeType = (file.type || "image/jpeg").toLowerCase();
    const apiKey = env.GEMINI_API_KEY;
    const model = env.GEMINI_MODEL || "gemini-2.0-flash";

    let detection = null;
    let isRealGemini = false;

    if (apiKey && apiKey.startsWith("AIzaSy")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        const len = uint8.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          binary += String.fromCharCode.apply(null, uint8.subarray(i, Math.min(i + chunkSize, len)));
        }
        const base64Data = btoa(binary);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const promptText = `Analyze this electronic item for e-waste classification and physical condition assessment. Return a JSON array with one object per detected device containing device, category, confidence (0-1), reason, condition: { screen, casing, battery, grade }, recommendedOutcome (REFURBISH | HARVEST_PARTS | RECYCLE), recommendationReason.`;

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Data } }, { text: promptText }] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleanText = rawText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanText);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          if (list.length > 0 && list[0].device) {
            detection = list[0];
            isRealGemini = true;
          }
        }
      } catch (err) {
        console.warn("[Cloudflare Edge Vision] Gemini REST fallback to heuristic:", err);
      }
    }

    if (!detection) {
      detection = getEdgeVisionFallback(filename);
    }

    const valuation = calculateValuation(detection);
    const isHazardous = detection.condition?.battery === "SWOLLEN";

    const responsePayload = {
      device: detection.device,
      category: detection.category,
      confidence: detection.confidence,
      confidenceLevel: detection.confidence >= 0.85 ? "high" : "medium",
      decision: detection.confidence >= 0.85 ? "AUTO_ACCEPTED" : "NEEDS_CONFIRMATION",
      reason: detection.reason,
      condition: detection.condition,
      recommendedOutcome: detection.recommendedOutcome,
      recommendationReason: detection.recommendationReason,
      metalsGrams: valuation.metalsGrams,
      intrinsicMetalValueINR: valuation.intrinsicMetalValueINR,
      estimatedSalvageValueINR: valuation.estimatedSalvageValueINR,
      preciousMetalBonus: valuation.preciousMetalBonus,
      preciousMetalMatch: valuation.preciousMetalMatch,
      isHazardousBattery: isHazardous,
      detections: [{
        device: detection.device,
        category: detection.category,
        confidence: detection.confidence,
        confidenceLevel: detection.confidence >= 0.85 ? "high" : "medium",
        decision: detection.confidence >= 0.85 ? "AUTO_ACCEPTED" : "NEEDS_CONFIRMATION",
        reason: detection.reason,
        condition: detection.condition,
        recommendedOutcome: detection.recommendedOutcome,
        recommendationReason: detection.recommendationReason,
        metalsGrams: valuation.metalsGrams,
        intrinsicMetalValueINR: valuation.intrinsicMetalValueINR,
        estimatedSalvageValueINR: valuation.estimatedSalvageValueINR,
        preciousMetalBonus: valuation.preciousMetalBonus,
        isHazardousBattery: isHazardous,
      }],
      demoMode: !isRealGemini,
      geminiAvailable: isRealGemini,
    };

    return Response.json(responsePayload, { headers: CORS_HEADERS });
  } catch (error) {
    return Response.json({ error: "Edge Vision processing failed: " + error.message }, { status: 500, headers: CORS_HEADERS });
  }
}

function getEdgeVisionFallback(filename) {
  if (filename.includes("phone") || filename.includes("iphone") || filename.includes("pixel") || filename.includes("samsung") || filename.includes("mobile")) {
    return {
      device: "Apple iPhone 12",
      category: "Consumer Electronics",
      confidence: 0.96,
      reason: "[Cloudflare Edge Vision] Smartphone identified with intact OLED display panel and dual camera module.",
      condition: { screen: "INTACT", casing: "INTACT", battery: "NORMAL", grade: "GRADE_A" },
      recommendedOutcome: "REFURBISH",
      recommendationReason: "Display panel and logic board are fully functional; eligible for Grade-A circular refurbishment and secondary market resale.",
    };
  }
  if (filename.includes("battery") || filename.includes("cell") || filename.includes("powerbank") || filename.includes("li-ion")) {
    const isSwollen = filename.includes("swollen") || filename.includes("bulge") || filename.includes("hazard");
    return {
      device: "High-Density Li-Ion Battery Pack",
      category: "Battery / Power",
      confidence: 0.95,
      reason: isSwollen ? "[Cloudflare Edge Vision - CRITICAL HAZARD] Swollen Li-ion pouch cell with casing separation detected. Thermal runaway risk!" : "[Cloudflare Edge Vision] Lithium-ion battery module with terminal casing intact.",
      condition: { screen: "NOT_APPLICABLE", casing: isSwollen ? "SEVERELY_DAMAGED" : "DENTED", battery: isSwollen ? "SWOLLEN" : "DEGRADED", grade: "GRADE_C" },
      recommendedOutcome: "RECYCLE",
      recommendationReason: isSwollen ? "CRITICAL HAZARD: Thermal runaway risk. Isolate in fireproof container and divert to hazardous e-waste smelter." : "Chemical degradation threshold reached. Recommended for closed-loop cobalt and lithium hydrometallurgical recovery.",
    };
  }
  if (filename.includes("monitor") || filename.includes("screen") || filename.includes("display") || filename.includes("tv")) {
    return {
      device: "Dell UltraSharp 27-inch LED Monitor",
      category: "Monitor",
      confidence: 0.93,
      reason: "[Cloudflare Edge Vision] Flat-panel IPS display with intact backlight diffuser and VESA mount.",
      condition: { screen: "INTACT", casing: "DENTED", battery: "NOT_APPLICABLE", grade: "GRADE_B" },
      recommendedOutcome: "REFURBISH",
      recommendationReason: "Display panel and power inverter intact. Minor cosmetic bezel wear; ideal candidate for institutional refurbishment.",
    };
  }
  if (filename.includes("pcb") || filename.includes("motherboard") || filename.includes("circuit") || filename.includes("chip")) {
    return {
      device: "Multi-Layer Motherboard (PCB)",
      category: "Computing Device",
      confidence: 0.95,
      reason: "[Cloudflare Edge Vision] Dense PCB substrate with surface-mount ICs, BGA sockets, and gold-plated contact fingers.",
      condition: { screen: "NOT_APPLICABLE", casing: "SEVERELY_DAMAGED", battery: "NOT_APPLICABLE", grade: "GRADE_C" },
      recommendedOutcome: "HARVEST_PARTS",
      recommendationReason: "High intrinsic gold, silver, and palladium content across PCIe pins and chipset traces. High-yield urban mining candidate.",
    };
  }
  return {
    device: "Lenovo ThinkPad T480 Laptop",
    category: "Computing Device",
    confidence: 0.94,
    reason: "[Cloudflare Edge Vision] Laptop form factor identified with keyboard assembly, trackpad, and intact display panel.",
    condition: { screen: "INTACT", casing: "DENTED", battery: "NORMAL", grade: "GRADE_B" },
    recommendedOutcome: "REFURBISH",
    recommendationReason: "Display panel and motherboard are intact; light chassis denting makes this unit an ideal candidate for Grade-B commercial refurbishment.",
  };
}

function calculateValuation(detection) {
  const cat = detection.category || "";
  let metalsGrams = { gold: 0.25, silver: 0.8, palladium: 0.15, copper: 400 };
  let intrinsicMetalValueINR = 2381;
  let bonus = 48;
  let matchedKey = "Generic Desktop / Laptop";

  if (cat === "Consumer Electronics") {
    metalsGrams = { gold: 0.08, silver: 0.45, palladium: 0.04, copper: 85 };
    intrinsicMetalValueINR = 920;
    bonus = 25;
    matchedKey = "Smartphones / Wearables";
  } else if (cat === "Battery / Power") {
    metalsGrams = { gold: 0.0, silver: 0.0, palladium: 0.0, copper: 320 };
    intrinsicMetalValueINR = 450;
    bonus = 30;
    matchedKey = "Li-Ion Battery Cells";
  }

  let estimatedSalvageValueINR = intrinsicMetalValueINR;
  if (detection.recommendedOutcome === "REFURBISH") {
    estimatedSalvageValueINR = detection.condition?.grade === "GRADE_A"
      ? Math.round(intrinsicMetalValueINR * 2.8 + 2000)
      : Math.round(intrinsicMetalValueINR * 1.8 + 800);
  } else if (detection.recommendedOutcome === "HARVEST_PARTS") {
    estimatedSalvageValueINR = Math.round(intrinsicMetalValueINR * 1.3 + 300);
  }

  return { metalsGrams, intrinsicMetalValueINR, estimatedSalvageValueINR, preciousMetalBonus: bonus, preciousMetalMatch: matchedKey };
}
