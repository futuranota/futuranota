/**
 * Product Card decorative frames — frame 01 uses public/uploads/frame-01.png.
 * Adjust PRODUCT_CARD_FRAME_INSET_PCT if the photo window changes.
 */

/** @typedef {"01"} ProductCardFrameId */

export const PRODUCT_CARD_FRAME_01 = /** @type {const} */ ("01");

export const PRODUCT_CARD_FRAME_OPTIONS = [
  { id: PRODUCT_CARD_FRAME_01, labelKey: "doc.productCard.frame01" },
];

const FRAME_ID_SET = new Set(PRODUCT_CARD_FRAME_OPTIONS.map((entry) => entry.id));

/** Product Card supports square + landscape product shots only (v1). */
export const PRODUCT_CARD_FRAME_ASPECTS = /** @type {const} */ (["1:1", "3:2"]);

const FRAME_ASPECT_SET = new Set(PRODUCT_CARD_FRAME_ASPECTS);

/** Fraction inset from each edge for the photo window (matches frame 01 assets). */
export const PRODUCT_CARD_FRAME_INSET_PCT = 0.1;

/**
 * @param {unknown} value
 * @returns {ProductCardFrameId|null}
 */
export function normalizeProductCardFrameId(value) {
  const raw = String(value ?? "").trim();
  return FRAME_ID_SET.has(raw) ? /** @type {ProductCardFrameId} */ (raw) : null;
}

/**
 * @param {unknown} value
 * @returns {"1:1"|"3:2"|null}
 */
export function normalizeProductCardFrameAspect(value) {
  const raw = String(value ?? "").trim();
  return FRAME_ASPECT_SET.has(raw) ? /** @type {"1:1"|"3:2"} */ (raw) : null;
}

/** Canonical overlay asset for frame 01 (drawn around the product photo). */
export const PRODUCT_CARD_FRAME_01_ASSET = "/uploads/frame-01.png?v=1";

/**
 * Public path for a product card frame overlay asset.
 * @param {string|null|undefined} frameId
 * @param {string|null|undefined} frameAspect
 * @returns {string|null}
 */
export function getProductCardFrameAssetUrl(frameId, frameAspect) {
  const id = normalizeProductCardFrameId(frameId);
  if (!id) return null;
  if (id === PRODUCT_CARD_FRAME_01) {
    return PRODUCT_CARD_FRAME_01_ASSET;
  }
  const aspect = normalizeProductCardFrameAspect(frameAspect);
  if (!aspect) return null;
  return null;
}

/**
 * Inner photo window for a decorative product card frame.
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {string|null|undefined} frameId
 * @param {string|null|undefined} frameAspect
 * @returns {{ x: number, y: number, width: number, height: number }|null}
 */
export function getProductCardFrameInnerRect(canvasW, canvasH, frameId, frameAspect) {
  if (!normalizeProductCardFrameId(frameId)) return null;
  if (!normalizeProductCardFrameAspect(frameAspect)) return null;
  if (!(canvasW > 0) || !(canvasH > 0)) return null;

  const insetX = Math.round(canvasW * PRODUCT_CARD_FRAME_INSET_PCT);
  const insetY = Math.round(canvasH * PRODUCT_CARD_FRAME_INSET_PCT);
  const width = Math.max(1, canvasW - insetX * 2);
  const height = Math.max(1, canvasH - insetY * 2);
  return { x: insetX, y: insetY, width, height };
}

/**
 * Whether the block has a bakeable decorative frame selection.
 * @param {{ frameId?: string|null, frameAspect?: string|null }|null|undefined} block
 */
export function productCardHasDecorativeFrame(block) {
  return Boolean(
    normalizeProductCardFrameId(block?.frameId)
    && normalizeProductCardFrameAspect(block?.frameAspect),
  );
}
