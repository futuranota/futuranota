/**
 * Doc / node writing typography presets.
 *
 * `legacy` — original body style (Quicksand). Kept for a future style switcher.
 * `normal` — default body style (Hanken Grotesk).
 */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   fontFamily: string,
 *   fontSize: string,
 *   fontWeight: string,
 *   lineHeight: string,
 *   letterSpacing: string,
 *   fontOpticalSizing?: string,
 *   fontStyle: string,
 * }} DocTextTypographyPreset */

/** Original regular text before Hanken Grotesk became the default. */
export const LEGACY_DOC_TEXT_TYPOGRAPHY = /** @type {DocTextTypographyPreset} */ ({
  id: "legacy",
  label: "Classic body",
  fontFamily: '"Quicksand", system-ui, sans-serif',
  fontSize: "16px",
  fontWeight: "400",
  lineHeight: "1.45",
  letterSpacing: "0.02em",
  fontStyle: "normal",
});

/** Default normal text — Hanken Grotesk 14 / 400. */
export const NORMAL_DOC_TEXT_TYPOGRAPHY = /** @type {DocTextTypographyPreset} */ ({
  id: "normal",
  label: "Normal text",
  fontFamily: '"Hanken Grotesk", sans-serif',
  fontSize: "14px",
  fontWeight: "400",
  lineHeight: "1.45",
  letterSpacing: "normal",
  fontOpticalSizing: "auto",
  fontStyle: "normal",
});

export const DOC_TEXT_TYPOGRAPHY_PRESETS = {
  legacy: LEGACY_DOC_TEXT_TYPOGRAPHY,
  normal: NORMAL_DOC_TEXT_TYPOGRAPHY,
};

export const DEFAULT_DOC_TEXT_TYPOGRAPHY_ID = NORMAL_DOC_TEXT_TYPOGRAPHY.id;

export function getDocTextTypographyPreset(id = DEFAULT_DOC_TEXT_TYPOGRAPHY_ID) {
  return DOC_TEXT_TYPOGRAPHY_PRESETS[id] ?? NORMAL_DOC_TEXT_TYPOGRAPHY;
}

/** CSS custom-property map for applying a preset on a root element. */
export function docTextTypographyCssVars(preset = NORMAL_DOC_TEXT_TYPOGRAPHY) {
  return {
    "--font-doc": preset.fontFamily,
    "--font-doc-size": preset.fontSize,
    "--font-doc-weight": preset.fontWeight,
    "--font-doc-line-height": preset.lineHeight,
    "--font-doc-letter-spacing": preset.letterSpacing,
    "--font-doc-optical-sizing": preset.fontOpticalSizing ?? "auto",
  };
}
