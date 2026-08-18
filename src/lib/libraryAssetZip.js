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
 * Unique filename stem for one ficha (shared by `.txt` and `.webp`).
 * @param {string} tag
 * @param {number} index
 * @param {Set<string>} used
 * @returns {string}
 */
export function uniqueAssetStem(tag, index, used) {
  const base = safeAssetFolderName(tag) || `item_${index + 1}`;
  let stem = base;
  let n = 2;
  while (used.has(stem)) {
    stem = `${base}_${n}`;
    n += 1;
  }
  used.add(stem);
  return stem;
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
 * @param {{ category?: string, description?: string, mediaUrl?: string|null }|null|undefined} item
 */
export function libraryAssetItemHasPackFile(item) {
  if (!item || item.category !== "image") return false;
  if (String(item.description || "").trim()) return true;
  return Boolean(String(item.mediaUrl || "").trim());
}

/**
 * Planned zip entries: asset Script first, then each ficha (same stem for txt + webp).
 * @param {Array<{ category?: string, tag?: string, description?: string, mediaUrl?: string|null }>} items
 * @param {{ tag?: string, description?: string }|null} [asset]
 * @returns {Array<{ stem: string, text: string, mediaUrl: string }>}
 */
export function listLibraryAssetPackEntries(items, asset = null) {
  const used = new Set();
  const out = [];
  const script = String(asset?.description || "").trim();
  if (script) {
    out.push({
      stem: uniqueAssetStem(asset?.tag, 0, used),
      text: script,
      mediaUrl: "",
    });
  }
  const fichas = Array.isArray(items) ? items : [];
  for (let index = 0; index < fichas.length; index += 1) {
    const item = fichas[index];
    if (!libraryAssetItemHasPackFile(item)) continue;
    const stem = uniqueAssetStem(item.tag, index + 1, used);
    out.push({
      stem,
      text: String(item.description || "").trim(),
      mediaUrl: String(item.mediaUrl || "").trim(),
    });
  }
  return out;
}

/**
 * @param {{ description?: string }|null|undefined} asset
 * @param {Array<{ category?: string, description?: string, mediaUrl?: string|null }>} items
 */
export function libraryAssetHasPack(asset, items) {
  if (String(asset?.description || "").trim()) return true;
  return (Array.isArray(items) ? items : []).some((item) => libraryAssetItemHasPackFile(item));
}

/**
 * Zip the asset Script, ficha scripts (`.txt`), and images (`.webp`).
 * @param {{ tag?: string }} asset
 * @param {Array<{ category?: string, tag?: string, description?: string, mediaUrl?: string|null }>} items
 * @returns {Promise<{ blob: Blob, filename: string, count: number }|null>}
 */
export async function zipLibraryAssetImages(asset, items) {
  const entries = listLibraryAssetPackEntries(items, asset);
  if (!entries.length) return null;

  const zip = new JSZip();
  const folderName = safeAssetFolderName(asset?.tag);
  const folder = zip.folder(folderName);
  if (!folder) return null;

  let count = 0;
  for (const entry of entries) {
    if (entry.text) {
      folder.file(`${entry.stem}.txt`, entry.text);
      count += 1;
    }
    if (!entry.mediaUrl) continue;
    try {
      const res = await fetch(entry.mediaUrl);
      if (!res.ok) continue;
      const blob = await res.blob();
      folder.file(`${entry.stem}.webp`, blob);
      count += 1;
    } catch {
      /* skip missing remote; keep the .txt */
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
