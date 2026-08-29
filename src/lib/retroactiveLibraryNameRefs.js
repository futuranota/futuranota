import { generateId } from "./ids.js";
import {
  normalizeLibraryNameKey,
  normalizeLibraryNameRefs,
} from "./docLibraryNameRefs.js";
import {
  libraryItemLoops,
  listLibraryItems,
  normalizeLibraryAliases,
} from "./folderLibrary.js";
import { NODE_BLOCK_TYPES } from "./nodeInlineContent.js";

const LETTER_OR_DIGIT = /[A-Za-z0-9]/;
const MIN_TAG_LEN = 2;

/** @param {unknown} value */
function asText(value) {
  return String(value ?? "");
}

/**
 * Soft word start: whitespace, start of string, or punctuation/symbols.
 * Blocks mid-word letters/digits and system prefixes `#` `@` `/`.
 * @param {string} str
 * @param {number} start
 */
function canBeginTokenAt(str, start) {
  if (start <= 0) return true;
  const prev = str[start - 1];
  if (prev === "#" || prev === "/" || prev === "@") return false;
  if (LETTER_OR_DIGIT.test(prev)) return false;
  return true;
}

/**
 * Soft word end: allow punctuation (`casa/`, `casa.`, `casa,`) and hyphens.
 * Only reject letter/digit continuation (`casamiento`).
 * @param {string} str
 * @param {number} end
 */
function canEndTokenAt(str, end) {
  if (end >= str.length) return true;
  return !LETTER_OR_DIGIT.test(str[end]);
}

/**
 * @param {unknown} item
 */
export function isRetroactivePromptItem(item) {
  if (!item || item.setId) return false;
  const tag = asText(item.tag).trim();
  if (!tag) return false;
  const cat = asText(item.category).trim().toLowerCase();
  return cat === "image" || cat === "auto";
}

/**
 * Canonical name + aliases, longest first (prefer "mi hermana" over "hermana").
 * @param {{ tag?: string, aliases?: unknown }} item
 * @returns {string[]}
 */
export function listLibraryItemMatchPhrases(item) {
  const tag = asText(item?.tag).trim();
  const aliases = normalizeLibraryAliases(item?.aliases, tag);
  /** @type {string[]} */
  const phrases = [];
  const seen = new Set();
  for (const phrase of [tag, ...aliases]) {
    const trimmed = asText(phrase).trim();
    if (trimmed.length < MIN_TAG_LEN) continue;
    const key = normalizeLibraryNameKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phrases.push(trimmed);
  }
  phrases.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return phrases;
}

/**
 * Exact phrase matches at word boundaries (single token or multi-word).
 * @param {unknown} text
 * @param {unknown} tag
 * @returns {Array<{ start: number, end: number }>}
 */
export function findLibraryTagMatches(text, tag) {
  const str = asText(text);
  const needle = asText(tag).trim().replace(/\s+/g, " ");
  if (!needle || needle.length < MIN_TAG_LEN) return [];

  const key = normalizeLibraryNameKey(needle);
  /** @type {Array<{ start: number, end: number }>} */
  const matches = [];

  for (let i = 0; i < str.length; i += 1) {
    if (!canBeginTokenAt(str, i)) continue;
    // Allow flexible whitespace inside multi-word needles by scanning char-by-char.
    let ti = i;
    let ni = 0;
    let ok = true;
    while (ni < needle.length && ti < str.length) {
      const nCh = needle[ni];
      if (/\s/.test(nCh)) {
        if (!/\s/.test(str[ti])) {
          ok = false;
          break;
        }
        while (ti < str.length && /\s/.test(str[ti])) ti += 1;
        while (ni < needle.length && /\s/.test(needle[ni])) ni += 1;
        continue;
      }
      if (str[ti].toLowerCase() !== nCh.toLowerCase()) {
        ok = false;
        break;
      }
      ti += 1;
      ni += 1;
    }
    if (!ok || ni < needle.length) continue;
    const end = ti;
    if (!canEndTokenAt(str, end)) continue;
    // Confirm normalized equality (handles case).
    if (normalizeLibraryNameKey(str.slice(i, end).replace(/\s+/g, " ")) !== key) continue;
    matches.push({ start: i, end });
    i = end - 1;
  }

  return matches;
}

