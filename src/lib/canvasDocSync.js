import { launchDateInputFromIso } from "./docDates.js";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  isContentDoc,
  resolveLinkedProductCategories,
} from "./templateDoc.js";
import { resolveCampaignSourceNode } from "./campaignDocSource.js";

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

/** Canvas node ids whose noteId matches one of the given entity node ids. */
export function collectCanvasNodeIdsForEntityIds(canvasNodes, entityNodeIds = []) {
  const entitySet = new Set(entityNodeIds.filter(Boolean));
  const ids = new Set();
  if (!entitySet.size) return ids;
  for (const node of canvasNodes || []) {
    if (node.noteId && entitySet.has(node.noteId)) {
      ids.add(node.id);
    }
  }
  return ids;
}

/**
 * Campaign folders: launch comes from the timeline source child document only.
 * Folder.launchAt is not used.
 */
function resolveDocLaunchAt(doc, docId, draft, nodesById = {}) {
  const normalized = normalizeDoc(doc);
  if (normalized.campaignActive) {
    if (draft?.docId === docId && draft.sourceLaunchAt !== undefined) {
      return draft.sourceLaunchAt;
    }
    const source = resolveCampaignSourceNode(
      {
        ...normalized,
        timelineSourceNodeId: draft?.timelineSourceNodeId ?? normalized.timelineSourceNodeId,
      },
      nodesById,
    );
    return source?.launchAt ?? null;
  }
  if (draft?.docId === docId && draft.launchAt !== undefined) {
    return draft.launchAt;
  }
  return normalized.launchAt ?? null;
}

/** Launch date nodes are exclusive to Campaign folders (not plain Schedules). */
function resolveDocCampaignActive(doc, docId, draft) {
  if (draft?.docId === docId && draft.campaignActive !== undefined) {
    return Boolean(draft.campaignActive);
  }
  return Boolean(normalizeDoc(doc).campaignActive);
}

export function buildLaunchDateCanvasNode(launchAt, parentDocId, {
  id = null,
  sourceNodeId = null,
} = {}) {
  const dateContent = launchDateInputFromIso(launchAt);
  if (!dateContent || !parentDocId) return null;
  return {
    // Deterministic id: a remove→respawn cycle keeps the same node id, so
    // timeline references (timelineDateNodeIds) survive instead of orphaning.
    id: id || `CN-launch-${parentDocId}`,
    title: "Launch",
    dataType: "date",
    content: dateContent,
    canvasKind: "launch",
    parentDocId,
    launchAt: launchAt ?? null,
    sourceNodeId: sourceNodeId || null,
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
    && a.sourceNodeId === b.sourceNodeId
    && JSON.stringify(a.linkedProductCategories || [])
      === JSON.stringify(b.linkedProductCategories || [])
  );
}

/**
 * Keep content-doc canvas nodes and their Launch date child nodes in sync with doc store (and optional live draft).
 * @param {object[]} canvasNodes
 * @param {Record<string, object>} docs
 * @param {object} [opts]
 * @param {string|null} [opts.expandedDocId]
 * @param {object|null} [opts.activeDocMetaDraft]
 * @param {Record<string, object>} [opts.nodeEntitiesById]
 */
export function syncContentDocCanvasNodes(
  canvasNodes,
  docs,
  {
    expandedDocId = null,
    activeDocMetaDraft = null,
    nodeEntitiesById = {},
  } = {},
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
      const launchAt = resolveDocLaunchAt(doc, node.docId, draft, nodeEntitiesById);
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
      const draft = expandedDocId === node.parentDocId ? activeDocMetaDraft : null;
      // Campaigns only: a plain Schedule must never render as a Launch node.
      if (!resolveDocCampaignActive(doc, node.parentDocId, draft)) {
        changed = true;
        return null;
      }

      // Per-document launch nodes stay tied to their source entity's launchAt.
      if (node.sourceNodeId) {
        const entity = nodeEntitiesById[node.sourceNodeId];
        const launchAt = entity?.launchAt || null;
        const dateContent = launchDateInputFromIso(launchAt);
        if (!dateContent) {
          changed = true;
          return null;
        }
        // Drop Launch if the child document is no longer on the canvas.
        const sourceOnCanvas = canvasNodes.some(
          (n) => n.noteId === node.sourceNodeId && n.canvasKind !== "launch",
        );
        if (!sourceOnCanvas) {
          changed = true;
          return null;
        }
        if (node.content !== dateContent || node.launchAt !== launchAt) {
          changed = true;
          return { ...node, content: dateContent, launchAt };
        }
        return node;
      }

      // Legacy folder-level Launch (no sourceNodeId): drop — folder drag must not
      // keep a date beside the folder card.
      changed = true;
      return null;
    }

    return node;
  }).filter(Boolean);

  // Per campaign document on canvas: spawn its own Launch date type beside it.
  // Folder cards alone never spawn Launch (dates follow inserted child docs only).
  for (const node of [...next]) {
    if (!node.noteId || node.canvasKind === "launch") continue;
    const entity = nodeEntitiesById[node.noteId];
    if (!entity?.parentDocId || !entity.launchAt) continue;
    const folder = docsById[entity.parentDocId];
    if (!folder?.campaignActive) continue;

    const launchId = `CN-launch-node-${entity.id}`;
    if (next.some((n) => n.id === launchId)) continue;

    const launchNode = buildLaunchDateCanvasNode(entity.launchAt, entity.parentDocId, {
      id: launchId,
      sourceNodeId: entity.id,
    });
    if (!launchNode) continue;

    changed = true;
    next = [
      ...next,
      {
        ...launchNode,
        x: (node.x || 0) + CANVAS_DOC_CHILD_OFFSET_X,
        y: node.y || 0,
      },
    ];
  }

  return changed ? next : canvasNodes;
}
