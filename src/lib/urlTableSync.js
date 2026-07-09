import { supabase, getSupabaseConfigError, formatSupabaseError } from "./supabaseClient.js";
import { useUrlTableStore } from "../stores/urlTableStore.js";
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
function rowToEntry(row) {
  return {
    id: String(row.id || generateId("LNK")),
    objectId: row.object_id ?? null,
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    url: String(row.url ?? ""),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * @param {import("../stores/urlTableStore.js").UrlTableStoredEntry} entry
 * @param {string} userId
 * @param {string} now
 */
function entryToRow(entry, userId, now) {
  return {
    id: entry.id,
    user_id: userId,
    object_id: entry.objectId || null,
    name: entry.name ?? "",
    description: entry.description ?? "",
    url: entry.url ?? "",
    created_at: entry.createdAt || now,
    updated_at: now,
  };
}

let isHydrating = false;
let debouncedRemoteSync = null;

/** @param {import("../stores/urlTableStore.js").UrlTableStoredEntry[]} entries */
async function syncUrlTableToSupabase(entries) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[url-table] Sync skipped: no authenticated user session");
    return false;
  }

  const now = new Date().toISOString();
  const rows = entries.map((entry) => entryToRow(entry, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("url_table_entries")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert url_table_entries"));
      return false;
    }
  }

  const { data: remoteRows, error: selectErr } = await supabase
    .from("url_table_entries")
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.warn(formatSupabaseError(selectErr, "Select url_table_entries"));
    return false;
  }

  const localIds = new Set(entries.map((entry) => entry.id));
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));

  if (orphanIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("url_table_entries")
      .delete()
      .eq("user_id", userId)
      .in("id", orphanIds);
    if (deleteErr) {
      console.warn(formatSupabaseError(deleteErr, "Delete url_table_entries"));
      return false;
    }
  }

  return true;
}

/** @returns {Promise<import("../stores/urlTableStore.js").UrlTableStoredEntry[]|null>} */
export async function loadUrlTableFromSupabase() {
  const userId = await resolveSyncUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("url_table_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(formatSupabaseError(error, "Load url_table_entries"));
    return null;
  }

  return (data || []).map(rowToEntry);
}

/** Flush pending remote sync immediately (overlay Save). */
export async function flushUrlTableSync() {
  debouncedRemoteSync?.cancel();
  await syncUrlTableToSupabase(useUrlTableStore.getState().entries);
}

/**
 * @param {typeof import("../stores/urlTableStore.js").useUrlTableStore} useUrlTableStore
 */
export function initUrlTableSync(useUrlTableStore) {
  if (typeof window === "undefined") return;

  debouncedRemoteSync = debounce((entries) => {
    if (isHydrating) return;
    syncUrlTableToSupabase(entries);
  }, SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    const remoteEntries = await loadUrlTableFromSupabase();
    if (remoteEntries === null) return;

    isHydrating = true;
    try {
      if (remoteEntries.length > 0) {
        useUrlTableStore.getState().replaceEntries(remoteEntries);
      } else {
        const localEntries = useUrlTableStore.getState().entries;
        if (localEntries.length > 0) {
          await syncUrlTableToSupabase(localEntries);
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

  useUrlTableStore.subscribe((state) => {
    debouncedRemoteSync?.(state.entries);
  });
}
