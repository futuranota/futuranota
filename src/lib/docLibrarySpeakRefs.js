import { generateId } from "./ids.js";
import { computeTextEditDelta } from "./docTextBoldRanges.js";
import { normalizeLibraryNameKey } from "./docLibraryNameRefs.js";

/**
 * Structured dialogue captured via `tag.speak ""…""` or detected on export.
 *
 * @typedef {Object} DocLibrarySpeakRef
 * @property {string} id
 * @property {string} itemId
 * @property {string} tag
 * @property {number} start Span of full speak token incl. quotes
 * @property {number} end
 * @property {number} dialogueStart Inner quote content
 * @property {number} dialogueEnd
 * @property {string} dialogue
 * @property {string} insertedAt
 */

/** @param {unknown} value */
function asText(value) {
  return String(value ?? "");
}

/**
 * @param {string} text
 * @param {unknown} refs
 * @returns {DocLibrarySpeakRef[]}
 */
export function normalizeLibrarySpeakRefs(text, refs) {
  const str = asText(text);
  if (!Array.isArray(refs) || refs.length === 0) return [];

  /** @type {DocLibrarySpeakRef[]} */
  const cleaned = [];
  for (const raw of refs) {
    if (!raw || typeof raw !== "object") continue;
    const tag = asText(raw.tag).trim();
    if (!tag) continue;
    let start = Number(raw.start);
    let end = Number(raw.end);
    let dialogueStart = Number(raw.dialogueStart);
    let dialogueEnd = Number(raw.dialogueEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (!Number.isFinite(dialogueStart) || !Number.isFinite(dialogueEnd)) continue;
    start = Math.max(0, Math.min(str.length, Math.floor(start)));
    end = Math.max(0, Math.min(str.length, Math.floor(end)));
    dialogueStart = Math.max(start, Math.min(end, Math.floor(dialogueStart)));
    dialogueEnd = Math.max(dialogueStart, Math.min(end, Math.floor(dialogueEnd)));
    if (end <= start || dialogueEnd < dialogueStart) continue;
    const dialogue = asText(raw.dialogue).trim() || str.slice(dialogueStart, dialogueEnd).trim();
    cleaned.push({
      id: String(raw.id || generateId("LSR")),
      itemId: String(raw.itemId || ""),
      tag,
      start,
      end,
      dialogueStart,
      dialogueEnd,
      dialogue,
      insertedAt: String(raw.insertedAt || new Date().toISOString()),
    });
  }

  cleaned.sort((a, b) => a.start - b.start || a.end - b.end);
  /** @type {DocLibrarySpeakRef[]} */
  const nonOverlapping = [];
  for (const ref of cleaned) {
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (prev && ref.start < prev.end) continue;
    nonOverlapping.push(ref);
  }
  return nonOverlapping;
}

/**
 * @param {DocLibrarySpeakRef[]} refs
 * @param {number} editStart
 * @param {number} removedLength
 * @param {number} insertedLength
 * @param {string} nextText
 * @returns {DocLibrarySpeakRef[]}
 */
export function shiftLibrarySpeakRefs(refs, editStart, removedLength, insertedLength, nextText) {
  const editEnd = editStart + removedLength;
  const delta = insertedLength - removedLength;
  /** @type {DocLibrarySpeakRef[]} */
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
        dialogueStart: ref.dialogueStart + delta,
        dialogueEnd: ref.dialogueEnd + delta,
      });
    }
  }
  return normalizeLibrarySpeakRefs(nextText, out);
}

/**
 * @param {string} prevText
 * @param {string} nextText
 * @param {DocLibrarySpeakRef[]} refs
 * @returns {DocLibrarySpeakRef[]}
 */
export function applyTextEditToLibrarySpeakRefs(prevText, nextText, refs) {
  if (asText(prevText) === asText(nextText)) {
    return normalizeLibrarySpeakRefs(nextText, refs);
  }
  const { editStart, removedLength, insertedLength } = computeTextEditDelta(prevText, nextText);
  return shiftLibrarySpeakRefs(refs, editStart, removedLength, insertedLength, nextText);
}

/**
 * Detect `tag.speak` path ending at caret (before Enter opens quotes).
 * @param {unknown} text
 * @param {number} caret
 * @param {{ tag?: string }[]} [files]
 * @returns {{ start: number, end: number, tag: string, fileQuery: string }|null}
 */
