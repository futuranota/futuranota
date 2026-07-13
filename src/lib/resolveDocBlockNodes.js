import { collectNodeIdsReferencedByBlocks } from "./docNodeSync.js";

/**
 * Resolve documents (nodes) that belong to a folder/doc box.
 * Prefer block.nodeId refs (source of truth in the editor) and fall back to
 * parentDocId / doc.nodeIds when the reverse link was wiped.
 *
 * @param {import("../types/docs.js").Doc | null | undefined} doc
 * @param {Record<string, object>} nodesById
 * @returns {object[]}
 */
export function resolveNodesForDoc(doc, nodesById = {}) {
  if (!doc?.id) return [];

  const orderedIds = [];
  const seen = new Set();

  const pushId = (id) => {
    if (!id || seen.has(id) || !nodesById[id]) return;
    seen.add(id);
    orderedIds.push(id);
  };

  for (const id of collectNodeIdsReferencedByBlocks(doc.blocks)) {
    pushId(id);
  }

  if (Array.isArray(doc.nodeIds)) {
    for (const id of doc.nodeIds) pushId(id);
  }

  for (const node of Object.values(nodesById)) {
    if (node?.parentDocId === doc.id) pushId(node.id);
  }

  return orderedIds.map((id) => nodesById[id]);
}

/**
 * Build Map<docId, nodes[]> for every doc in the map.
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} nodesById
 * @returns {Map<string, object[]>}
 */
export function buildNodesByDocIdMap(docsById, nodesById = {}) {
  const map = new Map();
  for (const doc of Object.values(docsById || {})) {
    if (!doc?.id) continue;
    map.set(doc.id, resolveNodesForDoc(doc, nodesById));
  }
  return map;
}

/**
 * Repair missing parentDocId / nodeIds from block.nodeId references.
 * Returns patched { docs, nodes } when anything changed; otherwise null.
 *
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} nodesById
 * @returns {{ docs: Record<string, object>, nodes: Record<string, object> } | null}
 */
export function repairDocNodeLinks(docsById, nodesById) {
  if (!docsById || !nodesById) return null;

  let changed = false;
  const nextDocs = { ...docsById };
  const nextNodes = { ...nodesById };

  for (const doc of Object.values(docsById)) {
    if (!doc?.id) continue;
    const blockIds = [...collectNodeIdsReferencedByBlocks(doc.blocks)];
    if (!blockIds.length) continue;

    const existingNodeIds = Array.isArray(doc.nodeIds) ? doc.nodeIds.filter(Boolean) : [];
    const mergedIds = [...new Set([...existingNodeIds, ...blockIds])];
    if (mergedIds.length !== existingNodeIds.length
      || mergedIds.some((id, i) => id !== existingNodeIds[i])) {
      nextDocs[doc.id] = { ...doc, nodeIds: mergedIds };
      changed = true;
    }

    for (const nodeId of blockIds) {
      const node = nextNodes[nodeId];
      if (!node) continue;
      if (node.parentDocId !== doc.id) {
        nextNodes[nodeId] = {
          ...node,
          parentDocId: doc.id,
          linkedToDoc: true,
        };
        changed = true;
      }
    }
  }

  return changed ? { docs: nextDocs, nodes: nextNodes } : null;
}
