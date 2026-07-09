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
import { DATA_TYPE_ICONS, DATA_TYPE_ICON_ASSETS, NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { getAgentsForUser, AGENT_MARKETING_GUIDE } from "../../lib/agents/registry.js";
import { useAuthStore } from "../../stores/authStore.js";
import { AgentListCard } from "../agents/AgentListCard.jsx";
import { ObjectThumbPreview } from "./objectIcons.jsx";
import { isoFromDateInput, todayDateInputValue } from "../../lib/docDates.js";
import { DocDocumentBox } from "../docs/DocDocumentBox.jsx";
import { DocListTitle } from "../docs/DocListTitle.jsx";
import { docBlocksToBody } from "../../lib/docBlocks.js";
import { useDocBlockNodeModal, linkBlockNodesToDoc } from "../docs/useDocBlockNodeModal.jsx";
import { StandaloneNodeModal } from "../nodes/StandaloneNodeModal.jsx";
import {
  isTemplateDoc,
  isKnowledgeDoc,
  findProductVersionDoc,
  formatProductDocTitle,
  listProductDocs,
  listContentDocs,
  listKnowledgeDocs,
  resolveProductDocDisplayTitle,
  resolveKnowledgeDocDisplayTitle,
} from "../../lib/templateDoc.js";
import { buildTimelineQueueEntries } from "../../lib/timelineSelection.js";
import {
  buildCategoryFilterOptions,
  contentDocMatchesProductFilter,
  productDocMatchesCategoryFilter,
} from "../../lib/contentProductFilter.js";
import {
  groupContentDocsForSidebar,
  groupProductDocsFromList,
} from "../../lib/docListGrouping.js";
import { DocGroupBlockCard } from "./DocGroupBlockCard.jsx";
import { PlanUsagePanel } from "../plans/PlanUsagePanel.jsx";
import { PackActionsBar } from "../packs/PackActionsBar.jsx";
import { ImportPackWizard } from "../packs/ImportPackWizard.jsx";
import { StepsLibraryPanel } from "../steps/StepsLibraryPanel.jsx";
import { UrlTableLibraryPanel } from "../urltable/UrlTableLibraryPanel.jsx";
import { LazyTodoQueuePanel } from "../lazyTodos/LazyTodoQueuePanel.jsx";
import { TranslatedText } from "../shared/TranslatedText.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { PANEL_TYPES, usePanelTypeLabels } from "../../i18n/panelTypes.js";

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
  Documents: "/uploads/botones/docs.svg",
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

  if (variant === "groups") {
    return (
      <svg className={className} viewBox="98 83 26 22" fill="none" aria-hidden>
        <path fill="currentColor" d={CLICK_FOLDER_ICON_PATH} />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="97 58 28 47" fill="none" aria-hidden>
      <path fill="currentColor" d={CLICK_FOLDER_ICON_PATH} />
      <path
        fill="currentColor"
        d="M104.39 62.2035C104.327 62.0168 104.208 61.8544 104.048 61.7393C103.889 61.6242 103.697 61.5623 103.5 61.5623C103.303 61.5623 103.111 61.6242 102.952 61.7393C102.792 61.8544 102.673 62.0168 102.611 62.2035L97.9231 76.266C97.8761 76.407 97.8633 76.557 97.8857 76.7039C97.9081 76.8507 97.9651 76.9902 98.052 77.1107C98.1388 77.2312 98.2531 77.3293 98.3853 77.397C98.5176 77.4647 98.664 77.5 98.8126 77.5H108.188C108.336 77.5 108.483 77.4647 108.615 77.397C108.747 77.3293 108.861 77.2312 108.948 77.1107C109.035 76.9902 109.092 76.8507 109.114 76.7039C109.137 76.557 109.124 76.407 109.077 76.266L104.39 62.2035ZM100.113 75.625L103.5 65.4648L106.887 75.625H100.113ZM120.375 63.9063C120.375 62.701 120.018 61.5229 119.348 60.5207C118.678 59.5186 117.727 58.7376 116.613 58.2764C115.5 57.8151 114.275 57.6945 113.092 57.9296C111.91 58.1647 110.825 58.7451 109.972 59.5973C109.12 60.4495 108.54 61.5353 108.305 62.7174C108.07 63.8995 108.19 65.1247 108.651 66.2382C109.113 67.3517 109.894 68.3034 110.896 68.973C111.898 69.6426 113.076 70 114.281 70C115.897 69.9981 117.446 69.3555 118.588 68.2131C119.731 67.0707 120.373 65.5218 120.375 63.9063ZM110.063 63.9063C110.063 63.0719 110.31 62.2562 110.774 61.5624C111.237 60.8687 111.896 60.3279 112.667 60.0086C113.438 59.6893 114.286 59.6058 115.104 59.7686C115.923 59.9313 116.674 60.3331 117.264 60.9231C117.854 61.5131 118.256 62.2649 118.419 63.0832C118.582 63.9016 118.498 64.7498 118.179 65.5207C117.86 66.2916 117.319 66.9505 116.625 67.414C115.931 67.8776 115.116 68.125 114.281 68.125C113.162 68.125 112.089 67.6805 111.298 66.8894C110.507 66.0982 110.063 65.0251 110.063 63.9063ZM122.25 71.875H111.938C111.689 71.875 111.45 71.9738 111.275 72.1496C111.099 72.3254 111 72.5639 111 72.8125V79.375C111 79.6236 111.099 79.8621 111.275 80.0379C111.45 80.2137 111.689 80.3125 111.938 80.3125H122.25C122.499 80.3125 122.737 80.2137 122.913 80.0379C123.089 79.8621 123.188 79.6236 123.188 79.375V72.8125C123.188 72.5639 123.089 72.3254 122.913 72.1496C122.737 71.9738 122.499 71.875 122.25 71.875ZM121.313 78.4375H112.875V73.75H121.313V78.4375Z"
      />
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
              ↗
            </span>
          </div>
          <span className="fn-card-meta">
            {isTemplate ? t("sidebar.docTemplatePrefix") : ""}
            {isKnowledge
              ? (doc.knowledgeImport?.fileName ? t("sidebar.docMetaKnowledgeFile") : t("sidebar.docMetaKnowledge"))
              : parent ? `↳ ${parent.name}` : t("common.noParent")}
            {" · "}{t("sidebar.nodesInBlock", { count: (doc.nodeIds || []).length })}
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

function NodeCompactRow({ node, onClick, onInsert, onDelete }) {
  const { t } = useI18n();
  const icon = DATA_TYPE_ICONS[node.dataType] || "◯";
  const iconAsset = DATA_TYPE_ICON_ASSETS[node.dataType] || null;
  const displayTitle = getNodeDisplayTitle(node);

  return (
    <div className="lp-doc-nodes-block__node">
      <button
        type="button"
        className="lp-doc-nodes-block__node-main"
        onClick={onClick}
        title={displayTitle}
      >
        <span className="lp-node-type-icon lp-node-type-icon--compact">
          {iconAsset ? (
            <img src={iconAsset} alt="" aria-hidden className="lp-node-type-icon-img" />
          ) : (
            icon
          )}
        </span>
        <span className="lp-doc-nodes-block__node-title">{displayTitle}</span>
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
  defaultExpanded = true,
  orphan = false,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const parent = doc?.parentObjectId ? objects[doc.parentObjectId] : null;
  const isKnowledge = doc ? isKnowledgeDoc(doc) : false;
  const isTemplate = doc ? isTemplateDoc(doc) : false;
  const displayTitle = orphan
    ? t("sidebar.unlinkedNodes")
    : isKnowledge
      ? resolveKnowledgeDocDisplayTitle(doc)
      : resolveProductDocDisplayTitle(doc);

  if (!nodes.length) return null;

  return (
    <article className={"lp-doc-nodes-block" + (orphan ? " lp-doc-nodes-block--orphan" : "")}>
      <div className="lp-doc-nodes-block__head">
        <button
          type="button"
          className="lp-doc-nodes-block__head-main"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {!orphan ? (
            <span className="lp-doc-icon">
              <img src="/uploads/botones/docs.svg" alt="" aria-hidden className="lp-item-icon-img" />
            </span>
          ) : (
            <span className="lp-doc-icon">
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
              {!orphan ? (
                <span
                  className="lp-expand-btn"
                  role="button"
                  tabIndex={0}
                  aria-label={t("sidebar.openDocument")}
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
                  ↗
                </span>
              ) : null}
            </div>
            <span className="fn-card-meta">
              {t("sidebar.nodesInBlock", { count: nodes.length })}
              {!orphan && isTemplate ? " · template" : ""}
              {!orphan && isKnowledge
                ? (doc.knowledgeImport?.fileName ? " · file imported" : " · knowledge")
                : ""}
              {!orphan && parent ? ` · ↳ ${parent.name}` : ""}
            </span>
          </div>
          <span className="lp-doc-nodes-block__chevron" aria-hidden>{expanded ? "▾" : "▸"}</span>
        </button>
      </div>
      {expanded ? (
        <div className="lp-doc-nodes-block__body">
          {nodes.map((node) => (
            <NodeCompactRow
              key={node.id}
              node={node}
              onClick={() => onNodeClick?.(node)}
              onInsert={() => onNodeInsert?.(node)}
              onDelete={() => onNodeDelete?.(node)}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function groupNodesByDocument(filteredNodes, docs) {
  const byDoc = new Map();
  const orphans = [];

  for (const node of filteredNodes) {
    const docId = node.parentDocId;
    if (!docId || !docs[docId]) {
      orphans.push(node);
      continue;
    }
    if (!byDoc.has(docId)) byDoc.set(docId, []);
    byDoc.get(docId).push(node);
  }

  const sections = [...byDoc.entries()]
    .map(([docId, nodes]) => ({ doc: docs[docId], nodes }))
    .sort((a, b) => {
      const titleA = (isKnowledgeDoc(a.doc)
        ? resolveKnowledgeDocDisplayTitle(a.doc)
        : resolveProductDocDisplayTitle(a.doc)).toLowerCase();
      const titleB = (isKnowledgeDoc(b.doc)
        ? resolveKnowledgeDocDisplayTitle(b.doc)
        : resolveProductDocDisplayTitle(b.doc)).toLowerCase();
      return titleA.localeCompare(titleB);
    });

  return { sections, orphans };
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [blocks, setBlocks] = useState([]);
  const fallbackParent = defaultParentId || "";
  const [parentId, setParentId] = useState(fallbackParent);
  const [createdDate, setCreatedDate] = useState(todayDateInputValue);
  const [version, setVersion] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [launchDate, setLaunchDate] = useState("");
  const [campaignActive, setCampaignActive] = useState(false);
  const [subcategoryDocIds, setSubcategoryDocIds] = useState([]);
  const [nodeLinkColor, setNodeLinkColor] = useState("dark");
  const [knowledgeImport, setKnowledgeImport] = useState(null);
  const titleRef = useRef(null);
  const isProductMode = createMode === "product";
  const isKnowledgeMode = createMode === "knowledge";
  const metaMode = isProductMode ? "product" : isKnowledgeMode ? "knowledge" : "content";
  const docKind = isProductMode ? "product" : isKnowledgeMode ? "knowledge" : "content";

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

  const parentObject = isKnowledgeMode ? null : objects.find((o) => o.id === parentId);

  const handleKnowledgeFileImport = ({ title: importTitle, knowledgeImport: nextImport }) => {
    if (importTitle && !title.trim()) setTitle(importTitle);
    if (nextImport) setKnowledgeImport(nextImport);
  };

  const handleTitleChange = (value) => {
    setTitle(value);
    if (isProductMode) setCategory(value);
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    if (isProductMode) setTitle(value);
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

  const submitDoc = () => {
    const trimmedCategory = category.trim();
    const productName = title.trim() || trimmedCategory;
    const finalCategory = isProductMode
      ? (trimmedCategory || productName)
      : trimmedCategory;
    const finalTitle = isProductMode
      ? (formatProductDocTitle(finalCategory || productName, version.trim()) || productName || t("sidebar.newProduct"))
      : isKnowledgeMode
        ? (finalCategory || title.trim() || t("sidebar.newKnowledge"))
        : (title.trim() || t("sidebar.newDocument"));
    const autoTags = isKnowledgeMode ? [] : (parentObject?.name ? [parentObject.name] : []);
    const serializedBody = docBlocksToBody(blocks) || body;
    onSubmit({
      title: finalTitle,
      parentObjectId: isKnowledgeMode ? null : (parentId || null),
      tags: autoTags,
      body: serializedBody,
      blocks,
      createdAt: isoFromDateInput(createdDate),
      version: version.trim(),
      category: finalCategory,
      launchAt: launchDate ? isoFromDateInput(launchDate) : null,
      campaignActive,
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
                : t("sidebar.writeDescription")
          }
          body={body}
          onBodyChange={setBody}
          blocks={blocks}
          onBlocksChange={setBlocks}
          createdDate={createdDate}
          onCreatedDateChange={setCreatedDate}
          version={version}
          onVersionChange={setVersion}
          onVersionCommit={handleVersionCommit}
          category={category}
          onCategoryChange={handleCategoryChange}
          launchDate={launchDate}
          onLaunchDateChange={setLaunchDate}
          campaignActive={campaignActive}
          onCampaignActiveChange={setCampaignActive}
          subcategoryDocIds={subcategoryDocIds}
          onSubcategoryDocIdsChange={setSubcategoryDocIds}
          allDocs={allDocs}
          nodeLinkColor={nodeLinkColor}
          onNodeLinkColorChange={setNodeLinkColor}
          parentId={parentId}
          onParentIdChange={setParentId}
          objects={objects}
          docKind={docKind}
          metaMode={metaMode}
          onDelete={onCancel}
          onSave={submitDoc}
          onCloseExpand={onCancel}
          onOpenNodeForBlock={onOpenNodeForBlock}
          onEnsureNodeForBlock={onEnsureNodeForBlock}
          onAnswerBelowH1Change={onAnswerBelowH1Change}
          onBlockAnchorChange={onBlockAnchorChange}
          onVideoEmbedSync={onVideoEmbedSync}
          onVideoEmbedH1TitleChange={onVideoEmbedH1TitleChange}
          onKnowledgeFileImport={isKnowledgeMode ? handleKnowledgeFileImport : undefined}
          knowledgeImport={isKnowledgeMode ? knowledgeImport : null}
          onTitleKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          onBodyKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submitDoc();
            }
          }}
        />
          </div>
        </div>
      ) : null}
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
  onInsertToCanvas,
  onInsertAgent,
  onOpenDocument,
  onExpandNode,
  onDocumentDeleted,
  onRunStepPlaybook,
  onOpenNewStepPlaybook,
  onOpenNewUrlTable,
  onOpenUrlTable,
  onUrlTableRemoved,
  onOpenNewLazyTodo,
  onOpenLazyTodoItem,
  onStepPlaybookRemoved,
  timelineCanvasSelection = [],
  canvasNodesForQueue = [],
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
  const [clickFolderView, setClickFolderView] = useState(null);
  const [packImportActive, setPackImportActive] = useState(false);
  const [stepsLibraryActive, setStepsLibraryActive] = useState(false);
  const [urlTableActive, setUrlTableActive] = useState(false);
  const [lazyTodosActive, setLazyTodosActive] = useState(false);

  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setSelectedObjectId = useUIStateStore((s) => s.setSelectedObjectId);
  const setKnowledgeFolderActive = useUIStateStore((s) => s.setKnowledgeFolderActive);
  const productCategoryFilter = useUIStateStore((s) => s.productCategoryFilter);
  const setProductCategoryFilter = useUIStateStore((s) => s.setProductCategoryFilter);
  const contentProductFilter = useUIStateStore((s) => s.contentProductFilter);
  const setContentProductFilter = useUIStateStore((s) => s.setContentProductFilter);
  const leftPanelNavigateRequest = useUIStateStore((s) => s.leftPanelNavigateRequest);
  const clearLeftPanelNavigateRequest = useUIStateStore((s) => s.clearLeftPanelNavigateRequest);

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
  const addNode    = useNodesStore(s => s.addNode);
  const deleteNode = useNodesStore(s => s.deleteNode);
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

  const objectScopedNodes = useMemo(() => {
    if (!activeObjectId) return [];
    const docIds = new Set(getDocsByObject(activeObjectId).map((doc) => doc.id));
    return nodeList.filter((node) => {
      if (!node.parentDocId) return true;
      return docIds.has(node.parentDocId);
    });
  }, [activeObjectId, nodeList, docs, getDocsByObject]);

  const filteredNodeList = objectScopedNodes.filter((node) => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return true;
    const title = (node.sourceQuery || node.title || "").toLowerCase();
    const content =
      typeof node.content === "string" ? node.content.toLowerCase() : JSON.stringify(node.content || "").toLowerCase();
    return title.includes(q) || content.includes(q);
  });

  const groupedNodeViews = useMemo(
    () => groupNodesByDocument(filteredNodeList, docs),
    [filteredNodeList, docs],
  );

  const filterObject = filterObjectId ? objects[filterObjectId] : null;

  const productDocs = useMemo(
    () => (filterObjectId ? listProductDocs(docs, filterObjectId) : []),
    [docs, filterObjectId],
  );
  const contentDocs = useMemo(
    () => (filterObjectId ? listContentDocs(docs, filterObjectId) : []),
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

  const filteredContentDocs = useMemo(
    () => contentDocs.filter((doc) => contentDocMatchesProductFilter(doc, docs, contentProductFilter)),
    [contentDocs, docs, contentProductFilter],
  );

  const groupedProductDocs = useMemo(
    () => groupProductDocsFromList(filteredProductDocs, t("sidebar.docGroupUncategorized")),
    [filteredProductDocs, t],
  );

  const groupedContentDocs = useMemo(
    () => groupContentDocsForSidebar(filteredContentDocs, t("sidebar.docGroupUncategorized")),
    [filteredContentDocs, t],
  );

  useEffect(() => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setUrlTableActive(false);
    setLazyTodosActive(false);
    setProductCategoryFilter(null);
    setContentProductFilter(null);
  }, [panelType, filterObjectId, setProductCategoryFilter, setContentProductFilter]);

  const openPackImportView = () => {
    setClickFolderView(null);
    setStepsLibraryActive(false);
    setUrlTableActive(false);
    setLazyTodosActive(false);
    setPackImportActive(true);
  };

  const closePackImportView = () => {
    setPackImportActive(false);
  };

  const openStepsLibraryView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setUrlTableActive(false);
    setLazyTodosActive(false);
    setStepsLibraryActive(true);
  };

  const closeStepsLibraryView = () => {
    setStepsLibraryActive(false);
  };

  const openUrlTableView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setUrlTableActive(true);
  };

  const closeUrlTableView = () => {
    setUrlTableActive(false);
  };

  const openLazyTodosView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setUrlTableActive(false);
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
    const doc = docs[docId];
    if (doc?.parentObjectId) {
      setFilterObjectId(doc.parentObjectId);
      setSelectedObjectId(doc.parentObjectId);
    }
  };

  const handleOpenFolderDoc = (docId, options = {}) => {
    setActiveId(docId);
    onOpenDocument?.(docId, options);
  };

  const handleDeleteDoc = (doc) => {
    const label = resolveProductDocDisplayTitle(doc);
    if (!window.confirm(`Delete "${label}" and its nodes? This cannot be undone.`)) {
      return;
    }
    onDocumentDeleted?.(doc.id);
    removeTimelineDocFromQueue(doc.id);
    deleteDoc(doc.id);
    if (activeId === doc.id) setActiveId(null);
  };

  const selectObject = (objectId) => {
    setObjectMenuId(null);
    setSelectedObjectId(objectId);
    setFilterObjectId(objectId);
    setActiveId(objectId);
  };

  const enterObjectWorkspace = (objectId) => {
    selectObject(objectId);
    setObjectWorkspaceActive(true);
    setPanelType("Documents");
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setUrlTableActive(false);
    setLazyTodosActive(false);
    setShowCreate(false);
    setFolderOpen(false);
  };

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
      } else {
        setPanelType("Documents");
      }
    } else {
      setPanelType("Documents");
    }
    openUrlTableView();
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

  const handleNewUrlTableFromLibrary = () => {
    onOpenNewUrlTable?.(filterObjectId || selectedObjectId);
  };

  const handleOpenUrlTableFromLibrary = (table) => {
    onOpenUrlTable?.(table);
  };

  const handleDeleteUrlTableFromLibrary = ({ docId, blockId, docRemoved }) => {
    if (docRemoved) {
      onDocumentDeleted?.(docId);
    }
    onUrlTableRemoved?.({ docId, blockId });
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
    setNodeSearch("");
  };

  const openDocumentsForObject = (objectId) => {
    enterObjectWorkspace(objectId);
  };

  const handlePackImported = ({ rootObjectId }) => {
    closePackImportView();
    if (rootObjectId) openDocumentsForObject(rootObjectId);
  };

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

  const handleCreate = (data) => {
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
          launchAt: data.launchAt ?? null,
          campaignActive: Boolean(data.campaignActive),
          nodeLinkColor: data.nodeLinkColor ?? "dark",
          knowledgeImport: data.knowledgeImport ?? null,
        },
      );
      if (newDocId && data.blocks?.length) {
        linkBlockNodesToDoc(data.blocks, newDocId);
      }
      setActiveId(null);
      setShowCreate(false);
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
                  <p>{t("sidebar.noObjectsYet")}</p>
                  <p className="dim">{t("sidebar.createFirstModel")}</p>
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

        {panelType === "Documents" && urlTableActive && !objectWorkspaceActive ? (
          <UrlTableLibraryPanel
            objectId={filterObjectId}
            onClose={closeUrlTableView}
            onOpenTable={handleOpenUrlTableFromLibrary}
            onNew={handleNewUrlTableFromLibrary}
            onTableDeleted={handleDeleteUrlTableFromLibrary}
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

            {urlTableActive ? (
              <UrlTableLibraryPanel
                objectId={filterObjectId}
                onClose={closeUrlTableView}
                onOpenTable={handleOpenUrlTableFromLibrary}
                onNew={handleNewUrlTableFromLibrary}
                onTableDeleted={handleDeleteUrlTableFromLibrary}
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

            {!packImportActive && !stepsLibraryActive && !urlTableActive && !lazyTodosActive && clickFolderView === null ? (
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
                    onOpenPasswordTable={() => {}}
                    onInsertGuide={handleInsertGuide}
                  />
                </div>
                <div className="lp-click-folders-stack__boxes">
                  <ClickFolderBox variant="groups" onClick={() => setClickFolderView("groups")} />
                  <ClickFolderBox variant="subgroups" onClick={() => setClickFolderView("subgroups")} />
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
                    onOpenPasswordTable={() => {}}
                    filterMode="category"
                    filterOptions={categoryFilterOptions}
                    filterValue={productCategoryFilter}
                    onFilterChange={setProductCategoryFilter}
                    onInsertGuide={handleInsertGuide}
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
                  <PackActionsBar
                    placement="documents"
                    companySelected={Boolean(filterObjectId || activeObjectId)}
                    onOpenImport={openPackImportView}
                    onOpenStepsLibrary={openStepsLibraryFromToolbar}
                    onOpenLazyTodos={openLazyTodosFromToolbar}
                    onOpenUrlTable={openUrlTableFromToolbar}
                    onOpenPasswordTable={() => {}}
                    onInsertGuide={handleInsertGuide}
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
                  {groupedContentDocs.length ? (
                    groupedContentDocs.map((group) => (
                      <DocGroupBlockCard
                        key={group.id}
                        groupLabel={group.label}
                        groupMeta={t("sidebar.docsInBlock", { count: group.docs.length })}
                        docs={group.docs}
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
                        {contentProductFilter
                          ? t("sidebar.noContentForProduct")
                          : t("sidebar.noContentYet")}
                      </p>
                      <p className="dim">
                        {contentProductFilter
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

        {/* NODES — grouped by document */}
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
              {groupedNodeViews.sections.map(({ doc, nodes: docNodes }) => (
                <DocNodesBlockCard
                  key={doc.id}
                  doc={doc}
                  nodes={docNodes}
                  objects={objects}
                  onOpenDoc={() => handleOpenFolderDoc(doc.id)}
                  onNodeClick={(node) => {
                    setActiveId(node.id);
                    setNodeEditContentFocus(false);
                    setNodeEditId(node.id);
                  }}
                  onNodeInsert={(node) => onInsertToCanvas?.(node)}
                  onNodeDelete={(node) => deleteNode(node.id)}
                />
              ))}
              {groupedNodeViews.orphans.length ? (
                <DocNodesBlockCard
                  doc={null}
                  orphan
                  nodes={groupedNodeViews.orphans}
                  objects={objects}
                  onNodeClick={(node) => {
                    setActiveId(node.id);
                    setNodeEditContentFocus(false);
                    setNodeEditId(node.id);
                  }}
                  onNodeInsert={(node) => onInsertToCanvas?.(node)}
                  onNodeDelete={(node) => deleteNode(node.id)}
                />
              ) : null}
            </div>
            {!groupedNodeViews.sections.length && !groupedNodeViews.orphans.length ? (
              <div className="lp-empty">
                <p>{t("sidebar.noNodesYet")}</p>
                <p className="dim">{t("sidebar.createNewNodeAbove")}</p>
              </div>
            ) : null}
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
          onSaved={() => setShowCreate(false)}
        />,
        document.body,
      )}
      {nodeEditId && nodes[nodeEditId] && panelType === "Nodes" && typeof document !== "undefined" && createPortal(
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
