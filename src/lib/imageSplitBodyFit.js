/**
 * Pure binary search used by image-split side/below reflow.
 * @param {string} full
 * @param {(prefix: string) => boolean} fits
 * @returns {number} largest prefix length that fits
 */
export function findMaxFittingPrefixLength(full, fits) {
  const text = String(full ?? "");
  if (!text) return 0;
  if (typeof fits !== "function") return text.length;
  if (fits(text)) return text.length;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(text.slice(0, mid))) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * Floor side box height to a whole number of text lines so the last line
 * is never half-clipped by overflow:hidden.
 * @param {number} sideHeight
 * @param {number} lineHeight
 * @param {number} padY
 * @returns {number}
 */
export function resolveLineFitHeight(sideHeight, lineHeight, padY) {
  const h = Number(sideHeight) || 0;
  const lh = Number(lineHeight) > 0 ? Number(lineHeight) : 20.3;
  const pad = Math.max(0, Number(padY) || 0);
  if (!(h > 0)) return 0;
  const inner = Math.max(0, h - pad);
  const lines = Math.max(1, Math.floor(inner / lh));
  return Math.round(pad + lines * lh);
}

/**
 * If `split` lands mid-word, walk back to the previous whitespace/newline.
 * Leaves the cut alone when there is no earlier break (single long token).
 * @param {string} full
 * @param {number} split
 * @returns {number}
 */
export function snapSplitToWordBoundary(full, split) {
  const text = String(full ?? "");
  let i = Math.max(0, Math.min(Number(split) || 0, text.length));
  if (i <= 0 || i >= text.length) return i;

  const isBreak = (ch) => ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
  const left = text[i - 1];
  const right = text[i];
  // Already on a boundary (between break and non-break, or at break).
  if (isBreak(left) || isBreak(right)) {
    // Prefer keeping trailing spaces on the side only if they are breaks at i;
    // if we landed inside whitespace run, stay; if mid-word, walk back below.
    if (isBreak(left) && !isBreak(right)) return i;
    if (!isBreak(left) && isBreak(right)) return i;
  }

  // Mid-word: retreat to last break, then advance past that break so the
  // break stays with the side (or at least side ends at a clean word end).
  for (let j = i - 1; j >= 0; j -= 1) {
    if (isBreak(text[j])) {
      return j + 1;
    }
  }
  return i;
}