/**
 * All non-overlapping matches for an item (tag + aliases), reading order.
 * @param {unknown} text
 * @param {{ tag?: string, aliases?: unknown }} item
 * @returns {Array<{ start: number, end: number, phrase: string }>}
 */
export function findLibraryItemMatches(text, item) {
  const phrases = listLibraryItemMatchPhrases(item);
  /** @type {Array<{ start: number, end: number, phrase: string }>} */
  const candidates = [];
  for (const phrase of phrases) {
    for (const match of findLibraryTagMatches(text, phrase)) {
      candidates.push({ ...match, phrase });
    }
  }
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  /** @type {Array<{ start: number, end: number, phrase: string }>} */
  const out = [];
  for (const match of candidates) {
    if (out.some((prev) => !(match.end <= prev.start || match.start >= prev.end))) continue;
    out.push(match);
  }
  return out;
}

/**
 * @param {number} start
 * @param {number} end
 * @param {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} refs
 */
function spanIsCovered(start, end, refs) {
  return (refs || []).some((ref) => !(end <= ref.start || start >= ref.end));
}

/**
 * @param {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} refs
 * @param {string} itemId
 */
export function documentHasLibraryNameRefForItem(refs, itemId) {
  const id = asText(itemId).trim();
  if (!id) return false;
  return (refs || []).some((ref) => ref.itemId === id);
}

/**
 * Collect refs across all TEXT blocks in reading order.
 * @param {object[]} blocks
 */
export function collectLibraryNameRefsFromBlocks(blocks) {
  /** @type {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} */
  const out = [];
  for (const block of blocks || []) {
    if (block?.type !== NODE_BLOCK_TYPES.TEXT) continue;
    out.push(...(block.libraryNameRefs || []));
  }
  return out;
}

/**
 * @param {string} text
 * @param {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} existingRefs
 * @param {{ id?: string, tag?: string, aliases?: unknown, setId?: string|null }} item
 * @param {{ loops?: boolean, allowMatch?: boolean }} options
 */
export function applyRetroactiveRefsToTextBlock(text, existingRefs, item, options = {}) {
  const str = asText(text);
  const itemId = asText(item?.id).trim();
  const loops = Boolean(options.loops);
  const allowMatch = options.allowMatch !== false;

  const withoutItem = (existingRefs || []).filter((ref) => ref.itemId !== itemId);
  let refs = normalizeLibraryNameRefs(str, withoutItem);
  if (!itemId || !allowMatch || !listLibraryItemMatchPhrases(item).length) {
    return {
      libraryNameRefs: refs.length ? refs : [],
    };
  }

  const matches = findLibraryItemMatches(str, item);
  const selected = loops ? matches : matches.slice(0, 1);

  for (const match of selected) {
    if (spanIsCovered(match.start, match.end, refs)) continue;
    // Store the prose phrase as tag so normalizeLibraryNameRefs accepts the span.
    const phrase = str.slice(match.start, match.end);
    refs = normalizeLibraryNameRefs(str, [
      ...refs,
      {
        id: generateId("LNR"),
        itemId,
        tag: phrase,
        setId: item?.setId == null ? null : String(item.setId),
        start: match.start,
        end: match.end,
        insertedAt: new Date().toISOString(),
      },
    ]);
    if (!loops) break;
  }

  return {
    libraryNameRefs: refs.length ? refs : [],
  };
}

/**
 * @param {object} block
 */
function blockLibraryRefsSignature(block) {
  if (block?.type !== NODE_BLOCK_TYPES.TEXT) return "";
  return (block.libraryNameRefs || [])
    .map((ref) => `${ref.itemId}:${ref.start}:${ref.end}:${ref.tag}`)
    .join("|");
}

