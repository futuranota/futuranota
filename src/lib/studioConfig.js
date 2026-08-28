/** Studio — aspect ratios, wizard phases, mockups, Vimeo CTA, session draft. */

import { normalizeWallColor } from "./folderLibraryNormalize.js";

export const STUDIO_ASPECT_RATIOS = /** @type {const} */ ([
  "2:3",
  "3:2",
  "1:1",
  "9:16",
  "16:9",
]);

export const STUDIO_DEFAULT_ASPECT = "16:9";

/** Wizard: link → ratio → mockup → wall → visualize */
export const STUDIO_PHASES = /** @type {const} */ ([
  "embed",
  "aspect",
  "mockup",
  "wall",
  "view",
]);

export const STUDIO_DEFAULT_PHASE = "embed";

export const STUDIO_MOCKUP_IDS = /** @type {const} */ (["none", "x"]);

export const STUDIO_DEFAULT_MOCKUP = "none";

export const STUDIO_MOCKUPS = /** @type {const} */ ([
  {
    id: "none",
    labelKey: "mockupNone",
    descKey: "mockupNoneDesc",
    defaultWall: "#151515",
    defaultStroke: null,
    defaultText: "#E7E9EA",
    usesIdentity: false,
  },
  {
    id: "x",
    labelKey: "mockupX",
    descKey: "mockupXDesc",
    defaultWall: "#000000",
    defaultStroke: "#191A1C",
    defaultText: "#E7E9EA",
    usesIdentity: true,
  },
]);

export const STUDIO_DEFAULT_TEXT_COLOR = "#E7E9EA";

/** Vimeo homepage — CTA link in Studio embed step. */
export const VIMEO_JOIN_URL = "https://vimeo.com/";

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
 * @returns {"embed"|"aspect"|"mockup"|"wall"|"view"}
 */
export function normalizeStudioPhase(value) {
  const raw = String(value || "").trim();
  if (STUDIO_PHASES.includes(/** @type {typeof STUDIO_PHASES[number]} */ (raw))) {
    return /** @type {typeof STUDIO_PHASES[number]} */ (raw);
  }
  return STUDIO_DEFAULT_PHASE;
}

/**
 * @param {unknown} value
 * @returns {"none"|"x"}
 */
export function normalizeStudioMockupId(value) {
  const raw = String(value || "").trim();
  if (raw === "x-zoom") return "x";
  if (STUDIO_MOCKUP_IDS.includes(/** @type {typeof STUDIO_MOCKUP_IDS[number]} */ (raw))) {
    return /** @type {typeof STUDIO_MOCKUP_IDS[number]} */ (raw);
  }
  return STUDIO_DEFAULT_MOCKUP;
}

/**
 * @param {string} mockupId
 */
export function studioMockupUsesChrome(mockupId) {
  return normalizeStudioMockupId(mockupId) === "x";
}

/**
 * Zoom post layout with temporary logo / name / description slots.
 * @param {string} mockupId
 */
export function studioMockupUsesIdentity(mockupId) {
  return getStudioMockup(mockupId).usesIdentity === true;
}

/**
 * Max logo data-URL size for session draft (~400 KB).
 */
export const STUDIO_LOGO_MAX_BYTES = 400 * 1024;

/**
 * @param {string} mockupId
 * @returns {(typeof STUDIO_MOCKUPS)[number]}
 */
export function getStudioMockup(mockupId) {
  const id = normalizeStudioMockupId(mockupId);
  return STUDIO_MOCKUPS.find((m) => m.id === id) || STUDIO_MOCKUPS[0];
}

/**
 * Defaults applied when the user picks a mockup (wall + video frame stroke).
 * @param {string} mockupId
 */
export function studioMockupColorDefaults(mockupId) {
  const m = getStudioMockup(mockupId);
  return {
    mockupId: m.id,
    wallColor: m.defaultWall,
    frameStroke: m.defaultStroke,
    draftTextColor: m.defaultText || STUDIO_DEFAULT_TEXT_COLOR,
  };
}

