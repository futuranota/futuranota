import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems, useLibrarySets } from "../../hooks/useLibraryItems.js";
import {
  assignLibraryItemToSet,
  folderLibraryItemMatchesFilter,
  listLooseLibraryItems,
} from "../../lib/folderLibrary.js";
import { FolderLibraryImageDetail } from "./FolderLibraryImageDetail.jsx";
import { FolderLibrarySkillDetail } from "./FolderLibrarySkillDetail.jsx";
import { FolderLibraryVideoDetail } from "./FolderLibraryVideoDetail.jsx";

const SET_TABS = [
  { id: "folder", labelKey: "doc.library.setTabFolder" },
  { id: "image", labelKey: "doc.library.setTabImages" },
  { id: "skill", labelKey: "doc.library.setTabAttachments" },
];

function formatBadge(item) {
  if (item.attachmentKind) return String(item.attachmentKind).toUpperCase().slice(0, 6);
  if (item.category === "pdf") return "PDF";
  if (item.category === "skill") return "FILE";
  if (item.category === "image") return "IMG";
  if (item.category === "video") return "VIDEO";
  return "FILE";
}

/**
 * `/o` — document library sets: list, then Folder / Images / Attachments + assign loose fichas.
 */
export function LibrarySetsOverlay({ ownerId, onClose }) {
  const { t } = useI18n();
  const id = String(ownerId || "").trim();
  const sets = useLibrarySets("document", id);
  const items = useLibraryItems("document", id);

  const [focusedSetId, setFocusedSetId] = useState(null);
  const [filterTab, setFilterTab] = useState("folder");
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailKind, setDetailKind] = useState(null);

  const focusedSet = sets.find((set) => set.id === focusedSetId) || null;
  const setItems = useMemo(
    () => items.filter((item) => item.setId === focusedSetId),
    [items, focusedSetId],
  );
  const looseItems = useMemo(
    () => listLooseLibraryItems("document", id),
    [id, items, sets],
  );
  const filteredSetItems = useMemo(() => {
    if (filterTab === "folder") return [];
    return setItems.filter((item) => folderLibraryItemMatchesFilter(item, filterTab));
  }, [filterTab, setItems]);

  const setCounts = useMemo(() => {
    const counts = {};
    for (const set of sets) counts[set.id] = 0;
    for (const item of items) {
      if (item.setId && counts[item.setId] != null) counts[item.setId] += 1;
    }
    return counts;
  }, [items, sets]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (detailItemId) return;
      if (addOpen) {
        event.preventDefault();
        setAddOpen(false);
        return;
      }
      if (focusedSetId) {
        event.preventDefault();
        setFocusedSetId(null);
        setFilterTab("folder");
        return;
      }
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, detailItemId, addOpen, focusedSetId]);

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
    }
  };

  const copyStory = async () => {
    const text = focusedSet?.description || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const assignLoose = (itemId) => {
    if (!focusedSetId) return;
    assignLibraryItemToSet("document", id, itemId, focusedSetId);
  };

  const overlayTitle = focusedSet
    ? (focusedSet.tag || t("doc.library.setOutputTitle"))
    : t("doc.library.setOutputTitle");

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
              {focusedSet ? (
                <button
                  type="button"
                  className="folder-library-overlay__back"
                  onClick={() => {
                    setFocusedSetId(null);
                    setFilterTab("folder");
                    setAddOpen(false);
                  }}
                >
                  {t("doc.library.setBack")}
                </button>
              ) : null}
              <h2 className="folder-library-overlay__title">{overlayTitle}</h2>
            </div>
            <div className="folder-library-overlay__header-actions">
              {focusedSet ? (
                <button
                  type="button"
                  className="folder-library-overlay__add library-sets-overlay__add-btn"
                  onClick={() => setAddOpen((open) => !open)}
                  aria-expanded={addOpen}
                >
                  {t("doc.library.setAddFromDoc")}
                </button>
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

          {!focusedSet ? (
            sets.length === 0 ? (
              <div className="folder-library-overlay__empty">
                <p>{t("doc.library.setEmpty")}</p>
              </div>
            ) : (
              <ul className="folder-library-overlay__subfolders">
                {sets.map((set) => (
                  <li key={set.id}>
                    <button
                      type="button"
                      className="folder-library-overlay__subfolder"
                      onClick={() => {
                        setFocusedSetId(set.id);
                        setFilterTab("folder");
                        setAddOpen(false);
                      }}
                      aria-label={t("doc.library.setOpenAria").replace("{title}", set.tag)}
                    >
                      <img
                        className="folder-library-overlay__subfolder-icon"
                        src="/uploads/File.svg"
                        alt=""
                        aria-hidden
                        draggable={false}
                      />
                      <span className="folder-library-overlay__subfolder-meta">
                        <span className="folder-library-overlay__subfolder-title">{set.tag}</span>
                        <span className="folder-library-overlay__subfolder-count">
                          {t("doc.library.setCount").replace(
                            "{count}",
                            String(setCounts[set.id] || 0),
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              <div
                className="folder-library-overlay__tabs"
                role="tablist"
                aria-label={t("doc.library.setFilterAria")}
              >
                {SET_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filterTab === tab.id}
                    className={
                      "folder-library-overlay__tab"
                      + (filterTab === tab.id ? " is-active" : "")
                    }
                    onClick={() => setFilterTab(tab.id)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>

              {addOpen ? (
                <div className="library-sets-overlay__loose">
                  <p className="library-sets-overlay__loose-title">
                    {t("doc.library.setAddFromDocTitle")}
                  </p>
                  {looseItems.length === 0 ? (
                    <p className="library-sets-overlay__loose-empty">
                      {t("doc.library.setAddFromDocEmpty")}
                    </p>
                  ) : (
                    <ul className="library-sets-overlay__loose-list">
                      {looseItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="library-sets-overlay__loose-item"
                            onClick={() => assignLoose(item.id)}
                          >
                            <span>{item.tag}</span>
                            <span className="library-sets-overlay__loose-add">
                              {t("doc.library.setAdd")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {filterTab === "folder" ? (
                <div className="library-sets-overlay__story">
                  {focusedSet.description ? (
                    <div className="folder-library-image-detail__ref">
                      <p className="folder-library-image-detail__description">
                        {focusedSet.description}
                      </p>
                      <button
                        type="button"
                        className="folder-library-image-detail__copy"
                        onClick={copyStory}
                        aria-label={copied ? t("doc.library.setStoryCopied") : t("doc.library.setStoryCopy")}
                        title={copied ? t("doc.library.setStoryCopied") : t("doc.library.setStoryCopy")}
                      >
                        {copied ? "✓" : "⧉"}
                      </button>
                    </div>
                  ) : (
                    <p className="folder-library-image-detail__empty-ref">
                      {t("doc.library.setStoryEmpty")}
                    </p>
                  )}
                </div>
              ) : filteredSetItems.length === 0 ? (
                <div className="folder-library-overlay__empty">
                  <p>{t("doc.library.setEmptyFiltered")}</p>
                  <button
                    type="button"
                    className="folder-library-overlay__empty-add"
                    onClick={() => setAddOpen(true)}
                  >
                    {t("doc.library.setAddFromDoc")}
                  </button>
                </div>
              ) : (
                <ul className="folder-library-overlay__grid">
                  {filteredSetItems.map((item) => (
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
          ownerKind="document"
          ownerId={id}
          folderId={id}
          itemId={detailItemId}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
        />
      ) : null}

      {detailItemId && detailKind === "video" ? (
        <FolderLibraryVideoDetail
          ownerKind="document"
          ownerId={id}
          folderId={id}
          itemId={detailItemId}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
        />
      ) : null}

      {detailItemId && detailKind === "skill" ? (
        <FolderLibrarySkillDetail
          ownerKind="document"
          ownerId={id}
          folderId={id}
          itemId={detailItemId}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
