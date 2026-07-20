import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { createTodoItem } from "./docBlocks.js";
import { generateId } from "./ids.js";
import { mergeLazyTodoLists } from "./lazyTodosMerge.js";
import { resolveSyncUserId } from "./resolveSyncUserId.js";

const SYNC_DEBOUNCE_MS = 1500;
const DELETE_SYNC_DEBOUNCE_MS = 250;

/** @param {(...args: unknown[]) => void} fn @param {number} ms */
function debounce(fn, ms) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

/** @param {Record<string, unknown>} row */
function rowToItem(row) {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems.length
    ? rawItems.map((entry) => createTodoItem({
      id: entry?.id,
      text: entry?.text ?? "",
      checked: Boolean(entry?.checked),
    }))
    : [createTodoItem()];

  const createdAt = row.created_at || new Date().toISOString();
  return {
    id: String(row.id || generateId("LAZY")),
    objectId: row.object_id ?? null,
    reminder: String(row.reminder ?? ""),
    listTitle: String(row.list_title ?? "To do").trim() || "To do",
    items,
    createdAt,
    updatedAt: row.updated_at || createdAt,
    status: row.status === "active" ? "active" : "queued",
  };
}

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem} item
 * @param {string} userId
 * @param {string} now
 */
function itemToRow(item, userId, now) {
  return {
    id: item.id,
    user_id: userId,
    object_id: item.objectId || null,
    reminder: item.reminder ?? "",
    list_title: item.listTitle ?? "To do",
    items: item.items ?? [],
    status: item.status === "active" ? "active" : "queued",
    created_at: item.createdAt || now,
    updated_at: item.updatedAt || now,
  };
}

let isHydrating = false;
/** Until first successful hydrate, never orphan-delete (avoids wiping remote with empty local). */
let hasCompletedHydrate = false;
let debouncedRemoteSync = null;
let debouncedDeleteSync = null;

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items
 * @param {{ allowOrphanDelete?: boolean, deletedIds?: string[] }} [options]
 */
async function syncLazyTodosToSupabase(items, options = {}) {
  const userId = await resolveSyncUserId();
  if (!userId) return;

  const allowOrphanDelete = Boolean(options.allowOrphanDelete) && hasCompletedHydrate;
  const deletedIds = options.deletedIds || [];
  const now = new Date().toISOString();
  const rows = items.map((item) => itemToRow(item, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("lazy_todos")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert lazy_todos"));
      return;
    }
  }

  if (!allowOrphanDelete) return;

  const { data: remoteRows, error: selectErr } = await supabase
    .from("lazy_todos")
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.warn(formatSupabaseError(selectErr, "Select lazy_todos"));
    return;
  }

  const localIds = new Set(items.map((item) => item.id));
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));

  if (orphanIds.length === 0) return;

  const { error: deleteErr } = await supabase
    .from("lazy_todos")
    .delete()
    .eq("user_id", userId)
    .in("id", orphanIds);

  if (deleteErr) {
    console.warn(formatSupabaseError(deleteErr, "Delete lazy_todos"));
    return;
  }

  const cleared = orphanIds.filter((id) => deletedIds.includes(id));
  if (cleared.length > 0 && typeof options.onOrphansDeleted === "function") {
    options.onOrphansDeleted(cleared);
  }
}

/** @returns {Promise<import("../stores/lazyTodosStore.js").LazyTodoItem[]|null>} */
export async function loadLazyTodosFromSupabase() {
  const userId = await resolveSyncUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("lazy_todos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(formatSupabaseError(error, "Load lazy_todos"));
    return null;
  }

  return (data || []).map(rowToItem);
}

/**
 * @param {typeof import("../stores/lazyTodosStore.js").useLazyTodosStore} useLazyTodosStore
 */
export function initLazyTodosSync(useLazyTodosStore) {
  if (typeof window === "undefined") return;

  const runSync = (items, deletedIds, { orphanDelete = true } = {}) => {
    syncLazyTodosToSupabase(items, {
      allowOrphanDelete: orphanDelete,
      deletedIds,
      onOrphansDeleted: (cleared) => {
        useLazyTodosStore.getState().clearDeletedIds?.(cleared);
      },
    });
  };

  debouncedRemoteSync = debounce((items, deletedIds) => {
    if (isHydrating) return;
    runSync(items, deletedIds, { orphanDelete: true });
  }, SYNC_DEBOUNCE_MS);

  debouncedDeleteSync = debounce((items, deletedIds) => {
    if (isHydrating) return;
    runSync(items, deletedIds, { orphanDelete: true });
  }, DELETE_SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    const remoteItems = await loadLazyTodosFromSupabase();
    if (remoteItems === null) return;

    isHydrating = true;
    try {
      const { items: localItems, deletedIds } = useLazyTodosStore.getState();
      const merged = mergeLazyTodoLists(localItems, remoteItems, deletedIds);
      useLazyTodosStore.getState().replaceItems(merged);
      useLazyTodosStore.getState().requeueOrphanedActives?.();
      hasCompletedHydrate = true;
      const { items: afterRequeue, deletedIds: afterDeleted } = useLazyTodosStore.getState();
      await syncLazyTodosToSupabase(afterRequeue, {
        allowOrphanDelete: true,
        deletedIds: afterDeleted,
        onOrphansDeleted: (cleared) => {
          useLazyTodosStore.getState().clearDeletedIds?.(cleared);
        },
      });
    } finally {
      isHydrating = false;
    }
  };

  hydrateFromRemote();

  // Recover lists orphaned as `active` after reload before remote hydrate returns.
  useLazyTodosStore.getState().requeueOrphanedActives?.();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      debouncedRemoteSync?.cancel();
      debouncedDeleteSync?.cancel();
      hasCompletedHydrate = false;
      hydrateFromRemote();
    }
    if (event === "SIGNED_OUT") {
      debouncedRemoteSync?.cancel();
      debouncedDeleteSync?.cancel();
      hasCompletedHydrate = false;
    }
  });

  let prevItems = useLazyTodosStore.getState().items;
  useLazyTodosStore.subscribe((state) => {
    if (isHydrating) {
      prevItems = state.items;
      return;
    }

    const prevIds = new Set(prevItems.map((item) => item.id));
    const nextIds = new Set(state.items.map((item) => item.id));
    const removed = [...prevIds].some((id) => !nextIds.has(id));
    prevItems = state.items;

    if (removed) {
      debouncedRemoteSync?.cancel();
      debouncedDeleteSync?.(state.items, state.deletedIds || []);
      return;
    }

    debouncedRemoteSync?.(state.items, state.deletedIds || []);
  });
}
