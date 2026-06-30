import { supabase } from "./supabaseClient.js";
import { getStoredReferralCode } from "./referralStorage.js";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function billingFetch(path, init = {}) {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Billing request failed (${res.status})`);
  }
  return body;
}

/** @param {"monthly"|"annual"} billing */
export async function startProCheckout(billing = "monthly") {
  return billingFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      billing,
      referralCode: getStoredReferralCode(),
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

export async function cancelProSubscription() {
  return billingFetch("/api/billing/cancel", { method: "POST" });
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
