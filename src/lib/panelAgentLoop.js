/**
 * Panel agent loop — Campaign Analyst → Launch Radar, Social Hype → Market Hype.
 * Source of truth: object.cadence on the corpus/company object (not sidebar selection).
 */

import { useObjectsStore } from "../stores/objectsStore.js";
import { resolveLaunchRadarObjectId } from "./agents/resolveLaunchRadarObjectId.js";

/** @typedef {'launch-radar'|'market-hype'} IntelPanelKind */

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export function resolvePanelCorpusObjectId(objectsById, corpusObjectId = null) {
  if (corpusObjectId && objectsById[corpusObjectId]) return corpusObjectId;
  return resolveLaunchRadarObjectId(objectsById, "", null);
}

/**
 * Campaign Analyst finished → Launch Radar switch may activate.
 * Clears prior panel copy so user must toggle again after a new loop.
 * @param {string|null|undefined} corpusObjectId
 */
export function onCampaignAnalystLoopComplete(corpusObjectId) {
  const id = resolvePanelCorpusObjectId(useObjectsStore.getState().objects, corpusObjectId);
  if (!id) return;

  const { objects, updateObject } = useObjectsStore.getState();
  const object = objects[id];
  if (!object) return;

  const cadence = { ...(object.cadence || {}) };
  cadence.launchRadarAgentReadyAt = new Date().toISOString();
  delete cadence.launchRadarPanelSaved;

  updateObject(id, { cadence });
}

/**
 * Social Hype finished → Market Hype Save may activate.
 * Clears prior panel copy so user must Save again after a new loop.
 * @param {string|null|undefined} corpusObjectId
 */
export function onSocialHypeLoopComplete(corpusObjectId) {
  const id = resolvePanelCorpusObjectId(useObjectsStore.getState().objects, corpusObjectId);
  if (!id) return;

  const { objects, updateObject } = useObjectsStore.getState();
  const object = objects[id];
  if (!object) return;

  const cadence = { ...(object.cadence || {}) };
  cadence.hypeAgentReadyAt = new Date().toISOString();
  delete cadence.marketHypePanelSaved;

  updateObject(id, { cadence });
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export function isMarketHypeControlEnabled(objectsById, corpusObjectId) {
  const id = resolvePanelCorpusObjectId(objectsById, corpusObjectId);
  if (!id) return false;
  const cadence = objectsById[id]?.cadence;
  if (cadence?.hypeAgentReadyAt || cadence?.hypeReportReadyAt) return true;
  return Boolean(cadence?.hypeSnapshot?.socialHype);
}

export function isLaunchRadarControlEnabled(objectsById, corpusObjectId) {
  const id = resolvePanelCorpusObjectId(objectsById, corpusObjectId);
  if (!id) return false;
  const cadence = objectsById[id]?.cadence;
  if (cadence?.launchRadarAgentReadyAt || cadence?.launchRadarReportReadyAt) return true;
  return Boolean(cadence?.launchRadarSnapshot);
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export function readLaunchRadarPanelSaved(objectsById, corpusObjectId) {
  const id = resolvePanelCorpusObjectId(objectsById, corpusObjectId);
  if (!id) return null;
  const saved = objectsById[id]?.cadence?.launchRadarPanelSaved;
  return saved && typeof saved === "object" ? saved : null;
}

/**
 * @param {string|null|undefined} corpusObjectId
 * @param {object} payload
 */
export function writeLaunchRadarPanelSaved(corpusObjectId, payload) {
  const id = resolvePanelCorpusObjectId(useObjectsStore.getState().objects, corpusObjectId);
  if (!id || !payload) return false;

  const { objects, updateObject } = useObjectsStore.getState();
  const object = objects[id];
  if (!object) return false;

  const prev = object.cadence?.launchRadarPanelSaved;
  updateObject(id, {
    cadence: {
      ...(object.cadence || {}),
      launchRadarPanelSaved: {
        ...(prev && typeof prev === "object" ? prev : {}),
        ...payload,
        savedAt: new Date().toISOString(),
      },
    },
  });
  return true;
}

/**
 * @param {Record<string, object>} objectsById
 * @param {string|null|undefined} corpusObjectId
 */
export function readMarketHypePanelSaved(objectsById, corpusObjectId) {
  const id = resolvePanelCorpusObjectId(objectsById, corpusObjectId);
  if (!id) return null;
  const saved = objectsById[id]?.cadence?.marketHypePanelSaved;
  return saved && typeof saved === "object" ? saved : null;
}

/**
 * @param {string|null|undefined} corpusObjectId
 * @param {object} payload
 */
export function writeMarketHypePanelSaved(corpusObjectId, payload) {
  const id = resolvePanelCorpusObjectId(useObjectsStore.getState().objects, corpusObjectId);
  if (!id || !payload) return false;

  const { objects, updateObject } = useObjectsStore.getState();
  const object = objects[id];
  if (!object) return false;

  updateObject(id, {
    cadence: {
      ...(object.cadence || {}),
      marketHypePanelSaved: {
        ...payload,
        savedAt: new Date().toISOString(),
      },
    },
  });
  return true;
}

/**
 * Clears saved Market Hype panel copy (does not reset agent-ready flag).
 * @param {string|null|undefined} corpusObjectId
 */
export function clearMarketHypePanelSaved(corpusObjectId) {
  const id = resolvePanelCorpusObjectId(useObjectsStore.getState().objects, corpusObjectId);
  if (!id) return false;

  const { objects, updateObject } = useObjectsStore.getState();
  const object = objects[id];
  if (!object) return false;

  const cadence = { ...(object.cadence || {}) };
  delete cadence.marketHypePanelSaved;
  updateObject(id, { cadence });
  return true;
}
