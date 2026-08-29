import { createPortal } from "react-dom";
import { startTransition, useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems } from "../../hooks/useLibraryItems.js";
import { listAllLibraryCatalogs } from "../../lib/folderLibrary.js";
import { fichaHasVisual } from "../../lib/libraryFichaPreview.js";
import { flattenVisualPicksFromCatalogs } from "../../lib/libraryImageCardPick.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";

/** Session cache — workspace scan is expensive; reuse per exclude key. */
const workspaceStripCache = new Map();

function getWorkspaceVisualStrip({ excludeFolderId = "", excludeDocumentId = "" } = {}) {
  const cacheKey = `${excludeFolderId}\0${excludeDocumentId}`;
  if (workspaceStripCache.has(cacheKey)) {
    return workspaceStripCache.get(cacheKey);
  }
  const strip = flattenVisualPicksFromCatalogs(listAllLibraryCatalogs(), {
    excludeFolderId,
    excludeDocumentId,
  });
  workspaceStripCache.set(cacheKey, strip);
  return strip;
}

function pickRowKey(ownerKind, ownerId, itemId) {
  return `${ownerKind}:${ownerId}:${itemId}`;
}

function renderPickFace(item) {
  if (fichaHasVisual(item)) {
    return (
      <img
        className="folder-library-overlay__cell-img"
        src={item.mediaUrl}
        alt=""
      />
    );
  }
  return (
    <span className="folder-library-overlay__cell-prompt">
      {String(item?.tag || "").trim() || "—"}
    </span>
  );
}

