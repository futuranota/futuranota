import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import {
  isContentDoc,
  isKnowledgeDoc,
  isProductDoc,
  isTemplateDoc,
  listContentDocs,
  listProductDocs,
  resolveProductDocDisplayTitle,
} from "./templateDoc.js";

/**
 * Entity-backed canvas node (text, date, metric, checkbox) — not document/object/launch.
 */
export function isEntityMacroNode(canvasNode, nodeEntitiesById = {}) {
  if (!canvasNode?.noteId) return false;
  if (canvasNode.canvasKind === "document" || canvasNode.canvasKind === "object") return false;
  if (canvasNode.canvasKind === "launch") return false;
  if (canvasNode.dataType === "document" || canvasNode.dataType === "object") return false;
  return Boolean(nodeEntitiesById[canvasNode.noteId]);
}

/**
 * Canvas node backed by a Zustand entity with no parent document.
 */
export function isOrphanEntityNode(canvasNode, nodeEntitiesById = {}) {
  if (!isEntityMacroNode(canvasNode, nodeEntitiesById)) return false;
  const entity = nodeEntitiesById[canvasNode.noteId];
  return !entity.parentDocId && !entity.linkedToDoc;
}

/**
 * Resolve doc id for a canvas document node (excludes knowledge corpus).
 */
export function resolveDocumentCanvasNode(canvasNode, docsById = {}) {
  if (!canvasNode) return null;
  const isDocumentNode = canvasNode.canvasKind === "document"
    || canvasNode.dataType === "document";
  if (!isDocumentNode) return null;
  const docId = canvasNode.docId || canvasNode.noteId;
  if (!docId || !docsById[docId]) return null;
  if (isKnowledgeDoc(docsById[docId])) return null;
  return docId;
}

/**
 * Detect when a new wire connects a document node to an orphan entity node.
 * Works in both wire directions.
 * @returns {{ docId: string, orphanEntityId: string, orphanCanvasNodeId: string, docCanvasNodeId: string, docTitle: string, orphanTitle: string } | null}
 */
export function detectDocAdoptionOnConnect(
  fromNode,
  toNode,
  nodeEntitiesById = {},
  docsById = {},
) {
  if (!fromNode || !toNode) return null;

  const fromDocId = resolveDocumentCanvasNode(fromNode, docsById);
  const toDocId = resolveDocumentCanvasNode(toNode, docsById);
  const fromOrphan = isOrphanEntityNode(fromNode, nodeEntitiesById);
  const toOrphan = isOrphanEntityNode(toNode, nodeEntitiesById);

  let docId = null;
  let docCanvasNode = null;
  let orphanCanvasNode = null;

  if (fromDocId && toOrphan) {
    docId = fromDocId;
    docCanvasNode = fromNode;
    orphanCanvasNode = toNode;
  } else if (toDocId && fromOrphan) {
    docId = toDocId;
    docCanvasNode = toNode;
    orphanCanvasNode = fromNode;
  }

  if (!docId || !orphanCanvasNode?.noteId) return null;

  const doc = docsById[docId];
  const entity = nodeEntitiesById[orphanCanvasNode.noteId];
  const docTitle = (doc?.title || "Untitled").trim();
  const orphanTitle = (entity?.sourceQuery || entity?.title || orphanCanvasNode.title || "Untitled").trim();

  return {
    docId,
    orphanEntityId: orphanCanvasNode.noteId,
    orphanCanvasNodeId: orphanCanvasNode.id,
    docCanvasNodeId: docCanvasNode.id,
    docTitle,
    orphanTitle,
  };
}

/**
 * Assign an orphan entity node to a document and sync its content into doc blocks.
 */
export function adoptOrphanNodeToDocument({
  nodeEntityId,
  docId,
  canvasNodeId = null,
  patchCanvasNode = null,
}) {
  if (!nodeEntityId || !docId) return false;
  if (!isValidParentDoc(docId, useDocsStore.getState().docs)) return false;

  const nodesStore = useNodesStore.getState();
  const docsStore = useDocsStore.getState();
  const node = nodesStore.getNode(nodeEntityId);
  if (!node) return false;

  docsStore.addNodeToDoc(docId, nodeEntityId);
  nodesStore.updateNode(nodeEntityId, {
    parentDocId: docId,
    linkedToDoc: true,
  });
  nodesStore.syncNodeToParentDoc(nodeEntityId, docId);

  if (canvasNodeId && patchCanvasNode) {
    patchCanvasNode(canvasNodeId, { parentDocId: docId });
  }

  return true;
}

