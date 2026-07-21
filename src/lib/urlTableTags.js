/**
 * URL-table tag helpers.
 * Tags are unique case-insensitively within a single table (tableId).
 * The same tag text may appear in different tables of the same company.
 */

/**
 * @typedef {Object} UrlTableTagCandidate
 * @property {string} entryId
 * @property {string|null} tableId
 * @property {string|null} objectId
 * @property {string} tag
 * @property {string} name
 * @property {string} description
 * @property {string} url
 * @property {string} [tableTitle]
 * @property {string} [updatedAt]
 */

/** @param {unknown} value */
export function normalizeTagKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

/** @param {unknown} value */
export function formatMentionToken(value) {
  const tag = String(value ?? "").trim();
  if (!tag) return "";
  return tag.startsWith("@") ? tag : `@${tag}`;
}

/**
 * @param {Partial<UrlTableTagCandidate> & { id?: string, tag?: string }} entry
 * @returns {UrlTableTagCandidate|null}
 */
function toCandidate(entry) {
  if (!entry) return null;
  const tag = String(entry.tag ?? "").trim();
  if (!normalizeTagKey(tag)) return null;
  const entryId = String(entry.id || entry.entryId || "");
  if (!entryId) return null;
  return {
    entryId,
    tableId: entry.tableId ?? null,
    objectId: entry.objectId ?? null,
    tag,
    name: String(entry.name ?? ""),
    description: String(entry.description ?? ""),
    url: String(entry.url ?? ""),
    tableTitle: entry.tableTitle ? String(entry.tableTitle) : undefined,
    updatedAt: entry.updatedAt || "",
  };
}

/**
 * All tagged entries for a company (one candidate per entryId).
 * Duplicate tag text across tables is preserved for disambiguation.
 * @param {Array<Partial<UrlTableTagCandidate> & { id?: string, tag?: string }>} entries
 * @param {string|null} objectId
 * @returns {UrlTableTagCandidate[]}
 */
export function collectTagCandidatesForObject(entries, objectId) {
  if (!objectId || !Array.isArray(entries)) return [];
  const byId = new Map();

  for (const entry of entries) {
    if (!entry || entry.objectId !== objectId) continue;
    const candidate = toCandidate(entry);
    if (!candidate) continue;
    const prev = byId.get(candidate.entryId);
    if (!prev || String(candidate.updatedAt) > String(prev.updatedAt || "")) {
      byId.set(candidate.entryId, candidate);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const tagCmp = a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" });
    if (tagCmp !== 0) return tagCmp;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * Tagged entries for one table.
 * @param {Array<Partial<UrlTableTagCandidate> & { id?: string, tag?: string }>} entries
 * @param {string|null} tableId
 * @returns {UrlTableTagCandidate[]}
 */
export function collectTagCandidatesForTable(entries, tableId) {
  if (!tableId || !Array.isArray(entries)) return [];
  const byId = new Map();

  for (const entry of entries) {
    if (!entry || entry.tableId !== tableId) continue;
    const candidate = toCandidate(entry);
    if (!candidate) continue;
    byId.set(candidate.entryId, candidate);
  }

  return [...byId.values()].sort((a, b) => {
    const tagCmp = a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" });
    if (tagCmp !== 0) return tagCmp;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * Unique tag label strings for column pickers (dedupe by normalized tag).
 * @param {Array<{ tag?: string }>} entries
 * @returns {string[]}
 */
export function collectUniqueTagLabels(entries) {
  if (!Array.isArray(entries)) return [];
  const byKey = new Map();
  for (const entry of entries) {
    const tag = String(entry?.tag ?? "").trim();
    const key = normalizeTagKey(tag);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, tag);
  }
  return [...byKey.values()].sort((a, b) => (
    a.localeCompare(b, undefined, { sensitivity: "base" })
  ));
}

/**
 * @deprecated Prefer collectTagCandidatesForObject — kept for callers that still import the old name.
 */
export function collectUniqueTagsForObject(entries, objectId) {
  return collectTagCandidatesForObject(entries, objectId);
}

/**
 * Conflict within one table (case-insensitive).
 * @param {Array<{ id?: string, tableId?: string|null, tag?: string }>} entries
 * @param {string|null} tableId
 * @param {string} tag
 * @param {string|null} [excludeEntryId]
 * @returns {{ conflict: boolean, existingId: string|null }}
 */
export function findTagConflictInTable(entries, tableId, tag, excludeEntryId = null) {
  const key = normalizeTagKey(tag);
  if (!tableId || !key || !Array.isArray(entries)) {
    return { conflict: false, existingId: null };
  }

  for (const entry of entries) {
    if (!entry || entry.tableId !== tableId) continue;
    if (excludeEntryId && entry.id === excludeEntryId) continue;
    if (normalizeTagKey(entry.tag) === key) {
      return { conflict: true, existingId: entry.id || null };
    }
  }
  return { conflict: false, existingId: null };
}

/**
 * @deprecated Use findTagConflictInTable. Company-wide uniqueness is no longer the product rule.
 * Kept as a thin wrapper that still scopes by objectId for any leftover callers.
 */
export function findTagConflict(entries, objectId, tag, excludeEntryId = null) {
  const key = normalizeTagKey(tag);
  if (!objectId || !key || !Array.isArray(entries)) {
    return { conflict: false, existingId: null };
  }

  for (const entry of entries) {
    if (!entry || entry.objectId !== objectId) continue;
    if (excludeEntryId && entry.id === excludeEntryId) continue;
    if (normalizeTagKey(entry.tag) === key) {
      return { conflict: true, existingId: entry.id || null };
    }
  }
  return { conflict: false, existingId: null };
}

/**
 * @param {UrlTableTagCandidate[]} candidates
 * @param {string} query
 * @returns {UrlTableTagCandidate[]}
 */
export function filterTagCandidates(candidates, query) {
  const q = normalizeTagKey(String(query ?? "").replace(/^@/, ""));
  if (!q) return candidates;
  return candidates.filter((item) => {
    const tag = normalizeTagKey(item.tag);
    const name = normalizeTagKey(item.name);
    const description = normalizeTagKey(item.description);
    const tableTitle = normalizeTagKey(item.tableTitle);
    return (
      tag.includes(q)
      || name.includes(q)
      || description.includes(q)
      || tableTitle.includes(q)
    );
  });
}
