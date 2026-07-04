const DEFAULT_BETA_EMAILS = ["contact.fnota@gmail.com"];

/**
 * @returns {string[]}
 */
export function getBetaAgentAllowlist() {
  const raw = process.env.AGENT_BETA_ALLOWLIST || DEFAULT_BETA_EMAILS.join(",");
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string | null | undefined} email
 */
export function isBetaAgentEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return getBetaAgentAllowlist().includes(normalized);
}
