import { runSocialHypeAnalyst, socialHypeKeysConfigured } from "./agents/socialHypeAnalyst.js";

/**
 * @param {import('http').IncomingMessage} req
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function processSocialHypeRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const locale = body.locale === "es" ? "es" : "en";
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

    if (!brandName) {
      sendJson(res, 400, { error: "brandName is required" });
      return;
    }

    if (!socialHypeKeysConfigured()) {
      sendJson(res, 503, {
        error: "Social hype scan unavailable — configure SERPAPI_KEY, APIFY_API_TOKEN, or GROQ_API_KEY",
      });
      return;
    }

    const result = await runSocialHypeAnalyst({
      locale,
      brandName,
      keyword: keyword || brandName,
    });

    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "Social hype analyst failed",
    });
  }
}

/**
 * Vite / Node middleware for POST /api/agents/social-hype-analyst
 */
export function createSocialHypeAnalystMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/agents/social-hype-analyst") {
      next();
      return;
    }
    await processSocialHypeRequest(req, res);
  };
}

/**
 * Vite middleware — POST /api/analytics/social-hype (fallback route).
 */
export function createSocialHypeAnalyticsMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/analytics/social-hype") {
      next();
      return;
    }
    await processSocialHypeRequest(req, res);
  };
}

export { processSocialHypeRequest };
