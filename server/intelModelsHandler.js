import { getActiveIntelModelsForPlan } from "./intelModels.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

export async function handleIntelModels(req, res) {
  if (req.url?.split("?")[0] !== "/api/intel/models") return false;

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return true;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  const url = new URL(req.url, "http://localhost");
  const plan = url.searchParams.get("plan") === "pro" ? "pro" : "free";
  const models = getActiveIntelModelsForPlan(plan);

  sendJson(res, 200, { models });
  return true;
}

export function createIntelModelsMiddleware() {
  return async (req, res, next) => {
    const handled = await handleIntelModels(req, res);
    if (!handled) next();
  };
}
