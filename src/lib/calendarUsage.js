import { getCalendarSearchesCap } from "./planConfig.js";
import { usePlanStore } from "../stores/planStore.js";
import { useUpgradeModalStore } from "../stores/upgradeModalStore.js";

/**
 * @param {number} used
 * @param {string} plan
 */
export function formatCalendarSearchCounter(used, plan) {
  const cap = getCalendarSearchesCap(plan);
  const safeUsed = Math.max(0, Math.min(used, cap));
  return `${safeUsed}/${cap}`;
}

/** Free → upgrade modal; Pro → inline limit only. */
export function notifyCalendarSearchLimit() {
  if (usePlanStore.getState().isPro()) return false;
  useUpgradeModalStore.getState().show("calendar");
  return true;
}
