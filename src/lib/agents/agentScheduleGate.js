import { anchorFieldsFromIso, formatScheduleLabel } from "../nodeAnchor.js";
import { extractAgentInstructionFromNodeEntity } from "../resolveAgentInstruction.js";
import { resolveAgentGraph } from "./resolveAgentGraph.js";

/**
 * @param {object[]} inputNodes
 * @param {Record<string, object>} nodeEntitiesById
 * @returns {string | null}
 */
function findWiredMacroScheduleAnchor(inputNodes = [], nodeEntitiesById = {}) {
  for (const node of inputNodes) {
    if (!node?.noteId) continue;
    const entity = nodeEntitiesById[node.noteId];
    if (!entity) continue;
    const instruction = extractAgentInstructionFromNodeEntity(entity);
    if (!instruction) continue;
    return entity.anchorAt || node.anchorAt || null;
  }
  return null;
}

/**
 * Schedule on a wired macro node with /agent (Content Creator macro_blog gate).
 * @param {object} params
 */
export function resolveMacroScheduleAnchorAt({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  nodeEntitiesById = {},
  preferredMacroEntityId = null,
}) {
  const graph = resolveAgentGraph({
    agentCanvasNodeId,
    canvasNodes,
    connections,
    docsById: {},
    objectsById: {},
    selectedObjectId: null,
  });
  if (preferredMacroEntityId) {
    const node = (graph.inputs || []).find((n) => n.noteId === preferredMacroEntityId);
    if (node?.noteId) {
      const entity = nodeEntitiesById[node.noteId];
      if (entity) {
        const instruction = extractAgentInstructionFromNodeEntity(entity);
        if (instruction) return entity.anchorAt || node.anchorAt || null;
      }
    }
  }
  return findWiredMacroScheduleAnchor(graph.inputs || [], nodeEntitiesById);
}

/**
 * @param {string | null | undefined} anchorAt
 */
export function isScheduleNotDue(anchorAt) {
  if (!anchorAt) return false;
  const scheduled = new Date(anchorAt);
  if (Number.isNaN(scheduled.getTime())) return false;
  return Date.now() < scheduled.getTime();
}

/**
 * @param {string | null | undefined} anchorAt
 */
export function formatScheduleAtLabel(anchorAt) {
  if (!anchorAt) return "";
  const { anchorDate, anchorTime } = anchorFieldsFromIso(anchorAt);
  return formatScheduleLabel(anchorDate, anchorTime) || anchorAt;
}
