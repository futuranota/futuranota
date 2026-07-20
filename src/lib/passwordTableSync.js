import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { usePasswordTableStore } from "../stores/passwordTableStore.js";
import { generateId } from "./ids.js";
import { resolveSyncUserId } from "./resolveSyncUserId.js";

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

/** @param {Record<string, unknown>} row */
function rowToEntry(row) {
  return {
    id: String(row.id || generateId("PWD")),
    objectId: row.object_id ?? null,
    description: String(row.description ?? ""),
    password: String(row.password ?? ""),
    tag: String(row.tag ?? ""),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * @param {import("../stores/passwordTableStore.js").PasswordTableStoredEntry} entry
 * @param {string} userId
 * @param {string} now
 */
function entryToRow(entry, userId, now) {
  return {
    id: entry.id,
    user_id: userId,
    object_id: entry.objectId || null,
    description: entry.description ?? "",
    password: entry.password ?? "",
    tag: entry.tag ?? "",
    created_at: entry.createdAt || now,
    updated_at: now,
  };
}

let isHydrating = false;
let debouncedRemoteSync = null;

/** @param {import("../stores/passwordTableStore.js").PasswordTableStoredEntry[]} entries */
async function syncPasswordTableToSupabase(entries) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[password-table] Sync skipped: no authenticated user session");
    return false;
  }

  const now = new Date().toISOString();
  const rows = entries.map((entry) => entryToRow(entry, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("password_table_entries")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert password_table_entries"));
      return false;
    }
  }

  const { data: remoteRows, error: selectErr } = await supabase
    .from("password_table_entries")
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.warn(formatSupabaseError(selectErr, "Select password_table_entries"));
    return false;
  }

  const localIds = new Set(entries.map((entry) => entry.id));
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));

  if (orphanIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("password_table_entries")
      .delete()
      .eq("user_id", userId)
      .in("id", orphanIds);
    if (deleteErr) {
      console.warn(formatSupabaseError(deleteErr, "Delete password_table_entries"));
      return false;
    }
  }

  return true;
}

/** @returns {Promise<import("../stores/passwordTableStore.js").PasswordTableStoredEntry[]|null>} */
export async function loadPasswordTableFromSupabase() {
  const userId = await resolveSyncUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("password_table_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(formatSupabaseError(error, "Load password_table_entries"));
    return null;
  }

  return (data || []).map(rowToEntry);
}

/** Flush pending remote sync immediately (overlay Save). */
export async function flushPasswordTableSync() {
  debouncedRemoteSync?.cancel();
  await syncPasswordTableToSupabase(usePasswordTableStore.getState().entries);
}

/**
 * @param {typeof import("../stores/passwordTableStore.js").usePasswordTableStore} usePasswordTableStore
 */
export function initPasswordTableSync(usePasswordTableStore) {
  if (typeof window === "undefined") return;

  debouncedRemoteSync = debounce((entries) => {
    if (isHydrating) return;
    syncPasswordTableToSupabase(entries);
  }, SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    const remoteEntries = await loadPasswordTableFromSupabase();
    if (remoteEntries === null) return;

    isHydrating = true;
    try {
      if (remoteEntries.length > 0) {
        usePasswordTableStore.getState().replaceEntries(remoteEntries);
      } else {
        const localEntries = usePasswordTableStore.getState().entries;
        if (localEntries.length > 0) {
          await syncPasswordTableToSupabase(localEntries);
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

  usePasswordTableStore.subscribe((state) => {
    debouncedRemoteSync?.(state.entries);
  });
}
