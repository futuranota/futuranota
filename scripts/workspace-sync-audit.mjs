#!/usr/bin/env node
/**
 * Workspace sync audit — cloud truth per auth user.
 * Usage: npm run audit:workspace
 */
import { createClient } from "@supabase/supabase-js";
import { WORKSPACE_FOLDERS_TABLE } from "../src/lib/workspaceVersionGate.js";

const SUPABASE_URL = (
  process.env.SUPABASE_PROJECT_URL
  || process.env.VITE_SUPABASE_URL
  || ""
).trim();

const ANON_KEY = (
  process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || ""
).trim();

const SERVICE_KEY = (
  process.env.FUTURA_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || ""
).trim();

const ADMIN_EMAIL = (
  process.env.VITE_ADMIN_EMAIL
  || process.env.ADMIN_EMAIL
  || ""
).trim().toLowerCase();

function fail(msg) {
  console.error(`audit:workspace — ${msg}`);
  process.exit(1);
}

function hostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return url || "(invalid url)";
  }
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function fetchCompanies(supabase, userId) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, updated_at, user_id")
    .eq("user_id", userId);
  if (error) throw new Error(`companies: ${error.message}`);
  return data || [];
}

async function fetchCampaigns(supabase, userId) {
  const { data, error } = await supabase
    .from(WORKSPACE_FOLDERS_TABLE)
    .select("id, name, updated_at, company_id, user_id")
    .eq("user_id", userId);
  if (error) throw new Error(`campaigns: ${error.message}`);
  return data || [];
}

async function fetchNodes(supabase, userId) {
  const { data, error } = await supabase
    .from("nodes")
    .select("id, title, updated_at, parent_doc_id, user_id")
    .eq("user_id", userId);
  if (error) throw new Error(`nodes: ${error.message}`);
  return data || [];
}

async function auditUser(supabase, user) {
  const userId = user.id;
  const email = user.email || "(no email)";
  const companies = await fetchCompanies(supabase, userId);
  const campaigns = await fetchCampaigns(supabase, userId);
  const nodes = await fetchNodes(supabase, userId);

  const companyIds = new Set(companies.map((c) => c.id));
  const campaignsLinked = campaigns.filter((c) => c.company_id && companyIds.has(c.company_id));
  const campaignsOrphanCompany = campaigns.filter(
    (c) => c.company_id && !companyIds.has(c.company_id),
  );
  const campaignsNoCompany = campaigns.filter((c) => !c.company_id);
  const nodesWithParent = nodes.filter((n) => n.parent_doc_id);
  const campaignIds = new Set(campaigns.map((c) => c.id));
  const nodesOrphanParent = nodes.filter(
    (n) => n.parent_doc_id && !campaignIds.has(n.parent_doc_id),
  );

  return {
    userId,
    email,
    createdAt: user.created_at,
    lastSignIn: user.last_sign_in_at,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      updated_at: c.updated_at,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      company_id: c.company_id,
      updated_at: c.updated_at,
    })),
    counts: {
      companies: companies.length,
      campaigns: campaigns.length,
      campaignsLinkedToCompany: campaignsLinked.length,
      campaignsOrphanCompany: campaignsOrphanCompany.length,
      campaignsNoCompany: campaignsNoCompany.length,
      nodes: nodes.length,
      nodesWithParentDoc: nodesWithParent.length,
      nodesOrphanParent: nodesOrphanParent.length,
    },
  };
}

async function main() {
  console.log("═".repeat(60));
  console.log("FUTURA NOTA — Workspace sync audit (Supabase cloud)");
  console.log("═".repeat(60));
  console.log(`Project host: ${hostFromUrl(SUPABASE_URL)}`);
  console.log(`Anon key set: ${ANON_KEY ? "yes" : "NO"}`);
  console.log(`Service key set: ${SERVICE_KEY ? "yes" : "NO"}`);
  console.log(`Admin email (env): ${ADMIN_EMAIL || "(not set)"}`);
  console.log("");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail("Set SUPABASE_PROJECT_URL + FUTURA_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users = await listAllUsers(supabase);
  console.log(`Auth users in project: ${users.length}`);
  console.log("");

  const reports = [];
  for (const user of users) {
    try {
      reports.push(await auditUser(supabase, user));
    } catch (err) {
      reports.push({
        userId: user.id,
        email: user.email,
        error: err?.message || String(err),
      });
    }
  }

  const withWorkspace = reports.filter(
    (r) => !r.error && (r.counts?.companies > 0 || r.counts?.campaigns > 0 || r.counts?.nodes > 0),
  );
  const empty = reports.filter(
    (r) => !r.error && r.counts?.companies === 0 && r.counts?.campaigns === 0 && r.counts?.nodes === 0,
  );

  console.log("── Summary ──");
  console.log(`Users with workspace rows: ${withWorkspace.length}`);
  console.log(`Users with empty workspace: ${empty.length}`);
  console.log(`Users with errors: ${reports.filter((r) => r.error).length}`);
  console.log("");

  for (const r of reports) {
    const marker = r.email?.toLowerCase() === ADMIN_EMAIL ? " [ADMIN]" : "";
    console.log("─".repeat(60));
    if (r.error) {
      console.log(`${r.email}${marker}`);
      console.log(`  user_id: ${r.userId}`);
      console.log(`  ERROR: ${r.error}`);
      continue;
    }
    console.log(`${r.email}${marker}`);
    console.log(`  user_id: ${r.userId}`);
    console.log(`  last_sign_in: ${r.lastSignIn || "—"}`);
    console.log(
      `  counts: companies=${r.counts.companies} campaigns=${r.counts.campaigns} `
      + `nodes=${r.counts.nodes}`,
    );
    if (r.counts.campaignsOrphanCompany > 0) {
      console.log(`  ⚠ campaigns with missing company_id target: ${r.counts.campaignsOrphanCompany}`);
    }
    if (r.counts.campaignsNoCompany > 0) {
      console.log(`  ⚠ campaigns without company_id: ${r.counts.campaignsNoCompany}`);
    }
    if (r.counts.nodesOrphanParent > 0) {
      console.log(`  ⚠ nodes with missing parent_doc: ${r.counts.nodesOrphanParent}`);
    }
    if (r.companies.length) {
      console.log("  companies:");
      for (const c of r.companies) {
        console.log(`    · ${c.name} (${c.id})`);
      }
    }
    if (r.campaigns.length) {
      console.log("  campaigns (folders):");
      for (const c of r.campaigns.slice(0, 30)) {
        console.log(`    · ${c.name} → company ${c.company_id || "∅"}`);
      }
      if (r.campaigns.length > 30) {
        console.log(`    … +${r.campaigns.length - 30} more`);
      }
    }
  }

  console.log("═".repeat(60));
  console.log("Local dev note: localhost and app.futuranota.com use SEPARATE");
  console.log("localStorage; both must hydrate from THIS project host above.");
  console.log("═".repeat(60));
}

main().catch((err) => fail(err?.message || err));
