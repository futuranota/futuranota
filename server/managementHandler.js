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
 */
async function loadAllAuthEmails(service) {
  /** @type {Map<string, string|null>} */
  const map = new Map();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("loadAllAuthEmails:", error.message);
      return map;
    }
    for (const user of data.users) {
      map.set(user.id, user.email ?? null);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return map;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 */
async function loadUsageByUserId(service) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {Map<string, string>} */
  const lastCall = new Map();

  const { data, error } = await service
    .from("api_usage_events")
    .select("user_id, created_at");

  if (error) {
    if (error.message.includes("api_usage_events")) {
      return { counts, lastCall };
    }
    throw error;
  }

  for (const row of data || []) {
    if (!row.user_id) continue;
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
    const prev = lastCall.get(row.user_id);
    if (!prev || row.created_at > prev) {
      lastCall.set(row.user_id, row.created_at);
    }
  }

  return { counts, lastCall };
}

function buildUserRow(row, emailById, usage, adminEmail) {
  const userId = row.user_id;
  const email = row.email || emailById.get(userId) || userId;
  const view = rowToProfileView(row);
  const creditsUsed = view?.creditsUsed ?? 0;
  const creditsCap = view?.creditsCap ?? getCreditsCap("free");
  const isAdmin = Boolean(adminEmail && email?.toLowerCase() === adminEmail);

  return {
    userId,
    email,
    plan: view?.plan || "free",
    creditsUsed,
    creditsCap,
    creditsLabel: `${creditsUsed}/${creditsCap}`,
    tokensBalance: view?.tokensBalance ?? null,
    tokensCap: view?.tokensCap ?? null,
    totalCalls: usage.counts.get(userId) ?? 0,
    lastCallAt: usage.lastCall.get(userId) ?? null,
    isAdmin,
    profileCreatedAt: row.created_at ?? null,
  };
}

/**
 * All registered users from profiles + auth emails, with plan and credits.
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {{ id: string, email?: string|null }} adminUser
 */
async function loadUsersOverview(service, adminUser) {
  const adminEmail = getAdminEmail();

  const { data: profileRows, error: profilesErr } = await service
    .from("profiles")
    .select("user_id, plan, search_count, tokens_balance, tokens_period_start, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (profilesErr) throw new Error(profilesErr.message);

  const emailById = await loadAllAuthEmails(service);
  const usage = await loadUsageByUserId(service);

  const seen = new Set();
  const users = (profileRows || []).map((row) => {
    seen.add(row.user_id);
    return buildUserRow(row, emailById, usage, adminEmail);
  });

  for (const [userId, email] of emailById) {
    if (seen.has(userId)) continue;
    const creditsCap = getCreditsCap("free");
    users.push({
      userId,
      email: email || userId,
      plan: "free",
      creditsUsed: 0,
      creditsCap,
      creditsLabel: `0/${creditsCap}`,
      tokensBalance: getTokensCap("free"),
      tokensCap: getTokensCap("free"),
      totalCalls: usage.counts.get(userId) ?? 0,
      lastCallAt: usage.lastCall.get(userId) ?? null,
      isAdmin: Boolean(adminEmail && email?.toLowerCase() === adminEmail),
      profileCreatedAt: null,
    });
  }

  users.sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return String(b.profileCreatedAt || "").localeCompare(String(a.profileCreatedAt || ""));
  });

  if (users.length === 0 && adminUser?.id) {
    const row = profileRows?.find((p) => p.user_id === adminUser.id);
    if (row) {
      users.push(buildUserRow(row, emailById, usage, adminEmail));
    } else {
      users.push({
        userId: adminUser.id,
        email: adminUser.email || adminUser.id,
        plan: "free",
        creditsUsed: 0,
        creditsCap: getCreditsCap("free"),
        creditsLabel: `0/${getCreditsCap("free")}`,
        tokensBalance: null,
        tokensCap: getTokensCap("free"),
        totalCalls: usage.counts.get(adminUser.id) ?? 0,
        lastCallAt: usage.lastCall.get(adminUser.id) ?? null,
        isAdmin: true,
        profileCreatedAt: null,
      });
    }
  }

  return users;
}

/**
 * List all profiles via Supabase RPC (admin JWT + admin_allowlist). No service role.
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {{ id: string, email?: string|null }} adminUser
 */
