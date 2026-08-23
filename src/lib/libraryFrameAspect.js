/**
 * Library image frame aspects — contain photo + wall fill → bake for moodboard / social.
 */

/** @typedef {"9:16"|"16:9"|"1:1"|"3:2"} LibraryFrameAspectId */

export const LIBRARY_FRAME_ASPECTS = /** @type {const} */ ({
  PORTRAIT_9_16: "9:16",
  LANDSCAPE_16_9: "16:9",
  SQUARE_1_1: "1:1",
  LANDSCAPE_3_2: "3:2",
});

/** Preset order for pickers. */
export const LIBRARY_FRAME_ASPECT_OPTIONS = [
  LIBRARY_FRAME_ASPECTS.PORTRAIT_9_16,
  LIBRARY_FRAME_ASPECTS.LANDSCAPE_16_9,
  LIBRARY_FRAME_ASPECTS.SQUARE_1_1,
  LIBRARY_FRAME_ASPECTS.LANDSCAPE_3_2,
];

const FRAME_ASPECT_SET = new Set(Object.values(LIBRARY_FRAME_ASPECTS));

/**
 * width / height for a frame id.
 * @param {string|null|undefined} id
 * @returns {number|null}
 */
export function libraryFrameWidthOverHeight(id) {
  switch (normalizeLibraryFrameAspect(id)) {
    case LIBRARY_FRAME_ASPECTS.PORTRAIT_9_16:
      return 9 / 16;
    case LIBRARY_FRAME_ASPECTS.LANDSCAPE_16_9:
      return 16 / 9;
    case LIBRARY_FRAME_ASPECTS.SQUARE_1_1:
      return 1;
    case LIBRARY_FRAME_ASPECTS.LANDSCAPE_3_2:
      return 3 / 2;
    default:
      return null;
  }
}

/**
 * CSS `aspect-ratio` value (`W / H`).
 * @param {string|null|undefined} id
 * @returns {string|null}
 */
export function libraryFrameCssAspectRatio(id) {
  const normalized = normalizeLibraryFrameAspect(id);
  return normalized || null;
}

/**
 * @param {unknown} value
 * @returns {LibraryFrameAspectId|null}
 */
export function normalizeLibraryFrameAspect(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return FRAME_ASPECT_SET.has(raw) ? /** @type {LibraryFrameAspectId} */ (raw) : null;
}

/**
 * Pixel size of a baked frame (longest edge = maxEdge).
 * @param {string|null|undefined} id
 * @param {number} [maxEdge=1440]
 * @returns {{ width: number, height: number }|null}
 */
export function libraryFramePixelSize(id, maxEdge = 1440) {
  const ratio = libraryFrameWidthOverHeight(id);
  if (!(ratio > 0) || !(maxEdge > 0)) return null;
  if (ratio >= 1) {
    const width = Math.round(maxEdge);
    return { width, height: Math.max(1, Math.round(width / ratio)) };
  }
  const height = Math.round(maxEdge);
  return { width: Math.max(1, Math.round(height * ratio)), height };
}

/**
 * Load an image URL for canvas use (CORS anonymous for Storage public URLs).
 * @param {string} srcUrl
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(srcUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for frame bake."));
    img.src = srcUrl;
  });
}

/**
 * Draw source image contained (letterboxed) into a wall-colored frame.
 * @param {{
 *   srcUrl: string,
 *   frameAspect: string,
 *   wallColor?: string|null,
 *   maxEdge?: number,
 *   quality?: number,
 * }} opts
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function bakeLibraryFrameBlob(opts) {
  const frameAspect = normalizeLibraryFrameAspect(opts.frameAspect);
  if (!frameAspect) throw new Error("Invalid frame aspect.");
  const srcUrl = String(opts.srcUrl || "").trim();
  if (!srcUrl) throw new Error("No image to frame.");

  const size = libraryFramePixelSize(frameAspect, opts.maxEdge ?? 1440);
  if (!size) throw new Error("Could not size frame.");

  const wall = String(opts.wallColor || "").trim() || "#151515";
  const img = await loadImageElement(srcUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");

  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, size.width, size.height);

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!(iw > 0) || !(ih > 0)) throw new Error("Image has no dimensions.");

  const scale = Math.min(size.width / iw, size.height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (size.width - dw) / 2;
  const dy = (size.height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  const quality = typeof opts.quality === "number" ? opts.quality : 0.9;
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Frame bake failed."))),
      "image/webp",
      quality,
    );
  });

  return { blob, width: size.width, height: size.height };
}

/**
 * Bake frame and upload WebP to doc-images.
 * @param {{
 *   srcUrl: string,
 *   frameAspect: string,
 *   wallColor?: string|null,
 *   scopeId?: string,
 *   maxEdge?: number,
 * }} opts
 * @returns {Promise<{ src: string, width: number, height: number }>}
 */
