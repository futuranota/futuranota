import { createTodoItem } from "./docBlocks.js";

/**
 * @typedef {import("../stores/lazyTodosStore.js").LazyTodoItem} LazyTodoItem
 */

const PREVIEW_MAX = 120;

/**
 * @param {LazyTodoItem[]} items
 * @param {string} query
 * @returns {LazyTodoItem[]}
 */
export function filterLazyTodos(items, query, opts = {}) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return items;
  const nodesById = opts.nodesById || {};

  return items.filter((item) => {
    if ((item.reminder || "").toLowerCase().includes(normalized)) return true;
    if ((item.listTitle || "").toLowerCase().includes(normalized)) return true;
    const live = liveDocumentTitleForTodo(item, nodesById).toLowerCase();
    if (live && live.includes(normalized)) return true;
    return (item.items || []).some((entry) => (
      (entry.text || "").toLowerCase().includes(normalized)
    ));
  });
}

/**
 * @param {LazyTodoItem[]} items
 * @returns {LazyTodoItem[]}
 */
export function sortLazyTodosNewestFirst(items) {
  return [...items].sort((a, b) => (
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));
}

/**
 * @param {LazyTodoItem} item
 */
export function lazyTodoProgress(item) {
  const items = item?.items || [];
  const done = items.filter((entry) => entry.checked).length;
  return { done, total: items.length };
}

const GENERIC_LIST_TITLES = new Set(["to do", "todo", "to-do", "to do list"]);

/**
 * Default chrome label — not a document name.
 * @param {string|null|undefined} title
 */
export function isGenericLazyTodoListTitle(title) {
  const value = String(title ?? "").trim().toLowerCase();
  return !value || GENERIC_LIST_TITLES.has(value);
}

/**
 * Live document title from the nodes map (document = scheduled unit / node).
 * @param {LazyTodoItem} item
 * @param {Record<string, { title?: string }>} [nodesById]
 */
export function liveDocumentTitleForTodo(item, nodesById = {}) {
  const id = item?.documentId != null ? String(item.documentId).trim() : "";
  if (!id) return "";
  const node = nodesById[id];
  return String(node?.title ?? "").trim();
}

/**
 * Header of the checklist: live doc title, else stored listTitle, else fallback.
 * @param {LazyTodoItem} item
 * @param {{ liveDocTitle?: string, fallback?: string }} [opts]
 */
export function resolveLazyTodoListTitle(item, opts = {}) {
  const fallback = String(opts.fallback ?? "To do").trim() || "To do";
  const live = String(opts.liveDocTitle ?? "").trim();
  if (live) return live;
  const stored = String(item?.listTitle ?? "").trim();
  if (stored && !isGenericLazyTodoListTitle(stored)) return stored;
  return fallback;
}

/**
 * @param {LazyTodoItem} item
 * @param {{ liveDocTitle?: string }} [opts]
 */
export function lazyTodoDisplayTitle(item, opts = {}) {
  const heading = resolveLazyTodoListTitle(item, {
    liveDocTitle: opts.liveDocTitle,
    fallback: "",
  });
  if (heading && !isGenericLazyTodoListTitle(heading)) return truncate(heading, 60);
  const reminder = String(item?.reminder ?? "").trim();
  if (reminder) return truncate(reminder, 60);
  const first = (item?.items || []).find((entry) => (entry.text || "").trim());
  if (first) return truncate(first.text, 60);
  return "Untitled to do";
}

/**
 * @param {LazyTodoItem} item
 */
export function lazyTodoPreview(item) {
  const firstTodo = (item?.items || []).find((entry) => (entry.text || "").trim())?.text ?? "";
  const reminder = String(item?.reminder ?? "").trim();
  if (firstTodo && reminder) return truncate(`${reminder} · ${firstTodo}`, PREVIEW_MAX);
  return truncate(firstTodo || reminder, PREVIEW_MAX);
}

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * @param {string|null} objectId
 * @param {{ documentId?: string|null, listTitle?: string|null }} [extras]
 * @returns {LazyTodoItem}
 */
export function createBlankLazyTodo(objectId = null, extras = {}) {
  const stamp = new Date().toISOString();
  const documentId = extras?.documentId != null && String(extras.documentId).trim()
    ? String(extras.documentId).trim()
    : null;
  return {
    id: null,
    objectId,
    documentId,
    reminder: "",
    listTitle: String(extras?.listTitle ?? "").trim() || "To do",
    items: [createTodoItem()],
    createdAt: stamp,
    updatedAt: stamp,
    status: "active",
  };
}

/**
 * @param {LazyTodoItem} item
 * @returns {LazyTodoItem}
 */
export function cloneLazyTodo(item) {
  return {
    ...item,
    items: (item.items || []).map((entry) => ({ ...entry })),
  };
}

/**
 * Aggregate checklist progress for single or shell-merge session.
 *
 * @param {LazyTodoItem|null|undefined} session
 * @param {{ items?: LazyTodoItem[] }|null|undefined} shellMerge
 */
export function lazyTodoSessionProgress(session, shellMerge = null) {
  const items = shellMerge?.items?.length
    ? shellMerge.items
    : (session ? [session] : []);
  let done = 0;
  let total = 0;
  for (const item of items) {
    const progress = lazyTodoProgress(item);
    done += progress.done;
    total += progress.total;
  }
  return { done, total };
}
