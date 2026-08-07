/** Sidebar folder list order (Documents left panel). */

export const SIDEBAR_REORDER_MIME = "application/x-futura-nota-sidebar-reorder";

/** @param {unknown} value */
export function normalizeSidebarOrder(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Sort folders: explicit sidebarOrder first (asc), then title.
 * @param {Array<{ sidebarOrder?: number|null, title?: string }>} docs
 */
export function sortDocsBySidebarOrder(docs) {
  return [...(docs || [])].sort((a, b) => {
    const ao = normalizeSidebarOrder(a?.sidebarOrder);
    const bo = normalizeSidebarOrder(b?.sidebarOrder);
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (bo != null && ao == null) return 1;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

/**
 * Move `fromId` to the index of `toId` within `orderedIds`.
 * @param {string[]} orderedIds
 * @param {string} fromId
 * @param {string} toId
 * @returns {string[]|null} next order, or null if unchanged / invalid
 */
export function moveIdBeforeTarget(orderedIds, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null;
  const ids = Array.isArray(orderedIds) ? [...orderedIds] : [];
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return null;
  ids.splice(from, 1);
  ids.splice(to, 0, fromId);
  return ids;
}

/**
 * Assign dense sidebarOrder 0..n-1 for the given id sequence.
 * @param {string[]} orderedIds
 * @returns {Record<string, number>}
 */
export function sidebarOrderPatchForIds(orderedIds) {
  const patch = {};
  (orderedIds || []).forEach((id, index) => {
    if (id) patch[id] = index;
  });
  return patch;
}

/**
 * Next sidebarOrder for a newly created folder among siblings.
 * @param {Iterable<{ sidebarOrder?: number|null }>} siblings
 */
export function nextSidebarOrderAmong(siblings) {
  let max = -1;
  for (const doc of siblings || []) {
    const n = normalizeSidebarOrder(doc?.sidebarOrder);
    if (n != null && n > max) max = n;
  }
  return max + 1;
}
