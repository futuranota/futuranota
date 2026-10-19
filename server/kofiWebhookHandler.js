import { readRawBody } from "./billing/readBody.js";
import { handleKofiWebhook } from "./kofi/kofiWebhook.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

/**
 * Vite dev middleware for POST /api/kofi/webhook.
 */
export function createKofiWebhookMiddleware() {
  return async (req, res, next) => {
    const path = req.url?.split("?")[0] || "";
    if (path !== "/api/kofi/webhook") {
      next();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const raw = (await readRawBody(req)).toString("utf8");
      const result = await handleKofiWebhook({ raw });
      sendJson(res, result.status, result.body);
    } catch {
      sendJson(res, 500, { error: "Webhook failed" });
    }
  };
}