/**
 * @param {object[]} blocks
 * @param {{ id?: string, tag?: string, aliases?: unknown, setId?: string|null, loop?: boolean, sourceKind?: string, category?: string }} item
 * @param {"folder"|"document"|string} ownerKind
 */
export function applyRetroactiveItemToWritingBlocks(blocks, item, ownerKind) {
  const normalized = Array.isArray(blocks) ? blocks : [];
  const itemId = asText(item?.id).trim();
  if (!itemId || !isRetroactivePromptItem(item)) {
    return { blocks: normalized, changed: false };
  }

  const loops = libraryItemLoops(ownerKind, item);
  const beforeSignatures = normalized.map(blockLibraryRefsSignature);

  let nextBlocks = normalized.map((block) => {
    if (block?.type !== NODE_BLOCK_TYPES.TEXT) return block;
    const refs = (block.libraryNameRefs || []).filter((ref) => ref.itemId !== itemId);
    return {
      ...block,
      libraryNameRefs: refs.length ? refs : undefined,
    };
  });

  let placedNonLoopRef = false;

  nextBlocks = nextBlocks.map((block) => {
    if (block?.type !== NODE_BLOCK_TYPES.TEXT) return block;
    const text = block.text || "";
    const existingRefs = block.libraryNameRefs || [];

    if (!loops && placedNonLoopRef) {
      return block;
    }

    const result = applyRetroactiveRefsToTextBlock(text, existingRefs, item, {
      loops,
      allowMatch: loops || !placedNonLoopRef,
    });

    const nextRefs = result.libraryNameRefs;
    if (!loops && nextRefs.length > existingRefs.length) placedNonLoopRef = true;

    return {
      ...block,
      libraryNameRefs: nextRefs.length ? nextRefs : undefined,
    };
  });

  const afterSignatures = nextBlocks.map(blockLibraryRefsSignature);
  const changed = beforeSignatures.some((sig, index) => sig !== afterSignatures[index]);

  return { blocks: nextBlocks, changed };
}

/**
 * @typedef {Object} RetroactiveCatalogEntry
 * @property {object} item
 * @property {"folder"|"document"} ownerKind
 */

/**
 * @param {string} documentId
 * @param {string} folderId
 * @returns {RetroactiveCatalogEntry[]}
 */
export function buildRetroactiveCatalogForDocument(documentId, folderId) {
  const docId = asText(documentId).trim();
  const foldId = asText(folderId).trim();
  /** @type {RetroactiveCatalogEntry[]} */
  const catalog = [];
  const seen = new Set();

  const docItems = docId
    ? listLibraryItems("document", docId).filter(isRetroactivePromptItem)
    : [];
  for (const item of docItems) {
    const key = normalizeLibraryNameKey(item.tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    catalog.push({ item, ownerKind: "document" });
  }

  const folderItems = foldId
    ? listLibraryItems("folder", foldId).filter(isRetroactivePromptItem)
    : [];
  for (const item of folderItems) {
    const key = normalizeLibraryNameKey(item.tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    catalog.push({ item, ownerKind: "folder" });
  }

  return catalog;
}

/**
 * @param {object[]} blocks
 * @param {string} documentId
 * @param {string} folderId
 */
export function reconcileDocumentRetroactiveRefs(blocks, documentId, folderId) {
  const catalog = buildRetroactiveCatalogForDocument(documentId, folderId);
  let next = Array.isArray(blocks) ? blocks : [];
  let changed = false;
  for (const { item, ownerKind } of catalog) {
    const result = applyRetroactiveItemToWritingBlocks(next, item, ownerKind);
    next = result.blocks;
    if (result.changed) changed = true;
  }
  return { blocks: next, changed };
}

/**
 * Apply retroactive refs for a single saved library item on writing blocks.
 * @param {object[]} blocks
 * @param {object} item
 * @param {"folder"|"document"|string} ownerKind
 */
export function applySavedItemRetroactiveRefs(blocks, item, ownerKind) {
  return applyRetroactiveItemToWritingBlocks(blocks, item, ownerKind);
}
