import { createServiceSupabase } from "../supabaseServer.js";

/**
 * @typedef {Object} ApiUsageEventInput
 * @property {string} [userId]
 * @property {string} [userEmail]
 * @property {string} provider
 * @property {string} endpoint
 * @property {string} [routeLabel]
 * @property {number} [creditsDebited]
 * @property {number} [tokensDebited]
 * @property {number|null} [estimatedCostUsd]
 * @property {'success'|'error'} [status]
 * @property {string} [errorCode]
 * @property {Record<string, unknown>} [meta]
 */

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

  let estimatedCostUsd = event.estimatedCostUsd ?? null;
  if (estimatedCostUsd == null) {
    try {
      const { data: row } = await supabase
        .from("api_integrations")
        .select("estimated_cost_usd")
        .eq("id", event.provider)
        .maybeSingle();
      if (row?.estimated_cost_usd != null) {
        estimatedCostUsd = Number(row.estimated_cost_usd);
      }
    } catch {
      /* ignore lookup failures */
    }
  }

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
    meta: event.meta || {},
  };

  const { error } = await supabase.from("api_usage_events").insert(payload);
  if (error) {
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
