import { resolveCanvasNodeObjectId } from "./objectColors.js";
import { resolveParentDocIdForCanvasNode } from "./timelineSelection.js";

/** @type {import('../types/timelineTactical.js').ConnectionKind} */
export const CONNECTION_KIND_INTRA_DOC = "intra-doc";
export const CONNECTION_KIND_INTRA_FAMILY_DOC = "intra-family-doc";
export const CONNECTION_KIND_INTRA_FAMILY_CHILD = "intra-family-child";
export const CONNECTION_KIND_CROSS_FAMILY_DOC = "cross-family-doc";
export const CONNECTION_KIND_CROSS_FAMILY_DATE = "cross-family-date";
export const CONNECTION_KIND_CROSS_FAMILY_OTHER = "cross-family-other";
export const CONNECTION_KIND_TYPE_MISMATCH = "type-mismatch";
export const CONNECTION_KIND_IGNORED = "ignored-for-timeline";

/** @typedef {'document' | 'date' | 'metric' | 'text' | 'other'} TimelineWireType */

/**
 * Tactical wire type for same-type connection rules (doc↔doc, date↔date).
 * @param {object|null|undefined} node
 * @returns {TimelineWireType}
 */
export function resolveTimelineWireType(node) {
  if (!node) return "other";
  if (node.canvasKind === "agent" || node.dataType === "agent") return "agent";
  if (isTacticalDocumentNode(node)) return "document";
  if (node.dataType === "date") return "date";
  if (node.dataType === "metric") return "metric";
  if (node.dataType === "text" || node.dataType === "checkbox") return "text";
  return "other";
}

/**
 * Cross-family links on the timeline only allow matching types.
 * @param {object} from
 * @param {object} to
 */
export function isAllowedCrossFamilyTimelineLink(from, to) {
  const a = resolveTimelineWireType(from);
  const b = resolveTimelineWireType(to);
  if (a !== b) return false;
  if (a === "text" || a === "metric" || a === "other") return false;
  return a === "document" || a === "date";
}

export function isCrossFamilyConnectionKind(kind) {
  return kind === CONNECTION_KIND_CROSS_FAMILY_DOC
    || kind === CONNECTION_KIND_CROSS_FAMILY_DATE;
}

/**
 * Stable key for one inherit wire per object pair (not per doc pair).
 * @param {string|null} objectIdA
 * @param {string|null} objectIdB
 */
export function crossFamilyObjectPairKey(objectIdA, objectIdB) {
  if (!objectIdA || !objectIdB || objectIdA === objectIdB) return null;
  return [objectIdA, objectIdB].sort().join("::obj::");
}

/**
 * @param {string} objectIdA
 * @param {string} objectIdB
 * @param {object[]} connections
 * @param {object[]} canvasNodes
 * @param {Record<string, object>} docsById
 * @param {Record<string, object>} nodeEntitiesById
 * @param {Record<string, object>} objectsById
 * @param {string|null} [excludeConnectionId]
 */
export function hasCrossFamilyLinkBetweenObjects(
  objectIdA,
  objectIdB,
  connections,
  canvasNodes,
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  excludeConnectionId = null,
) {
  const targetKey = crossFamilyObjectPairKey(objectIdA, objectIdB);
  if (!targetKey) return false;
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  for (const c of connections) {
    if (excludeConnectionId && c.id === excludeConnectionId) continue;
    const classified = classifyCanvasConnection(
      c,
      nodeById,
      docsById,
      nodeEntitiesById,
      objectsById,
    );
    if (!isCrossFamilyConnectionKind(classified.kind)) continue;
    const pairKey = crossFamilyObjectPairKey(classified.fromObjectId, classified.toObjectId);
    if (pairKey === targetKey) return true;
  }
  return false;
}

/**
 * Validate a new or rewired canvas edge (Obj-Obj rules).
 * @returns {{ ok: boolean, message?: string, classified?: import('../types/timelineTactical.js').ClassifiedConnection }}
 */
export function validateCanvasConnectionAttempt({
  fromNodeId,
  toNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  inheritObjMode = false,
  excludeConnectionId = null,
}) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const from = nodeById.get(fromNodeId);
  const to = nodeById.get(toNodeId);
  if (!from || !to) {
    return { ok: false, message: "Missing node." };
  }

  if (isAgentCanvasNode(from) || isAgentCanvasNode(to)) {
    const classified = classifyCanvasConnection(
      { id: "draft", from: fromNodeId, to: toNodeId },
      nodeById,
      docsById,
      nodeEntitiesById,
      objectsById,
    );
    return { ok: true, classified };
  }

  const classified = classifyCanvasConnection(
    { id: "draft", from: fromNodeId, to: toNodeId },
    nodeById,
    docsById,
    nodeEntitiesById,
    objectsById,
  );

  const crossFamily = Boolean(
    classified.fromObjectId
    && classified.toObjectId
    && classified.fromObjectId !== classified.toObjectId,
  );

  if (!inheritObjMode) {
    if (crossFamily) {
      return {
        ok: false,
        message: "Enable Obj-Obj to connect across object families.",
        classified,
      };
    }
    return { ok: true, classified };
  }

  if (crossFamily) {
    if (!isCrossFamilyConnectionKind(classified.kind)) {
      return {
        ok: false,
        message: "Cross-family: only Document↔Document or Date↔Date (no text, metric, or mixed types).",
        classified,
      };
    }
    if (hasCrossFamilyLinkBetweenObjects(
      classified.fromObjectId,
      classified.toObjectId,
      connections,
      canvasNodes,
      docsById,
      nodeEntitiesById,
      objectsById,
      excludeConnectionId,
    )) {
      return {
        ok: false,
        message: "Only one cross-family link is allowed between these two objects.",
        classified,
      };
    }
    return { ok: true, classified };
  }

  if (classified.kind === CONNECTION_KIND_CROSS_FAMILY_OTHER) {
    return {
      ok: false,
      message: "Cannot link child nodes (text, H1, metric) across families.",
      classified,
    };
  }

  return { ok: true, classified };
}

