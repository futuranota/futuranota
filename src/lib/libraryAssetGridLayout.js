/** @typedef {{ cols: 2|3|4, slotMinHeight: number, scroll: boolean, emptySlots: number, showPlaceholders: boolean }} AssetGridLayout */

/**
 * Adaptive grid for asset image metadata cards (fixed container, slots shrink as count grows).
 * @param {number} itemCount
 * @returns {AssetGridLayout}
 */
export function getAssetGridLayout(itemCount) {
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));

  if (count === 0) {
    return {
      cols: 2,
      slotMinHeight: 88,
      scroll: false,
      emptySlots: 4,
      showPlaceholders: true,
    };
  }
  if (count <= 4) {
    return {
      cols: 2,
      slotMinHeight: 88,
      scroll: false,
      emptySlots: Math.max(0, 4 - count),
      showPlaceholders: true,
    };
  }
  if (count <= 6) {
    return {
      cols: 3,
      slotMinHeight: 64,
      scroll: false,
      emptySlots: 0,
      showPlaceholders: false,
    };
  }
  if (count <= 9) {
    return {
      cols: 3,
      slotMinHeight: 56,
      scroll: false,
      emptySlots: 0,
      showPlaceholders: false,
    };
  }
  return {
    cols: 4,
    slotMinHeight: 48,
    scroll: true,
    emptySlots: 0,
    showPlaceholders: false,
  };
}
