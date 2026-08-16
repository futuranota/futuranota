/** Studio — aspect ratios, wizard phases, Vimeo CTA, session draft. */

export const STUDIO_ASPECT_RATIOS = /** @type {const} */ ([
  "2:3",
  "3:2",
  "1:1",
  "9:16",
  "16:9",
]);

export const STUDIO_DEFAULT_ASPECT = "16:9";

/** Wizard: link → ratio → wall → visualize */
export const STUDIO_PHASES = /** @type {const} */ ([
  "embed",
  "aspect",
  "wall",
  "view",
]);

export const STUDIO_DEFAULT_PHASE = "embed";

/** Official Vimeo signup for users without an account. */
export const VIMEO_JOIN_URL = "https://vimeo.com/join";

export const STUDIO_SESSION_KEY = "fn-studio-v1";

/**
 * @param {unknown} value
 * @returns {"2:3"|"3:2"|"1:1"|"9:16"|"16:9"}
 */
export function normalizeStudioAspectRatio(value) {
  const raw = String(value || "").trim();
  if (STUDIO_ASPECT_RATIOS.includes(/** @type {typeof STUDIO_ASPECT_RATIOS[number]} */ (raw))) {
    return /** @type {typeof STUDIO_ASPECT_RATIOS[number]} */ (raw);
  }
  return STUDIO_DEFAULT_ASPECT;
}

/**
 * @param {unknown} value
 * @returns {"embed"|"aspect"|"wall"|"view"}
 */
export function normalizeStudioPhase(value) {
  const raw = String(value || "").trim();
  if (STUDIO_PHASES.includes(/** @type {typeof STUDIO_PHASES[number]} */ (raw))) {
    return /** @type {typeof STUDIO_PHASES[number]} */ (raw);
  }
  return STUDIO_DEFAULT_PHASE;
}

/**
 * CSS aspect-ratio value for a studio frame.
 * @param {string} aspectRatio
 */
export function studioAspectCss(aspectRatio) {
  const id = normalizeStudioAspectRatio(aspectRatio);
  if (id === "2:3") return "2 / 3";
  if (id === "3:2") return "3 / 2";
  if (id === "1:1") return "1 / 1";
  if (id === "9:16") return "9 / 16";
  return "16 / 9";
}

/**
 * Frame width hint class modifier (portrait / square / landscape).
 * @param {string} aspectRatio
 */
export function studioFrameSizeClass(aspectRatio) {
  const id = normalizeStudioAspectRatio(aspectRatio);
  if (id === "9:16" || id === "2:3") return "studio-workspace__frame--portrait";
  if (id === "1:1") return "studio-workspace__frame--square";
  if (id === "3:2") return "studio-workspace__frame--landscape-wide";
  return "studio-workspace__frame--landscape";
}

/**
 * i18n key suffix for aspect label (studio.aspectOption.{suffix}).
 * @param {string} aspectRatio
 */
export function studioAspectLabelKey(aspectRatio) {
  const id = normalizeStudioAspectRatio(aspectRatio);
  return ({
    "2:3": "aspect2x3",
    "3:2": "aspect3x2",
    "1:1": "aspect1x1",
    "9:16": "aspect9x16",
    "16:9": "aspect16x9",
  })[id];
}

/**
 * @typedef {{
 *   rawInput: string,
 *   embedSrc: string,
 *   videoId: string,
 *   wallColor: string | null,
 *   aspectRatio: typeof STUDIO_ASPECT_RATIOS[number],
 *   phase: typeof STUDIO_PHASES[number],
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
    phase: STUDIO_DEFAULT_PHASE,
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
  const embedSrc = typeof o.embedSrc === "string" ? o.embedSrc : "";
  let phase = normalizeStudioPhase(o.phase);
  // If we have an embed but phase was never set, stay on embed unless saved as view.
  if (!embedSrc && phase !== "embed") phase = "embed";
  return {
    rawInput: typeof o.rawInput === "string" ? o.rawInput : "",
    embedSrc,
    videoId: typeof o.videoId === "string" ? o.videoId : "",
    wallColor: typeof o.wallColor === "string" && o.wallColor ? o.wallColor : null,
    aspectRatio: normalizeStudioAspectRatio(o.aspectRatio),
    phase,
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
