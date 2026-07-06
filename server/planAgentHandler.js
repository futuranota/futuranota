import { runDeepResearcher, runSalesAgent } from "./agents/planAgent.js";
import { isBetaAgentEmail } from "./agentAccess.js";
import { getAuthedUser } from "./supabaseServer.js";

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
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {Record<string, unknown>} body
 */
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
async function requireBetaAgentAccess(req, res) {
  const { user } = await getAuthedUser(req);
  if (!user?.email) {
    sendJson(res, 401, { error: "Unauthorized", code: "auth_required" });
    return null;
  }
  if (!isBetaAgentEmail(user.email)) {
    sendJson(res, 403, { error: "Agent not available for this account", code: "agent_forbidden" });
    return null;
  }
  return user;
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {'sales-agent' | 'deep-researcher'} agentSlug
 */
async function handlePlanAgentRequest(req, res, agentSlug) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const user = await requireBetaAgentAccess(req, res);
  if (!user) return;

  const body = await readJsonBody(req).catch(() => ({}));
  const locale = body.locale === "es" ? "es" : "en";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const brandContext = body.brandContext && typeof body.brandContext === "object"
    ? body.brandContext
    : {};
  const knowledgeContext = typeof body.knowledgeContext === "string"
    ? body.knowledgeContext.trim()
    : "";
  const wiredInputs = Array.isArray(body.wiredInputs) ? body.wiredInputs : [];

  if (!instruction) {
    sendJson(res, 400, { error: "instruction is required" });
    return;
  }

  const run = agentSlug === "sales-agent" ? runSalesAgent : runDeepResearcher;
  const label = agentSlug === "sales-agent" ? "sales-agent" : "deep-researcher";

  try {
    const plan = await run({
      locale,
      instruction,
      brandContext,
      knowledgeContext,
      wiredInputs,
    });
    sendJson(res, 200, plan);
  } catch (err) {
    console.error(`[${label}]`, err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : `${label} failed`,
    });
  }
}

/**
 * Vite / Node middleware for POST /api/agents/sales-agent and /api/agents/deep-researcher.
 */
export function createPlanAgentMiddleware() {
  return async (req, res, next) => {
    const path = req.url?.split("?")[0];

    if (path === "/api/agents/sales-agent") {
      await handlePlanAgentRequest(req, res, "sales-agent");
      return;
    }

    if (path === "/api/agents/deep-researcher") {
      await handlePlanAgentRequest(req, res, "deep-researcher");
      return;
    }

    next();
  };
}
