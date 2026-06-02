import { resolveCanvasNodeObjectId } from "./objectColors.js";
import { resolveParentDocIdForCanvasNode } from "./timelineSelection.js";

/** @type {import('../types/timelineTactical.js').ConnectionKind} */
export const CONNECTION_KIND_INTRA_DOC = "intra-doc";
export const CONNECTION_KIND_INTRA_FAMILY_DOC = "intra-family-doc";
export const CONNECTION_KIND_INTRA_FAMILY_CHILD = "intra-family-child";
export const CONNECTION_KIND_CROSS_FAMILY_DOC = "cross-family-doc";
export const CONNECTION_KIND_CROSS_FAMILY_OTHER = "cross-family-other";
export const CONNECTION_KIND_IGNORED = "ignored-for-timeline";

function isTacticalDocumentNode(node) {
  if (!node) return false;
  return node.canvasKind === "document" || node.dataType === "document";
}

/**
 * @param {object} conn
 * @param {Map<string, object>} nodeById
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} nodeEntitiesById
 * @param {Record<string, object>} objectsById
 * @returns {import('../types/timelineTactical.js').ClassifiedConnection}
 */
export function classifyCanvasConnection(
  conn,
  nodeById,
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
) {
  const from = nodeById.get(conn.from);
  const to = nodeById.get(conn.to);
  const base = {
    id: conn.id,
    from: conn.from,
    to: conn.to,
    kind: CONNECTION_KIND_IGNORED,
    fromObjectId: null,
    toObjectId: null,
    fromDocId: null,
    toDocId: null,
  };

  if (!from || !to) return base;

  const fromObjectId = resolveCanvasNodeObjectId(from, docsById, nodeEntitiesById);
  const toObjectId = resolveCanvasNodeObjectId(to, docsById, nodeEntitiesById);
  const fromDocId = resolveParentDocIdForCanvasNode(from, nodeEntitiesById, docsById)
    || (isTacticalDocumentNode(from) ? (from.docId || from.noteId) : null);
  const toDocId = resolveParentDocIdForCanvasNode(to, nodeEntitiesById, docsById)
    || (isTacticalDocumentNode(to) ? (to.docId || to.noteId) : null);

  base.fromObjectId = fromObjectId;
  base.toObjectId = toObjectId;
  base.fromDocId = fromDocId;
  base.toDocId = toDocId;

  if (isTacticalDocumentNode(from) && isTacticalDocumentNode(to)) {
    if (fromObjectId && toObjectId) {
      base.kind = fromObjectId === toObjectId
        ? CONNECTION_KIND_INTRA_FAMILY_DOC
        : CONNECTION_KIND_CROSS_FAMILY_DOC;
    }
    return base;
  }

  if (fromDocId && toDocId && fromDocId === toDocId) {
    base.kind = CONNECTION_KIND_INTRA_DOC;
    return base;
  }

  if (fromObjectId && toObjectId) {
    if (fromObjectId === toObjectId) {
      base.kind = CONNECTION_KIND_INTRA_FAMILY_CHILD;
      return base;
    }
    base.kind = CONNECTION_KIND_CROSS_FAMILY_OTHER;
    return base;
  }

  return base;
}

/**
 * @param {object[]} connections
 * @param {object[]} canvasNodes
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} nodeEntitiesById
 * @param {Record<string, object>} objectsById
 * @returns {import('../types/timelineTactical.js').ClassifiedConnection[]}
 */
export function buildClassifiedConnections(
  connections = [],
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  return connections.map((c) => classifyCanvasConnection(
    c,
    nodeById,
    docsById,
    nodeEntitiesById,
    objectsById,
  ));
}

/**
 * Stable key for a cross-family doc↔doc pair (dedup “one wire” rule in Fase 2).
 * @param {import('../types/timelineTactical.js').ClassifiedConnection} classified
 */
export function crossFamilyDocPairKey(classified) {
  if (classified.kind !== CONNECTION_KIND_CROSS_FAMILY_DOC) return null;
  const a = classified.fromDocId || classified.from;
  const b = classified.toDocId || classified.to;
  return [a, b].sort().join("::");
}

/**
 * @param {import('../types/timelineTactical.js').ClassifiedConnection[]} classified
 */
export function indexCrossFamilyDocPairs(classified) {
  const keys = new Set();
  const byKey = new Map();
  for (const c of classified) {
    const key = crossFamilyDocPairKey(c);
    if (!key) continue;
    keys.add(key);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(c);
  }
  return { keys, byKey };
}

/**
 * @param {import('../types/timelineTactical.js').ClassifiedConnection[]} classified
 * @returns {import('../types/timelineTactical.js').ClassifiedConnection[]}
 */
export function dedupeCrossFamilyDocConnections(classified) {
  const seen = new Set();
  const out = [];
  for (const c of classified) {
    const key = crossFamilyDocPairKey(c);
    if (!key) {
      out.push(c);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Doc canvas node ids for one object family (tactical documents only).
 * @param {string} objectId
 * @param {object[]} canvasNodes
 * @param {Record<string, object>} docsById
 */
export function listDocumentCanvasNodeIdsForObject(objectId, canvasNodes, docsById) {
  if (!objectId) return [];
  return canvasNodes
    .filter((n) => {
      if (!isTacticalDocumentNode(n)) return false;
      const docId = n.docId || n.noteId;
      const doc = docId ? docsById[docId] : null;
      return doc?.parentObjectId === objectId;
    })
    .map((n) => n.id);
}

/**
 * Child canvas node ids under a parent doc.
 * @param {string} docId
 * @param {object[]} canvasNodes
 * @param {Record<string, object>} nodeEntitiesById
 */
export function listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById) {
  if (!docId) return [];
  return canvasNodes
    .filter((n) => {
      if (!n.noteId) return false;
      return nodeEntitiesById[n.noteId]?.parentDocId === docId;
    })
    .map((n) => n.id);
}
