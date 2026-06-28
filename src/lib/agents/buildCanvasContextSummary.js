import { getDelegatableAgentIds } from "./registry.js";
import { isOrchestratorTargetDoc } from "./resolveAgentGraph.js";
import { isKnowledgeDoc } from "../templateDoc.js";

/**
 * @param {object} node
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} objectsById
 * @param {Record<string, object>} nodeEntitiesById
 */
function summarizeCanvasNode(node, docsById, objectsById, nodeEntitiesById) {
  if (!node) return null;

  const base = {
    canvasNodeId: node.id,
    kind: node.canvasKind || node.dataType || "unknown",
    title: node.title || "",
  };

  if (node.canvasKind === "object" || node.dataType === "object") {
    const object = objectsById[node.objectId];
    return {
      ...base,
      objectId: node.objectId,
      brand: object?.brand || object?.name || "",
      name: object?.name || "",
    };
  }

  if (node.canvasKind === "document" || node.dataType === "document") {
    const docId = node.docId || node.noteId;
    const doc = docId ? docsById[docId] : null;
    return {
      ...base,
      docId,
      docTitle: doc?.title || "",
      docKind: doc?.docKind || "",
      templateKind: doc?.templateKind || null,
      campaignActive: Boolean(doc?.campaignActive),
      launchAt: doc?.launchAt || null,
      isCampaignTarget: isOrchestratorTargetDoc(doc),
      isKnowledge: doc ? isKnowledgeDoc(doc) : false,
    };
  }

  if (node.dataType === "text" || node.dataType === "checkbox") {
    const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
    const query = (entity?.sourceQuery || entity?.title || node.title || "").trim();
    return {
      ...base,
      query,
      nodeEntityId: node.noteId || null,
    };
  }

  if (node.canvasKind === "agent" || node.dataType === "agent") {
    return {
      ...base,
      agentId: node.agentId || "orchestrator",
    };
  }

  return base;
}

/**
 * Builds a JSON-safe summary for the orchestrator LLM router.
 * @param {object} params
 * @param {string} params.agentCanvasNodeId
 * @param {ReturnType<import('./resolveAgentGraph.js').resolveAgentGraph>} params.graph
 * @param {Record<string, object>} params.docsById
 * @param {Record<string, object>} params.objectsById
 * @param {Record<string, object>} [params.nodeEntitiesById]
 */
export function buildCanvasContextSummary({
  agentCanvasNodeId,
  graph,
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
}) {
  const inputSummaries = graph.inputs.map((n) => summarizeCanvasNode(n, docsById, objectsById, nodeEntitiesById));
  const userMessages = inputSummaries
    .filter((n) => n && typeof n.query === "string" && n.query.trim())
    .map((n) => n.query.trim());

  return {
    agentCanvasNodeId,
    brandName: graph.brandName || null,
    targetDocId: graph.targetDocId || null,
    targetDocTitle: graph.targetDoc?.title || null,
    hasValidTargetDoc: Boolean(graph.targetDoc && isOrchestratorTargetDoc(graph.targetDoc)),
    userQuery: graph.userQuery || "",
    userMessages,
    availableAgents: getDelegatableAgentIds(),
    inputs: inputSummaries,
    outputs: graph.outputs.map((n) => summarizeCanvasNode(n, docsById, objectsById, nodeEntitiesById)),
  };
}
