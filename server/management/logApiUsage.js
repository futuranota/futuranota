import { createServiceSupabase } from "../supabaseServer.js";
import {
  estimateApifyCostUsd,
  estimateGroqCostUsd,
} from "./apiCostPricing.js";

/**
 * @typedef {Object} ApiUsageEventInput
 * @property {string} [userId]
 * @property {string} [userEmail]
 * @property {string} provider
 * @property {string} endpoint
 * @property {string} [routeLabel]
 * @property {number} [creditsDebited]
 * @property {number} [tokensDebited] Product plan tokens — not LLM tokens
 * @property {number|null} [estimatedCostUsd]
 * @property {number} [inputTokens] LLM prompt tokens
 * @property {number} [outputTokens] LLM completion tokens
 * @property {string} [model]
 * @property {number|null} [computeUnits]
 * @property {number|null} [usageTotalUsd]
 * @property {number|null} [itemCount]
 * @property {boolean} [billed]
 * @property {'success'|'error'} [status]
 * @property {string} [errorCode]
 * @property {Record<string, unknown>} [meta]
 */

/**
 * Resolve infra cost: explicit → Groq/Apify formulas → catalog flat fallback.
 * @param {ApiUsageEventInput} event
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function resolveEstimatedCostUsd(event, supabase) {
  if (event.billed === false) return 0;
  if (event.estimatedCostUsd != null && Number.isFinite(Number(event.estimatedCostUsd))) {
    return Number(event.estimatedCostUsd);
  }

  if (event.provider === "groq") {
    const hasTokens = (event.inputTokens != null && event.inputTokens > 0)
      || (event.outputTokens != null && event.outputTokens > 0);
    if (hasTokens) {
      return estimateGroqCostUsd({
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        model: event.model,
      });
    }
  }

  if (event.provider === "apify") {
    const apifyCost = estimateApifyCostUsd({
      usageTotalUsd: event.usageTotalUsd,
      computeUnits: event.computeUnits,
    });
    if (apifyCost != null) return apifyCost;
  }

  // Free / zero-cost providers when no explicit cost
  if (["openweather", "calendarific", "resend", "supabase"].includes(event.provider)) {
    return 0;
  }

  try {
    const { data: row } = await supabase
      .from("api_integrations")
      .select("estimated_cost_usd")
      .eq("id", event.provider)
      .maybeSingle();
    if (row?.estimated_cost_usd != null) {
      return Number(row.estimated_cost_usd);
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Fire-and-forget usage log (service role). Never throws to callers.
 * @param {ApiUsageEventInput} event
 */
export async function logApiUsageEvent(event) {
  const supabase = createServiceSupabase();
  if (!supabase) {
    console.warn("logApiUsageEvent: service role not configured — skip");
    return;
  }

  const billed = event.billed !== false;
  let estimatedCostUsd;
  try {
    estimatedCostUsd = await resolveEstimatedCostUsd(event, supabase);
  } catch {
    estimatedCostUsd = event.estimatedCostUsd ?? null;
  }

  const meta = {
    ...(event.meta || {}),
  };
  if (event.model) meta.model = event.model;
  if (event.computeUnits != null) meta.computeUnits = event.computeUnits;
  if (event.usageTotalUsd != null) meta.usageTotalUsd = event.usageTotalUsd;
  if (event.itemCount != null) meta.itemCount = event.itemCount;
  meta.billed = billed;

  const payload = {
    user_id: event.userId || null,
    user_email: event.userEmail || null,
    provider: event.provider,
    endpoint: event.endpoint,
    route_label: event.routeLabel || event.endpoint,
    credits_debited: event.creditsDebited ?? 0,
    tokens_debited: event.tokensDebited ?? 0,
    estimated_cost_usd: estimatedCostUsd,
    status: event.status || "success",
    error_code: event.errorCode || null,
    meta,
    input_tokens: Math.max(0, Number(event.inputTokens) || 0),
    output_tokens: Math.max(0, Number(event.outputTokens) || 0),
    model: event.model || null,
    compute_units: event.computeUnits != null && Number.isFinite(Number(event.computeUnits))
      ? Number(event.computeUnits)
      : null,
    usage_total_usd: event.usageTotalUsd != null && Number.isFinite(Number(event.usageTotalUsd))
      ? Number(event.usageTotalUsd)
      : null,
    item_count: event.itemCount != null && Number.isFinite(Number(event.itemCount))
      ? Math.floor(Number(event.itemCount))
      : null,
    billed,
  };

  const { error } = await supabase.from("api_usage_events").insert(payload);
  if (error) {
    // Soft-fail if v4 columns missing — retry without new columns
    if (/input_tokens|output_tokens|compute_units|billed|column/i.test(error.message)) {
      const legacy = {
        user_id: payload.user_id,
        user_email: payload.user_email,
        provider: payload.provider,
        endpoint: payload.endpoint,
        route_label: payload.route_label,
        credits_debited: payload.credits_debited,
        tokens_debited: payload.tokens_debited,
        estimated_cost_usd: payload.estimated_cost_usd,
        status: payload.status,
        error_code: payload.error_code,
        meta: payload.meta,
      };
      const { error: legacyErr } = await supabase.from("api_usage_events").insert(legacy);
      if (legacyErr) {
        console.warn("logApiUsageEvent insert failed:", legacyErr.message);
      } else {
        console.warn(
          "logApiUsageEvent: ran without v4 columns — execute supabase_management_usage_v4.sql",
        );
      }
      return;
    }
    console.warn("logApiUsageEvent insert failed:", error.message);
  }
}

/**
 * Log multiple provider calls for one user action (e.g. intel = serper + groq).
 * @param {ApiUsageEventInput[]} events
 */
export async function logApiUsageEvents(events) {
  await Promise.all(events.map((e) => logApiUsageEvent(e)));
}
