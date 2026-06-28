import { usePlanStore } from "../stores/planStore.js";
import { useUpgradeModalStore } from "../stores/upgradeModalStore.js";
import { FREE_LIMITS, TOKEN_COSTS, canSpendCredits } from "./planConfig.js";

/**
 * Pre-flight gate: one user credit (−1) per action.
 * @param {{ tokenCost?: number, creditCost?: number }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, code: "gate_search" | "gate_tokens" }>}
 */
export async function checkIntelCreditGate(opts = {}) {
  const creditCost = Math.max(1, Math.floor(Number(opts.creditCost) || 1));
  const tokenCost = opts.tokenCost ?? TOKEN_COSTS.searchOverview;
  const planStore = usePlanStore.getState();
  const { profile } = planStore;

  if (!canSpendCredits(profile, creditCost)) {
    if (profile.plan === "free") {
      useUpgradeModalStore.getState().show("search");
      return { ok: false, code: "gate_search" };
    }
    useUpgradeModalStore.getState().show("tokens");
    return { ok: false, code: "gate_tokens" };
  }

  if (profile.plan === "pro" && !planStore.canSpendTokens(tokenCost * creditCost)) {
    useUpgradeModalStore.getState().show("tokens");
    return { ok: false, code: "gate_tokens" };
  }

  return { ok: true };
}

export { FREE_LIMITS };
