/**
 * How a library ficha should fill a card / mini / asset slot.
 * @typedef {"image"|"prompt"|"badge"} FichaPreviewKind
 * @typedef {"image"|"prompt"} FichaPreviewPrefer
 * @typedef {"folder"|"document"} LibraryTileOwnerKind
 */

import { isLibraryVisualPresentation } from "./folderLibraryNormalize.js";

/** Small cue on prompt-first tiles that the ficha also has a reference photo. */
export const LIBRARY_MEDIA_BADGE_SRC = "/uploads/img.svg";

/**
 * Folder Library / Assets / Library Prompt grid fill the photo.
 * Compact Docs index squares fill the written prompt (+ img.svg if there is a photo).
 * @param {string} [ownerKind]
 * @returns {FichaPreviewPrefer}
 */
export function libraryTilePrefer(ownerKind) {
  return String(ownerKind || "").trim().toLowerCase() === "document"
    ? "prompt"
    : "image";
}

/**
 * Opening face of a Prompt ficha detail from Library (visual first).
 * Photo when it exists; otherwise Ref.
 * @param {string} [_ownerKind]
 * @param {{ hasImage?: boolean, hasRef?: boolean }} [flags]
 * @returns {"image"|"ref"}
 */
export function libraryFichaDetailMode(_ownerKind, { hasImage = false, hasRef = false } = {}) {
  if (hasImage) return "image";
  return hasRef ? "ref" : "image";
}

/**
 * @param {{ description?: string|null }|null|undefined} item
 * @returns {string}
 */
export function promptPreviewText(item) {
  return String(item?.description || "").trim();
}

/**
 * @param {{ mediaUrl?: string|null, category?: string }|null|undefined} item
 * @returns {boolean}
 */
export function fichaHasVisual(item) {
  if (!item) return false;
  if (item.category === "skill" || item.category === "pdf") return false;
  return Boolean(String(item.mediaUrl || "").trim());
}

/**
 * Library / Assets prefer the photo. Docs / Prompt prefer the written prompt.
 * Visual presentation always prefers the photo (image-only chip).
 * If the preferred face is empty, fall back so an image-only ficha never looks blank.
 *
 * @param {{ description?: string|null, mediaUrl?: string|null, category?: string, presentation?: string }|null|undefined} item
 * @param {FichaPreviewPrefer} [prefer]
 * @returns {FichaPreviewKind}
 */
export function resolveFichaPreviewKind(item, prefer = "prompt") {
  const hasPrompt = Boolean(promptPreviewText(item));
  const hasVisual = fichaHasVisual(item);
  const facePrefer = isLibraryVisualPresentation(item) ? "image" : prefer;
  if (facePrefer === "image") {
    if (hasVisual) return "image";
    if (hasPrompt) return "prompt";
    return "badge";
  }
  if (hasPrompt) return "prompt";
  if (hasVisual) return "image";
  return "badge";
}

/**
 * Prompt-first tile that still has a photo — show img.svg, not the photo.
 * @param {{ description?: string|null, mediaUrl?: string|null, category?: string }|null|undefined} item
 * @param {FichaPreviewPrefer} [prefer]
 */
export function fichaShowsMediaBadge(item, prefer = "prompt") {
  return resolveFichaPreviewKind(item, prefer) === "prompt" && fichaHasVisual(item);
}

/**
 * Docs index: fill squares with prompt fichas first, then image-only leftovers.
 *
 * @param {Array<{ category?: string, description?: string|null, mediaUrl?: string|null }>} items
 * @param {number} [limit]
 */
export function pickDocLibraryPreviews(items, limit = 4) {
  const cap = Math.max(0, Math.floor(Number(limit) || 0));
  const prompts = (Array.isArray(items) ? items : []).filter(
    (item) => item?.category === "image" || item?.category === "auto",
  );
  const withPrompt = prompts.filter((item) => promptPreviewText(item));
  const imageOnly = prompts.filter((item) => !promptPreviewText(item) && fichaHasVisual(item));
  return [...withPrompt, ...imageOnly].slice(0, cap);
}
