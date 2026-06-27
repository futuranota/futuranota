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
 * @param {{ includeSeed?: boolean }} [opts]
 */
export function fetchManagementOverview(opts = {}) {
  const includeSeed = opts.includeSeed !== false;
  const q = includeSeed ? "" : "?includeSeed=0";
  return authedFetch(`${API_ROUTES.managementOverview}${q}`);
}

/**
 * @param {string} id
 * @param {{ label?: string, notes?: string, enabled?: boolean, estimatedCostUsd?: number }} patch
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
