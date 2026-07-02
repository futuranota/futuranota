import { agentAvatarSrc } from "./agentAvatar.js";

/** @typedef {{ id: string, labelKey: string, descriptionKey: string, canvasTitle: string, icon: string | null, avatarImage?: string | null, avatarKind?: 'illustration' | 'brand-icon', runUxMinMs?: number, enabled?: boolean, disabledReasonKey?: string }} AgentDefinition */

export const AGENT_ORCHESTRATOR = "orchestrator";
export const AGENT_CAMPAIGN_ANALYST = "campaign-analyst";
export const AGENT_MARKETING_GUIDE = "marketing-guide";
export const AGENT_SOCIAL_HYPE_ANALYST = "social-hype-analyst";
export const AGENT_CONTENT_CREATOR = "content-creator";

/** @type {AgentDefinition[]} */
export const AGENTS = [
  {
    id: AGENT_ORCHESTRATOR,
    labelKey: "agents.orchestrator.name",
    descriptionKey: "agents.orchestrator.description",
    canvasTitle: "ORCHESTRATOR",
    icon: "orchestrator",
    avatarImage: agentAvatarSrc("router.svg"),
    enabled: false,
    disabledReasonKey: "agents.orchestrator.disabled",
  },
  {
    id: AGENT_CAMPAIGN_ANALYST,
    labelKey: "agents.campaignAnalyst.name",
    descriptionKey: "agents.campaignAnalyst.description",
    canvasTitle: "CAMPAIGN ANALYST",
    icon: "analyst",
    avatarImage: agentAvatarSrc("analyst.svg"),
    enabled: true,
  },
  {
    id: AGENT_MARKETING_GUIDE,
    labelKey: "agents.marketingGuide.name",
    descriptionKey: "agents.marketingGuide.description",
    canvasTitle: "MARKETING GUIDE",
    icon: "analyst",
    avatarImage: agentAvatarSrc("branding.svg"),
    avatarKind: "brand-icon",
    enabled: true,
  },
  {
    id: AGENT_SOCIAL_HYPE_ANALYST,
    labelKey: "agents.socialHypeAnalyst.name",
    descriptionKey: "agents.socialHypeAnalyst.description",
    canvasTitle: "SOCIAL HYPE",
    icon: "analyst",
    avatarImage: agentAvatarSrc("dash.svg"),
    enabled: true,
  },
  {
    id: AGENT_CONTENT_CREATOR,
    labelKey: "agents.contentCreator.name",
    descriptionKey: "agents.contentCreator.description",
    canvasTitle: "CONTENT CREATOR",
    icon: "analyst",
    avatarImage: agentAvatarSrc("content-writer.svg"),
    runUxMinMs: 18000,
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
