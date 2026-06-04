import {
  formatProductSubcategoryLine,
  resolveSubcategoryLines,
} from "./templateDoc.js";

/**
 * Unique product lines for Content filter (subcategory match).
 * @param {import('../types/docs.js').Doc[]} productDocs
 */
export function buildContentFilterOptions(productDocs) {
  const seen = new Set();
  const options = [];

  for (const doc of productDocs || []) {
    const label = formatProductSubcategoryLine(doc)
      || doc.category?.trim()
      || doc.title?.trim()
      || "Untitled";
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ id: doc.id, label });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Unique categories for Products filter.
 * @param {import('../types/docs.js').Doc[]} productDocs
 */
export function buildCategoryFilterOptions(productDocs) {
  const seen = new Set();
  const options = [];

  for (const doc of productDocs || []) {
    const category = doc.category?.trim();
    if (!category) continue;
    const key = category.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ id: key, label: category });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * @param {import('../types/docs.js').Doc} productDoc
 * @param {string|null} categoryFilter
 */
export function productDocMatchesCategoryFilter(productDoc, categoryFilter) {
  if (!categoryFilter?.trim()) return true;
  const cat = productDoc.category?.trim() || "";
  return cat.toLowerCase().includes(categoryFilter.trim().toLowerCase());
}

/**
 * @param {import('../types/docs.js').Doc} contentDoc
 * @param {Record<string, import('../types/docs.js').Doc>} allDocs
 * @param {string|null} filterQuery
 */
export function contentDocMatchesProductFilter(contentDoc, allDocs, filterQuery) {
  if (!filterQuery?.trim()) return true;

  const q = filterQuery.trim().toLowerCase();
  const linked = contentDoc.subcategoryDocIds
    ?? contentDoc.templateSubcategoryDocIds
    ?? [];
  const lines = resolveSubcategoryLines(allDocs, linked);

  return lines.some((line) => line.label.toLowerCase().includes(q));
}

/** @deprecated use buildContentFilterOptions */
export function buildProductFilterOptions(productDocs) {
  return buildContentFilterOptions(productDocs);
}
