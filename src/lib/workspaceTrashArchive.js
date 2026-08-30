import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  flushPersistenceSync,
  unmarkCompanyDeletedForSync,
  unmarkDocDeletedForSync,
  unmarkNodeDeletedForSync,
} from "../stores/middleware/persistenceMiddleware.js";
import { resolveProductDocDisplayTitle } from "./templateDoc.js";

export const TRASH_ARCHIVE_KEY = "futura-nota-trash-v1";
export const TRASH_CHANGED_EVENT = "futura-nota:trash-changed";

/** @typedef {'folder'|'document'|'company_bundle'} TrashEntryKind */

/**
 * @typedef {Object} TrashListItem
 * @property {string} id
 * @property {TrashEntryKind} kind
 * @property {string} title
 * @property {string} subtitle
 * @property {string} deletedAt
 * @property {string} source
 * @property {number} documentCount
 */

function emitTrashChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TRASH_CHANGED_EVENT));
}

function readArchive() {
  if (typeof localStorage === "undefined") {
    return { version: 1, entries: {} };
  }
  try {
    const raw = localStorage.getItem(TRASH_ARCHIVE_KEY);
    if (!raw) return { version: 1, entries: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { version: 1, entries: {} };
    return {
      version: 1,
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
    };
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeArchive(archive) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TRASH_ARCHIVE_KEY, JSON.stringify({
      version: 1,
      entries: archive.entries || {},
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // quota / private mode
  }
  emitTrashChanged();
}

function folderTitle(doc) {
  if (!doc) return "Untitled folder";
  return resolveProductDocDisplayTitle(doc) || doc.title?.trim() || doc.category?.trim() || "Untitled folder";
}

function documentTitle(node) {
  return (node?.sourceQuery || node?.title || "Untitled").trim();
}

function entryToListItem(entry) {
  if (!entry?.id) return null;
  if (entry.kind === "company_bundle") {
    const docCount = Object.keys(entry.docs || {}).length;
    const nodeCount = Object.keys(entry.nodes || {}).length;
    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.company?.name || "Workspace",
      subtitle: entry.company?.role === "guest" ? "Guest workspace" : "Company",
      deletedAt: entry.deletedAt,
      source: entry.source || "user_confirm",
      documentCount: docCount + nodeCount,
    };
  }
  if (entry.kind === "folder") {
    const nodeCount = Array.isArray(entry.nodes) ? entry.nodes.length : 0;
    return {
      id: entry.id,
      kind: entry.kind,
      title: folderTitle(entry.doc),
      subtitle: entry.doc?.category?.trim() || "Folder",
      deletedAt: entry.deletedAt,
      source: entry.source || "user_confirm",
      documentCount: nodeCount,
    };
  }
  return {
    id: entry.id,
    kind: "document",
    title: documentTitle(entry.node),
    subtitle: "Document",
    deletedAt: entry.deletedAt,
    source: entry.source || "user_confirm",
    documentCount: 0,
  };
}

/**
 * @param {object} entry
 */
function upsertArchiveEntry(entry) {
  if (!entry?.id) return;
  const archive = readArchive();
  archive.entries[entry.id] = entry;
  writeArchive(archive);
}

/**
 * Archive a folder delete (with linked document entities).
 * @param {object|null} doc
 * @param {object[]} linkedNodes
 * @param {{ source?: string }} [options]
 */
export function archiveFolderDelete(doc, linkedNodes = [], options = {}) {
  if (!doc?.id) return;
  upsertArchiveEntry({
    id: doc.id,
    kind: "folder",
    doc: { ...doc },
    nodes: (linkedNodes || []).map((node) => ({ ...node })),
    deletedAt: new Date().toISOString(),
    source: options.source || "user_confirm",
  });
}

/**
 * Archive a single document (node) delete.
 * @param {object|null} node
 * @param {{ source?: string }} [options]
 */
export function archiveDocumentDelete(node, options = {}) {
  if (!node?.id) return;
  upsertArchiveEntry({
    id: node.id,
    kind: "document",
    node: { ...node },
    deletedAt: new Date().toISOString(),
    source: options.source || "user_confirm",
  });
}

/**
 * Archive a company/workspace cascade delete.
 * @param {object|null} company
 * @param {object[]} docs
 * @param {object[]} nodes
 * @param {{ source?: string }} [options]
 */
export function archiveCompanyBundleDelete(company, docs = [], nodes = [], options = {}) {
  if (!company?.id) return;
  /** @type {Record<string, object>} */
  const docsMap = {};
  for (const doc of docs) {
    if (doc?.id) docsMap[doc.id] = { ...doc };
  }
  /** @type {Record<string, object>} */
  const nodesMap = {};
  for (const node of nodes) {
    if (node?.id) nodesMap[node.id] = { ...node };
  }
  upsertArchiveEntry({
    id: company.id,
    kind: "company_bundle",
    company: { ...company },
    docs: docsMap,
    nodes: nodesMap,
    deletedAt: new Date().toISOString(),
    source: options.source || "user_confirm",
  });
}

/**
 * @param {{ query?: string }} [options]
 * @returns {TrashListItem[]}
 */
export function listTrashItems({ query = "" } = {}) {
  const archive = readArchive();
  const needle = String(query || "").trim().toLowerCase();
  const items = Object.values(archive.entries)
    .map(entryToListItem)
    .filter(Boolean)
    .filter((item) => {
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle)
        || item.subtitle.toLowerCase().includes(needle);
    })
    .sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
  return items;
}

export function getTrashItemCount() {
  return Object.keys(readArchive().entries).length;
}

function removeArchiveEntry(id) {
  const archive = readArchive();
  if (!archive.entries[id]) return false;
  delete archive.entries[id];
  writeArchive(archive);
  return true;
}

function restoreDocumentEntity(node) {
  if (!node?.id) return;
  unmarkNodeDeletedForSync(node.id);
  const parentDocId = node.parentDocId || null;
  useNodesStore.setState((state) => ({
    nodes: {
      ...state.nodes,
      [node.id]: {
        ...node,
        linkedToDoc: Boolean(parentDocId),
      },
    },
  }));
  if (parentDocId && useDocsStore.getState().docs[parentDocId]) {
    useDocsStore.getState().addNodeToDoc(parentDocId, node.id);
    useNodesStore.getState().syncNodeToParentDoc(node.id, parentDocId);
  }
}

function restoreFolderEntity(doc, nodes = []) {
  if (!doc?.id) return;
  unmarkDocDeletedForSync(doc.id);
  const normalized = normalizeDoc(doc);
  useDocsStore.setState((state) => ({
    docs: {
      ...state.docs,
      [doc.id]: normalized,
    },
  }));
  const parentObjectId = normalized.parentObjectId || null;
  if (parentObjectId && useObjectsStore.getState().objects[parentObjectId]) {
    useObjectsStore.getState().addDocToObject(parentObjectId, doc.id);
  }
  for (const node of nodes) {
    if (!node?.id) continue;
    unmarkNodeDeletedForSync(node.id);
    restoreDocumentEntity(node);
  }
}

/**
 * Restore one trash entry by archive id.
 * @param {string} entryId
 * @returns {{ ok: boolean, reason?: string, entryId?: string, title?: string }}
 */
export function restoreTrashEntry(entryId) {
  const id = String(entryId || "").trim();
  if (!id) return { ok: false, reason: "missing-id" };

  const archive = readArchive();
  const entry = archive.entries[id];
  if (!entry) return { ok: false, reason: "not-in-trash", entryId: id };

  if (entry.kind === "company_bundle") {
    unmarkCompanyDeletedForSync(entry.id);
    useObjectsStore.setState((state) => ({
      objects: {
        ...state.objects,
        [entry.id]: { ...entry.company },
      },
    }));
    for (const doc of Object.values(entry.docs || {})) {
      restoreFolderEntity(doc, []);
    }
    for (const node of Object.values(entry.nodes || {})) {
      const parentLive = node.parentDocId && useDocsStore.getState().docs[node.parentDocId];
      if (parentLive) {
        restoreDocumentEntity(node);
      } else if (node?.id) {
        unmarkNodeDeletedForSync(node.id);
        useNodesStore.setState((state) => ({
          nodes: {
            ...state.nodes,
            [node.id]: { ...node, linkedToDoc: Boolean(node.parentDocId) },
          },
        }));
      }
    }
    removeArchiveEntry(id);
    flushPersistenceSync().catch(() => {});
    return {
      ok: true,
      entryId: id,
      title: entry.company?.name || "Workspace",
    };
  }

  if (entry.kind === "folder") {
    restoreFolderEntity(entry.doc, entry.nodes || []);
    removeArchiveEntry(id);
    flushPersistenceSync().catch(() => {});
    return {
      ok: true,
      entryId: id,
      title: folderTitle(entry.doc),
    };
  }

  restoreDocumentEntity(entry.node);
  removeArchiveEntry(id);
  flushPersistenceSync().catch(() => {});
  return {
    ok: true,
    entryId: id,
    title: documentTitle(entry.node),
  };
}
