#!/usr/bin/env node
/**
 * Reset Pro credits for the admin account (VITE_ADMIN_EMAIL).
 * Usage: npm run reset:credits
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

const PRO_TOKENS_CAP = 2_000_000;

function fail(msg) {
  console.error(`reset:credits — ${msg}`);
  process.exit(1);
}

if (!ADMIN_EMAIL) fail("Set VITE_ADMIN_EMAIL in .env.local");
if (!SUPABASE_URL || !SERVICE_KEY) {
  fail("Set SUPABASE URL + service role key in .env.local");
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

async function main() {
  const userId = await findAdminUserId();
  const now = new Date().toISOString();

  const basePatch = {
    plan: "pro",
    tokens_balance: PRO_TOKENS_CAP,
    tokens_period_start: now,
    search_count: 0,
    calendar_used: false,
    updated_at: now,
  };

  let { data, error } = await supabase
    .from("profiles")
    .update({
      ...basePatch,
      calendar_searches_count: 0,
      calendar_period_start: now,
    })
    .eq("user_id", userId)
    .select("user_id, plan, tokens_balance, search_count")
    .single();

  if (error?.message?.includes("calendar_searches_count")
    || error?.message?.includes("calendar_period_start")) {
    console.warn("  calendar columns missing — run supabase_calendar_credits.sql");
    ({ data, error } = await supabase
      .from("profiles")
      .update(basePatch)
      .eq("user_id", userId)
      .select("user_id, plan, tokens_balance, search_count")
      .single());
  }

  if (error) fail(error.message);

  console.log("reset:credits — OK");
  console.log(`  user: ${ADMIN_EMAIL}`);
  console.log(`  plan: ${data.plan}`);
  console.log(`  tokens_balance: ${data.tokens_balance}`);
  console.log(`  search_count: ${data.search_count}`);
  console.log("  Reload /app to refresh the sidebar counter.");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
