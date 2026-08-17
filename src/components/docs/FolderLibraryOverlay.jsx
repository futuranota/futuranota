import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import {
  useDocumentLibraryGroups,
  useLibraryItems,
} from "../../hooks/useLibraryItems.js";
import {
  folderLibraryItemMatchesFilter,
  normalizeFolderLibraryFilterTab,
  normalizeLibraryOwnerKind,
  removeLibraryItem,
} from "../../lib/folderLibrary.js";
import { FolderLibraryElementModal } from "./FolderLibraryElementModal.jsx";
import { FolderLibraryImageDetail } from "./FolderLibraryImageDetail.jsx";
import { FolderLibrarySkillDetail } from "./FolderLibrarySkillDetail.jsx";
import { FolderLibraryVideoDetail } from "./FolderLibraryVideoDetail.jsx";

const FOLDER_FILTER_TABS = [
  { id: "all", labelKey: "doc.library.tabAll" },
  { id: "image", labelKey: "doc.library.tabImages" },
  { id: "skill", labelKey: "doc.library.tabSkills" },
];

const DOCUMENT_FILTER_TABS = FOLDER_FILTER_TABS;

const FOLDER_CREATE_TYPES = [
  { id: "skill", labelKey: "doc.library.createSkill" },
  { id: "image", labelKey: "doc.library.createImage" },
];

const DOCUMENT_CREATE_TYPES = FOLDER_CREATE_TYPES;

const FILTER_STORAGE_PREFIX = "fn-folder-library-filter:";

function readStoredFilter(ownerKey) {
  try {
    const raw = sessionStorage.getItem(`${FILTER_STORAGE_PREFIX}${ownerKey}`);
    return normalizeFolderLibraryFilterTab(raw);
  } catch {
    return "all";
  }
}

function writeStoredFilter(ownerKey, tab) {
  try {
    sessionStorage.setItem(
      `${FILTER_STORAGE_PREFIX}${ownerKey}`,
      normalizeFolderLibraryFilterTab(tab),
    );
  } catch {
    /* ignore */
  }
}

function formatBadge(item) {
  if (item.attachmentKind) return String(item.attachmentKind).toUpperCase().slice(0, 6);
  if (item.category === "pdf") return "PDF";
  if (item.category === "skill") return "FILE";
  if (item.category === "image") return "IMG";
  if (item.category === "video") return "VIDEO";
  return "FILE";
}

/**
 * Folder / document library table — [+] type menu + tabs + grid.
 * Folder mode can switch to Docs subfolders when child documents have fichas.
 */
