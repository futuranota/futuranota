/** Studio v1 — aspect ratios + Vimeo join CTA + session draft. */

export const STUDIO_ASPECT_RATIOS = /** @type {const} */ (["16:9", "9:16", "1:1"]);

export const STUDIO_DEFAULT_ASPECT = "16:9";

/** Official Vimeo signup for users without an account. */
export const VIMEO_JOIN_URL = "https://vimeo.com/join";

export const STUDIO_SESSION_KEY = "fn-studio-v1";

/**
 * @param {unknown} value
 * @returns {"16:9"|"9:16"|"1:1"}
 */
export function normalizeStudioAspectRatio(value) {
  const raw = String(value || "").trim();
  if (STUDIO_ASPECT_RATIOS.includes(/** @type {"16:9"|"9:16"|"1:1"} */ (raw))) {
    return /** @type {"16:9"|"9:16"|"1:1"} */ (raw);
  }
  return STUDIO_DEFAULT_ASPECT;
}

/**
 * CSS aspect-ratio value for a studio frame.
 * @param {string} aspectRatio
 */
export function studioAspectCss(aspectRatio) {
  const id = normalizeStudioAspectRatio(aspectRatio);
  if (id === "9:16") return "9 / 16";
  if (id === "1:1") return "1 / 1";
  return "16 / 9";
}

/**
 * @typedef {{
 *   rawInput: string,
 *   embedSrc: string,
 *   videoId: string,
 *   wallColor: string | null,
 *   aspectRatio: "16:9"|"9:16"|"1:1",
 * }} StudioSessionDraft
 */

/** @returns {StudioSessionDraft} */
export function emptyStudioSessionDraft() {
  return {
    rawInput: "",
    embedSrc: "",
    videoId: "",
    wallColor: null,
    aspectRatio: STUDIO_DEFAULT_ASPECT,
  };
}

/**
 * @param {unknown} raw
 * @returns {StudioSessionDraft}
 */
export function normalizeStudioSessionDraft(raw) {
  const base = emptyStudioSessionDraft();
  if (!raw || typeof raw !== "object") return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    rawInput: typeof o.rawInput === "string" ? o.rawInput : "",
    embedSrc: typeof o.embedSrc === "string" ? o.embedSrc : "",
    videoId: typeof o.videoId === "string" ? o.videoId : "",
    wallColor: typeof o.wallColor === "string" && o.wallColor ? o.wallColor : null,
    aspectRatio: normalizeStudioAspectRatio(o.aspectRatio),
  };
}

/** @returns {StudioSessionDraft} */
export function loadStudioSessionDraft() {
  if (typeof sessionStorage === "undefined") return emptyStudioSessionDraft();
  try {
    const raw = sessionStorage.getItem(STUDIO_SESSION_KEY);
    if (!raw) return emptyStudioSessionDraft();
    return normalizeStudioSessionDraft(JSON.parse(raw));
  } catch {
    return emptyStudioSessionDraft();
  }
}

/** @param {StudioSessionDraft} draft */
export function saveStudioSessionDraft(draft) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STUDIO_SESSION_KEY,
      JSON.stringify(normalizeStudioSessionDraft(draft)),
    );
  } catch {
    // quota / private mode — ignore
  }
}
