#!/usr/bin/env node
/**
 * Steps 1–6 integration verifier.
 * Usage: npm run verify:apis
 *        npm run verify:apis -- --config-only   (no paid API calls)
 */
import { runAllIntegrationProbes } from "../server/integrationsProbe.js";

const configOnly = process.argv.includes("--config-only");

const STEP_LABELS = {
  groq: "1 · Groq (LLM — campaign study, intel, admin)",
  serper: "2 · Serper (SERPAPI_KEY — intel + admin)",
  dataforseo: "3 · DataForSEO (PAA + search intent)",
  apify: "4 · Apify (social hype)",
  openweather: "5 · OpenWeather (forecast)",
  supabase: "6 · Supabase (auth, tokens, cache tables)",
};

function icon(result) {
  if (!result.configured) return "○";
  return result.ok ? "✓" : "✗";
}

async function main() {
  console.log("\nFutura Nota — API integration check\n");
  if (configOnly) {
    console.log("(config-only mode — no live API calls)\n");
  }

  const report = await runAllIntegrationProbes({ live: !configOnly });

  for (const [key, result] of Object.entries(report.steps)) {
    const label = STEP_LABELS[key] || key;
    const latency = result.latencyMs != null ? ` (${result.latencyMs}ms)` : "";
    console.log(`  ${icon(result)} ${label}`);
    console.log(`    ${result.message}${latency}\n`);
  }

  if (report.ok) {
    console.log("All integrations OK.\n");
    console.log("Dashboard routes:");
    console.log(`  campaign study → ${report.routes.campaignStudy}`);
    console.log(`  intel overview → ${report.routes.intelOverview}`);
    console.log(`  weather        → ${report.routes.weatherForecast}\n`);
    process.exit(0);
  }

  console.log("Some integrations need attention.");
  console.log("Copy .env.example → .env.local, add keys, restart npm run dev.");
  console.log("Run supabase_dashboard_apis.sql in Supabase SQL Editor if step 6 failed.\n");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
