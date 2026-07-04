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
export function filterLazyTodos(items, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    if ((item.reminder || "").toLowerCase().includes(normalized)) return true;
    if ((item.listTitle || "").toLowerCase().includes(normalized)) return true;
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

/**
 * @param {LazyTodoItem} item
 */
export function lazyTodoDisplayTitle(item) {
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
 * @returns {LazyTodoItem}
 */
export function createBlankLazyTodo(objectId = null) {
  return {
    id: null,
    objectId,
    reminder: "",
    listTitle: "To do",
    items: [createTodoItem()],
    createdAt: new Date().toISOString(),
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
