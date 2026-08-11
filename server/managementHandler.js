import { runAllIntegrationProbes } from "./integrationsProbe.js";
import {
  createServiceSupabase,
  getAuthedUser,
  loadUserProfile,
} from "./supabaseServer.js";
import {
  formatTokenCount,
  getCalendarSearchesCap,
  getCalendarSearchesUsed,
  getCreditsCap,
  getCreditsUsed,
  getPlanLimits,
  getTokensCap,
  getWeatherActionCap,
} from "../src/lib/planConfig.js";
import {
  DEFAULT_API_QUOTA_METERS,
  estimateOverageUsd,
  formatUtcYmd,
  mapQuotaMeterRow,
  parseUtcYmd,
  resolveMeterWindow,
  startOfUtcDay,
  addUtcDays,
} from "./management/quotaCatalog.js";

function getAdminEmail() {
  return (
    process.env.VITE_ADMIN_EMAIL
    || process.env.ADMIN_EMAIL
    || ""
  ).trim().toLowerCase();
}

/** Admin + comma-separated ADMIN_TEST_EMAILS — excluded from paid MRR. */
function getTestEmailSet() {
  /** @type {Set<string>} */
  const set = new Set();
  const admin = getAdminEmail();
  if (admin) set.add(admin);
  const raw = (
    process.env.ADMIN_TEST_EMAILS
    || process.env.VITE_ADMIN_TEST_EMAILS
    || ""
  ).trim();
  for (const part of raw.split(/[,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

function isTestAccountEmail(email, testEmails = getTestEmailSet()) {
  if (!email) return false;
  return testEmails.has(String(email).toLowerCase());
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
    .select("provider, endpoint, status, estimated_cost_usd, created_at, meta, credits_debited, tokens_debited, billed");

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
  let estimatedCostUsdMonth = 0;
  let estimatedCostUsdToday = 0;
  let successCount = 0;
  let errorCount = 0;
  const byProvider = {};
  const byEndpoint = {};
  /** @type {Record<string, number>} */
  const callsTodayByProvider = {};
  /** @type {Record<string, number>} */
  const callsTotalByProvider = {};
  /** @type {Record<string, {
   *   endpoint: string,
   *   calls: number,
   *   creditsDebited: number,
   *   tokensDebited: number,
   *   estimatedCostUsd: number,
   *   successCount: number,
   *   errorCount: number,
   * }>} */
  const endpointAgg = {};

  for (const ev of filtered) {
    const created = new Date(ev.created_at);
    const inToday = created >= dayStart;
    const inMonth = created >= monthStart;
    if (inToday) today += 1;
    if (inMonth) month += 1;
    const status = String(ev.status || "").toLowerCase();
    if (status === "success" || status === "ok") successCount += 1;
    else if (status === "error" || status === "failed") errorCount += 1;

    const billed = ev.billed !== false && ev.meta?.billed !== false;
    const cost = billed ? (Number(ev.estimated_cost_usd) || 0) : 0;
    estimatedCostTotal += cost;
    if (inMonth) estimatedCostUsdMonth += cost;
    if (inToday) estimatedCostUsdToday += cost;
    const provider = ev.provider || "unknown";
    const endpoint = ev.endpoint || "unknown";
    byProvider[provider] = (byProvider[provider] || 0) + 1;
    byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + 1;
    callsTotalByProvider[provider] = (callsTotalByProvider[provider] || 0) + 1;
    if (inToday) {
      callsTodayByProvider[provider] = (callsTodayByProvider[provider] || 0) + 1;
    }

    if (!endpointAgg[endpoint]) {
      endpointAgg[endpoint] = {
        endpoint,
        calls: 0,
        creditsDebited: 0,
        tokensDebited: 0,
        estimatedCostUsd: 0,
        successCount: 0,
        errorCount: 0,
      };
    }
    const row = endpointAgg[endpoint];
    row.calls += 1;
    row.creditsDebited += Number(ev.credits_debited) || 0;
    row.tokensDebited += Number(ev.tokens_debited) || 0;
    row.estimatedCostUsd += cost;
    if (status === "success" || status === "ok") row.successCount += 1;
    else if (status === "error" || status === "failed") row.errorCount += 1;
  }

  const toPie = (map) => Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const endpointMatrix = Object.values(endpointAgg)
    .map((row) => {
      const decided = row.successCount + row.errorCount;
      return {
        ...row,
        estimatedCostUsd: Math.round(row.estimatedCostUsd * 1e6) / 1e6,
        successRatePct: decided > 0
          ? Math.round((row.successCount / decided) * 1000) / 10
          : null,
      };
    })
    .sort((a, b) => b.calls - a.calls || b.estimatedCostUsd - a.estimatedCostUsd);

  const decidedTotal = successCount + errorCount;
  const successRatePct = decidedTotal > 0
    ? Math.round((successCount / decidedTotal) * 1000) / 10
    : null;

  return {
    totals: {
      today,
      month,
      allTime,
      estimatedCostUsd: Math.round(estimatedCostTotal * 1e6) / 1e6,
      estimatedCostUsdMonth: Math.round(estimatedCostUsdMonth * 1e6) / 1e6,
      estimatedCostUsdToday: Math.round(estimatedCostUsdToday * 1e6) / 1e6,
      successCount,
      errorCount,
      successRatePct,
    },
    byProvider: toPie(byProvider),
    byEndpoint: toPie(byEndpoint),
    endpointMatrix,
    callsTodayByProvider,
    callsTotalByProvider,
  };
}

/** List price for Pro monthly (marketing); not live Stripe MRR. */
const PRO_MONTHLY_LIST_USD = 20;

function monthlyBurnUsd(billing, amountUsd) {
  const amount = Number(amountUsd) || 0;
  if (billing === "annual") return Math.round((amount / 12) * 1e4) / 1e4;
  return Math.round(amount * 1e4) / 1e4;
}

function mapGastoRow(row) {
  const billing = row.billing === "annual" ? "annual" : "monthly";
  const amountUsd = Number(row.amount_usd) || 0;
  return {
    id: row.id,
    productName: row.product_name,
    billing,
    amountUsd,
    monthlyUsd: monthlyBurnUsd(billing, amountUsd),
    startedAt: row.started_at,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 */
async function loadGastosEntries(service) {
  const { data, error } = await service
    .from("admin_gastos")
    .select("*")
    .order("started_at", { ascending: false });

  if (error) {
    if (/admin_gastos|relation|schema cache/i.test(error.message)) {
      return {
        entries: [],
        totalListedUsd: 0,
        totalMonthlyUsd: 0,
        warning: "Run supabase_management_gastos.sql in Supabase SQL Editor for Gastos.",
      };
    }
    throw error;
  }

  const entries = (data || []).map(mapGastoRow);
  const totalListedUsd = Math.round(
    entries.reduce((sum, e) => sum + (Number(e.amountUsd) || 0), 0) * 1e4,
  ) / 1e4;
  const totalMonthlyUsd = Math.round(
    entries.reduce((sum, e) => sum + (Number(e.monthlyUsd) || 0), 0) * 1e4,
  ) / 1e4;

  return { entries, totalListedUsd, totalMonthlyUsd, warning: null };
}

/**
 * @param {Array<{ plan?: string, isTest?: boolean }>} users
 * @param {{ estimatedCostUsdMonth?: number }} totals
 * @param {number} [gastosMonthUsd]
 */
function buildMarginSnapshot(users, totals, gastosMonthUsd = 0) {
  const list = users || [];
  const proAll = list.filter((u) => u.plan === "pro");
  const proPaid = proAll.filter((u) => !u.isTest);
  const proTest = proAll.filter((u) => u.isTest);
  const mrrSampleUsd = Math.round(proAll.length * PRO_MONTHLY_LIST_USD * 100) / 100;
  const mrrUsd = Math.round(proPaid.length * PRO_MONTHLY_LIST_USD * 100) / 100;
  const apiCostMonthUsd = Number(totals?.estimatedCostUsdMonth) || 0;
  const opexUsd = Number(gastosMonthUsd) || 0;
  return {
    proSubscribers: proPaid.length,
    proTestSubscribers: proTest.length,
    proAllSubscribers: proAll.length,
    listPriceUsd: PRO_MONTHLY_LIST_USD,
    mrrUsd,
    mrrSampleUsd,
    apiCostMonthUsd,
    opexMonthUsd: opexUsd,
    gastosMonthUsd: opexUsd,
    marginUsd: Math.round((mrrUsd - apiCostMonthUsd - opexUsd) * 1e6) / 1e6,
    note: "Paid MRR = Pro without test tag × $20 − API$ − Gastos. Test Pros excluded.",
  };
}

function buildManagementAlerts(margin, totals) {
  /** @type {Array<{ id: string, level: 'warn'|'danger'|'info', message: string }>} */
  const alerts = [];
  const budgetRaw = process.env.MANAGEMENT_API_BUDGET_USD || process.env.VITE_MANAGEMENT_API_BUDGET_USD || "";
  const budgetUsd = budgetRaw.trim() === "" ? 25 : Number(budgetRaw);
  const apiMonth = Number(totals?.estimatedCostUsdMonth) || 0;
  const marginUsd = Number(margin?.marginUsd) || 0;

  if (Number.isFinite(budgetUsd) && budgetUsd > 0 && apiMonth > budgetUsd) {
    alerts.push({
      id: "api_budget",
      level: "danger",
      message: `API $ this month ($${apiMonth.toFixed(4)}) exceeds budget $${budgetUsd.toFixed(2)}.`,
    });
  } else if (Number.isFinite(budgetUsd) && budgetUsd > 0 && apiMonth > budgetUsd * 0.8) {
    alerts.push({
      id: "api_budget_warn",
      level: "warn",
      message: `API $ this month is at ${Math.round((apiMonth / budgetUsd) * 100)}% of $${budgetUsd.toFixed(2)} budget.`,
    });
  }

  if (marginUsd < 0) {
    alerts.push({
      id: "margin_neg",
      level: "danger",
      message: `Margin is negative ($${marginUsd.toFixed(2)}). Paid MRR − API$ − Gastos.`,
    });
  }

  const successRate = totals?.successRatePct;
  if (successRate != null && successRate < 90 && (totals?.errorCount || 0) > 0) {
    alerts.push({
      id: "success_rate",
      level: "warn",
      message: `Success rate ${successRate}% — review Recent Calls errors.`,
    });
  }

  return {
    alerts,
    budgetUsd: Number.isFinite(budgetUsd) && budgetUsd > 0 ? budgetUsd : null,
  };
}

/**
 * Tabla A — API free/call meters for as-of date (UTC).
 * Provider = Recent Calls provider id (e.g. groq). No free-text product name.
 * @param {import('@supabase/supabase-js').SupabaseClient|null} service
 * @param {{ includeSeed?: boolean, asOfYmd?: string|null }} [opts]
 */
async function loadQuotasDashboard(service, opts = {}) {
  const includeSeed = opts.includeSeed !== false;
  const asOfParsed = parseUtcYmd(opts.asOfYmd) || new Date();
  const asOf = startOfUtcDay(asOfParsed);
  const asOfYmd = formatUtcYmd(asOf);
  const asOfEnd = addUtcDays(asOf, 1);

  /** @type {import('./management/quotaCatalog.js').QuotaMeterDef[]} */
  let meters = DEFAULT_API_QUOTA_METERS.map((m) => ({ ...m }));
  let warning = null;
  let source = "defaults";

  if (service) {
    try {
      const { data, error } = await service
        .from("admin_quota_meters")
        .select("*")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      if (error) {
        if (/admin_quota_meters|relation|schema cache/i.test(error.message)) {
          warning = "Run supabase_management_quotas.sql in Supabase SQL Editor for editable meters.";
        } else {
          warning = error.message;
        }
      } else if (data && data.length > 0) {
        meters = data.map(mapQuotaMeterRow);
        source = "db";
      }
    } catch (err) {
      warning = err instanceof Error ? err.message : "Failed to load quota meters";
    }
  }

  /** @type {Array<{ provider: string, created: Date, tokens: number, costUsd: number, userKey: string }>} */
  const events = [];
  /** @type {Map<string, { provider: string, callsAll: number, tokensAll: number, costAll: number }>} */
  const providerAll = new Map();

  if (service) {
    try {
      const { data, error } = await service
        .from("api_usage_events")
        .select("provider, created_at, meta, input_tokens, output_tokens, estimated_cost_usd, user_id, user_email");
      if (!error) {
        for (const row of data || []) {
          if (!includeSeed && row.meta?.source === "seed-futuranota") continue;
          const provider = (row.provider || "unknown").toString().trim().toLowerCase() || "unknown";
          const tokens = Math.max(0, Number(row.input_tokens) || 0)
            + Math.max(0, Number(row.output_tokens) || 0);
          const costUsd = Math.max(0, Number(row.estimated_cost_usd) || 0);
          const userKey = (row.user_id || row.user_email || "").toString().trim().toLowerCase();
          const created = new Date(row.created_at);
          events.push({ provider, created, tokens, costUsd, userKey });

          const agg = providerAll.get(provider) || {
            provider,
            callsAll: 0,
            tokensAll: 0,
            costAll: 0,
          };
          agg.callsAll += 1;
          agg.tokensAll += tokens;
          agg.costAll += costUsd;
          providerAll.set(provider, agg);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const windows = meters.map((m) => ({
    meter: m,
    window: resolveMeterWindow(m, asOf),
  }));

  let totalCostToPay = 0;

  const items = windows.map(({ meter, window: w }) => {
    let callsInWindow = 0;
    let tokensInWindow = 0;
    let apiCostUsdInWindow = 0;
    /** @type {Set<string>} */
    const users = new Set();
    const providerKey = (meter.provider || "").toString().trim().toLowerCase();

    if (providerKey) {
      for (const ev of events) {
        if (ev.provider !== providerKey) continue;
        if (ev.created < w.queryStart) continue;
        if (ev.created >= w.queryEndExclusive) continue;
        callsInWindow += 1;
        tokensInWindow += ev.tokens;
        apiCostUsdInWindow += ev.costUsd;
        if (ev.userKey) users.add(ev.userKey);
      }
    }

    const used = meter.meterKind === "tokens" ? tokensInWindow : callsInWindow;
    const included = Number(meter.included) || 0;
    const over = Math.max(0, used - included);
    const costToPay = estimateOverageUsd(used, included, meter.overageUsd);
    totalCostToPay += costToPay;
    const pct = included > 0
      ? Math.min(999, Math.round((used / included) * 1000) / 10)
      : 0;
    const exhausted = used >= included;
    const displayName = providerKey || meter.productName || "—";

    return {
      id: meter.id,
      productName: displayName,
      provider: providerKey || null,
      meterKind: meter.meterKind,
      included,
      unit: meter.unit,
      type: meter.type,
      resets: meter.resets,
      everyN: meter.everyN,
      everyUnit: meter.everyUnit,
      everyLabel: meter.resets
        ? `every ${meter.everyN} ${meter.everyUnit}${Number(meter.everyN) === 1 ? "" : "s"}`
        : "—",
      overageUsd: meter.overageUsd,
      anchorAt: meter.anchorAt,
      notes: meter.notes,
      asOfYmd,
      windowStartYmd: w.windowStartYmd,
      windowEndYmd: w.windowEndYmd,
      resetAtYmd: w.resetAtYmd,
      timeLeftLabel: w.timeLeftLabel,
      daysRemaining: w.daysRemaining,
      periodLabel: w.periodLabel,
      used: Math.round(used * 1e4) / 1e4,
      callsInWindow,
      tokensInWindow: Math.round(tokensInWindow),
      apiCostUsdInWindow: Math.round(apiCostUsdInWindow * 1e6) / 1e6,
      over: Math.round(over * 1e4) / 1e4,
      uniqueUsers: users.size,
      pct,
      costToPay,
      exhausted,
    };
  });

  /** Provider picker list: anyone seen in Recent Calls + known catalog providers */
  /** @type {Map<string, { provider: string, callsAll: number, tokensAll: number, costAll: number, callsAsOf: number, tokensAsOf: number, costAsOf: number }>} */
  const pickerMap = new Map();
  for (const [provider, agg] of providerAll) {
    pickerMap.set(provider, {
      ...agg,
      callsAsOf: 0,
      tokensAsOf: 0,
      costAsOf: 0,
    });
  }
  for (const m of DEFAULT_API_QUOTA_METERS) {
    const p = (m.provider || "").toLowerCase();
    if (p && !pickerMap.has(p)) {
      pickerMap.set(p, {
        provider: p,
        callsAll: 0,
        tokensAll: 0,
        costAll: 0,
        callsAsOf: 0,
        tokensAsOf: 0,
        costAsOf: 0,
      });
    }
  }
  for (const ev of events) {
    if (ev.created < asOf || ev.created >= asOfEnd) continue;
    const row = pickerMap.get(ev.provider);
    if (!row) continue;
    row.callsAsOf += 1;
    row.tokensAsOf += ev.tokens;
    row.costAsOf += ev.costUsd;
  }

  const availableProviders = [...pickerMap.values()]
    .map((p) => ({
      provider: p.provider,
      callsAll: p.callsAll,
      tokensAll: Math.round(p.tokensAll),
      costAll: Math.round(p.costAll * 1e6) / 1e6,
      callsAsOf: p.callsAsOf,
      tokensAsOf: Math.round(p.tokensAsOf),
      costAsOf: Math.round(p.costAsOf * 1e6) / 1e6,
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));

  return {
    table: "A",
    asOfYmd,
    items,
    availableProviders,
    totalCostToPay: Math.round(totalCostToPay * 1e6) / 1e6,
    source,
    warning,
    note:
      "Tabla A — elegí un provider de Recent Calls (ej. groq). Totales = calls/tokens/$ en la ventana hasta Date picked.",
  };
}

/**
 * Apify CU from usage logs + optional live user probe.
 * @param {import('@supabase/supabase-js').SupabaseClient|null} service
 * @param {{ includeSeed?: boolean }} [opts]
 */
async function loadApifyStorageSnapshot(service, opts = {}) {
  const includeSeed = opts.includeSeed !== false;
  let computeUnitsMonth = 0;
  let computeUnitsAll = 0;
  let runsMonth = 0;
  let apifyCostMonth = 0;

  if (service) {
    try {
      const { data, error } = await service
        .from("api_usage_events")
        .select("provider, compute_units, estimated_cost_usd, created_at, billed, meta")
        .eq("provider", "apify");
      if (!error) {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        for (const row of data || []) {
          if (!includeSeed && row.meta?.source === "seed-futuranota") continue;
          const cu = Number(row.compute_units ?? row.meta?.computeUnits) || 0;
          const billed = row.billed !== false && row.meta?.billed !== false;
          const cost = billed ? (Number(row.estimated_cost_usd) || 0) : 0;
          computeUnitsAll += cu;
          const created = new Date(row.created_at);
          if (created >= monthStart) {
            computeUnitsMonth += cu;
            runsMonth += 1;
            apifyCostMonth += cost;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  let account = null;
  const token = (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || "").trim();
  if (token) {
    try {
      const res = await fetch("https://api.apify.com/v2/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const u = json?.data || json;
        account = {
          username: u?.username || null,
          email: u?.email || null,
          plan: u?.plan || u?.proxy?.groups?.[0] || null,
        };
      }
    } catch {
      /* ignore live probe */
    }
  }

  return {
    computeUnitsMonth: Math.round(computeUnitsMonth * 1e4) / 1e4,
    computeUnitsAll: Math.round(computeUnitsAll * 1e4) / 1e4,
    runsMonth,
    apifyCostMonthUsd: Math.round(apifyCostMonth * 1e6) / 1e6,
    account,
    dashboardUrl: "https://console.apify.com/billing",
    note: "CU from logged Apify runs. Dataset GB-h detailed billing stays on Apify console.",
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {{ includeSeed?: boolean, limit?: number }} [opts]
 */
async function loadRecentEvents(service, opts = {}) {
  const limit = opts.limit ?? 300;
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
      inputTokens: row.input_tokens ?? row.meta?.inputTokens ?? 0,
      outputTokens: row.output_tokens ?? row.meta?.outputTokens ?? 0,
      model: row.model || row.meta?.model || null,
      computeUnits: row.compute_units ?? row.meta?.computeUnits ?? null,
      billed: row.billed !== false && row.meta?.billed !== false,
      queryPreview: typeof row.meta?.query === "string"
        ? row.meta.query.slice(0, 80)
        : typeof row.meta?.brandName === "string"
          ? row.meta.brandName.slice(0, 80)
          : "",
    }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @returns {Promise<{ emails: Map<string, string|null>, lastSignIn: Map<string, string|null> }>}
 */
async function loadAuthUserMeta(service) {
  /** @type {Map<string, string|null>} */
  const emails = new Map();
  /** @type {Map<string, string|null>} */
  const lastSignIn = new Map();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("loadAuthUserMeta:", error.message);
      return { emails, lastSignIn };
    }
    for (const user of data.users) {
      emails.set(user.id, user.email ?? null);
      lastSignIn.set(user.id, user.last_sign_in_at ?? null);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return { emails, lastSignIn };
}

/** @deprecated use loadAuthUserMeta */
async function loadAllAuthEmails(service) {
  const { emails } = await loadAuthUserMeta(service);
  return emails;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 */
function isSameUtcMonth(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function formatUsedCap(used, cap) {
  const u = Math.max(0, Number(used) || 0);
  if (cap == null || !Number.isFinite(Number(cap))) return `${u}/Unlimited`;
  const c = Number(cap);
  return `${Math.min(u, c)}/${c}`;
}

/**
 * Profile feature counters for Management Users table 2 (used/cap).
 * @param {Record<string, unknown>} row
 * @param {{ launchRadarByUser?: Map<string, number>, marketHypeByUser?: Map<string, number> }} usage
 */
function buildFeatureUsage(row, usage = {}) {
  const plan = row.plan === "pro" ? "pro" : "free";
  const limits = getPlanLimits(plan);
  const tokensCap = getTokensCap(plan);
  let tokensBalance = Number(row.tokens_balance);
  if (!Number.isFinite(tokensBalance)) tokensBalance = tokensCap;
  const tokensUsed = Math.max(0, tokensCap - tokensBalance);

  let calendarSearchesCount = Number(row.calendar_searches_count) || 0;
  if (plan === "pro" && row.calendar_period_start) {
    const calStart = new Date(String(row.calendar_period_start));
    if (!Number.isNaN(calStart.getTime()) && !isSameUtcMonth(calStart, new Date())) {
      calendarSearchesCount = 0;
    }
  }
  const calendarUsed = getCalendarSearchesUsed({
    plan,
    calendarUsed: Boolean(row.calendar_used),
    calendarSearchesCount,
  });
  const calendarCap = getCalendarSearchesCap(plan);

  let weatherUsed = Number(row.weather_actions_count);
  if (!Number.isFinite(weatherUsed) || weatherUsed < 0) {
    weatherUsed = row.weather_used ? 1 : 0;
  } else {
    weatherUsed = Math.floor(weatherUsed);
  }
  const weatherCap = getWeatherActionCap(plan);

  const creditsUsed = getCreditsUsed({
    plan,
    searchCount: row.search_count ?? 0,
    tokensBalance,
  });
  const creditsCap = getCreditsCap(plan);

  const userId = String(row.user_id || "");
  const launchRadarRuns = usage.launchRadarByUser?.get?.(userId) ?? 0;
  const marketHypeRuns = usage.marketHypeByUser?.get?.(userId) ?? 0;

  let campaignLive = "—";
  if (plan === "free") {
    campaignLive = formatUsedCap(row.campaign_live_used ? 1 : 0, limits.campaignLiveRuns);
  } else {
    campaignLive = "Via credits";
  }

  return {
    credits: formatUsedCap(creditsUsed, creditsCap),
    tokens: `${formatTokenCount(tokensUsed)} / ${formatTokenCount(tokensCap)}`,
    calendar: formatUsedCap(calendarUsed, calendarCap),
    forecast: formatUsedCap(weatherUsed, weatherCap),
    launchRadar: plan === "pro" ? `${launchRadarRuns} scans` : (launchRadarRuns ? `${launchRadarRuns} (demo)` : "Demo"),
    marketHype: plan === "pro" ? `${marketHypeRuns} runs` : "Pro only",
    campaignLive,
    storage: limits.storageLabel,
    stepsLibrary: limits.stepsLibraryCrossObject ? "Yes" : "No",
  };
}

async function loadUsageByUserId(service) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {Map<string, string>} */
  const lastCall = new Map();
  /** @type {Map<string, number>} */
  const costs = new Map();
  /** @type {Map<string, number>} */
  const costsByEmail = new Map();
  /** @type {Map<string, number>} */
  const countsByEmail = new Map();
  /** @type {Map<string, string>} */
  const lastCallByEmail = new Map();
  /** @type {Map<string, number>} */
  const launchRadarByUser = new Map();
  /** @type {Map<string, number>} */
  const marketHypeByUser = new Map();

  const empty = {
    counts,
    lastCall,
    costs,
    costsByEmail,
    countsByEmail,
    lastCallByEmail,
    launchRadarByUser,
    marketHypeByUser,
  };

  const { data, error } = await service
    .from("api_usage_events")
    .select("user_id, user_email, created_at, estimated_cost_usd, billed, endpoint");

  if (error) {
    if (error.message.includes("api_usage_events")) {
      return empty;
    }
    throw error;
  }

  for (const row of data || []) {
    const cost = row.billed === false ? 0 : Number(row.estimated_cost_usd) || 0;
    const endpoint = String(row.endpoint || "").toLowerCase();
    if (row.user_id) {
      counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
      costs.set(row.user_id, (costs.get(row.user_id) || 0) + cost);
      const prev = lastCall.get(row.user_id);
      if (!prev || row.created_at > prev) {
        lastCall.set(row.user_id, row.created_at);
      }
      if (endpoint.includes("horizon-scan") || endpoint.includes("launch-radar")) {
        launchRadarByUser.set(row.user_id, (launchRadarByUser.get(row.user_id) || 0) + 1);
      }
      if (endpoint.includes("social-hype") || endpoint.includes("market-hype")) {
        marketHypeByUser.set(row.user_id, (marketHypeByUser.get(row.user_id) || 0) + 1);
      }
    } else if (row.user_email) {
      const emailKey = String(row.user_email).toLowerCase();
      costsByEmail.set(emailKey, (costsByEmail.get(emailKey) || 0) + cost);
      countsByEmail.set(emailKey, (countsByEmail.get(emailKey) || 0) + 1);
      const prev = lastCallByEmail.get(emailKey);
      if (!prev || row.created_at > prev) {
        lastCallByEmail.set(emailKey, row.created_at);
      }
    }
  }

  return empty;
}

function resolveUserApiCostUsd(usage, userId, email) {
  const byId = usage.costs?.get(userId) ?? 0;
  const emailKey = email ? String(email).toLowerCase() : "";
  const byEmail = emailKey && usage.costsByEmail ? (usage.costsByEmail.get(emailKey) || 0) : 0;
  return Math.round((byId + byEmail) * 1e6) / 1e6;
}

function resolveUserCallStats(usage, userId, email) {
  const emailKey = email ? String(email).toLowerCase() : "";
  const byId = usage.counts?.get(userId) ?? 0;
  const byEmail = emailKey && usage.countsByEmail ? (usage.countsByEmail.get(emailKey) || 0) : 0;
  const lastId = usage.lastCall?.get(userId) ?? null;
  const lastEmail = emailKey && usage.lastCallByEmail ? (usage.lastCallByEmail.get(emailKey) ?? null) : null;
  let lastCallAt = lastId;
  if (lastEmail && (!lastCallAt || lastEmail > lastCallAt)) lastCallAt = lastEmail;
  return { totalCalls: byId + byEmail, lastCallAt };
}

function buildUserRow(row, emailById, usage, adminEmail, testEmails = getTestEmailSet(), lastSignInById = null) {
  const userId = row.user_id;
  const email = row.email || emailById.get(userId) || userId;
  const view = rowToProfileView(row);
  const creditsUsed = view?.creditsUsed ?? 0;
  const creditsCap = view?.creditsCap ?? getCreditsCap("free");
  const emailKey = email?.toLowerCase?.() || String(email).toLowerCase();
  const isAdmin = Boolean(adminEmail && emailKey === adminEmail);
  const isTest = isTestAccountEmail(emailKey, testEmails);
  const callStats = resolveUserCallStats(usage, userId, email);

  return {
    userId,
    email,
    plan: view?.plan || "free",
    creditsUsed,
    creditsCap,
    creditsLabel: `${creditsUsed}/${creditsCap}`,
    tokensBalance: view?.tokensBalance ?? null,
    tokensCap: view?.tokensCap ?? null,
    totalCalls: callStats.totalCalls,
    lastCallAt: callStats.lastCallAt,
    apiCostUsd: resolveUserApiCostUsd(usage, userId, email),
    isAdmin,
    isTest,
    profileCreatedAt: row.created_at ?? null,
    profileUpdatedAt: row.updated_at ?? null,
    planUpgradedAt: row.plan_upgraded_at ?? null,
    lastSignInAt: lastSignInById?.get?.(userId) ?? null,
    features: buildFeatureUsage(row, usage),
  };
}

/**
 * All registered users from profiles + auth emails, with plan and credits.
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {{ id: string, email?: string|null }} adminUser
 */
async function loadUsersOverview(service, adminUser) {
  const adminEmail = getAdminEmail();
  const testEmails = getTestEmailSet();

  const PROFILE_SELECT_FULL =
    "user_id, plan, search_count, tokens_balance, tokens_period_start, created_at, updated_at, plan_upgraded_at, calendar_searches_count, calendar_used, calendar_period_start, weather_actions_count, weather_used, campaign_live_used";
  const PROFILE_SELECT_NO_UPGRADE =
    "user_id, plan, search_count, tokens_balance, tokens_period_start, created_at, updated_at, calendar_searches_count, calendar_used, calendar_period_start, weather_actions_count, weather_used, campaign_live_used";
  const PROFILE_SELECT_BASE =
    "user_id, plan, search_count, tokens_balance, tokens_period_start, created_at, updated_at";

  let profileRows = null;
  {
    let result = await service
      .from("profiles")
      .select(PROFILE_SELECT_FULL)
      .order("created_at", { ascending: false });

    if (result.error && /plan_upgraded_at/i.test(result.error.message)) {
      console.warn("[management] Run supabase_management_users_v2.sql for plan_upgraded_at");
      result = await service
        .from("profiles")
        .select(PROFILE_SELECT_NO_UPGRADE)
        .order("created_at", { ascending: false });
    }
    if (result.error && /calendar_|weather_|campaign_live/i.test(result.error.message)) {
      console.warn("[management] Feature columns missing on profiles:", result.error.message);
      result = await service
        .from("profiles")
        .select(PROFILE_SELECT_BASE)
        .order("created_at", { ascending: false });
    }
    if (result.error) throw new Error(result.error.message);
    profileRows = result.data || [];
  }

  const { emails: emailById, lastSignIn: lastSignInById } = await loadAuthUserMeta(service);
  const usage = await loadUsageByUserId(service);

  const seen = new Set();
  const users = (profileRows || []).map((row) => {
    seen.add(row.user_id);
    return buildUserRow(row, emailById, usage, adminEmail, testEmails, lastSignInById);
  });

  for (const [userId, email] of emailById) {
    if (seen.has(userId)) continue;
    const creditsCap = getCreditsCap("free");
    const callStats = resolveUserCallStats(usage, userId, email);
    const emailKey = String(email || "").toLowerCase();
    const synthetic = {
      user_id: userId,
      plan: "free",
      search_count: 0,
      tokens_balance: getTokensCap("free"),
    };
    users.push({
      userId,
      email: email || userId,
      plan: "free",
      creditsUsed: 0,
      creditsCap,
      creditsLabel: `0/${creditsCap}`,
      tokensBalance: getTokensCap("free"),
      tokensCap: getTokensCap("free"),
      totalCalls: callStats.totalCalls,
      lastCallAt: callStats.lastCallAt,
      apiCostUsd: resolveUserApiCostUsd(usage, userId, email),
      isAdmin: Boolean(adminEmail && emailKey === adminEmail),
      isTest: isTestAccountEmail(emailKey, testEmails),
      profileCreatedAt: null,
      profileUpdatedAt: null,
      planUpgradedAt: null,
      lastSignInAt: lastSignInById.get(userId) ?? null,
      features: buildFeatureUsage(synthetic, usage),
    });
  }

  users.sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    if (a.isTest && !b.isTest) return -1;
    if (!a.isTest && b.isTest) return 1;
    return String(b.profileCreatedAt || "").localeCompare(String(a.profileCreatedAt || ""));
  });

  if (users.length === 0 && adminUser?.id) {
    const row = profileRows?.find((p) => p.user_id === adminUser.id);
    if (row) {
      users.push(buildUserRow(row, emailById, usage, adminEmail, testEmails, lastSignInById));
    } else {
      const callStats = resolveUserCallStats(usage, adminUser.id, adminUser.email);
      const emailKey = String(adminUser.email || "").toLowerCase();
      const synthetic = {
        user_id: adminUser.id,
        plan: "free",
        search_count: 0,
        tokens_balance: getTokensCap("free"),
      };
      users.push({
        userId: adminUser.id,
        email: adminUser.email || adminUser.id,
        plan: "free",
        creditsUsed: 0,
        creditsCap: getCreditsCap("free"),
        creditsLabel: `0/${getCreditsCap("free")}`,
        tokensBalance: null,
        tokensCap: getTokensCap("free"),
        totalCalls: callStats.totalCalls,
        lastCallAt: callStats.lastCallAt,
        apiCostUsd: resolveUserApiCostUsd(usage, adminUser.id, adminUser.email),
        isAdmin: true,
        isTest: isTestAccountEmail(emailKey, testEmails),
        profileCreatedAt: null,
        profileUpdatedAt: null,
        planUpgradedAt: null,
        lastSignInAt: lastSignInById.get(adminUser.id) ?? null,
        features: buildFeatureUsage(synthetic, usage),
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

  const usage = {
    counts: new Map(),
    lastCall: new Map(),
    costs: new Map(),
    costsByEmail: new Map(),
    countsByEmail: new Map(),
    lastCallByEmail: new Map(),
  };
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
  const usage = {
    counts: new Map(),
    lastCall: new Map(),
    costs: new Map(),
    costsByEmail: new Map(),
    countsByEmail: new Map(),
    lastCallByEmail: new Map(),
  };
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
      apiCostUsd: 0,
      isAdmin: true,
      isTest: true,
      profileCreatedAt: null,
      profileUpdatedAt: null,
      planUpgradedAt: null,
      lastSignInAt: null,
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
  const asOfYmd = url.searchParams.get("asOf") || null;

  const service = createServiceSupabase();
  const serviceConfigured = Boolean(service);

  let integrations = [];
  let stats = {
    totals: {
      today: 0,
      month: 0,
      allTime: 0,
      estimatedCostUsd: 0,
      estimatedCostUsdMonth: 0,
      estimatedCostUsdToday: 0,
      successCount: 0,
      errorCount: 0,
      successRatePct: null,
    },
    byProvider: [],
    byEndpoint: [],
    endpointMatrix: [],
    callsTodayByProvider: {},
    callsTotalByProvider: {},
  };
  let recentEvents = [];
  let users = [];
  let usersSource = "none";
  let usersWarning = null;
  let dbWarning = null;
  let gastos = {
    entries: [],
    totalListedUsd: 0,
    totalMonthlyUsd: 0,
    warning: null,
  };

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

      try {
        gastos = await loadGastosEntries(service);
      } catch (gastosErr) {
        gastos = {
          entries: [],
          totalListedUsd: 0,
          totalMonthlyUsd: 0,
          warning: gastosErr instanceof Error ? gastosErr.message : "Failed to load gastos",
        };
      }
    } catch (err) {
      if (!dbWarning) {
        dbWarning = err instanceof Error ? err.message : "Management DB error";
      }
    }
  }

  const probe = await runAllIntegrationProbes({ live: false });
  const callsTodayByProvider = stats.callsTodayByProvider || {};
  const callsTotalByProvider = stats.callsTotalByProvider || {};

  const integrationCards = mergeIntegrationRows(integrations).map((row) => {
    const probeKey = row.provider === "serper" ? "serper" : row.id;
    const step = probe.steps?.[probeKey] || probe.steps?.[row.id] || probe.steps?.[row.provider];
    const callKey = row.provider || row.id;
    const callsToday = callsTodayByProvider[callKey]
      ?? callsTodayByProvider[row.id]
      ?? 0;
    const callsTotal = callsTotalByProvider[callKey]
      ?? callsTotalByProvider[row.id]
      ?? 0;
    const dailyFreeLimit = row.daily_free_limit != null && row.daily_free_limit !== ""
      ? Number(row.daily_free_limit)
      : null;
    const lifecycleStatus = row.lifecycle_status === "pending" ? "pending" : "active";
    const estimatedCostUsd = Number(row.estimated_cost_usd ?? 0);
    return {
      id: row.id,
      label: row.label,
      envVar: row.env_var,
      provider: row.provider,
      estimatedCostUsd,
      enabled: row.enabled !== false,
      notes: row.notes || "",
      metaDescription: row.meta_description || "",
      dashboardUrl: row.dashboard_url || "",
      lifecycleStatus,
      dailyFreeLimit: Number.isFinite(dailyFreeLimit) ? dailyFreeLimit : null,
      callsToday,
      callsTotal,
      estimatedCostTodayUsd: callsToday * estimatedCostUsd,
      configured: step?.configured ?? false,
      ok: step?.ok ?? false,
      statusMessage: step?.message || (row.env_var ? `${row.env_var} unknown` : ""),
      latencyMs: step?.latencyMs,
    };
  }).sort((a, b) => {
    if (a.lifecycleStatus !== b.lifecycleStatus) {
      return a.lifecycleStatus === "active" ? -1 : 1;
    }
    return String(a.label).localeCompare(String(b.label));
  });

  const margin = buildMarginSnapshot(users, stats.totals || {}, gastos.totalMonthlyUsd);
  const budgetInfo = buildManagementAlerts(margin, stats.totals || {});
  const quotas = await loadQuotasDashboard(service, { includeSeed, asOfYmd });

  return {
    status: 200,
    body: {
      serviceConfigured,
      dbWarning,
      usersSource,
      usersWarning,
      stats,
      margin,
      alerts: budgetInfo.alerts,
      budgetUsd: budgetInfo.budgetUsd,
      gastos,
      quotas,
      integrations: integrationCards,
      users,
      recentEvents,
      probeOk: probe.ok,
    },
  };
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function mergeIntegrationRows(rows) {
  const defaults = getDefaultIntegrations();
  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map(defaults.map((d) => [d.id, { ...d }]));
  for (const row of rows || []) {
    if (!row?.id) continue;
    const prev = byId.get(row.id) || {};
    byId.set(row.id, {
      ...prev,
      ...row,
      meta_description: row.meta_description || prev.meta_description || "",
      dashboard_url: row.dashboard_url || prev.dashboard_url || "",
    });
  }
  return [...byId.values()];
}

function getDefaultIntegrations() {
  return [
    {
      id: "groq",
      label: "Groq LLM",
      env_var: "GROQ_API_KEY",
      provider: "groq",
      estimated_cost_usd: 0.002,
      enabled: true,
      notes: "Intel, Gina, launch radar, campaign study, agents",
      daily_free_limit: null,
      lifecycle_status: "active",
      meta_description:
        "LLM principal de Futura Nota: Intel Search, Gina, Launch Radar, Campaign Study y agents. Inferencia rápida vía Groq Cloud.",
      dashboard_url: "https://console.groq.com",
    },
    {
      id: "gemini",
      label: "Google Gemini",
      env_var: "GEMINI_API_KEY",
      provider: "gemini",
      estimated_cost_usd: 0.001,
      enabled: true,
      notes: "Optional LLM fallback — not in daily use",
      daily_free_limit: null,
      lifecycle_status: "pending",
      meta_description:
        "Fallback LLM opcional (Google AI). Pendiente — no es el path diario; se usa si Groq falla y hay key.",
      dashboard_url: "https://aistudio.google.com/apikey",
    },
    {
      id: "serper",
      label: "Serper Search",
      env_var: "SERPAPI_KEY",
      provider: "serper",
      estimated_cost_usd: 0.001,
      enabled: true,
      notes: "Intel overview, horizon scan, social hype",
      daily_free_limit: null,
      lifecycle_status: "active",
      meta_description:
        "Búsqueda web en vivo (Google vía Serper): Intel overview, Horizon Scan y señales de Market/Social Hype.",
      dashboard_url: "https://serper.dev/dashboard",
    },
    {
      id: "dataforseo",
      label: "DataForSEO",
      env_var: "DATAFORSEO_LOGIN",
      provider: "dataforseo",
      estimated_cost_usd: 0.003,
      enabled: true,
      notes: "Campaign study PAA + intent, social hype",
      daily_free_limit: null,
      lifecycle_status: "active",
      meta_description:
        "SEO / SERP enrichment: People Also Ask e intent en Campaign Study; señales extra en social hype.",
      dashboard_url: "https://app.dataforseo.com",
    },
    {
      id: "apify",
      label: "Apify",
      env_var: "APIFY_API_TOKEN",
      provider: "apify",
      estimated_cost_usd: 0.005,
      enabled: true,
      notes: "Campaign study social hype",
      daily_free_limit: null,
      lifecycle_status: "active",
      meta_description:
        "Monitoreo de tendencias en redes sociales: actores/scrapers listos para Twitter, TikTok y Reddit vía API (Market Hype / Campaign Study).",
      dashboard_url: "https://console.apify.com",
    },
    {
      id: "openweather",
      label: "OpenWeather",
      env_var: "OPENWEATHER_API_KEY",
      provider: "openweather",
      estimated_cost_usd: 0.0001,
      enabled: true,
      notes: "Weather forecast nodes",
      daily_free_limit: 1000,
      lifecycle_status: "active",
      meta_description:
        "Forecast del clima para nodos y widgets de predicción (ventana de días desde OpenWeather).",
      dashboard_url: "https://home.openweathermap.org/api_keys",
    },
    {
      id: "supabase",
      label: "Supabase",
      env_var: "SUPABASE_PROJECT_URL",
      provider: "supabase",
      estimated_cost_usd: 0,
      enabled: true,
      notes: "Profiles, cache, persistence — fixed plan via ledger",
      daily_free_limit: null,
      lifecycle_status: "active",
      meta_description:
        "Base de datos, auth y sync del workspace. Gasto fijo de plan (egress) — no se cobra por call en esta tabla.",
      dashboard_url: "https://supabase.com/dashboard",
    },
    {
      id: "calendarific",
      label: "Calendarific",
      env_var: "CALENDARIFIC_API_KEY",
      provider: "calendarific",
      estimated_cost_usd: 0.0001,
      enabled: true,
      notes: "Event calendar holidays",
      daily_free_limit: 100,
      lifecycle_status: "active",
      meta_description:
        "Feriados y observances por país en el calendario de eventos de marketing (/api/events).",
      dashboard_url: "https://calendarific.com/account",
    },
    {
      id: "resend",
      label: "Resend",
      env_var: "RESEND_API_KEY",
      provider: "resend",
      estimated_cost_usd: 0,
      enabled: true,
      notes: "Referral invite emails (free tier)",
      daily_free_limit: 100,
      lifecycle_status: "active",
      meta_description:
        "Email transaccional: invitaciones de referral. Plan free — llevar conteo de envíos.",
      dashboard_url: "https://resend.com/emails",
    },
    {
      id: "predicthq",
      label: "PredictHQ",
      env_var: "PREDICTHQ_API_KEY",
      provider: "predicthq",
      estimated_cost_usd: 0.002,
      enabled: true,
      notes: "Events — code present, not in merge path",
      daily_free_limit: null,
      lifecycle_status: "pending",
      meta_description:
        "Eventos públicos (conciertos, deportes, etc.). Código presente; hoy no está en el merge del calendario.",
      dashboard_url: "https://control.predicthq.com",
    },
    {
      id: "tavily",
      label: "Tavily",
      env_var: "TAVILY_API_KEY",
      provider: "tavily",
      estimated_cost_usd: 0.001,
      enabled: true,
      notes: "Optional campaign analyst search",
      daily_free_limit: null,
      lifecycle_status: "pending",
      meta_description:
        "Búsqueda web opcional para Campaign Analyst (Pass 1). Solo si TAVILY_API_KEY está configurada.",
      dashboard_url: "https://app.tavily.com",
    },
    {
      id: "google_translate",
      label: "Google Translate",
      env_var: "GOOGLE_TRANSLATE_API_KEY",
      provider: "google_translate",
      estimated_cost_usd: 0.00002,
      enabled: true,
      notes: "POST /api/translate",
      daily_free_limit: null,
      lifecycle_status: "pending",
      meta_description:
        "Traducción de textos vía Cloud Translation API (POST /api/translate).",
      dashboard_url: "https://console.cloud.google.com/apis/library/translate.googleapis.com",
    },
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
  if (body.lifecycleStatus === "active" || body.lifecycleStatus === "pending") {
    patch.lifecycle_status = body.lifecycleStatus;
  }
  if (body.dailyFreeLimit === null || body.dailyFreeLimit === "") {
    patch.daily_free_limit = null;
  } else if (body.dailyFreeLimit != null && !Number.isNaN(Number(body.dailyFreeLimit))) {
    patch.daily_free_limit = Math.max(0, Math.floor(Number(body.dailyFreeLimit)));
  }
  if (typeof body.metaDescription === "string") {
    patch.meta_description = body.metaDescription;
  }
  if (typeof body.dashboardUrl === "string") {
    patch.dashboard_url = body.dashboardUrl.trim();
  }

  const defaults = getDefaultIntegrations().find((d) => d.id === integrationId);
  const upsertRow = {
    id: integrationId,
    label: defaults?.label || integrationId,
    env_var: defaults?.env_var || null,
    provider: defaults?.provider || integrationId,
    estimated_cost_usd: defaults?.estimated_cost_usd ?? 0,
    enabled: defaults?.enabled !== false,
    notes: defaults?.notes || "",
    daily_free_limit: defaults?.daily_free_limit ?? null,
    lifecycle_status: defaults?.lifecycle_status || "active",
    meta_description: defaults?.meta_description || "",
    dashboard_url: defaults?.dashboard_url || "",
    ...patch,
  };

  const { data, error } = await service
    .from("api_integrations")
    .upsert(upsertRow, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  return { status: 200, body: { integration: data } };
}

/**
 * @param {{ headers?: Record<string, string|string[]|undefined>, url?: string, body?: unknown, method?: string }} reqLike
 */
export async function processManagementGastosRequest(reqLike) {
  const auth = await assertAdminUser(reqLike);
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const service = createServiceSupabase();
  if (!service) {
    return { status: 503, body: { error: "Service role not configured" } };
  }

  const method = (reqLike.method || "GET").toUpperCase();
  const url = new URL(reqLike.url || "/api/admin/management/gastos", "http://localhost");
  const id = url.searchParams.get("id");
  const body = reqLike.body && typeof reqLike.body === "object" ? reqLike.body : {};

  if (method === "POST") {
    const productName = typeof body.productName === "string" ? body.productName.trim() : "";
    if (!productName) return { status: 400, body: { error: "productName required" } };
    const billing = body.billing === "annual" ? "annual" : "monthly";
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 0) {
      return { status: 400, body: { error: "amountUsd must be a non-negative number" } };
    }
    const startedRaw = typeof body.startedAt === "string" ? body.startedAt.trim() : "";
    const startedAt = normalizeStartedAt(startedRaw);
    if (!startedAt) {
      return { status: 400, body: { error: "startedAt must be YYYY-MM-DD or MM/DD/YYYY" } };
    }

    const { data, error } = await service
      .from("admin_gastos")
      .insert({
        product_name: productName,
        billing,
        amount_usd: amountUsd,
        started_at: startedAt,
        notes: typeof body.notes === "string" ? body.notes : "",
      })
      .select("*")
      .single();

    if (error) {
      if (/admin_gastos|relation|schema cache/i.test(error.message)) {
        return {
          status: 503,
          body: { error: "Run supabase_management_gastos.sql in Supabase SQL Editor first." },
        };
      }
      return { status: 500, body: { error: error.message } };
    }
    return { status: 200, body: { entry: mapGastoRow(data) } };
  }

  if (method === "DELETE") {
    if (!id) return { status: 400, body: { error: "id required" } };
    const { error } = await service.from("admin_gastos").delete().eq("id", id);
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { ok: true } };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}

/**
 * Tabla A CRUD — admin_quota_meters
 * @param {{ headers?: Record<string, string|string[]|undefined>, url?: string, body?: unknown, method?: string }} reqLike
 */
export async function processManagementQuotasRequest(reqLike) {
  const auth = await assertAdminUser(reqLike);
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const service = createServiceSupabase();
  if (!service) {
    return { status: 503, body: { error: "Service role not configured" } };
  }

  const method = (reqLike.method || "GET").toUpperCase();
  const url = new URL(reqLike.url || "/api/admin/management/quotas", "http://localhost");
  const id = url.searchParams.get("id");
  const body = reqLike.body && typeof reqLike.body === "object" ? reqLike.body : {};

  if (method === "POST") {
    const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    if (!provider) return { status: 400, body: { error: "provider required (pick from Recent Calls)" } };
    const productName = typeof body.productName === "string" && body.productName.trim()
      ? body.productName.trim()
      : provider;
    const resets = body.resets !== false && body.resets !== "false";
    const everyN = body.everyN != null ? Math.max(1, Math.floor(Number(body.everyN))) : null;
    const everyUnit = body.everyUnit === "month" ? "month" : body.everyUnit === "day" ? "day" : null;
    if (resets && (!everyN || !everyUnit)) {
      return { status: 400, body: { error: "everyN + everyUnit required when resets=true" } };
    }
    const included = Number(body.included);
    if (!Number.isFinite(included) || included < 0) {
      return { status: 400, body: { error: "included must be a non-negative number" } };
    }
    const overageRaw = body.overageUsd;
    const overageUsd = overageRaw === "" || overageRaw == null
      ? null
      : Number(overageRaw);
    if (overageUsd != null && !Number.isFinite(overageUsd)) {
      return { status: 400, body: { error: "overageUsd must be a number" } };
    }
    const anchorAt = typeof body.anchorAt === "string" && body.anchorAt.trim()
      ? normalizeStartedAt(body.anchorAt.trim())
      : null;
    if (body.anchorAt && !anchorAt) {
      return { status: 400, body: { error: "anchorAt must be YYYY-MM-DD" } };
    }

    const row = {
      product_name: productName,
      provider,
      meter_kind: body.meterKind === "tokens" ? "tokens" : "calls",
      included,
      unit: typeof body.unit === "string" && body.unit.trim()
        ? body.unit.trim()
        : (body.meterKind === "tokens" ? "tokens" : "calls"),
      type: body.type === "welcome" || body.type === "paid" ? body.type : "free",
      resets,
      every_n: resets ? everyN : null,
      every_unit: resets ? everyUnit : null,
      overage_usd: overageUsd,
      anchor_at: anchorAt,
      sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
      notes: typeof body.notes === "string" ? body.notes : "",
      enabled: body.enabled !== false,
    };

    const { data, error } = await service
      .from("admin_quota_meters")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      if (/admin_quota_meters|relation|schema cache/i.test(error.message)) {
        return {
          status: 503,
          body: { error: "Run supabase_management_quotas.sql in Supabase SQL Editor first." },
        };
      }
      return { status: 500, body: { error: error.message } };
    }
    return { status: 200, body: { meter: mapQuotaMeterRow(data) } };
  }

  if (method === "PATCH") {
    if (!id) return { status: 400, body: { error: "id required" } };
    /** @type {Record<string, unknown>} */
    const patch = { updated_at: new Date().toISOString() };
    if (typeof body.provider === "string") {
      const p = body.provider.trim().toLowerCase();
      if (!p) return { status: 400, body: { error: "provider required" } };
      patch.provider = p;
      // Keep product_name in sync with provider (product = Recent Calls name)
      if (body.productName == null) patch.product_name = p;
    }
    if (typeof body.productName === "string" && body.productName.trim()) {
      patch.product_name = body.productName.trim();
    }
    if (body.meterKind === "tokens" || body.meterKind === "calls") patch.meter_kind = body.meterKind;
    if (body.included != null) {
      const included = Number(body.included);
      if (!Number.isFinite(included) || included < 0) {
        return { status: 400, body: { error: "included must be a non-negative number" } };
      }
      patch.included = included;
    }
    if (typeof body.unit === "string" && body.unit.trim()) patch.unit = body.unit.trim();
    if (body.type === "free" || body.type === "welcome" || body.type === "paid") {
      patch.type = body.type;
    }
    if (body.resets != null) patch.resets = Boolean(body.resets);
    if (body.everyN != null) patch.every_n = Math.max(1, Math.floor(Number(body.everyN)));
    if (body.everyUnit === "day" || body.everyUnit === "month" || body.everyUnit === null) {
      patch.every_unit = body.everyUnit;
    }
    if (body.overageUsd === "" || body.overageUsd === null) patch.overage_usd = null;
    else if (body.overageUsd != null) {
      const o = Number(body.overageUsd);
      if (!Number.isFinite(o)) return { status: 400, body: { error: "overageUsd must be a number" } };
      patch.overage_usd = o;
    }
    if (body.anchorAt === "" || body.anchorAt === null) patch.anchor_at = null;
    else if (typeof body.anchorAt === "string") {
      const a = normalizeStartedAt(body.anchorAt.trim());
      if (!a) return { status: 400, body: { error: "anchorAt must be YYYY-MM-DD" } };
      patch.anchor_at = a;
    }
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (body.enabled != null) patch.enabled = Boolean(body.enabled);
    if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
      patch.sort_order = Number(body.sortOrder);
    }

    // If patching resets=false, clear every_*
    if (patch.resets === false) {
      patch.every_n = null;
      patch.every_unit = null;
    }

    const { data, error } = await service
      .from("admin_quota_meters")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (/admin_quota_meters|relation|schema cache/i.test(error.message)) {
        return {
          status: 503,
          body: { error: "Run supabase_management_quotas.sql in Supabase SQL Editor first." },
        };
      }
      return { status: 500, body: { error: error.message } };
    }
    return { status: 200, body: { meter: mapQuotaMeterRow(data) } };
  }

  if (method === "DELETE") {
    if (!id) return { status: 400, body: { error: "id required" } };
    const { error } = await service.from("admin_quota_meters").delete().eq("id", id);
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { ok: true } };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}

/** Accept YYYY-MM-DD or MM/DD/YYYY → YYYY-MM-DD */
function normalizeStartedAt(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : raw;
  }
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = String(m[1]).padStart(2, "0");
  const dd = String(m[2]).padStart(2, "0");
  const yyyy = m[3];
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : iso;
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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  const rawPath = req.url?.split("?")[0] || "";
  const path = rawPath.replace(/\/+$/, "") || "/";

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

  if (path === "/api/admin/management/gastos" && (req.method === "POST" || req.method === "DELETE")) {
    try {
      const body = req.method === "DELETE" ? {} : await readJsonBody(req);
      const result = await processManagementGastosRequest({
        headers: req.headers,
        url: req.url,
        body,
        method: req.method,
      });
      sendJson(res, result.status, result.body);
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Gastos update failed" });
      return true;
    }
  }

  if (
    path === "/api/admin/management/quotas"
    && (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE")
  ) {
    try {
      const body = req.method === "DELETE" ? {} : await readJsonBody(req);
      const result = await processManagementQuotasRequest({
        headers: req.headers,
        url: req.url,
        body,
        method: req.method,
      });
      sendJson(res, result.status, result.body);
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Quotas update failed" });
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
