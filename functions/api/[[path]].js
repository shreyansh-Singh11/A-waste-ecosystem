// Cloudflare Pages Function: /api/[[path]]
// Reverse-proxies API requests to BACKEND_URL if configured,
// or provides edge demo fallbacks for standalone Cloudflare Pages deployment.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequest(context) {
  const { request, env, params } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const backendUrl = env.BACKEND_URL ? env.BACKEND_URL.replace(/\/+$/, "") : null;

  // 1. If a backend URL is configured, reverse-proxy the request
  if (backendUrl) {
    const url = new URL(request.url);
    const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "follow",
    });

    try {
      const response = await fetch(proxyRequest);
      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        newHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      return Response.json(
        { error: "Backend proxy unreachable: " + err.message },
        { status: 502, headers: CORS_HEADERS }
      );
    }
  }

  // 2. Standalone Edge Demo Mode (No BACKEND_URL provided)
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";

  // Common demo endpoints
  if (path === "health" || path === "v1/health") {
    return Response.json(
      { status: "ok", mode: "cloudflare-pages-edge", timestamp: new Date().toISOString() },
      { headers: CORS_HEADERS }
    );
  }

  if (path.startsWith("wallet/")) {
    const owner = path.split("/")[1] || "user";
    return Response.json(
      { owner, balance: 450, totalEarned: 600, totalSpent: 150 },
      { headers: CORS_HEADERS }
    );
  }

  if (path.startsWith("users/") && path.endsWith("/card")) {
    const owner = path.split("/")[1] || "Citizen";
    return Response.json(
      { owner, itemsRegistered: 8, recycledItems: 6, totalCreditsEarned: 450, rank: "Silver Eco Citizen" },
      { headers: CORS_HEADERS }
    );
  }

  if (path === "rewards") {
    return Response.json([
      { id: "rew-1", name: "₹100 Electricity Bill Voucher", requiredCredits: 200, description: "State Discom rebate" },
      { id: "rew-2", name: "Metro Transit Smart Card Credit (₹50)", requiredCredits: 100, description: "Urban metro fare topup" },
      { id: "rew-3", name: "15% Eco-Appliance Exchange Coupon", requiredCredits: 300, description: "BEE 5-star appliance discount" }
    ], { headers: CORS_HEADERS });
  }

  // Generic fallback message
  return Response.json({
    status: "ok",
    edge: true,
    path: `/api/${path}`,
    note: "Running on Cloudflare Pages. Set BACKEND_URL in Cloudflare Pages dashboard to proxy all dynamic API writes to your Node/Express server.",
  }, { headers: CORS_HEADERS });
}
