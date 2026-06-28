import { resolveIntelCampaignBrand } from "../currentCorpus.js";
import { getDefaultCampaignSearchQuery } from "../campaignSearchStarters.js";
import {
  isContentDoc,
  isTemplateDoc,
  TEMPLATE_KIND_CAMPAIGN,
} from "../templateDoc.js";

/**
 * @param {string} nodeId
 * @param {object[]} connections
 * @param {object[]} canvasNodes
 */
function incomingNodes(nodeId, connections, canvasNodes) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const ids = connections.filter((c) => c.to === nodeId).map((c) => c.from);
  return ids.map((id) => nodeById.get(id)).filter(Boolean);
}

/**
 * @param {string} nodeId
 * @param {object[]} connections
 * @param {object[]} canvasNodes
 */
function outgoingNodes(nodeId, connections, canvasNodes) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const ids = connections.filter((c) => c.from === nodeId).map((c) => c.to);
  return ids.map((id) => nodeById.get(id)).filter(Boolean);
}

/**
 * @param {object | null | undefined} node
 */
function isObjectCanvasNode(node) {
  return Boolean(node && (node.canvasKind === "object" || node.dataType === "object"));
}

/**
 * @param {object | null | undefined} node
 * @param {Record<string, object>} docsById
 */
function resolveDocFromCanvasNode(node, docsById = {}) {
  if (!node) return null;
  const docId = node.docId || node.noteId;
  if (!docId) return null;
  return docsById[docId] || null;
}

/**
 * @param {object | null | undefined} doc
 */
export function isOrchestratorTargetDoc(doc) {
  if (!doc) return false;
  if (isContentDoc(doc)) return true;
  if (isTemplateDoc(doc) && doc.templateKind === TEMPLATE_KIND_CAMPAIGN) return true;
  return false;
}

/**
 * Default scan query for orchestrator / campaign tab, locale-aware fallback.
 * @param {string} [brandName]
 * @param {'en' | 'es'} [locale]
 */
export function resolveOrchestratorUserQuery(brandName, locale = "en") {
  const lang = locale === "es" ? "es" : "en";
  const fallback = lang === "es"
    ? (brandName ? `qué hay de nuevo en ${brandName}, lanzamientos futuros y noticias del último año` : "novedades del último año y lanzamientos futuros")
    : (brandName ? `what's new with ${brandName}, future launches and news from the past year` : "past year news and future launches");
  return getDefaultCampaignSearchQuery(brandName, () => fallback);
}

/**
 * @param {object} params
 * @param {string} params.agentCanvasNodeId
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.connections
 * @param {Record<string, object>} params.docsById
 * @param {Record<string, object>} params.objectsById
 * @param {Record<string, object>} [params.nodeEntitiesById]
 * @param {string | null} [params.selectedObjectId]
 * @param {'en' | 'es'} [params.locale]
 */
export function resolveAgentGraph({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  selectedObjectId = null,
  locale = "en",
}) {
  const inputs = incomingNodes(agentCanvasNodeId, connections, canvasNodes);
  const outputs = outgoingNodes(agentCanvasNodeId, connections, canvasNodes);

  let brandName = "";
  const objectNode = inputs.find(isObjectCanvasNode);
  if (objectNode?.objectId) {
    const object = objectsById[objectNode.objectId];
    brandName = (object?.brand || object?.name || "").trim();
  }
  if (!brandName) {
    brandName = resolveIntelCampaignBrand(objectsById, selectedObjectId);
  }

  let targetDocId = null;
  let targetDoc = null;
  for (const node of [...outputs, ...inputs]) {
    const doc = resolveDocFromCanvasNode(node, docsById);
    if (isOrchestratorTargetDoc(doc)) {
      targetDocId = doc.id;
      targetDoc = doc;
      break;
    }
  }

  const targetObjectId = targetDoc?.parentObjectId || null;

  const userQuery = resolveOrchestratorUserQuery(brandName, locale);

  return {
    brandName,
    targetDocId,
    targetObjectId,
    targetDoc,
    userQuery,
    inputs,
    outputs,
  };
}
