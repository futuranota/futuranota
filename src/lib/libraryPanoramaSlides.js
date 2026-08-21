/**
 * Loose Prompt fichas with a photo — Panorama v1 slides.
 * @param {Array<{ setId?: string|null, category?: string, mediaUrl?: string|null }>|null|undefined} items
 */
export function listPanoramaPromptSlides(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item || item.setId) return false;
    const cat = String(item.category || "").trim().toLowerCase();
    if (cat !== "image" && cat !== "auto") return false;
    return Boolean(String(item.mediaUrl || "").trim());
  });
}
