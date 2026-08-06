/**
 * Shared Gina “searching…” prelude + files-movements SFX gate.
 * Use whenever Gina looks up documents, folders, or categories in the live corpus.
 */

/**
 * @param {string} [locale]
 * @returns {{ preludeMessage: string }}
 */
export function buildGinaSearchSequence(locale = "es") {
  const en = locale === "en";
  return {
    preludeMessage: en
      ? "Wait, give me a moment..."
      : "Espera, dame un momento...",
  };
}

/**
 * Families that always play the search prelude (lookup in corpus).
 * Callers may also attach the sequence for scoped `today` (dept focus).
 */
export const GINA_SEARCH_SEQUENCE_FAMILIES = new Set([
  "find_document",
  "folder_summary",
  "count_folders",
  "count_categories",
]);

/**
 * @param {string} family
 * @param {object} [toolContext]
 * @returns {boolean}
 */
export function shouldUseGinaSearchSequence(family, toolContext = {}) {
  if (GINA_SEARCH_SEQUENCE_FAMILIES.has(family)) return true;
  // Department focus / expand into a dept's today scope = a lookup
  if (family === "today" && toolContext?.filters?.department) return true;
  return false;
}
