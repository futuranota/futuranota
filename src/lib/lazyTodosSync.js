import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { createTodoItem } from "./docBlocks.js";
import { generateId } from "./ids.js";
import {
  filterLazyTodosAgainstDeletedIds,
  mergeLazyTodoListsWithMeta,
} from "./lazyTodosMerge.js";
import { resolveSyncUserId } from "./resolveSyncUserId.js";
import { LAZY_TODOS_DELETED_STORAGE_KEY } from "../stores/lazyTodosStore.js";

const SYNC_DEBOUNCE_MS = 1500;
const DELETE_SYNC_DEBOUNCE_MS = 250;
const KNOWN_REMOTE_STORAGE_KEY = "futuranota.lazyTodos.knownRemote.v1";

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

/** @returns {string[]} */
function readKnownRemoteIds() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(KNOWN_REMOTE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && id);
  } catch {
    return [];
  }
}

/** @param {Iterable<string>} ids */
function persistKnownRemoteIds(ids) {
  try {
    if (typeof localStorage === "undefined") return;
    const list = [...new Set([...ids].filter((id) => typeof id === "string" && id))];
    localStorage.setItem(KNOWN_REMOTE_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

/** @param {Iterable<string>} ids */
function unionKnownRemoteIds(ids) {
  const next = new Set(readKnownRemoteIds());
  for (const id of ids || []) {
    if (id) next.add(String(id));
  }
  persistKnownRemoteIds(next);
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

/** Serialize overlapping upsert/delete so a stale upsert cannot resurrect a tombstoned row. */
let syncInFlight = null;
let syncNeedsRerun = false;

/**
 * Explicit DELETE for tombstoned ids (mirrors folder purgeTombstonedRows).
 * @param {string} userId
 * @param {string[]} deletedIds
 * @returns {Promise<boolean>}
 */
async function purgeTombstonedLazyTodos(userId, deletedIds) {
  const ids = [...new Set(deletedIds)].filter(Boolean);
  if (!ids.length) return true;

  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("lazy_todos")
      .delete()
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) {
      console.warn(formatSupabaseError(error, "Purge tombstoned lazy_todos"));
      return false;
    }
  }
  return true;
}

/**
 * Clear tombstones only after a remote SELECT proves the rows are gone.
 * Never clear while another sync is already queued (syncNeedsRerun).
 * @param {string} userId
 * @param {string[]} deletedIds
 * @param {(cleared: string[]) => void} [onConfirmedAbsent]
 */
async function clearLazyTodoTombstonesConfirmedAbsent(
  userId,
  deletedIds,
  onConfirmedAbsent,
) {
  if (syncNeedsRerun) return;

  const ids = [...new Set(deletedIds)].filter(Boolean);
  if (!ids.length) return;

  const CHUNK = 100;
  const stillRemote = new Set();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("lazy_todos")
      .select("id")
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) {
      console.warn(formatSupabaseError(error, "Confirm lazy_todos tombstones absent"));
      return;
    }
    for (const row of data || []) {
      if (row?.id) stillRemote.add(row.id);
    }
  }

  // Re-check after the SELECT — a delete mid-confirm must keep its tombstone.
  if (syncNeedsRerun) return;

  const cleared = ids.filter((id) => !stillRemote.has(id));
  if (cleared.length > 0 && typeof onConfirmedAbsent === "function") {
    onConfirmedAbsent(cleared);
  }
}

/**
 * @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items
 * @param {{
 *   allowOrphanDelete?: boolean,
 *   deletedIds?: string[],
 *   onOrphansDeleted?: (ids: string[]) => void,
 *   onUpserted?: (ids: string[]) => void,
 *   skipUpsert?: boolean,
 * }} [options]
 */