export function FolderLibraryOverlay({
  folderId,
  ownerKind = "folder",
  ownerId,
  onClose,
}) {
  const { t } = useI18n();
  const rootKind = normalizeLibraryOwnerKind(ownerKind);
  const rootId = String(ownerId || folderId || "").trim();
  const isDocumentRoot = rootKind === "document";

  const [scope, setScope] = useState("folder");
  const [focusedDocumentId, setFocusedDocumentId] = useState(null);
  const activeKind = isDocumentRoot || focusedDocumentId ? "document" : "folder";
  const activeId = isDocumentRoot ? rootId : (focusedDocumentId || rootId);

  const items = useLibraryItems(activeKind, activeId);
  const docGroups = useDocumentLibraryGroups(isDocumentRoot ? "" : rootId);
  const showDocsToggle = !isDocumentRoot && docGroups.length > 0;
  const showingDocsIndex = !isDocumentRoot && scope === "docs" && !focusedDocumentId;
  const showingDocumentGrid = isDocumentRoot || Boolean(focusedDocumentId);

  const filterTabs = showingDocumentGrid ? DOCUMENT_FILTER_TABS : FOLDER_FILTER_TABS;
  const createTypes = showingDocumentGrid ? DOCUMENT_CREATE_TYPES : FOLDER_CREATE_TYPES;
  const filterKey = `${activeKind}:${activeId}`;

  const [filterTab, setFilterTab] = useState(() => readStoredFilter(filterKey));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [createCategory, setCreateCategory] = useState("image");
  const [lockCategory, setLockCategory] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailKind, setDetailKind] = useState(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createWrapRef = useRef(null);

  useEffect(() => {
    setFilterTab(readStoredFilter(filterKey));
  }, [filterKey]);

  useEffect(() => {
    const allowed = new Set(filterTabs.map((tab) => tab.id));
    if (!allowed.has(filterTab)) {
      setFilterTab("all");
      writeStoredFilter(filterKey, "all");
    }
  }, [filterKey, filterTab, showingDocumentGrid]);

  useEffect(() => {
    if (showDocsToggle) return;
    setScope("folder");
    setFocusedDocumentId(null);
  }, [showDocsToggle]);

  useEffect(() => {
    if (!createMenuOpen) return undefined;
    const onDoc = (event) => {
      if (createWrapRef.current?.contains(event.target)) return;
      setCreateMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [createMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (modalOpen || detailItemId || createMenuOpen) {
        if (createMenuOpen) setCreateMenuOpen(false);
        return;
      }
      if (focusedDocumentId) {
        event.preventDefault();
        setFocusedDocumentId(null);
        return;
      }
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, modalOpen, detailItemId, createMenuOpen, focusedDocumentId]);

  const filteredItems = useMemo(
    () => items.filter((item) => folderLibraryItemMatchesFilter(item, filterTab)),
    [items, filterTab],
  );

  const focusedGroup = focusedDocumentId
    ? docGroups.find((group) => group.documentId === focusedDocumentId)
    : null;

  const setFilter = (next) => {
    const tab = normalizeFolderLibraryFilterTab(next);
    setFilterTab(tab);
    writeStoredFilter(filterKey, tab);
  };

  const openCreate = (category) => {
    setCreateMenuOpen(false);
    setEditingItem(null);
    setCreateCategory(category);
    setLockCategory(true);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setCreateCategory(item.category || "auto");
    setLockCategory(false);
    setModalOpen(true);
  };

  const openItem = (item) => {
    if (item.category === "image") {
      setDetailKind("image");
      setDetailItemId(item.id);
      return;
    }
    if (item.category === "video") {
      setDetailKind("video");
      setDetailItemId(item.id);
      return;
    }
    if (item.category === "skill" || item.category === "pdf") {
      setDetailKind("skill");
      setDetailItemId(item.id);
      return;
    }
    openEdit(item);
  };

  const handleDelete = (item) => {
    const ok = window.confirm(
      t("doc.library.deleteConfirm").replace("{tag}", item.tag || ""),
    );
    if (!ok) return;
    if (detailItemId === item.id) {
      setDetailItemId(null);
      setDetailKind(null);
    }
    removeLibraryItem(activeKind, activeId, item.id);
  };

  const handleScope = (next) => {
    setScope(next);
    setFocusedDocumentId(null);
    setDetailItemId(null);
    setDetailKind(null);
    setModalOpen(false);
    setCreateMenuOpen(false);
  };

  const overlayTitle = showingDocsIndex
    ? t("doc.library.docsTitle")
    : focusedGroup
      ? focusedGroup.title
      : t("doc.library.title");

  const showCreate = !showingDocsIndex;

  return createPortal(
    <>
      <div
        className="folder-library-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={overlayTitle}
      >
        <button
          type="button"
          className="folder-library-overlay__backdrop"
          aria-label={t("doc.library.close")}
          onClick={onClose}
        />
        <div className="folder-library-overlay__shell">
          <header className="folder-library-overlay__header">
            <div className="folder-library-overlay__title-row">
              {focusedDocumentId ? (
                <button
                  type="button"
                  className="folder-library-overlay__back"
                  onClick={() => setFocusedDocumentId(null)}
                >
                  {t("doc.library.backToDocs")}
                </button>
              ) : null}
              <h2 className="folder-library-overlay__title">{overlayTitle}</h2>
            </div>
            <div className="folder-library-overlay__header-actions">
              {showCreate ? (
                <div className="folder-library-overlay__create" ref={createWrapRef}>
                  <button
                    type="button"
                    className="folder-library-overlay__add"
                    onClick={() => setCreateMenuOpen((v) => !v)}
                    title={t("doc.library.add")}
                    aria-expanded={createMenuOpen}
                    aria-haspopup="menu"
                  >
                    +
                  </button>
                  {createMenuOpen ? (
                    <div className="folder-library-overlay__create-menu" role="menu">
                      {createTypes.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          role="menuitem"
                          className="folder-library-overlay__create-item"
                          onClick={() => openCreate(entry.id)}
                        >
                          {t(entry.labelKey)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="folder-library-overlay__close"
                onClick={onClose}
                aria-label={t("doc.library.close")}
              >
                ×
              </button>
            </div>
          </header>

          {showDocsToggle ? (
            <div
              className="folder-library-overlay__scope"
              role="tablist"
              aria-label={t("doc.library.scopeAria")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === "folder"}
                className={
                  "folder-library-overlay__scope-btn"
                  + (scope === "folder" ? " is-active" : "")
                }
                onClick={() => handleScope("folder")}
              >
                {t("doc.library.scopeFolder")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === "docs"}
                className={
                  "folder-library-overlay__scope-btn"
                  + (scope === "docs" ? " is-active" : "")
                }
                onClick={() => handleScope("docs")}
              >
                {t("doc.library.scopeDocs")}
              </button>
            </div>
          ) : null}

          {showingDocsIndex ? (
            <ul className="folder-library-overlay__subfolders">
              {docGroups.map((group) => (
                <li key={group.documentId}>
                  <button
                    type="button"
                    className="folder-library-overlay__subfolder"
                    onClick={() => setFocusedDocumentId(group.documentId)}
                    aria-label={t("doc.library.openDocAria").replace("{title}", group.title)}
                  >
                    <img
                      className="folder-library-overlay__subfolder-icon"
                      src="/uploads/File.svg"
                      alt=""
                      aria-hidden
                      draggable={false}
                    />
                    <span className="folder-library-overlay__subfolder-meta">
                      <span className="folder-library-overlay__subfolder-title">{group.title}</span>
                      <span className="folder-library-overlay__subfolder-count">
                        {t("doc.library.subfolderCount").replace("{count}", String(group.items.length))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div
                className="folder-library-overlay__tabs"
                role="tablist"
                aria-label={t("doc.library.filterAria")}
              >
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filterTab === tab.id}
                    className={
                      "folder-library-overlay__tab"
                      + (filterTab === tab.id ? " is-active" : "")
                    }
                    onClick={() => setFilter(tab.id)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>

              {filteredItems.length === 0 ? (
                <div className="folder-library-overlay__empty">
                  <p>{t(showingDocumentGrid ? "doc.library.emptyFilteredDoc" : "doc.library.emptyFiltered")}</p>
                  <button
                    type="button"
                    className="folder-library-overlay__empty-add"
                    onClick={() => setCreateMenuOpen(true)}
                  >
                    {t("doc.library.add")}
                  </button>
                </div>
              ) : (
                <ul className="folder-library-overlay__grid">
                  {filteredItems.map((item) => (
                    <li key={item.id} className="folder-library-overlay__cell">
                      <button
                        type="button"
                        className="folder-library-overlay__cell-main"
                        onClick={() => openItem(item)}
                        title={item.tag}
                      >
                        {item.mediaUrl && item.category === "image" ? (
                          <img
                            className="folder-library-overlay__cell-img"
                            src={item.mediaUrl}
                            alt=""
                          />
                        ) : (
                          <span
                            className={
                              "folder-library-overlay__cell-badge"
                              + ` folder-library-overlay__cell-badge--${item.category}`
                            }
                            aria-hidden
                          >
                            <span className="folder-library-overlay__cell-badge-lines" />
                            <span className="folder-library-overlay__cell-badge-fmt">
                              {formatBadge(item)}
                            </span>
                          </span>
                        )}
                        <span className="folder-library-overlay__cell-meta">
                          <span className="folder-library-overlay__cell-tag">{item.tag}</span>
                        </span>
                      </button>
                      {(item.category === "image"
                        || item.category === "video"
                        || item.category === "skill"
                        || item.category === "pdf") ? (
                        <button
                          type="button"
                          className="folder-library-overlay__cell-edit"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(item);
                          }}
                          aria-label={t("doc.library.edit")}
                          title={t("doc.library.edit")}
                        >
                          {t("doc.library.edit")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="folder-library-overlay__cell-delete"
                        onClick={() => handleDelete(item)}
                        aria-label={t("doc.library.delete")}
                        title={t("doc.library.delete")}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {detailItemId && detailKind === "image" ? (
        <FolderLibraryImageDetail
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={(item) => openEdit(item)}
        />
      ) : null}

      {detailItemId && detailKind === "video" ? (
        <FolderLibraryVideoDetail
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={(item) => openEdit(item)}
        />
      ) : null}

      {detailItemId && detailKind === "skill" ? (
        <FolderLibrarySkillDetail
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={(item) => openEdit(item)}
        />
      ) : null}

      {modalOpen ? (
        <FolderLibraryElementModal
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          item={editingItem}
          defaultCategory={editingItem ? undefined : createCategory}
          lockCategory={lockCategory && !editingItem}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
            setLockCategory(false);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingItem(null);
            setLockCategory(false);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
