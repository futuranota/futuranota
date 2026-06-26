import { getAuthedUser } from "./supabaseServer.js";
import { processWebProxyRequest } from "./webProxy.js";

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(html);
}

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify({ error: message }));
}

/**
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function handleWebProxyRequest(reqLike) {
  if (reqLike.method === "OPTIONS") {
    return {
      handled: true,
      respond: (res) => {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.end();
      },
    };
  }

  const path = reqLike.url?.split("?")[0];
  if (path !== "/api/proxy") return { handled: false };

  if (reqLike.method !== "GET") {
    return {
      handled: true,
      respond: (res) => sendError(res, 405, "Method not allowed"),
    };
  }

  const { user } = await getAuthedUser({ headers: reqLike.headers || {} });
  if (!user) {
    return {
      handled: true,
      respond: (res) => sendError(res, 401, "Authentication required"),
    };
  }

  try {
    const urlObj = new URL(reqLike.url || "", "http://localhost");
    const result = await processWebProxyRequest({
      url: urlObj.searchParams.get("url") || "",
    });
    return {
      handled: true,
      respond: (res) => sendHtml(res, result.status, result.html),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy failed";
    const status = message.includes("required") || message.includes("Invalid") || message.includes("allowed")
      ? 400
      : 502;
    return {
      handled: true,
      respond: (res) => sendError(res, status, message),
    };
  }
}

export async function handleWebProxy(req, res) {
  const result = await handleWebProxyRequest({
    method: req.method,
    url: req.url,
    headers: req.headers,
  });
  if (!result.handled) return false;
  result.respond(res);
  return true;
}

export function createWebProxyMiddleware() {
  return async (req, res, next) => {
    const handled = await handleWebProxy(req, res);
    if (!handled) next();
  };
}
