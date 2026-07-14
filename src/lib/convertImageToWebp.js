import { generateId } from "./ids.js";

const DEFAULT_WEBP_QUALITY = 0.86;

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} [maxWidth]
 * @param {number} [maxHeight]
 */
function resolveRasterSize(srcW, srcH, maxWidth, maxHeight) {
  const hasMaxW = Number.isFinite(maxWidth) && maxWidth > 0;
  const hasMaxH = Number.isFinite(maxHeight) && maxHeight > 0;
  if (!hasMaxW && !hasMaxH) {
    return { width: srcW, height: srcH };
  }
  const scale = Math.min(
    1,
    hasMaxW ? maxWidth / srcW : 1,
    hasMaxH ? maxHeight / srcH : 1,
  );
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

/**
 * @param {HTMLImageElement} image
 * @param {{ quality?: number, maxWidth?: number, maxHeight?: number }} [options]
 * @returns {Promise<{ blob: Blob, width: number, height: number }|null>}
 */
export async function rasterizeImageToWebpBlob(image, options = {}) {
  const quality = options.quality ?? DEFAULT_WEBP_QUALITY;
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  if (!srcW || !srcH) return null;

  const { width, height } = resolveRasterSize(
    srcW,
    srcH,
    options.maxWidth,
    options.maxHeight,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/webp", quality);
  });

  if (!blob) return null;
  return { blob, width, height };
}

/**
 * @param {File|Blob} file
 * @param {{ quality?: number, fileName?: string, idPrefix?: string, maxWidth?: number, maxHeight?: number }} [options]
 * @returns {Promise<{ id: string, src: string, name: string, width: number, height: number }|null>}
 */
export async function convertFileToWebpData(file, options = {}) {
  if (!file || typeof document === "undefined") return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const raster = await rasterizeImageToWebpBlob(image, options);
    if (!raster) return null;

    const src = await blobToDataUrl(raster.blob);
    const baseName = options.fileName
      || (file instanceof File ? file.name : "image").replace(/\.[^/.]+$/, "");

    return {
      id: generateId(options.idPrefix || "IMG"),
      src,
      name: `${baseName}.webp`,
      width: raster.width,
      height: raster.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Accepts png, jpg, svg, gif, webp, etc. Optionally downscales via maxWidth/maxHeight.
 * @param {string|File|Blob} source URL, data URL, File, or Blob
 * @param {{ quality?: number, fileName?: string, idPrefix?: string, maxWidth?: number, maxHeight?: number }} [options]
 * @returns {Promise<{ id: string, src: string, name: string, width: number, height: number }|null>}
 */
export async function convertImageSourceToWebp(source, options = {}) {
  if (!source) return null;

  if (source instanceof File || source instanceof Blob) {
    return convertFileToWebpData(source, options);
  }

  const src = String(source).trim();
  if (!src) return null;

  if (typeof document === "undefined") return null;

  try {
    const image = await loadImageElement(src);
    const raster = await rasterizeImageToWebpBlob(image, options);
    if (!raster) return null;

    const dataSrc = await blobToDataUrl(raster.blob);
    const fromPath = src.split("/").pop()?.split("?")[0] || "image";
    const baseName = (options.fileName || fromPath).replace(/\.[^/.]+$/, "");

    return {
      id: generateId(options.idPrefix || "IMG"),
      src: dataSrc,
      name: `${baseName}.webp`,
      width: raster.width,
      height: raster.height,
    };
  } catch {
    return null;
  }
}
