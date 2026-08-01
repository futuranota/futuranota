/**
 * Merge helpers for lazy todos — keep local and remote without destructive overwrite,
 * but never reseed ids that remote has already dropped.
 */

/**
 * Drop tombstoned ids from a list before upserting to Supabase.
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]|null|undefined} items
 * @param {Iterable<string>} [deletedIds]
 * @returns {import("../stores/lazyTodosStore.js").LazyTodoItem[]}
 */
export function filterLazyTodosAgainstDeletedIds(items, deletedIds = []) {
  const deleted = new Set(
    [...deletedIds].filter((id) => typeof id === "string" && id),
  );
  if (deleted.size === 0) return [...(items || [])].filter((item) => item?.id);
  return (items || []).filter((item) => item?.id && !deleted.has(item.id));
}

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
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem | null | undefined} item
 */
export function isPendingSyncLazyTodo(item) {
  return Boolean(item && item.pendingSync === true);
}

/**
 * Union local + remote by id.
 * - Tombstoned ids never resurrect.
 * - Local-only ids previously seen on remote (knownRemoteIds) are dropped when remote no longer has them.
 * - When trustEmptyRemote (successful SELECT returned []), drop local-only except pendingSync drafts.
 *
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} localItems
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} remoteItems
 * @param {Iterable<string>} [deletedIds]
 * @param {{
 *   knownRemoteIds?: Iterable<string>,
 *   trustEmptyRemote?: boolean,
 * }} [options]
 * @returns {{
 *   items: import("../stores/lazyTodosStore.js").LazyTodoItem[],
 *   droppedIds: string[],
 * }}
 */
export function mergeLazyTodoListsWithMeta(
  localItems,
  remoteItems,
  deletedIds = [],
  options = {},
) {
  const deleted = new Set(
    [...deletedIds].filter((id) => typeof id === "string" && id),
  );
  const knownRemote = new Set(
    [...(options.knownRemoteIds || [])].filter((id) => typeof id === "string" && id),
  );
  const trustEmptyRemote = Boolean(options.trustEmptyRemote);
  const byId = new Map();
  /** @type {string[]} */
  const droppedIds = [];

  for (const item of remoteItems || []) {
    if (!item?.id || deleted.has(item.id)) continue;
    byId.set(item.id, { ...item, pendingSync: false });
  }

  for (const item of localItems || []) {
    if (!item?.id || deleted.has(item.id)) continue;
    const existing = byId.get(item.id);
    if (existing) {
      const preferred = preferNewerLazyTodo(item, existing);
      byId.set(item.id, { ...preferred, pendingSync: false });
      continue;
    }

    // Local-only
    if (isPendingSyncLazyTodo(item)) {
      byId.set(item.id, item);
      continue;
    }

    if (trustEmptyRemote) {
      droppedIds.push(item.id);
      continue;
    }

    if (knownRemote.has(item.id)) {
      // Previously synced; remote no longer has it → honor remote delete.
      droppedIds.push(item.id);
      continue;
    }

    // Never-synced legacy / local draft without pendingSync flag — keep.
    byId.set(item.id, item);
  }

  const items = [...byId.values()].sort((a, b) => (
    lazyTodoTimestampMs(b) - lazyTodoTimestampMs(a)
  ));

  return { items, droppedIds };
}

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} localItems
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} remoteItems
 * @param {Iterable<string>} [deletedIds]
 * @param {{
 *   knownRemoteIds?: Iterable<string>,
 *   trustEmptyRemote?: boolean,
 * }} [options]
 * @returns {import("../stores/lazyTodosStore.js").LazyTodoItem[]}
 */
export function mergeLazyTodoLists(
  localItems,
  remoteItems,
  deletedIds = [],
  options = {},
) {
  return mergeLazyTodoListsWithMeta(
    localItems,
    remoteItems,
    deletedIds,
    options,
  ).items;
}
