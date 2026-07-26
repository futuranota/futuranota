import { applyTextEditToMentions, normalizeMentions } from "./docMentions.js";
import { applyTextEditToTagRefs, normalizeTagRefs } from "./docTagRefs.js";
import {
  applyTextEditToBoldRanges,
  normalizeBoldRanges,
} from "./docTextBoldRanges.js";
import {
  applyTextEditToMarkerRanges,
  normalizeMarkerRanges,
} from "./docTextMarkerRanges.js";

const BOLD_MARKER = "--";

function clampCaret(text, caret) {
  const str = String(text ?? "");
  const raw = Number(caret);
  return Math.max(
    0,
    Math.min(str.length, Number.isFinite(raw) ? Math.floor(raw) : str.length),
  );
}

function lineStartAt(text, caret) {
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  return str.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
}

/** Printable key that starts/continues sticky bold (not `-` or Space). */
export function isBoldStickyTriggerKey(key) {
  if (typeof key !== "string" || key.length !== 1) return false;
  if (key === "-" || key === " ") return false;
  // Ignore ASCII controls.
  if (key.charCodeAt(0) < 32) return false;
  return true;
}

/**
 * Line from start → caret is exactly `--` (dashes still free to continue as `---`).
 * @param {string} text
 * @param {number} caret
 */
export function matchBoldMarkerAtCaret(text, caret) {
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = lineStartAt(str, pos);
  return str.slice(start, pos) === BOLD_MARKER;
}

/**
 * @typedef {{
 *   text: string,
 *   boldRanges: import("./docTextBoldRanges.js").BoldRange[],
 *   mentions: ReturnType<typeof normalizeMentions>,
 *   tagRefs: ReturnType<typeof normalizeTagRefs>,
 *   markerRanges: ReturnType<typeof normalizeMarkerRanges>,
 *   focusCaret: number,
 *   stickyBoldStart: number|null,
 * }} BoldShortcutResult
 */

function patchMeta(previousText, nextText, meta = {}) {
  return {
    boldRanges: applyTextEditToBoldRanges(previousText, nextText, meta.boldRanges),
    mentions: applyTextEditToMentions(previousText, nextText, meta.mentions),
    tagRefs: applyTextEditToTagRefs(previousText, nextText, meta.tagRefs),
    markerRanges: applyTextEditToMarkerRanges(previousText, nextText, meta.markerRanges),
  };
}

function finalizeResult(nextText, ranges, mentions, tagRefs, markerRanges, focusCaret, stickyBoldStart) {
  return {
    text: nextText,
    boldRanges: normalizeBoldRanges(nextText, ranges),
    mentions: normalizeMentions(nextText, mentions),
    tagRefs: normalizeTagRefs(nextText, tagRefs),
    markerRanges: normalizeMarkerRanges(nextText, markerRanges),
    focusCaret,
    stickyBoldStart,
  };
}

/**
 * Start sticky bold: strip line-start `--`, insert `char`, bold it until Space.
 * Does nothing for `-` / Space / multi-dash (so `-------` stays free).
 *
 * @param {string} text
 * @param {object} [meta]
 * @param {number} caret
 * @param {string} char
 * @returns {BoldShortcutResult|null}
 */
export function startBoldStickyFromMarker(text, meta, caret, char) {
  if (!isBoldStickyTriggerKey(char)) return null;
  if (!matchBoldMarkerAtCaret(text, caret)) return null;

  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const markerStart = lineStartAt(str, pos);
  // Remove `--`, insert char at markerStart.
  const nextText = `${str.slice(0, markerStart)}${char}${str.slice(pos)}`;
  const shifted = patchMeta(str, nextText, meta);
  const boldStart = markerStart;
  const boldEnd = markerStart + char.length;
  const boldRanges = normalizeBoldRanges(nextText, [
    ...shifted.boldRanges,
    { start: boldStart, end: boldEnd },
  ]);

  return finalizeResult(
    nextText,
    boldRanges,
    shifted.mentions,
    shifted.tagRefs,
    shifted.markerRanges,
    boldEnd,
    boldStart,
  );
}

