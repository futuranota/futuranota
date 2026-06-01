import { shortId } from "../data.jsx";
import { launchDateInputFromIso } from "./docDates.js";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  isContentDoc,
  resolveLinkedProductCategories,
} from "./templateDoc.js";

export const CANVAS_DOC_CHILD_OFFSET_X = 248;

/** Document canvas node id (document card, launch child, or nodes assigned to the doc). */
export function isCanvasNodeLinkedToDoc(node, docId, nodeEntitiesById = {}) {
  if (!node || !docId) return false;
  if (node.canvasKind === "document" && (node.docId === docId || node.noteId === docId)) {
    return true;
  }
  if (node.canvasKind === "launch" && node.parentDocId === docId) {
    return true;
  }
  if (node.parentDocId === docId) {
    return true;
  }
  if (node.noteId) {
    const entity = nodeEntitiesById[node.noteId];
    if (entity?.parentDocId === docId) return true;
  }
  return false;
}

export function collectCanvasNodeIdsForDoc(canvasNodes, docId, nodeEntitiesById = {}) {
  const ids = new Set();
  for (const node of canvasNodes) {
    if (isCanvasNodeLinkedToDoc(node, docId, nodeEntitiesById)) {
      ids.add(node.id);
    }
  }
  return ids;
}

function resolveDocLaunchAt(doc, docId, draft) {
  if (draft?.docId === docId && draft.launchAt !== undefined) {
    return draft.launchAt;
  }
  return normalizeDoc(doc).launchAt ?? null;
}

export function buildLaunchDateCanvasNode(launchAt, parentDocId) {
  const dateContent = launchDateInputFromIso(launchAt);
  if (!dateContent || !parentDocId) return null;
  return {
    id: shortId("CN"),
    title: "Launch",
    dataType: "date",
    content: dateContent,
    canvasKind: "launch",
    parentDocId,
    launchAt: launchAt ?? null,
  };
}

function patchContentDocCanvasNode(node, doc, docsById, launchAt, draft = null) {
  const normalized = normalizeDoc(doc);
  const campaignActive = draft?.campaignActive !== undefined
    ? Boolean(draft.campaignActive)
    : Boolean(normalized.campaignActive);
  return {
    ...node,
    title: (normalized.title || "DOCUMENT").toUpperCase().slice(0, 20),
    content: normalized.body || normalized.content || "",
    contentCategory: normalized.category?.trim() || "",
    linkedProductCategories: resolveLinkedProductCategories(
      docsById,
      normalized.subcategoryDocIds,
    ),
    launchAt: launchAt ?? null,
    campaignActive,
  };
}

function nodesEqual(a, b) {
  return (
    a.content === b.content
    && a.launchAt === b.launchAt
    && a.title === b.title
    && a.contentCategory === b.contentCategory
    && a.campaignActive === b.campaignActive
    && JSON.stringify(a.linkedProductCategories || [])
      === JSON.stringify(b.linkedProductCategories || [])
  );
}

/**
 * Keep content-doc canvas nodes and their Launch date child nodes in sync with doc store (and optional live draft).
 */
export function syncContentDocCanvasNodes(
  canvasNodes,
  docs,
  { expandedDocId = null, activeDocMetaDraft = null } = {},
) {
  const docsById = docs || {};
  let changed = false;

  let next = canvasNodes.map((node) => {
    if (node.canvasKind === "document" && node.docId) {
      const doc = docsById[node.docId];
      if (!doc) {
        changed = true;
        return null;
      }
      if (!isContentDoc(doc)) return node;
      const draft = expandedDocId === node.docId ? activeDocMetaDraft : null;
      const launchAt = resolveDocLaunchAt(doc, node.docId, draft);
      const patched = patchContentDocCanvasNode(node, doc, docsById, launchAt, draft);
      if (!nodesEqual(node, patched)) {
        changed = true;
        return patched;
      }
      return node;
    }

    if (node.canvasKind === "launch" && node.parentDocId) {
      const doc = docsById[node.parentDocId];
      if (!doc) {
        changed = true;
        return null;
      }
      const launchAt = resolveDocLaunchAt(
        doc,
        node.parentDocId,
        expandedDocId === node.parentDocId ? activeDocMetaDraft : null,
      );
      const dateContent = launchDateInputFromIso(launchAt);
      if (!dateContent) {
        changed = true;
        return null;
      }
      if (node.content !== dateContent || node.launchAt !== launchAt) {
        changed = true;
        return { ...node, content: dateContent, launchAt };
      }
      return node;
    }

    return node;
  }).filter(Boolean);

  for (const node of next) {
    if (node.canvasKind !== "document" || !node.docId) continue;
    const doc = docsById[node.docId];
    if (!doc || !isContentDoc(doc)) continue;

    const launchAt = resolveDocLaunchAt(
      doc,
      node.docId,
      expandedDocId === node.docId ? activeDocMetaDraft : null,
    );
    const dateContent = launchDateInputFromIso(launchAt);
    if (!dateContent) continue;

    const hasLaunch = next.some(
      (n) => n.canvasKind === "launch" && n.parentDocId === node.docId,
    );
    if (hasLaunch) continue;

    const launchNode = buildLaunchDateCanvasNode(launchAt, node.docId);
    if (!launchNode) continue;

    changed = true;
    next = [
      ...next,
      {
        ...launchNode,
        x: node.x + CANVAS_DOC_CHILD_OFFSET_X,
        y: node.y,
      },
    ];
  }

  return changed ? next : canvasNodes;
}
