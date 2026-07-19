import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useObjectsStore,
  useDocsStore,
  useNodesStore,
  useUIStateStore,
  useTimelineStore,
  usePlanStore,
  useUpgradeModalStore,
  FREE_LIMITS,
} from "../../stores/index.js";
import {
  readLeftPanelNavSnapshot,
  writeLeftPanelNavSnapshot,
  clearLeftPanelNavSnapshot,
} from "../../stores/uiStateStore.js";
import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { getAgentsForUser, AGENT_MARKETING_GUIDE } from "../../lib/agents/registry.js";
import { useAuthStore } from "../../stores/authStore.js";
import { AgentListCard } from "../agents/AgentListCard.jsx";
import { ObjectThumbPreview } from "./objectIcons.jsx";
import { formatMmDdYy, isoFromDateInput, todayDateInputValue } from "../../lib/docDates.js";
import {
  folderSchedulePickerMinDateInput,
  validateFolderSchedule,
} from "../../lib/folderScheduleReservation.js";
import { DocDocumentBox } from "../docs/DocDocumentBox.jsx";
import { DocListTitle } from "../docs/DocListTitle.jsx";
import { docBlocksToBody, normalizeDocBlocks } from "../../lib/docBlocks.js";
import { UnsavedChangesConfirm } from "../shared/UnsavedChangesConfirm.jsx";
import { useDocBlockNodeModal, linkBlockNodesToDoc } from "../docs/useDocBlockNodeModal.jsx";
import { StandaloneNodeModal } from "../nodes/StandaloneNodeModal.jsx";
import { flushPersistenceSync } from "../../stores/middleware/persistenceMiddleware.js";
import {
  isTemplateDoc,
  isKnowledgeDoc,
  findProductVersionDoc,
  formatProductDocTitle,
  listProductDocs,
  listContentDocs,
  listUncategorizedDocs,
  listKnowledgeDocs,
  resolveProductDocDisplayTitle,
  resolveKnowledgeDocDisplayTitle,
} from "../../lib/templateDoc.js";
import { findObjectIdByName } from "../../lib/storeSanitize.js";
import { resolveDocSource } from "../../lib/docSources.js";
import { buildNodesByDocIdMap } from "../../lib/resolveDocBlockNodes.js";
import { buildTimelineQueueEntries } from "../../lib/timelineSelection.js";
import { setCorpusTimelineAuthority } from "../../lib/timelineCorpusAuthority.js";
import { useObjectTargetHoldStore } from "../../stores/objectTargetHoldStore.js";
import {
  buildCategoryFilterOptions,
  contentDocMatchesProductFilter,
  productDocMatchesCategoryFilter,
} from "../../lib/contentProductFilter.js";
import {
  groupProductDocsFromList,
} from "../../lib/docListGrouping.js";
import { DocGroupBlockCard } from "./DocGroupBlockCard.jsx";
import { PlanUsagePanel } from "../plans/PlanUsagePanel.jsx";
import { PackActionsBar } from "../packs/PackActionsBar.jsx";
import { ImportPackWizard } from "../packs/ImportPackWizard.jsx";
import { StepsLibraryPanel } from "../steps/StepsLibraryPanel.jsx";
import { LazyTodoQueuePanel } from "../lazyTodos/LazyTodoQueuePanel.jsx";
import { TranslatedText } from "../shared/TranslatedText.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { PANEL_TYPES, usePanelTypeLabels } from "../../i18n/panelTypes.js";
import { playTrashBoxSound } from "../../lib/trashBoxSound.js";
import { playClosedBoxSound } from "../../lib/closedBoxSound.js";

/** Resolve company object id when nav snapshot or store ids are stale after hydrate. */
function resolveLeftPanelObjectId(
  snapObjectId,
  objects,
  { companyName = null, filterObjectId = null, selectedObjectId = null } = {},
) {
  if (snapObjectId && objects[snapObjectId]) return snapObjectId;
  if (filterObjectId && objects[filterObjectId]) return filterObjectId;
  if (selectedObjectId && objects[selectedObjectId]) return selectedObjectId;
  if (companyName) {
    const byName = findObjectIdByName(objects, companyName);
    if (byName && objects[byName]) return byName;
  }
  const ids = Object.keys(objects || {});
  if (ids.length === 1) return ids[0];
  return null;
}

function startObjectDrag(e, objectId) {
  setCanvasDragData(e.dataTransfer, { kind: "object", objectId });
}

function startDocDrag(e, docId) {
  setCanvasDragData(e.dataTransfer, { kind: "document", docId });
}

/* ── helpers ────────────────────────────────── */
const TYPE_ICON = {
  Objects:   "◈",
  Documents: "📄",
  Nodes:     "◯",
};

const SELECTOR_ICON_ASSETS = {
  Objects: "/uploads/botones/all-objects.svg",
  Documents: "/uploads/box-closed.svg",
  Nodes: "/uploads/so-ref-nodes.svg",
};

function SelectorTypeIcon({ type, className = "lp-item-icon" }) {
  const src = SELECTOR_ICON_ASSETS[type];
  if (src) {
    return <img src={src} alt="" aria-hidden className={`${className} lp-item-icon-img`} />;
  }
  return <span className={className}>{TYPE_ICON[type] || "◯"}</span>;
}

const OBJECT_LONG_PRESS_MS = 550;

/* Objects grid: cube + name below, draggable */
function ObjectThumb({ object, menuOpen, selected = false, onEnter, onMenuOpen, onDelete, onEdit }) {
  const { t } = useI18n();
  const longPressTimer = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    suppressClickRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      suppressClickRef.current = true;
      onMenuOpen?.();
    }, OBJECT_LONG_PRESS_MS);
  };

  const handlePointerMove = (e) => {
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 8) clearLongPress();
  };

  const handlePointerUp = () => clearLongPress();
  const handlePointerCancel = () => clearLongPress();

  const handleClick = (e) => {
    if (e.detail > 1) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
    }
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (suppressClickRef.current) return;
    onEnter?.();
  };

  useEffect(() => () => clearLongPress(), []);

  return (
    <div className={"obj-thumb-cell" + (menuOpen ? " is-menu-open" : "") + (selected ? " is-selected" : "")}>
      <button
        type="button"
        className={"obj-thumb" + (selected ? " is-selected" : "")}
        draggable
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerUp}
        onDragStart={(e) => startObjectDrag(e, object.id)}
        title={t("sidebar.clickFolderDocs")}
      >
        <ObjectThumbPreview />
        <span className="obj-thumb-name">{object.name}</span>
      </button>
      {menuOpen && (
        <div className="obj-thumb-actions">
          <button
            type="button"
            className="btn xs ghost obj-thumb-action obj-thumb-action--delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            {t("common.delete")}
          </button>
          <button
            type="button"
            className="btn xs ghost obj-thumb-action obj-thumb-action--edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
          >
            {t("sidebar.edit")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Doc list card
───────────────────────────────────────────── */
function ClickFolderBox({ variant, onClick, label }) {
  return (
    <button
      type="button"
      className={`lp-click-folder-box lp-click-folder-box--${variant}`}
      onClick={onClick}
      title={label ? label : "Click to open folder"}
    >
      <ClickFolderIcon variant={variant} />
      {label ? <span className="lp-click-folder-box-label">{label}</span> : null}
    </button>
  );
}

function ClickFolderBack({ onBack, label, lowercase = false, iconOnly = false, inline = false }) {
  const ariaLabel = label ? `Back — ${label}` : "Back";
  return (
    <button
      type="button"
      className={"lp-click-folder-back" + (inline ? " lp-click-folder-back--inline" : "")}
      onClick={onBack}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="lp-click-folder-back-icon" aria-hidden />
      {!iconOnly && label ? (
        <span className={"lp-click-folder-back-label" + (lowercase ? " is-lowercase" : "")}>
          {label}
        </span>
      ) : null}
    </button>
  );
}

const CLICK_FOLDER_ICON_PATH = "M121.5 85.25H100.5C100.036 85.25 99.5908 85.4344 99.2626 85.7626C98.9344 86.0908 98.75 86.5359 98.75 87V89.625C98.75 90.0891 98.9344 90.5342 99.2626 90.8624C99.5908 91.1906 100.036 91.375 100.5 91.375V101C100.5 101.464 100.684 101.909 101.013 102.237C101.341 102.566 101.786 102.75 102.25 102.75H119.75C120.214 102.75 120.659 102.566 120.987 102.237C121.316 101.909 121.5 101.464 121.5 101V91.375C121.964 91.375 122.409 91.1906 122.737 90.8624C123.066 90.5342 123.25 90.0891 123.25 89.625V87C123.25 86.5359 123.066 86.0908 122.737 85.7626C122.409 85.4344 121.964 85.25 121.5 85.25ZM119.75 101H102.25V91.375H119.75V101ZM121.5 89.625H100.5V87H121.5V89.625ZM107.5 94.875C107.5 94.6429 107.592 94.4204 107.756 94.2563C107.92 94.0922 108.143 94 108.375 94H113.625C113.857 94 114.08 94.0922 114.244 94.2563C114.408 94.4204 114.5 94.6429 114.5 94.875C114.5 95.1071 114.408 95.3296 114.244 95.4937C114.08 95.6578 113.857 95.75 113.625 95.75H108.375C108.143 95.75 107.92 95.6578 107.756 95.4937C107.592 95.3296 107.5 95.1071 107.5 94.875Z";

function ClickFolderIcon({ variant, className = "lp-click-folder-box-icon" }) {
  if (variant === "knowledge") {
    return (
      <img
        src="/uploads/botones/FloppyDisk.svg"
        alt=""
        aria-hidden
        className={`${className} lp-click-folder-box-icon-img`}
      />
    );
  }

  if (variant === "agents") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === "groups" || variant === "subgroups") {
    return (
      <svg className={className} viewBox="98 83 26 22" fill="none" aria-hidden>
        <path fill="currentColor" d={CLICK_FOLDER_ICON_PATH} />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="98 83 26 22" fill="none" aria-hidden>
      <path fill="currentColor" d={CLICK_FOLDER_ICON_PATH} />
    </svg>
  );
}

function DocListCard({
  doc,
  objects,
  onSelect,
  onOpen,
  onDelete,
  queued = false,
  queueIndex = null,
  active = false,
}) {
  const { t } = useI18n();
  const parent = doc.parentObjectId ? objects[doc.parentObjectId] : null;
  const isTemplate = isTemplateDoc(doc);
  const isKnowledge = isKnowledgeDoc(doc);
  const displayTitle = isKnowledge
    ? resolveKnowledgeDocDisplayTitle(doc)
    : resolveProductDocDisplayTitle(doc);
  return (
    <div
      className={
        "lp-doc-card fn-card"
        + (queued ? " lp-doc-card--queued" : "")
        + (active ? " lp-doc-card--active" : "")
      }
    >
      {queued && queueIndex != null ? (
        <span className="lp-doc-card-queue-index" aria-hidden>{queueIndex}</span>
      ) : null}
      <button
        type="button"
        className="lp-doc-card-main"
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault();
          onOpen?.();
        }}
      >
        <span
          className="lp-doc-drag-area"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            startDocDrag(e, doc.id);
          }}
          title={t("sidebar.dragDocToCanvas")}
        >
          ⋮⋮
        </span>
        <span className="lp-doc-icon">
          <img src="/uploads/botones/docs.svg" alt="" aria-hidden className="lp-item-icon-img" />
        </span>
        <div className="fn-card-body">
          <div className="lp-doc-card-title-row">
            <DocListTitle doc={doc} />
            <span
              className="lp-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpen?.();
                }
              }}
            >
              <img
                src="/uploads/expand.svg"
                alt=""
                aria-hidden
                className="lp-expand-btn-icon"
              />
            </span>
          </div>
          <span className="fn-card-meta">
            {isTemplate ? t("sidebar.docTemplatePrefix") : ""}
            {isKnowledge
              ? (doc.knowledgeImport?.fileName ? t("sidebar.docMetaKnowledgeFile") : t("sidebar.docMetaKnowledge"))
              : parent ? `↳ ${parent.name}` : t("common.noParent")}
            {" · "}{t("sidebar.filesInBlock", { count: (doc.nodeIds || []).length })}
          </span>
        </div>
      </button>
      <button
        type="button"
        className="btn xs ghost danger-text lp-doc-card-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
      >
        {t("common.delete")}
      </button>
    </div>
  );
}

