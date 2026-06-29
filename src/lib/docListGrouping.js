/** @typedef {{ id: string, label: string, kind: string, docs: import("../types/docs.js").Doc[] }} DocSidebarGroup */

/**
 * Case-insensitive bucket key for a category string.
 * @param {string} category
 */
export function normalizeCategoryGroupKey(category) {
  return (category || "").trim().toLowerCase();
}

/**
 * Sidebar block headline — always lowercase (e.g. "blogs" whether typed Blogs or BLOGS).
 * @param {string} category
 */
export function normalizeCategoryGroupLabel(category) {
  return normalizeCategoryGroupKey(category);
}

/**
 * @param {import("../types/docs.js").Doc[]} docs
 */
function sortDocsByRecency(docs) {
  return [...docs].sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
}

/**
 * Sort product siblings: unversioned base first, then versions.
 * @param {import("../types/docs.js").Doc[]} docs
 */
function sortProductGroupDocs(docs) {
  return [...docs].sort((a, b) => {
    const aVer = a.version?.trim() || "";
    const bVer = b.version?.trim() || "";
    if (!aVer && bVer) return -1;
    if (aVer && !bVer) return 1;
    if (!aVer && !bVer) return 0;
    return aVer.localeCompare(bVer, undefined, { numeric: true });
  });
}

/**
 * Group docs by category field (case-insensitive). Docs without category → uncategorized.
 * @param {import("../types/docs.js").Doc[]} docs
 * @param {string} [uncategorizedLabel]
 * @param {{ sortMode?: 'recency' | 'product' }} [options]
 * @returns {DocSidebarGroup[]}
 */
export function groupDocsByCategory(docs, uncategorizedLabel = "Uncategorized", options = {}) {
  const sortMode = options.sortMode || "recency";
  /** @type {Map<string, import("../types/docs.js").Doc[]>} */
  const byCategory = new Map();
  /** @type {import("../types/docs.js").Doc[]} */
  const uncategorized = [];

  for (const doc of docs || []) {
    const raw = doc.category?.trim();
    if (!raw) {
      uncategorized.push(doc);
      continue;
    }
    const key = normalizeCategoryGroupKey(raw);
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(doc);
  }

  /** @type {DocSidebarGroup[]} */
  const groups = [...byCategory.entries()].map(([key, groupDocs]) => ({
    id: `category:${key}`,
    label: normalizeCategoryGroupLabel(key),
    kind: "category",
    docs: sortMode === "product"
      ? sortProductGroupDocs(groupDocs)
      : sortDocsByRecency(groupDocs),
  }));

  if (uncategorized.length) {
    groups.push({
      id: "uncategorized",
      label: uncategorizedLabel,
      kind: "uncategorized",
      docs: sortDocsByRecency(uncategorized),
    });
  }

  return groups.sort((a, b) => {
    if (a.kind === "uncategorized") return 1;
    if (b.kind === "uncategorized") return -1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * @param {import("../types/docs.js").Doc[]} contentDocs — already filtered
 * @param {string} [uncategorizedLabel]
 * @returns {DocSidebarGroup[]}
 */
export function groupContentDocsForSidebar(contentDocs, uncategorizedLabel = "Uncategorized") {
  return groupDocsByCategory(contentDocs, uncategorizedLabel, { sortMode: "recency" });
}

/**
 * @param {import("../types/docs.js").Doc[]} productDocs — already filtered
 * @param {string} [uncategorizedLabel]
 * @returns {DocSidebarGroup[]}
 */
export function groupProductDocsFromList(productDocs, uncategorizedLabel = "Uncategorized") {
  return groupDocsByCategory(productDocs, uncategorizedLabel, { sortMode: "product" });
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} allDocs
 * @param {string} parentObjectId
 * @param {string} [uncategorizedLabel]
 * @returns {DocSidebarGroup[]}
 */
export function groupProductDocsForSidebar(allDocs, parentObjectId, uncategorizedLabel = "Uncategorized") {
  if (!parentObjectId) return [];
  const flat = Object.values(allDocs || {}).filter((doc) => doc.parentObjectId === parentObjectId);
  return groupProductDocsFromList(flat, uncategorizedLabel);
}
