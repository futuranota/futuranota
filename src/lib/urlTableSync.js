import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { useUrlTableStore } from "../stores/urlTableStore.js";
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

/** @param {unknown} value */
function toNullableNumber(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** @param {Record<string, unknown>} row */
function rowToEntry(row) {
  return {
    id: String(row.id || generateId("LNK")),
    objectId: row.object_id ?? null,
    tableId: row.table_id ?? null,
    name: String(row.name ?? ""),
    tag: String(row.tag ?? ""),
    category: String(row.category ?? ""),
    description: String(row.description ?? ""),
    url: String(row.url ?? ""),
    commissionRate: toNullableNumber(row.commission_rate),
    productPrice: toNullableNumber(row.product_price),
    cookieDays: toNullableNumber(row.cookie_days),
    affiliateStatus: String(row.affiliate_status ?? ""),
    activatedAt: row.activated_at ? String(row.activated_at) : null,
    clientsWon: Math.max(0, Math.floor(toNullableNumber(row.clients_won) ?? 0)),
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
    table_id: entry.tableId || null,
    name: entry.name ?? "",
    tag: entry.tag ?? "",
    category: entry.category ?? "",
    description: entry.description ?? "",
    url: entry.url ?? "",
    commission_rate: entry.commissionRate ?? null,
    product_price: entry.productPrice ?? null,
    cookie_days: entry.cookieDays ?? null,
    affiliate_status: entry.affiliateStatus ?? "",
    activated_at: entry.activatedAt || null,
    clients_won: entry.clientsWon ?? 0,
    created_at: entry.createdAt || now,
    updated_at: now,
  };
}

let isHydrating = false;
let debouncedRemoteSync = null;

/**
 * Tombstones for rows deleted locally but possibly still present remotely.
 * Prevents a hydrate that races the delete-flush from resurrecting them.
 * Cleared after a successful sync (which removes them remotely as orphans).
 * @type {Set<string>}
 */
const pendingDeletedEntryIds = new Set();

/** @param {string} id */
export function markUrlTableEntryDeleted(id) {
  if (id) pendingDeletedEntryIds.add(String(id));
}

/**
 * Merge remote entries with local ones instead of blindly replacing:
 * - tombstoned remote rows are dropped (delete-flush race);
 * - same id → keep the newer updatedAt;
 * - local-only rows (not yet flushed when the page reloaded) are kept.
 * @param {import("../stores/urlTableStore.js").UrlTableStoredEntry[]} remoteEntries
 * @param {import("../stores/urlTableStore.js").UrlTableStoredEntry[]} localEntries
 */
function mergeRemoteWithLocal(remoteEntries, localEntries) {
  const byId = new Map();
  let tombstonedCount = 0;
  for (const remote of remoteEntries) {
    if (pendingDeletedEntryIds.has(remote.id)) {
      tombstonedCount += 1;
      continue;
    }
    byId.set(remote.id, remote);
  }

  const localOnlyIds = [];
  for (const local of localEntries) {
    if (pendingDeletedEntryIds.has(local.id)) continue;
    const remote = byId.get(local.id);
    if (!remote) {
      byId.set(local.id, local);
      localOnlyIds.push(local.id);
      continue;
    }
    if (String(local.updatedAt || "") > String(remote.updatedAt || "")) {
      byId.set(local.id, local);
    }
  }

  return {
    merged: [...byId.values()],
    localOnlyIds,
    tombstonedCount,
  };
}

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

  // Remote now mirrors local: tombstoned rows were deleted as orphans.
  pendingDeletedEntryIds.clear();
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

    const localEntries = useUrlTableStore.getState().entries;
    const { merged, localOnlyIds, tombstonedCount } = mergeRemoteWithLocal(
      remoteEntries,
      localEntries,
    );

    // #region agent log
    fetch('http://127.0.0.1:7764/ingest/1d5b49ee-76e8-4907-8f7a-6cd7282ea736',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5c112'},body:JSON.stringify({sessionId:'b5c112',runId:'post-fix3',hypothesisId:'H-B',location:'urlTableSync.js:hydrateFromRemote',message:'remote hydrate merged with local',data:{remoteCount:remoteEntries.length,localCount:localEntries.length,mergedCount:merged.length,localOnlyIds,tombstonedCount},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    isHydrating = true;
    try {
      // Always apply merge result (including empty) so tombstoned deletes stick.
      useUrlTableStore.getState().replaceEntries(merged);
    } finally {
      isHydrating = false;
    }

    // Push local-only rows (or pending deletes) so remote catches up.
    if (localOnlyIds.length > 0 || tombstonedCount > 0
      || (merged.length > 0 && remoteEntries.length === 0)) {
      await syncUrlTableToSupabase(useUrlTableStore.getState().entries);
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
