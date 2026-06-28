import { runCampaignAnalyst } from "./agents/campaignAnalyst.js";

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
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

/**
 * Vite / Node middleware for POST /api/agents/analyze
 */
export function createCampaignAnalystMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/agents/analyze") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const locale = body.locale === "es" ? "es" : "en";
      const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
      const analystBrief = typeof body.analystBrief === "string" ? body.analystBrief : "";
      const primaryQuestion = typeof body.primaryQuestion === "string" ? body.primaryQuestion : "";
      const detection = body.detection && typeof body.detection === "object" ? body.detection : {};
      const ignoredTopics = Array.isArray(body.ignoredTopics) ? body.ignoredTopics : [];

      if (!brandName) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "brandName is required" }));
        return;
      }

      const report = await runCampaignAnalyst({
        locale,
        brandName,
        analystBrief,
        primaryQuestion,
        detection,
        ignoredTopics,
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(report));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Campaign analyst failed",
      }));
    }
  };
}
