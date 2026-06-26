import { runAllIntegrationProbes } from "./integrationsProbe.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body, null, 2));
}

/**
 * GET /api/health/integrations?live=0 — config only (no paid calls)
 * GET /api/health/integrations — live probe all providers
 */
export async function handleIntegrationsHealth(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.end();
    return true;
  }

  if (req.url?.split("?")[0] !== "/api/health/integrations") return false;
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const live = url.searchParams.get("live") !== "0";
    const report = await runAllIntegrationProbes({ live });
    sendJson(res, report.ok ? 200 : 503, report);
    return true;
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : "Health check failed",
    });
    return true;
  }
}

export function createIntegrationsHealthMiddleware() {
  return async (req, res, next) => {
    const handled = await handleIntegrationsHealth(req, res);
    if (!handled) next();
  };
}
