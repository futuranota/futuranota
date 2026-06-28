import { TOKEN_COSTS } from "../planConfig.js";
import { CREDIT_TOKEN_UNIT } from "../intelModels.js";
import { AGENT_CAMPAIGN_ANALYST, AGENT_ORCHESTRATOR } from "./registry.js";

/** @typedef {{ creditCost: number, tokenCost: number, routeLabel: string, endpoint: string }} AgentRunCost */

/** @type {Record<string, AgentRunCost>} */
const AGENT_RUN_COSTS = {
  [AGENT_ORCHESTRATOR]: {
    creditCost: 1,
    tokenCost: TOKEN_COSTS.agentOrchestrator,
    routeLabel: "Agent Orchestrator",
    endpoint: "agents/orchestrator",
  },
  [AGENT_CAMPAIGN_ANALYST]: {
    creditCost: 1,
    tokenCost: TOKEN_COSTS.agentAnalyst,
    routeLabel: "Campaign Analyst",
    endpoint: "agents/analyze",
  },
};

const DEFAULT_RUN_COST = AGENT_RUN_COSTS[AGENT_ORCHESTRATOR];

/**
 * @param {string} [agentId]
 * @returns {AgentRunCost}
 */
export function getAgentRunCost(agentId) {
  return AGENT_RUN_COSTS[agentId] || DEFAULT_RUN_COST;
}

/**
 * User-facing credit count (1 credit = CREDIT_TOKEN_UNIT tokens).
 * @param {string} [agentId]
 */
export function getAgentCreditCost(agentId) {
  return getAgentRunCost(agentId).creditCost;
}

/**
 * Total tokens debited on Pro for one agent run.
 * @param {string} [agentId]
 */
export function getAgentTokenDebit(agentId) {
  const { creditCost, tokenCost } = getAgentRunCost(agentId);
  return creditCost * tokenCost;
}

export { CREDIT_TOKEN_UNIT };
