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
 * @param {HTMLImageElement} image
 * @param {{ quality?: number }} [options]
 * @returns {Promise<{ blob: Blob, width: number, height: number }|null>}
 */
export async function rasterizeImageToWebpBlob(image, options = {}) {
  const quality = options.quality ?? DEFAULT_WEBP_QUALITY;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;

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
 * @param {{ quality?: number, fileName?: string, idPrefix?: string }} [options]
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
 * Accepts png, jpg, svg, gif, webp, etc. Output keeps the source pixel size 1:1.
 * @param {string|File|Blob} source URL, data URL, File, or Blob
 * @param {{ quality?: number, fileName?: string, idPrefix?: string }} [options]
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
