import { useDocsStore } from "../stores/docsStore.js";
import {
  buildFolderLibraryItem,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryItems,
} from "./folderLibraryNormalize.js";

export {
  FOLDER_LIBRARY_CATEGORIES,
  buildFolderLibraryItem,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryItem,
  normalizeFolderLibraryItems,
} from "./folderLibraryNormalize.js";

/**
 * @param {string} folderId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function listFolderLibraryItems(folderId) {
  const id = String(folderId || "").trim();
  if (!id) return [];
  const doc = useDocsStore.getState().getDoc?.(id)
    ?? useDocsStore.getState().docs?.[id]
    ?? null;
  return normalizeFolderLibraryItems(doc?.libraryItems);
}

/**
 * @param {string} folderId
 * @param {{ tag?: string, description?: string, category?: string, mediaUrl?: string|null }} input
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function createFolderLibraryItem(folderId, input = {}) {
  const id = String(folderId || "").trim();
  if (!id) return null;
  const item = buildFolderLibraryItem(input);
  if (!item) return null;

  const prev = listFolderLibraryItems(id);
  useDocsStore.getState().updateDoc(id, { libraryItems: [...prev, item] });
  return item;
}

/**
 * @param {string} folderId
 * @param {string} itemId
 * @param {{ tag?: string, description?: string, category?: string, mediaUrl?: string|null }} patch
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function updateFolderLibraryItem(folderId, itemId, patch = {}) {
  const folder = String(folderId || "").trim();
  const targetId = String(itemId || "").trim();
  if (!folder || !targetId) return null;

  const prev = listFolderLibraryItems(folder);
  const index = prev.findIndex((item) => item.id === targetId);
  if (index < 0) return null;

  const current = prev[index];
  const nextTag = patch.tag !== undefined ? String(patch.tag).trim() : current.tag;
  if (!nextTag) return null;

  const mediaUrl = patch.mediaUrl !== undefined
    ? (typeof patch.mediaUrl === "string" && patch.mediaUrl.trim()
      ? patch.mediaUrl.trim()
      : null)
    : current.mediaUrl;

  const next = {
    ...current,
    tag: nextTag,
    description: patch.description !== undefined
      ? String(patch.description).trim()
      : current.description,
    category: patch.category !== undefined
      ? normalizeFolderLibraryCategory(patch.category)
      : current.category,
    mediaUrl,
    mediaKind: mediaUrl ? "image" : null,
    updatedAt: new Date().toISOString(),
  };

  const items = [...prev];
  items[index] = next;
  useDocsStore.getState().updateDoc(folder, { libraryItems: items });
  return next;
}

/**
 * @param {string} folderId
 * @param {string} itemId
 * @returns {boolean}
 */
export function removeFolderLibraryItem(folderId, itemId) {
  const folder = String(folderId || "").trim();
  const targetId = String(itemId || "").trim();
  if (!folder || !targetId) return false;

  const prev = listFolderLibraryItems(folder);
  const next = prev.filter((item) => item.id !== targetId);
  if (next.length === prev.length) return false;
  useDocsStore.getState().updateDoc(folder, { libraryItems: next });
  return true;
}