function DocCompactRow({
  doc,
  onSelect,
  onOpen,
  onDelete,
  active = false,
}) {
  const { t } = useI18n();
  const isKnowledge = isKnowledgeDoc(doc);
  const displayTitle = isKnowledge
    ? resolveKnowledgeDocDisplayTitle(doc)
    : resolveProductDocDisplayTitle(doc);

  return (
    <div className={"lp-doc-nodes-block__node" + (active ? " lp-doc-nodes-block__node--active" : "")}>
      <button
        type="button"
        className="lp-doc-nodes-block__node-main"
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault();
          onOpen?.();
        }}
        title={displayTitle}
      >
        <span
          className="lp-doc-drag-area lp-doc-drag-area--compact"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            startDocDrag(e, doc.id);
          }}
          onClick={(e) => e.stopPropagation()}
          title={t("sidebar.dragDocToCanvas")}
        >
          ⋮⋮
        </span>
        <span className="lp-doc-icon lp-doc-icon--compact">
          <img src="/uploads/botones/docs.svg" alt="" aria-hidden className="lp-item-icon-img" />
        </span>
        <DocListTitle doc={doc} nestedInGroup />
      </button>
      <div className="lp-doc-nodes-block__node-actions">
        <button
          type="button"
          className="lp-node-row-action lp-node-row-action--delete icon-del-btn"
          title={t("common.delete")}
          aria-label={t("common.delete")}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
        >
          ×
        </button>
        <button
          type="button"
          className="lp-node-row-action lp-node-row-action--open"
          title={t("sidebar.openDocument")}
          aria-label={t("sidebar.openDocument")}
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
        >
          ↗
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Node list card (with parent + type + insert)
───────────────────────────────────────────── */
function getNodeDisplayTitle(node) {
  return (node.sourceQuery || node.title || "Untitled query").trim() || "Untitled query";
}