function PickGrid({
  title,
  items,
  emptyMessage,
  onPick,
  selectedKey,
  allowCreate = false,
  createLabel = "Add image",
  onCreateClick,
}) {
  const showGrid = items.length > 0 || allowCreate;
  return (
    <section className="library-image-card-picker__section">
      {title ? (
        <h3 className="library-image-card-picker__section-title">{title}</h3>
      ) : null}
      {!showGrid ? (
        <p className="library-image-card-picker__grid-empty">{emptyMessage}</p>
      ) : (
        <ul className="folder-library-overlay__grid library-image-card-picker__grid">
          {items.map((row) => {
            const key = pickRowKey(row.ownerKind, row.ownerId, row.item.id);
            const isSelected = selectedKey === key;
            return (
              <li
                key={key}
                className={
                  "folder-library-overlay__cell"
                  + (isSelected ? " is-selected" : "")
                }
              >
                <button
                  type="button"
                  className={
                    "folder-library-overlay__cell-main"
                    + (isSelected ? " is-selected" : "")
                  }
                  aria-pressed={isSelected}
                  onClick={() => onPick(row.item, row.ownerKind, row.ownerId)}
                >
                  {renderPickFace(row.item)}
                  <span className="folder-library-overlay__cell-meta">
                    <span className="folder-library-overlay__cell-tag">{row.item.tag}</span>
                    {row.item.frameAspect ? (
                      <span className="folder-library-overlay__cell-frame">{row.item.frameAspect}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {allowCreate ? (
            <li className="folder-library-overlay__cell folder-library-overlay__cell--add">
              <button
                type="button"
                className="folder-library-overlay__cell-add"
                onClick={onCreateClick}
                aria-label={createLabel}
                title={createLabel}
              >
                +
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/**
 * Pick a visual library ficha into an Image card or Moodboard frame.
 * Instant: document (or folder) assets + optional parent folder strip.
 * Lazy: full workspace scan on demand ("Todas las imágenes").
 *
 * When `onNext` is provided (moodboard), clicks stage a selection and Next continues.
 * Without `onNext` (ImageSplit), click commits immediately via `onPick`.
 */
export function LibraryImageCardPicker({
  folderId = "",
  documentId = "",
  layout = "segmentedStrip",
  titleKey = "doc.imageSplit.libraryPickerTitle",
  onPick,
  onClose,
  onNext,
  nextLabelKey = "doc.moodboard.libraryNext",
  /** Allow Next without a fresh pick (slot already has an image). */
  nextEnabled = false,
  allowPrimaryCreate = false,
  /** @deprecated use allowPrimaryCreate */
  allowFolderCreate = false,
  onPrimaryCreateClick,
  /** @deprecated use onPrimaryCreateClick */
  onFolderCreateClick,
  /** Extra class on overlay root (e.g. above expanded moodboard workspace). */
  overlayClassName = "",
}) {
  void layout;
  const { t } = useI18n();
  const stageMode = typeof onNext === "function";
  const [selectedKey, setSelectedKey] = useState(null);
  const [workspaceStrip, setWorkspaceStrip] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const resolvedDocumentId = String(documentId || "").trim();
  const parentFolderId = useNodesStore((s) => {
    if (!resolvedDocumentId) return "";
    return String(s.nodes?.[resolvedDocumentId]?.parentDocId || "").trim();
  });
  const resolvedFolderId = useMemo(() => {
    const fromProp = String(folderId || "").trim();
    if (fromProp) return fromProp;
    return parentFolderId;
  }, [folderId, parentFolderId]);

  const primaryOwnerKind = resolvedDocumentId ? "document" : "folder";
  const primaryOwnerId = resolvedDocumentId || resolvedFolderId;
  const allowCreate = allowPrimaryCreate || allowFolderCreate;
  const onCreateClick = onPrimaryCreateClick || onFolderCreateClick;

  const primaryDocTitle = useNodesStore((s) => {
    if (primaryOwnerKind !== "document" || !primaryOwnerId) return "";
    const node = s.nodes?.[primaryOwnerId];
    return String(node?.title || node?.query || "").trim();
  });
  const folderTitle = useDocsStore((s) => {
    const folderKey = primaryOwnerKind === "folder" ? primaryOwnerId : resolvedFolderId;
    if (!folderKey) return "";
    return String(s.docs?.[folderKey]?.title || "").trim();
  });

  const primaryItems = useLibraryItems(primaryOwnerKind, primaryOwnerId);
  const folderItems = useLibraryItems(
    "folder",
    resolvedDocumentId && resolvedFolderId ? resolvedFolderId : "",
  );

  const primaryStrip = useMemo(() => {
    const items = Array.isArray(primaryItems) ? primaryItems : [];
    if (!primaryOwnerId) return [];
    return flattenVisualPicksFromCatalogs([
      { ownerKind: primaryOwnerKind, ownerId: primaryOwnerId, items },
    ]);
  }, [primaryItems, primaryOwnerId, primaryOwnerKind]);

  const folderStrip = useMemo(() => {
    if (!resolvedDocumentId || !resolvedFolderId) return [];
    const items = Array.isArray(folderItems) ? folderItems : [];
    return flattenVisualPicksFromCatalogs([
      { ownerKind: "folder", ownerId: resolvedFolderId, items },
    ]);
  }, [resolvedDocumentId, resolvedFolderId, folderItems]);

  const workspaceExclude = useMemo(() => ({
    excludeFolderId: resolvedFolderId
      || (primaryOwnerKind === "folder" ? primaryOwnerId : ""),
    excludeDocumentId: resolvedDocumentId || "",
  }), [resolvedDocumentId, resolvedFolderId, primaryOwnerKind, primaryOwnerId]);

  const primaryTitle = primaryOwnerKind === "document"
    ? (primaryDocTitle || t("doc.imageSplit.libraryPickerScopeDocument"))
    : (folderTitle || t("doc.imageSplit.libraryPickerScopeFolder"));

  const primarySectionTitle = primaryOwnerKind === "document"
    ? t("doc.imageSplit.libraryPickerDocumentAssets", { title: primaryTitle })
    : t("doc.imageSplit.libraryPickerFolderAssets", { title: primaryTitle });

  const folderSectionTitle = t("doc.imageSplit.libraryPickerFolderAssets", {
    title: folderTitle || t("doc.imageSplit.libraryPickerScopeFolder"),
  });

  const primaryEmptyMessage = primaryOwnerKind === "document"
    ? t("doc.imageSplit.libraryPickerEmptyDocumentAssets")
    : t("doc.imageSplit.libraryPickerEmptyFolderAssets");

  const showFolderStrip = Boolean(resolvedDocumentId && resolvedFolderId);
  const workspaceLoaded = workspaceStrip !== null;

  const segmentedEmpty = !primaryOwnerId
    && !showFolderStrip
    && !workspaceLoaded
    && !(allowCreate && primaryOwnerId);

  const loadWorkspace = () => {
    if (workspaceLoading || workspaceLoaded) return;
    setWorkspaceLoading(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        startTransition(() => {
          const strip = getWorkspaceVisualStrip(workspaceExclude);
          setWorkspaceStrip(strip);
          setWorkspaceLoading(false);
        });
      }, 0);
    });
  };

  const handlePick = (item, ownerKind, ownerId) => {
    if (stageMode) {
      setSelectedKey(pickRowKey(ownerKind, ownerId, item?.id));
      onPick?.(item, ownerKind, ownerId);
      return;
    }
    onPick?.(item, ownerKind, ownerId);
  };

  const canNext = stageMode && (Boolean(selectedKey) || nextEnabled);

  return createPortal(
    <div
      className={
        "library-image-card-picker"
        + (overlayClassName ? ` ${overlayClassName}` : "")
      }
      role="dialog"
      aria-modal="true"
      aria-label={t(titleKey)}
    >
      <button
        type="button"
        className="library-image-card-picker__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="library-image-card-picker__shell">
        <header className="library-image-card-picker__header">
          <h2 className="library-image-card-picker__title">
            {t(titleKey)}
          </h2>
          <button
            type="button"
            className="library-image-card-picker__close"
            onClick={onClose}
            aria-label={t("doc.library.close")}
          >
            ×
          </button>
        </header>

        {segmentedEmpty ? (
          <p className="library-image-card-picker__empty">
            {t("doc.imageSplit.libraryPickerEmptyStrips")}
          </p>
        ) : (
          <div className="library-image-card-picker__body">
            {primaryOwnerId ? (
              <>
                <PickGrid
                  title={primarySectionTitle}
                  items={primaryStrip}
                  emptyMessage={primaryEmptyMessage}
                  onPick={handlePick}
                  selectedKey={stageMode ? selectedKey : null}
                  allowCreate={allowCreate}
                  createLabel={t("doc.moodboard.libraryPickerAddImage")}
                  onCreateClick={onCreateClick}
                />
                {showFolderStrip ? (
                  <>
                    <hr className="library-image-card-picker__divider" />
                    <PickGrid
                      title={folderSectionTitle}
                      items={folderStrip}
                      emptyMessage={t("doc.imageSplit.libraryPickerEmptyFolderAssets")}
                      onPick={handlePick}
                      selectedKey={stageMode ? selectedKey : null}
                    />
                  </>
                ) : null}
                <hr className="library-image-card-picker__divider" />
              </>
            ) : null}
            {workspaceLoaded ? (
              <PickGrid
                title={t("doc.imageSplit.libraryPickerAllImages")}
                items={workspaceStrip}
                emptyMessage={t("doc.imageSplit.libraryPickerEmptyAll")}
                onPick={handlePick}
                selectedKey={stageMode ? selectedKey : null}
              />
            ) : (
              <section className="library-image-card-picker__workspace-lazy">
                <h3 className="library-image-card-picker__section-title">
                  {t("doc.imageSplit.libraryPickerAllImages")}
                </h3>
                <p className="library-image-card-picker__workspace-hint">
                  {t("doc.imageSplit.libraryPickerWorkspaceHint")}
                </p>
                <button
                  type="button"
                  className="library-image-card-picker__workspace-load"
                  disabled={workspaceLoading}
                  onClick={loadWorkspace}
                >
                  {workspaceLoading
                    ? t("doc.imageSplit.libraryPickerLoadingWorkspace")
                    : t("doc.imageSplit.libraryPickerLoadWorkspace")}
                </button>
              </section>
            )}
          </div>
        )}

        {stageMode ? (
          <footer className="library-image-card-picker__footer">
            <button
              type="button"
              className="library-image-card-picker__next"
              disabled={!canNext}
              onClick={() => {
                if (!canNext) return;
                onNext?.();
              }}
            >
              {t(nextLabelKey)}
            </button>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
