/**
 * Merge helpers for lazy todos — keep local and remote without destructive overwrite.
 */

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem | null | undefined} item
 */
export function lazyTodoContentScore(item) {
  if (!item || typeof item !== "object") return 0;
  let score = String(item.reminder ?? "").trim().length;
  score += String(item.listTitle ?? "").trim().length;
  for (const entry of item.items || []) {
    score += String(entry?.text ?? "").trim().length;
    if (entry?.checked) score += 1;
  }
  return score;
}

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem} item
 */
export function lazyTodoTimestampMs(item) {
  const updated = Date.parse(String(item?.updatedAt || "")) || 0;
  if (updated > 0) return updated;
  return Date.parse(String(item?.createdAt || "")) || 0;
}

const RICHNESS_MARGIN = 8;
const STALE_RICH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Prefer the richer / newer revision of the same todo id.
 * Never swap a clearly richer list for a poorer one just because remote updated_at is newer
 * (stale remote hydrate was wiping local work).
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem} a
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem} b
 */
export function preferNewerLazyTodo(a, b) {
  const sa = lazyTodoContentScore(a);
  const sb = lazyTodoContentScore(b);
  const ta = lazyTodoTimestampMs(a);
  const tb = lazyTodoTimestampMs(b);

  if (sa > sb && sa >= sb + RICHNESS_MARGIN) {
    if (ta >= tb) return a;
    if (tb - ta < STALE_RICH_WINDOW_MS) return a;
  }
  if (sb > sa && sb >= sa + RICHNESS_MARGIN) {
    if (tb >= ta) return b;
    if (ta - tb < STALE_RICH_WINDOW_MS) return b;
  }

  if (ta !== tb) return ta > tb ? a : b;
  if (sa !== sb) return sa >= sb ? a : b;
  return a;
}

/**
 * Union local + remote by id. Intentionally deleted ids are never resurrected.
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} localItems
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} remoteItems
 * @param {Iterable<string>} [deletedIds]
 * @returns {import("../stores/lazyTodosStore.js").LazyTodoItem[]}
 */
export function mergeLazyTodoLists(localItems, remoteItems, deletedIds = []) {
  const deleted = new Set(
    [...deletedIds].filter((id) => typeof id === "string" && id),
  );
  const byId = new Map();

  for (const item of remoteItems || []) {
    if (!item?.id || deleted.has(item.id)) continue;
    byId.set(item.id, item);
  }

  for (const item of localItems || []) {
    if (!item?.id || deleted.has(item.id)) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, preferNewerLazyTodo(item, existing));
  }

  return [...byId.values()].sort((a, b) => (
    lazyTodoTimestampMs(b) - lazyTodoTimestampMs(a)
  ));
}