/**
 * @param {object} connection
 * @param {object[]} canvasNodes
 */
export function classifyConnectionRecord(
  connection,
  canvasNodes,
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  return classifyCanvasConnection(
    connection,
    nodeById,
    docsById,
    nodeEntitiesById,
    objectsById,
  );
}

/**
 * Intra-family time chains on canvas: doc → doc → date → metric (and children).
 * @param {object} from
 * @param {object} to
 */
export function isAllowedIntraFamilyTimeChainLink(from, to) {
  const a = resolveTimelineWireType(from);
  const b = resolveTimelineWireType(to);
  const allowed = new Set([
    "document:document",
    "document:date",
    "document:text",
    "date:metric",
    "date:date",
    "text:date",
    "text:text",
    "text:metric",
  ]);
  return allowed.has(`${a}:${b}`);
}

function isTacticalDocumentNode(node) {
  if (!node) return false;
  return node.canvasKind === "document" || node.dataType === "document";
}

/** @param {object | null | undefined} node */
export function isAgentCanvasNode(node) {
  return Boolean(node && (node.canvasKind === "agent" || node.dataType === "agent"));
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
    wireType: "other",
    fromObjectId: null,
    toObjectId: null,
    fromDocId: null,
    toDocId: null,
  };

  if (!from || !to) return base;

  if (isAgentCanvasNode(from) || isAgentCanvasNode(to)) {
    base.kind = CONNECTION_KIND_IGNORED;
    base.wireType = "other";
    return base;
  }

  const wireType = resolveTimelineWireType(from);
  const toWireType = resolveTimelineWireType(to);
  base.wireType = wireType === toWireType ? wireType : "other";

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
      if (fromObjectId === toObjectId) {
        base.kind = CONNECTION_KIND_INTRA_FAMILY_DOC;
      } else if (isAllowedCrossFamilyTimelineLink(from, to)) {
        base.kind = CONNECTION_KIND_CROSS_FAMILY_DOC;
      } else {
        base.kind = CONNECTION_KIND_TYPE_MISMATCH;
      }
    }
    return base;
  }

  if (from.dataType === "date" && to.dataType === "date") {
    if (fromObjectId && toObjectId) {
      if (fromObjectId === toObjectId) {
        base.kind = CONNECTION_KIND_INTRA_FAMILY_CHILD;
      } else if (isAllowedCrossFamilyTimelineLink(from, to)) {
        base.kind = CONNECTION_KIND_CROSS_FAMILY_DATE;
      } else {
        base.kind = CONNECTION_KIND_TYPE_MISMATCH;
      }
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
 * Stable key for a cross-family timeline pair (doc↔doc or date↔date), dedup “one wire”.
 * @param {import('../types/timelineTactical.js').ClassifiedConnection} classified
 */
export function crossFamilyTimelinePairKey(classified) {
  if (
    classified.kind !== CONNECTION_KIND_CROSS_FAMILY_DOC
    && classified.kind !== CONNECTION_KIND_CROSS_FAMILY_DATE
  ) {
    return null;
  }
  const a = classified.fromDocId || classified.from;
  const b = classified.toDocId || classified.to;
  const type = classified.wireType || "other";
  return `${type}::${[a, b].sort().join("::")}`;
}

/** @deprecated use crossFamilyTimelinePairKey */
export function crossFamilyDocPairKey(classified) {
  return crossFamilyTimelinePairKey(classified);
}

/**
 * @param {import('../types/timelineTactical.js').ClassifiedConnection[]} classified
 */
export function indexCrossFamilyDocPairs(classified) {
  const keys = new Set();
  const byKey = new Map();
  for (const c of classified) {
    const key = crossFamilyTimelinePairKey(c);
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
    const key = crossFamilyTimelinePairKey(c);
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
      // Folder chip itself — never a child of its own expand row.
      if (n.canvasKind === "document" || n.dataType === "document") return false;
      // Launch / date markers live on the parent rail, not in the children row.
      if (n.dataType === "date" || n.canvasKind === "launch") return false;
      if (n.parentDocId === docId) return true;
      if (!n.noteId) return false;
      return nodeEntitiesById[n.noteId]?.parentDocId === docId;
    })
    .map((n) => n.id);
}
