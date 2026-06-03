import { OBJECT_ROLE_CORPUS } from "./objectColors.js";

/**
 * @typedef {Object} CurrentCorpus
 * @property {string} id
 * @property {string} name
 * @property {string} brandName
 */

/**
 * Resolve the active corpus object and brand label for analytics.
 * @param {Record<string, { id: string, name?: string, brand?: string, role?: string }>} objectsById
 * @param {string|null} selectedObjectId
 * @returns {{ currentCorpus: CurrentCorpus|null, brandName: string }}
 */
export function resolveCurrentCorpus(objectsById = {}, selectedObjectId = null) {
  const objects = Object.values(objectsById || {});
  const corpusObject = objects.find((o) => o?.role === OBJECT_ROLE_CORPUS) || null;
  const selected = selectedObjectId ? objectsById[selectedObjectId] : null;
  const focus = selected?.role === OBJECT_ROLE_CORPUS ? selected : corpusObject;

  if (!focus) {
    return { currentCorpus: null, brandName: "" };
  }

  const brandName = (focus.brand || "").trim() || (focus.name || "").trim();
  return {
    currentCorpus: {
      id: focus.id,
      name: (focus.name || "").trim() || "Corpus",
      brandName,
    },
    brandName,
  };
}
