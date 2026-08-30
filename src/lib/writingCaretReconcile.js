/**
 * Reconcile DOM textarea caret with a ref snapshot when the browser reports
 * position 0–2 while the user clicked deep in a long TEXT block (H1 ## bug).
 *
 * @param {number} domCaret
 * @param {number|null|undefined} snapCaret
 * @param {number} textLength
 * @returns {number}
 */
export function reconcileWritingCaret(domCaret, snapCaret, textLength) {
  const len = Number(textLength);
  const raw = Number(domCaret);
  const snap = Number(snapCaret);
  const max = Number.isFinite(len) ? Math.max(0, Math.floor(len)) : 0;

  if (!Number.isFinite(raw)) {
    return max;
  }

  let caret = Math.max(0, Math.min(max, Math.floor(raw)));

  if (!Number.isFinite(snap)) {
    return caret;
  }

  const snapClamped = Math.max(0, Math.min(max, Math.floor(snap)));

  // DOM stuck at doc start while snapshot knows user clicked deep in the block.
  if (caret <= 2 && snapClamped > 10) {
    caret = snapClamped;
  }

  return caret;
}

/**
 * Pick caret for H1 ## keydown when a same-block snapshot exists.
 *
 * @param {number} domCaret
 * @param {{ blockIndex?: number, caret?: number }|null|undefined} snap
 * @param {number} blockIndex
 * @param {number} textLength
 * @returns {number}
 */
export function resolveH1KeydownCaret(domCaret, snap, blockIndex, textLength) {
  if (
    snap
    && typeof snap.blockIndex === "number"
    && snap.blockIndex === blockIndex
    && typeof snap.caret === "number"
  ) {
    return reconcileWritingCaret(domCaret, snap.caret, textLength);
  }
  return reconcileWritingCaret(domCaret, null, textLength);
}
