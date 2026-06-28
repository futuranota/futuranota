import { getCreditsRemaining, getTokensCap } from "./planConfig.js";

/**
 * @param {string | null | undefined} email
 */
export function isAdminSessionEmail(email) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail && email?.toLowerCase() === adminEmail);
}

/** Full Pro token ledger (= 150 user credits). */
export function getAdminProTokenCap() {
  return getTokensCap("pro");
}

/**
 * Admin plan-testing: treat as Pro with a real 150-credit ledger (not unlimited).
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
