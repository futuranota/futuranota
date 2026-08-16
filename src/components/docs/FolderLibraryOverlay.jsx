import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDocsStore } from "../../stores/docsStore.js";
import {
  folderLibraryItemMatchesFilter,
  normalizeFolderLibraryFilterTab,
  normalizeFolderLibraryItems,
  removeFolderLibraryItem,
} from "../../lib/folderLibrary.js";
import { FolderLibraryElementModal } from "./FolderLibraryElementModal.jsx";
import { FolderLibraryImageDetail } from "./FolderLibraryImageDetail.jsx";
import { FolderLibrarySkillDetail } from "./FolderLibrarySkillDetail.jsx";

const FILTER_TABS = [
  { id: "all", labelKey: "doc.library.tabAll" },
  { id: "image", labelKey: "doc.library.tabImages" },
  { id: "video", labelKey: "doc.library.tabVideos" },
  { id: "skill", labelKey: "doc.library.tabSkills" },
];

const CREATE_TYPES = [
  { id: "skill", labelKey: "doc.library.createSkill" },
  { id: "image", labelKey: "doc.library.createImage" },
  { id: "video", labelKey: "doc.library.createVideo" },
];

const FILTER_STORAGE_PREFIX = "fn-folder-library-filter:";

function readStoredFilter(folderId) {
  try {
    const raw = sessionStorage.getItem(`${FILTER_STORAGE_PREFIX}${folderId}`);
    return normalizeFolderLibraryFilterTab(raw);
  } catch {
    return "all";
  }
}

function writeStoredFilter(folderId, tab) {
  try {
    sessionStorage.setItem(
      `${FILTER_STORAGE_PREFIX}${folderId}`,
      normalizeFolderLibraryFilterTab(tab),
    );
  } catch {
    /* ignore */
  }
}

function formatBadge(item) {
  if (item.attachmentKind) return String(item.attachmentKind).toUpperCase().slice(0, 6);
  if (item.category === "pdf") return "PDF";
  if (item.category === "skill") return "SKILL";
  if (item.category === "image") return "IMG";
  if (item.category === "video") return "VIDEO";
  return "FILE";
}

/**
 * Folder library table — [+] type menu + All/Images/Videos/AI skills + grid.
 */
export function FolderLibraryOverlay({ folderId, onClose }) {
  const { t } = useI18n();
  const libraryItems = useDocsStore((s) => s.docs?.[folderId]?.libraryItems);
  const items = useMemo(
    () => normalizeFolderLibraryItems(libraryItems),
    [libraryItems],
  );

  const [filterTab, setFilterTab] = useState(() => readStoredFilter(folderId));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [createCategory, setCreateCategory] = useState("image");
  const [lockCategory, setLockCategory] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailKind, setDetailKind] = useState(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createWrapRef = useRef(null);

  useEffect(() => {
    setFilterTab(readStoredFilter(folderId));
  }, [folderId]);

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
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, modalOpen, detailItemId, createMenuOpen]);

  const filteredItems = useMemo(
    () => items.filter((item) => folderLibraryItemMatchesFilter(item, filterTab)),
    [items, filterTab],
  );

  const setFilter = (next) => {
    const tab = normalizeFolderLibraryFilterTab(next);
    setFilterTab(tab);
    writeStoredFilter(folderId, tab);
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
    removeFolderLibraryItem(folderId, item.id);
  };

  return createPortal(
    <>
      <div
        className="folder-library-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t("doc.library.title")}
      >
        <button
          type="button"
          className="folder-library-overlay__backdrop"
          aria-label={t("doc.library.close")}
          onClick={onClose}
        />
        <div className="folder-library-overlay__shell">
          <header className="folder-library-overlay__header">
            <h2 className="folder-library-overlay__title">{t("doc.library.title")}</h2>
            <div className="folder-library-overlay__header-actions">
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
                    {CREATE_TYPES.map((entry) => (
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

          <div
            className="folder-library-overlay__tabs"
            role="tablist"
            aria-label={t("doc.library.filterAria")}
          >
            {FILTER_TABS.map((tab) => (
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
              <p>{t("doc.library.emptyFiltered")}</p>
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
        </div>
      </div>

      {detailItemId && detailKind === "image" ? (
        <FolderLibraryImageDetail
          folderId={folderId}
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
          folderId={folderId}
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
          folderId={folderId}
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
