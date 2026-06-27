import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { isKnowledgeDoc } from "./templateDoc.js";

/**
 * Canvas node backed by a Zustand entity with no parent document.
 */
export function isOrphanEntityNode(canvasNode, nodeEntitiesById = {}) {
  if (!canvasNode?.noteId) return false;
  if (canvasNode.canvasKind === "document" || canvasNode.canvasKind === "object") return false;
  if (canvasNode.canvasKind === "launch") return false;
  if (canvasNode.dataType === "document" || canvasNode.dataType === "object") return false;
  const entity = nodeEntitiesById[canvasNode.noteId];
  if (!entity) return false;
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
 * Content docs eligible for parent assignment (excludes knowledge corpus).
 */
export function listAdoptableDocs(docs = {}) {
  const list = Array.isArray(docs) ? docs : Object.values(docs || {});
  return list.filter((doc) => doc?.id && !isKnowledgeDoc(doc));
}
