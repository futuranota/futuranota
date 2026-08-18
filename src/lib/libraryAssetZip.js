import JSZip from "jszip";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function safeAssetFolderName(value) {
  const base = String(value || "asset")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "asset";
  return base.slice(0, 80);
}

/**
 * @param {string} tag
 * @param {number} index
 * @param {Set<string>} used
 * @returns {string}
 */
export function uniqueImageFilename(tag, index, used) {
  const stem = safeAssetFolderName(tag) || `image_${index + 1}`;
  let name = `${stem}.webp`;
  let n = 2;
  while (used.has(name)) {
    name = `${stem}_${n}.webp`;
    n += 1;
  }
  used.add(name);
  return name;
}

/**
 * Zip image fichas for an asset. Metadata is omitted.
 * @param {{ tag?: string }} asset
 * @param {Array<{ category?: string, tag?: string, mediaUrl?: string|null }>} items
 * @returns {Promise<{ blob: Blob, filename: string, count: number }|null>}
 */
export async function zipLibraryAssetImages(asset, items) {
  const images = (Array.isArray(items) ? items : []).filter(
    (item) => item?.category === "image" && String(item.mediaUrl || "").trim(),
  );
  if (!images.length) return null;

  const zip = new JSZip();
  const folderName = safeAssetFolderName(asset?.tag);
  const folder = zip.folder(folderName);
  if (!folder) return null;

  const used = new Set();
  let count = 0;
  for (let index = 0; index < images.length; index += 1) {
    const item = images[index];
    try {
      const res = await fetch(item.mediaUrl);
      if (!res.ok) continue;
      const blob = await res.blob();
      folder.file(uniqueImageFilename(item.tag, index, used), blob);
      count += 1;
    } catch {
      /* skip missing remote */
    }
  }
  if (!count) return null;

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return {
    blob,
    filename: `${folderName}.zip`,
    count,
  };
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "asset.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
