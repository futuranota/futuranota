import { fichaHasVisual, promptPreviewText } from "./libraryFichaPreview.js";
import { normalizeWallColor } from "./folderLibraryNormalize.js";
import { libraryFramePixelSize, normalizeLibraryFrameAspect } from "./libraryFrameAspect.js";

/** Keep in sync with BANNER_HEADLINE_MAX in docBlocks.js (avoid importing that module here). */
const LIBRARY_PROMPT_MAX = 280;

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
 * Moodboard frames need a real photo (not prompt-only fichas).
 * @param {{ category?: string, description?: string|null, mediaUrl?: string|null }|null|undefined} item
 */
export function isMoodboardLibraryPick(item) {
  if (!item) return false;
  const cat = String(item.category || "").trim().toLowerCase();
  if (cat !== "image" && cat !== "auto") return false;
  return fichaHasVisual(item);
}

/**
 * Map a library ficha onto a moodboard slot (photo pointer, no re-upload).
 * Caller should merge slotId / tagLabel / externalUrl from the previous slot.
 * @param {import("./folderLibraryNormalize.js").FolderLibraryItem|null|undefined} item
 * @param {"folder"|"document"|string} [ownerKind]
 * @param {string} [ownerId]
 */
export function libraryItemToMoodboardSlotPatch(item, ownerKind = "document", ownerId = "") {
  if (!item || !isMoodboardLibraryPick(item)) return null;
  const src = String(item.mediaUrl || "").trim();
  if (!src) return null;
  const tag = String(item.tag || "").trim();
  const kind = ownerKind === "folder" ? "folder" : "document";
  const frame = normalizeLibraryFrameAspect(item.frameAspect);
  const dims = frame ? libraryFramePixelSize(frame, 1080) : null;
  return {
    src,
    name: tag,
    alt: tag,
    width: dims?.width || 0,
    height: dims?.height || 0,
    imageSaved: true,
    kind: "image",
    libraryItemId: String(item.id || "").trim(),
    libraryOwnerKind: kind,
    libraryOwnerId: String(ownerId || "").trim(),
  };
}

/**
 * @param {unknown} value
 */
export function normalizeImageSplitLibraryPrompt(value) {
  return String(value ?? "").slice(0, LIBRARY_PROMPT_MAX);
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
 * @param {string} [ownerId]
 */
export function libraryItemToImageSplitPatch(item, ownerKind = "document", ownerId = "") {
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
    libraryOwnerId: String(ownerId || "").trim(),
    libraryPrompt,
    libraryTag: tag,
    wallColor: normalizeWallColor(item.wallColor),
    mediaFace: libraryPrompt.trim() ? "prompt" : "image",
    openFilePicker: false,
    splitSaved: false,
  };
}

/**
 * @typedef {{ ownerKind: "folder"|"document", ownerId: string, items: Array<{ id?: string, mediaUrl?: string|null }> }} LibraryCatalog
 */

function mediaUrlOf(item) {
  return String(item?.mediaUrl || "").trim();
}

/**
 * Find the library ficha this Image card should overwrite.
 * Prefers stored item id; falls back to matching the photo URL (older cards).
 * @param {{ libraryItemId?: string, libraryOwnerKind?: string, libraryOwnerId?: string, src?: string }|null|undefined} block
 * @param {LibraryCatalog[]} catalogs
 * @returns {{ ownerKind: "folder"|"document", ownerId: string, itemId: string }|null}
 */
export function resolveImageSplitLibraryLink(block, catalogs = []) {
  const itemId = String(block?.libraryItemId || "").trim();
  const src = String(block?.src || "").trim();
  const list = Array.isArray(catalogs) ? catalogs : [];

  const hintKind = block?.libraryOwnerKind === "folder"
    ? "folder"
    : (block?.libraryOwnerKind === "document" ? "document" : "");
  const hintOwnerId = String(block?.libraryOwnerId || "").trim();
  const ordered = [...list].sort((a, b) => {
    const aHint = a.ownerKind === hintKind && a.ownerId === hintOwnerId ? 0 : 1;
    const bHint = b.ownerKind === hintKind && b.ownerId === hintOwnerId ? 0 : 1;
    return aHint - bHint;
  });

  if (itemId) {
    for (const catalog of ordered) {
      const hit = (catalog.items || []).find((item) => String(item?.id || "").trim() === itemId);
      if (hit) {
        return {
          ownerKind: catalog.ownerKind,
          ownerId: catalog.ownerId,
          itemId,
        };
      }
    }
  }

  if (src) {
    for (const catalog of ordered) {
      const hit = (catalog.items || []).find((item) => mediaUrlOf(item) === src);
      if (hit?.id) {
        return {
          ownerKind: catalog.ownerKind,
          ownerId: catalog.ownerId,
          itemId: String(hit.id).trim(),
        };
      }
    }
  }

  return null;
}

/**
 * Payload to write the Image card Prompt back onto the linked library ficha.
 * @param {{ libraryItemId?: string, libraryOwnerKind?: string, libraryOwnerId?: string, libraryPrompt?: string, src?: string }|null|undefined} block
 * @param {LibraryCatalog[]} [catalogs]
 * @returns {{ ownerKind: "folder"|"document", ownerId: string, itemId: string, description: string }|null}
 */
export function syncImageSplitPromptToLibrary(block, catalogs) {
  const link = resolveImageSplitLibraryLink(block, catalogs);
  if (!link) return null;
  return {
    ...link,
    description: normalizeImageSplitLibraryPrompt(block?.libraryPrompt),
  };
}
