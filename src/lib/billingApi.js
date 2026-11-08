import { supabase } from "./supabaseClient.js";
import { getStoredReferralCode } from "./referralStorage.js";

async function resolveAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (!expiresAt || expiresAt - Date.now() > 60_000) {
      return session.access_token;
    }
  }

  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  if (error) return session?.access_token ?? null;
  return refreshed?.access_token ?? session?.access_token ?? null;
}

async function authHeaders() {
  const token = await resolveAccessToken();
  if (!token) throw new Error("Not signed in");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function billingFetch(path, init = {}) {
  const headers = await authHeaders();

  const doRequest = async (requestHeaders) => fetch(path, {
    ...init,
    headers: {
      ...requestHeaders,
      ...init.headers,
    },
  });

  let res = await doRequest(headers);
  let body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (!error && session?.access_token) {
      res = await doRequest({
        ...headers,
        Authorization: `Bearer ${session.access_token}`,
      });
      body = await res.json().catch(() => ({}));
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Session expired — sign in again.");
    }
    if (res.status === 429) {
      throw new Error('Too many billing requests. Wait a few seconds and try again.');
    }
    throw new Error(body.error || `Billing request failed (${res.status})`);
  }
  return body;
}

/** Pro checkout is monthly-only. @param {"monthly"|"annual"} [_billing] @param {{ cancelReturn?: "app"|"plans" }} [opts] */
export async function startProCheckout(_billing = "monthly", opts = {}) {
  return billingFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      billing: "monthly",
      referralCode: getStoredReferralCode(),
      cancelReturn: opts.cancelReturn === "plans" ? "plans" : "app",
    }),
  });
}

/** Live production one-time Pro checkout (e.g. $0.02) — real charge, not Stripe test mode. */
export async function startProVerifyCheckout() {
  return billingFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ billing: "verify" }),
  });
}

/** @deprecated use startProVerifyCheckout */
export const startProTestCheckout = startProVerifyCheckout;

export async function fetchVerifyCheckoutAvailable() {
  for (const path of ["/api/billing/verify-checkout", "/api/billing/test-checkout"]) {
    const res = await fetch(path);
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.available) return { available: true };
  }
  return { available: false };
}

/** @deprecated use fetchVerifyCheckoutAvailable */
export const fetchTestCheckoutAvailable = fetchVerifyCheckoutAvailable;

/** Confirm paid Checkout Session and activate Pro (fallback if webhook is delayed). */
export async function confirmCheckoutSession(sessionId) {
  return billingFetch("/api/billing/confirm-checkout", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function cancelProSubscription() {
  return billingFetch("/api/billing/cancel", { method: "POST" });
}

/**
 * Permanently close the account (cancel Stripe if any, wipe user data, delete auth user).
 * @param {string} confirm Must be exactly "DELETE"
 */
export async function deleteUserAccount(confirm = "DELETE") {
  return billingFetch("/api/users/delete-account", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

export async function fetchAffiliateLink() {
  return billingFetch("/api/billing/affiliate", { method: "GET" });
}

export async function fetchReferralHistory() {
  return billingFetch("/api/billing/referral-history", { method: "GET" });
}

/** @param {string} emails */
export async function sendReferralInvites(emails) {
  return billingFetch("/api/billing/referral-invite", {
    method: "POST",
    body: JSON.stringify({ emails }),
  });
}
