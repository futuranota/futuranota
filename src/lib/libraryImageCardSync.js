import {
  listAllLibraryCatalogs,
  listHintedLibraryCatalogs,
  updateLibraryItem,
} from "./folderLibrary.js";
import { syncImageSplitPromptToLibrary } from "./libraryImageCardPick.js";

/**
 * Overwrite the linked library ficha's prompt with the Image card text.
 * Resolves by stored ids first, then by photo URL across hinted / all libraries.
 *
 * @param {object|null|undefined} block
 * @param {{ ownerKind?: string, ownerId?: string, folderId?: string, documentId?: string }} [hints]
 * @returns {{ ownerKind: "folder"|"document", ownerId: string, itemId: string, description: string }|null}
 */
export function writeImageSplitPromptToLibrary(block, hints = {}) {
  let target = syncImageSplitPromptToLibrary(block, listHintedLibraryCatalogs(hints));
  if (!target) {
    target = syncImageSplitPromptToLibrary(block, listAllLibraryCatalogs());
  }
  if (!target) return null;
  const updated = updateLibraryItem(target.ownerKind, target.ownerId, target.itemId, {
    description: target.description,
  });
  if (!updated) return null;
  return target;
}

/**
 * Persist Image card prompts onto their library fichas (document Save).
 * @param {Array<{ type?: string }>|null|undefined} blocks
 * @param {{ ownerKind?: string, ownerId?: string, folderId?: string, documentId?: string }} [hints]
 */
export function writeImageSplitPromptsFromBlocks(blocks, hints = {}) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (String(block?.type || "") !== "image_split") continue;
    writeImageSplitPromptToLibrary(block, hints);
  }
}
