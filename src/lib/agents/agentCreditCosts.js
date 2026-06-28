import { AGENT_RUN_CREDIT_COST, TOKEN_COSTS } from "../planConfig.js";
import { CREDIT_TOKEN_UNIT } from "../intelModels.js";
import { AGENT_CAMPAIGN_ANALYST, AGENT_ORCHESTRATOR } from "./registry.js";

/** @typedef {{ creditCost: number, tokenCost: number, routeLabel: string, endpoint: string }} AgentRunCost */

const SHARED_RUN_CREDIT = AGENT_RUN_CREDIT_COST;

/** @type {Record<string, AgentRunCost>} */
const AGENT_RUN_COSTS = {
  [AGENT_ORCHESTRATOR]: {
    creditCost: SHARED_RUN_CREDIT,
    tokenCost: TOKEN_COSTS.agentOrchestrator,
    routeLabel: "Agent Orchestrator",
    endpoint: "agents/orchestrator",
  },
  [AGENT_CAMPAIGN_ANALYST]: {
    creditCost: SHARED_RUN_CREDIT,
    tokenCost: TOKEN_COSTS.agentAnalyst,
    routeLabel: "Campaign Analyst",
    endpoint: "agents/analyze",
  },
  "launch-radar": {
    creditCost: SHARED_RUN_CREDIT,
    tokenCost: TOKEN_COSTS.searchOverview,
    routeLabel: "Launch Radar",
    endpoint: "campaign-detect/radar",
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

/** @returns {AgentRunCost} */
export function getLaunchRadarRunCost() {
  return AGENT_RUN_COSTS["launch-radar"];
}

/**
 * User-facing credit count per run.
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
  return Math.round(creditCost * tokenCost);
}

export { CREDIT_TOKEN_UNIT, AGENT_RUN_CREDIT_COST };