async function loadUsersOverviewViaRpc(userSupabase, adminUser) {
  const adminEmail = getAdminEmail();
  const { data, error } = await userSupabase.rpc("admin_list_users_overview");
  if (error) throw error;

  const usage = { counts: new Map(), lastCall: new Map() };
  const emailById = new Map();

  const users = (data || []).map((row) => {
    if (row.user_id && row.email) emailById.set(row.user_id, row.email);
    return buildUserRow(row, emailById, usage, adminEmail);
  });

  if (users.length === 0 && adminUser?.id) {
    return loadUsersOverviewFromSession(userSupabase, adminUser);
  }

  return users;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {{ id: string, email?: string|null }} adminUser
 */
async function loadUsersOverviewFromSession(userSupabase, adminUser) {
  const adminEmail = getAdminEmail();
  const row = await loadUserProfile(userSupabase, adminUser.id);
  const usage = { counts: new Map(), lastCall: new Map() };
  const emailById = new Map([[adminUser.id, adminUser.email ?? null]]);

  if (!row) {
    const creditsCap = getCreditsCap("free");
    return [{
      userId: adminUser.id,
      email: adminUser.email || adminUser.id,
      plan: "free",
      creditsUsed: 0,
      creditsCap,
      creditsLabel: `0/${creditsCap}`,
      tokensBalance: null,
      tokensCap: getTokensCap("free"),
      totalCalls: 0,
      lastCallAt: null,
      isAdmin: true,
      profileCreatedAt: null,
    }];
  }

  return [buildUserRow({ ...row, user_id: adminUser.id }, emailById, usage, adminEmail)];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient|null} service
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {{ id: string, email?: string|null }} adminUser
 */
async function resolveUsersOverview(service, userSupabase, adminUser) {
  if (service) {
    return { users: await loadUsersOverview(service, adminUser), usersSource: "service_role" };
  }

  try {
    const users = await loadUsersOverviewViaRpc(userSupabase, adminUser);
    return { users, usersSource: "rpc" };
  } catch (rpcErr) {
    const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
    const users = await loadUsersOverviewFromSession(userSupabase, adminUser);
    return {
      users,
      usersSource: "session",
      usersWarning: msg.includes("admin_list_users_overview") || msg.includes("allowlist")
        ? "Para ver todas las cuentas: añade FUTURA_SUPABASE_SERVICE_ROLE_KEY en .env.local "
          + "O ejecuta supabase_management.sql e INSERT INTO admin_allowlist (email) VALUES ('tu-email');"
        : msg,
    };
  }
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
  let usersSource = "none";
  let usersWarning = null;
  let dbWarning = null;

  try {
    const resolved = await resolveUsersOverview(service, auth.supabase, auth.user);
    users = resolved.users;
    usersSource = resolved.usersSource;
    usersWarning = resolved.usersWarning ?? null;
  } catch (err) {
    usersWarning = err instanceof Error ? err.message : "Failed to load users";
  }

  if (!service) {
    dbWarning = "FUTURA_SUPABASE_SERVICE_ROLE_KEY no configurada — call logs limitados. "
      + "Supabase → Settings → API → service_role → añade FUTURA_SUPABASE_SERVICE_ROLE_KEY en .env.local";
  }

  if (service) {
    try {
      const { data: integrationRows, error: intErr } = await service
        .from("api_integrations")
        .select("*")
        .order("label");

      if (intErr) {
        if (intErr.message.includes("api_integrations")) {
          if (!dbWarning) {
            dbWarning = "Run supabase_management.sql for API catalog and call logs.";
          }
        } else {
          throw intErr;
        }
      } else {
        integrations = integrationRows || [];
      }

      try {
        stats = await loadUsageStats(service, { includeSeed });
        recentEvents = await loadRecentEvents(service, { includeSeed });
      } catch (statsErr) {
        if (!dbWarning && statsErr instanceof Error && statsErr.message.includes("api_usage_events")) {
          dbWarning = "Run supabase_management.sql for call history.";
        } else if (!dbWarning) {
          dbWarning = statsErr instanceof Error ? statsErr.message : "Failed to load usage stats";
        }
      }
    } catch (err) {
      if (!dbWarning) {
        dbWarning = err instanceof Error ? err.message : "Management DB error";
      }
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
      usersSource,
      usersWarning,
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
