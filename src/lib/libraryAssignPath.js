import { normalizeLibraryNameKey } from "./docLibraryNameRefs.js";

const TOKEN_CHAR = /[A-Za-z0-9_-]/;
const MIN_FILE = 2;

/**
 * @typedef {Object} LibraryAssignPathQuery
 * @property {number} start
 * @property {number} end
 * @property {string} raw
 * @property {string} fileQuery
 * @property {string} assetQuery
 * @property {boolean} hasDot
 */

/**
 * `recordatorio.scene01` token at the caret (file, then optional `.asset`).
 * @param {unknown} text
 * @param {number} caret
 * @returns {LibraryAssignPathQuery|null}
 */
export function getLibraryAssignPathAtCaret(text, caret) {
  const str = String(text ?? "");
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  if (pos === 0) return null;

  let start = pos;
  let dots = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = str[i];
    if (TOKEN_CHAR.test(ch)) {
      start = i;
      continue;
    }
    if (ch === "." && dots === 0) {
      dots += 1;
      start = i;
      continue;
    }
    break;
  }
  if (start === pos) return null;
  if (start > 0) {
    const prev = str[start - 1];
    if (prev === "#" || prev === "/" || prev === "@") return null;
    if (!/\s/.test(prev)) return null;
  }

  const raw = str.slice(start, pos);
  const dot = raw.indexOf(".");
  if (dot < 0) {
    if (raw.length < MIN_FILE) return null;
    return {
      start,
      end: pos,
      raw,
      fileQuery: raw,
      assetQuery: "",
      hasDot: false,
    };
  }
  const fileQuery = raw.slice(0, dot);
  if (fileQuery.length < MIN_FILE) return null;
  return {
    start,
    end: pos,
    raw,
    fileQuery,
    assetQuery: raw.slice(dot + 1),
    hasDot: true,
  };
}

/**
 * @param {{ tag?: string }[]} items
 * @param {string} query
 * @param {boolean} [prefixOnly]
 */
export function filterAssignByTag(items, query, prefixOnly = true) {
  if (!Array.isArray(items)) return [];
  const q = normalizeLibraryNameKey(query);
  if (!q) return [...items];
  const matched = [];
  for (const item of items) {
    const tag = normalizeLibraryNameKey(item?.tag || item?.name);
    if (!tag) continue;
    if (prefixOnly ? tag.startsWith(q) : tag === q) matched.push(item);
  }
  return matched;
}

/**
 * Document files first; skip folder files that share a tag.
 * @param {object[]} documentItems
 * @param {object[]} folderItems
 */
export function mergeAssignFiles(documentItems = [], folderItems = []) {
  const seen = new Set();
  const out = [];
  for (const item of documentItems || []) {
    const tag = String(item?.tag || "").trim();
    if (!tag) continue;
    const key = normalizeLibraryNameKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, tag, sourceKind: "document" });
  }
  for (const item of folderItems || []) {
    const tag = String(item?.tag || "").trim();
    if (!tag) continue;
    const key = normalizeLibraryNameKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, tag, sourceKind: "folder" });
  }
  return out;
}

/**
 * Folder sources and document Images marked loop copy into the asset.
 * Loose document Images without loop move once.
 * @param {{ sourceKind?: string, loop?: boolean }|null|undefined} file
 */
export function shouldCloneLibraryAssign(file) {
  if (!file) return false;
  if (file.sourceKind === "folder") return true;
  return Boolean(file.loop);
}

/**
 * Autocomplete rows for a path query.
 * @returns {Array<{ id: string, kind: "file"|"asset", tag: string, name: string, description?: string, file?: object, asset?: object }>}
 */
export function listLibraryAssignMenuItems(path, files = [], assets = [], limit = 8) {
  if (!path) return [];
  if (!path.hasDot) {
    return filterAssignByTag(files, path.fileQuery)
      .slice(0, limit)
      .map((file) => ({
        id: `file:${file.id}`,
        kind: "file",
        tag: file.tag,
        name: file.tag,
        description: file.description || "",
        file,
      }));
  }

  const fileMatches = filterAssignByTag(files, path.fileQuery);
  const exact = fileMatches.filter(
    (file) => normalizeLibraryNameKey(file.tag) === normalizeLibraryNameKey(path.fileQuery),
  );
  const file = (exact[0] || (fileMatches.length === 1 ? fileMatches[0] : null));
  if (!file) return [];

  return filterAssignByTag(assets, path.assetQuery || "")
    .slice(0, limit)
    .map((asset) => {
      const label = `${file.tag}.${asset.tag}`;
      return {
        id: `path:${file.id}:${asset.id}`,
        kind: "asset",
        tag: label,
        name: label,
        description: asset.description || "",
        file,
        asset,
      };
    });
}

/**
 * Replace the live token with `file.asset` or `file.`.
 * @param {string} text
 * @param {LibraryAssignPathQuery} path
 * @param {string} nextToken
 */
export function replaceLibraryAssignPathToken(text, path, nextToken) {
  const str = String(text ?? "");
  if (!path) return { text: str, caret: str.length };
  const token = String(nextToken || "");
  const next = `${str.slice(0, path.start)}${token}${str.slice(path.end)}`;
  return { text: next, caret: path.start + token.length };
}
