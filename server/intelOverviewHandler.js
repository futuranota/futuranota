import { getAuthedUser, loadUserProfile } from "./supabaseServer.js";
import { runIntelOverviewPipeline } from "./intelOverviewPipeline.js";
import {
  CREDIT_TOKEN_UNIT,
  DEFAULT_INTEL_MODEL_ID,
  resolveIntelModelForPlan,
} from "./intelModels.js";
import { getTokensCap } from "../src/lib/planConfig.js";
import { logApiUsageEvents } from "./management/logApiUsage.js";

const FREE_MAX_CREDITS = 10;
const PRO_TOKENS_CAP = getTokensCap("pro");

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

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

/**
 * @param {{ method?: string, headers?: Record<string, string|string[]|undefined>, body?: unknown }} reqLike
 */
export async function processIntelOverviewRequest(reqLike) {
  const body = reqLike.body && typeof reqLike.body === "object" ? reqLike.body : {};
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const contextNodes = Array.isArray(body.contextNodes) ? body.contextNodes : [];
  const modelId = typeof body.modelId === "string" && body.modelId.trim()
    ? body.modelId.trim()
    : DEFAULT_INTEL_MODEL_ID;
  const locale = body.locale === "en" ? "en" : "es";

  if (!query) {
    return { status: 400, body: { error: "query is required" } };
  }

  const { user, supabase } = await getAuthedUser({ headers: reqLike.headers || {} });
  if (!user || !supabase) {
    const hasAuthHeader = Boolean(
      reqLike.headers?.authorization
      || reqLike.headers?.Authorization,
    );
    return {
      status: 401,
      body: {
        error: hasAuthHeader
          ? "Invalid or expired session — sign in again"
          : "Authentication required",
        code: "auth",
      },
    };
  }

  const profile = await loadUserProfile(supabase, user.id);
  if (!profile) {
    return { status: 404, body: { error: "Profile not found" } };
  }

  const adminEmail = (
    process.env.VITE_ADMIN_EMAIL
    || process.env.ADMIN_EMAIL
    || ""
  ).trim().toLowerCase();
  const isAdminUser = Boolean(
    adminEmail && user.email?.toLowerCase() === adminEmail,
  );
  const adminAutoRefill = (
    process.env.VITE_ADMIN_AUTO_REFILL
    || process.env.ADMIN_AUTO_REFILL
    || ""
  ).trim() === "true";

  const plan = (isAdminUser && adminAutoRefill) || profile.plan === "pro" ? "pro" : "free";
  const model = resolveIntelModelForPlan(modelId, plan);

  if (plan === "free") {
    const used = profile.search_count ?? 0;
    if (used + model.creditCost > FREE_MAX_CREDITS) {
      return { status: 403, body: { error: "Free search limit reached", code: "search" } };
    }
  } else {
    const balance = profile.tokens_balance ?? PRO_TOKENS_CAP;
    if (balance < model.tokenCost) {
      return { status: 403, body: { error: "Insufficient tokens", code: "tokens" } };
    }
  }

  const result = await runIntelOverviewPipeline(query, contextNodes, { modelId: model.id, locale });

  const patch = { updated_at: new Date().toISOString() };
  if (plan === "free") {
    patch.search_count = (profile.search_count ?? 0) + model.creditCost;
  } else {
    const balance = profile.tokens_balance ?? PRO_TOKENS_CAP;
    patch.tokens_balance = balance - model.tokenCost;
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", user.id)
    .select("tokens_balance, search_count")
    .single();

  if (error) throw new Error(error.message);

  void logApiUsageEvents([
    {
      userId: user.id,
      userEmail: user.email,
      provider: "serper",
      endpoint: "intel/overview",
      routeLabel: "Intel Search",
      billed: true,
      meta: { query, modelId: model.id, source: result.searchSource || "live" },
    },
    {
      userId: user.id,
      userEmail: user.email,
      provider: "groq",
      endpoint: "intel/overview",
      routeLabel: "Intel Search",
      creditsDebited: model.creditCost,
      tokensDebited: plan === "pro" ? model.tokenCost : 0,
      inputTokens: result.llmUsage?.inputTokens,
      outputTokens: result.llmUsage?.outputTokens,
      model: result.llmModel || model.apiModel,
      billed: true,
      meta: { query, modelId: model.id, source: "live" },
    },
  ]);

  return {
    status: 200,
    body: {
      ...result,
      plan,
      tokensDebited: plan === "pro" ? model.tokenCost : 0,
      creditsDebited: model.creditCost,
      tokensBalance: Number(updated.tokens_balance),
      searchCount: Number(updated.search_count),
      modelId: model.id,
      modelLabel: model.label,
      creditUnit: CREDIT_TOKEN_UNIT,
    },
  };
}

export async function handleIntelOverview(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  if (req.url?.split("?")[0] !== "/api/intel/overview") return false;
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  try {
    const body = await readJsonBody(req);
    const result = await processIntelOverviewRequest({ headers: req.headers, body });
    sendJson(res, result.status, result.body);
    return true;
  } catch (err) {
    const status = err?.code === "rate_limit" ? 429 : 500;
    sendJson(res, status, {
      error: err instanceof Error ? err.message : "Intel search failed",
      code: err?.code || undefined,
    });
    return true;
  }
}

export function createIntelOverviewMiddleware() {
  return async (req, res, next) => {
    const handled = await handleIntelOverview(req, res);
    if (!handled) next();
  };
}
