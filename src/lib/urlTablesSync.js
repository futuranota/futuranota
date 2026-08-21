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

/**
 * Tombstones for tables deleted locally but possibly still present remotely.
 * Prevents hydrate from resurrecting ghost URL tables.
 * Cleared after a successful sync (orphan DELETE landed).
 * @type {Set<string>}
 */
const pendingDeletedTableIds = new Set();

/** @param {string|string[]} ids */
export function markUrlTableDeleted(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    if (id) pendingDeletedTableIds.add(String(id));
  }
}

/** @param {import("../stores/urlTablesStore.js").UrlTableMeta[]} tables */
async function syncUrlTablesToSupabase(tables) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[url-tables] Sync skipped: no authenticated user session");
    return false;
  }

  const now = new Date().toISOString();
  const liveTables = tables.filter((table) => !pendingDeletedTableIds.has(table.id));
  const rows = liveTables.map((table) => tableToRow(table, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("url_tables")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert url_tables"));
      // Missing kind column (migration not applied): retry without kind so
      // tables still sync; local affiliates kind is preserved via hydrate merge.
      const missingKind = /kind/i.test(String(error?.message || error?.details || ""));
      if (missingKind) {
        const rowsWithoutKind = rows.map(({ kind: _kind, ...rest }) => rest);
        const { error: retryError } = await supabase
          .from("url_tables")
          .upsert(rowsWithoutKind, { onConflict: "id" });
        if (retryError) {
          console.warn(formatSupabaseError(retryError, "Upsert url_tables (without kind)"));
          return false;
        }
        console.warn(
          "[url-tables] kind column missing — run supabase_url_tables_kind.sql so Affiliates persists remotely",
        );
      } else {
        return false;
      }
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

  const localIds = new Set(liveTables.map((table) => table.id));
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

  // Remote now mirrors local: tombstoned tables were deleted as orphans.
  pendingDeletedTableIds.clear();
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

/**
 * Merge remote tables into local without dropping local-only rows or wiping
 * `kind: affiliates` when the remote row still lacks / defaults the column.
 * Tombstoned ids are never reintroduced from remote or kept as local-only ghosts.
 * @param {import("../stores/urlTablesStore.js").UrlTableMeta[]} localTables
 * @param {import("../stores/urlTablesStore.js").UrlTableMeta[]} remoteTables
 */
export function mergeUrlTablesFromRemote(localTables, remoteTables) {
  const localList = Array.isArray(localTables) ? localTables : [];
  const remoteList = Array.isArray(remoteTables) ? remoteTables : [];
  const localById = new Map(localList.map((table) => [table.id, table]));
  const remoteIds = new Set(remoteList.map((table) => table.id));

  const merged = [];
  for (const remote of remoteList) {
    if (pendingDeletedTableIds.has(remote.id)) continue;
    const local = localById.get(remote.id);
    if (!local) {
      merged.push(remote);
      continue;
    }
    if (local.kind === "affiliates" && remote.kind !== "affiliates") {
      merged.push(normalizeUrlTableMeta({ ...remote, kind: "affiliates" }));
    } else {
      merged.push(remote);
    }
  }

  for (const local of localList) {
    if (pendingDeletedTableIds.has(local.id)) continue;
    if (!remoteIds.has(local.id)) {
      merged.push(local);
    }
  }

  return merged;
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
      const localTables = useUrlTablesStore.getState().tables;
      const merged = mergeUrlTablesFromRemote(localTables, remoteTables);
      const tombstonedRemote = remoteTables.some((table) => (
        pendingDeletedTableIds.has(table.id)
      ));

      if (remoteTables.length > 0 || tombstonedRemote || pendingDeletedTableIds.size > 0) {
        useUrlTablesStore.getState().replaceTables(merged);
      } else if (localTables.length > 0) {
        await syncUrlTablesToSupabase(localTables);
      }

      if (tombstonedRemote || pendingDeletedTableIds.size > 0) {
        await syncUrlTablesToSupabase(useUrlTablesStore.getState().tables);
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
      pendingDeletedTableIds.clear();
    }
  });

  useUrlTablesStore.subscribe((state) => {
    debouncedRemoteSync?.(state.tables);
  });
}
