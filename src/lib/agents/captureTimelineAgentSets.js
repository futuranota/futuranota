import { generateId } from "../ids.js";
import { discoverScheduledAgentTasks } from "./discoverScheduledAgentTasks.js";
import { resolveContentCreatorContext } from "./resolveContentCreatorContext.js";

/**
 * @typedef {'pending' | 'running' | 'ready' | 'failed'} TimelineAgentSetStatus
 */

/**
 * @typedef {object} TimelineAgentSet
 * @property {string} id
 * @property {string} setKey
 * @property {string} objectId
 * @property {string | null} docId
 * @property {string} title
 * @property {string} triggerAt
 * @property {string} agentId
 * @property {string | null} agentCanvasNodeId
 * @property {string} macroEntityId
 * @property {string | null} macroCanvasNodeId
 * @property {string} instruction
 * @property {TimelineAgentSetStatus} status
 * @property {string | null} error
 * @property {object} contextSnapshot
 * @property {number} createdAt
 * @property {number | null} completedAt
 */

/**
 * @param {import('./scheduledAgentTaskTypes.js').ScheduledAgentTask} task
 * @param {object} deps
 * @returns {object}
 */
function buildContextSnapshot(task, deps) {
  const {
    canvasNodes = [],
    connections = [],
    nodeEntitiesById = {},
    docsById = {},
    objectsById = {},
  } = deps;

  try {
    const ctx = resolveContentCreatorContext({
      agentCanvasNodeId: task.agentCanvasNodeId,
      canvasNodes,
      connections,
      nodeEntitiesById,
      docsById,
      objectsById,
      preferredMacroEntityId: task.macroEntityId,
    });
    return {
      instruction: ctx.instruction || task.title,
      brandName: ctx.brandContext?.brand || ctx.brandContext?.name || "",
      brandContext: ctx.brandContext || null,
      knowledgeExcerpt: String(ctx.knowledgeContext || "").slice(0, 2000),
      agentId: task.agentId,
      macroTitle: ctx.macroTitle || task.title,
      capturedAt: Date.now(),
    };
  } catch {
    const entity = nodeEntitiesById[task.macroEntityId];
    return {
      instruction: String(entity?.title || task.title || "").trim(),
      brandName: "",
      brandContext: null,
      knowledgeExcerpt: "",
      agentId: task.agentId,
      macroTitle: task.title,
      capturedAt: Date.now(),
    };
  }
}

/**
 * @param {import('./scheduledAgentTaskTypes.js').ScheduledAgentTask} task
 * @param {object} deps
 * @returns {TimelineAgentSet}
 */
export function buildTimelineAgentSetFromTask(task, deps) {
  const { nodeEntitiesById = {}, docsById = {} } = deps;
  const entity = nodeEntitiesById[task.macroEntityId];
  const docId = entity?.parentDocId || null;
  const objectId = docId ? (docsById[docId]?.parentObjectId || null) : null;
  const snapshot = buildContextSnapshot(task, deps);

  return {
    id: generateId("TLSET"),
    setKey: task.taskKey,
    objectId: objectId || "",
    docId,
    title: task.title,
    triggerAt: task.runAt,
    agentId: task.agentId,
    agentCanvasNodeId: task.agentCanvasNodeId,
    macroEntityId: task.macroEntityId,
    macroCanvasNodeId: task.macroCanvasNodeId,
    instruction: snapshot.instruction || task.title,
    status: "pending",
    error: null,
    contextSnapshot: snapshot,
    createdAt: Date.now(),
    completedAt: null,
  };
}

/**
 * Discover scheduled agent tasks relevant to a timeline insert selection.
 * @param {object} params
 * @returns {import('./scheduledAgentTaskTypes.js').ScheduledAgentTask[]}
 */
export function discoverAgentSetsForTimelineInsert({
  canvasNodeIds = [],
  canvasNodes = [],
  connections = [],
  nodeEntitiesById = {},
  touchedDocIds = [],
} = {}) {
  const selection = new Set(canvasNodeIds);
  const touchedDocs = touchedDocIds instanceof Set
    ? touchedDocIds
    : new Set(touchedDocIds);

  const tasks = discoverScheduledAgentTasks({
    canvasNodes,
    connections,
    nodeEntitiesById,
  });

  return tasks.filter((task) => {
    if (selection.has(task.agentCanvasNodeId) || selection.has(task.macroCanvasNodeId)) {
      return true;
    }
    const entity = nodeEntitiesById[task.macroEntityId];
    const parentDocId = entity?.parentDocId;
    return Boolean(parentDocId && touchedDocs.has(parentDocId));
  });
}

/**
 * Upsert timeline agent sets by setKey; preserve status for completed sets.
 * @param {TimelineAgentSet[]} existing
 * @param {TimelineAgentSet[]} incoming
 * @returns {{ sets: TimelineAgentSet[], added: number }}
 */
export function mergeTimelineAgentSets(existing = [], incoming = []) {
  const byKey = new Map(existing.map((set) => [set.setKey, set]));
  let added = 0;

  for (const next of incoming) {
    const prev = byKey.get(next.setKey);
    if (!prev) {
      byKey.set(next.setKey, next);
      added += 1;
      continue;
    }
    if (prev.status === "ready" || prev.status === "running") {
      continue;
    }
    byKey.set(next.setKey, {
      ...next,
      id: prev.id,
      status: prev.status === "failed" ? "pending" : prev.status,
      createdAt: prev.createdAt,
    });
  }

  return {
    sets: [...byKey.values()].sort(
      (a, b) => new Date(a.triggerAt).getTime() - new Date(b.triggerAt).getTime(),
    ),
    added,
  };
}

/**
 * @param {object} params
 * @returns {{ sets: TimelineAgentSet[], added: number }}
 */
export function captureTimelineAgentSetsForInsert({
  canvasNodeIds = [],
  canvasNodes = [],
  connections = [],
  nodeEntitiesById = {},
  docsById = {},
  objectsById = {},
  touchedDocIds = [],
  existingSets = [],
} = {}) {
  const tasks = discoverAgentSetsForTimelineInsert({
    canvasNodeIds,
    canvasNodes,
    connections,
    nodeEntitiesById,
    touchedDocIds,
  });

  const deps = {
    canvasNodes,
    connections,
    nodeEntitiesById,
    docsById,
    objectsById,
  };

  const incoming = tasks.map((task) => buildTimelineAgentSetFromTask(task, deps));
  return mergeTimelineAgentSets(existingSets, incoming);
}
