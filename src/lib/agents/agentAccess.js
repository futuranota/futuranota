/** @typedef {'public' | 'allowlist'} AgentAccessMode */

const DEFAULT_BETA_EMAILS = ["contact.fnota@gmail.com"];

/**
 * @param {import('./registry.js').AgentDefinition | null | undefined} agent
 * @returns {string[]}
 */
export function getAgentAllowedEmails(agent) {
  if (!agent?.allowedEmails?.length) return DEFAULT_BETA_EMAILS;
  return agent.allowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean);
}

/**
 * @param {import('./registry.js').AgentDefinition | null | undefined} agent
 * @returns {boolean}
 */
export function isAgentAllowlisted(agent) {
  return agent?.access === "allowlist";
}

/**
 * @param {string | null | undefined} userEmail
 * @param {import('./registry.js').AgentDefinition | null | undefined} agent
 */
export function canUserAccessAgent(userEmail, agent) {
  if (!agent || agent.enabled === false) return false;
  if (!isAgentAllowlisted(agent)) return true;
  const normalized = String(userEmail || "").trim().toLowerCase();
  if (!normalized) return false;
  return getAgentAllowedEmails(agent).includes(normalized);
}

/**
 * @param {string} agentId
 * @param {string | null | undefined} userEmail
 * @param {import('./registry.js').AgentDefinition | null | undefined} agent
 */
export function isAgentEnabledForUser(agentId, userEmail, agent) {
  if (!agentId || !agent) return false;
  return canUserAccessAgent(userEmail, agent);
}
