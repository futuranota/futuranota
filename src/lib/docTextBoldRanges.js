/** @typedef {{ start: number, end: number }} BoldRange */
/** @typedef {{ type: 'plain'|'bold', text: string }} BoldTextSegment */

/** @returns {BoldRange[]} */
export function normalizeBoldRanges(text, ranges) {
  const len = String(text ?? "").length;
  if (!Array.isArray(ranges) || ranges.length === 0) return [];

  const sorted = ranges
    .map((range) => {
      const start = Number(range?.start) || 0;
      const end = Number(range?.end) || 0;
      return {
        start: Math.max(0, Math.min(start, end)),
        end: Math.min(len, Math.max(start, end)),
      };
    })
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  /** @type {BoldRange[]} */
  const merged = [];
  for (const range of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && range.start <= prev.end) {
      prev.end = Math.max(prev.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }
  return merged;
}

export function hasBoldRanges(ranges) {
  return Array.isArray(ranges) && ranges.some((range) => range.end > range.start);
}

function isFullyBold(ranges, lo, hi) {
  let pos = lo;
  while (pos < hi) {
    const cover = ranges.find((range) => range.start <= pos && range.end > pos);
    if (!cover) return false;
    pos = Math.min(hi, cover.end);
  }
  return true;
}

function subtractInterval(ranges, lo, hi) {
  /** @type {BoldRange[]} */
  const out = [];
  for (const range of ranges) {
    if (range.end <= lo || range.start >= hi) {
      out.push({ start: range.start, end: range.end });
      continue;
    }
    if (range.start < lo) out.push({ start: range.start, end: lo });
    if (range.end > hi) out.push({ start: hi, end: range.end });
  }
  return out;
}

/** Toggle bold on [start, end) without changing the text string. */
export function toggleBoldRange(text, ranges, start, end) {
  const str = String(text ?? "");
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(str.length, Math.max(start, end));
  if (lo >= hi) return normalizeBoldRanges(str, ranges);

  const current = normalizeBoldRanges(str, ranges ?? []);
  if (isFullyBold(current, lo, hi)) {
    return normalizeBoldRanges(str, subtractInterval(current, lo, hi));
  }
  return normalizeBoldRanges(str, [...current, { start: lo, end: hi }]);
}

export function computeTextEditDelta(oldText, newText) {
  const oldStr = String(oldText ?? "");
  const newStr = String(newText ?? "");
  let start = 0;
  const minLen = Math.min(oldStr.length, newStr.length);
  while (start < minLen && oldStr[start] === newStr[start]) start += 1;

  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (oldEnd > start && newEnd > start && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return {
    editStart: start,
    removedLength: oldEnd - start,
    insertedLength: newEnd - start,
  };
}

export function shiftBoldRanges(ranges, editStart, removedLength, insertedLength, textLength) {
  const editEnd = editStart + removedLength;
  const delta = insertedLength - removedLength;
  /** @type {BoldRange[]} */
  const out = [];

  for (const range of ranges ?? []) {
    const { start, end } = range;
    if (end <= editStart) {
      out.push({ start, end });
    } else if (start >= editEnd) {
      out.push({ start: start + delta, end: end + delta });
    } else {
      if (start < editStart) {
        out.push({ start, end: editStart });
      }
      if (end > editEnd) {
        out.push({ start: editStart + insertedLength, end: end + delta });
      }
    }
  }

  return normalizeBoldRanges(" ".repeat(Math.max(0, textLength)), out);
}

/** Keep bold ranges attached after an edit. Newly inserted chars stay unmarked. */
export function applyTextEditToBoldRanges(previousText, nextText, ranges) {
  const next = String(nextText ?? "");
  if (String(previousText ?? "") === next) {
    return normalizeBoldRanges(next, ranges);
  }
  const { editStart, removedLength, insertedLength } = computeTextEditDelta(previousText, nextText);
  return shiftBoldRanges(ranges, editStart, removedLength, insertedLength, next.length);
}

export function splitBoldRangesAt(ranges, splitStart, splitEnd = splitStart) {
  /** @type {BoldRange[]} */
  const headRanges = [];
  /** @type {BoldRange[]} */
  const tailRanges = [];

  for (const range of ranges ?? []) {
    if (range.start < splitStart) {
      headRanges.push({
        start: range.start,
        end: Math.min(range.end, splitStart),
      });
    }
    if (range.end > splitEnd) {
      const tailStart = Math.max(range.start, splitEnd) - splitEnd;
      tailRanges.push({
        start: tailStart,
        end: range.end - splitEnd,
      });
    }
  }

  return {
    headRanges,
    tailRanges,
  };
}

export function mergeBlockBoldRanges(prevBlock, nextBlock, separator = "\n") {
  const prevText = String(prevBlock?.text ?? "");
  const nextText = String(nextBlock?.text ?? "");
  const sep = String(separator ?? "");
  const offset = prevText.length + sep.length;
  const mergedText = `${prevText}${sep}${nextText}`;
  const prevRanges = normalizeBoldRanges(prevText, prevBlock?.boldRanges ?? []);
  const nextRanges = (nextBlock?.boldRanges ?? []).map((range) => ({
    start: range.start + offset,
    end: range.end + offset,
  }));
  return normalizeBoldRanges(mergedText, [...prevRanges, ...nextRanges]);
}

/** @returns {BoldTextSegment[]} */
export function rangesToSegments(text, ranges) {
  const str = String(text ?? "");
  if (!str) return [{ type: "plain", text: "" }];

  const normalized = normalizeBoldRanges(str, ranges);
  if (normalized.length === 0) return [{ type: "plain", text: str }];

  /** @type {BoldTextSegment[]} */
  const segments = [];
  let pos = 0;

  for (const range of normalized) {
    if (range.start > pos) {
      segments.push({ type: "plain", text: str.slice(pos, range.start) });
    }
    segments.push({ type: "bold", text: str.slice(range.start, range.end) });
    pos = range.end;
  }

  if (pos < str.length) {
    segments.push({ type: "plain", text: str.slice(pos) });
  }

  return segments.length > 0 ? segments : [{ type: "plain", text: str }];
}
