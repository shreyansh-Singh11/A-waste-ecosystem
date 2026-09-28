var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/v1/identify-ewaste.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
__name(onRequestOptions, "onRequestOptions");
async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json(
        { error: "Invalid content-type. Please upload as multipart/form-data." },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return Response.json(
        { error: "No image file provided in field 'image'." },
        { status: 400, headers: CORS_HEADERS }
      );
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
        const promptText = `
Analyze this electronic item for e-waste classification and physical condition assessment.
Return a JSON array with one object per detected device:
[
  {
    "device": "Device Name (e.g. Laptop, iPhone 12, CRT Monitor)",
    "category": "Computing Device | Consumer Electronics | Monitor | Battery / Power | Small Household Appliance",
    "confidence": 0.95,
    "reason": "Concise physical inspection justification",
    "condition": {
      "screen": "INTACT | SCRATCHED | CRACKED | SHATTERED | NOT_APPLICABLE",
      "casing": "INTACT | DENTED | CRACKED | SEVERELY_DAMAGED",
      "battery": "NORMAL | DEGRADED | SWOLLEN | MISSING | UNKNOWN",
      "grade": "GRADE_A | GRADE_B | GRADE_C"
    },
    "recommendedOutcome": "REFURBISH | HARVEST_PARTS | RECYCLE",
    "recommendationReason": "One-sentence circular engineering recommendation"
  }
]
`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                  { text: promptText }
                ]
              }
            ],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.1
            }
          })
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
      } catch (geminiErr) {
        console.warn("[Cloudflare Pages Edge Vision] Gemini REST call skipped/failed:", geminiErr);
      }
    }
    if (!detection) {
      detection = getEdgeVisionFallback(filename);
    }
    const valuation = calculateValuation(detection);
    const responsePayload = {
      device: detection.device,
      category: detection.category,
      confidence: detection.confidence,
      confidenceLevel: detection.confidence >= 0.85 ? "high" : detection.confidence >= 0.65 ? "medium" : "low",
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
      isHazardousBattery: detection.condition?.battery === "SWOLLEN",
      detections: [
        {
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
          isHazardousBattery: detection.condition?.battery === "SWOLLEN"
        }
      ],
      demoMode: !isRealGemini,
      geminiAvailable: isRealGemini,
      edgeRuntime: "Cloudflare Pages V8 Worker"
    };
    return Response.json(responsePayload, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[Cloudflare Edge Vision Error]", error);
    return Response.json(
      { error: "Edge Vision processing failed. " + error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
__name(onRequestPost, "onRequestPost");
function getEdgeVisionFallback(filename) {
  if (filename.includes("phone") || filename.includes("iphone") || filename.includes("pixel") || filename.includes("samsung") || filename.includes("mobile")) {
    return {
      device: "Apple iPhone 12",
      category: "Consumer Electronics",
      confidence: 0.96,
      reason: "[Cloudflare Edge Vision] Smartphone identified with intact OLED display panel and dual camera module.",
      condition: { screen: "INTACT", casing: "INTACT", battery: "NORMAL", grade: "GRADE_A" },
      recommendedOutcome: "REFURBISH",
      recommendationReason: "Display panel and logic board are fully functional; eligible for Grade-A circular refurbishment and secondary market resale."
    };
  }
  if (filename.includes("battery") || filename.includes("cell") || filename.includes("powerbank") || filename.includes("li-ion")) {
    const isSwollen = filename.includes("swollen") || filename.includes("bulge") || filename.includes("hazard");
    return {
      device: "High-Density Li-Ion Battery Pack",
      category: "Battery / Power",
      confidence: 0.95,
      reason: isSwollen ? "[Cloudflare Edge Vision - CRITICAL HAZARD] Swollen Li-ion pouch cell with casing separation detected. Thermal runaway risk!" : "[Cloudflare Edge Vision] Lithium-ion battery module with terminal casing intact.",
      condition: {
        screen: "NOT_APPLICABLE",
        casing: isSwollen ? "SEVERELY_DAMAGED" : "DENTED",
        battery: isSwollen ? "SWOLLEN" : "DEGRADED",
        grade: "GRADE_C"
      },
      recommendedOutcome: "RECYCLE",
      recommendationReason: isSwollen ? "CRITICAL HAZARD: Thermal runaway risk. Isolate in fireproof container and divert to hazardous e-waste smelter." : "Chemical degradation threshold reached. Recommended for closed-loop cobalt and lithium hydrometallurgical recovery."
    };
  }
  if (filename.includes("monitor") || filename.includes("screen") || filename.includes("display") || filename.includes("tv")) {
    return {
      device: 'Dell UltraSharp 27" LED Monitor',
      category: "Monitor",
      confidence: 0.93,
      reason: "[Cloudflare Edge Vision] Flat-panel IPS display with intact backlight diffuser and VESA mount.",
      condition: { screen: "INTACT", casing: "DENTED", battery: "NOT_APPLICABLE", grade: "GRADE_B" },
      recommendedOutcome: "REFURBISH",
      recommendationReason: "Display panel and power inverter intact. Minor cosmetic bezel wear; ideal candidate for institutional refurbishment."
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
      recommendationReason: "High intrinsic gold, silver, and palladium content across PCIe pins and chipset traces. High-yield urban mining candidate."
    };
  }
  return {
    device: "Lenovo ThinkPad T480 Laptop",
    category: "Computing Device",
    confidence: 0.94,
    reason: "[Cloudflare Edge Vision] Laptop form factor identified with keyboard assembly, trackpad, and intact display panel.",
    condition: { screen: "INTACT", casing: "DENTED", battery: "NORMAL", grade: "GRADE_B" },
    recommendedOutcome: "REFURBISH",
    recommendationReason: "Display panel and motherboard are intact; light chassis denting makes this unit an ideal candidate for Grade-B commercial refurbishment."
  };
}
__name(getEdgeVisionFallback, "getEdgeVisionFallback");
function calculateValuation(detection) {
  const cat = detection.category || "";
  let metalsGrams = { gold: 0.05, silver: 0.3, palladium: 0.02, copper: 150 };
  let intrinsicMetalValueINR = 850;
  let bonus = 15;
  let matchedKey = "Generic Device";
  if (cat === "Computing Device") {
    metalsGrams = { gold: 0.25, silver: 0.8, palladium: 0.15, copper: 400 };
    intrinsicMetalValueINR = 2381;
    bonus = 48;
    matchedKey = "Generic Desktop / Laptop";
  } else if (cat === "Consumer Electronics") {
    metalsGrams = { gold: 0.08, silver: 0.45, palladium: 0.04, copper: 85 };
    intrinsicMetalValueINR = 920;
    bonus = 25;
    matchedKey = "Smartphones / Wearables";
  } else if (cat === "Battery / Power") {
    metalsGrams = { gold: 0, silver: 0, palladium: 0, copper: 320 };
    intrinsicMetalValueINR = 450;
    bonus = 30;
    matchedKey = "Li-Ion Battery Cells";
  }
  let estimatedSalvageValueINR = intrinsicMetalValueINR;
  if (detection.recommendedOutcome === "REFURBISH") {
    estimatedSalvageValueINR = detection.condition?.grade === "GRADE_A" ? Math.round(intrinsicMetalValueINR * 2.8 + 2e3) : Math.round(intrinsicMetalValueINR * 1.8 + 800);
  } else if (detection.recommendedOutcome === "HARVEST_PARTS") {
    estimatedSalvageValueINR = Math.round(intrinsicMetalValueINR * 1.3 + 300);
  }
  return {
    metalsGrams,
    intrinsicMetalValueINR,
    estimatedSalvageValueINR,
    preciousMetalBonus: bonus,
    preciousMetalMatch: matchedKey
  };
}
__name(calculateValuation, "calculateValuation");

// api/[[path]].js
var CORS_HEADERS2 = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS2 });
  }
  const backendUrl = env.BACKEND_URL ? env.BACKEND_URL.replace(/\/+$/, "") : null;
  if (backendUrl) {
    const url = new URL(request.url);
    const targetUrl = `${backendUrl}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? void 0 : request.body,
      redirect: "follow"
    });
    try {
      const response = await fetch(proxyRequest);
      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS2)) {
        newHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return Response.json(
        { error: "Backend proxy unreachable: " + err.message },
        { status: 502, headers: CORS_HEADERS2 }
      );
    }
  }
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  if (path === "health" || path === "v1/health") {
    return Response.json(
      { status: "ok", mode: "cloudflare-pages-edge", timestamp: (/* @__PURE__ */ new Date()).toISOString() },
      { headers: CORS_HEADERS2 }
    );
  }
  if (path.startsWith("wallet/")) {
    const owner = path.split("/")[1] || "user";
    return Response.json(
      { owner, balance: 450, totalEarned: 600, totalSpent: 150 },
      { headers: CORS_HEADERS2 }
    );
  }
  if (path.startsWith("users/") && path.endsWith("/card")) {
    const owner = path.split("/")[1] || "Citizen";
    return Response.json(
      { owner, itemsRegistered: 8, recycledItems: 6, totalCreditsEarned: 450, rank: "Silver Eco Citizen" },
      { headers: CORS_HEADERS2 }
    );
  }
  if (path === "rewards") {
    return Response.json([
      { id: "rew-1", name: "\u20B9100 Electricity Bill Voucher", requiredCredits: 200, description: "State Discom rebate" },
      { id: "rew-2", name: "Metro Transit Smart Card Credit (\u20B950)", requiredCredits: 100, description: "Urban metro fare topup" },
      { id: "rew-3", name: "15% Eco-Appliance Exchange Coupon", requiredCredits: 300, description: "BEE 5-star appliance discount" }
    ], { headers: CORS_HEADERS2 });
  }
  return Response.json({
    status: "ok",
    edge: true,
    path: `/api/${path}`,
    note: "Running on Cloudflare Pages. Set BACKEND_URL in Cloudflare Pages dashboard to proxy all dynamic API writes to your Node/Express server."
  }, { headers: CORS_HEADERS2 });
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-skSysk/functionsRoutes-0.15504488791566062.mjs
var routes = [
  {
    routePath: "/api/v1/identify-ewaste",
    mountPath: "/api/v1",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/v1/identify-ewaste",
    mountPath: "/api/v1",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
