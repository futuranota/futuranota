import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { useUrlTablesStore, normalizeUrlTableMeta } from "../stores/urlTablesStore.js";
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
function rowToTable(row) {
  return normalizeUrlTableMeta({
    id: String(row.id || generateId("URLT")),
    objectId: row.object_id ?? null,
    title: String(row.title ?? ""),
    kind: row.kind,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  });
}

/**
 * @param {import("../stores/urlTablesStore.js").UrlTableMeta} table
 * @param {string} userId
 * @param {string} now
 */
function tableToRow(table, userId, now) {
  return {
    id: table.id,
    user_id: userId,
    object_id: table.objectId || null,
    title: table.title ?? "",
    kind: table.kind === "affiliates" ? "affiliates" : "links",
    created_at: table.createdAt || now,
    updated_at: now,
  };
}

let isHydrating = false;
let debouncedRemoteSync = null;

/** @param {import("../stores/urlTablesStore.js").UrlTableMeta[]} tables */
async function syncUrlTablesToSupabase(tables) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[url-tables] Sync skipped: no authenticated user session");
    return false;
  }

  const now = new Date().toISOString();
  const rows = tables.map((table) => tableToRow(table, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("url_tables")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert url_tables"));
      return false;
    }
  }

  const { data: remoteRows, error: selectErr } = await supabase
    .from("url_tables")
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.warn(formatSupabaseError(selectErr, "Select url_tables"));
    return false;
  }

  const localIds = new Set(tables.map((table) => table.id));
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));

  if (orphanIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("url_tables")
      .delete()
      .eq("user_id", userId)
      .in("id", orphanIds);
    if (deleteErr) {
      console.warn(formatSupabaseError(deleteErr, "Delete url_tables"));
      return false;
    }
  }

  return true;
}

/** @returns {Promise<import("../stores/urlTablesStore.js").UrlTableMeta[]|null>} */
export async function loadUrlTablesFromSupabase() {
  const userId = await resolveSyncUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("url_tables")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(formatSupabaseError(error, "Load url_tables"));
    return null;
  }

  return (data || []).map(rowToTable);
}

export async function flushUrlTablesSync() {
  debouncedRemoteSync?.cancel();
  await syncUrlTablesToSupabase(useUrlTablesStore.getState().tables);
}

/**
 * @param {typeof import("../stores/urlTablesStore.js").useUrlTablesStore} useUrlTablesStore
 */
export function initUrlTablesSync(useUrlTablesStore) {
  if (typeof window === "undefined") return;

  debouncedRemoteSync = debounce((tables) => {
    if (isHydrating) return;
    syncUrlTablesToSupabase(tables);
  }, SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    const remoteTables = await loadUrlTablesFromSupabase();
    if (remoteTables === null) return;

    isHydrating = true;
    try {
      if (remoteTables.length > 0) {
        useUrlTablesStore.getState().replaceTables(remoteTables);
      } else {
        const localTables = useUrlTablesStore.getState().tables;
        if (localTables.length > 0) {
          await syncUrlTablesToSupabase(localTables);
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

  useUrlTablesStore.subscribe((state) => {
    debouncedRemoteSync?.(state.tables);
  });
}
