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
 * @param {{ brandName: string, keyword?: string, refresh?: boolean }} params
 */
export async function fetchCampaignStudy({ brandName, keyword, refresh = false }) {
  if (refresh) {
    return authedFetch(API_ROUTES.campaignStudy, {
      method: "POST",
      body: JSON.stringify({ brandName, keyword, refresh: true }),
    });
  }
  const qs = new URLSearchParams({ brandName });
  if (keyword) qs.set("keyword", keyword);
  try {
    return await authedFetch(`${API_ROUTES.campaignStudy}?${qs}`, { method: "GET" });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * @param {{ brandName: string, keyword?: string }} params
 */
export async function refreshCampaignStudy(params) {
  return fetchCampaignStudy({ ...params, refresh: true });
}
