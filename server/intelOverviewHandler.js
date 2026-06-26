import { getAuthedUser, loadUserProfile } from "./supabaseServer.js";
import { INTEL_OVERVIEW_TOKEN_COST, runIntelOverviewPipeline } from "./intelOverviewPipeline.js";

const FREE_MAX_SEARCHES = 10;

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

  if (!query) {
    return { status: 400, body: { error: "query is required" } };
  }

  const { user, supabase } = await getAuthedUser({ headers: reqLike.headers || {} });
  if (!user || !supabase) {
    return { status: 401, body: { error: "Authentication required" } };
  }

  const profile = await loadUserProfile(supabase, user.id);
  if (!profile) {
    return { status: 404, body: { error: "Profile not found" } };
  }

  const plan = profile.plan === "pro" ? "pro" : "free";
  if (plan === "free") {
    const count = profile.search_count ?? 0;
    if (count >= FREE_MAX_SEARCHES) {
      return { status: 403, body: { error: "Free search limit reached", code: "search" } };
    }
  } else {
    const balance = profile.tokens_balance ?? 0;
    if (balance < INTEL_OVERVIEW_TOKEN_COST) {
      return { status: 403, body: { error: "Insufficient tokens", code: "tokens" } };
    }
  }

  const result = await runIntelOverviewPipeline(query, contextNodes);

  const patch = { updated_at: new Date().toISOString() };
  if (plan === "free") {
    patch.search_count = (profile.search_count ?? 0) + 1;
  } else {
    patch.tokens_balance = (profile.tokens_balance ?? 0) - INTEL_OVERVIEW_TOKEN_COST;
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", user.id)
    .select("tokens_balance, search_count")
    .single();

  if (error) throw new Error(error.message);

  return {
    status: 200,
    body: {
      ...result,
      tokensDebited: plan === "pro" ? INTEL_OVERVIEW_TOKEN_COST : 0,
      tokensBalance: updated.tokens_balance,
      searchCount: updated.search_count,
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
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Intel search failed" });
    return true;
  }
}

export function createIntelOverviewMiddleware() {
  return async (req, res, next) => {
    const handled = await handleIntelOverview(req, res);
    if (!handled) next();
  };
}
