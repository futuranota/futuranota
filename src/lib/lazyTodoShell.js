import { generateId } from "./ids.js";
import { lazyTodoHasContent } from "./lazyTodoItemKeyDown.js";
import {
  liveDocumentTitleForTodo,
  resolveLazyTodoListTitle,
} from "./lazyTodos.js";

/** Max checklist cards inside one lazy to-do shell (queue section). */
export const LAZY_TODO_SHELL_CARD_LIMIT = 10;

/**
 * Stable shell id for a document-linked lazy to-do (one shell per document).
 * @param {string} documentId
 */
export function shellIdForDocument(documentId) {
  const id = String(documentId || "").trim();
  return id ? `shell-doc-${id}` : "";
}

/**
 * @returns {string}
 */
export function createShellId() {
  return generateId("SHELL");
}

/**
 * Resolve or migrate shell id for a lazy to-do item.
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem|null|undefined} item
 */
export function resolveShellId(item) {
  const existing = item?.shellId != null ? String(item.shellId).trim() : "";
  if (existing) return existing;

  const documentId = item?.documentId != null ? String(item.documentId).trim() : "";
  if (documentId) return shellIdForDocument(documentId);

  const itemId = item?.id != null ? String(item.id).trim() : "";
  return itemId ? `shell-${itemId}` : createShellId();
}

/**
 * Group queued items by shell id (not document schedule date).
 *
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items
 * @param {{
 *   nodesById?: Record<string, object>,
 *   requireContent?: boolean,
 * }} [opts]
 * @returns {{ shellId: string, title: string, items: import("../stores/lazyTodosStore.js").LazyTodoItem[] }[]}
 */
export function groupLazyTodosByShell(items, opts = {}) {
  const nodesById = opts.nodesById || {};
  const requireContent = opts.requireContent !== false;
  /** @type {Map<string, import("../stores/lazyTodosStore.js").LazyTodoItem[]>} */
  const buckets = new Map();

  for (const item of items || []) {
    if (!item?.id) continue;
    if (requireContent && !lazyTodoHasContent(item)) continue;
    const shellId = resolveShellId(item);
    if (!buckets.has(shellId)) buckets.set(shellId, []);
    buckets.get(shellId).push(item);
  }

  return [...buckets.entries()]
    .map(([shellId, list]) => {
      const sorted = [...list].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime()
          - new Date(a.updatedAt || a.createdAt).getTime(),
      );
      return {
        shellId,
        title: shellDisplayTitle(sorted, nodesById),
        items: sorted,
      };
    })
    .sort(
      (a, b) => new Date(b.items[0]?.updatedAt || b.items[0]?.createdAt).getTime()
        - new Date(a.items[0]?.updatedAt || a.items[0]?.createdAt).getTime(),
    );
}

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items
 * @param {Record<string, object>} [nodesById]
 * @param {string} [fallback]
 */
export function shellDisplayTitle(items, nodesById = {}, fallback = "To do") {
  if (!items?.length) return fallback;
  const primary = items[0];
  const liveDocTitle = liveDocumentTitleForTodo(primary, nodesById);
  const title = resolveLazyTodoListTitle(primary, {
    liveDocTitle,
    fallback,
  });
  return String(title || fallback).trim() || fallback;
}

/**
 * Collect queued items for one shell (+ optional draft not yet queued).
 *
 * @param {string|null|undefined} objectId
 * @param {string} shellId
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items
 * @param {{
 *   extraItem?: import("../stores/lazyTodosStore.js").LazyTodoItem | null,
 * }} [opts]
 * @returns {import("../stores/lazyTodosStore.js").LazyTodoItem[]}
 */
export function collectQueuedLazyTodosForShell(
  objectId,
  shellId,
  items,
  opts = {},
) {
  const targetShell = String(shellId || "").trim();
  if (!targetShell) return [];

  const scopedObject = objectId != null && String(objectId).trim()
    ? String(objectId).trim()
    : null;

  const matchesObject = (item) => {
    if (scopedObject) return item?.objectId === scopedObject;
    return !item?.objectId;
  };

  /** @type {Map<string, import("../stores/lazyTodosStore.js").LazyTodoItem>} */
  const byId = new Map();

  for (const item of items || []) {
    if (!item?.id || !matchesObject(item)) continue;
    if (item.status !== "queued") continue;
    if (resolveShellId(item) !== targetShell) continue;
    byId.set(item.id, item);
  }

  const extra = opts.extraItem || null;
  if (extra?.id && matchesObject(extra)) {
    byId.set(extra.id, extra);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime()
      - new Date(a.updatedAt || a.createdAt).getTime(),
  );
}

/**
 * Documents in the company that can be linked to an unlinked card in this shell.
 *
 * @param {Record<string, object>} nodesById
 * @param {string|null|undefined} objectId
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} shellItems
 * @param {Record<string, object>} [docsById]
 * @returns {{ id: string, title: string, parentDocId: string|null }[]}
 */
export function listLinkableDocumentsForShell(
  nodesById,
  objectId,
  shellItems,
  docsById = {},
) {
  const linked = new Set(
    (shellItems || [])
      .map((item) => (item?.documentId != null ? String(item.documentId).trim() : ""))
      .filter(Boolean),
  );

  const scopedObject = objectId != null && String(objectId).trim()
    ? String(objectId).trim()
    : null;

  const results = [];
  for (const node of Object.values(nodesById || {})) {
    if (!node?.id || !node.parentDocId) continue;
    const nodeId = String(node.id);
    if (linked.has(nodeId)) continue;

    if (scopedObject) {
      const folder = docsById[node.parentDocId];
      const folderObjectId = folder?.parentObjectId != null
        ? String(folder.parentObjectId).trim()
        : "";
      if (folderObjectId && folderObjectId !== scopedObject) continue;
    }

    const title = String(node.title || node.sourceQuery || "").trim() || nodeId;
    results.push({
      id: nodeId,
      title,
      parentDocId: node.parentDocId != null ? String(node.parentDocId) : null,
    });
  }

  return results.sort((a, b) => a.title.localeCompare(b.title));
}