/** Local clock time from node.anchorAt (e.g. "9:30 PM"); empty if missing/invalid. */
function formatNodeScheduleTime(anchorAt) {
  if (!anchorAt) return "";
  const d = new Date(anchorAt);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function NodeCompactRow({
  node,
  onClick,
  onInsert,
  onDelete,
  showScheduleTime = false,
  campaignMode = false,
}) {
  const { t } = useI18n();
  const displayTitle = getNodeDisplayTitle(node);
  const source = resolveDocSource(node?.sourceId);
  const iconSrc = source?.src || "/uploads/File.svg";
  const scheduleTime = showScheduleTime ? formatNodeScheduleTime(node?.anchorAt) : "";
  const isCampaignActive = campaignMode && node?.campaignStatus === "active";
  const campaignStatusLabel = campaignMode
    ? (isCampaignActive ? t("sidebar.campaignDocActive") : t("sidebar.campaignDocInactive"))
    : "";

  return (
    <div className={"lp-doc-nodes-block__node" + (isCampaignActive ? " is-campaign-active" : "")}>
      <button
        type="button"
        className="lp-doc-nodes-block__node-main"
        onClick={onClick}
        title={
          campaignStatusLabel
            ? `${displayTitle} · ${campaignStatusLabel}`
            : scheduleTime
              ? `${displayTitle} · ${scheduleTime}`
              : (source ? `${displayTitle} · ${source.label}` : displayTitle)
        }
      >
        <span className="lp-node-type-icon lp-node-type-icon--compact lp-node-type-icon--file">
          <img
            src={iconSrc}
            alt=""
            aria-hidden
            className="lp-node-type-icon-img lp-icon-white"
          />
        </span>
        <span className="lp-doc-nodes-block__node-title">{displayTitle}</span>
        {campaignStatusLabel ? (
          <span
            className={
              "lp-doc-nodes-block__node-status"
              + (isCampaignActive ? " is-active" : " is-inactive")
            }
            data-campaign-status={isCampaignActive ? "active" : "inactive"}
          >
            {campaignStatusLabel}
          </span>
        ) : null}
        {scheduleTime ? (
          <span className="lp-doc-nodes-block__node-time tnum">{scheduleTime}</span>
        ) : null}
      </button>
      <div className="lp-doc-nodes-block__node-actions">
        <button
          type="button"
          className="lp-node-row-action lp-node-row-action--delete icon-del-btn"
          title={t("common.delete")}
          aria-label={t("common.delete")}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
        >
          ×
        </button>
        <button
          type="button"
          className="lp-node-row-action lp-node-row-action--insert"
          title={t("sidebar.insertNode")}
          aria-label={t("sidebar.insertNode")}
          onClick={(e) => {
            e.stopPropagation();
            onInsert?.();
          }}
        >
          <img
            src="/uploads/botones/StackPlus.svg"
            alt=""
            aria-hidden
            className="lp-node-row-action__icon"
          />
        </button>
      </div>
    </div>
  );
}

function DocNodesBlockCard({
  doc,
  nodes,
  objects,
  onOpenDoc,
  onNodeClick,
  onNodeInsert,
  onNodeDelete,
  onCreateDocument,
  onDeleteBox,
  defaultExpanded = false,
  orphan = false,
  showWhenEmpty = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const rootRef = useRef(null);
  const parent = doc?.parentObjectId ? objects[doc.parentObjectId] : null;
  const isKnowledge = doc ? isKnowledgeDoc(doc) : false;
  const isTemplate = doc ? isTemplateDoc(doc) : false;
  const displayTitle = orphan
    ? t("sidebar.unlinkedNodes")
    : isKnowledge
      ? resolveKnowledgeDocDisplayTitle(doc)
      : resolveProductDocDisplayTitle(doc);

  const hasFolderSchedule = Boolean(
    !orphan
    && doc
    && !doc.campaignActive
    && doc.scheduleStartAt
    && doc.scheduleFinishAt
    && !isTemplate
    && !isKnowledge,
  );
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPress(), []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  useEffect(() => {
    if (!selectMode) return;
    clearLongPress();
    setMenuOpen(false);
    setExpanded(false);
  }, [selectMode]);

  if (!nodes.length && !showWhenEmpty && !orphan) return null;

  const handlePointerDown = (e) => {
    if (selectMode || e.button !== 0 || orphan || !onDeleteBox) return;
    suppressClickRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      suppressClickRef.current = true;
      setMenuOpen(true);
    }, OBJECT_LONG_PRESS_MS);
  };

  const handlePointerMove = (e) => {
    if (selectMode) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 8) clearLongPress();
  };

  const handlePointerUp = () => clearLongPress();

  const handleHeadClick = () => {
    if (selectMode) {
      if (!orphan && doc?.id) onToggleSelect?.(doc.id);
      return;
    }
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    playClosedBoxSound();
    setExpanded((value) => !value);
  };

  return (
    <article
      ref={rootRef}
      className={
        "lp-doc-nodes-block"
        + (orphan ? " lp-doc-nodes-block--orphan" : "")
        + (menuOpen ? " is-menu-open" : "")
        + (selectMode ? " lp-doc-nodes-block--select-mode" : "")
        + (selected ? " is-selected" : "")
      }
      aria-selected={selectMode ? selected : undefined}
    >
      <div className="lp-doc-nodes-block__head">
        <button
          type="button"
          className="lp-doc-nodes-block__head-main"
          onClick={handleHeadClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          aria-expanded={selectMode ? undefined : expanded}
          aria-pressed={selectMode ? selected : undefined}
        >
          {selectMode && !orphan ? (
            <span
              className={"lp-doc-nodes-block__check" + (selected ? " is-checked" : "")}
              aria-hidden
            />
          ) : null}
          {!orphan && doc && !selectMode ? (
            <span
              className="lp-doc-drag-area lp-doc-drag-area--compact"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                clearLongPress();
                startDocDrag(e, doc.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              title={t("sidebar.dragDocToCanvas")}
              aria-label={t("sidebar.dragDocToCanvas")}
            >
              ⋮⋮
            </span>
          ) : null}
          {!orphan ? (
            <span className={"lp-doc-icon lp-doc-icon--box" + (expanded ? " lp-doc-icon--box-open" : "")}>
              {(doc?.icon || "").trim() ? (
                <img
                  src={(doc.icon || "").trim()}
                  alt=""
                  aria-hidden
                  className="lp-folder-custom-icon"
                />
              ) : (
                <img
                  src={expanded ? "/uploads/open-box.svg" : "/uploads/box-closed.svg"}
                  alt=""
                  aria-hidden
                  className="lp-item-icon-img lp-box-icon-img"
                  key={expanded ? "open" : "closed"}
                />
              )}
            </span>
          ) : (
            <span className="lp-doc-icon lp-doc-icon--box">
              <SelectorTypeIcon type="Nodes" />
            </span>
          )}
          <div className="fn-card-body">
            <div className="lp-doc-card-title-row">
              {orphan ? (
                <b className="lp-doc-title-text">{displayTitle}</b>
              ) : (
                <DocListTitle doc={doc} />
              )}
              {!orphan && !selectMode ? (
                <span
                  className="lp-expand-btn"
                  role="button"
                  tabIndex={0}
                  aria-label={t("sidebar.openBox")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDoc?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenDoc?.();
                    }
                  }}
                >
                  <img
                    src="/uploads/expand.svg"
                    alt=""
                    aria-hidden
                    className="lp-expand-btn-icon"
                  />
                </span>
              ) : null}
            </div>
            <span className="fn-card-meta">
              {t("sidebar.filesInBlock", { count: nodes.length })}
              {!orphan && isTemplate ? " · template" : ""}
              {!orphan && isKnowledge
                ? (doc.knowledgeImport?.fileName ? " · file imported" : " · knowledge")
                : ""}
              {!orphan && parent ? (
                <span className="fn-card-meta__parent">
                  {` · ↳ ${parent.name}`}
                  {hasFolderSchedule && !selectMode ? (
                    <span
                      className="lp-folder-schedule-dot"
                      title={t("sidebar.scheduleActive")}
                      aria-label={t("sidebar.scheduleActive")}
                    />
                  ) : null}
                </span>
              ) : (
                hasFolderSchedule && !selectMode ? (
                  <span
                    className="lp-folder-schedule-dot"
                    title={t("sidebar.scheduleActive")}
                    aria-label={t("sidebar.scheduleActive")}
                  />
                ) : null
              )}
            </span>
          </div>
          {!selectMode ? (
            <span
              className={"lp-doc-nodes-block__chevron" + (expanded ? "" : " is-collapsed")}
              aria-hidden
            >
              <img
                src="/uploads/control.svg"
                alt=""
                className="lp-doc-nodes-block__chevron-img"
              />
            </span>
          ) : null}
        </button>
      </div>
      {menuOpen && onDeleteBox && !selectMode ? (
        <div className="lp-doc-nodes-block__press-actions">
          <button
            type="button"
            className="btn xs ghost lp-doc-nodes-block__press-delete"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              onDeleteBox();
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      ) : null}
      {expanded && !selectMode ? (
        <div className="lp-doc-nodes-block__body">
          {nodes.map((node) => (
            <NodeCompactRow
              key={node.id}
              node={node}
              showScheduleTime={hasFolderSchedule}
              campaignMode={Boolean(doc?.campaignActive)}
              onClick={() => onNodeClick?.(node)}
              onInsert={() => onNodeInsert?.(node)}
              onDelete={() => onNodeDelete?.(node)}
            />
          ))}
          {!orphan && onCreateDocument ? (
            <button
              type="button"
              className="lp-doc-nodes-block__create-doc"
              onClick={() => onCreateDocument(doc)}
            >
              <img
                src="/uploads/FileDashed.svg"
                alt=""
                aria-hidden
                className="lp-doc-nodes-block__create-doc-icon lp-icon-white"
              />
              <span>{t("sidebar.createDocumentInBox")}</span>
            </button>
          ) : null}
          {!nodes.length && !onCreateDocument ? (
            <p className="lp-doc-nodes-block__empty dim">{t("sidebar.noNodesInDoc")}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* ─────────────────────────────────────────────
   MODAL: Create Object  "CREATE YOUR MODEL"
───────────────────────────────────────────── */
const CREATE_BUSINESS_ILLUSTRATION = "/uploads/botones/create-business-name.svg";

function ObjectCreateModal({ onSubmit, onCancel, initial = null }) {
  const { t } = useI18n();
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submitPayload = () => ({
    name: name.trim(),
    brand: brand.trim(),
    description: desc,
    color: initial?.color ?? "#5a1f1f",
  });

  return (
    <div className="lp-overlay" onClick={onCancel}>
      <div className="lp-modal obj-create-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="lp-modal-close btn xs ghost" onClick={onCancel}>✕</button>

        <div className="obj-create-preview-row">
          <img
            src={CREATE_BUSINESS_ILLUSTRATION}
            alt=""
            className="obj-create-illustration"
            draggable={false}
          />
        </div>

        <div>
          <h3 className="obj-create-title">
            {isEdit ? t("sidebar.editBusinessRef") : t("sidebar.insertBusinessRef")}
          </h3>
          <input
            ref={ref}
            className="note-form-field obj-name-input"
            placeholder={t("sidebar.corpusName")}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && name.trim()) onSubmit(submitPayload());
              if (e.key === "Escape") onCancel();
            }}
          />
          <input
            className="note-form-field obj-brand-input"
            placeholder={t("sidebar.brandPlaceholder")}
            value={brand}
            onChange={e => setBrand(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && name.trim()) onSubmit(submitPayload());
              if (e.key === "Escape") onCancel();
            }}
            spellCheck={false}
          />
          <textarea
            className="note-form-field obj-desc-input"
            placeholder={t("sidebar.descriptionOptional")}
            value={desc}
            rows={3}
            onChange={e => setDesc(e.target.value)}
          />
          <div className="obj-create-actions">
            <button type="button" className="btn ghost" onClick={onCancel}>{t("common.cancel")}</button>
            <button
              type="button"
              className="btn primary obj-create-save"
              disabled={!name.trim()}
              onClick={() => onSubmit(submitPayload())}
            >
              {isEdit ? t("sidebar.saveChanges") : t("sidebar.saveObject")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildDocCreateSnapshot({
  title,
  body,
  blocks,
  version,
  category,
  icon,
  launchDate,
  scheduleStartDate,
  scheduleFinishDate,
  campaignActive,
  subcategoryDocIds,
  nodeLinkColor,
  parentId,
  knowledgeImport,
}) {
  return JSON.stringify({
    title: title ?? "",
    body: body ?? "",
    blocks: normalizeDocBlocks(blocks),
    version: String(version ?? "").trim(),
    category: String(category ?? "").trim(),
    icon: String(icon ?? "").trim(),
    launchDate: launchDate ?? "",
    scheduleStartDate: scheduleStartDate ?? "",
    scheduleFinishDate: scheduleFinishDate ?? "",
    campaignActive: Boolean(campaignActive),
    subcategoryDocIds: Array.isArray(subcategoryDocIds) ? [...subcategoryDocIds] : [],
    nodeLinkColor: nodeLinkColor ?? "dark",
    parentId: parentId ?? "",
    knowledgeImport: knowledgeImport ?? null,
  });
}

/* ─────────────────────────────────────────────
   MODAL: Create Document  "New File" Notion-like
───────────────────────────────────────────── */
function DocCreateModal({
  objects,
  allDocs,
  defaultParentId,
  createMode = "content",
  defaultCategory = "",
  onSubmit,
  onCancel,
  onOpenDocument,
  onInsertToCanvas,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [blocks, setBlocks] = useState([]);
  const fallbackParent = defaultParentId || "";
  const [parentId, setParentId] = useState(fallbackParent);
  const [createdDate, setCreatedDate] = useState(todayDateInputValue);
  const [version, setVersion] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [icon, setIcon] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleFinishDate, setScheduleFinishDate] = useState("");
  const [campaignActive, setCampaignActive] = useState(createMode === "campaign");
  const [subcategoryDocIds, setSubcategoryDocIds] = useState([]);
  const [nodeLinkColor, setNodeLinkColor] = useState("dark");
  const [knowledgeImport, setKnowledgeImport] = useState(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const titleRef = useRef(null);
  const createSnapshotRef = useRef(null);
  const isProductMode = createMode === "product";
  const isKnowledgeMode = createMode === "knowledge";
  const isCampaignMode = createMode === "campaign";
  const isContentMode = createMode === "content" || isCampaignMode || (!isProductMode && !isKnowledgeMode);
  const useFolderSchedule = createMode === "content";
  const metaMode = isProductMode ? "product" : isKnowledgeMode ? "knowledge" : "content";
  const docKind = isProductMode ? "product" : isKnowledgeMode ? "knowledge" : "content";
  /** Products + Content: title and category mirror each other (file-box grouping). */
  const syncTitleWithCategory = isProductMode || isContentMode;

  const scheduleStartMin = useMemo(() => {
    if (!useFolderSchedule) return todayDateInputValue();
    // Today only — overlap vs other folders is validated on change/save.
    return folderSchedulePickerMinDateInput();
  }, [useFolderSchedule]);

  useEffect(() => {
    setParentId(fallbackParent);
  }, [fallbackParent]);

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const alertFolderScheduleError = async (check) => {
    if (!check || check.ok) return;
    let message = t("meta.scheduleInvalid");
    if (check.code === "required" || check.code === "partial") {
      message = t("meta.schedulePartial");
    } else if (check.code === "finishBeforeStart") {
      message = t("meta.scheduleFinishBeforeStart");
    } else if (check.code === "overlap") {
      const until = check.conflict?.finish
        ? formatMmDdYy(check.conflict.finish.toISOString())
        : "";
      message = t("meta.scheduleOverlap", {
        title: check.conflict?.title || "Folder",
        until,
        minStart: formatMmDdYy(check.minStart || scheduleStartMin)
          || check.minStart
          || scheduleStartMin,
      });
    }
    await askConfirm({
      title: t("meta.scheduleTitle"),
      message,
      confirmLabel: t("common.ok"),
      tone: "default",
      hideCancel: true,
    });
  };

  const handleScheduleStartChange = (value) => {
    if (!value) {
      setScheduleStartDate("");
      setScheduleFinishDate("");
      return;
    }
    const clamped = scheduleStartMin && value < scheduleStartMin ? scheduleStartMin : value;
    setScheduleStartDate(clamped);
    setScheduleFinishDate((finish) => (!finish || finish < clamped ? clamped : finish));
  };

  const handleScheduleFinishChange = (value) => {
    if (!value) {
      setScheduleFinishDate("");
      return;
    }
    const start = scheduleStartDate || value;
    if (!scheduleStartDate) setScheduleStartDate(start);
    setScheduleFinishDate(value < start ? start : value);
  };

  const handleScheduleDatesClear = () => {
    setScheduleStartDate("");
    setScheduleFinishDate("");
  };

  useEffect(() => {
    createSnapshotRef.current = buildDocCreateSnapshot({
      title: "",
      body: "",
      blocks: [],
      version: "",
      category: defaultCategory,
      icon: "",
      launchDate: "",
      scheduleStartDate: "",
      scheduleFinishDate: "",
      campaignActive: createMode === "campaign",
      subcategoryDocIds: [],
      nodeLinkColor: "dark",
      parentId: fallbackParent,
      knowledgeImport: null,
    });
    setShowUnsavedConfirm(false);
    // Snapshot only when the create modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentCreateSnapshot = useCallback(
    () => buildDocCreateSnapshot({
      title,
      body,
      blocks,
      version,
      category,
      icon,
      launchDate,
      scheduleStartDate,
      scheduleFinishDate,
      campaignActive,
      subcategoryDocIds,
      nodeLinkColor,
      parentId,
      knowledgeImport,
    }),
    [
      title,
      body,
      blocks,
      version,
      category,
      icon,
      launchDate,
      scheduleStartDate,
      scheduleFinishDate,
      campaignActive,
      subcategoryDocIds,
      nodeLinkColor,
      parentId,
      knowledgeImport,
    ],
  );

  const hasUnsavedCreateChanges = useCallback(() => {
    const snap = createSnapshotRef.current;
    if (!snap) return false;
    return snap !== currentCreateSnapshot();
  }, [currentCreateSnapshot]);

  const requestClose = useCallback(() => {
    if (hasUnsavedCreateChanges()) {
      setShowUnsavedConfirm(true);
      return;
    }
    onCancel();
  }, [hasUnsavedCreateChanges, onCancel]);

  const parentObject = isKnowledgeMode ? null : objects.find((o) => o.id === parentId);

  const handleKnowledgeFileImport = ({ title: importTitle, knowledgeImport: nextImport }) => {
    if (importTitle && !title.trim()) setTitle(importTitle);
    if (nextImport) setKnowledgeImport(nextImport);
  };

  const handleTitleChange = (value) => {
    setTitle(value);
    if (syncTitleWithCategory) setCategory(value);
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    if (syncTitleWithCategory) setTitle(value);
  };

  const {
    onOpenNodeForBlock,
    onEnsureNodeForBlock,
    onBlockAnchorChange,
    onAnswerBelowH1Change,
    onVideoEmbedSync,
    onVideoEmbedH1TitleChange,
    nodeModal,
    isNodeModalOpen,
  } = useDocBlockNodeModal({
    blocks,
    setBlocks,
    createdDate,
    docId: null,
    docTitle: title,
    nodeLinkColor,
    onInsertToCanvas,
    parentFolderDoc: useFolderSchedule
      ? {
        scheduleStartAt: scheduleStartDate ? isoFromDateInput(scheduleStartDate) : null,
        scheduleFinishAt: scheduleFinishDate ? isoFromDateInput(scheduleFinishDate) : null,
      }
      : null,
  });

  const handleVersionCommit = (trimmedVersion) => {
    const trimmed = trimmedVersion.trim();
    if (!trimmed) {
      setVersion("");
      return;
    }
    const cat = category.trim();
    if (cat) {
      const existing = findProductVersionDoc(allDocs, parentId, cat, trimmed);
      if (existing) {
        onCancel();
        onOpenDocument?.(existing.id);
        return;
      }
    }
    setVersion(trimmed);
    setBlocks([]);
    setBody("");
  };

  const submitDoc = async () => {
    const trimmedCategory = category.trim();
    const productName = title.trim() || trimmedCategory;
    const finalCategory = (isProductMode || isContentMode)
      ? (trimmedCategory || productName)
      : trimmedCategory;
    const finalTitle = isProductMode
      ? (formatProductDocTitle(finalCategory || productName, version.trim()) || productName || t("sidebar.newProduct"))
      : isKnowledgeMode
        ? (finalCategory || title.trim() || t("sidebar.newKnowledge"))
        : (title.trim() || finalCategory || t("sidebar.newDocument"));
    const autoTags = isKnowledgeMode ? [] : (parentObject?.name ? [parentObject.name] : []);
    const serializedBody = docBlocksToBody(blocks) || body;

    let scheduleStartAt = null;
    let scheduleFinishAt = null;
    // Campaign folders: Launch lives on child docs — do not set folder.launchAt.
    let launchAt = isCampaignMode
      ? null
      : (launchDate ? isoFromDateInput(launchDate) : null);

    if (useFolderSchedule) {
      const check = validateFolderSchedule(
        scheduleStartDate,
        scheduleFinishDate,
        allDocs || [],
        parentId,
      );
      if (!check.ok) {
        await alertFolderScheduleError(check);
        return;
      }
      const hasSchedule = Boolean(String(scheduleStartDate || "").trim())
        && Boolean(String(scheduleFinishDate || "").trim());
      if (hasSchedule) {
        scheduleStartAt = isoFromDateInput(scheduleStartDate);
        scheduleFinishAt = isoFromDateInput(scheduleFinishDate);
        launchAt = scheduleStartAt;
      }
    }

    onSubmit({
      title: finalTitle,
      parentObjectId: isKnowledgeMode ? null : (parentId || null),
      tags: autoTags,
      body: serializedBody,
      blocks,
      createdAt: isoFromDateInput(createdDate),
      version: version.trim(),
      category: finalCategory,
      icon: createMode === "content" ? (icon || "") : "",
      launchAt,
      scheduleStartAt,
      scheduleFinishAt,
      campaignActive: isCampaignMode ? true : campaignActive,
      subcategoryDocIds,
      nodeLinkColor,
      docKind,
      knowledgeImport: isKnowledgeMode ? knowledgeImport : null,
    });
  };

  return (
    <>
      {!isNodeModalOpen ? (
        <div className="lp-overlay lp-overlay--solid lp-overlay--center">
          <div className="lp-modal doc-new-modal" onClick={(e) => e.stopPropagation()}>
            <DocDocumentBox
          title={title}
          onTitleChange={handleTitleChange}
          titleRef={titleRef}
          titlePlaceholder={
            isProductMode
              ? t("sidebar.productName")
              : isKnowledgeMode
                ? t("sidebar.documentTitle")
                : isContentMode
                  ? t("sidebar.categoryFileBox")
                  : t("sidebar.writeDescription")
          }
          body={body}
          onBodyChange={setBody}
          blocks={blocks}
          onBlocksChange={setBlocks}
          createdDate={createdDate}
          version={version}
          onVersionChange={setVersion}
          onVersionCommit={handleVersionCommit}
          category={category}
          onCategoryChange={handleCategoryChange}
          launchDate={isCampaignMode ? "" : launchDate}
          onLaunchDateChange={isCampaignMode ? undefined : setLaunchDate}
          scheduleStartDate={scheduleStartDate}
          onScheduleStartDateChange={handleScheduleStartChange}
          scheduleFinishDate={scheduleFinishDate}
          onScheduleFinishDateChange={handleScheduleFinishChange}
          scheduleStartMin={scheduleStartMin}
          onScheduleDatesClear={handleScheduleDatesClear}
          useFolderSchedule={useFolderSchedule}
          campaignActive={isCampaignMode ? true : campaignActive}
          onCampaignActiveChange={isCampaignMode ? undefined : setCampaignActive}
          deferCampaignStatusToChildren={isCampaignMode}
          subcategoryDocIds={subcategoryDocIds}
          onSubcategoryDocIdsChange={setSubcategoryDocIds}
          allDocs={allDocs}
          nodeLinkColor={nodeLinkColor}
          onNodeLinkColorChange={setNodeLinkColor}
          parentId={parentId}
          onParentIdChange={createMode === "content" ? undefined : setParentId}
          icon={createMode === "content" ? icon : ""}
          onIconChange={createMode === "content" ? setIcon : undefined}
          objects={objects}
          docKind={docKind}
          metaMode={metaMode}
          onDelete={requestClose}
          onSave={submitDoc}
          onCloseExpand={requestClose}
          onOpenNodeForBlock={onOpenNodeForBlock}
          onEnsureNodeForBlock={onEnsureNodeForBlock}
          onAnswerBelowH1Change={onAnswerBelowH1Change}
          onBlockAnchorChange={onBlockAnchorChange}
          onVideoEmbedSync={onVideoEmbedSync}
          onVideoEmbedH1TitleChange={onVideoEmbedH1TitleChange}
          onKnowledgeFileImport={isKnowledgeMode ? handleKnowledgeFileImport : undefined}
          knowledgeImport={isKnowledgeMode ? knowledgeImport : null}
          onTitleKeyDown={(e) => {
            if (e.key === "Escape") requestClose();
          }}
          onBodyKeyDown={(e) => {
            if (e.key === "Escape") requestClose();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submitDoc();
            }
          }}
        />
          </div>
        </div>
      ) : null}
      <UnsavedChangesConfirm
        open={showUnsavedConfirm}
        titleId="doc-create-unsaved-title"
        onYes={() => {
          setShowUnsavedConfirm(false);
          submitDoc();
        }}
        onNo={() => {
          setShowUnsavedConfirm(false);
          onCancel();
        }}
      />
      {nodeModal}
    </>
  );
}

/* ─────────────────────────────────────────────
   Dropdown  (shared)
───────────────────────────────────────────── */
function Dropdown({ label, open, onToggle, children }) {
  const ref = useRef(null);
  const menuRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!open) return;
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      onToggle();
      leaveTimerRef.current = null;
    }, 180);
  }, [clearLeaveTimer, onToggle, open]);

  const hoverHandlers = {
    onMouseEnter: clearLeaveTimer,
    onMouseLeave: scheduleClose,
  };

  const updateMenuPosition = useCallback(() => {
    const btn = ref.current?.querySelector(".lp-dropdown-btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      onToggle();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="lp-dropdown-menu lp-dropdown-menu--portal"
            role="menu"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
            }}
            {...hoverHandlers}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lp-dropdown-wrap" ref={ref} {...hoverHandlers}>
      <button
        type="button"
        className="lp-dropdown-btn"
        onClick={onToggle}
      >
        {label}
      </button>
      {menu}
    </div>
  );
}

