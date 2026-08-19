import { BANNER_HEADLINE_MAX } from "./docBlocks.js";
import { fichaHasVisual, promptPreviewText } from "./libraryFichaPreview.js";

/**
 * Prompt fichas that can fill an Image card (photo and/or written prompt).
 * @param {{ category?: string, description?: string|null, mediaUrl?: string|null }|null|undefined} item
 */
export function isImageCardLibraryPick(item) {
  if (!item) return false;
  const cat = String(item.category || "").trim().toLowerCase();
  if (cat !== "image" && cat !== "auto") return false;
  return fichaHasVisual(item) || Boolean(promptPreviewText(item));
}

/**
 * @param {unknown} value
 */
export function normalizeImageSplitLibraryPrompt(value) {
  return String(value ?? "").slice(0, BANNER_HEADLINE_MAX);
}

/**
 * Card has a photo and/or imported prompt — enough to Guardar.
 * @param {{ src?: string, libraryPrompt?: string }|null|undefined} block
 */
export function imageSplitHasFill(block) {
  return Boolean(String(block?.src || "").trim())
    || Boolean(normalizeImageSplitLibraryPrompt(block?.libraryPrompt).trim());
}

/**
 * Map a library ficha onto Image card media + metadata fields.
 * Does not touch Story / body on the right.
 * @param {import("./folderLibraryNormalize.js").FolderLibraryItem|null|undefined} item
 * @param {"folder"|"document"|string} [ownerKind]
 */
export function libraryItemToImageSplitPatch(item, ownerKind = "document") {
  if (!item || !isImageCardLibraryPick(item)) return null;
  const src = fichaHasVisual(item) ? String(item.mediaUrl).trim() : "";
  const libraryPrompt = normalizeImageSplitLibraryPrompt(promptPreviewText(item));
  const tag = String(item.tag || "").trim();
  const kind = ownerKind === "folder" ? "folder" : "document";
  return {
    src,
    name: tag,
    alt: tag,
    width: 0,
    height: 0,
    imageSaved: Boolean(src),
    libraryItemId: String(item.id || "").trim(),
    libraryOwnerKind: kind,
    libraryPrompt,
    libraryTag: tag,
    mediaFace: src ? "image" : "prompt",
    openFilePicker: false,
    splitSaved: false,
  };
}
