import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import {
  STORAGE_KEY,
  TOMBSTONE_LEDGER_KEY,
  flushPersistenceSync,
  isDocMarkedDeletedForSync,
  isNodeMarkedDeletedForSync,
  unmarkNodeDeletedForSync,
} from "../stores/middleware/persistenceMiddleware.js";
import { resolveAdoptableDocLabel } from "./nodeParentAdoption.js";
import { resolveProductDocDisplayTitle } from "./templateDoc.js";

function readJsonStorage(key) {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeQuery(query) {
  return String(query || "").trim().toLowerCase();
}

function matchesLabel(label, query) {
  const q = normalizeQuery(query);
  if (!q) return false;
  const normalized = normalizeQuery(label);
  return normalized.includes(q) || normalized === q;
}

function folderLabels(doc) {
  return [
    resolveAdoptableDocLabel(doc),
    resolveProductDocDisplayTitle(doc),
    doc?.title,
    doc?.category,
  ].filter(Boolean);
}

function nodeLabels(node) {
  return [node?.title, node?.sourceQuery].filter(Boolean);
}

/** Search live folders/docs by title, category, or product label. */
export function findFoldersByQuery(query) {
  const docs = useDocsStore.getState().docs || {};
  return Object.values(docs)
    .filter((doc) => folderLabels(doc).some((label) => matchesLabel(label, query)))
    .map((doc) => ({
      id: doc.id,
      label: resolveAdoptableDocLabel(doc),
      tombstoned: isDocMarkedDeletedForSync(doc.id),
      departmentId: doc.departmentId || null,
      parentObjectId: doc.parentObjectId || null,
    }));
}

/** Search live document entities (nodes) by title/sourceQuery. */
export function findNodesByQuery(query) {
  const nodes = useNodesStore.getState().nodes || {};
  return Object.values(nodes)
    .filter((node) => nodeLabels(node).some((label) => matchesLabel(label, query)))
    .map((node) => ({
      id: node.id,
      label: (node.sourceQuery || node.title || "Untitled").trim(),
      parentDocId: node.parentDocId || null,
      tombstoned: isNodeMarkedDeletedForSync(node.id),
    }));
}

/** Search localStorage snapshot + tombstone ledger for deleted nodes. */
export function findRecoverableNodesByQuery(query) {
  const snapshot = readJsonStorage(STORAGE_KEY);
  const ledger = readJsonStorage(TOMBSTONE_LEDGER_KEY);
  const snapshotNodes = snapshot?.nodes && typeof snapshot.nodes === "object"
    ? snapshot.nodes
    : {};
  const tombstonedIds = new Set(
    Array.isArray(ledger?.nodes) ? ledger.nodes.filter(Boolean) : [],
  );
  const liveIds = new Set(Object.keys(useNodesStore.getState().nodes || {}));

  const hits = [];
  for (const node of Object.values(snapshotNodes)) {
    if (!node?.id) continue;
    if (!nodeLabels(node).some((label) => matchesLabel(label, query))) continue;
    hits.push({
      id: node.id,
      label: (node.sourceQuery || node.title || "Untitled").trim(),
      parentDocId: node.parentDocId || null,
      inLiveStore: liveIds.has(node.id),
      inTombstoneLedger: tombstonedIds.has(node.id),
      recoverable: !liveIds.has(node.id),
      node,
    });
  }
  return hits;
}

/** Permanently delete folders matching a query (sidebar delete + tombstone). */
export function deleteFoldersByQuery(query) {
  const matches = findFoldersByQuery(query);
  const deleteDoc = useDocsStore.getState().deleteDoc;
  const deleted = [];
  for (const hit of matches) {
    deleteDoc(hit.id);
    deleted.push({ id: hit.id, label: hit.label });
  }
  flushPersistenceSync().catch(() => {});
  return { deleted };
}

/** Restore a deleted node from the local workspace snapshot. */
export function recoverNodeFromSnapshot(nodeId) {
  const id = String(nodeId || "").trim();
  if (!id) return { ok: false, reason: "missing-id" };

  const live = useNodesStore.getState().nodes?.[id];
  if (live) return { ok: true, reason: "already-live", nodeId: id };

  const snapshot = readJsonStorage(STORAGE_KEY);
  const snapshotNode = snapshot?.nodes?.[id];
  if (!snapshotNode) {
    return { ok: false, reason: "not-in-local-snapshot", nodeId: id };
  }

  unmarkNodeDeletedForSync(id);

  const parentDocId = snapshotNode.parentDocId || null;
  useNodesStore.setState((state) => ({
    nodes: {
      ...state.nodes,
      [id]: {
        ...snapshotNode,
        linkedToDoc: Boolean(parentDocId),
      },
    },
  }));

  if (parentDocId && useDocsStore.getState().docs[parentDocId]) {
    useDocsStore.getState().addNodeToDoc(parentDocId, id);
    useNodesStore.getState().syncNodeToParentDoc(id, parentDocId);
  }

  flushPersistenceSync().catch(() => {});
  return {
    ok: true,
    reason: "restored",
    nodeId: id,
    label: (snapshotNode.sourceQuery || snapshotNode.title || "Untitled").trim(),
    parentDocId,
  };
}

/** Recover the first snapshot node matching a title query. */
export function recoverNodeByQuery(query) {
  const hits = findRecoverableNodesByQuery(query);
  const candidate = hits.find((hit) => hit.recoverable && hit.node);
  if (!candidate) {
    return { ok: false, reason: "no-recoverable-match", query, hits };
  }
  const result = recoverNodeFromSnapshot(candidate.id);
  return { ...result, hits };
}

/** Dev console helpers — `window.__fnWorkspace`. */
export function installWorkspaceRecoveryTools() {
  if (typeof window === "undefined") return;
  window.__fnWorkspace = {
    findFolders: findFoldersByQuery,
    findNodes: findNodesByQuery,
    findRecoverable: findRecoverableNodesByQuery,
    deleteFolder: deleteFoldersByQuery,
    recoverNode: recoverNodeFromSnapshot,
    recoverByTitle: recoverNodeByQuery,
  };
}