function FolderTypeIcon({ panelType }) {
  return (
    <span className="lp-folder-icon lp-folder-icon--object" aria-hidden>
      <SelectorTypeIcon type={panelType} className="lp-folder-icon-img" />
    </span>
  );
}

/* ─────────────────────────────────────────────
   LEFT PANEL  (main export)
───────────────────────────────────────────── */
function TimelineDocQueue({
  entries = [],
  docs = {},
  objects = {},
  activeDocId = null,
  onSelectDoc,
  onOpenDocument,
  onDeleteDoc,
}) {
  const { t } = useI18n();
  if (!entries.length) return null;

  return (
    <section className="lp-timeline-doc-queue" aria-label={t("sidebar.selectedDocs")}>
      {entries.map((entry) => {
        const doc = docs[entry.docId];
        if (!doc) return null;
        return (
          <DocListCard
            key={entry.docId}
            doc={doc}
            objects={objects}
            queued
            queueIndex={entry.queueIndex}
            active={activeDocId === entry.docId}
            onSelect={() => onSelectDoc?.(entry.docId)}
            onOpen={() => onOpenDocument?.(entry.docId, {
              focusBlockId: entry.focusBlockId ?? null,
            })}
            onDelete={() => onDeleteDoc?.(doc)}
          />
        );
      })}
    </section>
  );
}

