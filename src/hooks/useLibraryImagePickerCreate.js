import { useCallback, useRef, useState } from "react";
import { convertAndUploadDocImage } from "../lib/docImageStorage.js";
import { useI18n } from "../i18n/useI18n.js";

/**
 * @param {{ libraryOwnerKind?: string, libraryOwnerId?: string, folderLibraryId?: string }} params
 */
export function resolveLibraryPickerContext({
  libraryOwnerKind = "folder",
  libraryOwnerId = "",
  folderLibraryId = "",
} = {}) {
  const pickerFolderId = libraryOwnerKind === "folder"
    ? String(libraryOwnerId || folderLibraryId || "").trim()
    : String(folderLibraryId || "").trim();
  const pickerDocumentId = libraryOwnerKind === "document"
    ? String(libraryOwnerId || "").trim()
    : "";
  const pickerPrimaryKind = libraryOwnerKind === "document" ? "document" : "folder";
  const pickerPrimaryId = pickerPrimaryKind === "document"
    ? pickerDocumentId
    : pickerFolderId;
  return {
    pickerFolderId,
    pickerDocumentId,
    pickerPrimaryKind,
    pickerPrimaryId,
  };
}

/**
 * Shared "+ add image" flow for LibraryImageCardPicker (banner, image card, moodboard).
 * @param {Object} params
 * @param {boolean} params.isEdit
 * @param {string} [params.libraryOwnerKind]
 * @param {string} [params.libraryOwnerId]
 * @param {string} [params.folderLibraryId]
 * @param {(item: object, ownerKind: "folder"|"document", ownerId: string) => void} [params.onItemCreated]
 * @param {() => void} [params.onAfterCreate]
 * @param {(message: string) => void} [params.onError]
 */
export function useLibraryImagePickerCreate({
  isEdit,
  libraryOwnerKind,
  libraryOwnerId,
  folderLibraryId,
  onItemCreated,
  onAfterCreate,
  onError,
}) {
  const { t } = useI18n();
  const {
    pickerFolderId,
    pickerDocumentId,
    pickerPrimaryKind,
    pickerPrimaryId,
  } = resolveLibraryPickerContext({
    libraryOwnerKind,
    libraryOwnerId,
    folderLibraryId,
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createMediaUrl, setCreateMediaUrl] = useState("");
  const createFileInputRef = useRef(null);

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    setCreateMediaUrl("");
  }, []);

  const openCreateFromPicker = useCallback(() => {
    if (!isEdit || !pickerPrimaryId) return;
    createFileInputRef.current?.click();
  }, [isEdit, pickerPrimaryId]);

  const handleCreateFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !pickerPrimaryId || !isEdit) return;
    if (!file.type.startsWith("image/")) {
      onError?.(t("doc.library.invalidImage"));
      event.target.value = "";
      return;
    }
    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "LIBIMG",
        scopeId: pickerPrimaryId,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.88,
      });
      if (converted?.src) {
        setCreateMediaUrl(converted.src);
        setCreateModalOpen(true);
      }
    } catch (err) {
      onError?.(err?.message || t("doc.library.uploadFailed"));
    } finally {
      event.target.value = "";
    }
  }, [isEdit, onError, pickerPrimaryId, t]);

  const handleCreateSaved = useCallback((saved) => {
    if (!saved) {
      closeCreateModal();
      return;
    }
    onItemCreated?.(saved, pickerPrimaryKind, pickerPrimaryId);
    onAfterCreate?.();
    closeCreateModal();
  }, [closeCreateModal, onAfterCreate, onItemCreated, pickerPrimaryId, pickerPrimaryKind]);

  return {
    pickerFolderId,
    pickerDocumentId,
    pickerPrimaryKind,
    pickerPrimaryId,
    canCreateFromPicker: Boolean(pickerPrimaryId),
    createModalOpen,
    createMediaUrl,
    createFileInputRef,
    openCreateFromPicker,
    handleCreateFile,
    handleCreateSaved,
    closeCreateModal,
  };
}
