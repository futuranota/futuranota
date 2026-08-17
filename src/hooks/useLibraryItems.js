import { useMemo } from "react";
import {
  listDocumentLibraryGroups,
  normalizeFolderLibraryItems,
  normalizeLibraryOwnerKind,
} from "../lib/folderLibrary.js";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";

/**
 * Live library fichas for a folder or document owner.
 * @param {string} [ownerKind]
 * @param {string} [ownerId]
 * @returns {import("../lib/folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function useLibraryItems(ownerKind, ownerId) {
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const id = String(ownerId || "").trim();
  const folderItems = useDocsStore((s) => (kind === "folder" ? s.docs?.[id]?.libraryItems : undefined));
  const nodeItems = useNodesStore((s) => (kind === "document" ? s.nodes?.[id]?.libraryItems : undefined));
  return useMemo(
    () => normalizeFolderLibraryItems(kind === "document" ? nodeItems : folderItems),
    [kind, folderItems, nodeItems],
  );
}

/**
 * Document sub-libraries under a folder (only docs that already have fichas).
 * @param {string} [folderId]
 */
export function useDocumentLibraryGroups(folderId) {
  const id = String(folderId || "").trim();
  const nodeIds = useDocsStore((s) => s.docs?.[id]?.nodeIds);
  const nodes = useNodesStore((s) => s.nodes);
  return useMemo(
    () => listDocumentLibraryGroups(id),
    [id, nodeIds, nodes],
  );
}
