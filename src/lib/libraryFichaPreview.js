/**
 * How a library ficha should fill a card / mini / asset slot.
 * @typedef {"image"|"prompt"|"badge"} FichaPreviewKind
 * @typedef {"image"|"prompt"} FichaPreviewPrefer
 */

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
 * If the preferred face is empty, fall back so an image-only ficha never looks blank.
 *
 * @param {{ description?: string|null, mediaUrl?: string|null, category?: string }|null|undefined} item
 * @param {FichaPreviewPrefer} [prefer]
 * @returns {FichaPreviewKind}
 */
export function resolveFichaPreviewKind(item, prefer = "prompt") {
  const hasPrompt = Boolean(promptPreviewText(item));
  const hasVisual = fichaHasVisual(item);
  if (prefer === "image") {
    if (hasVisual) return "image";
    if (hasPrompt) return "prompt";
    return "badge";
  }
  if (hasPrompt) return "prompt";
  if (hasVisual) return "image";
  return "badge";
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
