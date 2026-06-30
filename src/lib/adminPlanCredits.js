import { getCreditsRemaining, getTokensCap } from "./planConfig.js";

/**
 * @param {string | null | undefined} email
 */
export function isAdminSessionEmail(email) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail && email?.toLowerCase() === adminEmail);
}

/**
 * When true, admin login forces Pro and auto-refills credits below 1.
 * Default (unset / not "true"): real billing UX — plan and balance come from Supabase only.
 */
export function isAdminAutoRefillEnabled() {
  return import.meta.env.VITE_ADMIN_AUTO_REFILL === "true";
}

/** Admin gets implicit Pro on APIs/client when auto-refill bypass is on. */
export function isAdminBillingBypassEnabled() {
  return isAdminAutoRefillEnabled();
}

/** Full Pro token ledger (= 200 user credits). */
export function getAdminProTokenCap() {
  return getTokensCap("pro");
}

/**
 * Legacy auto-refill bypass: treat as Pro with a real 200-credit ledger (not unlimited).
 * @param {object} profile
 * @param {{ plan?: string, tokens_balance?: number|null, search_count?: number }} [row]
 */
export function shouldBootstrapAdminCredits(profile, row) {
  if (!row) return true;
  const balance = row.tokens_balance;
  if (balance == null || balance === undefined) return true;
  return getCreditsRemaining({
    ...profile,
    plan: "pro",
    tokensBalance: balance,
    searchCount: row.search_count ?? profile.searchCount ?? 0,
  }) < 1;
}
