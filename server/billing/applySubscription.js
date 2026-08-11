import { createServiceSupabase } from "../supabaseServer.js";
import { getTokensCap } from "../../src/lib/planConfig.js";

/** Credits granted to referrer when a monthly Pro subscription is paid. */
export const REFERRAL_REWARD_CREDITS = 50;

const PRO_TOKENS = getTokensCap("pro");
const FREE_TOKENS = getTokensCap("free");

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ customerId?: string, subscriptionId?: string, billingStatus?: string }} opts
 */
export async function activateProSubscription(supabase, userId, opts = {}) {
  const now = new Date().toISOString();

  let current = null;
  {
    const withCol = await supabase
      .from("profiles")
      .select("plan, plan_upgraded_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (withCol.error && /plan_upgraded_at/i.test(withCol.error.message)) {
      const fallback = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", userId)
        .maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      current = fallback.data;
    } else if (withCol.error) {
      throw new Error(withCol.error.message);
    } else {
      current = withCol.data;
    }
  }

  const patch = {
    plan: "pro",
    tokens_balance: PRO_TOKENS,
    tokens_period_start: now,
    billing_status: opts.billingStatus || "active",
    updated_at: now,
  };
  if (opts.customerId) patch.stripe_customer_id = opts.customerId;
  if (opts.subscriptionId) patch.stripe_subscription_id = opts.subscriptionId;

  // First free → pro only. Skip renewals (already pro) and re-upgrades that already have a stamp.
  const stampUpgrade = current?.plan !== "pro" && !current?.plan_upgraded_at;
  if (stampUpgrade) {
    patch.plan_upgraded_at = now;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
  if (error && stampUpgrade && /plan_upgraded_at/i.test(error.message)) {
    delete patch.plan_upgraded_at;
    const retry = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (retry.error) throw new Error(retry.error.message);
    return;
  }
  if (error) throw new Error(error.message);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function deactivateProSubscription(supabase, userId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      plan: "free",
      billing_status: "canceled",
      stripe_subscription_id: null,
      tokens_balance: FREE_TOKENS,
      updated_at: now,
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} code
 */
export async function findAffiliateByCode(supabase, code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;

  const { data: userId, error: rpcErr } = await supabase.rpc("resolve_affiliate_code", {
    p_code: normalized,
  });
  if (!rpcErr && userId) {
    return { code: normalized, user_id: userId };
  }

  const { data, error } = await supabase
    .from("affiliates")
    .select("code, user_id")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function ensureAffiliateCode(supabase, userId) {
  const { data: existing, error: readErr } = await supabase
    .from("affiliates")
    .select("code, user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (existing?.code) return existing.code;

  const base = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  let code = base;
  let attempt = 0;
  while (attempt < 5) {
    const { data: clash } = await supabase
      .from("affiliates")
      .select("code")
      .eq("code", code)
      .maybeSingle();
    if (!clash) break;
    code = `${base.slice(0, 6)}${Math.floor(Math.random() * 90 + 10)}`;
    attempt += 1;
  }

  const { error: insertErr } = await supabase.from("affiliates").insert({
    code,
    user_id: userId,
  });
  if (insertErr) throw new Error(insertErr.message);
  return code;
}

/**
 * Grant referral reward to referrer after referred user pays monthly Pro.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ referrerUserId: string, referredUserId: string, subscriptionId?: string, billingInterval: string }} params
 */
export async function grantReferralRewardIfEligible(supabase, params) {
  const {
    referrerUserId,
    referredUserId,
    subscriptionId,
    billingInterval,
  } = params;

  if (billingInterval !== "monthly") return { granted: false, reason: "annual_excluded" };
  if (!referrerUserId || referrerUserId === referredUserId) {
    return { granted: false, reason: "self_referral" };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing) return { granted: false, reason: "already_rewarded" };

  const { data: referrerProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("referral_credits_balance")
    .eq("user_id", referrerUserId)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  if (!referrerProfile) return { granted: false, reason: "referrer_not_found" };

  const current = Number(referrerProfile.referral_credits_balance) || 0;
  const next = current + REFERRAL_REWARD_CREDITS;
  const now = new Date().toISOString();

  const { error: refErr } = await supabase.from("referrals").insert({
    referrer_user_id: referrerUserId,
    referred_user_id: referredUserId,
    stripe_subscription_id: subscriptionId || null,
    reward_credits: REFERRAL_REWARD_CREDITS,
  });
  if (refErr) throw new Error(refErr.message);

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      referral_credits_balance: next,
      updated_at: now,
    })
    .eq("user_id", referrerUserId);
  if (updateErr) throw new Error(updateErr.message);

  return { granted: true, credits: REFERRAL_REWARD_CREDITS };
}

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
export function requireServiceSupabase() {
  const supabase = createServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase service role is not configured");
  }
  return supabase;
}

/** Webhook-only — legacy alias */
export function getBillingSupabase() {
  return requireServiceSupabase();
}