/**
 * Orphan entity nodes currently placed on the canvas.
 */
export function listOrphanEntityCanvasNodes(canvasNodes = [], nodeEntitiesById = {}) {
  return canvasNodes.filter((n) => isOrphanEntityNode(n, nodeEntitiesById));
}

/**
 * Assign, change, or clear the parent document for an entity node.
 */
export function setEntityNodeParentDocument({
  nodeEntityId,
  docId = null,
  canvasNodeId = null,
  patchCanvasNode = null,
}) {
  const nodesStore = useNodesStore.getState();
  const docsStore = useDocsStore.getState();
  const node = nodesStore.getNode(nodeEntityId);
  if (!node) return false;

  const prevParent = node.parentDocId || null;
  const nextParent = docId || null;

  if (prevParent === nextParent) return true;

  if (prevParent) {
    nodesStore.removeNodeSyncFromDoc(nodeEntityId, prevParent);
    docsStore.removeNodeFromDoc(prevParent, nodeEntityId);
    nodesStore.updateNode(nodeEntityId, {
      parentDocId: null,
      linkedToDoc: false,
      sourceBlockId: undefined,
      sourceTextBlockId: undefined,
    });
    if (canvasNodeId && patchCanvasNode) {
      patchCanvasNode(canvasNodeId, { parentDocId: null });
    }
  }

  if (!nextParent) return true;

  if (!isValidParentDoc(nextParent, docsStore.docs)) return false;

  return adoptOrphanNodeToDocument({
    nodeEntityId,
    docId: nextParent,
    canvasNodeId,
    patchCanvasNode,
  });
}

/**
 * True when doc exists in store and can be assigned as a node parent.
 */
export function isValidParentDoc(docId, docsById = {}) {
  if (!docId) return false;
  const doc = docsById[docId];
  return Boolean(doc?.id) && !isKnowledgeDoc(doc);
}

/**
 * Resolve parent doc id only if the document still exists.
 */
export function resolveNodeParentDocId(entity, canvasNode, docsById = {}, options = {}) {
  const candidate = entity?.parentDocId || canvasNode?.parentDocId || null;
  if (!isValidParentDoc(candidate, docsById)) return "";
  const { parentObjectId } = options;
  if (!parentObjectId) return candidate;
  const adoptableIds = new Set(
    listAdoptableDocs(docsById, { parentObjectId }).map((doc) => doc.id),
  );
  return adoptableIds.has(candidate) ? candidate : "";
}

/** Product/content docs under a company object — eligible node parent targets. */
export function isCompanyParentDoc(doc, parentObjectId) {
  if (!doc?.id || !parentObjectId) return false;
  if (doc.parentObjectId !== parentObjectId) return false;
  if (isKnowledgeDoc(doc) || isTemplateDoc(doc)) return false;
  return isContentDoc(doc) || isProductDoc(doc);
}

export function resolveAdoptableDocLabel(doc) {
  if (!doc) return "Untitled";
  if (isProductDoc(doc)) return resolveProductDocDisplayTitle(doc);
  return doc.title?.trim() || "Untitled";
}

/**
 * Company-scoped product/content docs eligible for parent assignment.
 */
export function listAdoptableDocs(docs = {}, { parentObjectId } = {}) {
  const byId = Array.isArray(docs)
    ? Object.fromEntries(docs.filter((d) => d?.id).map((d) => [d.id, d]))
    : docs || {};
  if (!parentObjectId) return [];

  const seen = new Set();
  const merged = [];
  for (const doc of [
    ...listContentDocs(byId, parentObjectId),
    ...listProductDocs(byId, parentObjectId),
  ]) {
    if (!doc?.id || seen.has(doc.id)) continue;
    seen.add(doc.id);
    merged.push(doc);
  }

  return merged.sort((a, b) =>
    resolveAdoptableDocLabel(a).localeCompare(resolveAdoptableDocLabel(b)),
  );
}

/**
 * Clear parentDocId on nodes whose document no longer exists.
 * @returns {string[]} node entity ids that were released
 */
export function releaseStaleNodeParentRefs(docsById = {}) {
  const nodesStore = useNodesStore.getState();
  const released = [];
  for (const node of nodesStore.getAllNodes()) {
    if (!node.parentDocId) continue;
    if (isValidParentDoc(node.parentDocId, docsById)) continue;
    nodesStore.updateNode(node.id, {
      parentDocId: null,
      linkedToDoc: false,
      sourceBlockId: undefined,
      sourceTextBlockId: undefined,
    });
    released.push(node.id);
  }
  return released;
}
