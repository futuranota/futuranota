/**
 * Lightweight workspace version gate — skip full hydrate when cloud is not newer.
 * lastSyncedAt must only be written after a successful hydrate or cloud flush.
 */

export const LAST_SYNCED_AT_KEY = "futura-nota-last-synced-at-v1";

/** Tables included in the workspace hydrate SELECT *. */
export const WORKSPACE_VERSION_TABLES = [
  "companies",
  "campaigns",
  "nodes",
  "canvas_nodes",
  "canvas_connections",
  "groupings",
  "timelines",
];

/**
 * @param {unknown} value
 * @returns {number|null} epoch ms
 */
export function parseVersionMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {object} params
 * @param {string|null|undefined} params.lastSyncedAt
 * @param {string|null|undefined} params.remoteVersion
 * @param {boolean} params.hasPendingDeletes
 * @returns {boolean} true → skip the 7× SELECT *
 */
export function shouldSkipFullHydrate({
  lastSyncedAt,
  remoteVersion,
  hasPendingDeletes = false,
}) {
  if (hasPendingDeletes) return false;
  const localMs = parseVersionMs(lastSyncedAt);
  const remoteMs = parseVersionMs(remoteVersion);
  if (localMs == null || remoteMs == null) return false;
  // Remote newer → must hydrate. Equal or local ahead (after push) → skip.
  return remoteMs <= localMs;
}

/**
 * @param {Iterable<{ updated_at?: string, updatedAt?: string }|null|undefined>} rows
 * @returns {string|null} ISO max
 */
export function maxUpdatedAtFromRows(rows) {
  let maxMs = null;
  for (const row of rows || []) {
    if (!row) continue;
    const ms = parseVersionMs(row.updated_at ?? row.updatedAt);
    if (ms == null) continue;
    if (maxMs == null || ms > maxMs) maxMs = ms;
  }
  return maxMs == null ? null : new Date(maxMs).toISOString();
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string|null}
 */
export function maxIsoTimestamp(a, b) {
  const am = parseVersionMs(a);
  const bm = parseVersionMs(b);
  if (am == null && bm == null) return null;
  if (am == null) return typeof b === "string" ? b : new Date(bm).toISOString();
  if (bm == null) return typeof a === "string" ? a : new Date(am).toISOString();
  return am >= bm
    ? (typeof a === "string" ? a : new Date(am).toISOString())
    : (typeof b === "string" ? b : new Date(bm).toISOString());
}

/**
 * @returns {string|null}
 */
export function readLastSyncedAt() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_SYNCED_AT_KEY);
    if (!raw || !String(raw).trim()) return null;
    return parseVersionMs(raw) == null ? null : String(raw).trim();
  } catch {
    return null;
  }
}

/**
 * Persist only after successful hydrate / cloud flush.
 * @param {string|null|undefined} iso
 */
export function writeLastSyncedAt(iso) {
  if (typeof localStorage === "undefined") return;
  const ms = parseVersionMs(iso);
  if (ms == null) return;
  const normalized = new Date(ms).toISOString();
  try {
    localStorage.setItem(LAST_SYNCED_AT_KEY, normalized);
  } catch {
    // private mode / quota
  }
}

/**
 * Clear on sign-out so the next account does not inherit a stale gate.
 */
export function clearLastSyncedAt() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LAST_SYNCED_AT_KEY);
  } catch {
    // private mode / quota
  }
}

/**
 * Light version probe: RPC first, then per-table updated_at limit 1.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @returns {Promise<string|null>} ISO timestamp or null if empty / unavailable
 */
export async function fetchWorkspaceVersion(client, userId) {
  if (!client || !userId) return null;

  const { data: rpcData, error: rpcError } = await client.rpc("get_workspace_version", {
    p_user_id: userId,
  });

  if (!rpcError) {
    if (rpcData == null || rpcData === "") return null;
    const ms = parseVersionMs(rpcData);
    return ms == null ? null : new Date(ms).toISOString();
  }

  // RPC missing or denied — fall back to 7 light selects (updated_at only).
  const results = await Promise.all(
    WORKSPACE_VERSION_TABLES.map((table) =>
      client
        .from(table)
        .select("updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1),
    ),
  );

  let maxMs = null;
  for (const { data, error } of results) {
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    const ms = parseVersionMs(row?.updated_at);
    if (ms == null) continue;
    if (maxMs == null || ms > maxMs) maxMs = ms;
  }
  return maxMs == null ? null : new Date(maxMs).toISOString();
}
