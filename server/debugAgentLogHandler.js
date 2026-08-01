import fs from "node:fs";
import path from "node:path";

const LOG_PATH = path.resolve(process.cwd(), ".cursor/debug-156d6a.log");

/**
 * Same-origin debug ingest for browser instrumentation (avoids CORS to :7584).
 * POST /__debug_agent_log  body: JSON
 */
export function createDebugAgentLogMiddleware() {
  return function debugAgentLogMiddleware(req, res, next) {
    if (req.url?.split("?")[0] !== "/__debug_agent_log" || req.method !== "POST") {
      next();
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const line = JSON.stringify({
          ...payload,
          sessionId: payload.sessionId || "156d6a",
          timestamp: payload.timestamp || Date.now(),
        });
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        fs.appendFileSync(LOG_PATH, `${line}\n`, "utf8");
        res.statusCode = 204;
        res.end();
      } catch (err) {
        res.statusCode = 400;
        res.end(String(err?.message || "bad log"));
      }
    });
  };
}
