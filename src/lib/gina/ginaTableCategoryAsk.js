/**
 * Ask-then-filter categories on the last Gina table.
 * Live categories only (Birthday, etc.) — never a hardcoded cat list.
 */

import { foldGinaText } from "./ginaTimeScope.js";

function fold(s) {
  return foldGinaText(s);
}

/**
 * Real category labels from shown docs (skip empty / uncategorized).
 * @param {object[]} docs
 * @returns {string[]}
 */
export function liveCategoriesFromTableDocs(docs) {
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const d of Array.isArray(docs) ? docs : []) {
    const c = String(d?.category || d?.hierarchy?.category || "").trim();
    if (!c || c === "-" || c === "—") continue;
    const f = fold(c);
    if (!f || f === "uncategorized" || f === "sin categoria") continue;
    if (seen.has(f)) continue;
    seen.add(f);
    out.push(c);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * Also accept schema.valuesByKey.category.
 * @param {object[] | null | undefined} docs
 * @param {{ valuesByKey?: Record<string, string[]> } | null | undefined} schema
 */
export function liveCategoriesFromLastTable(docs, schema = null) {
  const fromDocs = liveCategoriesFromTableDocs(docs);
  if (fromDocs.length) return fromDocs;
  const raw = schema?.valuesByKey?.category;
  if (!Array.isArray(raw)) return [];
  return liveCategoriesFromTableDocs(raw.map((c) => ({ category: c })));
}

/**
 * @param {string} text
 * @returns {"include" | "exclude" | null}
 */
export function parseTableCategoryAskIntent(text) {
  const q = fold(text);
  if (!q || !/\bcategor/.test(q)) return null;
  if (
    /\bexclu\w*\b/.test(q)
    || /\bexclude\b/.test(q)
    || /\bsin\s+(esas\s+)?categor/.test(q)
  ) {
    return "exclude";
  }
  if (
    /\bfiltr\w*\b/.test(q)
    || /\bfiltramelo\b/.test(q)
    || /\bfilter\b/.test(q)
    || /\bpor\s+categor/.test(q)
  ) {
    return "include";
  }
  return null;
}

/**
 * Match one or more live category names mentioned in the user reply.
 * @param {string} text
 * @param {string[]} liveCats
 * @returns {string[]}
 */
export function parseLiveCategoriesFromReply(text, liveCats) {
  const q = fold(text);
  if (!q) return [];
  const list = Array.isArray(liveCats) ? liveCats : [];
  const sorted = [...list].sort((a, b) => fold(b).length - fold(a).length);
  /** @type {string[]} */
  const hits = [];
  const seen = new Set();
  let remaining = ` ${q} `;
  for (const cat of sorted) {
    const fc = fold(cat);
    if (!fc || fc.length < 2) continue;
    if (!remaining.includes(fc)) continue;
    if (seen.has(fc)) continue;
    seen.add(fc);
    hits.push(cat);
    remaining = remaining.split(fc).join(" ");
  }
  return hits;
}

/**
 * @param {{
 *   locale?: string,
 *   userName?: string | null,
 *   mode?: "include" | "exclude",
 * }} opts
 */
export function buildTableCategoryAskMessage(opts = {}) {
  const en = opts.locale === "en";
  const name = String(opts.userName || "").trim().split(/\s+/)[0] || "";
  const exclude = opts.mode === "exclude";
  if (en) {
    const ask = exclude
      ? "which categor(ies) would you like to exclude?"
      : "which categor(ies) would you like to filter?";
    return name ? `Ok ${name}, ${ask}` : `Ok — ${ask}`;
  }
  const ask = exclude
    ? "¿qué categoría te gustaría excluir?"
    : "¿qué categoría te gustaría filtrar?";
  return name ? `Ok ${name}, ${ask}` : `Ok — ${ask}`;
}

/**
 * @param {{
 *   locale?: string,
 *   mode?: "include" | "exclude",
 * }} opts
 */
export function buildTableCategoryAskEmptyMessage(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "This table has no categories to filter."
    : "Esta tabla no tiene categorías para filtrar.";
}

/**
 * @param {{
 *   locale?: string,
 *   mode?: "include" | "exclude",
 *   categories?: string[],
 *   count?: number,
 *   empty?: boolean,
 * }} opts
 */
export function buildTableCategoryFilterMessage(opts = {}) {
  const en = opts.locale === "en";
  const cats = (Array.isArray(opts.categories) ? opts.categories : []).filter(Boolean);
  const label = cats.join(", ");
  const n = Number(opts.count) || 0;
  const exclude = opts.mode === "exclude";
  if (opts.empty || n === 0) {
    if (en) {
      return exclude
        ? `No rows left after excluding «${label}».`
        : `In that table I found no rows in «${label}».`;
    }
    return exclude
      ? `No quedaron filas tras excluir «${label}».`
      : `En esa tabla no encontré filas en «${label}».`;
  }
  if (en) {
    return exclude
      ? `Here are ${n} row${n === 1 ? "" : "s"} excluding «${label}».`
      : `Here are ${n} row${n === 1 ? "" : "s"} for «${label}».`;
  }
  return exclude
    ? `Aquí tienes ${n === 1 ? "la fila" : `las ${n} filas`} excluyendo «${label}».`
    : `Aquí tienes ${n === 1 ? "la fila" : `las ${n} filas`} de «${label}».`;
}

/**
 * @param {object[]} docs
 * @param {string[]} categories
 * @param {"include" | "exclude"} mode
 */
export function filterDocsByLiveCategories(docs, categories, mode = "include") {
  const list = Array.isArray(docs) ? docs : [];
  const needles = (Array.isArray(categories) ? categories : [])
    .map((c) => fold(c))
    .filter(Boolean);
  if (!needles.length) return list;

  return list.filter((d) => {
    const cat = fold(d?.category);
    const hit = Boolean(cat) && needles.some((n) => cat === n || cat.includes(n) || n.includes(cat));
    return mode === "exclude" ? !hit : hit;
  });
}