export async function bakeAndUploadLibraryFrame(opts) {
  const { uploadDocImageBlob } = await import("./docImageStorage.js");
  const { generateId } = await import("./ids.js");
  const baked = await bakeLibraryFrameBlob(opts);
  const src = await uploadDocImageBlob(baked.blob, {
    fileId: generateId("LIBFRAME"),
    scopeId: opts.scopeId || "folder-lib",
  });
  return { src, width: baked.width, height: baked.height };
}

/**
 * Moodboard cell target: height / width (for board geometry + CSS aspect-ratio invert).
 * sizeClass: "large" | "medium" | "semi"
 * @param {string} boardLayout
 * @param {string} sizeClass
 * @param {number} [colIndex=0]
 * @returns {number} height/width
 */
export function moodboardCellHeightOverWidth(boardLayout, sizeClass, colIndex = 0) {
  const layout = String(boardLayout || "thirds");
  const size = String(sizeClass || "large");

  if (size === "medium") {
    // 3:2 landscape stack — default moodboard medium frame
    return 2 / 3;
  }

  if (layout === "full") {
    // 16:9 landscape hero
    return 9 / 16;
  }

  if (layout === "halves") {
    // 1:1
    return 1;
  }

  if (layout === "wide_narrow") {
    // ⅔ column → 3:2; ⅓ column → 9:16
    if (colIndex === 0 && size === "large") return 2 / 3;
    return 16 / 9;
  }

  // thirds default: large / semi → 9:16 portrait
  return 16 / 9;
}

/**
 * CSS aspect-ratio string (width / height) for a moodboard cell.
 * @param {string} boardLayout
 * @param {string} sizeClass
 * @param {number} [colIndex=0]
 * @returns {string}
 */
export function moodboardCellCssAspectRatio(boardLayout, sizeClass, colIndex = 0) {
  const how = moodboardCellHeightOverWidth(boardLayout, sizeClass, colIndex);
  if (!(how > 0)) return "9 / 16";
  // CSS wants W / H
  const wOverH = 1 / how;
  // Prefer nice labels when exact
  if (Math.abs(wOverH - 9 / 16) < 0.001) return "9 / 16";
  if (Math.abs(wOverH - 16 / 9) < 0.001) return "16 / 9";
  if (Math.abs(wOverH - 1) < 0.001) return "1 / 1";
  if (Math.abs(wOverH - 3 / 2) < 0.001) return "3 / 2";
  return `${wOverH}`;
}

/**
 * Slot target frame id for moodboard structure (publish presets).
 * @param {string} boardLayout
 * @param {string} sizeClass
 * @param {number} [colIndex=0]
 * @returns {LibraryFrameAspectId}
 */
export function moodboardSlotFrameAspect(boardLayout, sizeClass, colIndex = 0) {
  const css = moodboardCellCssAspectRatio(boardLayout, sizeClass, colIndex);
  if (css === "9 / 16") return LIBRARY_FRAME_ASPECTS.PORTRAIT_9_16;
  if (css === "16 / 9") return LIBRARY_FRAME_ASPECTS.LANDSCAPE_16_9;
  if (css === "1 / 1") return LIBRARY_FRAME_ASPECTS.SQUARE_1_1;
  if (css === "3 / 2") return LIBRARY_FRAME_ASPECTS.LANDSCAPE_3_2;
  return LIBRARY_FRAME_ASPECTS.PORTRAIT_9_16;
}

/**
 * Human label for empty-slot / chip (`9:16`, `3:2`, …).
 * @param {string} boardLayout
 * @param {string} sizeClass
 * @param {number} [colIndex=0]
 * @returns {string}
 */
export function moodboardSlotFrameLabel(boardLayout, sizeClass, colIndex = 0) {
  return moodboardSlotFrameAspect(boardLayout, sizeClass, colIndex);
}
