export const LAST_COMPANY_KEY = "fn_last_company";
export const PENDING_LIBRARY_KEY = "fn_pending_library";
export const OAUTH_MODE_KEY = "fn_oauth_mode";
/** Set after OAuth completes on a non-/app URL — router sends user to dashboard. */
export const OAUTH_RETURN_REDIRECT_KEY = "fn_oauth_return_redirect";

/** @returns {Record<string, unknown>|null} */
export function readLastCompany() {
  try {
    const raw = localStorage.getItem(LAST_COMPANY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function markPendingLibrary() {
  localStorage.setItem(PENDING_LIBRARY_KEY, "1");
}

export function clearPendingLibrary() {
  localStorage.removeItem(PENDING_LIBRARY_KEY);
}

export function hasPendingLibrary() {
  return localStorage.getItem(PENDING_LIBRARY_KEY) === "1";
}

/** Empty workspace when user skips library or signs in without a target. */
export function getBlankWorkspace() {
  return {
    id: "workspace",
    name: "My workspace",
    sector: "",
    status: "QUIET",
    campaigns: 0,
    signal: 0,
    skipped: true,
  };
}

/**
 * Library only after sign-up (pending flag). Sign-in → dashboard.
 * @param {Record<string, unknown>|null} [lastCompany]
 */
export function shouldShowLibrary(lastCompany = readLastCompany()) {
  return hasPendingLibrary() && !lastCompany;
}

/**
 * @param {Record<string, unknown>|null} [lastCompany]
 */
export function resolveInitialAppState(lastCompany = readLastCompany()) {
  if (shouldShowLibrary(lastCompany)) {
    return { screen: "selector", company: null };
  }
  if (lastCompany) {
    return { screen: "dashboard", company: lastCompany };
  }
  return { screen: "dashboard", company: getBlankWorkspace() };
}
