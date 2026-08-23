import { fichaHasVisual, promptPreviewText } from "./libraryFichaPreview.js";
import { listAllLibraryCatalogs, listLibraryItems } from "./folderLibrary.js";
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
 * Flatten visual fichas from catalogs, optionally excluding one folder owner.
 * @param {Array<{ ownerKind?: string, ownerId?: string, items?: unknown[] }>} catalogs
 * @param {{ excludeFolderId?: string }} [opts]
 * @returns {Array<{ ownerKind: "folder"|"document", ownerId: string, item: object }>}
 */
export function flattenVisualPicksFromCatalogs(catalogs, { excludeFolderId = "" } = {}) {
  const exclude = String(excludeFolderId || "").trim();
  const out = [];
  const seen = new Set();
  for (const catalog of Array.isArray(catalogs) ? catalogs : []) {
    const ownerKind = (catalog?.ownerKind || catalog?.ownerKind) === "document"
      ? "document"
      : "folder";
    const ownerId = String(catalog?.ownerId || catalog?.ownerId || "").trim();
    if (!ownerId) continue;
    if (exclude && ownerKind === "folder" && ownerId === exclude) continue;
    const items = Array.isArray(catalog?.items) ? catalog.items : [];
    for (const item of items) {
      if (!isMoodboardLibraryPick(item)) continue;
      const itemId = String(item?.id || "").trim();
      const key = `${ownerKind}:${ownerId}:${itemId || item.mediaUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ownerKind, ownerId, item });
    }
  }
  return out;
}

/**
 * Flatten attachment fichas (skill/pdf) from catalogs.
 * @param {Array<{ ownerKind?: string, ownerId?: string, ownerKind?: string, ownerId?: string, items?: unknown[] }>} catalogs
 * @returns {Array<{ ownerKind: "folder"|"document", ownerId: string, item: object }>}
 */
export function flattenAttachmentPicksFromCatalogs(catalogs) {
  const out = [];
  const seen = new Set();
  for (const catalog of Array.isArray(catalogs) ? catalogs : []) {
    const ownerKind = (catalog?.ownerKind || catalog?.ownerKind) === "document"
      ? "document"
      : "folder";
    const ownerId = String(catalog?.ownerId || catalog?.ownerId || "").trim();
    if (!ownerId) continue;
    const items = Array.isArray(catalog?.items) ? catalog.items : [];
    for (const item of items) {
      const cat = String(item?.category || "").trim().toLowerCase();
      if (cat !== "skill" && cat !== "pdf") continue;
      const itemId = String(item?.id || "").trim();
      if (!itemId) continue;
      const key = `${ownerKind}:${ownerId}:${itemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ownerKind, ownerId, item });
    }
  }
  return out;
}

/**
 * All workspace attachment fichas.
 */
export function listWorkspaceAttachmentPicks() {
  return flattenAttachmentPicksFromCatalogs(listAllLibraryCatalogs());
}

/**
 * Visual fichas for a folder library (Image card / moodboard asset strip).
 * @param {string} folderId
 */
export function listFolderVisualPicks(folderId) {
  const id = String(folderId || "").trim();
  if (!id) return [];
  return flattenVisualPicksFromCatalogs([
    { ownerKind: "folder", ownerId: id, items: listLibraryItems("folder", id) },
  ]);
}

/**
 * Workspace visual fichas excluding a folder catalog (no duplicate of that folder's assets).
 * @param {{ excludeFolderId?: string }} [opts]
 */
