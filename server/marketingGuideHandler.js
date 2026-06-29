import { runMarketingGuide } from "./agents/marketingGuide.js";
import { processSocialHypeRequest } from "./socialHypeAnalystHandler.js";

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
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function handleSocialHypeAnalystRequest(req, res) {
  await processSocialHypeRequest(req, res);
}

/**
 * Vite / Node middleware for POST /api/agents/marketing-guide
 * and POST /api/agents/social-hype-analyst (same plugin registration).
 */
export function createMarketingGuideMiddleware() {
  return async (req, res, next) => {
    const path = req.url?.split("?")[0];

    if (path === "/api/agents/social-hype-analyst") {
      await handleSocialHypeAnalystRequest(req, res);
      return;
    }

    if (path !== "/api/agents/marketing-guide") {
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
      const detection = body.detection && typeof body.detection === "object" ? body.detection : {};
      const analystReport = body.analystReport && typeof body.analystReport === "object"
        ? body.analystReport
        : {};
      const marketContextBundle = body.marketContextBundle && typeof body.marketContextBundle === "object"
        ? body.marketContextBundle
        : null;

      if (!brandName) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "brandName is required" }));
        return;
      }

      const report = await runMarketingGuide({
        locale,
        brandName,
        detection,
        analystReport,
        marketContextBundle,
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(report));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Marketing guide failed",
      }));
    }
  };
}
