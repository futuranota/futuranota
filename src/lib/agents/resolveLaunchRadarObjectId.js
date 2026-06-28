import { OBJECT_ROLE_CORPUS } from "../objectColors.js";
import { cadenceHasLaunchRadarData } from "./mapDetectionToCadence.js";

/**
 * Object id where Launch Radar reads/writes cadence (always the corpus when present).
 * @param {Record<string, { id?: string, brand?: string, name?: string, role?: string }>} objectsById
 * @param {string} brandName
 * @param {string|null} [fallbackId]
 */
export function resolveLaunchRadarObjectId(objectsById = {}, brandName = "", fallbackId = null) {
  const objects = Object.values(objectsById || {});

  const corpus = objects.find((o) => o?.role === OBJECT_ROLE_CORPUS);
  if (corpus?.id) return corpus.id;

  const brandLower = (brandName || "").trim().toLowerCase();
  if (brandLower) {
    const match = objects.find((o) => {
      const label = (o?.brand || o?.name || "").trim().toLowerCase();
      return label && label === brandLower;
    });
    if (match?.id) return match.id;
  }

  if (fallbackId && objectsById[fallbackId]) return fallbackId;

  return null;
}

/**
 * Finds cadence on any object for this brand (handles stale parentObjectId writes).
 * @param {Record<string, object>} objectsById
 * @param {string} brandName
 * @param {object|null|undefined} primaryCadence
 */
export function resolveStoredCadenceForBrand(objectsById = {}, brandName = "", primaryCadence = null) {
  if (cadenceHasLaunchRadarData(primaryCadence)) {
    return primaryCadence;
  }

  const brandLower = (brandName || "").trim().toLowerCase();

  for (const obj of Object.values(objectsById || {})) {
    const c = obj?.cadence;
    if (!cadenceHasLaunchRadarData(c)) continue;
    if (!brandLower) return c;
    const label = (obj.brand || obj.name || "").trim().toLowerCase();
    if (label && label === brandLower) return c;
  }

  for (const obj of Object.values(objectsById || {})) {
    if (cadenceHasLaunchRadarData(obj?.cadence)) return obj.cadence;
  }

  return primaryCadence ?? null;
}
