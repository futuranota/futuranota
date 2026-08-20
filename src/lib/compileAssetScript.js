import { normalizeLibraryNameKey } from "./docLibraryNameRefs.js";
import { safeAssetFolderName } from "./libraryAssetZip.js";

export const SCRIPT_MANIFEST_FORMAT = "futura-nota-script-v1";

/**
 * @param {Array<{ ownerKind?: string, ownerId?: string, items?: object[] }>} catalogs
 * @returns {Map<string, object>}
 */
export function buildScriptCatalogMap(catalogs) {
  const map = new Map();
  const apply = (items, overwrite = false) => {
    for (const item of items || []) {
      const cat = String(item?.category || "").trim().toLowerCase();
      if (cat !== "image" && cat !== "auto") continue;
      const tag = String(item?.tag || "").trim();
      if (!tag) continue;
      const key = normalizeLibraryNameKey(tag);
      if (!overwrite && map.has(key)) continue;
      map.set(key, item);
    }
  };
  for (const catalog of catalogs || []) {
    if (String(catalog?.ownerKind || "") !== "document") {
      apply(catalog?.items, false);
    }
  }
  for (const catalog of catalogs || []) {
    if (String(catalog?.ownerKind || "") === "document") {
      apply(catalog?.items, true);
    }
  }
  return map;
}

/**
 * @param {object|null|undefined} item
 * @param {string} [fallbackTag]
 */
export function catalogItemToConstant(item, fallbackTag = "") {
  if (!item) return null;
  const tag = String(item.tag || fallbackTag || "").trim();
  if (!tag) return null;
  const stem = safeAssetFolderName(tag);
  const mediaUrl = String(item.mediaUrl || "").trim();
  return {
    tag,
    itemId: String(item.id || ""),
    prompt: String(item.description || "").trim(),
    image: mediaUrl ? `${stem}.webp` : null,
    wallColor: item.wallColor || null,
    mediaUrl: mediaUrl || null,
    stem,
  };
}

/**
 * @typedef {{ start: number, end: number, type: "text"|"ref"|"speak", tag?: string, itemId?: string, dialogue?: string, value?: string, stem?: string }} ScriptSegment
 */

/**
 * @param {string} text
 * @param {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} nameRefs
 * @param {import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[]} speakRefs
 * @param {Map<string, object>} catalogMap
 * @returns {ScriptSegment[]}
 */
export function buildScriptSegments(text, nameRefs = [], speakRefs = [], catalogMap = new Map()) {
  const str = String(text ?? "");
  if (!str) return [];

  /** @type {ScriptSegment[]} */
  const markers = [];

  for (const ref of nameRefs || []) {
    if (!ref) continue;
    const slice = str.slice(ref.start, ref.end);
    const key = normalizeLibraryNameKey(ref.tag);
    const item = catalogMap.get(key);
    if (!item) continue;
    markers.push({
      start: ref.start,
      end: ref.end,
      type: "ref",
      tag: ref.tag,
      itemId: String(item.id || ref.itemId || ""),
      stem: safeAssetFolderName(ref.tag),
    });
  }

  for (const ref of speakRefs || []) {
    if (!ref) continue;
    const key = normalizeLibraryNameKey(ref.tag);
    const item = catalogMap.get(key);
    if (!item) continue;
    markers.push({
      start: ref.start,
      end: ref.end,
      type: "speak",
      tag: ref.tag,
      itemId: String(item.id || ref.itemId || ""),
      dialogue: String(ref.dialogue || str.slice(ref.dialogueStart, ref.dialogueEnd)).trim(),
      stem: safeAssetFolderName(ref.tag),
    });
  }

  markers.sort((a, b) => a.start - b.start || a.end - b.end);

  /** @type {ScriptSegment[]} */
  const occupied = [];
  for (const marker of markers) {
    const prev = occupied[occupied.length - 1];
    if (prev && marker.start < prev.end) continue;
    occupied.push(marker);
  }

  /** @type {ScriptSegment[]} */
  const manualSpeaks = detectManualSpeakSegments(str, occupied, catalogMap);
  const merged = [...occupied, ...manualSpeaks].sort((a, b) => a.start - b.start || a.end - b.end);
  /** @type {ScriptSegment[]} */
  const events = [];
  for (const marker of merged) {
    const prev = events[events.length - 1];
    if (prev && marker.start < prev.end) continue;
    events.push(marker);
  }

  /** @type {ScriptSegment[]} */
  const segments = [];
  let cursor = 0;
  for (const event of events) {
    if (event.start > cursor) {
      segments.push({
        start: cursor,
        end: event.start,
        type: "text",
        value: str.slice(cursor, event.start),
      });
    }
    segments.push(event);
    cursor = event.end;
  }
  if (cursor < str.length) {
    segments.push({
      start: cursor,
      end: str.length,
      type: "text",
      value: str.slice(cursor),
    });
  }
  return segments;
}

