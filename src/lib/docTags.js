/** Stable palette index from tag label (for chip colors). */
export const DOC_TAG_COLOR_COUNT = 4;

export function tagColorIndex(label) {
  let h = 0;
  const s = String(label || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % DOC_TAG_COLOR_COUNT;
}

export function normalizeTagLabel(raw) {
  return String(raw || "").trim().replace(/^,+|,+$/g, "");
}
