import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import {
  isNodeWritingBody,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "./nodeInlineContent.js";
import { applyRetroactiveItemToWritingBlocks } from "./retroactiveLibraryNameRefs.js";

/**
 * Apply retroactive library name refs for a folder-scoped item across all child documents.
 * @param {string} folderId
 * @param {object} item
 * @returns {{ updatedNodeIds: string[] }}
 */
export function applyRetroactiveRefsToFolderDocuments(folderId, item) {
  const foldId = String(folderId || "").trim();
  if (!foldId || !item?.id) return { updatedNodeIds: [] };

  const doc = useDocsStore.getState().getDoc?.(foldId)
    ?? useDocsStore.getState().docs?.[foldId]
    ?? null;
  const nodeIds = Array.isArray(doc?.nodeIds) ? doc.nodeIds.filter(Boolean) : [];
  if (!nodeIds.length) return { updatedNodeIds: [] };

  const nodesState = useNodesStore.getState();
  /** @type {string[]} */
  const updatedNodeIds = [];

  for (const nodeId of nodeIds) {
    const node = nodesState.getNode?.(nodeId) ?? nodesState.nodes?.[nodeId] ?? null;
    if (!node || node.dataType !== "text") continue;
    if (!isNodeWritingBody(node.content) && typeof node.content !== "string") continue;

    const { blocks } = parseNodeWritingBody(node.content);
    const result = applyRetroactiveItemToWritingBlocks(blocks, item, "folder");
    if (!result.changed) continue;

    nodesState.updateNode?.(nodeId, {
      content: serializeNodeWritingBody({ blocks: result.blocks }),
    });
    updatedNodeIds.push(nodeId);
  }

  return { updatedNodeIds };
}

/**
 * Apply retroactive refs for a document-scoped item on a single node if it changed.
 * @param {string} nodeId
 * @param {object} item
 * @returns {boolean}
 */
export function applyRetroactiveRefsToDocumentNode(nodeId, item) {
  const id = String(nodeId || "").trim();
  if (!id || !item?.id) return false;

  const nodesState = useNodesStore.getState();
  const node = nodesState.getNode?.(id) ?? nodesState.nodes?.[id] ?? null;
  if (!node || node.dataType !== "text") return false;

  const { blocks } = parseNodeWritingBody(node.content);
  const result = applyRetroactiveItemToWritingBlocks(blocks, item, "document");
  if (!result.changed) return false;

  nodesState.updateNode?.(id, {
    content: serializeNodeWritingBody({ blocks: result.blocks }),
  });
  return true;
}
