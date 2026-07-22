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
