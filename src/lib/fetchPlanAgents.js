import { API_ROUTES } from "../api/routes.js";
import { supabase } from "./supabaseClient.js";

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
    const body = await res.text().catch(() => "");
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const err = new Error(parsed?.error || body.slice(0, 200) || res.statusText);
    err.status = res.status;
    err.code = parsed?.code;
    throw err;
  }
  return res.json();
}

/**
 * @param {object} params
 */
export async function fetchSalesAgent(params) {
  return authedFetch(API_ROUTES.agentSalesAgent, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * @param {object} params
 */
export async function fetchDeepResearcher(params) {
  return authedFetch(API_ROUTES.agentDeepResearcher, {
    method: "POST",
    body: JSON.stringify(params),
  });
}
