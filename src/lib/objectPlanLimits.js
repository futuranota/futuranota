import {
  OBJECT_ROLE_CORPUS,
  OBJECT_ROLE_GUEST,
  OBJECT_ROLE_SATELLITE,
} from "./objectColors.js";
import { getPlanLimits } from "./planConfig.js";

/**
 * Invited 3rd-party object (campaign-folder workspace only).
 * Legacy `satellite` is a full corpus, not a guest.
 * @param {{ role?: string }|null|undefined} object
 */
export function isGuestObject(object) {
  return object?.role === OBJECT_ROLE_GUEST;
}

/**
 * Owned operating corpus (full Departments / Documents / Agents / Assistance).
 * @param {{ role?: string }|null|undefined} object
 */
export function isOwnedCorpusObject(object) {
  const role = object?.role;
  return role === OBJECT_ROLE_CORPUS || role === OBJECT_ROLE_SATELLITE || !role;
}

/**
 * @param {Record<string, { role?: string }>} objectsById
 */
export function countOwnedCorpora(objectsById = {}) {
  return Object.values(objectsById || {}).filter(isOwnedCorpusObject).length;
}

/**
 * @param {Record<string, { role?: string }>} objectsById
 */
export function countGuestObjects(objectsById = {}) {
  return Object.values(objectsById || {}).filter(isGuestObject).length;
}

/**
 * Undo accidental guest role on companies that already have a corpus tree
 * (departments, or folders that are not campaign-model).
 * @param {Record<string, object>} objectsById
 * @param {Array<{ objectId?: string|null }>|Record<string, { objectId?: string|null }>} departments
 * @param {Record<string, { parentObjectId?: string|null, campaignActive?: boolean }>} [docsById]
 */
export function restoreMisclassifiedGuestCorpora(objectsById = {}, departments = [], docsById = {}) {
  const deptList = Array.isArray(departments) ? departments : Object.values(departments || {});
  const deptObjectIds = new Set(deptList.map((d) => d?.objectId).filter(Boolean));
  const structuralObjectIds = new Set(deptObjectIds);
  for (const doc of Object.values(docsById || {})) {
    if (!doc?.parentObjectId || doc.campaignActive) continue;
    structuralObjectIds.add(doc.parentObjectId);
  }
  let changed = false;
  const next = { ...objectsById };
  for (const [id, obj] of Object.entries(next)) {
    if (obj?.role !== OBJECT_ROLE_GUEST) continue;
    if (!structuralObjectIds.has(id)) continue;
    next[id] = { ...obj, role: OBJECT_ROLE_SATELLITE };
    changed = true;
  }
  return changed ? next : objectsById;
}

/**
 * @param {Record<string, { parentObjectId?: string|null }>} docsById
 * @param {string} objectId
 */
export function countDocsForObject(docsById = {}, objectId) {
  if (!objectId) return 0;
  return Object.values(docsById || {}).filter((doc) => doc?.parentObjectId === objectId).length;
}

/**
 * @param {string} [plan]
 */
export function getObjectPlanCaps(plan) {
  const limits = getPlanLimits(plan);
  return {
    maxOwnedCorpora: limits.maxOwnedCorpora ?? 1,
    maxGuestObjects: limits.maxGuestObjects ?? 0,
    maxDocsPerGuest: limits.maxDocsPerGuest ?? 0,
  };
}

/**
 * @param {Record<string, { role?: string }>} objectsById
 * @param {string} [plan]
 */
export function canCreateOwnedCorpus(objectsById, plan) {
  const { maxOwnedCorpora } = getObjectPlanCaps(plan);
  return countOwnedCorpora(objectsById) < maxOwnedCorpora;
}

/**
 * @param {Record<string, { role?: string }>} objectsById
 * @param {string} [plan]
 */
export function canCreateGuest(objectsById, plan) {
  const { maxGuestObjects } = getObjectPlanCaps(plan);
  return countGuestObjects(objectsById) < maxGuestObjects;
}

/**
 * @param {{ role?: string }|null|undefined} object
 * @param {Record<string, { parentObjectId?: string|null }>} docsById
 * @param {string} [plan]
 */
export function canAddDocToObject(object, docsById, plan) {
  if (!isGuestObject(object)) return true;
  if (!object?.id) return false;
  const { maxDocsPerGuest } = getObjectPlanCaps(plan);
  return countDocsForObject(docsById, object.id) < maxDocsPerGuest;
}
