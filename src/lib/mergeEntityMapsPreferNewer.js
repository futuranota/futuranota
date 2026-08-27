/**
 * Merge entity maps for hydrate: remote ids form the base; local can win content
 * or survive as local-only when unsynced / richer / keep predicate says so.
 *
 * @param {Record<string, object>} remoteMap
 * @param {Record<string, object>} localMap
 * @param {(item: object) => number} [contentLen]
 * @param {{
 *   lastSyncedAt?: string|null,
 *   allowAllLocalOnly?: boolean,
 *   preferRicherContent?: boolean,
 *   shouldKeepLocalOnly?: ((item: object) => boolean)|null,
 *   pendingDeletedIds?: Set<string>|Iterable<string>|null,
 *   parseVersionMs?: (value: unknown) => number,
 * }} [opts]
 * @returns {Record<string, object>}
 */
export function mergeEntityMapsPreferNewer(remoteMap, localMap, contentLen, opts = {}) {
  const remote = remoteMap && typeof remoteMap === "object" ? remoteMap : {};
  const local = localMap && typeof localMap === "object" ? localMap : {};
  const parseMs = typeof opts.parseVersionMs === "function"
    ? opts.parseVersionMs
    : (value) => Date.parse(String(value || "")) || 0;
  const lastSyncedMs = parseMs(opts.lastSyncedAt) || 0;
  const allowAllLocalOnly = Boolean(opts.allowAllLocalOnly);
  const preferRicherContent = Boolean(opts.preferRicherContent);
  const shouldKeepLocalOnly = typeof opts.shouldKeepLocalOnly === "function"
    ? opts.shouldKeepLocalOnly
    : null;
  const pendingDeletedIds = opts.pendingDeletedIds instanceof Set
    ? opts.pendingDeletedIds
    : new Set(opts.pendingDeletedIds || []);
  const out = {};
  const len = typeof contentLen === "function"
    ? contentLen
    : (item) => String(item?.content || item?.body || item?.title || "").length;

  for (const [id, remoteItem] of Object.entries(remote)) {
    if (!id || !remoteItem || typeof remoteItem !== "object") continue;
    if (pendingDeletedIds.has(id)) continue;
    const localItem = local[id];
    if (!localItem || typeof localItem !== "object") {
      out[id] = remoteItem;
      continue;
    }
    const localT = Date.parse(String(localItem.updatedAt || localItem.createdAt || "")) || 0;
    const remoteT = Date.parse(String(remoteItem.updatedAt || remoteItem.createdAt || "")) || 0;
    const localLen = len(localItem);
    const remoteLen = len(remoteItem);

    // Prefer strictly richer local body even when remote timestamp is newer
    // (stub upsert / partial cloud row after slow network).
    if (preferRicherContent && localLen > remoteLen) {
      out[id] = localItem;
    } else if (localT > remoteT) {
      out[id] = localItem;
    } else if (localT === remoteT && localLen > remoteLen) {
      out[id] = localItem;
    } else {
      out[id] = remoteItem;
    }
  }

  for (const [id, localItem] of Object.entries(local)) {
    if (!id || !localItem || typeof localItem !== "object") continue;
    if (out[id]) continue;
    if (pendingDeletedIds.has(id)) continue;
    if (allowAllLocalOnly) {
      out[id] = localItem;
      continue;
    }
    // No sync baseline: only keep local-only when remote has no membership yet
    // (true first sync). If remote already has rows, local-only = deleted/stale.
    if (lastSyncedMs <= 0) {
      if (Object.keys(remote).length === 0) out[id] = localItem;
      continue;
    }
    const updatedMs = Date.parse(String(localItem.updatedAt || "")) || 0;
    const createdMs = Date.parse(String(localItem.createdAt || "")) || 0;
    const localMs = Math.max(updatedMs, createdMs);
    // Unsynced create/edit after last successful cloud sync.
    if (localMs > lastSyncedMs) {
      out[id] = localItem;
      continue;
    }
    // Linked folder documents with node-body (e.g. /code) may have updatedAt ≤
    // lastSyncedAt when the cloud upsert missed but localStorage still holds content.
    if (shouldKeepLocalOnly?.(localItem)) {
      out[id] = localItem;
    }
  }
  return out;
}
