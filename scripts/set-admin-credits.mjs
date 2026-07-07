#!/usr/bin/env node
/**
 * Set Pro credits for the admin account (VITE_ADMIN_EMAIL) to a specific value.
 *
 * Read-only:   node scripts/set-admin-credits.mjs
 * Set to N:    node scripts/set-admin-credits.mjs 176
 *
 * Credits ↔ tokens: 1 credit = 10,000 tokens. Pro cap = 200 credits (2,000,000 tokens).
 */
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = (
  process.env.VITE_ADMIN_EMAIL
  || process.env.ADMIN_EMAIL
  || ""
).trim().toLowerCase();

const SUPABASE_URL = (
  process.env.SUPABASE_PROJECT_URL
  || process.env.VITE_SUPABASE_URL
  || ""
).trim();

const SERVICE_KEY = (
  process.env.FUTURA_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || ""
).trim();

const CREDIT_TOKEN_UNIT = 10_000;
const PRO_CREDITS_CAP = 200;
const PRO_TOKENS_CAP = PRO_CREDITS_CAP * CREDIT_TOKEN_UNIT; // 2,000,000

function fail(msg) {
  console.error(`set-admin-credits — ${msg}`);
  process.exit(1);
}

if (!ADMIN_EMAIL) fail("Set VITE_ADMIN_EMAIL in .env.local");
if (!SUPABASE_URL || !SERVICE_KEY) fail("Set SUPABASE URL + service role key in .env.local");

const targetArg = process.argv[2];
const targetCredits = targetArg == null ? null : Number(targetArg);
if (targetArg != null && (!Number.isFinite(targetCredits) || targetCredits < 0 || targetCredits > PRO_CREDITS_CAP)) {
  fail(`Target credits must be a number between 0 and ${PRO_CREDITS_CAP}`);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAdminUserId() {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (match) return match.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  fail(`No auth user for ${ADMIN_EMAIL}`);
}

function creditsFromRow(row) {
  const balance = Number(row.tokens_balance ?? PRO_TOKENS_CAP);
  const spent = Math.max(0, PRO_TOKENS_CAP - balance);
  const main = Math.max(0, PRO_CREDITS_CAP - spent / CREDIT_TOKEN_UNIT);
  const referral = Math.max(0, Number(row.referral_credits_balance ?? 0));
  return Math.round((main + referral) * 10) / 10;
}

async function main() {
  const userId = await findAdminUserId();

  const { data: current, error: readErr } = await supabase
    .from("profiles")
    .select("user_id, plan, tokens_balance, search_count, referral_credits_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) fail(readErr.message);
  if (!current) fail(`No profile row for ${ADMIN_EMAIL}`);

  console.log("Current profile:");
  console.log(`  email:                    ${ADMIN_EMAIL}`);
  console.log(`  plan:                     ${current.plan}`);
  console.log(`  tokens_balance:           ${current.tokens_balance}`);
  console.log(`  search_count:             ${current.search_count}`);
  console.log(`  referral_credits_balance: ${current.referral_credits_balance ?? 0}`);
  console.log(`  → displayed credits:      ${creditsFromRow(current)}`);

  if (targetArg == null) {
    console.log("\nRead-only run. Pass a number to set credits, e.g. `node scripts/set-admin-credits.mjs 176`.");
    return;
  }

  const now = new Date().toISOString();
  const targetTokens = PRO_TOKENS_CAP - Math.round((PRO_CREDITS_CAP - targetCredits) * CREDIT_TOKEN_UNIT);

  const { data: updated, error: updErr } = await supabase
    .from("profiles")
    .update({
      plan: "pro",
      tokens_balance: targetTokens,
      tokens_period_start: now,
      referral_credits_balance: 0,
      updated_at: now,
    })
    .eq("user_id", userId)
    .select("user_id, plan, tokens_balance, tokens_period_start, search_count, referral_credits_balance")
    .single();
  if (updErr) fail(updErr.message);

  console.log(`\nUpdated profile → target ${targetCredits} credits:`);
  console.log(`  tokens_balance:           ${updated.tokens_balance}`);
  console.log(`  tokens_period_start:      ${updated.tokens_period_start}`);
  console.log(`  referral_credits_balance: ${updated.referral_credits_balance ?? 0}`);
  console.log(`  → displayed credits:      ${creditsFromRow(updated)}`);
  console.log("\nReload /app to refresh the sidebar counter.");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
