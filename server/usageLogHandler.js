import { getAuthedUser } from "./supabaseServer.js";
import { logApiUsageEvents } from "./management/logApiUsage.js";

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
 * Vite / Node middleware for POST /api/usage/log
 */
export function createUsageLogMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/usage/log") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
      const { user } = await getAuthedUser(fakeReq);
      if (!user) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const routeLabel = typeof body.routeLabel === "string" ? body.routeLabel : "App";
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : "client";
      const creditsDebited = Number(body.creditsDebited) || 0;
      const tokensDebited = Number(body.tokensDebited) || 0;
      const meta = body.meta && typeof body.meta === "object" ? body.meta : {};

      void logApiUsageEvents([
        {
          userId: user.id,
          userEmail: user.email,
          provider: "groq",
          endpoint,
          routeLabel,
          creditsDebited,
          tokensDebited,
          meta: { ...meta, source: "client-debit" },
        },
        {
          userId: user.id,
          userEmail: user.email,
          provider: "serper",
          endpoint,
          routeLabel,
          meta: { ...meta, source: "client-debit" },
        },
      ]);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Usage log failed",
      }));
    }
  };
}
