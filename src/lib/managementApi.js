import { supabase } from "./supabaseClient.js";
import { API_ROUTES } from "../api/routes.js";

async function authedFetch(url, init = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

/**
 * @param {{ includeSeed?: boolean, asOf?: string|null }} [opts]
 */
export function fetchManagementOverview(opts = {}) {
  const includeSeed = opts.includeSeed !== false;
  const params = new URLSearchParams();
  if (!includeSeed) params.set("includeSeed", "0");
  if (opts.asOf) params.set("asOf", opts.asOf);
  const q = params.toString() ? `?${params.toString()}` : "";
  return authedFetch(`${API_ROUTES.managementOverview}${q}`);
}

/**
 * @param {string} id
 * @param {{
 *   label?: string,
 *   notes?: string,
 *   enabled?: boolean,
 *   estimatedCostUsd?: number,
 *   lifecycleStatus?: 'active'|'pending',
 *   dailyFreeLimit?: number|null,
 *   metaDescription?: string,
 *   dashboardUrl?: string,
 * }} patch
 */
export function patchManagementIntegration(id, patch) {
  return authedFetch(
    `${API_ROUTES.managementIntegration}?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

/**
 * @param {{
 *   productName: string,
 *   billing: 'monthly'|'annual',
 *   amountUsd: number,
 *   startedAt: string,
 * }} body
 */
export function createManagementGasto(body) {
  return authedFetch(API_ROUTES.managementGastos, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * @param {string} id
 */
export function deleteManagementGasto(id) {
  return authedFetch(
    `${API_ROUTES.managementGastos}?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/**
 * @param {Record<string, unknown>} body
 */
export function createManagementQuota(body) {
  return authedFetch(API_ROUTES.managementQuotas, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export function patchManagementQuota(id, patch) {
  return authedFetch(
    `${API_ROUTES.managementQuotas}?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

/**
 * @param {string} id
 */
export function deleteManagementQuota(id) {
  return authedFetch(
    `${API_ROUTES.managementQuotas}?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/**
 * Toggle Feature usage Active / Inactive (pooled storage).
 * @param {string} userId
 * @param {boolean} quotaActive
 */
export function patchManagementUserQuotaActive(userId, quotaActive) {
  return authedFetch(
    `${API_ROUTES.managementUsers}?id=${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quotaActive: Boolean(quotaActive) }),
    },
  );
}