export function LeftPanel({
  companyName = null,
  onInsertToCanvas,
  onInsertAgent,
  onOpenDocument,
  onExpandNode,
  onDocumentDeleted,
  onRunStepPlaybook,
  onOpenNewStepPlaybook,
  onOpenUrlTableForCompany,
  onOpenPasswordTableForCompany,
  onOpenNewLazyTodo,
  onOpenLazyTodoItem,
  onStepPlaybookRemoved,
  timelineCanvasSelection = [],
  canvasNodesForQueue = [],
  onNotify = null,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const panelTypeLabel = usePanelTypeLabels();
  const [panelType, setPanelType] = useState("Objects");
  const [activeId, setActiveId] = useState(null);
  const [objectMenuId, setObjectMenuId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editObjectId, setEditObjectId] = useState(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [objectWorkspaceActive, setObjectWorkspaceActive] = useState(false);
  const [nodeEditId, setNodeEditId] = useState(null);
  const [nodeEditContentFocus, setNodeEditContentFocus] = useState(false);
  const [nodeSearch, setNodeSearch] = useState("");
  const [createDocumentParentDocId, setCreateDocumentParentDocId] = useState(null);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [clickFolderView, setClickFolderView] = useState(null);
  const [packImportActive, setPackImportActive] = useState(false);
  const [stepsLibraryActive, setStepsLibraryActive] = useState(false);
  const [lazyTodosActive, setLazyTodosActive] = useState(false);
  const [leftPanelNavRestored, setLeftPanelNavRestored] = useState(false);
  const [folderBulkDeleteMode, setFolderBulkDeleteMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setSelectedObjectId = useUIStateStore((s) => s.setSelectedObjectId);
  const setKnowledgeFolderActive = useUIStateStore((s) => s.setKnowledgeFolderActive);
  const productCategoryFilter = useUIStateStore((s) => s.productCategoryFilter);
  const setProductCategoryFilter = useUIStateStore((s) => s.setProductCategoryFilter);
  const contentProductFilter = useUIStateStore((s) => s.contentProductFilter);
  const setContentProductFilter = useUIStateStore((s) => s.setContentProductFilter);
  const folderDensity = useUIStateStore((s) => s.folderDensity);
  const densifyFolderList = useUIStateStore((s) => s.densifyFolderList);
  const expandFolderList = useUIStateStore((s) => s.expandFolderList);
  const workspaceHydrated = useUIStateStore((s) => s.workspaceHydrated);
  const leftPanelNavigateRequest = useUIStateStore((s) => s.leftPanelNavigateRequest);
  const clearLeftPanelNavigateRequest = useUIStateStore((s) => s.clearLeftPanelNavigateRequest);
  const requestEnterWorkspaceId = useUIStateStore((s) => s.requestEnterWorkspaceId);
  const clearRequestEnterObjectWorkspace = useUIStateStore((s) => s.clearRequestEnterObjectWorkspace);

  /* stores */
  const objects    = useObjectsStore(s => s.objects);
  const addObject  = useObjectsStore(s => s.addObject);
  const updateObject = useObjectsStore(s => s.updateObject);
  const planProfile = usePlanStore(s => s.profile);
  const showUpgradeModal = useUpgradeModalStore(s => s.show);
  const docs       = useDocsStore(s => s.docs);
  const addDoc     = useDocsStore(s => s.addDoc);
  const deleteDoc  = useDocsStore(s => s.deleteDoc);
  const getDocsByObject = useDocsStore(s => s.getDocsByObject);
  const deleteObjectWithCascade = useObjectsStore(s => s.deleteObjectWithCascade);
  const nodes      = useNodesStore(s => s.nodes);
  const deleteNode = useNodesStore(s => s.deleteNode);
  const deleteNodeAndDocBlocks = useNodesStore(s => s.deleteNodeAndDocBlocks);
  const removeTimelineDocFromQueue = useTimelineStore((s) => s.removeTimelineDocFromQueue);
  const timelineQueueMode = useTimelineStore((s) => s.timelineQueueMode);

  const userEmail = useAuthStore((s) => s.user?.email);

  const handleInsertGuide = useCallback(() => {
    onInsertAgent?.(AGENT_MARKETING_GUIDE);
  }, [onInsertAgent]);

  const canvasAgents = useMemo(
    () => getAgentsForUser(userEmail).filter((agent) => agent.id !== AGENT_MARKETING_GUIDE),
    [userEmail],
  );

  const timelineQueueEntries = useMemo(
    () => (
      timelineCanvasSelection.length
        ? buildTimelineQueueEntries(
          timelineCanvasSelection,
          canvasNodesForQueue,
          nodes,
          docs,
          { selectCounterMode: timelineQueueMode },
        )
        : []
    ),
    [timelineQueueMode, timelineCanvasSelection, canvasNodesForQueue, nodes, docs],
  );

  const objList  = Object.values(objects);
  const docList  = Object.values(docs);
  const nodeList = Object.values(nodes);
  const activeObjectId = selectedObjectId || filterObjectId || null;
  const activeObject = activeObjectId ? objects[activeObjectId] : null;

  const docsWithoutParent = docList.filter((doc) => !doc.parentObjectId);
  const filteredObjectList = objList;
  const filteredDocList = filterObjectId ? getDocsByObject(filterObjectId) : docsWithoutParent;
  const objectDocSections = objList
    .map((obj) => ({ object: obj, docs: getDocsByObject(obj.id) }))
    .filter((section) => section.docs.length > 0);

  // Independent Documents: only orphans scoped to this company/corpus.
  // Never pull parentless nodes from other corpus objects.
  const independentNodes = useMemo(() => {
    if (!activeObjectId) return [];
    return nodeList.filter((node) => {
      if (node.parentDocId) return false;
      return node.objectId === activeObjectId;
    });
  }, [activeObjectId, nodeList]);

  const filteredIndependentNodes = independentNodes.filter((node) => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return true;
    const title = (node.sourceQuery || node.title || "").toLowerCase();
    const content =
      typeof node.content === "string" ? node.content.toLowerCase() : JSON.stringify(node.content || "").toLowerCase();
    return title.includes(q) || content.includes(q);
  });

  // Resolve folder children from block.nodeId (editor source of truth) + parentDocId.
  // Many persisted nodes have parentDocId wiped; counting only parentDocId shows "0 documents".
  const nodesByDocId = useMemo(
    () => buildNodesByDocIdMap(docs, nodes),
    [docs, nodes],
  );

  const openCreateDocument = useCallback((parentDoc = null) => {
    setCreateDocumentParentDocId(parentDoc?.id || null);
    setShowCreateDocument(true);
    setShowCreate(false);
    setFolderOpen(false);
  }, []);

  const handleDocumentCreated = useCallback((entity) => {
    setShowCreateDocument(false);
    setCreateDocumentParentDocId(null);
    if (entity) onInsertToCanvas?.(entity);
  }, [onInsertToCanvas]);

  const filterObject = filterObjectId ? objects[filterObjectId] : null;

  const productDocs = useMemo(
    () => (filterObjectId ? listProductDocs(docs, filterObjectId) : []),
    [docs, filterObjectId],
  );
  const contentDocs = useMemo(
    () => (filterObjectId ? listContentDocs(docs, filterObjectId) : []),
    [docs, filterObjectId],
  );
  const uncategorizedDocs = useMemo(
    () => (filterObjectId ? listUncategorizedDocs(docs, filterObjectId) : []),
    [docs, filterObjectId],
  );
  const knowledgeDocs = useMemo(() => listKnowledgeDocs(docs), [docs]);

  const categoryFilterOptions = useMemo(
    () => buildCategoryFilterOptions(productDocs),
    [productDocs],
  );

  const filteredProductDocs = useMemo(
    () => productDocs.filter((doc) => productDocMatchesCategoryFilter(doc, productCategoryFilter)),
    [productDocs, productCategoryFilter],
  );

  const campaignDocs = useMemo(
    () => contentDocs.filter((doc) => Boolean(doc.campaignActive)),
    [contentDocs],
  );

  const campaignCategoryFilterOptions = useMemo(
    () => buildCategoryFilterOptions(campaignDocs),
    [campaignDocs],
  );

  const filteredCampaignDocs = useMemo(
    () => campaignDocs.filter((doc) => productDocMatchesCategoryFilter(doc, productCategoryFilter)),
    [campaignDocs, productCategoryFilter],
  );

  const filteredContentDocs = useMemo(
    () => contentDocs.filter((doc) => (
      !doc.campaignActive
      && contentDocMatchesProductFilter(doc, docs, contentProductFilter)
    )),
    [contentDocs, docs, contentProductFilter],
  );

  const filteredUncategorizedDocs = useMemo(
    () => (contentProductFilter ? [] : uncategorizedDocs),
    [uncategorizedDocs, contentProductFilter],
  );

  const folderSearchNeedle = folderSearchQuery.trim().toLowerCase();

  const matchesFolderSearch = useCallback((doc) => {
    if (!folderSearchNeedle) return true;
    const title = String(doc?.title || "").toLowerCase();
    return title.includes(folderSearchNeedle);
  }, [folderSearchNeedle]);

  const visibleCampaignDocs = useMemo(
    () => filteredCampaignDocs.filter(matchesFolderSearch),
    [filteredCampaignDocs, matchesFolderSearch],
  );

  const visibleContentDocs = useMemo(
    () => filteredContentDocs.filter(matchesFolderSearch),
    [filteredContentDocs, matchesFolderSearch],
  );

  const visibleUncategorizedDocs = useMemo(
    () => filteredUncategorizedDocs.filter(matchesFolderSearch),
    [filteredUncategorizedDocs, matchesFolderSearch],
  );

  const groupedProductDocs = useMemo(
    () => groupProductDocsFromList(filteredProductDocs, t("sidebar.docGroupUncategorized")),
    [filteredProductDocs, t],
  );


  useEffect(() => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setProductCategoryFilter(null);
    setContentProductFilter(null);
  }, [panelType, filterObjectId, setProductCategoryFilter, setContentProductFilter]);

  const openPackImportView = () => {
    setClickFolderView(null);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setPackImportActive(true);
  };

  const closePackImportView = () => {
    setPackImportActive(false);
  };

  const openStepsLibraryView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setLazyTodosActive(false);
    setStepsLibraryActive(true);
  };

  const closeStepsLibraryView = () => {
    setStepsLibraryActive(false);
  };

  const openLazyTodosView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setLazyTodosActive(true);
  };

  const closeLazyTodosView = () => {
    setLazyTodosActive(false);
  };

  useEffect(() => {
    setKnowledgeFolderActive(clickFolderView === "knowledge");
    return () => setKnowledgeFolderActive(false);
  }, [clickFolderView, setKnowledgeFolderActive]);

  /** Sidebar highlight only — does not add to the canvas-driven timeline queue. */
  const handleSelectFolderDoc = (docId) => {
    if (!docId) return;
    setActiveId(docId);
  };

  const handleSelectQueuedDoc = (docId) => {
    if (!docId) return;
    setActiveId(docId);
  };

  const handleOpenFolderDoc = (docId, options = {}) => {
    setActiveId(docId);
    onOpenDocument?.(docId, options);
  };

  const handleDeleteDoc = async (doc) => {
    const label = resolveProductDocDisplayTitle(doc);
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'pre-fix',hypothesisId:'H5',location:'LeftPanel.jsx:handleDeleteDoc',message:'delete confirm starting',data:{docId:doc?.id||null,label},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const confirmed = await askConfirm({
      title: t("sidebar.deleteDocTitle"),
      message: t("sidebar.deleteDocConfirm", { name: label }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'pre-fix',hypothesisId:'H5',location:'LeftPanel.jsx:handleDeleteDoc',message:'delete confirm result',data:{docId:doc?.id||null,confirmed},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!confirmed) return;
    playTrashBoxSound();
    onDocumentDeleted?.(doc.id);
    removeTimelineDocFromQueue(doc.id);
    deleteDoc(doc.id);
    if (activeId === doc.id) setActiveId(null);
  };

  const handleDeleteNode = async (node) => {
    if (!node?.id) return;
    const label = String(node.title || node.sourceQuery || t("sidebar.newDocument")).trim()
      || t("sidebar.newDocument");
    const confirmed = await askConfirm({
      title: t("sidebar.deleteNodeTitle"),
      message: t("sidebar.deleteNodeConfirm", { name: label }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    playTrashBoxSound();
    deleteNodeAndDocBlocks(node.id);
  };

  const exitFolderBulkDeleteMode = useCallback(() => {
    setFolderBulkDeleteMode(false);
    setSelectedFolderIds([]);
  }, []);

  const toggleFolderBulkDeleteMode = useCallback(() => {
    setFolderBulkDeleteMode((active) => {
      if (active) {
        setSelectedFolderIds([]);
        return false;
      }
      setSelectedFolderIds([]);
      return true;
    });
  }, []);

  const toggleFolderSelect = useCallback((docId) => {
    if (!docId) return;
    setSelectedFolderIds((prev) => (
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    ));
  }, []);

  const handleDeleteSelectedFolders = async () => {
    const ids = selectedFolderIds.filter((id) => docs[id]);
    if (!ids.length) return;
    const confirmed = await askConfirm({
      title: t("sidebar.deleteDocsTitle"),
      message: t("sidebar.deleteDocsConfirm", { count: ids.length }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    playTrashBoxSound();
    for (const id of ids) {
      onDocumentDeleted?.(id);
      removeTimelineDocFromQueue(id);
      deleteDoc(id);
      if (activeId === id) setActiveId(null);
    }
    exitFolderBulkDeleteMode();
  };

  useEffect(() => {
    const inFolderSelectView =
      clickFolderView === "subgroups" || clickFolderView === "campaign";
    if (!inFolderSelectView && folderBulkDeleteMode) {
      exitFolderBulkDeleteMode();
    }
    if (!inFolderSelectView && folderSearchQuery) {
      setFolderSearchQuery("");
    }
  }, [
    clickFolderView,
    folderBulkDeleteMode,
    folderSearchQuery,
    exitFolderBulkDeleteMode,
  ]);

  const handleDeleteCategoryGroup = async (group) => {
    const label = group?.label || t("sidebar.docGroupUncategorized");
    const count = group?.docs?.length || 0;
    if (!count) return;
    const confirmed = await askConfirm({
      title: t("sidebar.deleteCategoryTitle"),
      message: t("sidebar.deleteCategoryConfirm", { name: label, count }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    playTrashBoxSound();
    for (const doc of group.docs) {
      onDocumentDeleted?.(doc.id);
      removeTimelineDocFromQueue(doc.id);
      deleteDoc(doc.id);
      if (activeId === doc.id) setActiveId(null);
    }
  };

  const selectObject = (objectId) => {
    setObjectMenuId(null);
    setSelectedObjectId(objectId);
    setFilterObjectId(objectId);
    setActiveId(objectId);
    // Import Object pin keeps Dashboard/Timeline on the held host while browsing.
    const heldId = useObjectTargetHoldStore.getState().heldObjectId;
    setCorpusTimelineAuthority(heldId || objectId);
  };

  const enterObjectWorkspace = (objectId) => {
    selectObject(objectId);
    setObjectWorkspaceActive(true);
    setPanelType("Documents");
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setShowCreate(false);
    setFolderOpen(false);
  };

  // Enter workspace when company is selected from selector (ensureCompanyObject).
  useEffect(() => {
    if (!requestEnterWorkspaceId || !objects[requestEnterWorkspaceId]) return;
    clearLeftPanelNavSnapshot();
    enterObjectWorkspace(requestEnterWorkspaceId);
    clearRequestEnterObjectWorkspace();
  }, [
    requestEnterWorkspaceId,
    objects,
    clearRequestEnterObjectWorkspace,
  ]);

  const openStepsLibraryFromToolbar = () => {
    const targetObjectId = filterObjectId || selectedObjectId;
    if (targetObjectId) {
      if (!objectWorkspaceActive) {
        enterObjectWorkspace(targetObjectId);
      } else {
        setPanelType("Documents");
      }
    } else {
      setPanelType("Documents");
    }
    openStepsLibraryView();
  };

  const openUrlTableFromToolbar = () => {
    const targetObjectId = filterObjectId || selectedObjectId;
    if (targetObjectId) {
      if (!objectWorkspaceActive) {
        enterObjectWorkspace(targetObjectId);
      }
      onOpenUrlTableForCompany?.(targetObjectId);
      return;
    }
    setPanelType("Documents");
  };

  const openPasswordTableFromToolbar = () => {
    const targetObjectId = filterObjectId || selectedObjectId;
    if (targetObjectId) {
      if (!objectWorkspaceActive) {
        enterObjectWorkspace(targetObjectId);
      }
      onOpenPasswordTableForCompany?.(targetObjectId);
      return;
    }
    setPanelType("Documents");
  };

  const openProductsFromToolbar = () => {
    const targetObjectId = filterObjectId || selectedObjectId;
    if (targetObjectId) {
      if (!objectWorkspaceActive) {
        enterObjectWorkspace(targetObjectId);
      }
      setClickFolderView("groups");
      return;
    }
    setPanelType("Documents");
  };

  const openCampaignFromToolbar = () => {
    const targetObjectId = filterObjectId || selectedObjectId;
    if (targetObjectId) {
      if (!objectWorkspaceActive) {
        enterObjectWorkspace(targetObjectId);
      }
      setClickFolderView("campaign");
      return;
    }
    setPanelType("Documents");
  };

  const openLazyTodosFromToolbar = () => {
    const targetObjectId = filterObjectId || selectedObjectId;
    if (targetObjectId) {
      if (!objectWorkspaceActive) {
        enterObjectWorkspace(targetObjectId);
      } else {
        setPanelType("Documents");
      }
    } else {
      setPanelType("Documents");
    }
    openLazyTodosView();
  };

  const handleOpenLazyTodoFromQueue = (item) => {
    onOpenLazyTodoItem?.(item);
  };

  const handleNewLazyTodoFromQueue = () => {
    onOpenNewLazyTodo?.(filterObjectId || selectedObjectId);
  };

  const handleNewStepPlaybookFromLibrary = () => {
    onOpenNewStepPlaybook?.(filterObjectId || selectedObjectId);
  };

  const handleRunPlaybookFromLibrary = (playbook) => {
    onRunStepPlaybook?.(playbook);
  };

  const handleDeleteStepPlaybookFromLibrary = ({ docId, blockId, docRemoved }) => {
    if (docRemoved) {
      onDocumentDeleted?.(docId);
    }
    onStepPlaybookRemoved?.({ docId, blockId });
    if (activeId === docId) setActiveId(null);
  };

  const exitObjectWorkspace = () => {
    setObjectWorkspaceActive(false);
    setPanelType("Objects");
    setClickFolderView(null);
    setPackImportActive(false);
    setSelectedObjectId(null);
    setFilterObjectId(null);
    setActiveId(null);
    const heldId = useObjectTargetHoldStore.getState().heldObjectId;
    setCorpusTimelineAuthority(heldId || null);
    setNodeSearch("");
    clearLeftPanelNavSnapshot();
  };

  const openDocumentsForObject = (objectId) => {
    enterObjectWorkspace(objectId);
  };

  const handlePackImported = ({ rootObjectId }) => {
    closePackImportView();
    if (rootObjectId) openDocumentsForObject(rootObjectId);
  };

  // Restore sidebar navigation after reload (panelType / company workspace / folder).
  // Wait until the target company exists in the store (hydrate may finish after first paint).
  useEffect(() => {
    if (leftPanelNavRestored) return;

    const snap = readLeftPanelNavSnapshot();
    if (!snap) {
      setLeftPanelNavRestored(true);
      return;
    }

    const rawObjectId = snap.selectedObjectId || snap.filterObjectId || null;
    const objectCount = Object.keys(objects || {}).length;

    if (rawObjectId && !objects[rawObjectId] && objectCount === 0) {
      // Hydrate still in flight — keep waiting.
      return;
    }

    const resolvedObjectId = resolveLeftPanelObjectId(rawObjectId, objects, {
      companyName,
      filterObjectId,
      selectedObjectId,
    });

    if (rawObjectId && !resolvedObjectId) {
      clearLeftPanelNavSnapshot();
      setSelectedObjectId(null);
      setFilterObjectId(null);
      setLeftPanelNavRestored(true);
      return;
    }

    if (rawObjectId && rawObjectId !== resolvedObjectId) {
      clearLeftPanelNavSnapshot();
    }

    const objectId = resolvedObjectId;

    const heldId = useObjectTargetHoldStore.getState().heldObjectId;
    const authorityId = (heldId && objects[heldId]) ? heldId : objectId;

    if (snap.objectWorkspaceActive && objectId && objects[objectId]) {
      setSelectedObjectId(objectId);
      setFilterObjectId(objectId);
      setCorpusTimelineAuthority(authorityId);
      setObjectWorkspaceActive(true);
      const nextPanel = ["Documents", "Nodes", "Objects"].includes(snap.panelType)
        ? snap.panelType
        : "Documents";
      setPanelType(nextPanel);
      if (typeof snap.clickFolderView === "string" || snap.clickFolderView === null) {
        setClickFolderView(snap.clickFolderView);
      }
    } else if (objectId && objects[objectId]) {
      setSelectedObjectId(objectId);
      setFilterObjectId(objectId);
      setCorpusTimelineAuthority(authorityId);
    }

    setLeftPanelNavRestored(true);
  }, [
    leftPanelNavRestored,
    objects,
    companyName,
    filterObjectId,
    selectedObjectId,
    setSelectedObjectId,
    setFilterObjectId,
  ]);

  // If hydrate never yields the saved company, stop waiting so nav can persist again.
  useEffect(() => {
    if (leftPanelNavRestored) return undefined;
    const timer = window.setTimeout(() => {
      const snap = readLeftPanelNavSnapshot();
      if (!snap) {
        setLeftPanelNavRestored(true);
        return;
      }
      const rawObjectId = snap.selectedObjectId || snap.filterObjectId || null;
      const resolvedObjectId = resolveLeftPanelObjectId(rawObjectId, objects, {
        companyName,
        filterObjectId,
        selectedObjectId,
      });
      if (resolvedObjectId && objects[resolvedObjectId]) {
        setSelectedObjectId(resolvedObjectId);
        setFilterObjectId(resolvedObjectId);
        if (snap.objectWorkspaceActive) {
          setObjectWorkspaceActive(true);
          const nextPanel = ["Documents", "Nodes", "Objects"].includes(snap.panelType)
            ? snap.panelType
            : "Documents";
          setPanelType(nextPanel);
          if (typeof snap.clickFolderView === "string" || snap.clickFolderView === null) {
            setClickFolderView(snap.clickFolderView);
          }
        }
      } else if (rawObjectId) {
        clearLeftPanelNavSnapshot();
        setSelectedObjectId(null);
        setFilterObjectId(null);
      }
      setLeftPanelNavRestored(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [
    leftPanelNavRestored,
    objects,
    companyName,
    filterObjectId,
    selectedObjectId,
    setSelectedObjectId,
    setFilterObjectId,
  ]);

  // Persist sidebar navigation so reload does not bounce back to Company root.
  useEffect(() => {
    if (!leftPanelNavRestored) return;
    writeLeftPanelNavSnapshot({
      panelType,
      objectWorkspaceActive,
      filterObjectId,
      selectedObjectId,
      clickFolderView,
    });
  }, [
    leftPanelNavRestored,
    panelType,
    objectWorkspaceActive,
    filterObjectId,
    selectedObjectId,
    clickFolderView,
  ]);

  useEffect(() => {
    if (!objectWorkspaceActive && panelType !== "Objects") {
      setPanelType("Objects");
    }
  }, [objectWorkspaceActive, panelType]);

  useEffect(() => {
    if (!objectMenuId) return;
    const closeMenu = (e) => {
      if (e.target.closest?.(".obj-thumb-cell")) return;
      setObjectMenuId(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [objectMenuId]);

  const switchType = (t) => {
    if (!objectWorkspaceActive && t !== "Objects") return;
    if (objectWorkspaceActive && activeObjectId) {
      setFilterObjectId(activeObjectId);
    }
    setPanelType(t);
    setActiveId(null);
    setClickFolderView(null);
    setFolderOpen(false);
  };

  useEffect(() => {
    if (!leftPanelNavigateRequest || !objectWorkspaceActive) return;

    const { panel, docId = null, nodeId = null } = leftPanelNavigateRequest;

    if (panel === "Nodes") {
      switchType("Nodes");
      if (nodeId) setActiveId(nodeId);
    } else if (panel === "Documents" && docId) {
      switchType("Documents");
      setClickFolderView(null);
      handleOpenFolderDoc(docId);
    }

    clearLeftPanelNavigateRequest();
  }, [leftPanelNavigateRequest, objectWorkspaceActive, clearLeftPanelNavigateRequest]);

  const handleDeleteObject = async (objectId) => {
    const obj = objects[objectId];
    if (!obj) return;
    const docCount = getDocsByObject(objectId).length;
    const confirmed = await askConfirm({
      title: t("sidebar.deleteObjectTitle"),
      message: docCount > 0
        ? t("sidebar.deleteObjectWithDocs", { name: obj.name, count: docCount })
        : t("sidebar.deleteObjectEmpty", { name: obj.name }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    deleteObjectWithCascade(objectId);
    if (activeId === objectId) setActiveId(null);
    if (filterObjectId === objectId) setFilterObjectId(null);
    if (selectedObjectId === objectId) setSelectedObjectId(null);
    if (editObjectId === objectId) setEditObjectId(null);
    if (objectWorkspaceActive && activeObjectId === objectId) {
      exitObjectWorkspace();
    }
  };

  const handleUpdateObject = (data) => {
    if (!editObjectId) return;
    updateObject(editObjectId, {
      name: data.name,
      brand: data.brand,
      description: data.description,
    });
    setEditObjectId(null);
  };

  const handleCreate = async (data) => {
    if (panelType === "Objects") {
      if (planProfile.plan === "free" && Object.keys(objects).length >= FREE_LIMITS.maxObjects) {
        showUpgradeModal("object_limit");
        return;
      }
      const newObjectId = addObject(data.name, data.description, data.color, data.brand);
      if (newObjectId) {
        setActiveId(newObjectId);
      }
    } else if (panelType === "Documents") {
      const parentId = data.parentObjectId || null;
      const isCampaignFolder = Boolean(data.campaignActive);
      const newDocId = addDoc(
        data.title,
        parentId,
        [],
        data.tags || [],
        data.body ?? "",
        data.createdAt,
        data.blocks ?? null,
        {
          docKind: data.docKind ?? "standard",
          templateKind: data.templateKind ?? null,
          templateSubcategoryDocIds: data.subcategoryDocIds ?? data.templateSubcategoryDocIds ?? [],
          subcategoryDocIds: data.subcategoryDocIds ?? data.templateSubcategoryDocIds ?? [],
          version: data.version ?? "",
          category: data.category ?? "",
          icon: typeof data.icon === "string" ? data.icon : "",
          // Campaign folders: Launch lives on child docs only.
          launchAt: isCampaignFolder
            ? null
            : (data.launchAt ?? data.scheduleStartAt ?? null),
          scheduleStartAt: isCampaignFolder
            ? null
            : (data.scheduleStartAt ?? data.launchAt ?? null),
          scheduleFinishAt: isCampaignFolder
            ? null
            : (data.scheduleFinishAt
              ?? data.scheduleStartAt
              ?? data.launchAt
              ?? null),
          campaignActive: isCampaignFolder,
          nodeLinkColor: data.nodeLinkColor ?? "dark",
          knowledgeImport: data.knowledgeImport ?? null,
        },
      );
      if (newDocId && data.blocks?.length) {
        linkBlockNodesToDoc(data.blocks, newDocId);
      }
      setActiveId(null);
      setShowCreate(false);
      if (newDocId) {
        console.log("[folder sync] created", newDocId, "— flushing to cloud");
        try {
          const flush = await flushPersistenceSync();
          if (!flush?.ok) {
            console.warn("[folder sync] flush failed", newDocId, flush?.reason || flush);
            onNotify?.(
              "No se pudo guardar en la nube. El folder quedó local; no cierres sesión hasta que sync OK.",
              "warm",
            );
          } else {
            console.log("[folder sync] flush ok", newDocId);
          }
        } catch (err) {
          console.warn("[folder sync] flush threw", newDocId, err?.message || err);
          onNotify?.(
            "No se pudo guardar en la nube. El folder quedó local; no cierres sesión hasta que sync OK.",
            "warm",
          );
        }
      }
      if (newDocId && onOpenDocument) {
        onOpenDocument(newDocId);
      }
      return;
    }
    setShowCreate(false);
  };

  const dropdownPanelTypes = objectWorkspaceActive ? PANEL_TYPES : ["Objects"];
  const folderLabel = objectWorkspaceActive
    ? `${panelTypeLabel(panelType).toLowerCase()} : ${activeObject?.name || ""}`
    : panelTypeLabel("Objects").toLowerCase();

  const handleNewByFolder = () => {
    if (!objectWorkspaceActive && panelType !== "Objects") return;
    if (objectWorkspaceActive && (panelType === "Documents" || panelType === "Nodes") && !activeObjectId) return;
    if (panelType === "Documents" && !clickFolderView) return;
    if (panelType === "Nodes") {
      openCreateDocument(null);
      return;
    }
    setShowCreate(true);
    setFolderOpen(false);
  };

  const newDisabled =
    (!objectWorkspaceActive && panelType !== "Objects")
    || (objectWorkspaceActive && (panelType === "Documents" || panelType === "Nodes") && !activeObjectId)
    || (panelType === "Documents" && !clickFolderView);
  const docCreateMode = clickFolderView === "groups"
    ? "product"
    : clickFolderView === "knowledge"
      ? "knowledge"
      : clickFolderView === "campaign"
        ? "campaign"
        : "content";

  return (
    <div className="left-panel">

      {/* ── Selector row ── */}
      <div className="lp-selectors">
        <Dropdown
          label={
            <span className="lp-folder-trigger">
              <FolderTypeIcon panelType={panelType} />
              <span className="lp-folder-trigger-label">{folderLabel}</span>
            </span>
          }
          open={folderOpen}
          onToggle={() => setFolderOpen((open) => !open)}
        >
          <div className="lp-dropdown-pane lp-dropdown-pane--types-only" role="group" aria-label="Panel type">
            {dropdownPanelTypes.map((type) => (
              <button
                key={type}
                type="button"
                role="menuitem"
                className={
                  "lp-dropdown-item lp-dropdown-item--type"
                  + (panelType === type ? " active" : "")
                }
                onClick={() => switchType(type)}
              >
                <SelectorTypeIcon type={type} />
                <span className="lp-item-label">{panelTypeLabel(type)}</span>
              </button>
            ))}
          </div>
        </Dropdown>

        <div className="lp-selector-actions">
          <button
            type="button"
            className="lp-new-btn"
            onClick={handleNewByFolder}
            disabled={newDisabled}
            title={newDisabled ? t("sidebar.openFolderFirst") : undefined}
            aria-label={t("sidebar.createNew", { type: panelTypeLabel(panelType).toLowerCase() })}
          >
            <span className="lp-new-label">{t("sidebar.newButton")}</span>
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="lp-content">

        {/* OBJECTS */}
        {panelType === "Objects" && (
          <>
            <div className="lp-workspace-head">
              {objectWorkspaceActive ? (
                <ClickFolderBack
                  inline
                  onBack={exitObjectWorkspace}
                  label={t("sidebar.allCompanies")}
                />
              ) : null}
              <PackActionsBar
                placement="objects"
                onOpenImport={() => {
                  setPanelType("Documents");
                  if (selectedObjectId || filterObjectId) {
                    setFilterObjectId(filterObjectId || selectedObjectId);
                    openPackImportView();
                  } else {
                    openPackImportView();
                  }
                }}
              />
            </div>
            <div className="lp-objects-grid">
              {filteredObjectList.map(obj => (
                <ObjectThumb
                  key={obj.id}
                  object={obj}
                  selected={objectWorkspaceActive && obj.id === activeObjectId}
                  menuOpen={obj.id === objectMenuId}
                  onEnter={() => enterObjectWorkspace(obj.id)}
                  onMenuOpen={() => setObjectMenuId(
                    (prev) => (prev === obj.id ? null : obj.id),
                  )}
                  onDelete={() => {
                    setObjectMenuId(null);
                    handleDeleteObject(obj.id);
                  }}
                  onEdit={() => {
                    setObjectMenuId(null);
                    setEditObjectId(obj.id);
                  }}
                />
              ))}
              {filteredObjectList.length === 0 && (
                <div className="lp-empty">
                  {!workspaceHydrated ? (
                    <p className="dim">{t("common.loading")}</p>
                  ) : (
                    <>
                      <p>{t("sidebar.noObjectsYet")}</p>
                      <p className="dim">{t("sidebar.createFirstModel")}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* DOCUMENTS — steps library without workspace */}
        {panelType === "Documents" && stepsLibraryActive && !objectWorkspaceActive ? (
          <StepsLibraryPanel
            objectId={filterObjectId}
            onClose={closeStepsLibraryView}
            onRunPlaybook={handleRunPlaybookFromLibrary}
            onNew={handleNewStepPlaybookFromLibrary}
            onPlaybookDeleted={handleDeleteStepPlaybookFromLibrary}
          />
        ) : null}

        {panelType === "Documents" && lazyTodosActive && !objectWorkspaceActive ? (
          <LazyTodoQueuePanel
            objectId={filterObjectId}
            onClose={closeLazyTodosView}
            onOpenItem={handleOpenLazyTodoFromQueue}
            onNew={handleNewLazyTodoFromQueue}
          />
        ) : null}

        {/* DOCUMENTS — click folder navigation */}
        {panelType === "Documents" && objectWorkspaceActive && (
          <div className="lp-click-folders-stack">
            {packImportActive ? (
              <ImportPackWizard
                mergeTargetObjectId={filterObjectId}
                onClose={closePackImportView}
                onImported={handlePackImported}
              />
            ) : null}

            {stepsLibraryActive ? (
              <StepsLibraryPanel
                objectId={filterObjectId}
                onClose={closeStepsLibraryView}
                onRunPlaybook={handleRunPlaybookFromLibrary}
                onNew={handleNewStepPlaybookFromLibrary}
                onPlaybookDeleted={handleDeleteStepPlaybookFromLibrary}
              />
            ) : null}

            {lazyTodosActive ? (
              <LazyTodoQueuePanel
                objectId={filterObjectId}
                onClose={closeLazyTodosView}
                onOpenItem={handleOpenLazyTodoFromQueue}
                onNew={handleNewLazyTodoFromQueue}
              />
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && clickFolderView === null ? (
              <>
                <div className="lp-workspace-head">
                  <ClickFolderBack
                    inline
                    onBack={exitObjectWorkspace}
                    label={t("sidebar.allCompanies")}
                  />
                  <PackActionsBar
                    placement="documents"
                    companySelected={Boolean(filterObjectId || activeObjectId)}
                    onOpenImport={openPackImportView}
                    onOpenStepsLibrary={openStepsLibraryFromToolbar}
                    onOpenLazyTodos={openLazyTodosFromToolbar}
                    onOpenUrlTable={openUrlTableFromToolbar}
                    onOpenPasswordTable={openPasswordTableFromToolbar}
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
                    onInsertGuide={handleInsertGuide}
                  />
                </div>
                <div className="lp-click-folders-stack__boxes">
                  <ClickFolderBox
                    variant="subgroups"
                    label={t("sidebar.clickFolderDocuments")}
                    onClick={() => setClickFolderView("subgroups")}
                  />
                  <ClickFolderBox
                    variant="knowledge"
                    label={t("sidebar.knowledge")}
                    onClick={() => setClickFolderView("knowledge")}
                  />
                  <ClickFolderBox
                    variant="agents"
                    label={t("sidebar.agents")}
                    onClick={() => setClickFolderView("agents")}
                  />
                </div>
              </>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && clickFolderView === "groups" ? (
              <div className="lp-click-folder-detail">
                <div className="lp-workspace-head">
                  <ClickFolderBack
                    iconOnly
                    inline
                    onBack={() => setClickFolderView(null)}
                    label={t("sidebar.products")}
                  />
                  <PackActionsBar
                    placement="documents"
                    companySelected={Boolean(filterObjectId || activeObjectId)}
                    onOpenImport={openPackImportView}
                    onOpenStepsLibrary={openStepsLibraryFromToolbar}
                    onOpenLazyTodos={openLazyTodosFromToolbar}
                    onOpenUrlTable={openUrlTableFromToolbar}
                    onOpenPasswordTable={openPasswordTableFromToolbar}
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
                    onInsertGuide={handleInsertGuide}
                    filterMode="category"
                    filterOptions={categoryFilterOptions}
                    filterValue={productCategoryFilter}
                    onFilterChange={setProductCategoryFilter}
                  />
                </div>
                <TimelineDocQueue
                  entries={timelineQueueEntries}
                  docs={docs}
                  objects={objects}
                  activeDocId={activeId}
                  onSelectDoc={handleSelectQueuedDoc}
                  onOpenDocument={onOpenDocument}
                  onDeleteDoc={handleDeleteDoc}
                />
                <div className="lp-click-folder-detail-list lp-doc-groups-stack">
                  {groupedProductDocs.length ? (
                    groupedProductDocs.map((group) => (
                      <DocGroupBlockCard
                        key={group.id}
                        groupLabel={group.label}
                        groupMeta={t("sidebar.docsInBlock", { count: group.docs.length })}
                        docs={group.docs}
                        onDeleteCategory={() => handleDeleteCategoryGroup(group)}
                        renderDoc={(doc) => (
                          <DocCompactRow
                            key={doc.id}
                            doc={doc}
                            active={activeId === doc.id}
                            onSelect={() => handleSelectFolderDoc(doc.id)}
                            onOpen={() => handleOpenFolderDoc(doc.id)}
                            onDelete={() => handleDeleteDoc(doc)}
                          />
                        )}
                      />
                    ))
                  ) : (
                    <div className="lp-empty">
                      <p className="dim">
                        {productCategoryFilter
                          ? t("sidebar.noProductsInCategory")
                          : t("sidebar.noProductsYet")}
                      </p>
                      <p className="dim">
                        {productCategoryFilter
                          ? t("sidebar.clearCategoryFilter")
                          : t("sidebar.useNewProduct")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && clickFolderView === "campaign" ? (
              <div className="lp-click-folder-detail">
                <div className="lp-workspace-head">
                  <ClickFolderBack
                    iconOnly
                    inline
                    onBack={() => setClickFolderView(null)}
                    label={t("sidebar.campaign")}
                  />
                  <div className="lp-folder-density" role="group" aria-label={t("sidebar.folderDensityLabel")}>
                    <button
                      type="button"
                      className={
                        "lp-folder-density__btn lp-folder-select-btn"
                        + (folderBulkDeleteMode ? " is-active" : "")
                      }
                      onClick={toggleFolderBulkDeleteMode}
                      title={
                        folderBulkDeleteMode
                          ? t("sidebar.folderSelectDeleteActive")
                          : t("sidebar.folderSelectDeleteTitle")
                      }
                      aria-label={t("sidebar.folderSelectDeleteTitle")}
                      aria-pressed={folderBulkDeleteMode}
                    >
                      {t("sidebar.folderSelectDelete")}
                    </button>
                    <button
                      type="button"
                      className="lp-folder-density__btn"
                      onClick={densifyFolderList}
                      disabled={folderDensity === "compact"}
                      title={t("sidebar.folderDensityZoomOut")}
                      aria-label={t("sidebar.folderDensityZoomOut")}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="lp-folder-density__btn"
                      onClick={expandFolderList}
                      disabled={folderDensity === "comfortable"}
                      title={t("sidebar.folderDensityZoomIn")}
                      aria-label={t("sidebar.folderDensityZoomIn")}
                    >
                      +
                    </button>
                  </div>
                  <PackActionsBar
                    placement="documents"
                    companySelected={Boolean(filterObjectId || activeObjectId)}
                    onOpenImport={openPackImportView}
                    onOpenStepsLibrary={openStepsLibraryFromToolbar}
                    onOpenLazyTodos={openLazyTodosFromToolbar}
                    onOpenUrlTable={openUrlTableFromToolbar}
                    onOpenPasswordTable={openPasswordTableFromToolbar}
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
                    onInsertGuide={handleInsertGuide}
                    filterMode="category"
                    filterOptions={campaignCategoryFilterOptions}
                    filterValue={productCategoryFilter}
                    onFilterChange={setProductCategoryFilter}
                  />
                </div>
                <div className="lp-library-toolbar lp-folder-search-toolbar">
                  <div className="lp-library-search-wrap">
                    <span className="lp-library-search-icon" aria-hidden />
                    <input
                      type="search"
                      className="lp-library-search"
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      placeholder={t("sidebar.folderSearchPlaceholder")}
                      aria-label={t("sidebar.folderSearchPlaceholder")}
                    />
                  </div>
                </div>
                {folderBulkDeleteMode ? (
                  <div className="lp-folder-bulk-bar" role="status">
                    <span className="lp-folder-bulk-bar__count">
                      {t("sidebar.folderSelectDeleteCount", { count: selectedFolderIds.length })}
                    </span>
                    <div className="lp-folder-bulk-bar__actions">
                      <button
                        type="button"
                        className="btn xs ghost"
                        onClick={exitFolderBulkDeleteMode}
                      >
                        {t("sidebar.folderSelectDeleteDone")}
                      </button>
                      <button
                        type="button"
                        className="btn xs lp-folder-bulk-bar__delete"
                        disabled={selectedFolderIds.length === 0}
                        onClick={handleDeleteSelectedFolders}
                      >
                        {t("sidebar.folderSelectDeleteAction")}
                      </button>
                    </div>
                  </div>
                ) : null}
                <TimelineDocQueue
                  entries={timelineQueueEntries}
                  docs={docs}
                  objects={objects}
                  activeDocId={activeId}
                  onSelectDoc={handleSelectQueuedDoc}
                  onOpenDocument={onOpenDocument}
                  onDeleteDoc={handleDeleteDoc}
                />
                <div
                  className={
                    "lp-click-folder-detail-list lp-doc-nodes-stack"
                    + (folderDensity === "compact" ? " lp-doc-nodes-stack--compact" : "")
                    + (folderBulkDeleteMode ? " lp-doc-nodes-stack--selecting" : "")
                  }
                >
                  {visibleCampaignDocs.length ? (
                    visibleCampaignDocs.map((doc) => (
                      <DocNodesBlockCard
                        key={doc.id}
                        doc={doc}
                        nodes={nodesByDocId.get(doc.id) || []}
                        objects={objects}
                        showWhenEmpty
                        selectMode={folderBulkDeleteMode}
                        selected={selectedFolderIds.includes(doc.id)}
                        onToggleSelect={toggleFolderSelect}
                        onOpenDoc={() => handleOpenFolderDoc(doc.id)}
                        onCreateDocument={() => openCreateDocument(doc)}
                        onDeleteBox={() => handleDeleteDoc(doc)}
                        onNodeClick={(node) => {
                          setActiveId(node.id);
                          setNodeEditContentFocus(false);
                          setNodeEditId(node.id);
                        }}
                        onNodeInsert={(node) => onInsertToCanvas?.(node)}
                        onNodeDelete={handleDeleteNode}
                      />
                    ))
                  ) : (
                    <div className="lp-empty">
                      <p className="dim">
                        {folderSearchNeedle
                          ? t("sidebar.noFoldersMatch")
                          : productCategoryFilter
                            ? t("sidebar.noCampaignsInCategory")
                            : t("sidebar.noCampaignsYet")}
                      </p>
                      <p className="dim">
                        {folderSearchNeedle
                          ? t("sidebar.noFoldersMatchHint")
                          : productCategoryFilter
                            ? t("sidebar.clearCategoryFilter")
                            : t("sidebar.useNewCampaign")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && clickFolderView === "knowledge" ? (
              <div className="lp-click-folder-detail">
                <ClickFolderBack
                  iconOnly
                  onBack={() => setClickFolderView(null)}
                  label={t("sidebar.knowledgeTitle")}
                />
                <div className="lp-click-folder-detail-list lp-doc-groups-stack">
                  {knowledgeDocs.length ? (
                    <article className="lp-doc-nodes-block lp-doc-nodes-block--docs">
                      <div className="lp-doc-nodes-block__body lp-doc-nodes-block__body--docs lp-doc-nodes-block__body--docs-flat">
                        {knowledgeDocs.map((doc) => (
                          <DocCompactRow
                            key={doc.id}
                            doc={doc}
                            active={activeId === doc.id}
                            onSelect={() => handleSelectFolderDoc(doc.id)}
                            onOpen={() => handleOpenFolderDoc(doc.id)}
                            onDelete={() => handleDeleteDoc(doc)}
                          />
                        ))}
                      </div>
                    </article>
                  ) : (
                    <div className="lp-empty">
                      <p className="dim">{t("sidebar.noKnowledgeYet")}</p>
                      <p className="dim">{t("sidebar.useNewKnowledge")}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && clickFolderView === "agents" ? (
              <div className="lp-click-folder-detail">
                <ClickFolderBack
                  iconOnly
                  onBack={() => setClickFolderView(null)}
                  label={t("sidebar.agentsTitle")}
                />
                <div className="lp-click-folder-detail-list">
                  {canvasAgents.map((agent) => (
                    <AgentListCard
                      key={agent.id}
                      agent={agent}
                      onInsert={(agentId) => onInsertAgent?.(agentId)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && clickFolderView === "subgroups" ? (
              <div className="lp-click-folder-detail">
                <div className="lp-workspace-head">
                  <ClickFolderBack
                    iconOnly
                    inline
                    onBack={() => setClickFolderView(null)}
                    label={t("sidebar.content")}
                  />
                  <div className="lp-folder-density" role="group" aria-label={t("sidebar.folderDensityLabel")}>
                    <button
                      type="button"
                      className={
                        "lp-folder-density__btn lp-folder-select-btn"
                        + (folderBulkDeleteMode ? " is-active" : "")
                      }
                      onClick={toggleFolderBulkDeleteMode}
                      title={
                        folderBulkDeleteMode
                          ? t("sidebar.folderSelectDeleteActive")
                          : t("sidebar.folderSelectDeleteTitle")
                      }
                      aria-label={t("sidebar.folderSelectDeleteTitle")}
                      aria-pressed={folderBulkDeleteMode}
                    >
                      {t("sidebar.folderSelectDelete")}
                    </button>
                    <button
                      type="button"
                      className="lp-folder-density__btn"
                      onClick={densifyFolderList}
                      disabled={folderDensity === "compact"}
                      title={t("sidebar.folderDensityZoomOut")}
                      aria-label={t("sidebar.folderDensityZoomOut")}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="lp-folder-density__btn"
                      onClick={expandFolderList}
                      disabled={folderDensity === "comfortable"}
                      title={t("sidebar.folderDensityZoomIn")}
                      aria-label={t("sidebar.folderDensityZoomIn")}
                    >
                      +
                    </button>
                  </div>
                  <PackActionsBar
                    placement="documents"
                    companySelected={Boolean(filterObjectId || activeObjectId)}
                    onOpenImport={openPackImportView}
                    onOpenStepsLibrary={openStepsLibraryFromToolbar}
                    onOpenLazyTodos={openLazyTodosFromToolbar}
                    onOpenUrlTable={openUrlTableFromToolbar}
                    onOpenPasswordTable={openPasswordTableFromToolbar}
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
                    onInsertGuide={handleInsertGuide}
                  />
                </div>
                <div className="lp-library-toolbar lp-folder-search-toolbar">
                  <div className="lp-library-search-wrap">
                    <span className="lp-library-search-icon" aria-hidden />
                    <input
                      type="search"
                      className="lp-library-search"
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      placeholder={t("sidebar.folderSearchPlaceholder")}
                      aria-label={t("sidebar.folderSearchPlaceholder")}
                    />
                  </div>
                </div>
                {folderBulkDeleteMode ? (
                  <div className="lp-folder-bulk-bar" role="status">
                    <span className="lp-folder-bulk-bar__count">
                      {t("sidebar.folderSelectDeleteCount", { count: selectedFolderIds.length })}
                    </span>
                    <div className="lp-folder-bulk-bar__actions">
                      <button
                        type="button"
                        className="btn xs ghost"
                        onClick={exitFolderBulkDeleteMode}
                      >
                        {t("sidebar.folderSelectDeleteDone")}
                      </button>
                      <button
                        type="button"
                        className="btn xs lp-folder-bulk-bar__delete"
                        disabled={selectedFolderIds.length === 0}
                        onClick={handleDeleteSelectedFolders}
                      >
                        {t("sidebar.folderSelectDeleteAction")}
                      </button>
                    </div>
                  </div>
                ) : null}
                <TimelineDocQueue
                  entries={timelineQueueEntries}
                  docs={docs}
                  objects={objects}
                  activeDocId={activeId}
                  onSelectDoc={handleSelectQueuedDoc}
                  onOpenDocument={onOpenDocument}
                  onDeleteDoc={handleDeleteDoc}
                />
                <div
                  className={
                    "lp-click-folder-detail-list lp-doc-nodes-stack"
                    + (folderDensity === "compact" ? " lp-doc-nodes-stack--compact" : "")
                    + (folderBulkDeleteMode ? " lp-doc-nodes-stack--selecting" : "")
                  }
                >
                  {visibleContentDocs.length || visibleUncategorizedDocs.length ? (
                    <>
                      {visibleContentDocs.map((doc) => (
                        <DocNodesBlockCard
                          key={doc.id}
                          doc={doc}
                          nodes={nodesByDocId.get(doc.id) || []}
                          objects={objects}
                          showWhenEmpty
                          selectMode={folderBulkDeleteMode}
                          selected={selectedFolderIds.includes(doc.id)}
                          onToggleSelect={toggleFolderSelect}
                          onOpenDoc={() => handleOpenFolderDoc(doc.id)}
                          onCreateDocument={() => openCreateDocument(doc)}
                          onDeleteBox={() => handleDeleteDoc(doc)}
                          onNodeClick={(node) => {
                            setActiveId(node.id);
                            setNodeEditContentFocus(false);
                            setNodeEditId(node.id);
                          }}
                          onNodeInsert={(node) => onInsertToCanvas?.(node)}
                          onNodeDelete={handleDeleteNode}
                        />
                      ))}
                      {visibleUncategorizedDocs.map((doc) => (
                        <DocNodesBlockCard
                          key={doc.id}
                          doc={doc}
                          nodes={nodesByDocId.get(doc.id) || []}
                          objects={objects}
                          showWhenEmpty
                          selectMode={folderBulkDeleteMode}
                          selected={selectedFolderIds.includes(doc.id)}
                          onToggleSelect={toggleFolderSelect}
                          onOpenDoc={() => handleOpenFolderDoc(doc.id)}
                          onCreateDocument={() => openCreateDocument(doc)}
                          onDeleteBox={() => handleDeleteDoc(doc)}
                          onNodeClick={(node) => {
                            setActiveId(node.id);
                            setNodeEditContentFocus(false);
                            setNodeEditId(node.id);
                          }}
                          onNodeInsert={(node) => onInsertToCanvas?.(node)}
                          onNodeDelete={handleDeleteNode}
                        />
                      ))}
                    </>
                  ) : (
                    <div className="lp-empty">
                      <p className="dim">
                        {folderSearchNeedle
                          ? t("sidebar.noFoldersMatch")
                          : contentProductFilter
                            ? t("sidebar.noContentForProduct")
                            : filterObjectId && getDocsByObject(filterObjectId).length > 0
                              ? t("sidebar.noContentUncategorized", {
                                count: getDocsByObject(filterObjectId).length,
                              })
                              : t("sidebar.noContentYet")}
                      </p>
                      <p className="dim">
                        {folderSearchNeedle
                          ? t("sidebar.noFoldersMatchHint")
                          : contentProductFilter
                            ? t("sidebar.clearContentFilter")
                            : t("sidebar.useNewContent")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Independent Documents — parentless docs for this corpus only */}
        {panelType === "Nodes" && objectWorkspaceActive && !nodeEditId && (
          <>
            <input
              type="text"
              className="note-form-field"
              placeholder={t("sidebar.searchNodesPlaceholder")}
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
            />
            {objectWorkspaceActive && activeObject ? (
              <p className="lp-context-label"><TranslatedText text={activeObject.name} /></p>
            ) : null}
            <div className="lp-doc-nodes-stack">
              <DocNodesBlockCard
                doc={null}
                orphan
                nodes={filteredIndependentNodes}
                objects={objects}
                showWhenEmpty
                defaultExpanded
                onNodeClick={(node) => {
                  setActiveId(node.id);
                  setNodeEditContentFocus(false);
                  setNodeEditId(node.id);
                }}
                onNodeInsert={(node) => onInsertToCanvas?.(node)}
                onNodeDelete={handleDeleteNode}
              />
            </div>
          </>
        )}

      </div>

      {/* ── Footer: plan usage ── */}
      <div className="lp-footer">
        <PlanUsagePanel compact />
      </div>

      {/* ── Create modals ── */}
      {showCreate && panelType === "Objects" && (
        <ObjectCreateModal onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}
      {editObjectId && objects[editObjectId] && (
        <ObjectCreateModal
          initial={objects[editObjectId]}
          onSubmit={handleUpdateObject}
          onCancel={() => setEditObjectId(null)}
        />
      )}
      {showCreate && panelType === "Documents" && typeof document !== "undefined" && createPortal(
        <DocCreateModal
          objects={objList}
          allDocs={docs}
          defaultParentId={filterObjectId || ""}
          createMode={docCreateMode}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          onOpenDocument={onOpenDocument}
          onInsertToCanvas={onInsertToCanvas}
        />,
        document.body,
      )}
      {showCreate && panelType === "Nodes" && typeof document !== "undefined" && createPortal(
        <StandaloneNodeModal
          docs={docList}
          parentObjectId={activeObjectId}
          onClose={() => setShowCreate(false)}
          onSaved={(entity) => {
            setShowCreate(false);
            if (entity) onInsertToCanvas?.(entity);
          }}
        />,
        document.body,
      )}
      {showCreateDocument && typeof document !== "undefined" && createPortal(
        <StandaloneNodeModal
          docs={docList}
          parentObjectId={activeObjectId}
          initialParentDocId={createDocumentParentDocId}
          onClose={() => {
            setShowCreateDocument(false);
            setCreateDocumentParentDocId(null);
          }}
          onSaved={handleDocumentCreated}
        />,
        document.body,
      )}
      {nodeEditId && nodes[nodeEditId] && typeof document !== "undefined" && createPortal(
        <StandaloneNodeModal
          node={nodes[nodeEditId]}
          docs={docList}
          parentObjectId={activeObjectId}
          onClose={() => {
            setNodeEditId(null);
            setNodeEditContentFocus(false);
            setActiveId(null);
          }}
          initialContentFocus={nodeEditContentFocus}
          onSaved={() => {}}
          onDeleted={(id) => {
            deleteNode(id);
            setNodeEditId(null);
            setActiveId(null);
          }}
        />,
        document.body,
      )}
    </div>
  );
}
