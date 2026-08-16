import { useDocsStore } from "../stores/docsStore.js";
import {
  buildFolderLibraryItem,
  inferAttachmentKind,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryItems,
  normalizeWallColor,
} from "./folderLibraryNormalize.js";

export {
  FOLDER_LIBRARY_CATEGORIES,
  FOLDER_LIBRARY_DEFAULT_WALL,
  FOLDER_LIBRARY_FILTER_TABS,
  buildFolderLibraryItem,
  folderLibraryItemMatchesFilter,
  inferAttachmentKind,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryFilterTab,
  normalizeFolderLibraryItem,
  normalizeFolderLibraryItems,
  normalizeWallColor,
  resolveWallColor,
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
 * @param {object} input
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
 * @param {object} patch
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

  const category = patch.category !== undefined
    ? normalizeFolderLibraryCategory(patch.category)
    : current.category;

  const mediaUrl = patch.mediaUrl !== undefined
    ? (typeof patch.mediaUrl === "string" && patch.mediaUrl.trim()
      ? patch.mediaUrl.trim()
      : null)
    : current.mediaUrl;

  const attachmentUrl = patch.attachmentUrl !== undefined
    ? (typeof patch.attachmentUrl === "string" && patch.attachmentUrl.trim()
      ? patch.attachmentUrl.trim()
      : null)
    : current.attachmentUrl;

  const attachmentName = patch.attachmentName !== undefined
    ? (typeof patch.attachmentName === "string" && patch.attachmentName.trim()
      ? patch.attachmentName.trim()
      : null)
    : (attachmentUrl ? current.attachmentName : null);

  const attachmentKind = attachmentUrl
    ? (patch.attachmentKind !== undefined
      ? (typeof patch.attachmentKind === "string" && patch.attachmentKind.trim()
        ? patch.attachmentKind.trim().toLowerCase()
        : inferAttachmentKind(attachmentName || "", ""))
      : (current.attachmentKind || inferAttachmentKind(attachmentName || "", "")))
    : null;

  const wallColor = patch.wallColor !== undefined
    ? normalizeWallColor(patch.wallColor)
    : current.wallColor;

  const next = {
    ...current,
    tag: nextTag,
    description: patch.description !== undefined
      ? String(patch.description).trim()
      : current.description,
    category,
    mediaUrl,
    mediaKind: mediaUrl
      ? (category === "video" || current.mediaKind === "video" ? "video" : "image")
      : null,
    attachmentUrl,
    attachmentName: attachmentUrl ? attachmentName : null,
    attachmentKind,
    wallColor,
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
