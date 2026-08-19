import { listAdoptableDocs } from "./nodeParentAdoption.js";

export const YOUTUBE_TARGET_FOLDER_KEY = "futura-nota-youtube-target-folder-v1";

function readMap() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(YOUTUBE_TARGET_FOLDER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(YOUTUBE_TARGET_FOLDER_KEY, JSON.stringify(map));
  } catch {
    // private mode / quota
  }
}

/** @param {string|null} companyObjectId */
export function getYoutubeTargetFolderId(companyObjectId) {
  if (!companyObjectId) return null;
  const id = readMap()[companyObjectId];
  return typeof id === "string" && id.trim() ? id : null;
}

/**
 * @param {string|null} companyObjectId
 * @param {string|null} folderId
 */
export function setYoutubeTargetFolderId(companyObjectId, folderId) {
  if (!companyObjectId) return;
  const map = readMap();
  const nextId = typeof folderId === "string" ? folderId.trim() : "";
  if (!nextId) {
    delete map[companyObjectId];
  } else {
    map[companyObjectId] = nextId;
  }
  writeMap(map);
}

/** @param {string|null} companyObjectId */
export function clearYoutubeTargetFolderId(companyObjectId) {
  setYoutubeTargetFolderId(companyObjectId, null);
}

/**
 * Stored folder if it still exists and is adoptable for the company; otherwise clear.
 * @param {string|null} companyObjectId
 * @param {Record<string, object>|object[]} docsById
 * @returns {string|null}
 */
export function resolveValidYoutubeTargetFolderId(companyObjectId, docsById = {}) {
  const stored = getYoutubeTargetFolderId(companyObjectId);
  if (!stored) return null;
  const adoptable = listAdoptableDocs(docsById, { parentObjectId: companyObjectId });
  if (!adoptable.some((doc) => doc.id === stored)) {
    clearYoutubeTargetFolderId(companyObjectId);
    return null;
  }
  return stored;
}
