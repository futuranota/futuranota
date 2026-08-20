import { LIBRARY_PROMPT_DELIM } from "./libraryPromptCapture.js";
import { normalizeLibraryNameRefs } from "./docLibraryNameRefs.js";
import { normalizeLibrarySpeakRefs } from "./docLibrarySpeakRefs.js";

/**
 * Inner `--…--` span (exclusive of delimiter chars).
 * @param {import("./libraryPromptCapture.js").LibraryPromptCapture} capture
 */
export function captureInnerBounds(capture) {
  const delimLen = LIBRARY_PROMPT_DELIM.length;
  return {
    innerStart: capture.start + delimLen,
    innerEnd: capture.end - delimLen,
  };
}

/**
 * Name refs fully inside a `--…--` capture, rebased to the stripped script (0-based).
 * @param {string} text Full block text before delimiter strip.
 * @param {import("./libraryPromptCapture.js").LibraryPromptCapture} capture
 * @param {import("./docLibraryNameRefs.js").DocLibraryNameRef[]|null|undefined} refs
 * @returns {import("./docLibraryNameRefs.js").DocLibraryNameRef[]}
 */
export function sliceNameRefsForCapture(text, capture, refs) {
  if (!capture || !Array.isArray(refs) || refs.length === 0) return [];
  const { innerStart, innerEnd } = captureInnerBounds(capture);
  const script = String(capture.prompt || "");
  /** @type {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} */
  const sliced = [];
  for (const ref of refs) {
    if (!ref) continue;
    if (ref.start < innerStart || ref.end > innerEnd) continue;
    sliced.push({
      ...ref,
      start: ref.start - innerStart,
      end: ref.end - innerStart,
    });
  }
  return normalizeLibraryNameRefs(script, sliced);
}

/**
 * Speak refs fully inside a `--…--` capture, rebased to the stripped script.
 * @param {string} text
 * @param {import("./libraryPromptCapture.js").LibraryPromptCapture} capture
 * @param {import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[]|null|undefined} refs
 * @returns {import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[]}
 */
export function sliceSpeakRefsForCapture(text, capture, refs) {
  if (!capture || !Array.isArray(refs) || refs.length === 0) return [];
  const { innerStart, innerEnd } = captureInnerBounds(capture);
  const script = String(capture.prompt || "");
  /** @type {import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[]} */
  const sliced = [];
  for (const ref of refs) {
    if (!ref) continue;
    if (ref.start < innerStart || ref.end > innerEnd) continue;
    sliced.push({
      ...ref,
      start: ref.start - innerStart,
      end: ref.end - innerStart,
      dialogueStart: ref.dialogueStart - innerStart,
      dialogueEnd: ref.dialogueEnd - innerStart,
    });
  }
  return normalizeLibrarySpeakRefs(script, sliced);
}

/**
 * @param {string} text
 * @param {import("./libraryPromptCapture.js").LibraryPromptCapture} capture
 * @param {{ libraryNameRefs?: import("./docLibraryNameRefs.js").DocLibraryNameRef[], librarySpeakRefs?: import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[] }} [meta]
 */
export function sliceScriptRefsForCapture(text, capture, meta = {}) {
  return {
    libraryNameRefs: sliceNameRefsForCapture(text, capture, meta.libraryNameRefs),
    librarySpeakRefs: sliceSpeakRefsForCapture(text, capture, meta.librarySpeakRefs),
  };
}