/**
 * Manual `Tag "dialogue"` or `Tag: dialogue` (screenplay style).
 * @param {string} text
 * @param {ScriptSegment[]} occupied
 * @param {Map<string, object>} catalogMap
 * @returns {ScriptSegment[]}
 */
export function detectManualSpeakSegments(text, occupied, catalogMap) {
  const str = String(text ?? "");
  /** @type {ScriptSegment[]} */
  const out = [];
  const blocked = occupied.map((seg) => [seg.start, seg.end]);

  const isBlocked = (start, end) => blocked.some(
    ([lo, hi]) => start < hi && end > lo,
  );

  for (const [key, item] of catalogMap.entries()) {
    const tag = String(item?.tag || "").trim();
    if (!tag) continue;
    const tagRe = new RegExp(`(?:^|[\\s])(${escapeRegExp(tag)})\\b`, "gi");
    let match = tagRe.exec(str);
    while (match) {
      const tagStart = match.index + (match[0].length - match[1].length);
      const tagEnd = tagStart + match[1].length;
      const afterTag = str.slice(tagEnd);
      const quoted = afterTag.match(/^(?:\s+[^\s":\n]+)*\s*(["“])([\s\S]*?)\1/);
      if (quoted) {
        const fullEnd = tagEnd + quoted[0].length;
        if (!isBlocked(tagStart, fullEnd)) {
          out.push({
            start: tagStart,
            end: fullEnd,
            type: "speak",
            tag,
            itemId: String(item.id || ""),
            dialogue: quoted[2].trim(),
            stem: safeAssetFolderName(tag),
          });
        }
        match = tagRe.exec(str);
        continue;
      }
      const colon = str.slice(tagEnd).match(/^\s*:\s*([^\n]+)/);
      if (colon) {
        const fullEnd = tagEnd + colon[0].length;
        if (!isBlocked(tagStart, fullEnd)) {
          out.push({
            start: tagStart,
            end: fullEnd,
            type: "speak",
            tag,
            itemId: String(item.id || ""),
            dialogue: colon[1].trim(),
            stem: safeAssetFolderName(tag),
          });
        }
      }
      match = tagRe.exec(str);
    }
  }
  return out;
}

/** @param {string} value */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {ScriptSegment[]} segments
 */
export function segmentsToKlingText(segments) {
  let out = "";
  for (const seg of segments) {
    if (seg.type === "text") {
      out += seg.value || "";
      continue;
    }
    const handle = `@${seg.tag || ""}`;
    if (seg.type === "speak") {
      out += `${handle} "${String(seg.dialogue || "").replace(/"/g, '\\"')}"`;
      continue;
    }
    if (seg.type === "ref") {
      out += handle;
    }
  }
  return out;
}

/**
 * @param {ScriptSegment[]} segments
 * @param {Map<string, object>} catalogMap
 */
export function segmentsToConstants(segments, catalogMap) {
  /** @type {Record<string, ReturnType<typeof catalogItemToConstant>>} */
  const constants = {};
  for (const seg of segments) {
    if (seg.type !== "ref" && seg.type !== "speak") continue;
    const key = normalizeLibraryNameKey(seg.tag);
    if (constants[key]) continue;
    const item = catalogMap.get(key);
    const constant = catalogItemToConstant(item, seg.tag);
    if (constant) constants[key] = constant;
  }
  return constants;
}

/**
 * @param {{
 *   asset?: { tag?: string, id?: string },
 *   description?: string,
 *   libraryNameRefs?: import("./docLibraryNameRefs.js").DocLibraryNameRef[],
 *   librarySpeakRefs?: import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[],
 *   catalogs?: Array<{ ownerKind?: string, ownerId?: string, items?: object[] }>,
 * }} input
 */
export function compileAssetScript(input = {}) {
  const scriptPlain = String(input.description ?? "").trim();
  const catalogs = input.catalogs || [];
  const catalogMap = buildScriptCatalogMap(catalogs);
  const segments = buildScriptSegments(
    scriptPlain,
    input.libraryNameRefs,
    input.librarySpeakRefs,
    catalogMap,
  );
  const constants = segmentsToConstants(segments, catalogMap);
  const klingText = segmentsToKlingText(segments);
  const manifestSegments = segments.map(({ start, end, ...rest }) => rest);

  return {
    manifest: {
      format: SCRIPT_MANIFEST_FORMAT,
      asset: String(input.asset?.tag || "").trim(),
      assetId: String(input.asset?.id || "").trim(),
      scriptPlain,
      segments: manifestSegments,
      constants,
    },
    klingText,
  };
}

/**
 * Flatten catalogs to a single item list (doc overrides folder tags).
 * @param {Array<{ ownerKind?: string, items?: object[] }>} catalogs
 */
export function flattenScriptCatalogItems(catalogs) {
  const map = buildScriptCatalogMap(catalogs);
  return [...map.values()];
}
