#!/usr/bin/env node
/**
 * Seed Management panel data for Futura Nota admin account.
 * Usage: npm run seed:management
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

const PRO_TOKENS_CAP = 1_500_000;
const CREDIT_TOKEN_UNIT = 10_000;

function fail(msg) {
  console.error(`seed:management — ${msg}`);
  process.exit(1);
}

if (!ADMIN_EMAIL) fail("Set VITE_ADMIN_EMAIL or ADMIN_EMAIL in .env.local");
if (!SUPABASE_URL || !SERVICE_KEY) {
  fail(
    "Set SUPABASE_PROJECT_URL + FUTURA_SUPABASE_SERVICE_ROLE_KEY in .env.local "
    + "(Supabase → Settings → API → service_role)",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAdminUserId() {
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) fail(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }
  fail(`No auth user found for ${ADMIN_EMAIL}`);
}

function computeUsedCredits(profile) {
  const plan = profile.plan === "pro" ? "pro" : "free";
  if (plan === "free") {
    return Math.min(10, Math.max(0, profile.search_count ?? 0));
  }
  const balance = profile.tokens_balance ?? PRO_TOKENS_CAP;
  const spent = Math.max(0, PRO_TOKENS_CAP - balance);
  return Math.min(150, Math.floor(spent / CREDIT_TOKEN_UNIT));
}

async function main() {
  console.log("seed:management — Futura Nota admin seed");

  const { error: allowErr } = await supabase
    .from("admin_allowlist")
    .upsert({ email: ADMIN_EMAIL }, { onConflict: "email" });
  if (allowErr) {
    if (allowErr.message.includes("admin_allowlist")) {
      fail("Run supabase_management.sql first (admin_allowlist + RPC)");
    }
    fail(allowErr.message);
  }
  console.log(`  admin_allowlist: ${ADMIN_EMAIL}`);

  const user = await findAdminUserId();
  console.log(`  Admin: ${user.email} (${user.id})`);

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileErr) fail(profileErr.message);
  if (!profile) fail("profiles row missing for admin user");

  const usedCredits = computeUsedCredits(profile);
  console.log(`  Profile plan=${profile.plan} implied credits used=${usedCredits}`);

  const { count: existingCount, error: countErr } = await supabase
    .from("api_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countErr) {
    if (countErr.message.includes("api_usage_events")) {
      fail("Run supabase_management.sql in Supabase SQL Editor first");
    }
    fail(countErr.message);
  }

  if ((existingCount ?? 0) > 0) {
    console.log(`  Skipping event seed — ${existingCount} events already exist for admin.`);
    return;
  }

  if (usedCredits <= 0) {
    console.log("  No implied usage — insert one sample event for UI smoke test.");
    const { error: sampleErr } = await supabase.from("api_usage_events").insert({
      user_id: user.id,
      user_email: user.email,
      provider: "groq",
      endpoint: "intel/overview",
      route_label: "Intel Search",
      credits_debited: 0,
      tokens_debited: 0,
      status: "success",
      meta: { query: "Futura Nota seed smoke test", source: "seed-futuranota" },
    });
    if (sampleErr) fail(sampleErr.message);
    console.log("  Inserted 1 sample event.");
    return;
  }

  const now = Date.now();
  const rows = [];
  for (let i = 0; i < usedCredits; i += 1) {
    const dayOffset = i % 7;
    const createdAt = new Date(now - dayOffset * 24 * 60 * 60 * 1000 - i * 3600 * 1000);
    rows.push({
      user_id: user.id,
      user_email: user.email,
      provider: i % 2 === 0 ? "groq" : "serper",
      endpoint: "intel/overview",
      route_label: "Intel Search",
      credits_debited: i % 2 === 0 ? 1 : 0,
      tokens_debited: profile.plan === "pro" && i % 2 === 0 ? CREDIT_TOKEN_UNIT : 0,
      status: "success",
      created_at: createdAt.toISOString(),
      meta: {
        query: `Futura Nota research query #${i + 1}`,
        source: "seed-futuranota",
      },
    });
  }

  const { error: insertErr } = await supabase.from("api_usage_events").insert(rows);
  if (insertErr) fail(insertErr.message);
  console.log(`  Inserted ${rows.length} seed events (source=seed-futuranota).`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
