import { OBJECT_ROLE_CORPUS } from "./objectColors.js";

/**
 * Which object family's doc timeline is the reference axis (past → future).
 * Not derived from creation order — user builds any order, then picks / implies primary.
 *
 * Resolution order:
 * 1. explicit `primaryTimelineObjectId` (store)
 * 2. parent object of first doc in `timelineDocQueue`
 * 3. object with role `corpus`
 *
 * @param {Object} params
 * @param {string|null} [params.explicitId]
 * @param {string[]} [params.timelineDocQueue]
 * @param {Record<string, { parentObjectId?: string }>} [params.docsById]
 * @param {Record<string, { id: string, role?: string }>} [params.objectsById]
 */
export function resolvePrimaryTimelineObjectId({
  explicitId = null,
  timelineDocQueue = [],
  docsById = {},
  objectsById = {},
} = {}) {
  if (explicitId && objectsById[explicitId]) return explicitId;

  for (const docId of timelineDocQueue) {
    const doc = docsById[docId];
    if (doc?.parentObjectId && objectsById[doc.parentObjectId]) {
      return doc.parentObjectId;
    }
  }

  const corpus = Object.values(objectsById).find((o) => o?.role === OBJECT_ROLE_CORPUS);
  if (corpus?.id) return corpus.id;

  return null;
}

/**
 * @param {string|null} objectId
 * @param {string|null} primaryObjectId
 */
export function isSecondaryObjectId(objectId, primaryObjectId) {
  return Boolean(objectId && primaryObjectId && objectId !== primaryObjectId);
}

/**
 * @param {string|null} a
 * @param {string|null} b
 * @param {string|null} primaryObjectId
 * @returns {{ primarySide: 'from'|'to'|null, secondarySide: 'from'|'to'|null }}
 */
export function resolvePrimarySecondarySides(a, b, primaryObjectId) {
  if (!primaryObjectId) return { primarySide: null, secondarySide: null };
  if (a === primaryObjectId) return { primarySide: "from", secondarySide: "to" };
  if (b === primaryObjectId) return { primarySide: "to", secondarySide: "from" };
  return { primarySide: null, secondarySide: null };
}
