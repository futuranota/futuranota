/**
 * Gate for macronode Status (completed) + Source meta — approach A rollout.
 * Same default beta inbox as agent allowlists.
 */

const DEFAULT_BETA_EMAILS = ["contact.fnota@gmail.com"];

/**
 * @param {string | null | undefined} userEmail
 * @param {string[]} [extraEmails]
 */
export function canUseDocStatusMeta(userEmail, extraEmails = []) {
  const normalized = String(userEmail || "").trim().toLowerCase();
  if (!normalized) {
    // Local / anonymous sessions: allow so the surface can be tried offline.
    return Boolean(import.meta.env?.DEV);
  }
  const allow = new Set([
    ...DEFAULT_BETA_EMAILS,
    ...extraEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean),
  ]);
  return allow.has(normalized);
}
