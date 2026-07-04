import { extractAgentInstructionFromNodeEntity } from "../resolveAgentInstruction.js";
import { AGENT_CAMPAIGN_ANALYST, AGENT_CONTENT_CREATOR, AGENT_DEEP_RESEARCHER, AGENT_MARKETING_GUIDE, AGENT_SALES_AGENT, AGENT_SOCIAL_HYPE_ANALYST, isAgentEnabledForUser } from "./registry.js";
import { useAuthStore } from "../../stores/authStore.js";

const RUNNABLE_AGENT_IDS = new Set([
  AGENT_CAMPAIGN_ANALYST,
  AGENT_MARKETING_GUIDE,
  AGENT_SOCIAL_HYPE_ANALYST,
  AGENT_CONTENT_CREATOR,
  AGENT_SALES_AGENT,
  AGENT_DEEP_RESEARCHER,
]);

/**
 * @param {string} nodeId
 * @param {object[]} connections
 * @param {object[]} canvasNodes
 */
function incomingCanvasNodes(nodeId, connections, canvasNodes) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  return connections
    .filter((c) => c.to === nodeId)
    .map((c) => nodeById.get(c.from))
    .filter(Boolean);
}

/**
 * Stable id for deduplicating scheduled runs.
 * @param {string} agentCanvasNodeId
 * @param {string} macroEntityId
 * @param {string} runAtIso
 */
export function buildScheduledTaskKey(agentCanvasNodeId, macroEntityId, runAtIso) {
  return `${agentCanvasNodeId}:${macroEntityId}:${runAtIso}`;
}

/**
 * Scan canvas wiring: agent nodes ← macro nodes with /agent + anchorAt.
 * @param {object} params
 * @returns {import('./scheduledAgentTaskTypes.js').ScheduledAgentTask[]}
 */
export function discoverScheduledAgentTasks({
  canvasNodes = [],
  connections = [],
  nodeEntitiesById = {},
} = {}) {
  /** @type {import('./scheduledAgentTaskTypes.js').ScheduledAgentTask[]} */
  const tasks = [];

  for (const agentNode of canvasNodes) {
    if (agentNode.hidden) continue;
    if (agentNode.canvasKind !== "agent" && agentNode.dataType !== "agent") continue;

    const agentId = agentNode.agentId || AGENT_CAMPAIGN_ANALYST;
    if (!RUNNABLE_AGENT_IDS.has(agentId)) continue;
    const userEmail = useAuthStore.getState().user?.email;
    if (!isAgentEnabledForUser(agentId, userEmail)) continue;

    for (const macroNode of incomingCanvasNodes(agentNode.id, connections, canvasNodes)) {
      if (!macroNode?.noteId) continue;
      const entity = nodeEntitiesById[macroNode.noteId];
      if (!entity) continue;

    const instruction = extractAgentInstructionFromNodeEntity(entity)
      || String(entity.title || "").trim();
    if (!instruction) continue;

      const runAt = entity.anchorAt || macroNode.anchorAt || null;
      if (!runAt) continue;

      const scheduled = new Date(runAt);
      if (Number.isNaN(scheduled.getTime())) continue;

      tasks.push({
        taskKey: buildScheduledTaskKey(agentNode.id, macroNode.noteId, runAt),
        agentCanvasNodeId: agentNode.id,
        agentId,
        macroEntityId: macroNode.noteId,
        macroCanvasNodeId: macroNode.id,
        runAt,
        title: String(entity.title || macroNode.title || "").trim() || "Task",
      });
    }
  }

  return tasks.sort(
    (a, b) => new Date(a.runAt).getTime() - new Date(b.runAt).getTime(),
  );
}
