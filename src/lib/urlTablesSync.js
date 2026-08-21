import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { useUrlTablesStore, normalizeUrlTableMeta } from "../stores/urlTablesStore.js";
import { generateId } from "./ids.js";
import { resolveSyncUserId } from "./resolveSyncUserId.js";

const SYNC_DEBOUNCE_MS = 1500;
const URL_TABLE_TOMBSTONE_KEY = "futura-nota-url-table-deleted-v1";
const TOMBSTONE_CLEAR_GRACE_MS = 60_000;

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
 * @type {Set<string>}
 */
const pendingDeletedTableIds = new Set();
/** @type {Map<string, number>} */
const deletedTableMarkedAt = new Map();

function readUrlTableTombstoneLedger() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(URL_TABLE_TOMBSTONE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Union memory ∪ disk — never wipe another tab's table tombstones. */
function writeUrlTableTombstoneLedger() {
  if (typeof localStorage === "undefined") return;
  try {
    const existing = readUrlTableTombstoneLedger();
    const ids = new Set([
      ...(Array.isArray(existing?.ids) ? existing.ids : []).map(String),
      ...pendingDeletedTableIds,
    ]);
    const markedAt = {
      ...(existing?.markedAt && typeof existing.markedAt === "object" ? existing.markedAt : {}),
    };
    for (const id of pendingDeletedTableIds) {
      if (markedAt[id] == null) {
        markedAt[id] = deletedTableMarkedAt.get(id) || Date.now();
      }
    }
    localStorage.setItem(
      URL_TABLE_TOMBSTONE_KEY,
      JSON.stringify({ ids: [...ids], markedAt, updatedAt: Date.now() }),
    );
  } catch {
    // private mode / quota
  }
}

/** @param {string[]} clearedIds */
function removeIdsFromUrlTableTombstoneLedger(clearedIds) {
  if (typeof localStorage === "undefined") return;
  const remove = new Set((clearedIds || []).filter(Boolean).map(String));
  if (!remove.size) return;
  try {
    const existing = readUrlTableTombstoneLedger() || {};
    const prev = Array.isArray(existing.ids) ? existing.ids : [];
    const next = prev.filter((id) => id && !remove.has(String(id)));
    const markedAt = {
      ...(existing.markedAt && typeof existing.markedAt === "object" ? existing.markedAt : {}),
    };
    for (const id of remove) delete markedAt[id];
    localStorage.setItem(
      URL_TABLE_TOMBSTONE_KEY,
      JSON.stringify({ ids: next, markedAt, updatedAt: Date.now() }),
    );
  } catch {
    // private mode / quota
  }
}

function adoptUrlTableTombstoneLedger() {
  const ledger = readUrlTableTombstoneLedger();
  if (!ledger || typeof ledger !== "object") return;
  const ids = Array.isArray(ledger.ids) ? ledger.ids : [];
  const markedAt = ledger.markedAt && typeof ledger.markedAt === "object" ? ledger.markedAt : {};
  const now = Date.now();
  for (const id of ids) {
    if (!id) continue;
    const key = String(id);
    if (!pendingDeletedTableIds.has(key)) {
      pendingDeletedTableIds.add(key);
    }
    if (!deletedTableMarkedAt.has(key)) {
      const fromDisk = Number(markedAt[key]);
      deletedTableMarkedAt.set(key, Number.isFinite(fromDisk) && fromDisk > 0 ? fromDisk : now);
    }
  }
}

/** @param {string|string[]} ids */
export function markUrlTableDeleted(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  const now = Date.now();
  let changed = false;
  for (const id of list) {
    if (!id) continue;
    const key = String(id);
    if (!pendingDeletedTableIds.has(key)) {
      pendingDeletedTableIds.add(key);
      deletedTableMarkedAt.set(key, now);
      changed = true;
    }
  }
  if (changed) writeUrlTableTombstoneLedger();
}

/**
 * Drop tombstones only after remote SELECT proves gone + grace window.
 * @param {string} userId
 * @param {Set<string>} frozenDeleted
 */
async function clearUrlTableTombstonesConfirmedAbsent(userId, frozenDeleted) {
  const ids = [...frozenDeleted].filter(Boolean);
  if (!ids.length) return;
  const { data, error } = await supabase
    .from("url_tables")
    .select("id")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) {
    console.warn(formatSupabaseError(error, "Verify url_tables tombstones"));
    return;
  }
  const stillRemote = new Set((data || []).map((row) => row?.id).filter(Boolean));
  const now = Date.now();
  const cleared = [];
  for (const id of ids) {
    if (stillRemote.has(id)) continue;
    const markedAt = deletedTableMarkedAt.get(id);
    if (markedAt == null || now - markedAt < TOMBSTONE_CLEAR_GRACE_MS) continue;
    pendingDeletedTableIds.delete(id);
    deletedTableMarkedAt.delete(id);
    cleared.push(id);
  }
  if (cleared.length) {
    removeIdsFromUrlTableTombstoneLedger(cleared);
    writeUrlTableTombstoneLedger();
  }
}

/** @param {import("../stores/urlTablesStore.js").UrlTableMeta[]} tables */
async function syncUrlTablesToSupabase(tables) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[url-tables] Sync skipped: no authenticated user session");
    return false;
  }

  adoptUrlTableTombstoneLedger();
  const frozenDeleted = new Set(pendingDeletedTableIds);
  const now = new Date().toISOString();
  const liveTables = tables.filter((table) => !frozenDeleted.has(table.id));
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
  // Never treat tombstoned ids as "local" — they must stay in the orphan DELETE set.
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => id && !localIds.has(id));

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

  await clearUrlTableTombstonesConfirmedAbsent(userId, frozenDeleted);
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
  adoptUrlTableTombstoneLedger();
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

  adoptUrlTableTombstoneLedger();

  debouncedRemoteSync = debounce((tables) => {
    if (isHydrating) return;
    syncUrlTablesToSupabase(tables);
  }, SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    adoptUrlTableTombstoneLedger();
    const remoteTables = await loadUrlTablesFromSupabase();
    if (remoteTables === null) return;

    isHydrating = true;
    try {
      adoptUrlTableTombstoneLedger();
      const localTables = useUrlTablesStore.getState().tables;
      const merged = mergeUrlTablesFromRemote(localTables, remoteTables);
      const tombstonedRemote = remoteTables.some((table) => (
        pendingDeletedTableIds.has(table.id)
      ));

      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'040b1a'},body:JSON.stringify({sessionId:'040b1a',runId:'post-fix',hypothesisId:'H-URL',location:'urlTablesSync.js:hydrateFromRemote',message:'URL tables hydrate merge',data:{pending:[...pendingDeletedTableIds],remoteCount:remoteTables.length,localCount:localTables.length,mergedCount:merged.length,tombstonedRemote,skippedRemoteIds:remoteTables.filter((t)=>pendingDeletedTableIds.has(t.id)).map((t)=>t.id)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

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
      deletedTableMarkedAt.clear();
    }
  });

  useUrlTablesStore.subscribe((state) => {
    debouncedRemoteSync?.(state.tables);
  });
}
