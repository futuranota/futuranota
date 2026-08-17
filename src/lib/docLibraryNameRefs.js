import { generateId } from "./ids.js";
import { computeTextEditDelta } from "./docTextBoldRanges.js";

/**
 * Inline library Name refs in document prose.
 * Not a link: the stored `tag` is painted slightly bold so the writer
 * can see the name exists in this document's image fichas.
 *
 * @typedef {Object} DocLibraryNameRef
 * @property {string} id
 * @property {string} itemId
 * @property {string} tag
 * @property {string|null} setId
 * @property {number} start
 * @property {number} end
 * @property {string} insertedAt
 */

/**
 * @typedef {Object} LibraryNameQuery
 * @property {number} start
 * @property {number} end
 * @property {string} query
 */

const WORD_CHAR = /[A-Za-z0-9_-]/;
const MIN_QUERY = 2;

/** @param {unknown} value */
function asText(value) {
  return String(value ?? "");
}

export function normalizeLibraryNameKey(value) {
  return asText(value).trim().toLowerCase();
}

/**
 * @param {string} text
 * @param {unknown} refs
 * @returns {DocLibraryNameRef[]}
 */
export function normalizeLibraryNameRefs(text, refs) {
  const str = asText(text);
  if (!Array.isArray(refs) || refs.length === 0) return [];

  /** @type {DocLibraryNameRef[]} */
  const cleaned = [];
  for (const raw of refs) {
    if (!raw || typeof raw !== "object") continue;
    const tag = asText(raw.tag).trim();
    if (!tag) continue;
    let start = Number(raw.start);
    let end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    start = Math.max(0, Math.min(str.length, Math.floor(start)));
    end = Math.max(0, Math.min(str.length, Math.floor(end)));
    if (end <= start) continue;
    if (normalizeLibraryNameKey(str.slice(start, end)) !== normalizeLibraryNameKey(tag)) {
      continue;
    }
    cleaned.push({
      id: String(raw.id || generateId("LNR")),
      itemId: String(raw.itemId || ""),
      tag,
      setId: raw.setId == null ? null : String(raw.setId),
      start,
      end,
      insertedAt: String(raw.insertedAt || new Date().toISOString()),
    });
  }

  cleaned.sort((a, b) => a.start - b.start || a.end - b.end);
  /** @type {DocLibraryNameRef[]} */
  const nonOverlapping = [];
  for (const ref of cleaned) {
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (prev && ref.start < prev.end) continue;
    nonOverlapping.push(ref);
  }
  return nonOverlapping;
}

/**
 * Word-prefix query before the caret (no trigger char).
 * Skips `#` / `/` / `@` tokens and committed refs.
 *
 * @param {string} text
 * @param {number} caret
 * @param {DocLibraryNameRef[]|null|undefined} [refs]
 * @returns {LibraryNameQuery|null}
 */
export function getLibraryNameQueryAtCaret(text, caret, refs = null) {
  const str = asText(text);
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  if (pos === 0) return null;

  let start = pos;
  for (let i = pos - 1; i >= 0; i -= 1) {
    if (!WORD_CHAR.test(str[i])) break;
    start = i;
  }
  if (start === pos) return null;
  if (pos - start < MIN_QUERY) return null;

  if (start > 0) {
    const prev = str[start - 1];
    if (prev === "#" || prev === "/" || prev === "@" || prev === ".") return null;
    if (!/\s/.test(prev)) return null;
  }

  const committed = normalizeLibraryNameRefs(str, refs);
  if (committed.some((item) => start >= item.start && pos <= item.end)) return null;

  return {
    start,
    end: pos,
    query: str.slice(start, pos),
  };
}

/**
 * @param {Array<{ tag?: string, name?: string }>} candidates
 * @param {string} query
 * @param {number} [limit]
 */
export function filterLibraryNameCandidates(candidates, query, limit = 8) {
  const q = normalizeLibraryNameKey(query);
  if (!q || !Array.isArray(candidates)) return [];
  const matched = [];
  for (const item of candidates) {
    const tag = normalizeLibraryNameKey(item?.tag || item?.name);
    if (!tag) continue;
    if (tag.startsWith(q)) matched.push(item);
    if (matched.length >= limit) break;
  }
  return matched;
}

/**
 * @param {DocLibraryNameRef[]} refs
 * @param {number} editStart
 * @param {number} removedLength
 * @param {number} insertedLength
 * @param {string} nextText
 * @returns {DocLibraryNameRef[]}
 */
