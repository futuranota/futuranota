import { computeTextEditDelta } from "./docTextBoldRanges.js";

/** @typedef {{ start: number, end: number, colorId: string }} MarkerRange */
/** @typedef {{ type: 'plain'|'marker', text: string, colorId?: string }} MarkerTextSegment */

function sanitizeRange(textLength, range) {
  const rawStart = Number(range?.start) || 0;
  const rawEnd = Number(range?.end) || 0;
  const start = Math.max(0, Math.min(rawStart, rawEnd));
  const end = Math.min(textLength, Math.max(rawStart, rawEnd));
  const colorId = typeof range?.colorId === "string" ? range.colorId.trim() : "";
  if (end <= start || !colorId) return null;
  return { start, end, colorId };
}

function subtractInterval(ranges, lo, hi) {
  const output = [];
  for (const range of ranges) {
    if (range.end <= lo || range.start >= hi) {
      output.push(range);
      continue;
    }
    if (range.start < lo) {
      output.push({ ...range, end: lo });
    }
    if (range.end > hi) {
      output.push({ ...range, start: hi });
    }
  }
  return output;
}

/**
 * Produces ordered, non-overlapping marker ranges. If malformed ranges overlap,
 * the later entry wins so persisted data resolves deterministically.
 *
 * @returns {MarkerRange[]}
 */
export function normalizeMarkerRanges(text, ranges) {
  const textLength = String(text ?? "").length;
  if (!Array.isArray(ranges) || ranges.length === 0 || textLength === 0) return [];

  let normalized = [];
  for (const candidate of ranges) {
    const range = sanitizeRange(textLength, candidate);
    if (!range) continue;
    normalized = subtractInterval(normalized, range.start, range.end);
    normalized.push(range);
  }

  normalized.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of normalized) {
    const previous = merged[merged.length - 1];
    if (
      previous
      && previous.colorId === range.colorId
      && range.start <= previous.end
    ) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Replaces any marker inside [start, end) with colorId.
 * Passing an empty color removes the marker from that selection.
 */
export function setMarkerRange(text, ranges, start, end, colorId) {
  const value = String(text ?? "");
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(value.length, Math.max(start, end));
  if (lo >= hi) return normalizeMarkerRanges(value, ranges);

  const current = normalizeMarkerRanges(value, ranges);
  const withoutSelection = subtractInterval(current, lo, hi);
  const normalizedColorId = typeof colorId === "string" ? colorId.trim() : "";
  return normalizeMarkerRanges(
    value,
    normalizedColorId
      ? [...withoutSelection, { start: lo, end: hi, colorId: normalizedColorId }]
      : withoutSelection,
  );
}

/** Same color over the full selection toggles off; otherwise it replaces it. */
export function toggleMarkerRange(text, ranges, start, end, colorId) {
  const value = String(text ?? "");
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(value.length, Math.max(start, end));
  const normalizedColorId = typeof colorId === "string" ? colorId.trim() : "";
  if (lo >= hi || !normalizedColorId) return normalizeMarkerRanges(value, ranges);

  const current = normalizeMarkerRanges(value, ranges);
  let position = lo;
  while (position < hi) {
    const covering = current.find(
      (range) => range.start <= position
        && range.end > position
        && range.colorId === normalizedColorId,
    );
    if (!covering) break;
    position = Math.min(hi, covering.end);
  }

  return setMarkerRange(
    value,
    current,
    lo,
    hi,
    position >= hi ? null : normalizedColorId,
  );
}

/**
 * Keeps marker ranges attached to their original characters after an edit.
 * Newly inserted characters remain unmarked.
 */
export function shiftMarkerRanges(ranges, editStart, removedLength, insertedLength, nextText) {
  const editEnd = editStart + removedLength;
  const delta = insertedLength - removedLength;
  const shifted = [];

  for (const range of ranges ?? []) {
    if (range.end <= editStart) {
      shifted.push({ ...range });
    } else if (range.start >= editEnd) {
      shifted.push({
        ...range,
        start: range.start + delta,
        end: range.end + delta,
      });
    } else {
      if (range.start < editStart) {
        shifted.push({ ...range, end: editStart });
      }
      if (range.end > editEnd) {
        shifted.push({
          ...range,
          start: editStart + insertedLength,
          end: range.end + delta,
        });
      }
    }
  }

  return normalizeMarkerRanges(nextText, shifted);
}

export function applyTextEditToMarkerRanges(previousText, nextText, ranges) {
  const delta = computeTextEditDelta(previousText, nextText);
  return shiftMarkerRanges(
    ranges,
    delta.editStart,
    delta.removedLength,
    delta.insertedLength,
    String(nextText ?? ""),
  );
}

export function splitMarkerRangesAt(ranges, splitStart, splitEnd = splitStart) {
  const headRanges = [];
  const tailRanges = [];

  for (const range of ranges ?? []) {
    if (range.start < splitStart) {
      headRanges.push({
        ...range,
        end: Math.min(range.end, splitStart),
      });
    }
    if (range.end > splitEnd) {
      tailRanges.push({
        ...range,
        start: Math.max(range.start, splitEnd) - splitEnd,
        end: range.end - splitEnd,
      });
    }
  }

  return { headRanges, tailRanges };
}

export function mergeBlockMarkerRanges(previousBlock, nextBlock, separator = "\n") {
  const previousText = String(previousBlock?.text ?? "");
  const nextText = String(nextBlock?.text ?? "");
  const offset = previousText.length + separator.length;
  const mergedText = `${previousText}${separator}${nextText}`;
  const previousRanges = normalizeMarkerRanges(
    previousText,
    previousBlock?.markerRanges,
  );
  const nextRanges = (nextBlock?.markerRanges ?? []).map((range) => ({
    ...range,
    start: range.start + offset,
    end: range.end + offset,
  }));
  return normalizeMarkerRanges(mergedText, [...previousRanges, ...nextRanges]);
}

/** @returns {MarkerTextSegment[]} */
export function markerRangesToSegments(text, ranges) {
  const value = String(text ?? "");
  if (!value) return [{ type: "plain", text: "" }];

  const normalized = normalizeMarkerRanges(value, ranges);
  if (normalized.length === 0) return [{ type: "plain", text: value }];

  const segments = [];
  let position = 0;
  for (const range of normalized) {
    if (range.start > position) {
      segments.push({ type: "plain", text: value.slice(position, range.start) });
    }
    segments.push({
      type: "marker",
      text: value.slice(range.start, range.end),
      colorId: range.colorId,
    });
    position = range.end;
  }
  if (position < value.length) {
    segments.push({ type: "plain", text: value.slice(position) });
  }
  return segments;
}
