import { runAllIntegrationProbes } from "./integrationsProbe.js";
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

function getAdminEmail() {
  return (
    process.env.VITE_ADMIN_EMAIL
    || process.env.ADMIN_EMAIL
    || ""
  ).trim().toLowerCase();
}

/**
 * @param {{ headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function assertAdminUser(reqLike) {
  const { user, supabase } = await getAuthedUser({ headers: reqLike.headers || {} });
  if (!user || !supabase) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  const adminEmail = getAdminEmail();
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
    return { ok: false, status: 403, error: "Admin access required" };
  }
  return { ok: true, user, supabase };
}

function rowToProfileView(row) {
  if (!row) return null;
  const plan = row.plan === "pro" ? "pro" : "free";
  const cap = getTokensCap(plan);
  let tokensBalance = row.tokens_balance ?? cap;
  const profile = {
    plan,
    searchCount: row.search_count ?? 0,
    tokensBalance,
  };
  return {
    plan,
    creditsUsed: getCreditsUsed(profile),
    creditsCap: getCreditsCap(plan),
    tokensBalance,
    tokensCap: cap,
    searchCount: profile.searchCount,
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {{ includeSeed?: boolean }} [opts]
 */
async function loadUsageStats(service, opts = {}) {
  const includeSeed = opts.includeSeed !== false;
  let query = service
    .from("api_usage_events")
    .select("provider, endpoint, status, estimated_cost_usd, created_at, meta");

  const { data: events, error } = await query;
  if (error) throw new Error(error.message);

  const filtered = (events || []).filter((e) => {
    if (includeSeed) return true;
    return e.meta?.source !== "seed-futuranota";
  });

  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  let today = 0;
  let month = 0;
  let allTime = filtered.length;
  let estimatedCostTotal = 0;
  const byProvider = {};
  const byEndpoint = {};

  for (const ev of filtered) {
    const created = new Date(ev.created_at);
    if (created >= dayStart) today += 1;
    if (created >= monthStart) month += 1;
    if (ev.estimated_cost_usd != null) {
      estimatedCostTotal += Number(ev.estimated_cost_usd);
    }
    const provider = ev.provider || "unknown";
    const endpoint = ev.endpoint || "unknown";
    byProvider[provider] = (byProvider[provider] || 0) + 1;
    byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + 1;
  }

  const toPie = (map) => Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totals: { today, month, allTime, estimatedCostUsd: estimatedCostTotal },
    byProvider: toPie(byProvider),
    byEndpoint: toPie(byEndpoint),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {{ includeSeed?: boolean, limit?: number }} [opts]
 */
async function loadRecentEvents(service, opts = {}) {
  const limit = opts.limit ?? 50;
  const includeSeed = opts.includeSeed !== false;

  const { data, error } = await service
    .from("api_usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || [])
    .filter((e) => includeSeed || e.meta?.source !== "seed-futuranota")
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      provider: row.provider,
      endpoint: row.endpoint,
      routeLabel: row.route_label,
      creditsDebited: row.credits_debited,
      tokensDebited: row.tokens_debited,
      estimatedCostUsd: row.estimated_cost_usd,
      status: row.status,
      errorCode: row.error_code,
      meta: row.meta,
      createdAt: row.created_at,
      queryPreview: typeof row.meta?.query === "string"
        ? row.meta.query.slice(0, 80)
        : typeof row.meta?.brandName === "string"
          ? row.meta.brandName.slice(0, 80)
          : "",
    }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {{ id: string, email?: string|null }} adminUser
 */
async function loadUsersOverview(service, userSupabase, adminUser) {
  const users = [];

  const profileRow = await loadUserProfile(userSupabase, adminUser.id);
  const view = rowToProfileView(profileRow);

  const { count: callCount } = await service
    .from("api_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", adminUser.id);

  const { data: lastEvent } = await service
    .from("api_usage_events")
    .select("created_at")
    .eq("user_id", adminUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  users.push({
    userId: adminUser.id,
    email: adminUser.email || adminUser.id,
    plan: view?.plan || "free",
    creditsUsed: view?.creditsUsed ?? 0,
    creditsCap: view?.creditsCap ?? getCreditsCap("free"),
    creditsLabel: `${view?.creditsUsed ?? 0}/${view?.creditsCap ?? getCreditsCap("free")}`,
    tokensBalance: view?.tokensBalance ?? null,
    tokensCap: view?.tokensCap ?? null,
    totalCalls: callCount ?? 0,
    lastCallAt: lastEvent?.created_at ?? null,
    isAdmin: true,
  });

  return users;
}

/**
 * @param {{ headers?: Record<string, string|string[]|undefined>, url?: string }} reqLike
 */
export async function processManagementOverviewRequest(reqLike) {
  const auth = await assertAdminUser(reqLike);
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const url = new URL(reqLike.url || "/api/admin/management/overview", "http://localhost");
  const includeSeed = url.searchParams.get("includeSeed") !== "0";

  const service = createServiceSupabase();
  const serviceConfigured = Boolean(service);

  let integrations = [];
  let stats = { totals: { today: 0, month: 0, allTime: 0, estimatedCostUsd: 0 }, byProvider: [], byEndpoint: [] };
  let recentEvents = [];
  let users = [];
  let dbWarning = null;

  if (!service) {
    dbWarning = "FUTURA_SUPABASE_SERVICE_ROLE_KEY not set — users/events unavailable.";
  } else {
    try {
      const { data: integrationRows, error: intErr } = await service
        .from("api_integrations")
        .select("*")
        .order("label");

      if (intErr) {
        if (intErr.message.includes("api_integrations")) {
          dbWarning = "Run supabase_management.sql in Supabase SQL Editor.";
        } else {
          throw intErr;
        }
      } else {
        integrations = integrationRows || [];
      }

      if (!intErr) {
        stats = await loadUsageStats(service, { includeSeed });
        recentEvents = await loadRecentEvents(service, { includeSeed });
        users = await loadUsersOverview(service, auth.supabase, auth.user);
      }
    } catch (err) {
      dbWarning = err instanceof Error ? err.message : "Management DB error";
    }
  }

  const probe = await runAllIntegrationProbes({ live: false });

  const integrationCards = (integrations.length ? integrations : getDefaultIntegrations()).map((row) => {
    const probeKey = row.provider === "serper" ? "serper" : row.id;
    const step = probe.steps?.[probeKey] || probe.steps?.[row.id];
    return {
      id: row.id,
      label: row.label,
      envVar: row.env_var,
      provider: row.provider,
      estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
      enabled: row.enabled !== false,
      notes: row.notes || "",
      configured: step?.configured ?? false,
      ok: step?.ok ?? false,
      statusMessage: step?.message || (row.env_var ? `${row.env_var} unknown` : ""),
      latencyMs: step?.latencyMs,
    };
  });

  return {
    status: 200,
    body: {
      serviceConfigured,
      dbWarning,
      stats,
      integrations: integrationCards,
      users,
      recentEvents,
      probeOk: probe.ok,
    },
  };
}

function getDefaultIntegrations() {
  return [
    { id: "groq", label: "Groq LLM", env_var: "GROQ_API_KEY", provider: "groq", estimated_cost_usd: 0.002, enabled: true, notes: "" },
    { id: "gemini", label: "Google Gemini", env_var: "GEMINI_API_KEY", provider: "gemini", estimated_cost_usd: 0.001, enabled: true, notes: "" },
    { id: "serper", label: "Serper Search", env_var: "SERPAPI_KEY", provider: "serper", estimated_cost_usd: 0.001, enabled: true, notes: "" },
    { id: "dataforseo", label: "DataForSEO", env_var: "DATAFORSEO_LOGIN", provider: "dataforseo", estimated_cost_usd: 0.003, enabled: true, notes: "" },
    { id: "apify", label: "Apify", env_var: "APIFY_API_TOKEN", provider: "apify", estimated_cost_usd: 0.005, enabled: true, notes: "" },
    { id: "openweather", label: "OpenWeather", env_var: "OPENWEATHER_API_KEY", provider: "openweather", estimated_cost_usd: 0.0001, enabled: true, notes: "" },
    { id: "supabase", label: "Supabase", env_var: "SUPABASE_PROJECT_URL", provider: "supabase", estimated_cost_usd: 0, enabled: true, notes: "" },
  ];
}

/**
 * @param {{ headers?: Record<string, string|string[]|undefined>, url?: string, body?: unknown }} reqLike
 */
export async function processManagementIntegrationPatch(reqLike) {
  const auth = await assertAdminUser(reqLike);
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const path = (reqLike.url || "").split("?")[0];
  const match = path.match(/\/api\/admin\/management\/integrations\/([^/]+)$/);
  const integrationId = match?.[1];
  if (!integrationId) {
    return { status: 400, body: { error: "Integration id required" } };
  }

  const service = createServiceSupabase();
  if (!service) {
    return { status: 503, body: { error: "Service role not configured" } };
  }

  const body = reqLike.body && typeof reqLike.body === "object" ? reqLike.body : {};
  const patch = { updated_at: new Date().toISOString() };

  if (typeof body.label === "string") patch.label = body.label.trim();
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.estimatedCostUsd != null && !Number.isNaN(Number(body.estimatedCostUsd))) {
    patch.estimated_cost_usd = Number(body.estimatedCostUsd);
  }

  const { data, error } = await service
    .from("api_integrations")
    .update(patch)
    .eq("id", integrationId)
    .select("*")
    .single();

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  return { status: 200, body: { integration: data } };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

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

export async function handleManagement(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  const path = req.url?.split("?")[0] || "";

  if (path === "/api/admin/management/overview" && req.method === "GET") {
    try {
      const result = await processManagementOverviewRequest({
        headers: req.headers,
        url: req.url,
      });
      sendJson(res, result.status, result.body);
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Management overview failed" });
      return true;
    }
  }

  if (path.startsWith("/api/admin/management/integrations/") && req.method === "PATCH") {
    try {
      const body = await readJsonBody(req);
      const result = await processManagementIntegrationPatch({
        headers: req.headers,
        url: req.url,
        body,
      });
      sendJson(res, result.status, result.body);
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Integration update failed" });
      return true;
    }
  }

  if (path === "/api/admin/management/integration" && req.method === "PATCH") {
    try {
      const url = new URL(req.url || "", "http://localhost");
      const id = url.searchParams.get("id");
      const body = await readJsonBody(req);
      const result = await processManagementIntegrationPatch({
        headers: req.headers,
        url: id ? `/api/admin/management/integrations/${id}` : req.url,
        body,
      });
      sendJson(res, result.status, result.body);
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Integration update failed" });
      return true;
    }
  }

  return false;
}

export function createManagementMiddleware() {
  return async (req, res, next) => {
    const handled = await handleManagement(req, res);
    if (!handled) next();
  };
}