export function shiftLibraryNameRefs(refs, editStart, removedLength, insertedLength, nextText) {
  const editEnd = editStart + removedLength;
  const delta = insertedLength - removedLength;
  /** @type {DocLibraryNameRef[]} */
  const out = [];
  for (const ref of refs || []) {
    if (ref.end <= editStart) {
      out.push(ref);
      continue;
    }
    if (ref.start >= editEnd) {
      out.push({
        ...ref,
        start: ref.start + delta,
        end: ref.end + delta,
      });
      continue;
    }
  }
  return normalizeLibraryNameRefs(nextText, out);
}

/**
 * @param {string} prevText
 * @param {string} nextText
 * @param {DocLibraryNameRef[]} refs
 * @returns {DocLibraryNameRef[]}
 */
export function applyTextEditToLibraryNameRefs(prevText, nextText, refs) {
  if (asText(prevText) === asText(nextText)) {
    return normalizeLibraryNameRefs(nextText, refs);
  }
  const { editStart, removedLength, insertedLength } = computeTextEditDelta(prevText, nextText);
  return shiftLibraryNameRefs(refs, editStart, removedLength, insertedLength, nextText);
}

/**
 * @param {string} text
 * @param {DocLibraryNameRef[]} refs
 * @param {LibraryNameQuery} activeQuery
 * @param {{ id?: string, tag?: string, name?: string, setId?: string|null }} candidate
 * @returns {{ text: string, libraryNameRefs: DocLibraryNameRef[], caret: number }}
 */
export function insertLibraryNameRefAtQuery(text, refs, activeQuery, candidate) {
  const str = asText(text);
  const tag = asText(candidate?.tag || candidate?.name).trim();
  if (!tag || !activeQuery) {
    return {
      text: str,
      libraryNameRefs: normalizeLibraryNameRefs(str, refs),
      caret: str.length,
    };
  }

  const nextText = `${str.slice(0, activeQuery.start)}${tag}${str.slice(activeQuery.end)}`;
  const start = activeQuery.start;
  const end = start + tag.length;
  const cleared = shiftLibraryNameRefs(
    refs,
    activeQuery.start,
    activeQuery.end - activeQuery.start,
    tag.length,
    nextText,
  ).filter((item) => item.end <= start || item.start >= end);

  const nextRef = {
    id: generateId("LNR"),
    itemId: String(candidate?.id || ""),
    tag,
    setId: candidate?.setId == null ? null : String(candidate.setId),
    start,
    end,
    insertedAt: new Date().toISOString(),
  };

  return {
    text: nextText,
    libraryNameRefs: normalizeLibraryNameRefs(nextText, [...cleared, nextRef]),
    caret: end,
  };
}

/**
 * @param {DocLibraryNameRef[]} refs
 * @param {number} splitStart
 * @param {number} [splitEnd]
 * @returns {{ headRanges: DocLibraryNameRef[], tailRanges: DocLibraryNameRef[] }}
 */
export function splitLibraryNameRefsAt(refs, splitStart, splitEnd = splitStart) {
  /** @type {DocLibraryNameRef[]} */
  const headRanges = [];
  /** @type {DocLibraryNameRef[]} */
  const tailRanges = [];
  const lo = Number(splitStart);
  const hi = Number(splitEnd);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { headRanges, tailRanges };
  }

  for (const ref of refs || []) {
    if (!ref) continue;
    if (ref.end <= lo) {
      headRanges.push({ ...ref });
      continue;
    }
    if (ref.start >= hi) {
      tailRanges.push({
        ...ref,
        start: ref.start - hi,
        end: ref.end - hi,
      });
    }
  }
  return { headRanges, tailRanges };
}

/**
 * @param {string} leftText
 * @param {DocLibraryNameRef[]} leftRefs
 * @param {string} rightText
 * @param {DocLibraryNameRef[]} rightRefs
 * @param {string} [separator]
 */
export function mergeLibraryNameRefBlocks(leftText, leftRefs, rightText, rightRefs, separator = "\n") {
  const left = asText(leftText);
  const right = asText(rightText);
  const sep = asText(separator);
  const nextText = `${left}${sep}${right}`;
  const offset = left.length + sep.length;
  const shiftedRight = (rightRefs || []).map((ref) => ({
    ...ref,
    start: ref.start + offset,
    end: ref.end + offset,
  }));
  return {
    text: nextText,
    libraryNameRefs: normalizeLibraryNameRefs(nextText, [...(leftRefs || []), ...shiftedRight]),
  };
}