/**
 * Portrait ratios → X zoom "zoom" (video only). Landscape / 1:1 → "post".
 * @param {string} aspectRatio
 * @returns {boolean}
 */
export function studioAspectIsPortrait(aspectRatio) {
  const id = normalizeStudioAspectRatio(aspectRatio);
  return id === "9:16" || id === "2:3";
}

/**
 * @param {string} aspectRatio
 * @returns {"zoom"|"post"}
 */
export function studioXZoomLayoutMode(aspectRatio) {
  return studioAspectIsPortrait(aspectRatio) ? "zoom" : "post";
}

/**
 * @param {string|null|undefined} textColor
 * @param {string} mockupId
 * @returns {string}
 */
export function resolveStudioTextColor(textColor, mockupId) {
  const normalized = normalizeWallColor(textColor);
  if (normalized) return normalized;
  return getStudioMockup(mockupId).defaultText || STUDIO_DEFAULT_TEXT_COLOR;
}

/**
 * Normalize stroke hex (same rules as wall) or null.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeStudioFrameStroke(value) {
  return normalizeWallColor(value);
}

/**
 * Resolve stroke for the video hole; fallback to mockup default when set.
 * @param {string|null|undefined} frameStroke
 * @param {string} mockupId
 * @returns {string|null}
 */
export function resolveStudioFrameStroke(frameStroke, mockupId) {
  const normalized = normalizeStudioFrameStroke(frameStroke);
  if (normalized) return normalized;
  return getStudioMockup(mockupId).defaultStroke;
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
 *   frameStroke: string | null,
 *   mockupId: typeof STUDIO_MOCKUP_IDS[number],
 *   aspectRatio: typeof STUDIO_ASPECT_RATIOS[number],
 *   phase: typeof STUDIO_PHASES[number],
 *   draftDisplayName: string,
 *   draftDescription: string,
 *   draftLogoDataUrl: string | null,
 *   draftTextColor: string | null,
 * }} StudioSessionDraft
 */

/** @returns {StudioSessionDraft} */
export function emptyStudioSessionDraft() {
  return {
    rawInput: "",
    embedSrc: "",
    videoId: "",
    wallColor: null,
    frameStroke: null,
    mockupId: STUDIO_DEFAULT_MOCKUP,
    aspectRatio: STUDIO_DEFAULT_ASPECT,
    phase: STUDIO_DEFAULT_PHASE,
    draftDisplayName: "",
    draftDescription: "",
    draftLogoDataUrl: null,
    draftTextColor: null,
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
  if (!embedSrc && phase !== "embed") phase = "embed";
  const mockupId = normalizeStudioMockupId(o.mockupId);
  const logo = typeof o.draftLogoDataUrl === "string" && o.draftLogoDataUrl.startsWith("data:")
    ? o.draftLogoDataUrl
    : null;
  return {
    rawInput: typeof o.rawInput === "string" ? o.rawInput : "",
    embedSrc,
    videoId: typeof o.videoId === "string" ? o.videoId : "",
    wallColor: typeof o.wallColor === "string" && o.wallColor
      ? normalizeWallColor(o.wallColor)
      : null,
    frameStroke: typeof o.frameStroke === "string" && o.frameStroke
      ? normalizeStudioFrameStroke(o.frameStroke)
      : null,
    mockupId,
    aspectRatio: normalizeStudioAspectRatio(o.aspectRatio),
    phase,
    draftDisplayName: typeof o.draftDisplayName === "string"
      ? o.draftDisplayName.slice(0, 80)
      : "",
    draftDescription: typeof o.draftDescription === "string"
      ? o.draftDescription.slice(0, 280)
      : "",
    draftLogoDataUrl: logo,
    draftTextColor: typeof o.draftTextColor === "string" && o.draftTextColor
      ? normalizeWallColor(o.draftTextColor)
      : null,
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

/** Drop the tab draft so the next open starts empty. */
export function clearStudioSessionDraft() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STUDIO_SESSION_KEY);
  } catch {
    // private mode — ignore
  }
}
