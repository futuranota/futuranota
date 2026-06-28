/** @typedef {{ id: string, labelKey: string, descriptionKey: string, canvasTitle: string, icon: string | null, enabled?: boolean, disabledReasonKey?: string }} AgentDefinition */

export const AGENT_ORCHESTRATOR = "orchestrator";
export const AGENT_CAMPAIGN_ANALYST = "campaign-analyst";

/** @type {AgentDefinition[]} */
export const AGENTS = [
  {
    id: AGENT_ORCHESTRATOR,
    labelKey: "agents.orchestrator.name",
    descriptionKey: "agents.orchestrator.description",
    canvasTitle: "ORCHESTRATOR",
    icon: "orchestrator",
    enabled: false,
    disabledReasonKey: "agents.orchestrator.disabled",
  },
  {
    id: AGENT_CAMPAIGN_ANALYST,
    labelKey: "agents.campaignAnalyst.name",
    descriptionKey: "agents.campaignAnalyst.description",
    canvasTitle: "CAMPAIGN ANALYST",
    icon: "analyst",
    enabled: true,
  },
];

/**
 * @param {string} agentId
 * @returns {AgentDefinition | null}
 */
export function getAgentById(agentId) {
  return AGENTS.find((agent) => agent.id === agentId) || null;
}

/**
 * @param {string} agentId
 * @returns {boolean}
 */
export function isAgentEnabled(agentId) {
  const agent = getAgentById(agentId);
  return agent?.enabled !== false;
}

/**
 * @param {string} agentId
 */
export function getAgentCanvasTitle(agentId) {
  return getAgentById(agentId)?.canvasTitle || String(agentId || "agent").toUpperCase();
}

/**
 * @param {string} agentId
 * @param {(key: string) => string} t
 */
export function getAgentLabel(agentId, t) {
  const agent = getAgentById(agentId);
  return agent ? t(agent.labelKey) : agentId;
}

/** Agent ids the orchestrator may delegate to (registry source of truth). */
export function getDelegatableAgentIds() {
  return AGENTS.filter((a) => a.id !== AGENT_ORCHESTRATOR && a.enabled !== false).map((a) => a.id);
}