async function syncLazyTodosToSupabase(items, options = {}) {
  const userId = await resolveSyncUserId();
  if (!userId) return;

  const allowOrphanDelete = Boolean(options.allowOrphanDelete) && hasCompletedHydrate;
  const deletedIds = [...new Set(options.deletedIds || [])].filter(Boolean);
  const now = new Date().toISOString();
  const skipUpsert = Boolean(options.skipUpsert);

  // Never upsert rows that are currently tombstoned (stale snapshots / races).
  const safeItems = skipUpsert
    ? []
    : filterLazyTodosAgainstDeletedIds(items, deletedIds);
  const rows = safeItems.map((item) => itemToRow(item, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("lazy_todos")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert lazy_todos"));
      return;
    }
    if (typeof options.onUpserted === "function") {
      options.onUpserted(safeItems.map((item) => item.id));
    }
  }

  if (!allowOrphanDelete) {
    return;
  }

  // Explicit purge by tombstone — does not depend on "missing from local list".
  const purgeOk = await purgeTombstonedLazyTodos(userId, deletedIds);
  if (!purgeOk) return;

  const { data: remoteRows, error: selectErr } = await supabase
    .from("lazy_todos")
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.warn(formatSupabaseError(selectErr, "Select lazy_todos"));
    return;
  }

  const localIds = new Set(safeItems.map((item) => item.id));
  // Also treat tombstones as "present locally" for orphan math — already purged above.
  for (const id of deletedIds) localIds.add(id);

  // After a trusted empty-remote hydrate, anything still on remote is an orphan
  // (including rows a race re-upserted) — delete them.
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => id && !localIds.has(id));

  if (orphanIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("lazy_todos")
      .delete()
      .eq("user_id", userId)
      .in("id", orphanIds);
    if (deleteErr) {
      console.warn(formatSupabaseError(deleteErr, "Delete lazy_todos"));
      return;
    }
  }

  await clearLazyTodoTombstonesConfirmedAbsent(
    userId,
    deletedIds,
    options.onOrphansDeleted,
  );

  persistKnownRemoteIds(safeItems.map((item) => item.id));
}

/**
 * Queue a sync that always reads live store state when it actually runs.
 * Overlapping calls coalesce into one follow-up with fresh items/deletedIds.
 * @param {typeof import("../stores/lazyTodosStore.js").useLazyTodosStore} useLazyTodosStore
 * @param {{ orphanDelete?: boolean, skipUpsert?: boolean }} [opts]
 */
