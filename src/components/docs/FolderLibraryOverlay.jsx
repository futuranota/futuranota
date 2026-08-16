import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDocsStore } from "../../stores/docsStore.js";
import {
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryItems,
  removeFolderLibraryItem,
} from "../../lib/folderLibrary.js";
import { FolderLibraryElementModal } from "./FolderLibraryElementModal.jsx";

/** Primary tabs first; Auto last for uncategorized / legacy. */
const TYPE_TABS = ["image", "pdf", "skill", "auto"];

const CATEGORY_LABEL_KEYS = {
  auto: "doc.library.categoryAuto",
  image: "doc.library.categoryImage",
  pdf: "doc.library.categoryPdf",
  skill: "doc.library.categorySkill",
};

const FILTER_STORAGE_PREFIX = "fn-folder-library-filter:";

/**
 * @param {string} folderId
 * @returns {import("../../lib/folderLibraryNormalize.js").FolderLibraryCategory}
 */
function readStoredFilter(folderId) {
  try {
    const raw = sessionStorage.getItem(`${FILTER_STORAGE_PREFIX}${folderId}`);
    if (!raw) return "image";
    return normalizeFolderLibraryCategory(raw);
  } catch {
    return "image";
  }
}

/**
 * @param {string} folderId
 * @param {string} category
 */
function writeStoredFilter(folderId, category) {
  try {
    sessionStorage.setItem(
      `${FILTER_STORAGE_PREFIX}${folderId}`,
      normalizeFolderLibraryCategory(category),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Format badge label when there is no preview image.
 * @param {string} category
 */
function formatBadge(category) {
  if (category === "pdf") return "PDF";
  if (category === "skill") return "SKILL";
  if (category === "image") return "IMG";
  return "FILE";
}

/**
 * Folder library table — [+] + type filter + thumb grid (one type at a time).
 */
export function FolderLibraryOverlay({ folderId, onClose }) {
  const { t } = useI18n();
  const libraryItems = useDocsStore((s) => s.docs?.[folderId]?.libraryItems);
  const items = useMemo(
    () => normalizeFolderLibraryItems(libraryItems),
    [libraryItems],
  );

  const [filterType, setFilterType] = useState(() => readStoredFilter(folderId));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    setFilterType(readStoredFilter(folderId));
  }, [folderId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (modalOpen) return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, modalOpen]);

  const filteredItems = useMemo(
    () => items.filter((item) => item.category === filterType),
    [items, filterType],
  );

  const setFilter = (next) => {
    const cat = normalizeFolderLibraryCategory(next);
    setFilterType(cat);
    writeStoredFilter(folderId, cat);
  };

  const openNew = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = (item) => {
    const ok = window.confirm(
      t("doc.library.deleteConfirm").replace("{tag}", item.tag || ""),
    );
    if (!ok) return;
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
              <button
                type="button"
                className="folder-library-overlay__add"
                onClick={openNew}
                title={t("doc.library.add")}
              >
                +
              </button>
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
            {TYPE_TABS.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={filterType === type}
                className={
                  "folder-library-overlay__tab"
                  + (filterType === type ? " is-active" : "")
                }
                onClick={() => setFilter(type)}
              >
                {t(CATEGORY_LABEL_KEYS[type] || CATEGORY_LABEL_KEYS.auto)}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="folder-library-overlay__empty">
              <p>
                {t("doc.library.emptyByType").replace(
                  "{type}",
                  t(CATEGORY_LABEL_KEYS[filterType] || CATEGORY_LABEL_KEYS.auto),
                )}
              </p>
              <button
                type="button"
                className="folder-library-overlay__empty-add"
                onClick={openNew}
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
                    onClick={() => openEdit(item)}
                    title={item.tag}
                  >
                    {item.mediaUrl ? (
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
                          {formatBadge(item.category)}
                        </span>
                      </span>
                    )}
                    <span className="folder-library-overlay__cell-meta">
                      <span className="folder-library-overlay__cell-tag">{item.tag}</span>
                    </span>
                  </button>
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

      {modalOpen ? (
        <FolderLibraryElementModal
          folderId={folderId}
          item={editingItem}
          defaultCategory={editingItem ? undefined : filterType}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
