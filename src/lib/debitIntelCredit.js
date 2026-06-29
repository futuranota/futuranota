import { supabase } from "./supabaseClient.js";
import { API_ROUTES } from "../api/routes.js";
import { usePlanStore } from "../stores/planStore.js";
import { TOKEN_COSTS } from "./planConfig.js";
import { CREDIT_TOKEN_UNIT } from "./intelModels.js";
import { creditsToTokens } from "./planConfig.js";

/**
 * @typedef {Object} DebitIntelCreditOptions
 * @property {number} [creditCost]
 * @property {number} [tokenCost]
 * @property {string} [routeLabel]
 * @property {string} [endpoint]
 * @property {Record<string, unknown>} [meta]
 */

async function logClientApiUsage({
  routeLabel,
  endpoint,
  creditsDebited = 0,
  tokensDebited = 0,
  meta = {},
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(API_ROUTES.usageLog, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        routeLabel,
        endpoint,
        creditsDebited,
        tokensDebited,
        meta,
      }),
    });
  } catch {
    /* non-blocking */
  }
}

/**
 * −1 user credit per successful call (200 → 199 → …). Same ledger as Intel search.
 * @param {DebitIntelCreditOptions} [opts]
 * @returns {Promise<{ ok: boolean, creditsDebited: number }>}
 */
export async function debitIntelCredit(opts = {}) {
  const creditCost = Math.max(0.01, Number(opts.creditCost ?? 1));
  const tokenCost = opts.tokenCost ?? TOKEN_COSTS.searchOverview;
  const routeLabel = opts.routeLabel ?? "Intel Search";
  const endpoint = opts.endpoint ?? "intel/overview";
  const meta = opts.meta ?? {};

  const planStore = usePlanStore.getState();
  const { profile } = planStore;
  const isPro = profile.plan === "pro";
  const totalTokens = creditsToTokens(creditCost);

  const ok = await planStore.debitCredits(creditCost, { tokenCost });
  if (!ok) return { ok: false, creditsDebited: 0 };

  void logClientApiUsage({
    routeLabel,
    endpoint,
    creditsDebited: creditCost,
    tokensDebited: isPro ? totalTokens : 0,
    meta,
  });

  return { ok: true, creditsDebited: creditCost };
}

export { CREDIT_TOKEN_UNIT, TOKEN_COSTS };
