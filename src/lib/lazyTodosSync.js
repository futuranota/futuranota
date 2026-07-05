import { supabase, getSupabaseConfigError, formatSupabaseError } from "./supabaseClient.js";
import { createTodoItem } from "./docBlocks.js";
import { generateId } from "./ids.js";

const SYNC_DEBOUNCE_MS = 1500;

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

/** @returns {Promise<string|null>} */
async function resolveSyncUserId() {
  const configErr = getSupabaseConfigError();
  if (configErr) return null;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) return null;

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const expiresSoon = expiresAt > 0 && expiresAt - Date.now() < 60_000;
  if (expiresSoon) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) return null;
    return refreshed.session?.user?.id || null;
  }

  return session.user.id;
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

  return {
    id: String(row.id || generateId("LAZY")),
    objectId: row.object_id ?? null,
    reminder: String(row.reminder ?? ""),
    listTitle: String(row.list_title ?? "To do").trim() || "To do",
    items,
    createdAt: row.created_at || new Date().toISOString(),
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
    updated_at: now,
  };
}

let isHydrating = false;
let debouncedRemoteSync = null;

/** @param {import("../stores/lazyTodosStore.js").LazyTodoItem[]} items */
async function syncLazyTodosToSupabase(items) {
  const userId = await resolveSyncUserId();
  if (!userId) return;

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

  if (orphanIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("lazy_todos")
      .delete()
      .eq("user_id", userId)
      .in("id", orphanIds);
    if (deleteErr) {
      console.warn(formatSupabaseError(deleteErr, "Delete lazy_todos"));
    }
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

  debouncedRemoteSync = debounce((items) => {
    if (isHydrating) return;
    syncLazyTodosToSupabase(items);
  }, SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    const remoteItems = await loadLazyTodosFromSupabase();
    if (remoteItems === null) return;

    isHydrating = true;
    try {
      if (remoteItems.length > 0) {
        useLazyTodosStore.getState().replaceItems(remoteItems);
      } else {
        const localItems = useLazyTodosStore.getState().items;
        if (localItems.length > 0) {
          await syncLazyTodosToSupabase(localItems);
        }
      }
    } finally {
      isHydrating = false;
    }
  };

  hydrateFromRemote();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      debouncedRemoteSync?.cancel();
      hydrateFromRemote();
    }
    if (event === "SIGNED_OUT") {
      debouncedRemoteSync?.cancel();
    }
  });

  useLazyTodosStore.subscribe((state) => {
    debouncedRemoteSync?.(state.items);
  });
}