function enqueueLazyTodosSync(useLazyTodosStore, { orphanDelete = true, skipUpsert = false } = {}) {
  const runOnce = async () => {
    do {
      syncNeedsRerun = false;
      if (isHydrating) {
        // Hydrate's trailing sync reads live deletedIds; keep a flag so a
        // post-hydrate enqueue (if any) still runs with fresh state.
        syncNeedsRerun = true;
        return;
      }

      const { items, deletedIds } = useLazyTodosStore.getState();
      await syncLazyTodosToSupabase(items, {
        allowOrphanDelete: orphanDelete,
        deletedIds: deletedIds || [],
        skipUpsert,
        onOrphansDeleted: (cleared) => {
          useLazyTodosStore.getState().clearDeletedIds?.(cleared);
        },
        onUpserted: (ids) => {
          useLazyTodosStore.getState().markSynced?.(ids);
          unionKnownRemoteIds(ids);
        },
      });
    } while (syncNeedsRerun);
  };

  if (syncInFlight) {
    syncNeedsRerun = true;
    return syncInFlight.then(() => {
      if (syncInFlight) return syncInFlight;
      if (!syncNeedsRerun) return undefined;
      syncInFlight = runOnce().finally(() => {
        syncInFlight = null;
      });
      return syncInFlight;
    });
  }

  syncInFlight = runOnce().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
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
 * @param {string[]|null|undefined} ids
 * @param {typeof import("../stores/lazyTodosStore.js").useLazyTodosStore} useLazyTodosStore
 */
function adoptCrossTabDeletedIds(ids, useLazyTodosStore) {
  const incoming = [...new Set((ids || []).filter((id) => typeof id === "string" && id))];
  if (!incoming.length) return false;

  const { deletedIds, items, markDeleted, removeItem } = useLazyTodosStore.getState();
  const known = new Set(deletedIds || []);
  const fresh = incoming.filter((id) => !known.has(id));
  if (!fresh.length) {
    // Still strip any local items that match incoming tombstones (another tab deleted them).
    let stripped = false;
    for (const id of incoming) {
      if (items.some((item) => item.id === id)) {
        removeItem(id);
        stripped = true;
      }
    }
    return stripped;
  }

  markDeleted(fresh);
  for (const id of fresh) {
    removeItem(id);
  }
  return true;
}

/**
 * @param {typeof import("../stores/lazyTodosStore.js").useLazyTodosStore} useLazyTodosStore
 */
export function initLazyTodosSync(useLazyTodosStore) {
  if (typeof window === "undefined") return;

  debouncedRemoteSync = debounce(() => {
    if (isHydrating) return;
    enqueueLazyTodosSync(useLazyTodosStore, { orphanDelete: true });
  }, SYNC_DEBOUNCE_MS);

  debouncedDeleteSync = debounce(() => {
    if (isHydrating) return;
    enqueueLazyTodosSync(useLazyTodosStore, { orphanDelete: true });
  }, DELETE_SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    debouncedRemoteSync?.cancel();
    debouncedDeleteSync?.cancel();

    // Lock BEFORE any await — otherwise requeue/subscribe can upsert zombies
    // while loadLazyTodosFromSupabase is in flight and reseed remote.
    isHydrating = true;
    let trustedEmptyRemote = false;

    try {
      // Wait out any in-flight upsert so it cannot race the post-hydrate purge.
      if (syncInFlight) {
        try {
          await syncInFlight;
        } catch {
          // prior sync logged its own error
        }
      }

      const remoteItems = await loadLazyTodosFromSupabase();
      if (remoteItems === null) {
        // Keep local paint; do not flush (would risk upsert before we know remote).
        return;
      }

      const { items: localItems, deletedIds } = useLazyTodosStore.getState();
      const knownRemoteIds = readKnownRemoteIds();
      trustedEmptyRemote = remoteItems.length === 0;

      if (trustedEmptyRemote) {
        // Remote wipe wins completely — do not keep local-only drafts that would
        // reseed Supabase on the trailing flush.
        const dropAll = localItems.map((item) => item.id).filter(Boolean);
        if (dropAll.length > 0) {
          useLazyTodosStore.getState().markDeleted?.(dropAll);
        }
        useLazyTodosStore.getState().replaceItems([]);
        persistKnownRemoteIds([]);
      } else {
        const { items: merged, droppedIds } = mergeLazyTodoListsWithMeta(
          localItems,
          remoteItems,
          deletedIds,
          { knownRemoteIds, trustEmptyRemote: false },
        );

        if (droppedIds.length > 0) {
          useLazyTodosStore.getState().markDeleted?.(droppedIds);
        }

        useLazyTodosStore.getState().replaceItems(merged);
        useLazyTodosStore.getState().requeueOrphanedActives?.();
        persistKnownRemoteIds(remoteItems.map((item) => item.id));
      }

      hasCompletedHydrate = true;
    } finally {
      isHydrating = false;
    }

    // After empty remote: purge only (no upsert). Otherwise normal flush.
    syncNeedsRerun = false;
    await enqueueLazyTodosSync(useLazyTodosStore, {
      orphanDelete: true,
      skipUpsert: trustedEmptyRemote,
    });
  };

  hydrateFromRemote();

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

  // Sibling /app tabs: adopt delete tombstones so they stop re-upserting deleted todos.
  window.addEventListener("storage", (event) => {
    if (event.key !== LAZY_TODOS_DELETED_STORAGE_KEY || !event.newValue) return;
    let ids = null;
    try {
      ids = JSON.parse(event.newValue);
    } catch {
      return;
    }
    if (!Array.isArray(ids)) return;
    if (!adoptCrossTabDeletedIds(ids, useLazyTodosStore)) return;
    debouncedRemoteSync?.cancel();
    debouncedDeleteSync?.();
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
      debouncedDeleteSync?.();
      return;
    }

    debouncedRemoteSync?.();
  });
}
