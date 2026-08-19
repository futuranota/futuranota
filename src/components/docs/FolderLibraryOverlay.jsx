import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import {
  useDocumentLibraryGroups,
  useLibraryItems,
  useLibrarySets,
  usePromptClasses,
} from "../../hooks/useLibraryItems.js";
import {
  addPromptClass,
  assignLibraryItemToSet,
  folderLibraryItemMatchesFilter,
  normalizeFolderLibraryFilterTab,
  normalizeLibraryOwnerKind,
  removeLibraryItem,
  removeLibrarySet,
  removePromptClass,
  renamePromptClass,
} from "../../lib/folderLibrary.js";
import {
  LIBRARY_MEDIA_BADGE_SRC,
  fichaShowsMediaBadge,
  pickDocLibraryPreviews,
  promptPreviewText,
  resolveFichaPreviewKind,
  libraryTilePrefer,
} from "../../lib/libraryFichaPreview.js";
import { FolderLibraryElementModal } from "./FolderLibraryElementModal.jsx";
import { FolderLibraryAssetDetail } from "./FolderLibraryAssetDetail.jsx";
import { FolderLibraryImageDetail } from "./FolderLibraryImageDetail.jsx";
import { FolderLibrarySkillDetail } from "./FolderLibrarySkillDetail.jsx";
import { FolderLibraryVideoDetail } from "./FolderLibraryVideoDetail.jsx";
import { LibrarySetInputModal } from "./LibrarySetInputModal.jsx";

const SCOPE_OPTIONS = [
  { id: "folder", labelKey: "doc.library.scopeFolder", iconSrc: "/uploads/folder-main.svg" },
  { id: "docs", labelKey: "doc.library.scopeDocs", iconSrc: "/uploads/docs-main.svg" },
];

const FILTER_STORAGE_PREFIX = "fn-folder-library-filter:";

function resolveLibraryFilterTab(tab, { allowSkill = false, allowDocuments = false } = {}) {
  const next = normalizeFolderLibraryFilterTab(tab);
  if (next === "skill" && !allowSkill) return allowDocuments ? "documents" : "image";
  if (next === "documents" && !allowDocuments) return "image";
  return next;
}