export function getLibrarySpeakPathAtCaret(text, caret, files = []) {
  const str = asText(text);
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  if (pos === 0) return null;

  let dotIndex = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = str[i];
    if (ch === ".") {
      dotIndex = i;
      break;
    }
    if (!/[A-Za-z0-9_-]/.test(ch)) break;
  }
  if (dotIndex < 0) return null;

  const suffix = str.slice(dotIndex + 1, pos);
  if (normalizeLibraryNameKey(suffix) !== "speak") return null;

  let fileStart = dotIndex;
  for (let i = dotIndex - 1; i >= 0; i -= 1) {
    if (!/[A-Za-z0-9_-]/.test(str[i])) break;
    fileStart = i;
  }
  if (dotIndex - fileStart < 2) return null;
  if (fileStart > 0 && !/\s/.test(str[fileStart - 1])) return null;

  const fileQuery = str.slice(fileStart, dotIndex);
  let tag = fileQuery;
  if (Array.isArray(files) && files.length > 0) {
    const q = normalizeLibraryNameKey(fileQuery);
    const exact = files.find(
      (item) => normalizeLibraryNameKey(item?.tag || item?.name) === q,
    );
    if (exact) tag = String(exact.tag || exact.name || "").trim();
  }
  if (!tag) return null;

  return { start: fileStart, end: pos, tag, fileQuery };
}

/**
 * Replace `tag.speak` with `tag ""` and place caret inside quotes.
 * @param {string} text
 * @param {{ start: number, end: number, tag: string }} path
 * @param {{ id?: string, itemId?: string }} [candidate]
 */
export function openLibrarySpeakQuotes(text, path, candidate = {}) {
  const str = asText(text);
  if (!path) return { text: str, caret: str.length, speakRef: null };
  const tag = asText(path.tag).trim();
  const replacement = `${tag} ""`;
  const nextText = `${str.slice(0, path.start)}${replacement}${str.slice(path.end)}`;
  const start = path.start;
  const end = start + replacement.length;
  const dialogueStart = start + tag.length + 2;
  const dialogueEnd = dialogueStart;
  const speakRef = {
    id: generateId("LSR"),
    itemId: String(candidate.itemId || candidate.id || ""),
    tag,
    start,
    end,
    dialogueStart,
    dialogueEnd,
    dialogue: "",
    insertedAt: new Date().toISOString(),
  };
  return {
    text: nextText,
    caret: dialogueStart,
    speakRef,
  };
}

/**
 * @param {DocLibrarySpeakRef[]} refs
 * @param {number} splitStart
 * @param {number} [splitEnd]
 */
export function splitLibrarySpeakRefsAt(refs, splitStart, splitEnd = splitStart) {
  /** @type {DocLibrarySpeakRef[]} */
  const headRanges = [];
  /** @type {DocLibrarySpeakRef[]} */
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
        dialogueStart: ref.dialogueStart - hi,
        dialogueEnd: ref.dialogueEnd - hi,
      });
    }
  }
  return { headRanges, tailRanges };
}

/**
 * @param {string} text
 * @param {number} caret
 * @param {DocLibrarySpeakRef[]} refs
 */
export function refreshSpeakDialogueBounds(text, caret, refs) {
  const str = asText(text);
  const pos = Math.max(0, Math.min(str.length, Number(caret) || 0));
  return normalizeLibrarySpeakRefs(str, (refs || []).map((ref) => {
    if (!ref) return ref;
    const slice = str.slice(ref.start, ref.end);
    const open = slice.indexOf('""');
    if (open < 0) return ref;
    const dialogueStart = ref.start + open + 2;
    let dialogueEnd = dialogueStart;
    let end = ref.end;
    const closeIdx = str.indexOf('""', dialogueStart);
    if (closeIdx >= dialogueStart) {
      dialogueEnd = closeIdx;
      end = closeIdx + 2;
    } else if (pos >= dialogueStart && pos <= ref.end) {
      dialogueEnd = Math.max(dialogueStart, pos);
      end = Math.max(ref.end, pos + (str[pos] === '"' ? 2 : 0));
    }
    const dialogue = str.slice(dialogueStart, dialogueEnd).trim();
    return {
      ...ref,
      end,
      dialogueStart,
      dialogueEnd,
      dialogue,
    };
  }));
}

/**
 * Finalize speak refs with dialogue content.
 * @param {string} text
 * @param {DocLibrarySpeakRef[]} refs
 */
export function finalizeLibrarySpeakRefs(text, refs) {
  const str = asText(text);
  return normalizeLibrarySpeakRefs(str, (refs || []).map((ref) => {
    if (!ref) return ref;
    const dialogue = str.slice(ref.dialogueStart, ref.dialogueEnd).trim();
    if (!dialogue) return null;
    return {
      ...ref,
      dialogue,
      end: Math.max(ref.end, ref.dialogueEnd + 2),
    };
  }).filter(Boolean));
}