export function listWorkspaceVisualPicks({ excludeFolderId = "" } = {}) {
  return flattenVisualPicksFromCatalogs(listAllLibraryCatalogs(), { excludeFolderId });
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

/**
 * Moodboard slot has a fillable image (src, library link, or external link).
 * @param {{ src?: string, libraryItemId?: string, externalUrl?: string, imageSaved?: boolean }|null|undefined} slot
 */
export function moodboardSlotHasImage(slot) {
  if (!slot) return false;
  const src = String(slot.src || "").trim();
  const libraryItemId = String(slot.libraryItemId || "").trim();
  const externalUrl = String(slot.externalUrl || "").trim();
  return Boolean(src || libraryItemId || externalUrl);
}

/**
 * @param {import("./folderLibraryNormalize.js").FolderLibraryItem|null|undefined} item
 * @returns {string}
 */
export function libraryItemDownloadSourceUrl(item) {
  if (!item) return "";
  const source = String(item.sourceMediaUrl || "").trim();
  if (source) return source;
  return String(item.mediaUrl || "").trim();
}

/**
 * Find library ficha for a moodboard slot.
 * @param {{ libraryItemId?: string, libraryOwnerKind?: string, libraryOwnerId?: string, src?: string }|null|undefined} slot
 * @param {LibraryCatalog[]} catalogs
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function findLibraryItemBySlot(slot, catalogs = []) {
  const link = resolveImageSplitLibraryLink(slot, catalogs);
  if (!link) return null;
  for (const catalog of catalogs) {
    if (catalog.ownerKind !== link.ownerKind || catalog.ownerId !== link.ownerId) continue;
    const hit = (catalog.items || []).find(
      (item) => String(item?.id || "").trim() === link.itemId,
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * Persisted src when library frame matches slot frame (shared bucket URL, no upload).
 * @param {string} slotFrame
 * @param {import("./folderLibraryNormalize.js").FolderLibraryItem|null|undefined} item
 * @returns {string}
 */
export function moodboardSlotPersistedSrcForLibrary(slotFrame, item) {
  if (!item) return "";
  const libFrame = normalizeLibraryFrameAspect(item.frameAspect);
  const target = normalizeLibraryFrameAspect(slotFrame);
  if (!libFrame || !target || libFrame !== target) return "";
  return String(item.mediaUrl || "").trim();
}

/**
 * @typedef {{ mode: "baked"|"contain"|"legacy", displaySrc: string, downloadSourceUrl: string, wallColor: string|null, frameAspect: string|null }} MoodboardSlotPresentation
 */

/**
 * Resolve moodboard cell preview + download source (no upload on pick).
 * @param {{ src?: string, libraryItemId?: string, frameAspect?: string|null, wallColor?: string|null, sourceMediaUrl?: string }|null|undefined} slot
 * @param {import("./folderLibraryNormalize.js").FolderLibraryItem|null|undefined} libraryItem
 * @returns {MoodboardSlotPresentation}
 */
export function resolveMoodboardSlotPresentation(slot, libraryItem) {
  const slotSrc = String(slot?.src || "").trim();
  const slotFrame = normalizeLibraryFrameAspect(slot?.frameAspect);
  const slotWall = normalizeWallColor(slot?.wallColor);
  const libraryItemId = String(slot?.libraryItemId || "").trim();

  if (!libraryItemId && slotSrc) {
    return {
      mode: "legacy",
      displaySrc: slotSrc,
      downloadSourceUrl: String(slot?.sourceMediaUrl || "").trim() || slotSrc,
      wallColor: slotWall,
      frameAspect: slotFrame,
    };
  }

  if (libraryItem) {
    const libFrame = normalizeLibraryFrameAspect(libraryItem.frameAspect);
    const downloadSourceUrl = libraryItemDownloadSourceUrl(libraryItem);
    const wallColor = slotWall || normalizeWallColor(libraryItem.wallColor);
    const mediaUrl = String(libraryItem.mediaUrl || "").trim();

    if (slotFrame && libFrame === slotFrame && mediaUrl) {
      return {
        mode: "baked",
        displaySrc: mediaUrl,
        downloadSourceUrl,
        wallColor,
        frameAspect: slotFrame,
      };
    }

    const previewSrc = downloadSourceUrl || mediaUrl;
    if (previewSrc) {
      return {
        mode: "contain",
        displaySrc: previewSrc,
        downloadSourceUrl: downloadSourceUrl || previewSrc,
        wallColor,
        frameAspect: slotFrame,
      };
    }
  }

  if (slotSrc) {
    return {
      mode: "legacy",
      displaySrc: slotSrc,
      downloadSourceUrl: String(slot?.sourceMediaUrl || "").trim() || slotSrc,
      wallColor: slotWall,
      frameAspect: slotFrame,
    };
  }

  return {
    mode: "contain",
    displaySrc: "",
    downloadSourceUrl: "",
    wallColor: slotWall,
    frameAspect: slotFrame,
  };
}
