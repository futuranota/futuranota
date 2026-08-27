import {
  fillMoodboardWeatherSlot,
  findMoodboardWeatherTarget,
  moodboardHasWeatherPayload,
  normalizeMoodboardWeatherPayload,
} from "./docBlocks.js";
import { parseNodeWritingBody, serializeNodeWritingBody } from "./nodeInlineContent.js";

/**
 * @typedef {{ scope: "node", target: object, nodeId: string, parentDocId: string|null, docTitle: string }}
 *   | {{ scope: "doc", target: object, nodeId: string, parentDocId: string, docTitle: string }}
 *   MoodboardWeatherFillPlan
 */

/**
 * Locate a waiting weather placeholder on the active macronode (body first, folder doc fallback).
 * @param {object|null|undefined} activeNode
 * @param {object|null|undefined} parentDoc
 * @returns {MoodboardWeatherFillPlan|null}
 */
export function resolveMoodboardWeatherFillPlan(activeNode, parentDoc) {
  if (!activeNode?.id) return null;

  const docTitle = String(
    parentDoc?.title || activeNode.title || activeNode.sourceQuery || "document",
  ).trim() || "document";
  const nodeBlocks = parseNodeWritingBody(activeNode.content).blocks;
  const nodeTarget = findMoodboardWeatherTarget(nodeBlocks);
  if (nodeTarget) {
    return {
      scope: "node",
      target: nodeTarget,
      nodeId: String(activeNode.id),
      parentDocId: activeNode.parentDocId || null,
      docTitle,
    };
  }

  const parentDocId = activeNode.parentDocId || parentDoc?.id || null;
  if (!parentDocId) return null;
  const docBlocks = Array.isArray(parentDoc?.blocks) ? parentDoc.blocks : [];
  const docTarget = findMoodboardWeatherTarget(docBlocks);
  if (!docTarget) return null;

  return {
    scope: "doc",
    target: docTarget,
    nodeId: String(activeNode.id),
    parentDocId: String(parentDocId),
    docTitle,
  };
}

/**
 * Apply forecast payload into a moodboard weather slot (node writing body or folder doc blocks).
 * @param {MoodboardWeatherFillPlan} plan
 * @param {object} payload
 * @param {{
 *   getNode: (id: string) => object|null|undefined,
 *   updateNode: (id: string, patch: object) => void,
 *   syncNodeToParentDoc?: (nodeId: string, parentDocId: string) => void,
 *   getDoc: (id: string) => object|null|undefined,
 *   updateDoc: (id: string, patch: object) => void,
 * }} api
 * @returns {boolean}
 */
export function applyMoodboardWeatherFill(plan, payload, api) {
  const normalized = normalizeMoodboardWeatherPayload(payload);
  if (!plan || !normalized) return false;

  if (plan.scope === "node") {
    const node = api.getNode(plan.nodeId);
    if (!node) return false;
    const nodeBlocks = parseNodeWritingBody(node.content).blocks;
    if (moodboardHasWeatherPayload(nodeBlocks, normalized)) return true;
    const nextNodeBlocks = fillMoodboardWeatherSlot(nodeBlocks, plan.target, normalized);
    if (!nextNodeBlocks) return false;
    const nextContent = serializeNodeWritingBody({ blocks: nextNodeBlocks });
    api.updateNode(plan.nodeId, { content: nextContent });
    if (plan.parentDocId && api.syncNodeToParentDoc) {
      api.syncNodeToParentDoc(plan.nodeId, plan.parentDocId);
    }
    return true;
  }

  if (plan.scope === "doc" && plan.parentDocId) {
    const parentDoc = api.getDoc(plan.parentDocId);
    const docBlocks = Array.isArray(parentDoc?.blocks) ? parentDoc.blocks : [];
    if (moodboardHasWeatherPayload(docBlocks, normalized)) return true;
    const nextBlocks = fillMoodboardWeatherSlot(docBlocks, plan.target, normalized);
    if (!nextBlocks) return false;
    api.updateDoc(plan.parentDocId, { blocks: nextBlocks });
    return true;
  }

  return false;
}
