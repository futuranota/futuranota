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

function canBeginTokenAt(str, start) {
  if (start <= 0) return true;
  const prev = str[start - 1];
  if (prev === "#" || prev === "/" || prev === "@") return false;
  return /\s/.test(prev);
}

function scanTokenEndingAt(str, end) {
  let start = end;
  for (let i = end - 1; i >= 0; i -= 1) {
    if (!TOKEN_CHAR.test(str[i])) break;
    start = i;
  }
  if (end - start < MIN_FILE) return null;
  if (!canBeginTokenAt(str, start)) return null;
  return { start, fileQuery: str.slice(start, end) };
}

function matchLongestFileTagEndingAt(str, end, files) {
  if (!Array.isArray(files) || files.length === 0 || end <= 0) return null;
  let best = null;
  for (const item of files) {
    const tag = String(item?.tag || item?.name || "").trim();
    if (tag.length < MIN_FILE) continue;
    const start = end - tag.length;
    if (start < 0) continue;
    if (normalizeLibraryNameKey(str.slice(start, end)) !== normalizeLibraryNameKey(tag)) {
      continue;
    }
    if (!canBeginTokenAt(str, start)) continue;
    if (!best || tag.length > best.fileQuery.length) {
      best = { start, fileQuery: str.slice(start, end) };
    }
  }
  return best;
}

/**
 * Loose Prompt fichas (image / auto) that can be assigned into an asset.
 * @param {{ category?: string, setId?: string|null }|null|undefined} item
 */
export function isLibraryAssignPromptFile(item) {
  if (!item || item.setId) return false;
  const cat = String(item.category || "").trim().toLowerCase();
  return cat === "image" || cat === "auto";
}

/**
 * `recordatorio.scene01` token at the caret (file, then optional `.asset`).
 * Pass `files` so Names with spaces (`Art in Life.scene`) resolve to the full tag.
 * @param {unknown} text
 * @param {number} caret
 * @param {{ tag?: string, name?: string }[]} [files]
 * @returns {LibraryAssignPathQuery|null}
 */
export function getLibraryAssignPathAtCaret(text, caret, files = []) {
  const str = String(text ?? "");
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  if (pos === 0) return null;

  let foundDot = false;
  let dotIndex = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = str[i];
    if (ch === ".") {
      foundDot = true;
      dotIndex = i;
      break;
    }
    if (!TOKEN_CHAR.test(ch)) break;
  }

  // Known Prompt tag + last "." on this line: asset names may include spaces
  // (`recordatorio.scene 01`). A space right after the dot is prose (`Hello. World`).
  let lineDot = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = str[i];
    if (ch === "\n") break;
    if (ch === ".") {
      lineDot = i;
      break;
    }
  }
  if (lineDot >= 0) {
    const tagged = matchLongestFileTagEndingAt(str, lineDot, files);
    const assetQuery = str.slice(lineDot + 1, pos);
    if (tagged && !/^\s/.test(assetQuery)) {
      return {
        start: tagged.start,
        end: pos,
        raw: str.slice(tagged.start, pos),
        fileQuery: tagged.fileQuery,
        assetQuery,
        hasDot: true,
      };
    }
  }

  if (foundDot) {
    const filePart = matchLongestFileTagEndingAt(str, dotIndex, files)
      || scanTokenEndingAt(str, dotIndex);
    if (!filePart) return null;
    return {
      start: filePart.start,
      end: pos,
      raw: str.slice(filePart.start, pos),
      fileQuery: filePart.fileQuery,
      assetQuery: str.slice(dotIndex + 1, pos),
      hasDot: true,
    };
  }

  const filePart = scanTokenEndingAt(str, pos);
  if (!filePart) return null;
  return {
    start: filePart.start,
    end: pos,
    raw: filePart.fileQuery,
    fileQuery: filePart.fileQuery,
    assetQuery: "",
    hasDot: false,
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

function fileMenuRow(file) {
  return {
    id: `file:${file.id}`,
    kind: "file",
    tag: file.tag,
    name: file.tag,
    description: file.description || "",
    file,
  };
}

/**
 * Exact tag, or a single prefix match.
 * @param {{ tag?: string }[]} files
 * @param {string} fileQuery
 */
function resolveUniqueAssignFile(files, fileQuery) {
  const fileMatches = filterAssignByTag(files, fileQuery);
  const exact = fileMatches.filter(
    (file) => normalizeLibraryNameKey(file.tag) === normalizeLibraryNameKey(fileQuery),
  );
  const file = exact[0] || (fileMatches.length === 1 ? fileMatches[0] : null);
  return { fileMatches, file };
}

/**
 * Whether `.speak` should appear for the current asset suffix query (`s`, `sp`, …).
 * @param {string} assetQuery
 */
export function assignPathSpeakMatches(assetQuery = "") {
  const q = normalizeLibraryNameKey(assetQuery);
  if (!q) return true;
  return normalizeLibraryNameKey("speak").startsWith(q);
}

function speakMenuRow(file) {
  return {
    id: `speak:${file.id}`,
    kind: "speak",
    tag: "speak",
    name: "Speak",
    description: "Dialogue",
    file,
  };
}

/**
 * Autocomplete rows for a path query.
 * With a dot: unique Prompt → `.speak` + Assets; otherwise list matching Names.
 * @returns {Array<{ id: string, kind: "file"|"asset"|"speak", tag: string, name: string, description?: string, file?: object, asset?: object }>}
 */
export function listLibraryAssignMenuItems(path, files = [], assets = [], limit = 8) {
  if (!path) return [];
  if (!path.hasDot) {
    return filterAssignByTag(files, path.fileQuery)
      .slice(0, limit)
      .map(fileMenuRow);
  }

  const { fileMatches, file } = resolveUniqueAssignFile(files, path.fileQuery);
  if (!file) {
    return fileMatches.slice(0, limit).map(fileMenuRow);
  }

  /** @type {ReturnType<typeof fileMenuRow>[]} */
  const rows = [];
  if (assignPathSpeakMatches(path.assetQuery || "")) {
    rows.push(speakMenuRow(file));
  }
  rows.push(
    ...filterAssignByTag(assets, path.assetQuery || "")
      .map((asset) => ({
        id: `path:${file.id}:${asset.id}`,
        kind: "asset",
        tag: asset.tag,
        name: asset.tag,
        description: asset.description || "",
        file,
        asset,
      })),
  );
  return rows.slice(0, limit);
}

/**
 * Why the dotted assign menu has no rows.
 * @returns {"noFile"|"noAsset"|"noAssetMatch"|null}
 */
export function libraryAssignMenuEmptyReason(path, files = [], assets = []) {
  if (!path?.hasDot) return null;
  if (listLibraryAssignMenuItems(path, files, assets).length > 0) return null;
  const { file } = resolveUniqueAssignFile(files, path.fileQuery);
  if (!file) return "noFile";
  if (!Array.isArray(assets) || assets.length === 0) return "noAsset";
  return "noAssetMatch";
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
