#!/usr/bin/env node
/**
 * TinaCloud indexes schema changes asynchronously after a git push.
 * Vercel can hit ERR_CLOUD_CHECK_FAILED if tinacms build runs before
 * indexing finishes. Retry only for that case; fail fast on missing creds.
 */
import { spawnSync } from "node:child_process";

const MAX_SCHEMA_RETRIES = 4;
const BASE_DELAY_MS = 15_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function missingTinaCredentials() {
  return !process.env.TINA_PUBLIC_CLIENT_ID || !process.env.TINA_TOKEN;
}

function runTinaBuild(extraArgs = []) {
  const result = spawnSync("npx", ["tinacms", "build", ...extraArgs], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { code: result.status ?? 1, output };
}

function classifyFailure(output) {
  if (/Missing clientId|Client not configured properly/i.test(output)) {
    return "credentials";
  }
  if (
    /ERR_CLOUD_CHECK_FAILED|doesn't match the remote GraphQL schema|schema doesn't match/i.test(output)
  ) {
    return "schema";
  }
  return "other";
}

if (missingTinaCredentials()) {
  console.error(
    "\n[tinacms-build] Missing TinaCloud credentials.\n"
    + "Set these in Vercel → Project → Settings → Environment Variables:\n"
    + "  TINA_PUBLIC_CLIENT_ID\n"
    + "  TINA_TOKEN\n"
    + "  TINA_SEARCH_TOKEN (optional but recommended)\n",
  );
  process.exit(1);
}

for (let attempt = 1; attempt <= MAX_SCHEMA_RETRIES; attempt += 1) {
  const { code, output } = runTinaBuild();
  if (code === 0) {
    process.exit(0);
  }

  const kind = classifyFailure(output);
  if (kind === "credentials") {
    process.exit(code);
  }
  if (kind !== "schema") {
    process.exit(code);
  }

  if (attempt >= MAX_SCHEMA_RETRIES) {
    break;
  }

  const delay = BASE_DELAY_MS * attempt;
  console.warn(
    `\n[tinacms-build] TinaCloud schema still indexing (attempt ${attempt}/${MAX_SCHEMA_RETRIES}). `
    + `Retrying in ${Math.round(delay / 1000)}s…\n`,
  );
  await sleep(delay);
}

console.warn(
  "\n[tinacms-build] Schema check still failing after retries. "
  + "Running once with --skip-cloud-checks (tina/tina-lock.json is the source of truth in git).\n",
);

const { code: skipCode, output: skipOutput } = runTinaBuild(["--skip-cloud-checks"]);
if (skipCode !== 0) {
  console.error(
    "\n[tinacms-build] Build failed even with --skip-cloud-checks. "
    + "Open TinaCloud → Re-index branch (main), then redeploy.\n",
  );
  if (classifyFailure(skipOutput) === "credentials") {
    console.error("[tinacms-build] Also verify TINA_PUBLIC_CLIENT_ID and TINA_TOKEN on Vercel.\n");
  }
}
process.exit(skipCode);
