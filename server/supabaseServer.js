import { createClient } from "@supabase/supabase-js";

const TOKEN_COSTS = {
  campaignLive: 10_000,
  searchOverview: 1_000,
};

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_PROJECT_URL
    || process.env.VITE_SUPABASE_URL
    || ""
  ).trim();
}

function getSupabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || ""
  ).trim();
}

/**
 * @param {string} accessToken
 */
export function createAuthedSupabase(accessToken) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase server env missing (SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY)");
  }
  return createClient(url, key, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

/**
 * @param {import('http').IncomingMessage} req
 */
export function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * @param {import('http').IncomingMessage} req
 */
export async function getAuthedUser(req) {
  const token = readBearerToken(req);
  if (!token) return { user: null, supabase: null, token: null };
  const supabase = createAuthedSupabase(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, supabase: null, token: null };
  }
  return { user: data.user, supabase, token };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function loadUserProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} brandName
 */
export async function loadCampaignStudy(supabase, userId, brandName) {
  const { data, error } = await supabase
    .from("campaign_studies")
    .select("*")
    .eq("user_id", userId)
    .eq("brand_name", brandName)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {Object} params.row
 */
export async function upsertCampaignStudy({ supabase, userId, row }) {
  const payload = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    live_run_at: new Date().toISOString(),
    ...row,
  };
  const { data, error } = await supabase
    .from("campaign_studies")
    .upsert(payload, { onConflict: "user_id,brand_name" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Debit tokens after successful live pipeline. Returns new balance.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} profile
 * @param {number} amount
 */
export async function debitTokens(supabase, profile, amount = TOKEN_COSTS.campaignLive) {
  const plan = profile.plan === "pro" ? "pro" : "free";
  if (plan === "free" && profile.campaign_live_used) {
    throw new Error("Free plan: campaign live already used");
  }
  const balance = profile.tokens_balance ?? 0;
  if (balance < amount) {
    throw new Error("Insufficient tokens");
  }
  const next = balance - amount;
  const patch = {
    tokens_balance: next,
    updated_at: new Date().toISOString(),
  };
  if (plan === "free") patch.campaign_live_used = true;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", profile.user_id)
    .select("tokens_balance, campaign_live_used")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export function studyRowToResponse(row, { fromCache = false, tokensDebited = 0 } = {}) {
  return {
    brandName: row.brand_name,
    campaignActive: row.campaign_active,
    status: row.campaign_status,
    overview: row.overview || "",
    note: row.note || "",
    peopleAlsoAsk: row.people_also_ask || [],
    socialHype: row.social_hype || {},
    searchIntent: row.search_intent || [],
    source: row.source || "",
    fromCache,
    tokensDebited,
    liveRunAt: row.live_run_at,
  };
}
