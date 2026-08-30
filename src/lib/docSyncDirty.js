/** Doc ids touched locally since last successful cloud upsert (or boot baseline). */

const dirtyDocIds = new Set();

/** @param {string|null|undefined} id */
export function markDocDirty(id) {
  const normalized = String(id ?? "").trim();
  if (normalized) dirtyDocIds.add(normalized);
}

/** @param {string|null|undefined} id */
export function clearDocDirty(id) {
  const normalized = String(id ?? "").trim();
  if (normalized) dirtyDocIds.delete(normalized);
}

export function clearAllDocDirty() {
  dirtyDocIds.clear();
}

/** @returns {Set<string>} */
export function getDirtyDocIds() {
  return dirtyDocIds;
}

/**
 * Re-mark docs edited after the last cloud sync baseline (e.g. after hydrate).
 * @param {Record<string, { updatedAt?: string, createdAt?: string }>} docs
 * @param {number} sinceMs
 */
export function markDocsDirtyIfNewerThan(docs, sinceMs) {
  if (!docs || typeof docs !== "object" || !Number.isFinite(sinceMs) || sinceMs <= 0) return;
  for (const [id, doc] of Object.entries(docs)) {
    if (!id || !doc) continue;
    const updatedMs = Date.parse(String(doc.updatedAt || "")) || 0;
    const createdMs = Date.parse(String(doc.createdAt || "")) || 0;
    if (Math.max(updatedMs, createdMs) > sinceMs) {
      dirtyDocIds.add(id);
    }
  }
}

/**
 * @param {Record<string, object>} docs
 * @returns {Record<string, object>}
 */
export function pickDirtyDocs(docs) {
  if (!docs || typeof docs !== "object") return {};
  if (dirtyDocIds.size === 0) return {};
  /** @type {Record<string, object>} */
  const out = {};
  for (const [id, doc] of Object.entries(docs)) {
    if (id && doc && dirtyDocIds.has(id)) out[id] = doc;
  }
  return out;
}
