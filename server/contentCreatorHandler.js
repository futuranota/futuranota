import { runContentCreator } from "./agents/contentCreator.js";

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
 * Vite / Node middleware for POST /api/agents/content-creator
 */
export function createContentCreatorMiddleware() {
  return async (req, res, next) => {
    const path = req.url?.split("?")[0];

    if (path !== "/api/agents/content-creator") {
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
      const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
      const brandContext = body.brandContext && typeof body.brandContext === "object"
        ? body.brandContext
        : {};
      const knowledgeContext = typeof body.knowledgeContext === "string"
        ? body.knowledgeContext.trim()
        : "";

      if (!instruction) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "instruction is required" }));
        return;
      }

      const plan = await runContentCreator({
        locale,
        instruction,
        brandContext,
        knowledgeContext,
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(plan));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Content creator failed",
      }));
    }
  };
}
