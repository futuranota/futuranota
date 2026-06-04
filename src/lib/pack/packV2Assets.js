/**
 * @param {string} dataUrl
 */
export function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return null;
  }
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = (match[1] || "application/octet-stream").trim();
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { mime, bytes };
}

/**
 * @param {string} mime
 * @param {string} [name]
 */
export function extensionFromMime(mime, name = "") {
  const m = (mime || "").toLowerCase();
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("pdf")) return "pdf";
  const fromName = /\.([a-z0-9]+)$/i.exec(name || "");
  if (fromName) return fromName[1].toLowerCase();
  return "bin";
}

/**
 * @param {string} mime
 */
export function mimeFromExtension(ext) {
  const e = (ext || "").toLowerCase().replace(/^\./, "");
  const map = {
    webp: "image/webp",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
  };
  return map[e] || "application/octet-stream";
}

/**
 * Extract embedded data URLs from doc blocks into asset file entries.
 * @param {object} doc
 * @param {string} folderPrefix zip path without trailing slash
 * @returns {{ doc: object, files: { path: string, bytes: Uint8Array }[] }}
 */
export function extractDocAssets(doc, folderPrefix) {
  const files = [];
  const docCopy = JSON.parse(JSON.stringify(doc));
  const blocks = docCopy.blocks;
  if (!Array.isArray(blocks)) return { doc: docCopy, files };

  let imageIndex = 0;

  for (const block of blocks) {
    if (block.type !== "product_card" || !Array.isArray(block.images)) continue;

    for (const img of block.images) {
      if (!img?.src) continue;
      const parsed = parseDataUrl(img.src);
      if (!parsed) continue;

      imageIndex += 1;
      const baseName = slugifyAssetName(img.name || `image-${imageIndex}`);
      const ext = extensionFromMime(parsed.mime, img.name);
      const fileName = baseName.endsWith(`.${ext}`) ? baseName : `${baseName}.${ext}`;
      const zipPath = `${folderPrefix}/assets/${fileName}`;

      files.push({ path: zipPath, bytes: parsed.bytes });
      img.src = `assets/${fileName}`;
      if (!img.name) img.name = fileName;
    }
  }

  return { doc: docCopy, files };
}

function slugifyAssetName(name) {
  return String(name || "image")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
}

/**
 * @param {object} doc
 * @param {string} folderPrefix
 * @param {import('jszip')} zip
 */
export async function hydrateDocAssetsFromZip(doc, folderPrefix, zip) {
  const docCopy = JSON.parse(JSON.stringify(doc));
  const blocks = docCopy.blocks;
  if (!Array.isArray(blocks)) return docCopy;

  for (const block of blocks) {
    if (block.type !== "product_card" || !Array.isArray(block.images)) continue;

    for (const img of block.images) {
      if (!img?.src || img.src.startsWith("data:")) continue;
      const rel = img.src.replace(/^\.\//, "");
      const zipPath = `${folderPrefix}/${rel}`;
      const entry = zip.file(zipPath) || zip.file(rel);
      if (!entry) continue;

      const ext = extensionFromMime("", img.name || rel);
      const mime = mimeFromExtension(ext);
      const b64 = await entry.async("base64");
      img.src = `data:${mime};base64,${b64}`;
    }
  }

  return docCopy;
}
