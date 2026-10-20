#!/usr/bin/env node
/**
 * Reset desk credits + daily embed count for the founder preview account
 * (contact.fnota@gmail.com) and VITE_ADMIN_EMAIL if it is a different user.
 * Usage: npm run reset:desk
 */
import { createClient } from "@supabase/supabase-js";

const PREVIEW_EMAIL = "contact.fnota@gmail.com";
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
  console.error(`reset:desk — ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  fail("Set SUPABASE URL + service role key in .env.local");
}

const emails = [...new Set([PREVIEW_EMAIL, ADMIN_EMAIL].filter(Boolean))];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function resetUsage(userId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("prompt_desk_usage")
    .upsert({
      user_id: userId,
      tool_calls: 0,
      embed_day: null,
      embed_count: 0,
      updated_at: now,
    }, { onConflict: "user_id" });
  if (!error) return "ok";
  if (/prompt_desk_usage|schema cache/i.test(error.message || "")) {
    console.warn("  prompt_desk_usage missing — run supabase_prompt_desk_usage.sql");
    return "missing";
  }
  fail(error.message);
}

async function resetTokens(userId) {
  const now = new Date().toISOString();
  const basePatch = {
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
    .maybeSingle();

  if (error?.message?.includes("calendar_searches_count")
    || error?.message?.includes("calendar_period_start")) {
    console.warn("  calendar columns missing — run supabase_calendar_credits.sql");
    ({ data, error } = await supabase
      .from("profiles")
      .update(basePatch)
      .eq("user_id", userId)
      .select("user_id, plan, tokens_balance, search_count")
      .maybeSingle());
  }

  if (error) fail(error.message);
  return data;
}

async function main() {
  console.log("reset:desk — wiping credits + embed for:");
  for (const email of emails) {
    const userId = await findUserId(email);
    if (!userId) {
      console.warn(`  skip ${email} — no auth user`);
      continue;
    }
    const usage = await resetUsage(userId);
    const profile = await resetTokens(userId);
    console.log(`  ${email}`);
    console.log(usage === "ok"
      ? "    usage: tool_calls=0 embed_count=0"
      : "    usage: skipped (table not in project yet)");
    if (profile) {
      console.log(`    plan: ${profile.plan}`);
      console.log(`    tokens_balance: ${profile.tokens_balance}`);
    }
  }
  console.log("  Browser preview still needs /app?reset-desk=1 once (localStorage).");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