function readStoredFilter(ownerKey, fallback = "image") {
  try {
    const raw = sessionStorage.getItem(`${FILTER_STORAGE_PREFIX}${ownerKey}`);
    if (!raw) return fallback;
    return normalizeFolderLibraryFilterTab(raw);
  } catch {
    return fallback;
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
  if (item.category === "image") return "TXT";
  if (item.category === "video") return "VIDEO";
  return "FILE";
}

function MediaBadge({ item, prefer }) {
  if (!fichaShowsMediaBadge(item, prefer)) return null;
  return (
    <img
      className="folder-library-overlay__cell-media-badge"
      src={LIBRARY_MEDIA_BADGE_SRC}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}

function renderFichaFace(item, prefer) {
  const isAttachment = item?.category === "skill" || item?.category === "pdf";
  const kind = isAttachment ? "badge" : resolveFichaPreviewKind(item, prefer);
  if (kind === "prompt") {
    return (
      <>
        <span className="folder-library-overlay__cell-prompt">
          {promptPreviewText(item)}
        </span>
        <MediaBadge item={item} prefer={prefer} />
      </>
    );
  }
  if (kind === "image") {
    return (
      <img
        className="folder-library-overlay__cell-img"
        src={item.mediaUrl}
        alt=""
      />
    );
  }
  return (
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
  );
}

function renderMiniFichaFace(item, prefer) {
  const kind = resolveFichaPreviewKind(item, prefer);
  if (kind === "image") {
    return <img src={item.mediaUrl} alt="" />;
  }
  return (
    <>
      {promptPreviewText(item)}
      <MediaBadge item={item} prefer={prefer} />
    </>
  );
}

function miniFichaClass(item, prefer) {
  const kind = resolveFichaPreviewKind(item, prefer);
  return "folder-library-overlay__mini-prompt"
    + (kind === "image" ? " folder-library-overlay__mini-prompt--media" : "");
}

/**
 * Folder / document library table.
 * Folder: header Attachments + contextual [+]; Prompt row with class chips.
 * Document: Assets + Prompt (no Attachments). [+] creates asset or Prompt.
 */
export function FolderLibraryOverlay({
  folderId,
  ownerKind = "folder",
  ownerId,
  initialTab = null,
  onClose,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const rootKind = normalizeLibraryOwnerKind(ownerKind);
  const rootId = String(ownerId || folderId || "").trim();
  const isDocumentRoot = rootKind === "document";

  const [scope, setScope] = useState("folder");
  const [focusedDocumentId, setFocusedDocumentId] = useState(null);
  const [focusedAssetId, setFocusedAssetId] = useState(null);
  const activeKind = isDocumentRoot || focusedDocumentId ? "document" : "folder";
  const activeId = isDocumentRoot ? rootId : (focusedDocumentId || rootId);

  const items = useLibraryItems(activeKind, activeId);
  const assets = useLibrarySets(activeKind, activeId);
  const promptClasses = usePromptClasses(activeKind, activeId);
  const docGroups = useDocumentLibraryGroups(isDocumentRoot ? "" : rootId);
  const showDocsToggle = !isDocumentRoot && docGroups.length > 0;
  const showingDocsIndex = !isDocumentRoot && scope === "docs" && !focusedDocumentId;
  const showingDocumentGrid = isDocumentRoot || Boolean(focusedDocumentId);
  const canUseAttachments = activeKind === "folder" && !showingDocsIndex;

  const filterKey = `${activeKind}:${activeId}`;
  const defaultTab = showingDocumentGrid ? "documents" : "image";
  const tabOptions = { allowSkill: canUseAttachments, allowDocuments: showingDocumentGrid };
  const requestedTab = initialTab
    ? resolveLibraryFilterTab(initialTab, tabOptions)
    : null;

  const [filterTab, setFilterTab] = useState(() => {
    if (requestedTab) return requestedTab;
    return resolveLibraryFilterTab(readStoredFilter(filterKey, defaultTab), tabOptions);
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [createCategory, setCreateCategory] = useState("image");
  const [lockCategory, setLockCategory] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailKind, setDetailKind] = useState(null);
  const [promptClassFilter, setPromptClassFilter] = useState("");
  const [classDraftOpen, setClassDraftOpen] = useState(false);
  const [classDraft, setClassDraft] = useState("");
  const [editingClass, setEditingClass] = useState("");
  const [classEditDraft, setClassEditDraft] = useState("");
  const classDraftRef = useRef(null);
  const classEditRef = useRef(null);

  useEffect(() => {
    if (requestedTab) {
      setFilterTab(requestedTab);
      writeStoredFilter(filterKey, requestedTab);
      return;
    }
    setFilterTab(resolveLibraryFilterTab(readStoredFilter(filterKey, defaultTab), tabOptions));
  }, [filterKey, requestedTab, defaultTab, canUseAttachments, showingDocumentGrid]);

  useEffect(() => {
    setPromptClassFilter("");
    setClassDraftOpen(false);
    setClassDraft("");
    setEditingClass("");
    setClassEditDraft("");
  }, [filterKey]);

  useEffect(() => {
    if (!classDraftOpen) return;
    classDraftRef.current?.focus();
  }, [classDraftOpen]);

  useEffect(() => {
    if (!editingClass) return;
    classEditRef.current?.focus();
    classEditRef.current?.select();
  }, [editingClass]);

  useEffect(() => {
    const allowed = new Set(
      showingDocumentGrid ? ["documents", "image"] : ["image", "skill"],
    );
    if (!allowed.has(filterTab)) {
      setFilterTab(defaultTab);
      writeStoredFilter(filterKey, defaultTab);
    }
  }, [filterKey, filterTab, showingDocumentGrid, defaultTab]);

  useEffect(() => {
    if (showDocsToggle) return;
    setScope("folder");
    setFocusedDocumentId(null);
  }, [showDocsToggle]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (modalOpen || assetModalOpen || detailItemId) return;
      if (focusedAssetId) {
        event.preventDefault();
        setFocusedAssetId(null);
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
  }, [onClose, modalOpen, assetModalOpen, detailItemId, focusedAssetId, focusedDocumentId]);

  const looseItems = useMemo(
    () => {
      const source = showingDocumentGrid ? items.filter((item) => !item.setId) : items;
      if (!showingDocumentGrid) return source;
      return source.filter((item) => item.category !== "skill" && item.category !== "pdf");
    },
    [items, showingDocumentGrid],
  );

  const focusedAsset = assets.find((asset) => asset.id === focusedAssetId) || null;
  const assetCounts = useMemo(() => {
    const counts = {};
    for (const asset of assets) counts[asset.id] = 0;
    for (const item of items) {
      if (item.setId && counts[item.setId] != null) counts[item.setId] += 1;
    }
    return counts;
  }, [assets, items]);

  const showingDocumentsTab = showingDocumentGrid && filterTab === "documents";

  const filteredItems = useMemo(() => {
    const source = showingDocumentGrid ? looseItems : items;
    const byTab = source.filter((item) => folderLibraryItemMatchesFilter(item, filterTab));
    if (filterTab !== "image" || !promptClassFilter) return byTab;
    return byTab.filter(
      (item) => String(item.promptClass || "").toLowerCase() === promptClassFilter.toLowerCase(),
    );
  }, [items, looseItems, filterTab, showingDocumentGrid, promptClassFilter]);

  const focusedGroup = focusedDocumentId
    ? docGroups.find((group) => group.documentId === focusedDocumentId)
    : null;

  const setFilter = (next) => {
    const tab = normalizeFolderLibraryFilterTab(next);
    setFilterTab(tab);
    writeStoredFilter(filterKey, tab);
    setFocusedAssetId(null);
  };

  const openCreate = (category) => {
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

  const openEditFromDetail = (item) => {
    setDetailItemId(null);
    setDetailKind(null);
    openEdit(item);
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

  const handleDeleteAsset = async (asset, event) => {
    event.preventDefault();
    event.stopPropagation();
    const tag = String(asset?.tag || "").trim() || "—";
    const ok = await askConfirm({
      title: t("doc.library.assetDeleteTitle"),
      message: t("doc.library.assetDeleteConfirm", { tag }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    removeLibrarySet(activeKind, activeId, asset.id);
    if (focusedAssetId === asset.id) setFocusedAssetId(null);
  };

  const commitClassDraft = () => {
    const created = addPromptClass(activeKind, activeId, classDraft);
    setClassDraftOpen(false);
    setClassDraft("");
    if (created) setPromptClassFilter(created);
  };

  const startClassEdit = (name) => {
    setClassDraftOpen(false);
    setClassDraft("");
    setEditingClass(name);
    setClassEditDraft(name);
    setPromptClassFilter(name);
  };

  const cancelClassEdit = () => {
    setEditingClass("");
    setClassEditDraft("");
  };

  const commitClassEdit = () => {
    const fromName = editingClass;
    if (!fromName) return;
    const next = String(classEditDraft || "").trim();
    if (!next) {
      cancelClassEdit();
      return;
    }
    const renamed = renamePromptClass(activeKind, activeId, fromName, next);
    cancelClassEdit();
    if (renamed) setPromptClassFilter(renamed);
  };

  const handleDeleteClass = async (name, event) => {
    event.preventDefault();
    event.stopPropagation();
    const label = String(name || "").trim();
    if (!label) return;
    const ok = await askConfirm({
      title: t("doc.library.promptClassDeleteTitle"),
      message: t("doc.library.promptClassDeleteConfirm", { name: label }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    removePromptClass(activeKind, activeId, label);
    if (editingClass.toLowerCase() === label.toLowerCase()) {
      cancelClassEdit();
    }
    if (promptClassFilter.toLowerCase() === label.toLowerCase()) {
      setPromptClassFilter("");
    }
  };

  const handleScope = (next) => {
    setScope(next);
    setFocusedDocumentId(null);
    setFocusedAssetId(null);
    setDetailItemId(null);
    setDetailKind(null);
    setModalOpen(false);
    setAssetModalOpen(false);
    setEditingAsset(null);
  };

  const overlayTitle = showingDocsIndex
    ? t("doc.library.docsTitle")
    : focusedGroup
      ? focusedGroup.title
      : t("doc.library.title");

  const showCreate = !showingDocsIndex;
  const createOpensAsset = showingDocumentsTab && !focusedAssetId;
  const showingAttachments = canUseAttachments && filterTab === "skill";
  const showingPromptRow = !showingDocsIndex;
  const gridItems = filteredItems;

  const handleHeaderCreate = () => {
    if (focusedAssetId) {
      openCreate("image");
      return;
    }
    if (createOpensAsset) {
      setAssetModalOpen(true);
      return;
    }
    if (showingAttachments) {
      openCreate("skill");
      return;
    }
    openCreate("image");
  };

  const emptyGridKey = showingAttachments
    ? "doc.library.emptyFilteredSkill"
    : showingDocumentGrid
      ? "doc.library.emptyFilteredDoc"
      : "doc.library.emptyFiltered";

  const renderItemGrid = (list, emptyKey) => (
    list.length === 0 ? (
      <div className="folder-library-overlay__empty">
        <p>{t(emptyKey)}</p>
        <button
          type="button"
          className="folder-library-overlay__empty-add"
          onClick={handleHeaderCreate}
        >
          {t("doc.library.add")}
        </button>
      </div>
    ) : (
      <ul className="folder-library-overlay__grid">
        {list.map((item) => (
          <li key={item.id} className="folder-library-overlay__cell">
            <button
              type="button"
              className="folder-library-overlay__cell-main"
              onClick={() => openItem(item)}
              title={item.tag}
            >
              {renderFichaFace(item, libraryTilePrefer("folder"))}
              <span className="folder-library-overlay__cell-meta">
                <span className="folder-library-overlay__cell-tag">{item.tag}</span>
                {item.promptClass ? (
                  <span className="folder-library-overlay__cell-class">{item.promptClass}</span>
                ) : null}
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
    )
  );

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
              {canUseAttachments ? (
                <button
                  type="button"
                  className={
                    "folder-library-overlay__attachments"
                    + (showingAttachments ? " is-active" : "")
                  }
                  aria-pressed={showingAttachments}
                  aria-label={t("doc.library.attachmentsAria")}
                  onClick={() => setFilter("skill")}
                >
                  <img
                    className="folder-library-overlay__attachments-icon"
                    src="/uploads/attachment.svg"
                    alt=""
                    aria-hidden
                    draggable={false}
                  />
                  <span>{t("doc.library.tabSkills")}</span>
                </button>
              ) : null}
              {showCreate ? (
                <button
                  type="button"
                  className="folder-library-overlay__add"
                  onClick={handleHeaderCreate}
                  title={t("doc.library.add")}
                  aria-label={t("doc.library.add")}
                >
                  +
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

          {showDocsToggle ? (
            <div
              className="folder-library-overlay__scope"
              role="tablist"
              aria-label={t("doc.library.scopeAria")}
            >
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === option.id}
                  className={
                    "folder-library-overlay__scope-btn"
                    + (scope === option.id ? " is-active" : "")
                  }
                  onClick={() => handleScope(option.id)}
                >
                  <img
                    className="folder-library-overlay__scope-icon"
                    src={option.iconSrc}
                    alt=""
                    aria-hidden
                    draggable={false}
                  />
                  <span>{t(option.labelKey)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {showingDocsIndex ? (
            <ul className="folder-library-overlay__grid">
              {docGroups.map((group) => {
                const previews = pickDocLibraryPreviews(group.items, 4);
                return (
                  <li key={group.documentId} className="folder-library-overlay__cell folder-library-overlay__cell--doc">
                    <button
                      type="button"
                      className="folder-library-overlay__cell-main"
                      onClick={() => setFocusedDocumentId(group.documentId)}
                      aria-label={t("doc.library.openDocAria").replace("{title}", group.title)}
                    >
                      <span
                        className={
                          "folder-library-overlay__doc-square"
                          + (previews.length === 0 ? " is-empty" : "")
                        }
                        aria-hidden
                      >
                        {previews.length > 0 ? (
                          previews.map((item) => (
                            <span key={item.id} className={miniFichaClass(item, libraryTilePrefer("document"))}>
                              {renderMiniFichaFace(item, libraryTilePrefer("document"))}
                            </span>
                          ))
                        ) : (
                          <img
                            className="folder-library-overlay__doc-square-icon"
                            src="/uploads/File.svg"
                            alt=""
                            draggable={false}
                          />
                        )}
                      </span>
                      <span className="folder-library-overlay__cell-meta">
                        <span className="folder-library-overlay__cell-tag">{group.title}</span>
                        <span className="folder-library-overlay__cell-class">
                          {t("doc.library.subfolderCount").replace("{count}", String(group.items.length))}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              {showingPromptRow ? (
                <div
                  className="folder-library-overlay__prompt-row"
                  role="tablist"
                  aria-label={t("doc.library.filterAria")}
                >
                  {showingDocumentGrid ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={filterTab === "documents"}
                      className={
                        "folder-library-overlay__tab folder-library-overlay__tab--with-icon"
                        + (filterTab === "documents" ? " is-active" : "")
                      }
                      onClick={() => setFilter("documents")}
                    >
                      <img
                        className="folder-library-overlay__tab-icon"
                        src="/uploads/TreeStructure.svg"
                        alt=""
                        aria-hidden
                        draggable={false}
                      />
                      <span>{t("doc.library.tabDocuments")}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterTab === "image"}
                    className={
                      "folder-library-overlay__prompt-label"
                      + (filterTab === "image" ? " is-active" : "")
                    }
                    onClick={() => setFilter("image")}
                  >
                    {t("doc.library.tabImages")}
                  </button>
                  {filterTab === "image" ? (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!promptClassFilter}
                        className={
                          "folder-library-overlay__prompt-class"
                          + (!promptClassFilter ? " is-active" : "")
                        }
                        onClick={() => setPromptClassFilter("")}
                      >
                        {t("doc.library.tabAll")}
                      </button>
                      {promptClasses.map((name) => (
                        editingClass.toLowerCase() === name.toLowerCase() ? (
                          <input
                            key={name}
                            ref={classEditRef}
                            className="folder-library-overlay__prompt-class-input"
                            value={classEditDraft}
                            placeholder={t("doc.library.promptClassPlaceholder")}
                            aria-label={t("doc.library.promptClassPlaceholder")}
                            onChange={(event) => setClassEditDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitClassEdit();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelClassEdit();
                              }
                            }}
                            onBlur={commitClassEdit}
                          />
                        ) : (
                          <span key={name} className="folder-library-overlay__prompt-class-wrap">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={promptClassFilter.toLowerCase() === name.toLowerCase()}
                              className={
                                "folder-library-overlay__prompt-class"
                                + (promptClassFilter.toLowerCase() === name.toLowerCase() ? " is-active" : "")
                              }
                              onClick={() => {
                                setClassDraftOpen(false);
                                setClassDraft("");
                                setPromptClassFilter(name);
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                startClassEdit(name);
                              }}
                            >
                              {name}
                            </button>
                            <button
                              type="button"
                              className="folder-library-overlay__prompt-class-delete"
                              aria-label={t("doc.library.promptClassDeleteAria", { name })}
                              title={t("doc.library.promptClassDeleteAria", { name })}
                              onClick={(event) => handleDeleteClass(name, event)}
                            >
                              ×
                            </button>
                          </span>
                        )
                      ))}
                      {classDraftOpen ? (
                        <input
                          ref={classDraftRef}
                          className="folder-library-overlay__prompt-class-input"
                          value={classDraft}
                          placeholder={t("doc.library.promptClassPlaceholder")}
                          aria-label={t("doc.library.promptClassPlaceholder")}
                          onChange={(event) => setClassDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitClassDraft();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setClassDraftOpen(false);
                              setClassDraft("");
                            }
                          }}
                          onBlur={() => {
                            if (!classDraft.trim()) {
                              setClassDraftOpen(false);
                              return;
                            }
                            commitClassDraft();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="folder-library-overlay__prompt-class-add"
                          onClick={() => {
                            cancelClassEdit();
                            setClassDraftOpen(true);
                          }}
                          aria-label={t("doc.library.promptClassAdd")}
                          title={t("doc.library.promptClassAdd")}
                        >
                          +
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              ) : null}

              {showingDocumentsTab ? (
                assets.length === 0 ? (
                  <div className="folder-library-overlay__empty">
                    <p>{t("doc.library.assetEmpty")}</p>
                    <button
                      type="button"
                      className="folder-library-overlay__empty-add"
                      onClick={() => setAssetModalOpen(true)}
                    >
                      {t("doc.library.add")}
                    </button>
                  </div>
                ) : (
                  <ul className="folder-library-overlay__subfolders">
                    {assets.map((asset) => {
                      const previews = items
                        .filter((item) => item.setId === asset.id)
                        .slice(0, 4);
                      return (
                      <li key={asset.id} className="folder-library-overlay__subfolder-wrap">
                        <button
                          type="button"
                          className="folder-library-overlay__subfolder"
                          onClick={() => setFocusedAssetId(asset.id)}
                          aria-label={t("doc.library.assetOpenAria").replace("{title}", asset.tag)}
                        >
                          <img
                            className="folder-library-overlay__subfolder-icon"
                            src="/uploads/Folders.svg"
                            alt=""
                            aria-hidden
                            draggable={false}
                          />
                          <span className="folder-library-overlay__subfolder-meta">
                            <span className="folder-library-overlay__subfolder-title">{asset.tag}</span>
                            <span className="folder-library-overlay__subfolder-count">
                              {t("doc.library.assetCount").replace(
                                "{count}",
                                String(assetCounts[asset.id] || 0),
                              )}
                            </span>
                          </span>
                          {previews.length > 0 ? (
                            <span className="folder-library-overlay__subfolder-previews" aria-hidden>
                              {previews.map((item) => (
                                <span key={item.id} className={miniFichaClass(item, libraryTilePrefer("folder"))}>
                                  {renderMiniFichaFace(item, libraryTilePrefer("folder"))}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="folder-library-overlay__subfolder-delete"
                          aria-label={t("common.delete")}
                          onClick={(event) => handleDeleteAsset(asset, event)}
                        >
                          ×
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                renderItemGrid(gridItems, emptyGridKey)
              )}
            </>
          )}
        </div>
      </div>

      {focusedAsset ? (
        <FolderLibraryAssetDetail
          ownerKind={activeKind}
          ownerId={activeId}
          assetId={focusedAsset.id}
          escapeEnabled={!modalOpen && !assetModalOpen && !detailItemId}
          onClose={() => setFocusedAssetId(null)}
          onEdit={(asset) => {
            setEditingAsset(asset);
            setAssetModalOpen(true);
          }}
          onOpenItem={(item) => openItem(item)}
        />
      ) : null}

      {detailItemId && detailKind === "image" && !modalOpen ? (
        <FolderLibraryImageDetail
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen && !assetModalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={openEditFromDetail}
        />
      ) : null}

      {detailItemId && detailKind === "video" && !modalOpen ? (
        <FolderLibraryVideoDetail
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen && !assetModalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={openEditFromDetail}
        />
      ) : null}

      {detailItemId && detailKind === "skill" && !modalOpen ? (
        <FolderLibrarySkillDetail
          ownerKind={activeKind}
          ownerId={activeId}
          folderId={activeId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen && !assetModalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={openEditFromDetail}
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
          defaultPromptClass={editingItem ? undefined : promptClassFilter}
          promptClasses={promptClasses}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
            setLockCategory(false);
          }}
          onSaved={(saved) => {
            if (focusedAssetId && saved?.id) {
              assignLibraryItemToSet(activeKind, activeId, saved.id, focusedAssetId);
            }
            setModalOpen(false);
            setEditingItem(null);
            setLockCategory(false);
          }}
        />
      ) : null}

      {assetModalOpen ? (
        <LibrarySetInputModal
          ownerId={activeId}
          editingSet={editingAsset}
          onClose={() => {
            setAssetModalOpen(false);
            setEditingAsset(null);
          }}
          onSaved={(saved) => {
            const wasEdit = Boolean(editingAsset);
            setAssetModalOpen(false);
            setEditingAsset(null);
            if (!saved?.id) return;
            if (!wasEdit) {
              setFilterTab("documents");
              writeStoredFilter(filterKey, "documents");
            }
            setFocusedAssetId(saved.id);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
