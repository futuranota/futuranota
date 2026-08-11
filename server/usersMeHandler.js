import {
  createServiceSupabase,
  getAuthedUser,
  loadUserProfile,
} from "./supabaseServer.js";
import {
  getCreditsCap,
  getCreditsUsed,
  getTokensCap,
} from "../src/lib/planConfig.js";

/**
 * GET /api/users/me — authenticated user profile + usage summary.
 * @param {{ headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function processUsersMeRequest(reqLike) {
  const { user, supabase } = await getAuthedUser({ headers: reqLike.headers || {} });
  if (!user || !supabase) {
    return { status: 401, body: { error: "Authentication required" } };
  }

  const row = await loadUserProfile(supabase, user.id);
  const plan = row?.plan === "pro" ? "pro" : "free";
  const profile = {
    plan,
    searchCount: row?.search_count ?? 0,
    tokensBalance: row?.tokens_balance ?? getTokensCap(plan),
  };

  let totalCalls = 0;
  let apiCostUsd = 0;
  let lastCallAt = null;

  const service = createServiceSupabase();
  if (service) {
    const chunks = [];
    const byId = await service
      .from("api_usage_events")
      .select("id, estimated_cost_usd, billed, created_at")
      .eq("user_id", user.id);
    if (!byId.error) chunks.push(...(byId.data || []));
    if (user.email) {
      const byEmail = await service
        .from("api_usage_events")
        .select("id, estimated_cost_usd, billed, created_at")
        .is("user_id", null)
        .ilike("user_email", user.email);
      if (!byEmail.error) chunks.push(...(byEmail.data || []));
    }
    const seen = new Set();
    for (const ev of chunks) {
      if (ev.id && seen.has(ev.id)) continue;
      if (ev.id) seen.add(ev.id);
      totalCalls += 1;
      if (ev.billed !== false) apiCostUsd += Number(ev.estimated_cost_usd) || 0;
      if (!lastCallAt || ev.created_at > lastCallAt) lastCallAt = ev.created_at;
    }
    apiCostUsd = Math.round(apiCostUsd * 1e6) / 1e6;
  }

  return {
    status: 200,
    body: {
      userId: user.id,
      email: user.email || null,
      plan,
      creditsUsed: getCreditsUsed(profile),
      creditsCap: getCreditsCap(plan),
      tokensBalance: profile.tokensBalance,
      tokensCap: getTokensCap(plan),
      totalCalls,
      apiCostUsd,
      lastCallAt,
    },
  };
}

export function createUsersMeMiddleware() {
  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0].replace(/\/+$/, "") || "/";
    if (path !== "/api/users/me") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const result = await processUsersMeRequest({ headers: req.headers });
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "users/me failed",
      }));
    }
  };
}