/**
 * Extend sticky bold by inserting `char` at caret (still bold).
 * @returns {BoldShortcutResult|null}
 */
export function extendBoldSticky(text, meta, caret, char, stickyBoldStart) {
  if (!isBoldStickyTriggerKey(char)) return null;
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = Math.max(0, Number(stickyBoldStart) || 0);
  if (pos < start) return null;

  const nextText = `${str.slice(0, pos)}${char}${str.slice(pos)}`;
  const shifted = patchMeta(str, nextText, meta);
  const boldEnd = pos + char.length;
  const boldRanges = normalizeBoldRanges(nextText, [
    ...shifted.boldRanges.filter((r) => !(r.start === start && r.end === pos)),
    { start, end: boldEnd },
  ]);
  // Also merge any overlapping ranges covering [start, pos).
  const merged = normalizeBoldRanges(nextText, [
    ...boldRanges.filter((r) => r.end <= start || r.start >= boldEnd),
    { start, end: boldEnd },
  ]);

  return finalizeResult(
    nextText,
    merged,
    shifted.mentions,
    shifted.tagRefs,
    shifted.markerRanges,
    boldEnd,
    start,
  );
}

/**
 * Space ends sticky bold: insert a normal (non-bold) space and clear sticky.
 * @returns {BoldShortcutResult|null}
 */
export function endBoldStickyWithSpace(text, meta, caret, stickyBoldStart) {
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = Math.max(0, Number(stickyBoldStart) || 0);
  if (pos < start) return null;

  const nextText = `${str.slice(0, pos)} ${str.slice(pos)}`;
  const shifted = patchMeta(str, nextText, meta);
  // Keep existing bold through [start, pos); space at `pos` stays unmarked.
  const boldRanges = normalizeBoldRanges(nextText, [
    ...shifted.boldRanges.filter((r) => !(r.start >= start && r.end <= pos)),
    ...(pos > start ? [{ start, end: pos }] : []),
  ]);

  return finalizeResult(
    nextText,
    boldRanges,
    shifted.mentions,
    shifted.tagRefs,
    shifted.markerRanges,
    pos + 1,
    null,
  );
}

/**
 * Paste / IME fallback: line-start `--` followed by non-dash text →
 * strip marker, bold until first space (or EOL), no sticky after.
 *
 * Skips `---`, `-------`, `-- `, bare `--`.
 *
 * @returns {BoldShortcutResult|null}
 */
export function applyBoldMarkerIfPending(text, meta = {}) {
  const str = String(text ?? "");
  let idx = 0;
  while (idx <= str.length) {
    if (str.startsWith(BOLD_MARKER, idx)) {
      const after = str[idx + BOLD_MARKER.length];
      // Free dashes / bare marker / space after marker → leave alone.
      if (!after || after === "-" || after === " " || after === "\n") {
        // continue scanning other lines
      } else {
        const lineEndIdx = str.indexOf("\n", idx + BOLD_MARKER.length);
        const lineEnd = lineEndIdx === -1 ? str.length : lineEndIdx;
        const body = str.slice(idx + BOLD_MARKER.length, lineEnd);
        const spaceAt = body.indexOf(" ");
        const boldLen = spaceAt === -1 ? body.length : spaceAt;
        const boldPart = body.slice(0, boldLen);
        const restPart = body.slice(boldLen);
        const afterLines = lineEndIdx === -1 ? "" : str.slice(lineEndIdx);
        const before = str.slice(0, idx);
        const nextText = before + boldPart + restPart + afterLines;
        const shifted = patchMeta(str, nextText, meta);
        const boldStart = before.length;
        const boldEnd = before.length + boldPart.length;
        const boldRanges = boldEnd > boldStart
          ? normalizeBoldRanges(nextText, [
            ...shifted.boldRanges,
            { start: boldStart, end: boldEnd },
          ])
          : shifted.boldRanges;

        return finalizeResult(
          nextText,
          boldRanges,
          shifted.mentions,
          shifted.tagRefs,
          shifted.markerRanges,
          boldEnd,
          null,
        );
      }
    }
    const next = str.indexOf("\n", idx);
    if (next === -1) break;
    idx = next + 1;
  }
  return null;
}
