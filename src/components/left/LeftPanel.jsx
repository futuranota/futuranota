import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useObjectsStore,
  useDocsStore,
  useNodesStore,
  useCanvasStore,
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
import {
  SIDEBAR_REORDER_MIME,
  moveIdBeforeTarget,
  setSidebarFolderDragImage,
} from "../../lib/folderSidebarOrder.js";
import {
  FOLDER_DOC_REORDER_MIME,
  setFolderDocDragImage,
} from "../../lib/folderDocumentOrder.js";
import { getAgentsForUser, AGENT_CONTENT_CREATOR, AGENT_SOCIAL_HYPE_ANALYST } from "../../lib/agents/registry.js";
import { useAuthStore } from "../../stores/authStore.js";
import { AgentListCard } from "../agents/AgentListCard.jsx";
import { AssistanceListCard } from "../gina/AssistanceListCard.jsx";
import { GinaChatOverlay } from "../gina/GinaChatOverlay.jsx";
import { GinaDailyReportPopover } from "../gina/GinaDailyReportPopover.jsx";
import { GinaTalkRequestPopover } from "../gina/GinaTalkRequestPopover.jsx";
import { GinaKnowledgeOverlay } from "../gina/GinaKnowledgeOverlay.jsx";
import { runGinaQueryFamily } from "../../lib/gina/ginaQueryFamily.js";
import { fetchGinaChat } from "../../lib/fetchGinaChat.js";
import { buildGinaVisualization } from "../../lib/gina/buildGinaVisualization.js";
import {
  buildGinaFunnelHeadline,
  buildGinaReplyChips,
  buildScheduleSheetChips,
  buildTodayOverviewPostTableCopy,
  buildTodayOverviewIntroText,
  todayOverviewNeedsRecoveryGate,
} from "../../lib/gina/ginaReplyChips.js";
import {
  buildGinaSearchSequence,
  shouldUseGinaSearchSequence,
} from "../../lib/gina/ginaSearchSequence.js";
import {
  buildCascadeSchedulePreview,
  buildGinaWarmGoodbyeReply,
  buildScheduleRecoveryAppliedText,
  buildScheduleRecoveryIntroText,
  buildScheduleRecoveryStepText,
  buildReschedulePickerText,
  buildRescheduleForkText,
  buildRescheduleForkChips,
  buildRescheduleAppliedText,
  buildRescheduleDayReadyText,
  buildRescheduleProgressText,
  buildRecoverySnoozeText,
  resolvePostMutationRecoveryFollowUp,
  isGinaWarmGoodbye,
} from "../../lib/gina/ginaScheduleRecovery.js";
import { buildGinaDocumentOpenPlan } from "../../lib/gina/ginaOpenDocument.js";
import { partitionTodayByClock, lastOccupiedFinishMs, findFirstFreeSlot } from "../../lib/gina/ginaTodayTimeTriage.js";
import { summarizeTodayOverlaps } from "../../lib/gina/ginaTodayQuickSheet.js";
import {
  setRecoveryNotifySnooze,
  isRecoveryNotifySnoozed,
  clearRecoveryNotifySnooze,
} from "../../lib/gina/ginaRecoverySnooze.js";
import { listOccupiedIntervalsByDate } from "../../lib/docScheduleOccupancy.js";
import { calendarDateInputValue } from "../../lib/docDates.js";
import { formatClock12h, formatClockRange12h } from "../../lib/clockFormat.js";
import { buildDailyReportAppliedText, buildDailyReportOfferText } from "../../lib/gina/ginaDailyReport.js";
import { markDailyReportOpened } from "../../lib/gina/ginaDailyReportStore.js";
import { anchorDaySheetFromTodayDocs, hasDaySheet } from "../../lib/gina/ginaDaySheetStore.js";
import {
  acceptTalkRequest,
  declineTalkRequest,
  hasTalkNotificationsDecision,
} from "../../lib/gina/ginaTalkRequestStore.js";
import {
  buildTalkNotificationsEnabledAck,
  buildTalkNotificationsSkippedAck,
  buildTalkRequestNotifyChips,
  buildTalkRequestNotifyStartDocLines,
  buildTalkRequestNotifyText,
  buildTalkRequestThanksText,
  buildTalkRequestNotifyPrompt,
  buildTalkRequestNotifyDisplayText,
} from "../../lib/gina/ginaTalkRequest.js";
import { useGinaTalkRequestNudge } from "../../hooks/useGinaTalkRequestNudge.js";
import { buildGinaDayRitualResetAck } from "../../lib/gina/ginaDayRitualReset.js";
import { buildOccupiedHoursReplyMessage } from "../../lib/gina/ginaSyntaxOccupiedHours.js";
import { formatGinaWallClockMessage } from "../../lib/gina/ginaSyntaxClock.js";
import {
  buildLastTurnModifyChips,
  buildLastTurnModifyMessage,
} from "../../lib/gina/ginaSyntaxLastTurn.js";
import { stampGinaLastTurnFromRouted, enrichGinaLastTurnFromVisualization } from "../../lib/gina/ginaLastTurn.js";
import {
  consumePendingGinaOffer,
  getPendingGinaOffer,
  setPendingGinaOffer,
  clearPendingGinaOffer,
} from "../../lib/gina/ginaPendingOffer.js";
import { pickNextDaySheetDoc, summarizeDaySheetProgress } from "../../lib/gina/ginaDaySheet.js";
import { useGinaDailyReportNudge } from "../../hooks/useGinaDailyReportNudge.js";
import { DOC_WORK_STATUS, syncDocWorkStatusFields } from "../../lib/docWorkStatus.js";
import { pickGinaOpening, resolveGinaUserDisplayName } from "../../lib/gina/ginaOpenings.js";
import { get_today_scope, get_workspace_inventory } from "../../lib/gina/ginaTools.js";
import { buildGinaKnowledgePromptBlock, isGinaLearnSaveConfirm, addLocalGinaKnowledge, parseGinaLearnReply } from "../../lib/gina/ginaKnowledgeStore.js";
import { resolveGinaLearnBrief, resolveGinaLearnBriefByTitle } from "../../lib/gina/resolveGinaLearnBrief.js";
import { isAdminSessionEmail } from "../../lib/adminPlanCredits.js";
import { ObjectThumbPreview } from "./objectIcons.jsx";
import { formatMmDdYy, isoFromDateInput, todayDateInputValue } from "../../lib/docDates.js";
import {
  folderSchedulePickerMinDateInput,
  validateFolderSchedule,
} from "../../lib/folderScheduleReservation.js";
import { DocDocumentBox } from "../docs/DocDocumentBox.jsx";
import { DepartmentsPanel } from "../departments/DepartmentsPanel.jsx";
import { DocListTitle } from "../docs/DocListTitle.jsx";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";
import {
  UNASSIGNED_DEPARTMENT_FILTER_ID,
  findDepartmentById,
  folderMatchesDepartmentFilter,
  formatDepartmentOfLabel,
  listCategoriesForDepartment,
  listDepartmentsForObject,
} from "../../lib/departments.js";
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
import { UrlTableLibraryPanel } from "../urltable/UrlTableLibraryPanel.jsx";
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

function DepartmentsGlyph({ className = "lp-click-folder-box-icon" }) {
  return (
    <svg className={className} viewBox="0 0 51 49" fill="none" aria-hidden>
      <path d="M4.5 42.5L12.5004 37.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      <path d="M35.5 11H11.5C10.9477 11 10.5 11.4477 10.5 12V15C10.5 15.5523 10.9477 16 11.5 16H35.5C36.0523 16 36.5 15.5523 36.5 15V12C36.5 11.4477 36.0523 11 35.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34.5 16V28M34.5 28C34.5 28.2652 34.3946 28.5196 34.2071 28.7071C34.0196 28.8946 33.7652 29 33.5 29H13.5C13.2348 29 12.9804 28.8946 12.7929 28.7071C12.6054 28.5196 12.5 28.2652 12.5 28M34.5 28V42M12.5 28V16M34.5 38V42H12.5V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.5 21H26.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.5 34H26.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M35 37L47 42" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClickFolderIcon({ variant, className = "lp-click-folder-box-icon" }) {
  if (variant === "departments") {
    return <DepartmentsGlyph className={className} />;
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

  if (variant === "assistance") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
        <path d="M25.65002,21.89001C25.07001,21.32001,24.31,21,23.5,21h-0.26001c-1.08002,0-2.14996-0.14001-3.19-0.41003c-0.89996,0.88-1.98999,1.55005-3.21997,1.96002c-0.08002,0.02997-0.15002,0.04999-0.23004,0.06c0.28003,0.59998,0.67004,1.15002,1.16003,1.64001C18.90002,25.38,20.40002,26,22,26c2.26001,0,4.22998-1.25,5.25-3.10004c-0.51001-0.13-0.97998-0.38995-1.37-0.77997L25.65002,21.89001z" />
        <path d="M14.69238,20.42627c0.43408,0.3125,0.99414,0.39746,1.50293,0.22949c1.31396-0.43799,2.42627-1.27002,3.20752-2.3833C20.62012,18.75049,21.92871,19,23.23584,19H23.5c1.34512,0,2.6092,0.52386,3.56035,1.47441c0.36247,0.36225,0.78795,0.67037,1.32246,0.44941C28.75635,20.76904,29,20.4043,29,20v-5c0-2.20557-1.79443-4-4-4h-6c-1.35156,0-2.49707,0.89795-2.87109,2.12891C14.89795,13.50293,14,14.64844,14,16v3.07373C14,19.60791,14.25879,20.11377,14.69238,20.42627z" />
        <path d="M39,23c0.55127,0,1-0.44873,1-1v-2c0-0.55127-0.44873-1-1-1s-1,0.44873-1,1v2C38,22.55127,38.44873,23,39,23z" />
        <path d="M46,22c0,0.55127,0.44873,1,1,1s1-0.44873,1-1v-2c0-0.55127-0.44873-1-1-1s-1,0.44873-1,1V22z" />
        <path d="M43,31c6.6167,0,12-5.3833,12-12S49.6167,7,43,7s-12,5.3833-12,12S36.3833,31,43,31z M36,20c0-1.30194,0.8385-2.40161,2-2.81573V16c0-2.75684,2.24316-5,5-5s5,2.24316,5,5v1.18427c1.1615,0.41412,2,1.51379,2,2.81573v2c0,1.49658-1.10455,2.7298-2.53937,2.95343l-1.7536,1.7536C45.51953,26.89453,45.26514,27,45,27h-2c-0.55225,0-1-0.44775-1-1s0.44775-1,1-1h1.58594l0.61469-0.61469C44.47607,23.83716,44,22.97656,44,22v-2c0-1.30194,0.8385-2.40161,2-2.81573V16c0-1.6543-1.3457-3-3-3s-3,1.3457-3,3v1.18427c1.1615,0.41412,2,1.51379,2,2.81573v2c0,1.6543-1.3457,3-3,3s-3-1.3457-3-3V20z" />
        <path d="M43,48c0-0.55127-0.44873-1-1-1h-1v2h1C42.55127,49,43,48.55127,43,48z" />
        <rect x="7" y="35" width="50" height="2" />
        <path d="M17,57h30V43H17V57z M39,46c0-0.54999,0.45001-1,1-1h2c1.65002,0,3,1.34998,3,3c0,1.64996-1.34998,3-3,3h-1v1c0,0.54999-0.45001,1-1,1s-1-0.45001-1-1V46z M32,46c0-0.54999,0.45001-1,1-1s1,0.45001,1,1v5h3c0.54999,0,1,0.45001,1,1s-0.45001,1-1,1h-4c-0.54999,0-1-0.45001-1-1V46z M26,46c0-0.54999,0.45001-1,1-1h3c0.54999,0,1,0.45001,1,1s-0.45001,1-1,1h-2v1h2c0.54999,0,1,0.45001,1,1s-0.45001,1-1,1h-2v1h2c0.54999,0,1,0.45001,1,1s-0.45001,1-1,1h-3c-0.54999,0-1-0.45001-1-1V46z M19,46c0-0.54999,0.45001-1,1-1s1,0.45001,1,1v2h2v-2c0-0.54999,0.45001-1,1-1s1,0.45001,1,1v6c0,0.54999-0.45001,1-1,1s-1-0.45001-1-1v-2h-2v2c0,0.54999-0.45001,1-1,1s-1-0.45001-1-1V46z" />
        <path d="M11,56c0,0.55225,0.44775,1,1,1h3V42c0-0.55225,0.44775-1,1-1h32c0.55225,0,1,0.44775,1,1v15h3c0.55225,0,1-0.44775,1-1V39H11V56z" />
        <path d="M27.58002,25.70996C26.14001,27.13,24.16998,28,22,28c-2.09998,0-4.08002-0.81-5.59003-2.28003c-2.39996,1.60999-4.06,4.25-4.35999,7.28003h19.90002C31.65002,29.95996,29.98999,27.32996,27.58002,25.70996z" />
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

function NodeCompactRow({
  node,
  onClick,
  onInsert,
  onDelete,
  campaignMode = false,
  highlighted = false,
  reorderEnabled = false,
  reorderActive = false,
  reorderDragging = false,
  reorderDragOver = false,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
}) {
  const { t } = useI18n();
  const rowRef = useRef(null);
  const displayTitle = getNodeDisplayTitle(node);
  const source = resolveDocSource(node?.sourceId);
  const iconSrc = source?.src || "/uploads/File.svg";
  const isCampaignActive = campaignMode && node?.campaignStatus === "active";
  const campaignStatusLabel = campaignMode
    ? (isCampaignActive ? t("sidebar.campaignDocActive") : t("sidebar.campaignDocInactive"))
    : "";

  return (
    <div
      ref={rowRef}
      className={
        "lp-doc-nodes-block__node"
        + (isCampaignActive ? " is-campaign-active" : "")
        + (highlighted ? " is-gina-reveal" : "")
        + (reorderDragging ? " is-folder-doc-dragging" : "")
        + (reorderDragOver ? " is-folder-doc-drag-over" : "")
      }
      data-gina-reveal={highlighted ? "1" : undefined}
      onDragOver={reorderEnabled ? (e) => {
        const types = [...e.dataTransfer.types];
        const isDocReorder = types.includes(FOLDER_DOC_REORDER_MIME)
          || (reorderActive && types.includes("text/plain"));
        if (!isDocReorder && !reorderActive) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        onReorderDragOver?.(node.id);
      } : undefined}
      onDrop={reorderEnabled ? (e) => {
        const types = [...e.dataTransfer.types];
        const isDocReorder = types.includes(FOLDER_DOC_REORDER_MIME)
          || types.includes("text/plain");
        if (!isDocReorder && !reorderActive) return;
        e.preventDefault();
        e.stopPropagation();
        onReorderDrop?.(node.id);
      } : undefined}
      onDragEnd={reorderEnabled ? () => onReorderDragEnd?.() : undefined}
    >
      {reorderEnabled ? (
        <span
          className="lp-doc-drag-area lp-doc-drag-area--compact lp-doc-drag-area--folder-doc"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData(FOLDER_DOC_REORDER_MIME, node.id);
            e.dataTransfer.setData("text/plain", node.id);
            setFolderDocDragImage(e.dataTransfer, rowRef.current, e);
            onReorderDragStart?.(node.id);
          }}
          onClick={(e) => e.stopPropagation()}
          title={t("sidebar.reorderFolderDoc")}
          aria-label={t("sidebar.reorderFolderDoc")}
        >
          ⋮⋮
        </span>
      ) : null}
      <button
        type="button"
        className="lp-doc-nodes-block__node-main"
        onClick={onClick}
        title={
          campaignStatusLabel
            ? `${displayTitle} · ${campaignStatusLabel}`
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

function FolderCategoryChip({ departmentId, category }) {
  const label = String(category || "").trim();
  if (!label || !(departmentId || "").trim()) return null;
  return <span className="lp-folder-category-chip" title={label}>{label}</span>;
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
  forceExpanded = false,
  highlightNodeId = null,
  orphan = false,
  showWhenEmpty = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
  /** When set, the maya reorders folders in the Documents list (Y-axis). */
  reorderEnabled = false,
  reorderActive = false,
  reorderDragging = false,
  reorderDragOver = false,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded || forceExpanded);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderDocDragId, setFolderDocDragId] = useState(/** @type {string | null} */ (null));
  const [folderDocOverId, setFolderDocOverId] = useState(/** @type {string | null} */ (null));
  const folderDocDragIdRef = useRef(/** @type {string | null} */ (null));
  const folderDocListRef = useRef(/** @type {string[] | null} */ (null));
  const reorderFolderDocuments = useDocsStore((s) => s.reorderFolderDocuments);
  const longPressTimer = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const rootRef = useRef(null);

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  useEffect(() => {
    if (!forceExpanded || !rootRef.current) return;
    try {
      rootRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch { /* ignore */ }
  }, [forceExpanded, highlightNodeId]);

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
        + (reorderDragging ? " is-sidebar-dragging" : "")
        + (reorderDragOver ? " is-sidebar-drag-over" : "")
      }
      aria-selected={selectMode ? selected : undefined}
      onDragOver={reorderEnabled && !orphan && !selectMode ? (e) => {
        const types = [...e.dataTransfer.types];
        const isSidebarReorder = types.includes(SIDEBAR_REORDER_MIME)
          || (reorderActive && types.includes("text/plain"));
        if (!isSidebarReorder && !reorderActive) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onReorderDragOver?.(doc.id);
      } : undefined}
      onDrop={reorderEnabled && !orphan && !selectMode ? (e) => {
        const types = [...e.dataTransfer.types];
        const isSidebarReorder = types.includes(SIDEBAR_REORDER_MIME)
          || types.includes("text/plain");
        if (!isSidebarReorder && !reorderActive) return;
        e.preventDefault();
        e.stopPropagation();
        onReorderDrop?.(doc.id);
      } : undefined}
      onDragEnd={reorderEnabled ? () => onReorderDragEnd?.() : undefined}
    >
      <div className="lp-doc-nodes-block__head">
          {!orphan && doc && !selectMode ? (
            <span
              className="lp-doc-drag-area lp-doc-drag-area--compact lp-doc-drag-area--folder"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                clearLongPress();
                if (reorderEnabled) {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(SIDEBAR_REORDER_MIME, doc.id);
                  // Some browsers require a text/plain payload for DnD to start.
                  e.dataTransfer.setData("text/plain", doc.id);
                  setSidebarFolderDragImage(e.dataTransfer, rootRef.current, e);
                  onReorderDragStart?.(doc.id);
                  return;
                }
                startDocDrag(e, doc.id);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                clearLongPress();
              }}
              onClick={(e) => e.stopPropagation()}
              title={reorderEnabled ? t("sidebar.reorderFolder") : t("sidebar.dragDocToCanvas")}
              aria-label={reorderEnabled ? t("sidebar.reorderFolder") : t("sidebar.dragDocToCanvas")}
            >
              ⋮⋮
            </span>
          ) : null}
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
                <b className="lp-doc-title-text" title={displayTitle}>{displayTitle}</b>
              ) : (
                <>
                  <DocListTitle doc={doc} />
                  <FolderCategoryChip
                    departmentId={doc?.departmentId}
                    category={doc?.category}
                  />
                </>
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
              highlighted={Boolean(highlightNodeId && highlightNodeId === node.id)}
              campaignMode={Boolean(doc?.campaignActive)}
              onClick={() => onNodeClick?.(node)}
              onInsert={() => onNodeInsert?.(node)}
              onDelete={() => onNodeDelete?.(node)}
              reorderEnabled={!orphan && Boolean(doc?.id) && nodes.length > 1}
              reorderActive={Boolean(folderDocDragId)}
              reorderDragging={folderDocDragId === node.id}
              reorderDragOver={folderDocOverId === node.id && folderDocDragId !== node.id}
              onReorderDragStart={(id) => {
                folderDocDragIdRef.current = id;
                folderDocListRef.current = nodes.map((n) => n.id);
                setFolderDocDragId(id);
                setFolderDocOverId(id);
              }}
              onReorderDragOver={setFolderDocOverId}
              onReorderDrop={(targetId) => {
                const fromId = folderDocDragIdRef.current;
                const list = folderDocListRef.current;
                folderDocDragIdRef.current = null;
                folderDocListRef.current = null;
                setFolderDocDragId(null);
                setFolderDocOverId(null);
                if (!doc?.id || !fromId || !targetId || !list?.length) return;
                const next = moveIdBeforeTarget(list, fromId, targetId);
                if (!next) return;
                reorderFolderDocuments(doc.id, next);
              }}
              onReorderDragEnd={() => {
                folderDocDragIdRef.current = null;
                folderDocListRef.current = null;
                setFolderDocDragId(null);
                setFolderDocOverId(null);
              }}
            />
          ))}
          {onCreateDocument ? (
            <button
              type="button"
              className="lp-doc-nodes-block__create-doc"
              onClick={() => onCreateDocument(orphan ? null : doc)}
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
          {!nodes.length && orphan ? (
            <p className="lp-doc-nodes-block__empty dim">{t("sidebar.departmentInboxHint")}</p>
          ) : null}
          {!nodes.length && !orphan && !onCreateDocument ? (
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
  defaultDepartmentId = null,
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
  const [departmentId, setDepartmentId] = useState(
    () => (defaultDepartmentId ? String(defaultDepartmentId) : null),
  );
  const [icon, setIcon] = useState("");
  const departments = useDepartmentsStore((s) => s.departments);
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
  /** Products: title and category mirror. Content folders: free title; category from Departments. */
  const syncTitleWithCategory = isProductMode;

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
    setDepartmentId(defaultDepartmentId ? String(defaultDepartmentId) : null);
  }, [defaultDepartmentId]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const alertFolderScheduleError = async (check) => {
    if (!check || check.ok) return;
    let message = t("meta.scheduleInvalid");
    let hint = "";
    if (check.code === "required" || check.code === "partial") {
      message = t("meta.schedulePartial");
      hint = t("meta.schedulePartialHint");
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
      hint,
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

  const handleKnowledgeFileImport = ({ title: importTitle, knowledgeImport: nextImport, textContent }) => {
    if (importTitle && !title.trim()) setTitle(importTitle);
    if (nextImport) setKnowledgeImport(nextImport);
    const text = String(textContent || "").trim();
    if (text) {
      setBody(text);
      setBlocks([]);
    }
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
    parentObjectId: isKnowledgeMode ? null : (parentId || null),
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
      departmentId: isContentMode && !isCampaignMode ? departmentId : null,
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
                  ? t("sidebar.folderTitlePlaceholder")
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
          departmentId={isContentMode && !isCampaignMode ? departmentId : null}
          onDepartmentIdChange={isContentMode && !isCampaignMode ? (id) => {
            setDepartmentId(id);
            setCategory("");
          } : undefined}
          departments={isContentMode && !isCampaignMode ? departments : []}
          departmentOfLabel={
            isContentMode && !isCampaignMode
              ? formatDepartmentOfLabel(findDepartmentById(departments, departmentId))
              : ""
          }
          departmentName={
            isContentMode && !isCampaignMode
              ? (findDepartmentById(departments, departmentId)?.category || "")
              : ""
          }
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
          saveDisabled={isContentMode && !title.trim()}
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
  onOpenStepPlaybook,
  onOpenNewStepPlaybook,
  onOpenUrlTableForCompany,
  onOpenUrlTableRef,
  onOpenNewUrlTable,
  onOpenNewLazyTodo,
  onOpenLazyTodoItem,
  onStepPlaybookRemoved,
  onUrlTablesDeleted,
  timelineCanvasSelection = [],
  canvasNodesForQueue = [],
  onNotify = null,
}) {
  const { t, locale } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const panelTypeLabel = usePanelTypeLabels();
  const [panelType, setPanelType] = useState("Objects");
  const [activeId, setActiveId] = useState(null);
  const [objectMenuId, setObjectMenuId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editObjectId, setEditObjectId] = useState(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [nodeEditId, setNodeEditId] = useState(null);
  const [nodeEditContentFocus, setNodeEditContentFocus] = useState(false);
  const [createDocumentParentDocId, setCreateDocumentParentDocId] = useState(null);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [clickFolderView, setClickFolderView] = useState(null);
  const [ginaDashboardOpen, setGinaDashboardOpen] = useState(false);
  const [ginaAutoRunPrompt, setGinaAutoRunPrompt] = useState(/** @type {string | null} */ (null));
  /** Small-chat session from talk-request Accept (never dashboard size). */
  const [ginaTalkNotifySession, setGinaTalkNotifySession] = useState(
    /** @type {{ documentId: string | null, prompt: string, displayText: string, runKey: number } | null} */ (null),
  );
  const [ginaKnowledgeOpen, setGinaKnowledgeOpen] = useState(false);
  const [ginaMeetingSession, setGinaMeetingSession] = useState(false);
  const [ginaLearnBrief, setGinaLearnBrief] = useState(null);
  const [ginaPendingLearn, setGinaPendingLearn] = useState(null);
  const [ginaOpeningMessage, setGinaOpeningMessage] = useState("");
  const [departmentFilterId, setDepartmentFilterId] = useState(UNASSIGNED_DEPARTMENT_FILTER_ID);
  const [departmentCategoryFilter, setDepartmentCategoryFilter] = useState("");
  /** Last category chosen per department — restored when switching back to that dept. */
  const [categoryByDepartmentId, setCategoryByDepartmentId] = useState({});
  /** Gina guided reveal: expand folder + highlight node without opening overlay. */
  const [revealExpandFolderId, setRevealExpandFolderId] = useState(/** @type {string | null} */ (null));
  const [revealHighlightNodeId, setRevealHighlightNodeId] = useState(/** @type {string | null} */ (null));
  const [departmentCreateRequested, setDepartmentCreateRequested] = useState(false);
  const departments = useDepartmentsStore((s) => s.departments);
  const docsMap = useDocsStore((s) => s.docs);
  const nodesMap = useNodesStore((s) => s.nodes);
  const [packImportActive, setPackImportActive] = useState(false);
  const [stepsLibraryActive, setStepsLibraryActive] = useState(false);
  const [lazyTodosActive, setLazyTodosActive] = useState(false);
  const [sidebarReorderDragId, setSidebarReorderDragId] = useState(/** @type {string | null} */ (null));
  const [sidebarReorderOverId, setSidebarReorderOverId] = useState(/** @type {string | null} */ (null));
  const sidebarReorderListRef = useRef(/** @type {string[] | null} */ (null));
  const sidebarReorderDragIdRef = useRef(/** @type {string | null} */ (null));
  const [urlTableLibraryActive, setUrlTableLibraryActive] = useState(false);
  const [leftPanelNavRestored, setLeftPanelNavRestored] = useState(false);
  const [folderBulkDeleteMode, setFolderBulkDeleteMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const selectedCanvasNodeIds = useUIStateStore((s) => s.selectedCanvasNodeIds);
  const objectWorkspaceActive = useUIStateStore((s) => s.objectWorkspaceActive);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setSelectedObjectId = useUIStateStore((s) => s.setSelectedObjectId);
  const setObjectWorkspaceActive = useUIStateStore((s) => s.setObjectWorkspaceActive);
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
  const requestLeftPanelNavigate = useUIStateStore((s) => s.requestLeftPanelNavigate);
  const requestEnterWorkspaceId = useUIStateStore((s) => s.requestEnterWorkspaceId);
  const clearRequestEnterObjectWorkspace = useUIStateStore((s) => s.clearRequestEnterObjectWorkspace);

  /* stores */
  const objects    = useObjectsStore(s => s.objects);
  const addObject  = useObjectsStore(s => s.addObject);
  const updateObject = useObjectsStore(s => s.updateObject);
  const planProfile = usePlanStore(s => s.profile);
  const showUpgradeModal = useUpgradeModalStore(s => s.show);
  const docs       = useDocsStore(s => s.docs);
  const canvasNodes = useCanvasStore((s) => s.canvasNodes);
  const addDoc     = useDocsStore(s => s.addDoc);
  const deleteDoc  = useDocsStore(s => s.deleteDoc);
  const reorderDocsSidebar = useDocsStore(s => s.reorderDocsSidebar);
  const getDocsByObject = useDocsStore(s => s.getDocsByObject);
  const deleteObjectWithCascade = useObjectsStore(s => s.deleteObjectWithCascade);
  const nodes      = useNodesStore(s => s.nodes);
  const deleteNode = useNodesStore(s => s.deleteNode);
  const deleteNodeAndDocBlocks = useNodesStore(s => s.deleteNodeAndDocBlocks);
  const removeTimelineDocFromQueue = useTimelineStore((s) => s.removeTimelineDocFromQueue);
  const timelineQueueMode = useTimelineStore((s) => s.timelineQueueMode);

  const userEmail = useAuthStore((s) => s.user?.email);
  const authUser = useAuthStore((s) => s.user);
  const ginaUserId = authUser?.id || "anon";

  const isGinaAdmin = isAdminSessionEmail(userEmail);

  const buildGinaToolsCtx = useCallback(() => ({
    docs: docsMap,
    nodes: nodesMap,
    departments,
    objectId: selectedObjectId || filterObjectId || null,
    now: new Date(),
    userId: ginaUserId,
  }), [docsMap, nodesMap, departments, selectedObjectId, filterObjectId, ginaUserId]);

  const {
    popoverOpen: ginaDailyReportPopoverOpen,
    popoverKind: ginaDailyReportPopoverKind,
    deferDailyReportNudge,
    acknowledgeOpenChat: acknowledgeDailyReportOpenChat,
  } = useGinaDailyReportNudge({
    userId: ginaUserId,
    buildCtx: buildGinaToolsCtx,
  });

  const {
    popoverOpen: ginaTalkRequestOpen,
  } = useGinaTalkRequestNudge({
    userId: ginaUserId,
    buildCtx: buildGinaToolsCtx,
    chatOpen: ginaDashboardOpen || Boolean(ginaTalkNotifySession),
  });

  const openGinaDashboard = useCallback(() => {
    setGinaMeetingSession(false);
    setGinaLearnBrief(null);
    setGinaPendingLearn(null);
    setGinaOpeningMessage(pickGinaOpening({
      locale: locale === "es" ? "es" : "en",
      userName: resolveGinaUserDisplayName(authUser),
      now: new Date(),
    }));
    setGinaDashboardOpen(true);
  }, [authUser, locale]);

  const openGinaFromDailyReportPopover = useCallback(() => {
    acknowledgeDailyReportOpenChat();
    setGinaAutoRunPrompt(locale === "es" ? "reporte del día" : "daily report");
    openGinaDashboard();
  }, [acknowledgeDailyReportOpenChat, locale, openGinaDashboard]);

  const openGinaFromTalkRequestPopover = useCallback(() => {
    let docId = null;
    try {
      const accepted = acceptTalkRequest(ginaUserId, new Date());
      docId = accepted?.docId || null;
    } catch { /* ignore */ }
    const localeKey = locale === "es" ? "es" : "en";
    const prompt = buildTalkRequestNotifyPrompt(localeKey, docId);
    const displayText = buildTalkRequestNotifyDisplayText(localeKey);
    // Always small chat — never dashboard. Reminder only: do not open docs/folders.
    setGinaDashboardOpen(false);
    setGinaMeetingSession(false);
    setGinaAutoRunPrompt(null);

    // Remount key overwrites an already-open small chat with the new notify turn.
    try {
      window.dispatchEvent(new CustomEvent("gina:talk-notify-open"));
    } catch { /* ignore */ }
    setGinaTalkNotifySession({
      documentId: docId,
      prompt,
      displayText,
      runKey: Date.now(),
    });
  }, [
    ginaUserId,
    locale,
  ]);

  const declineGinaTalkRequestPopover = useCallback(() => {
    try { declineTalkRequest(ginaUserId, new Date()); } catch { /* ignore */ }
  }, [ginaUserId]);

  const closeGinaTalkNotifySession = useCallback(() => {
    setGinaTalkNotifySession(null);
  }, []);

  const openGinaMeeting = useCallback(() => {
    if (!isAdminSessionEmail(userEmail)) return;
    const brief = resolveGinaLearnBrief({
      selectedCanvasNodeIds,
      canvasNodes,
      nodes: nodesMap,
      docs: docsMap,
    });
    setGinaLearnBrief(brief);
    setGinaPendingLearn(null);
    setGinaMeetingSession(true);
    const briefHint = brief?.title
      ? (locale === "es"
        ? ` Tengo el skill/doc «${brief.title}» listo — dime “aprende esto” o hazme el test.`
        : ` I have skill/doc “${brief.title}” ready — say “learn this” or quiz me.`)
      : (locale === "es"
        ? " Selecciona un documento/skill en el canvas o pega el material y di “aprende esto”."
        : " Select a document/skill on the canvas or paste material and say “learn this”.");
    setGinaOpeningMessage(
      locale === "es"
        ? `Meeting activo.${briefHint}`
        : `Meeting on.${briefHint}`,
    );
    setGinaDashboardOpen(true);
  }, [userEmail, locale, selectedCanvasNodeIds, canvasNodes, nodesMap, docsMap]);

  /** Temporary sidebar Agents list — only Social Hype + Content Creator while wiring flows. */
  const canvasAgents = useMemo(
    () => getAgentsForUser(userEmail).filter((agent) => (
      agent.id === AGENT_SOCIAL_HYPE_ANALYST
      || agent.id === AGENT_CONTENT_CREATOR
    )),
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
  // UI: Documents → # Department inbox (not a separate Nodes panel).
  const independentNodes = useMemo(() => {
    if (!activeObjectId) return [];
    return nodeList.filter((node) => {
      if (node.parentDocId) return false;
      return node.objectId === activeObjectId;
    });
  }, [activeObjectId, nodeList]);

  /** # Department inbox — searchable from Documents folder search. */
  const departmentInboxNodes = useMemo(() => {
    const q = folderSearchQuery.trim().toLowerCase();
    if (!q) return independentNodes;
    return independentNodes.filter((node) => {
      const title = (node.sourceQuery || node.title || "").toLowerCase();
      return title.includes(q);
    });
  }, [independentNodes, folderSearchQuery]);

  const isDepartmentInboxView =
    clickFolderView === "subgroups" && !departmentFilterId;

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

  const departmentFilterOptions = useMemo(
    () => listDepartmentsForObject(departments, filterObjectId),
    [departments, filterObjectId],
  );

  const selectedDepartmentFilter = useMemo(
    () => findDepartmentById(departmentFilterOptions, departmentFilterId),
    [departmentFilterOptions, departmentFilterId],
  );

  const departmentCategoryFilterOptions = useMemo(
    () => listCategoriesForDepartment(selectedDepartmentFilter),
    [selectedDepartmentFilter],
  );

  // Drop stale department / category filters when options change.
  useEffect(() => {
    if (!departmentFilterId) {
      if (departmentCategoryFilter) setDepartmentCategoryFilter("");
      return;
    }
    const stillExists = departmentFilterOptions.some(
      (dept) => dept.id === departmentFilterId,
    );
    if (!stillExists) {
      setDepartmentFilterId("");
      setDepartmentCategoryFilter("");
      setCategoryByDepartmentId((prev) => {
        if (!(departmentFilterId in prev)) return prev;
        const next = { ...prev };
        delete next[departmentFilterId];
        return next;
      });
      return;
    }
    if (
      departmentCategoryFilter
      && !departmentCategoryFilterOptions.some(
        (label) => label.toLowerCase() === departmentCategoryFilter.toLowerCase(),
      )
    ) {
      setDepartmentCategoryFilter("");
      setCategoryByDepartmentId((prev) => {
        if (!prev[departmentFilterId]) return prev;
        return { ...prev, [departmentFilterId]: "" };
      });
    }
  }, [
    departmentFilterId,
    departmentCategoryFilter,
    departmentFilterOptions,
    departmentCategoryFilterOptions,
  ]);

  const filteredContentDocs = useMemo(
    () => contentDocs.filter((doc) => {
      if (doc.campaignActive) return false;
      if (!contentDocMatchesProductFilter(doc, docs, contentProductFilter)) return false;
      if (!folderMatchesDepartmentFilter(doc, departmentFilterId || null)) return false;
      if (!departmentCategoryFilter) return true;
      return String(doc?.category || "").trim().toLowerCase()
        === departmentCategoryFilter.trim().toLowerCase();
    }),
    [
      contentDocs,
      docs,
      contentProductFilter,
      departmentFilterId,
      departmentCategoryFilter,
    ],
  );

  const filteredUncategorizedDocs = useMemo(
    () => (contentProductFilter ? [] : uncategorizedDocs),
    [uncategorizedDocs, contentProductFilter],
  );

  const folderSearchNeedle = folderSearchQuery.trim().toLowerCase();

  const matchesFolderSearch = useCallback((doc) => {
    if (!folderSearchNeedle) return true;
    const title = String(doc?.title || "").toLowerCase();
    const category = String(doc?.category || "").toLowerCase();
    return title.includes(folderSearchNeedle) || category.includes(folderSearchNeedle);
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

  const visibleCampaignDocIds = useMemo(
    () => visibleCampaignDocs.map((doc) => doc.id),
    [visibleCampaignDocs],
  );
  const visibleContentDocIds = useMemo(
    () => visibleContentDocs.map((doc) => doc.id),
    [visibleContentDocs],
  );
  const visibleUncategorizedDocIds = useMemo(
    () => visibleUncategorizedDocs.map((doc) => doc.id),
    [visibleUncategorizedDocs],
  );

  const groupedProductDocs = useMemo(
    () => groupProductDocsFromList(filteredProductDocs, t("sidebar.docGroupUncategorized")),
    [filteredProductDocs, t],
  );

  const knowledgeDocs = useMemo(
    () => listKnowledgeDocs(docs),
    [docs],
  );

  useEffect(() => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setUrlTableLibraryActive(false);
    setProductCategoryFilter(null);
    setContentProductFilter(null);
  }, [panelType, filterObjectId, setProductCategoryFilter, setContentProductFilter]);

  const openPackImportView = () => {
    setClickFolderView(null);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setUrlTableLibraryActive(false);
    setPackImportActive(true);
  };

  const closePackImportView = () => {
    setPackImportActive(false);
  };

  const openStepsLibraryView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setLazyTodosActive(false);
    setUrlTableLibraryActive(false);
    setStepsLibraryActive(true);
  };

  const closeStepsLibraryView = () => {
    setStepsLibraryActive(false);
  };

  const openLazyTodosView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setUrlTableLibraryActive(false);
    setLazyTodosActive(true);
  };

  const closeLazyTodosView = () => {
    setLazyTodosActive(false);
  };

  const openUrlTableLibraryView = () => {
    setClickFolderView(null);
    setPackImportActive(false);
    setStepsLibraryActive(false);
    setLazyTodosActive(false);
    setUrlTableLibraryActive(true);
  };

  const closeUrlTableLibraryView = () => {
    setUrlTableLibraryActive(false);
  };

  useEffect(() => {
    setKnowledgeFolderActive(false);
    return () => setKnowledgeFolderActive(false);
  }, [setKnowledgeFolderActive]);

  useEffect(() => {
    setDepartmentFilterId(UNASSIGNED_DEPARTMENT_FILTER_ID);
  }, [filterObjectId, clickFolderView]);

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
    const confirmed = await askConfirm({
      title: t("sidebar.deleteDocTitle"),
      message: t("sidebar.deleteDocConfirm", { name: label }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
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

  const beginFolderSidebarReorder = useCallback((docId, orderedIds) => {
    sidebarReorderListRef.current = Array.isArray(orderedIds) ? [...orderedIds] : null;
    sidebarReorderDragIdRef.current = docId;
    setSidebarReorderDragId(docId);
    setSidebarReorderOverId(docId);
  }, []);

  const clearFolderSidebarReorder = useCallback(() => {
    sidebarReorderListRef.current = null;
    sidebarReorderDragIdRef.current = null;
    setSidebarReorderDragId(null);
    setSidebarReorderOverId(null);
  }, []);

  const dropFolderSidebarReorder = useCallback((targetId) => {
    const fromId = sidebarReorderDragIdRef.current;
    const list = sidebarReorderListRef.current;
    clearFolderSidebarReorder();
    if (!fromId || !targetId || !list?.length) return;
    const next = moveIdBeforeTarget(list, fromId, targetId);
    if (!next) return;
    reorderDocsSidebar(next);
  }, [clearFolderSidebarReorder, reorderDocsSidebar]);

  const folderSidebarReorderProps = useCallback((docId, orderedIds) => ({
    reorderEnabled: !folderBulkDeleteMode,
    reorderActive: Boolean(sidebarReorderDragId),
    reorderDragging: sidebarReorderDragId === docId,
    reorderDragOver: sidebarReorderOverId === docId && sidebarReorderDragId !== docId,
    onReorderDragStart: (id) => beginFolderSidebarReorder(id, orderedIds),
    onReorderDragOver: setSidebarReorderOverId,
    onReorderDrop: dropFolderSidebarReorder,
    onReorderDragEnd: clearFolderSidebarReorder,
  }), [
    folderBulkDeleteMode,
    sidebarReorderDragId,
    sidebarReorderOverId,
    beginFolderSidebarReorder,
    dropFolderSidebarReorder,
    clearFolderSidebarReorder,
  ]);

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
    setUrlTableLibraryActive(false);
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
      } else {
        setPanelType("Documents");
      }
    } else {
      setPanelType("Documents");
    }
    openUrlTableLibraryView();
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

  const handleOpenUrlTableFromLibrary = (table) => {
    onOpenUrlTableRef?.(table);
  };

  const handleNewUrlTableFromLibrary = (kind = "links") => {
    onOpenNewUrlTable?.(filterObjectId || selectedObjectId, kind);
  };

  const handleNewStepPlaybookFromLibrary = () => {
    onOpenNewStepPlaybook?.(filterObjectId || selectedObjectId);
  };

  const handleRunPlaybookFromLibrary = (playbook) => {
    // Open the editable dashboard (same as URL table / To Do), not only the runner.
    if (onOpenStepPlaybook) {
      onOpenStepPlaybook(playbook);
      return;
    }
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
      const rawPanel = ["Documents", "Nodes", "Objects"].includes(snap.panelType)
        ? snap.panelType
        : "Documents";
      if (rawPanel === "Nodes") {
        setPanelType("Documents");
        setClickFolderView("subgroups");
        setDepartmentFilterId(UNASSIGNED_DEPARTMENT_FILTER_ID);
        setDepartmentCategoryFilter("");
      } else {
        setPanelType(rawPanel);
        if (typeof snap.clickFolderView === "string" || snap.clickFolderView === null) {
          setClickFolderView(snap.clickFolderView);
        }
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
          const rawPanel = ["Documents", "Nodes", "Objects"].includes(snap.panelType)
            ? snap.panelType
            : "Documents";
          if (rawPanel === "Nodes") {
            setPanelType("Documents");
            setClickFolderView("subgroups");
            setDepartmentFilterId(UNASSIGNED_DEPARTMENT_FILTER_ID);
            setDepartmentCategoryFilter("");
          } else {
            setPanelType(rawPanel);
            if (typeof snap.clickFolderView === "string" || snap.clickFolderView === null) {
              setClickFolderView(snap.clickFolderView);
            }
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
    // Independent Documents → Documents / # Department inbox
    if (t === "Nodes") {
      setPanelType("Documents");
      setActiveId(null);
      setClickFolderView("subgroups");
      setDepartmentFilterId(UNASSIGNED_DEPARTMENT_FILTER_ID);
      setDepartmentCategoryFilter("");
      setFolderOpen(false);
      return;
    }
    setPanelType(t);
    setActiveId(null);
    setClickFolderView(null);
    setFolderOpen(false);
  };

  useEffect(() => {
    if (!leftPanelNavigateRequest || !objectWorkspaceActive) return;

    const {
      panel,
      docId = null,
      nodeId = null,
      clickFolderView: nextFolderView = null,
      departmentId = undefined,
      category = undefined,
      folderId = null,
      highlightNodeId = null,
      openDocumentId = null,
    } = leftPanelNavigateRequest;

    if (panel === "Nodes") {
      // Independent Documents live under Documents → # Department
      switchType("Documents");
      setClickFolderView("subgroups");
      setDepartmentFilterId(UNASSIGNED_DEPARTMENT_FILTER_ID);
      setDepartmentCategoryFilter("");
      if (nodeId) {
        setActiveId(nodeId);
        setNodeEditContentFocus(false);
        setNodeEditId(nodeId);
      }
    } else if (panel === "Documents") {
      switchType("Documents");
      if (nextFolderView === "subgroups" || folderId || highlightNodeId || departmentId != null) {
        setClickFolderView("subgroups");
      } else if (docId && !folderId && !highlightNodeId) {
        setClickFolderView(null);
        handleOpenFolderDoc(docId);
      }
      if (departmentId !== undefined) {
        setDepartmentFilterId(
          departmentId === null || departmentId === ""
            ? UNASSIGNED_DEPARTMENT_FILTER_ID
            : departmentId,
        );
      }
      if (category !== undefined) {
        setDepartmentCategoryFilter(category || "");
      }
      if (folderId) setRevealExpandFolderId(folderId);
      if (highlightNodeId || nodeId) {
        setRevealHighlightNodeId(highlightNodeId || nodeId);
      }
      if (openDocumentId) {
        onOpenDocument?.(openDocumentId);
      }
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
          departmentId: typeof data.departmentId === "string" && data.departmentId.trim()
            ? data.departmentId.trim()
            : null,
          // Campaign folders: Launch lives on child docs only.
          // Content: Schedule is explicit only — never invent from launchAt.
          // When user reserved Schedule, submitDoc already mirrors launchAt ← start.
          launchAt: isCampaignFolder
            ? null
            : (data.launchAt ?? data.scheduleStartAt ?? null),
          scheduleStartAt: isCampaignFolder
            ? null
            : (data.scheduleStartAt ?? null),
          scheduleFinishAt: isCampaignFolder
            ? null
            : (data.scheduleFinishAt ?? data.scheduleStartAt ?? null),
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

  const dropdownPanelTypes = objectWorkspaceActive
    ? PANEL_TYPES.filter((type) => type !== "Nodes")
    : ["Objects"];
  const folderLabel = objectWorkspaceActive
    ? `${panelTypeLabel(panelType).toLowerCase()} : ${activeObject?.name || ""}`
    : panelTypeLabel("Objects").toLowerCase();

  const handleNewByFolder = () => {
    if (!objectWorkspaceActive && panelType !== "Objects") return;
    if (objectWorkspaceActive && (panelType === "Documents" || panelType === "Nodes") && !activeObjectId) return;
    if (panelType === "Documents" && !clickFolderView) return;
    // # Department inbox — create independent documents (not folders)
    if (
      panelType === "Documents"
      && clickFolderView === "subgroups"
      && !departmentFilterId
    ) {
      openCreateDocument(null);
      return;
    }
    if (panelType === "Nodes") {
      openCreateDocument(null);
      return;
    }
    if (panelType === "Documents" && clickFolderView === "departments") {
      setDepartmentCreateRequested(true);
      setFolderOpen(false);
      return;
    }
    setShowCreate(true);
    setFolderOpen(false);
  };

  const newDisabled =
    (!objectWorkspaceActive && panelType !== "Objects")
    || (objectWorkspaceActive && (panelType === "Documents" || panelType === "Nodes") && !activeObjectId)
    || (panelType === "Documents" && !clickFolderView)
    || clickFolderView === "agents"
    || clickFolderView === "assistance";
  const docCreateMode = clickFolderView === "groups"
    ? "product"
    : clickFolderView === "campaign"
      ? "campaign"
      : "content";

  const openGinaDocumentByNodeId = useCallback((rawId) => {
    const plan = buildGinaDocumentOpenPlan(rawId, {
      nodesMap,
      docsMap,
      departments,
      unassignedDepartmentId: UNASSIGNED_DEPARTMENT_FILTER_ID,
      findDepartmentById,
    });
    if (!plan) return null;
    if (plan.navigate) {
      requestLeftPanelNavigate(plan.navigate);
    }
    if (plan.kind === "node") {
      onExpandNode?.(plan.targetId);
    } else {
      onOpenDocument?.(plan.targetId);
    }
    // Same as focus_open: hand off to the document and leave the chat.
    setGinaDashboardOpen(false);
    setGinaAutoRunPrompt(null);
    return plan;
  }, [nodesMap, docsMap, departments, requestLeftPanelNavigate, onExpandNode, onOpenDocument]);

  const handleGinaDashboardSend = useCallback(async (text, meta = {}) => {
    const meetingOn = Boolean(ginaMeetingSession)
      || (Boolean(meta?.meetingMode) && isAdminSessionEmail(userEmail));

    const openByIdMatch = String(text || "").match(/^GinaOpenDocument:(.+)$/);
    const revealByIdMatch = String(text || "").match(/^GinaRevealDocument:(.+)$/);
    if ((openByIdMatch || revealByIdMatch) && !meetingOn) {
      const targetId = (openByIdMatch || revealByIdMatch)[1].trim();
      const plan = openGinaDocumentByNodeId(targetId);
      if (plan) return "";
    }

    // Silent late-start → In progress (status menu). Keeps the recovery Easy Links UI intact.
    if (!meetingOn && /^GinaSilentMarkInProgress\b/i.test(String(text || "").trim())) {
      const now = new Date();
      const today = get_today_scope({
        docs: docsMap,
        nodes: nodesMap,
        departments,
        objectId: activeObjectId || filterObjectId || null,
        now,
        userId: ginaUserId,
      }, { includeCompleted: false });
      const triage = partitionTodayByClock(today.documents || [], now);
      const slots = Array.isArray(triage.lateStartActive) ? triage.lateStartActive : [];
      const updateNode = useNodesStore.getState().updateNode;
      let applied = 0;
      for (const slot of slots) {
        if (!slot?.id) continue;
        updateNode(slot.id, syncDocWorkStatusFields({ status: DOC_WORK_STATUS.IN_PROGRESS }));
        applied += 1;
      }
      // Empty string = no chat bubbles; menu stays on screen.
      return "";
    }

    if (meetingOn && ginaPendingLearn && isGinaLearnSaveConfirm(text)) {
      addLocalGinaKnowledge({ ...ginaPendingLearn, source: "taught" });
      setGinaPendingLearn(null);
      return {
        message: locale === "es"
          ? `Listo — guardé «${ginaPendingLearn.title}» en Knowledge. Hazme el test cuando quieras.`
          : `Saved “${ginaPendingLearn.title}” to Knowledge. Quiz me whenever you want.`,
        visualization: null,
        learnProposal: null,
      };
    }

    if (meetingOn && meta?.saveLearnProposal && meta.learnProposal?.body) {
      addLocalGinaKnowledge({ ...meta.learnProposal, source: "taught" });
      setGinaPendingLearn(null);
      return {
        message: locale === "es"
          ? `Listo — guardé «${meta.learnProposal.title}» en Knowledge.`
          : `Saved “${meta.learnProposal.title}” to Knowledge.`,
        visualization: null,
        learnProposal: null,
      };
    }

    const ctx = {
      docs: docsMap,
      nodes: nodesMap,
      departments,
      objectId: activeObjectId || filterObjectId || null,
      corpusName: activeObject?.name || null,
      now: new Date(),
      userId: ginaUserId,
      recentText: Array.isArray(meta?.messages)
        ? meta.messages.slice(-8).map((m) => String(m?.content || "")).filter(Boolean)
        : [],
    };
    const routed = runGinaQueryFamily(text, ctx);
    const localeKey = locale === "es" ? "es" : "en";
    stampGinaLastTurnFromRouted(routed, {
      objectId: ctx.objectId || null,
      userText: text,
    });

    if (!meetingOn && isGinaWarmGoodbye(text)) {
      return {
        message: buildGinaWarmGoodbyeReply(localeKey),
        visualization: null,
        chips: null,
      };
    }

    if (!meetingOn && routed.family === "wall_clock") {
      const clockNow = routed.toolContext?.nowIso
        ? new Date(routed.toolContext.nowIso)
        : ctx.now;
      return {
        message: formatGinaWallClockMessage(clockNow, localeKey),
        visualization: null,
        chips: null,
      };
    }

    if (
      !meetingOn
      && (routed.family === "last_turn_modify" || routed.family === "last_turn_missing")
    ) {
      const docs = Array.isArray(routed.toolContext?.documents)
        ? routed.toolContext.documents
        : [];
      return {
        message: buildLastTurnModifyMessage({
          locale: localeKey,
          hasLastTurn: routed.family === "last_turn_modify",
          refKind: routed.toolContext?.refKind || null,
          documents: docs,
        }),
        visualization: null,
        chips: buildLastTurnModifyChips({
          locale: localeKey,
          documents: docs,
        }),
      };
    }

    if (!meetingOn && routed.family === "daily_report_skip_move") {
      return {
        message: localeKey === "en"
          ? "Okay — we’ll leave the overlapping times as they are."
          : "Va — dejamos los horarios en conflicto como están.",
        visualization: null,
        chips: [
          {
            id: "today_schedule",
            label: localeKey === "en" ? "Today's schedule" : "Horarios de hoy",
            text: localeKey === "en" ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
          },
        ],
      };
    }

    if (!meetingOn && (
      routed.family === "daily_report"
      || routed.family === "daily_report_move"
    )) {
      const report = routed.toolContext?.dailyReport || null;
      const visualization = buildGinaVisualization(
        routed.family,
        {
          dailyReport: report,
          proposals: routed.toolContext?.proposals || report?.proposals,
        },
        { locale: localeKey, now: ctx.now, userText: text },
      );
      const message = routed.family === "daily_report"
        ? buildDailyReportOfferText({
          locale: localeKey,
          isEmpty: Boolean(report?.isEmpty),
          dayComplete: Boolean(report?.dayComplete),
          conflictCount: report?.conflictCount || 0,
          occupiedCount: report?.occupiedCount || 0,
          pendingCount: report?.pendingCount || 0,
          struckCount: report?.struckCount || 0,
          folderProgress: report?.folderProgress || [],
          hasRoomToday: Boolean(report?.hasRoomToday),
          lastFinishAt: report?.lastFinishAt || null,
          hasDetails: Boolean(visualization),
        })
        : (buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en" ? "Here’s a preview of the move." : "Aquí va la vista previa del movimiento."));
      return {
        message,
        visualization,
        chips: buildGinaReplyChips({
          family: routed.family,
          visualization: visualization || {
            type: "daily_report",
            data: { isEmpty: true },
          },
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "daily_report_move_confirm") {
      const updateNode = useNodesStore.getState().updateNode;
      const proposals = Array.isArray(routed.toolContext?.proposals)
        ? routed.toolContext.proposals
        : [];
      for (const row of proposals) {
        if (!row?.id || !row.proposedAnchorAt) continue;
        updateNode(row.id, {
          anchorAt: row.proposedAnchorAt,
          anchorFinishAt: row.proposedAnchorFinishAt || null,
        });
      }
      try {
        markDailyReportOpened(ginaUserId, ctx.now);
      } catch { /* ignore */ }
      const visualization = buildGinaVisualization("daily_report_move", {
        dailyReport: routed.toolContext?.dailyReport,
        proposals,
        applied: true,
      }, { locale: localeKey, now: ctx.now, userText: text });
      return {
        message: buildDailyReportAppliedText({
          count: proposals.length,
          locale: localeKey,
        }),
        visualization,
        chips: buildGinaReplyChips({
          family: "daily_report_move_confirm",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "schedule_recovery_skip") {
      try { clearPendingGinaOffer(); } catch { /* ignore */ }
      const now = ctx.now;
      const todayScope = get_today_scope({
        ...ctx,
        now,
      }, { includeCompleted: true });
      const dayReadyViz = buildGinaVisualization("today", {
        ...todayScope,
        postRescheduleDaySheet: true,
      }, {
        locale: localeKey,
        now,
        postRescheduleDaySheet: true,
        userText: localeKey === "en" ? "What do we have for today?" : "qué tenemos para hoy?",
      });
      return {
        message: localeKey === "en"
          ? "Done — we’ll leave the schedule as it is for now."
          : "Listo, entonces dejamos el horario como está por ahora.",
        textAfter: localeKey === "en"
          ? "What do you want to do next?"
          : "¿Qué es lo siguiente que quieres hacer?",
        visualization: null,
        voiceSequence: "leave_schedule",
        chips: buildGinaReplyChips({
          family: "today",
          visualization: dayReadyViz,
          locale: localeKey,
          hasDaySheet: hasDaySheet(ginaUserId, now),
          recoverySnoozed: true,
        }),
      };
    }

    const recoveryDocDurationMs = (doc) => {
      const a = doc?.anchorAt ? new Date(doc.anchorAt).getTime() : NaN;
      const f = doc?.anchorFinishAt ? new Date(doc.anchorFinishAt).getTime() : NaN;
      if (Number.isFinite(a) && Number.isFinite(f) && f > a) return f - a;
      return 60 * 60 * 1000;
    };

    const applySequentialAnchors = (docs, startMs, updateNode) => {
      let cursor = startMs;
      let count = 0;
      for (const doc of docs) {
        if (!doc?.id) continue;
        const dur = recoveryDocDurationMs(doc);
        updateNode(doc.id, {
          anchorAt: new Date(cursor).toISOString(),
          anchorFinishAt: new Date(cursor + dur).toISOString(),
        });
        cursor += dur;
        count += 1;
      }
      return count;
    };

    const finishRecoveryAfterMutation = (
      appliedIntent,
      appliedCount,
      ackOverride = null,
      opts = {},
    ) => {
      const now = ctx.now;
      const freshNodes = useNodesStore.getState().nodes || {};
      const freshDocs = useDocsStore.getState().docs || {};
      const todayScope = get_today_scope({
        ...ctx,
        nodes: freshNodes,
        docs: freshDocs,
        now,
      }, { includeCompleted: false });
      const overlapAfter = summarizeTodayOverlaps(todayScope.documents || [], now);
      const forceDayReady = Boolean(opts.forceDayReady);
      const followUp = resolvePostMutationRecoveryFollowUp({
        forceDayReady,
        hasOverlap: Boolean(overlapAfter.hasOverlap),
      });

      const nextViz = followUp === "conflict_resolve"
        ? buildGinaVisualization("schedule_recovery_next", todayScope, {
          locale: localeKey,
          now,
          userText: localeKey === "en"
            ? "Continue to next schedule recovery step"
            : "Seguir al siguiente paso de recuperación",
        })
        : null;
      const nextData = nextViz?.data || {};
      const applied = ackOverride || buildScheduleRecoveryAppliedText(appliedIntent, {
        count: appliedCount,
        locale: localeKey,
      });

      if (followUp === "conflict_resolve" && nextData.currentStep === "conflict_resolve") {
        const stepText = buildScheduleRecoveryStepText({
          locale: localeKey,
          currentStep: nextData.currentStep,
          urgencyCount: nextData.urgencyCount || 0,
          lateStartCount: nextData.lateStartCount || 0,
          lateStartLabels: nextData.lateStartLabels || [],
          hasOverlap: Boolean(nextData.hasOverlap || nextData.conflictRails),
          overdueTimes: nextData.overdueTimes || [],
          overdueTitles: nextData.overdueTitles || [],
          recoveryOfferMode: nextData.recoveryOfferMode,
          conflictRangeLabel: nextData.conflictRangeLabel || null,
          invadedLabels: nextData.invadedLabels || [],
        });
        return {
          message: `${applied}\n\n${stepText}`,
          visualization: nextViz,
          chips: buildGinaReplyChips({
            family: "schedule_recovery_next",
            visualization: nextViz,
            locale: localeKey,
            recoverySnoozed: isRecoveryNotifySnoozed(ginaUserId, now),
          }),
        };
      }

      const todayOverviewScope = get_today_scope({
        ...ctx,
        nodes: freshNodes,
        docs: freshDocs,
        now,
      }, { includeCompleted: true });
      const dayReadyViz = buildGinaVisualization("today", {
        ...todayOverviewScope,
        postRescheduleDaySheet: true,
      }, {
        locale: localeKey,
        now,
        postRescheduleDaySheet: true,
        userText: localeKey === "en" ? "What do we have for today?" : "qué tenemos para hoy?",
      });
      const qs = dayReadyViz?.data?.quickSheet || null;
      const readyMessage = buildRescheduleDayReadyText({ locale: localeKey });
      try {
        anchorDaySheetFromTodayDocs(ginaUserId, dayReadyViz?.data?.documents || [], {
          now,
          source: "dashboard_today_ritual",
        });
      } catch { /* ignore */ }
      const post = buildTodayOverviewPostTableCopy({
        quickSheet: qs,
        documents: dayReadyViz?.data?.documents || [],
        overviewByDepartment: dayReadyViz?.data?.overviewByDepartment || [],
        totalMinutes: dayReadyViz?.data?.totalMinutes,
        totalHoursLabel: dayReadyViz?.data?.totalHoursLabel,
        locale: localeKey,
        userId: ginaUserId,
        hasDaySheet: true,
        hasRecoveryOffer: false,
        urgencyCount: 0,
        lateStartCount: 0,
        hasOverlap: false,
        recoverySnoozed: true,
        forceCleanDay: true,
        offerDayReady: true,
        talkNotificationsDecided: hasTalkNotificationsDecision(ginaUserId, now),
      });

      // Reschedule apply ack is self-contained — do not append dayReady.
      const message = ackOverride ? applied : readyMessage;

      return {
        message,
        visualization: dayReadyViz,
        chips: buildGinaReplyChips({
          family: "today",
          visualization: dayReadyViz,
          locale: localeKey,
          hasDaySheet: true,
          recoverySnoozed: true,
          talkNotificationsDecided: hasTalkNotificationsDecision(ginaUserId, now),
        }),
        textMid: null,
        textAfter: post.textAfter,
        textAfterLead: post.textAfterLead,
        textAfterRest: post.textAfterRest,
        startDocLines: post.startDocLines,
        textPitch: null,
      };
    };

    if (!meetingOn && (
      routed.family === "schedule_recovery_brief"
      || routed.family === "schedule_recovery_next"
    )) {
      if (routed.family === "schedule_recovery_brief") {
        try { clearRecoveryNotifySnooze(ginaUserId); } catch { /* ignore */ }
      }
      const visualization = buildGinaVisualization(routed.family, {
        ...routed.toolContext,
        nodes: ctx.nodes,
        docs: ctx.docs,
        objectId: ctx.objectId,
      }, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const data = visualization?.data || {};
      const stepText = buildScheduleRecoveryStepText({
        locale: localeKey,
        currentStep: data.currentStep,
        urgencyCount: data.urgencyCount || 0,
        lateStartCount: data.lateStartCount || 0,
        lateStartLabels: data.lateStartLabels || [],
        recoveryOfferMode: data.recoveryOfferMode,
        hasOverlap: Boolean(data.hasOverlap || data.conflictRails),
        overdueTimes: data.overdueTimes || [],
        overdueTitles: data.overdueTitles || [],
        topConflict: data.topConflict || null,
        conflictRangeLabel: data.conflictRangeLabel || null,
        invadedLabels: data.invadedLabels || [],
      });
      const isNext = routed.family === "schedule_recovery_next";
      const introText = buildScheduleRecoveryIntroText({
        locale: localeKey,
        urgencyCount: data.urgencyCount || 0,
        lateStartCount: data.lateStartCount || 0,
        hasOverlap: Boolean(data.hasOverlap)
          || Boolean(data.conflictRails)
          || data.currentStep === "conflict_resolve",
      });
      // startDocLines already delivered on today overview — omit duplicate on recovery brief.
      return {
        message: isNext ? stepText : introText,
        textAfter: null,
        textAfterRest: isNext || data.currentStep === "summary" ? null : stepText,
        startDocLines: null,
        visualization,
        chips: buildGinaReplyChips({
          family: routed.family,
          visualization,
          locale: localeKey,
          recoverySnoozed: isRecoveryNotifySnoozed(ginaUserId, ctx.now),
        }),
      };
    }

    if (!meetingOn && (
      routed.family === "schedule_recovery_mark"
      || routed.family === "schedule_recovery_postpone"
      || routed.family === "schedule_recovery_complete"
      || routed.family === "schedule_recovery_in_progress"
    )) {
      const visualization = buildGinaVisualization(routed.family, routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en" ? "Review the preview, then confirm." : "Revisa la vista previa y confirma.");
      return {
        message,
        visualization,
        chips: buildGinaReplyChips({
          family: routed.family,
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "schedule_recovery_snooze") {
      const now = ctx.now instanceof Date ? ctx.now : new Date();
      const tc = routed.toolContext || {};
      let durationMs = 30 * 60 * 1000;
      let minutes = 30;
      let untilLabel = null;

      if (tc.snoozeUntilFreeGap) {
        const dateKey = calendarDateInputValue(now);
        const occupied = listOccupiedIntervalsByDate(ctx.nodes, ctx.docs, dateKey, {
          objectId: ctx.objectId || null,
        });
        const dayEnd = new Date(`${dateKey}T23:59:59`).getTime();
        const free = findFirstFreeSlot(occupied, 15 * 60 * 1000, now.getTime(), dayEnd);
        if (free?.startMs && free.startMs > now.getTime()) {
          durationMs = free.startMs - now.getTime();
          minutes = Math.max(1, Math.round(durationMs / 60000));
          untilLabel = formatClock12h(new Date(free.startMs));
        } else {
          durationMs = 60 * 60 * 1000;
          minutes = 60;
        }
      } else if (tc.snoozeUntilHhmm) {
        const [hh, mm] = String(tc.snoozeUntilHhmm).split(":").map((x) => Number(x));
        const target = new Date(now);
        target.setHours(hh || 0, mm || 0, 0, 0);
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        durationMs = Math.max(60_000, target.getTime() - now.getTime());
        minutes = Math.max(1, Math.round(durationMs / 60000));
        untilLabel = formatClock12h(target);
      } else if (Number.isFinite(Number(tc.snoozeMinutes)) && Number(tc.snoozeMinutes) > 0) {
        minutes = Number(tc.snoozeMinutes);
        durationMs = minutes * 60 * 1000;
      }

      try { setRecoveryNotifySnooze(ginaUserId, now, durationMs); } catch { /* ignore */ }
      const visualization = buildGinaVisualization("schedule_recovery_next", {
        ...routed.toolContext,
        nodes: ctx.nodes,
        docs: ctx.docs,
        objectId: ctx.objectId,
      }, {
        locale: localeKey,
        now,
        userText: localeKey === "en"
          ? "Continue to next schedule recovery step"
          : "Seguir al siguiente paso de recuperación",
      });
      const data = visualization?.data || {};
      const stepText = buildScheduleRecoveryStepText({
        locale: localeKey,
        currentStep: data.currentStep,
        urgencyCount: data.urgencyCount || 0,
        lateStartCount: data.lateStartCount || 0,
        lateStartLabels: data.lateStartLabels || [],
        hasOverlap: Boolean(data.hasOverlap || data.conflictRails),
        overdueTimes: data.overdueTimes || [],
        overdueTitles: data.overdueTitles || [],
        recoveryOfferMode: data.recoveryOfferMode,
        topConflict: data.topConflict || null,
        conflictRangeLabel: data.conflictRangeLabel || null,
        invadedLabels: data.invadedLabels || [],
      });
      const snoozeText = buildRecoverySnoozeText({
        locale: localeKey,
        minutes: untilLabel ? null : minutes,
        untilLabel,
      });
      return {
        message: data.currentStep && data.currentStep !== "summary"
          ? `${snoozeText}\n\n${stepText}`
          : snoozeText,
        visualization,
        chips: buildGinaReplyChips({
          family: "schedule_recovery_next",
          visualization,
          locale: localeKey,
          recoverySnoozed: true,
        }),
      };
    }

    if (!meetingOn && routed.family === "schedule_recovery_reschedule_fork") {
      return {
        message: buildRescheduleForkText({ locale: localeKey }),
        visualization: null,
        chips: buildRescheduleForkChips({ locale: localeKey }),
      };
    }

    if (!meetingOn && routed.family === "schedule_recovery_reschedule_pick") {
      const pendingSession = getPendingGinaOffer();
      const sessionFromPending = pendingSession?.type === "reschedule_session"
        ? pendingSession.sessionMoveDocIds
        : null;
      const rescheduleMode = routed.toolContext?.rescheduleMode === "cascade"
        ? "cascade"
        : "gaps";
      // Gaps can reuse a pending expired session; cascade always rebuilds from today's non-completed.
      const visualization = buildGinaVisualization("schedule_recovery_reschedule_pick", {
        ...routed.toolContext,
        nodes: ctx.nodes,
        docs: ctx.docs,
        objectId: ctx.objectId,
        rescheduleMode,
        sessionMoveDocIds: rescheduleMode === "cascade"
          ? (routed.toolContext?.sessionMoveDocIds || undefined)
          : (routed.toolContext?.sessionMoveDocIds || sessionFromPending || undefined),
        cascadeMoveDocIds: routed.toolContext?.cascadeMoveDocIds || undefined,
        assignedDocIds: routed.toolContext?.assignedDocIds
          || (pendingSession?.type === "reschedule_session" && rescheduleMode !== "cascade"
            ? pendingSession.assignedDocIds
            : undefined),
        activeDocId: routed.toolContext?.activeDocId || undefined,
      }, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const data = visualization?.data || {};
      if (data.rescheduleBlockedActive) {
        const stepText = buildScheduleRecoveryStepText({
          locale: localeKey,
          currentStep: "overdue_check",
          urgencyCount: 0,
          lateStartCount: data.lateStartCount || 0,
          lateStartLabels: data.lateStartLabels || [],
          recoveryOfferMode: "late_start",
        });
        const blockedNote = localeKey === "en"
          ? "That block is still inside its time window — there’s nothing to reschedule as expired. Open it or mark In progress."
          : "Ese bloque sigue dentro de su ventana — no hay nada que reagendar como vencido. Ábrelo o pásalo a En Progreso.";
        return {
          message: blockedNote,
          textAfter: stepText,
          visualization,
          chips: buildGinaReplyChips({
            family: "schedule_recovery_brief",
            visualization,
            locale: localeKey,
            recoverySnoozed: isRecoveryNotifySnoozed(ginaUserId, ctx.now),
          }),
        };
      }
      try {
        setPendingGinaOffer({
          type: "reschedule_session",
          sessionMoveDocIds: visualization?.data?.sessionMoveDocIds || [],
          assignedDocIds: visualization?.data?.assignedDocIds || [],
          rescheduleMode: visualization?.data?.rescheduleMode || rescheduleMode,
        });
      } catch { /* ignore */ }
      return {
        message: buildReschedulePickerText({
          locale: localeKey,
          mode: visualization?.data?.rescheduleMode === "cascade" ? "cascade" : "gaps",
          hasFreeSlot: Boolean(visualization?.data?.hasFreeSlot) && !visualization?.data?.noCupo,
          noCupo: Boolean(visualization?.data?.noCupo),
          activeTitle: visualization?.data?.activeTitle || null,
        }),
        visualization,
        chips: buildGinaReplyChips({
          family: routed.family,
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "schedule_recovery_reschedule_apply") {
      const updateNode = useNodesStore.getState().updateNode;
      const now = ctx.now instanceof Date ? ctx.now : new Date();
      const docsBefore = Array.isArray(routed.toolContext?.documents)
        ? routed.toolContext.documents
        : [];
      const triageBefore = partitionTodayByClock(docsBefore, now);
      const expiredBefore = triageBefore.fullyExpired.filter((d) => d.status !== "past_due");
      const mode = routed.toolContext?.mode || "slot";
      const batchApplies = Array.isArray(routed.toolContext?.batchApplies)
        ? routed.toolContext.batchApplies.filter((a) => a?.id && a?.startIso && a?.finishIso)
        : [];
      const applyDocId = routed.toolContext?.applyDocId
        || batchApplies[0]?.id
        || expiredBefore[0]?.id
        || null;
      const pendingSession = getPendingGinaOffer();
      const sessionMoveDocIds = (
        Array.isArray(routed.toolContext?.sessionMoveDocIds)
          && routed.toolContext.sessionMoveDocIds.length
          ? routed.toolContext.sessionMoveDocIds
          : (pendingSession?.type === "reschedule_session"
            && Array.isArray(pendingSession.sessionMoveDocIds)
            && pendingSession.sessionMoveDocIds.length
            ? pendingSession.sessionMoveDocIds
            : expiredBefore.map((d) => d.id).filter(Boolean))
      ).map((id) => String(id));

      const targetDoc = (applyDocId
        ? docsBefore.find((d) => String(d.id) === String(applyDocId))
        : null)
        || expiredBefore[0]
        || null;
      const targets = targetDoc ? [targetDoc] : [];

      let timeLabel = "";
      let dayLabel = "";
      let appliedTitle = targetDoc?.title || "";
      let appliedCountLocal = 0;

      if (mode === "tomorrow" && targets.length) {
        const start = new Date(now);
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        applySequentialAnchors(targets, start.getTime(), updateNode);
        timeLabel = formatClock12h(start);
        dayLabel = localeKey === "en" ? "tomorrow" : "mañana";
        appliedCountLocal = targets.length;
      } else if (mode === "force_end" && targets.length) {
        const dateKey = calendarDateInputValue(now);
        const occupied = listOccupiedIntervalsByDate(ctx.nodes, ctx.docs, dateKey, {
          objectId: ctx.objectId || null,
        }).filter((o) => String(o.id) !== String(targets[0].id));
        const startMs = lastOccupiedFinishMs(occupied, now.getTime());
        applySequentialAnchors(targets, startMs, updateNode);
        timeLabel = formatClock12h(new Date(startMs));
        appliedCountLocal = targets.length;
      } else if (batchApplies.length > 0) {
        const labels = [];
        for (const row of batchApplies) {
          const startMs = new Date(row.startIso).getTime();
          const finishMs = new Date(row.finishIso).getTime();
          if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs <= startMs) continue;
          updateNode(row.id, {
            anchorAt: new Date(startMs).toISOString(),
            anchorFinishAt: new Date(finishMs).toISOString(),
          });
          appliedCountLocal += 1;
          const doc = docsBefore.find((d) => String(d.id) === String(row.id));
          if (doc?.title) appliedTitle = doc.title;
          labels.push(formatClockRange12h(
            new Date(startMs).toISOString(),
            new Date(finishMs).toISOString(),
            { sep: " – " },
          ));
        }
        timeLabel = labels.filter(Boolean).join(", ");
      } else if (targets.length) {
        const startIso = routed.toolContext?.applyStartIso;
        const finishIso = routed.toolContext?.applyFinishIso;
        const startMs = startIso ? new Date(startIso).getTime() : NaN;
        const finishMs = finishIso ? new Date(finishIso).getTime() : NaN;
        if (Number.isFinite(startMs) && Number.isFinite(finishMs) && finishMs > startMs) {
          updateNode(targets[0].id, {
            anchorAt: new Date(startMs).toISOString(),
            anchorFinishAt: new Date(finishMs).toISOString(),
          });
          timeLabel = formatClockRange12h(
            new Date(startMs).toISOString(),
            new Date(finishMs).toISOString(),
            { sep: " – " },
          );
          appliedCountLocal = 1;
        } else if (Number.isFinite(startMs)) {
          applySequentialAnchors(targets, startMs, updateNode);
          const dur = recoveryDocDurationMs(targets[0]);
          timeLabel = formatClockRange12h(
            new Date(startMs).toISOString(),
            new Date(startMs + dur).toISOString(),
            { sep: " – " },
          );
          appliedCountLocal = 1;
        }
      }

      const freshNodes = useNodesStore.getState().nodes || {};
      const freshDocs = useDocsStore.getState().docs || {};
      const todayScope = get_today_scope({
        ...ctx,
        nodes: freshNodes,
        docs: freshDocs,
        now,
      }, { includeCompleted: false });
      const triageAfter = partitionTodayByClock(todayScope.documents || [], now);
      const actionableAfter = new Set(
        triageAfter.actionable.map((d) => String(d.id || "")).filter(Boolean),
      );
      const remainingIds = sessionMoveDocIds.filter((id) => actionableAfter.has(id));
      const assignedDocIds = sessionMoveDocIds.filter((id) => !actionableAfter.has(id));
      const assignedCount = assignedDocIds.length || appliedCountLocal;

      if (remainingIds.length > 0) {
        const nextId = remainingIds[0];
        const nextDoc = (todayScope.documents || []).find((d) => String(d.id) === nextId);
        const visualization = buildGinaVisualization("schedule_recovery_reschedule_pick", {
          ...todayScope,
          nodes: freshNodes,
          docs: freshDocs,
          objectId: ctx.objectId,
          sessionMoveDocIds,
          assignedDocIds,
          activeDocId: nextId,
        }, {
          locale: localeKey,
          now,
          userText: text,
        });
        try {
          setPendingGinaOffer({
            type: "reschedule_session",
            sessionMoveDocIds,
            assignedDocIds,
          });
        } catch { /* ignore */ }
        return {
          message: buildRescheduleProgressText({
            locale: localeKey,
            title: appliedTitle,
            timeLabel,
            nextTitle: nextDoc?.title || visualization?.data?.activeTitle || null,
            remaining: remainingIds.length,
          }),
          visualization,
          chips: buildGinaReplyChips({
            family: "schedule_recovery_reschedule_pick",
            visualization,
            locale: localeKey,
          }),
        };
      }

      try { clearPendingGinaOffer(); } catch { /* ignore */ }
      const overlapAfterApply = summarizeTodayOverlaps(todayScope.documents || [], now);
      return finishRecoveryAfterMutation(
        "postpone_schedule",
        assignedCount || 1,
        buildRescheduleAppliedText({
          locale: localeKey,
          timeLabel,
          dayLabel,
          count: assignedCount || appliedCountLocal || 1,
          withoutOverlaps: !overlapAfterApply.hasOverlap,
        }),
        // Never bounce back into the same conflict wizard after the user just applied slots.
        { forceDayReady: true },
      );
    }

    if (!meetingOn && (
      routed.family === "schedule_recovery_mark_confirm"
      || routed.family === "schedule_recovery_postpone_confirm"
      || routed.family === "schedule_recovery_complete_confirm"
      || routed.family === "schedule_recovery_in_progress_confirm"
    )) {
      const updateNode = useNodesStore.getState().updateNode;
      const now = ctx.now;
      let appliedIntent = "mark_past_due";
      let appliedCount = 0;

      if (routed.family === "schedule_recovery_complete_confirm") {
        appliedIntent = "mark_completed";
        const slots = Array.isArray(routed.toolContext?.markableSlots)
          ? routed.toolContext.markableSlots
          : [];
        appliedCount = slots.length;
        for (const slot of slots) {
          if (!slot?.id) continue;
          updateNode(slot.id, syncDocWorkStatusFields({ status: DOC_WORK_STATUS.COMPLETED }));
        }
      } else if (routed.family === "schedule_recovery_in_progress_confirm") {
        appliedIntent = "mark_in_progress";
        const slots = Array.isArray(routed.toolContext?.lateStartSlots)
          ? routed.toolContext.lateStartSlots
          : [];
        appliedCount = slots.length;
        for (const slot of slots) {
          if (!slot?.id) continue;
          updateNode(slot.id, syncDocWorkStatusFields({ status: DOC_WORK_STATUS.IN_PROGRESS }));
        }
      } else if (routed.family === "schedule_recovery_mark_confirm") {
        appliedIntent = "mark_past_due";
        const slots = Array.isArray(routed.toolContext?.markableSlots)
          ? routed.toolContext.markableSlots
          : [];
        appliedCount = slots.length;
        for (const slot of slots) {
          if (!slot?.id) continue;
          updateNode(slot.id, syncDocWorkStatusFields({ status: DOC_WORK_STATUS.PAST_DUE }));
        }
      } else {
        appliedIntent = "postpone_schedule";
        const todayDocs = Array.isArray(routed.toolContext?.documents)
          ? routed.toolContext.documents
          : [];
        const cascade = buildCascadeSchedulePreview(todayDocs, now);
        appliedCount = cascade.length;
        for (const row of cascade) {
          if (!row?.id) continue;
          updateNode(row.id, {
            anchorAt: row.proposedAnchorAt,
            anchorFinishAt: row.proposedAnchorFinishAt,
          });
        }
      }

      return finishRecoveryAfterMutation(appliedIntent, appliedCount);
    }

    // Day talk notifications (opt-in / skip / popover notify) — deterministic, no Groq.
    if (!meetingOn && (
      routed.family === "gina_day_ritual_reset"
      || routed.family === "gina_talk_notifications_enable"
      || routed.family === "gina_talk_notifications_skip"
      || routed.family === "gina_talk_request"
      || routed.family === "gina_talk_request_thanks"
    )) {
      if (routed.family === "gina_day_ritual_reset") {
        return {
          message: buildGinaDayRitualResetAck(localeKey),
          visualization: null,
          chips: [
            {
              id: "today_after_reset",
              label: localeKey === "en" ? "What do we have for today?" : "qué tenemos para hoy",
              text: localeKey === "en" ? "What do we have for today?" : "qué tenemos para hoy",
              primary: true,
            },
          ],
        };
      }
      if (
        routed.family === "gina_talk_notifications_enable"
        || routed.family === "gina_talk_notifications_skip"
      ) {
        const today = get_today_scope(ctx, { includeCompleted: true });
        const next = pickNextDaySheetDoc(today.documents || []);
        const nextChips = buildScheduleSheetChips({
          locale: localeKey,
          todayOverview: true,
          talkNotificationsDecided: true,
          nextDocumentId: next?.id || null,
          nextDocumentTitle: next?.title || "",
          quickSheet: {
            isCleanDay: true,
            firstPendingId: next?.id || null,
            firstPendingTitle: next?.title || "",
            pending: next ? [{ id: next.id, title: next.title }] : [],
          },
        });
        return {
          message: routed.family === "gina_talk_notifications_enable"
            ? buildTalkNotificationsEnabledAck(localeKey)
            : buildTalkNotificationsSkippedAck(localeKey),
          visualization: null,
          chips: nextChips.length ? nextChips : null,
        };
      }
      if (routed.family === "gina_talk_request_thanks") {
        return {
          message: buildTalkRequestThanksText(localeKey),
          visualization: null,
          chips: null,
        };
      }
      const next = routed.toolContext?.nextDocument || null;
      const daySheetViz = buildGinaVisualization("day_sheet", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const visualization = daySheetViz
        ? {
          ...daySheetViz,
          data: {
            ...(daySheetViz.data || {}),
            compact: true,
            locale: localeKey,
            talkRequestNotify: true,
          },
        }
        : null;
      return {
        message: buildTalkRequestNotifyText({ locale: localeKey }),
        startDocLines: buildTalkRequestNotifyStartDocLines(next, localeKey),
        visualization,
        chips: buildTalkRequestNotifyChips({ locale: localeKey }),
      };
    }

    if (!meetingOn && (
      routed.family === "day_sheet"
      || routed.family === "day_sheet_skip_save"
      || routed.family === "day_sheet_next"
      || routed.family === "day_sheet_complete"
      || routed.family === "day_sheet_complete_confirm"
    )) {
      const daySheetAnchored = hasDaySheet(ginaUserId, ctx.now);

      if (routed.family === "day_sheet_skip_save") {
        const visualization = buildGinaVisualization("today", routed.toolContext, {
          locale: localeKey,
          now: ctx.now,
          userText: text,
        });
        const next = routed.toolContext?.nextDocument || null;
        const qs = visualization?.data?.quickSheet || null;
        return {
          message: localeKey === "en"
            ? "Got it — we’ll continue without saving the day sheet."
            : "Va, seguimos sin guardar el sheet.",
          visualization,
          chips: buildGinaReplyChips({
            family: "today",
            visualization,
            locale: localeKey,
            hasDaySheet: false,
            allowOpenWithoutSave: true,
            nextDocumentId: next?.id || qs?.firstPendingId || null,
            nextDocumentTitle: next?.title || qs?.firstPendingTitle || "",
          }),
        };
      }

      if (routed.family === "day_sheet_complete_confirm") {
        const updateNode = useNodesStore.getState().updateNode;
        const doc = routed.toolContext?.document || null;
        const docId = doc?.id || routed.toolContext?.documentId || null;
        consumePendingGinaOffer();
        if (docId) {
          updateNode(docId, syncDocWorkStatusFields({ status: DOC_WORK_STATUS.COMPLETED }));
        }
        const title = doc?.title || (localeKey === "en" ? "the document" : "el documento");
        const pool = Array.isArray(routed.toolContext?.documents)
          ? routed.toolContext.documents.map((d) => (
            d.id === docId
              ? { ...d, status: DOC_WORK_STATUS.COMPLETED, completed: true }
              : d
          ))
          : [];
        const next = pickNextDaySheetDoc(pool);
        const progress = summarizeDaySheetProgress(pool);
        const visualization = buildGinaVisualization("day_sheet", {
          ...routed.toolContext,
          documents: pool,
          progress,
          justSaved: false,
          missingAnchor: false,
          nextDocument: next,
        }, { locale: localeKey, now: ctx.now, userText: text });
        const nextLine = next
          ? (localeKey === "en"
            ? ` Next up: **${next.title}**${next.folder ? ` in ${next.folder}` : ""}. Want me to open it?`
            : ` Tu siguiente: **${next.title}**${next.folder ? ` en ${next.folder}` : ""}. ¿Te lo abro?`)
          : (localeKey === "en"
            ? " Nothing left on today’s sheet — nice work."
            : " No queda nada pendiente en el sheet de hoy — buen trabajo.");
        return {
          message: (localeKey === "en"
            ? `Done — **${title}** is completed.`
            : `Listo — **${title}** quedó completed.`)
            + nextLine,
          visualization,
          chips: next
            ? buildGinaReplyChips({
              family: "day_sheet_next",
              visualization: {
                ...visualization,
                data: {
                  ...(visualization?.data || {}),
                  nextDocumentId: next.id,
                },
              },
              locale: localeKey,
              nextDocumentId: next.id,
              nextDocumentTitle: next.title,
              hasDaySheet: true,
            })
            : buildGinaReplyChips({
              family: "day_sheet",
              visualization,
              locale: localeKey,
              hasDaySheet: true,
            }),
        };
      }

      if (routed.family === "day_sheet_next") {
        const next = routed.toolContext?.nextDocument || null;
        const visualization = buildGinaVisualization("day_sheet_next", routed.toolContext, {
          locale: localeKey,
          now: ctx.now,
          userText: text,
        });
        const message = next
          ? (localeKey === "en"
            ? `Your next document is **${next.title}**${next.folder ? ` (folder ${next.folder})` : ""}. Want me to open it?`
            : `Tu siguiente documento es **${next.title}**${next.folder ? ` (folder ${next.folder})` : ""}. ¿Quieres que te lo abra?`)
          : (localeKey === "en"
            ? "You’re done — nothing pending left on the day sheet."
            : "Listo — no queda nada pendiente en el sheet del día.");
        return {
          message,
          visualization,
          chips: buildGinaReplyChips({
            family: "day_sheet_next",
            visualization,
            locale: localeKey,
            nextDocumentId: next?.id || null,
            nextDocumentTitle: next?.title || "",
            hasDaySheet: daySheetAnchored,
          }),
        };
      }

      if (routed.family === "day_sheet_complete") {
        const visualization = buildGinaVisualization("day_sheet_complete", routed.toolContext, {
          locale: localeKey,
          now: ctx.now,
          userText: text,
        });
        const ambiguous = Array.isArray(routed.toolContext?.ambiguous)
          ? routed.toolContext.ambiguous
          : [];
        const doc = routed.toolContext?.document || null;
        let message;
        if (doc) {
          message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
            || (localeKey === "en"
              ? `Got it — I’ll mark **${doc.title}** as completed. Confirm?`
              : `Va — marco **${doc.title}** como completed. ¿Confirmas?`);
        } else if (ambiguous.length) {
          message = localeKey === "en"
            ? "Which document did you finish?"
            : "¿Cuál documento terminaste?";
        } else {
          message = localeKey === "en"
            ? "I couldn’t match that document on today’s sheet. Open the day sheet and name the title."
            : "No encontré ese documento en el sheet de hoy. Abre el sheet del día y dime el título.";
        }
        return {
          message,
          visualization,
          chips: buildGinaReplyChips({
            family: "day_sheet_complete",
            visualization,
            locale: localeKey,
            hasDaySheet: daySheetAnchored,
          }),
        };
      }

      // day_sheet (save / reopen / missing)
      const visualization = buildGinaVisualization("day_sheet", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en" ? "Here’s your day sheet." : "Aquí tienes tu sheet del día.");
      const next = routed.toolContext?.nextDocument || null;
      return {
        message,
        visualization,
        chips: buildGinaReplyChips({
          family: "day_sheet",
          visualization,
          locale: localeKey,
          hasDaySheet: hasDaySheet(ginaUserId, ctx.now),
          nextDocumentId: next?.id || visualization?.data?.nextDocumentId || null,
          nextDocumentTitle: next?.title || "",
          talkNotificationsDecided: hasTalkNotificationsDecision(ginaUserId, ctx.now),
        }),
      };
    }

    if (!meetingOn && routed.family === "focus_open") {
      if (routed.openDocumentId) {
        setGinaDashboardOpen(false);
        onOpenDocument?.(routed.openDocumentId);
        return "";
      }
      if (routed.openFolderId) {
        setGinaDashboardOpen(false);
        onOpenDocument?.(routed.openFolderId);
        return "";
      }
      return locale === "es"
        ? "Dime el título exacto del documento o folder de la lista para enfocarnos en uno solo."
        : "Tell me the exact document or folder title from the list so we focus on one.";
    }

    if (
      !meetingOn
      && (routed.family === "check_doc_free_hours" || routed.family === "activate_occupied_hours")
    ) {
      const visualization = buildGinaVisualization(routed.family, routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildOccupiedHoursReplyMessage({
          mode: routed.toolContext?.mode === "activate" ? "activate" : "check",
          occupied: routed.toolContext?.occupied || [],
          locale: localeKey,
        }),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: routed.family,
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "count_folders") {
      const visualization = buildGinaVisualization("count_folders", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? (routed.toolContext?.empty
            ? "You have zero folders created. Start by creating at least one folder."
            : `We have ${routed.toolContext?.count ?? 0} folders.`)
          : (routed.toolContext?.empty
            ? "Tienes cero secciones de folder creadas. Comienza creando al menos un folder."
            : `Tenemos ${routed.toolContext?.count ?? 0} folders.`));
      return {
        message,
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "count_folders",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "count_categories") {
      const visualization = buildGinaVisualization("count_categories", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? (routed.toolContext?.empty
            ? "You have zero categories created."
            : `We have ${routed.toolContext?.count ?? 0} categories.`)
          : (routed.toolContext?.empty
            ? "Tienes cero categorías creadas."
            : `Tenemos ${routed.toolContext?.count ?? 0} categorías.`));
      return {
        message,
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "count_categories",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "category_scope") {
      const visualization = buildGinaVisualization("category_scope", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? `In ${routed.toolContext?.department || "this department"} — ${routed.toolContext?.category || "category"}.`
          : `En ${routed.toolContext?.department || "este departamento"} — ${routed.toolContext?.category || "categoría"}.`);
      return {
        message,
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "category_scope",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "count_documents") {
      const visualization = buildGinaVisualization("count_documents", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? (routed.toolContext?.empty
            ? "You have zero documents created."
            : `We have ${routed.toolContext?.count ?? 0} documents.`)
          : (routed.toolContext?.empty
            ? "Tienes cero documentos creados."
            : `Tenemos ${routed.toolContext?.count ?? 0} documentos.`));
      return {
        message,
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "count_documents",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "count_departments") {
      const visualization = buildGinaVisualization("count_departments", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? `For ${routed.toolContext?.corpusName || "this workspace"} we have ${routed.toolContext?.count ?? 0} departments.`
          : `Para ${routed.toolContext?.corpusName || "este corpus"} tenemos un total de ${routed.toolContext?.count ?? 0} departamentos.`);
      return {
        message,
        visualization,
        chips: buildGinaReplyChips({
          family: "count_departments",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "find_document") {
      const visualization = buildGinaVisualization("find_document", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const hits = Array.isArray(routed.toolContext?.results)
        ? routed.toolContext.results
        : [];
      // Single live match → guided reveal in Documents (no instant open).
      if (hits.length === 1 && hits[0]?.id) {
        const hit = hits[0];
        requestLeftPanelNavigate({
          panel: "Documents",
          clickFolderView: "subgroups",
          departmentId: hit.departmentId ?? UNASSIGNED_DEPARTMENT_FILTER_ID,
          category: hit.category || "",
          folderId: hit.folderId || null,
          highlightNodeId: hit.id,
        });
      }
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? "I searched your workspace."
          : "Busqué en tu workspace.");
      return {
        message,
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "find_document",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "department") {
      const visualization = buildGinaVisualization("department", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? `From the ${routed.toolContext?.department || "department"} department.`
          : `Del departamento de ${routed.toolContext?.department || "—"}.`);
      return {
        message,
        visualization,
        chips: buildGinaReplyChips({
          family: "department",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (!meetingOn && routed.family === "folder_summary") {
      const visualization = buildGinaVisualization("folder_summary", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
        || (localeKey === "en"
          ? `Here are the documents in ${routed.toolContext?.folderName || "that folder"}.`
          : `Aquí tienes los documentos de ${routed.toolContext?.folderName || "ese folder"}.`);
      return {
        message,
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "folder_summary",
          visualization,
          locale: localeKey,
        }),
      };
    }

    // Empty today (esp. with dept filter) — deterministic copy, never Groq invent.
    if (!meetingOn && routed.family === "today") {
      const docs = Array.isArray(routed.toolContext?.documents)
        ? routed.toolContext.documents
        : [];
      const totalToday = routed.toolContext?.totalDocumentsToday;
      const isEmpty = docs.length === 0
        || totalToday === 0
        || Boolean(routed.toolContext?.empty);
      if (isEmpty) {
        const visualization = buildGinaVisualization("today", routed.toolContext, {
          locale: localeKey,
          now: ctx.now,
          userText: text,
        });
        const message = buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en"
            ? (routed.toolContext?.filters?.department
              ? `Today in ${routed.toolContext.filters.department} there are zero scheduled documents.`
              : "Nothing scheduled for today.")
            : (routed.toolContext?.filters?.department
              ? `Hoy en ${routed.toolContext.filters.department} hay cero documentos programados.`
              : "Hoy no hay trabajo programado."));
        return {
          message,
          visualization,
          ...(shouldUseGinaSearchSequence("today", routed.toolContext)
            ? { searchSequence: buildGinaSearchSequence(localeKey) }
            : {}),
          chips: buildGinaReplyChips({
            family: "today",
            visualization,
            locale: localeKey,
            recoverySnoozed: isRecoveryNotifySnoozed(ginaUserId, ctx.now),
          }),
        };
      }
    }

    // Never send schedule-recovery families to Groq (deterministic client path only).
    if (!meetingOn && String(routed.family || "").startsWith("schedule_recovery_")) {
      const visualization = buildGinaVisualization(routed.family, {
        ...routed.toolContext,
        nodes: ctx.nodes,
        docs: ctx.docs,
        objectId: ctx.objectId,
      }, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildScheduleRecoveryStepText({
          locale: localeKey,
          currentStep: visualization?.data?.currentStep || "overdue_check",
          urgencyCount: visualization?.data?.urgencyCount || 0,
          lateStartCount: visualization?.data?.lateStartCount || 0,
          lateStartLabels: visualization?.data?.lateStartLabels || [],
          recoveryOfferMode: visualization?.data?.recoveryOfferMode,
          hasOverlap: Boolean(visualization?.data?.hasOverlap || visualization?.data?.conflictRails),
          overdueTimes: visualization?.data?.overdueTimes || [],
          overdueTitles: visualization?.data?.overdueTitles || [],
          topConflict: visualization?.data?.topConflict || null,
          conflictRangeLabel: visualization?.data?.conflictRangeLabel || null,
          invadedLabels: visualization?.data?.invadedLabels || [],
        }) || (localeKey === "en"
          ? "Let’s continue with today’s schedule recovery."
          : "Sigamos con la recuperación de la agenda de hoy."),
        visualization,
        chips: buildGinaReplyChips({
          family: routed.family,
          visualization,
          locale: localeKey,
          recoverySnoozed: isRecoveryNotifySnoozed(ginaUserId, ctx.now),
        }),
      };
    }

    try {
      const workspaceInventory = routed.workspaceInventory
        || get_workspace_inventory(ctx);
      const visualization = (meetingOn
        || routed.family === "name_ambiguity"
        || routed.family === "confirm_date"
        || routed.family === "unclear"
        || routed.family === "social"
        || routed.family === "dismiss"
        || routed.family === "wall_clock"
        || routed.family === "last_turn_modify"
        || routed.family === "last_turn_missing"
        || routed.family === "free_chat")
        ? null
        : buildGinaVisualization(
          routed.family === "confirm_continue" ? "inventory" : routed.family,
          routed.family === "confirm_continue"
            ? { inventory: routed.workspaceInventory || routed.toolContext?.inventory, ...(routed.toolContext || {}) }
            : routed.toolContext,
          {
            locale: locale === "es" ? "es" : "en",
            userText: text,
          },
        );

      let meetingBrief = meetingOn ? ginaLearnBrief : null;
      if (meetingOn) {
        const byTitle = resolveGinaLearnBriefByTitle(text, docsMap);
        if (byTitle) {
          meetingBrief = byTitle;
          setGinaLearnBrief(byTitle);
        } else if (!meetingBrief) {
          const fromSelection = resolveGinaLearnBrief({
            selectedCanvasNodeIds,
            canvasNodes,
            nodes: nodesMap,
            docs: docsMap,
          });
          if (fromSelection) {
            meetingBrief = fromSelection;
            setGinaLearnBrief(fromSelection);
          }
        }
      }

      const knowledgeContext = buildGinaKnowledgePromptBlock(docsMap);
      const preserveFamily = routed.family === "social"
        || routed.family === "dismiss"
        || routed.family === "free_chat"
        || routed.family === "confirm_continue"
        || routed.family === "unclear"
        || routed.family === "name_ambiguity"
        || routed.family === "confirm_date";
      const history = Array.isArray(meta.messages) && meta.messages.length
        ? meta.messages
        : [{ role: "user", content: text }];
      const result = await fetchGinaChat({
        messages: history,
        toolContext: routed.toolContext,
        toolsCalled: routed.toolsCalled,
        family: (meetingOn && !preserveFamily) ? "meeting_brief" : routed.family,
        locale: locale === "es" ? "es" : "en",
        visualizationType: visualization?.type || null,
        workspaceInventory,
        meetingMode: meetingOn,
        meetingBrief: meetingBrief || undefined,
        knowledgeContext: knowledgeContext || undefined,
        userName: resolveGinaUserDisplayName(authUser) || undefined,
      });
      const rawReply = typeof result?.reply === "string" && result.reply.trim()
        ? result.reply.trim()
        : (locale === "es"
          ? "No pude narrar el scope. Intenta de nuevo."
          : "Couldn't narrate scope. Try again.");

      const { displayText, learnProposal } = meetingOn
        ? parseGinaLearnReply(rawReply)
        : { displayText: rawReply, learnProposal: null };
      if (learnProposal) setGinaPendingLearn(learnProposal);

      const funnelHeadline = !meetingOn
        ? buildGinaFunnelHeadline(visualization, { locale: localeKey })
        : null;
      const textMid = !meetingOn && visualization?.data?.todayOverview
        ? buildTodayOverviewIntroText(localeKey)
        : null;
      const recoverySnoozed = isRecoveryNotifySnoozed(ginaUserId, ctx.now);
      let daySheetAnchored = hasDaySheet(ginaUserId, ctx.now);
      if (!meetingOn && visualization?.data?.todayOverview) {
        const needsGate = todayOverviewNeedsRecoveryGate({
          quickSheet: visualization.data.quickSheet || null,
          hasRecoveryOffer: Boolean(visualization.data.hasRecoveryOffer),
          urgencyCount: visualization.data.urgencyCount,
          lateStartCount: visualization.data.lateStartCount,
          hasOverlap: Boolean(visualization.data.hasOverlap || visualization.data.conflictRails),
          recoverySnoozed,
        });
        if (!needsGate) {
          try {
            anchorDaySheetFromTodayDocs(ginaUserId, visualization.data.documents || [], {
              now: ctx.now,
              source: "dashboard_today_ritual",
            });
            daySheetAnchored = true;
          } catch { /* ignore */ }
        }
      }
      const talkNotifsDecided = hasTalkNotificationsDecision(ginaUserId, ctx.now);
      const postTable = !meetingOn && visualization?.data?.todayOverview
        ? buildTodayOverviewPostTableCopy({
          quickSheet: visualization.data.quickSheet || null,
          documents: visualization.data.documents || [],
          overviewByDepartment: visualization.data.overviewByDepartment || [],
          totalMinutes: visualization.data.totalMinutes,
          totalHoursLabel: visualization.data.totalHoursLabel,
          locale: localeKey,
          userId: ginaUserId,
          hasDaySheet: daySheetAnchored,
          hasRecoveryOffer: Boolean(visualization.data.hasRecoveryOffer),
          urgencyCount: visualization.data.urgencyCount,
          lateStartCount: visualization.data.lateStartCount,
          hasOverlap: Boolean(visualization.data.hasOverlap),
          recoverySnoozed,
          talkNotificationsDecided: talkNotifsDecided,
        })
        : { textAfter: null, textPitch: null };
      const chips = !meetingOn
        ? buildGinaReplyChips({
          family: routed.family,
          visualization,
          locale: localeKey,
          hasDaySheet: daySheetAnchored,
          talkNotificationsDecided: talkNotifsDecided,
          recoverySnoozed,
        })
        : [];

      if (!meetingOn && visualization) {
        enrichGinaLastTurnFromVisualization(visualization);
      }

      return {
        // Today overview: allow empty pre-sheet message (summary is post-sheet).
        message: visualization?.data?.todayOverview
          ? (funnelHeadline || "")
          : (funnelHeadline || displayText),
        textMid,
        textAfter: postTable.textAfter,
        textAfterLead: postTable.textAfterLead,
        textAfterRest: postTable.textAfterRest,
        startDocLines: postTable.startDocLines,
        textPitch: null,
        visualization,
        learnProposal,
        ...(shouldUseGinaSearchSequence(routed.family, routed.toolContext)
          ? { searchSequence: buildGinaSearchSequence(localeKey) }
          : {}),
        chips: chips.length ? chips : null,
      };
    } catch (err) {
      console.warn("[gina] chat failed", err);
      return {
        message: locale === "es"
          ? "Hubo un problema al hablar con Gina. ¿GROQ_API_KEY está configurada? Puedes preguntar por hoy, vencidos o un departamento."
          : "Something went wrong talking to Gina. Is GROQ_API_KEY set? You can ask about today, past due, or a department.",
        visualization: (meetingOn
          || routed.family === "name_ambiguity"
          || routed.family === "confirm_date"
          || routed.family === "unclear"
          || routed.family === "social"
          || routed.family === "dismiss"
          || routed.family === "free_chat")
          ? null
          : buildGinaVisualization(
            routed.family === "confirm_continue" ? "inventory" : routed.family,
            routed.family === "confirm_continue"
              ? { inventory: routed.workspaceInventory || routed.toolContext?.inventory, ...(routed.toolContext || {}) }
              : routed.toolContext,
            {
              locale: locale === "es" ? "es" : "en",
              userText: text,
            },
          ),
        chips: null,
      };
    }
  }, [
    docsMap,
    nodesMap,
    departments,
    activeObjectId,
    activeObject,
    filterObjectId,
    ginaUserId,
    locale,
    onOpenDocument,
    onExpandNode,
    openGinaDocumentByNodeId,
    ginaMeetingSession,
    ginaLearnBrief,
    ginaPendingLearn,
    userEmail,
    authUser,
    selectedCanvasNodeIds,
    canvasNodes,
    requestLeftPanelNavigate,
  ]);

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

        {panelType === "Documents" && urlTableLibraryActive && !objectWorkspaceActive ? (
          <UrlTableLibraryPanel
            objectId={filterObjectId}
            onClose={closeUrlTableLibraryView}
            onOpenTable={handleOpenUrlTableFromLibrary}
            onNew={handleNewUrlTableFromLibrary}
            onTablesDeleted={onUrlTablesDeleted}
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

            {urlTableLibraryActive ? (
              <UrlTableLibraryPanel
                objectId={filterObjectId}
                onClose={closeUrlTableLibraryView}
                onOpenTable={handleOpenUrlTableFromLibrary}
                onNew={handleNewUrlTableFromLibrary}
                onTablesDeleted={onUrlTablesDeleted}
              />
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === null ? (
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
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
                  />
                </div>
                <div className="lp-click-folders-stack__boxes">
                  <ClickFolderBox
                    variant="subgroups"
                    label={t("sidebar.clickFolderDocuments")}
                    onClick={() => setClickFolderView("subgroups")}
                  />
                  <ClickFolderBox
                    variant="departments"
                    label={t("sidebar.departments")}
                    onClick={() => setClickFolderView("departments")}
                  />
                  <ClickFolderBox
                    variant="agents"
                    label={t("sidebar.agents")}
                    onClick={() => setClickFolderView("agents")}
                  />
                  <ClickFolderBox
                    variant="assistance"
                    label={t("sidebar.assistance")}
                    onClick={() => setClickFolderView("assistance")}
                  />
                </div>
              </>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === "groups" ? (
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
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
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

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === "campaign" ? (
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
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
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
                        {...folderSidebarReorderProps(doc.id, visibleCampaignDocIds)}
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

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === "departments" ? (
              <DepartmentsPanel
                objectId={filterObjectId}
                onBack={() => setClickFolderView(null)}
                createRequested={departmentCreateRequested}
                onCreateRequestHandled={() => setDepartmentCreateRequested(false)}
              />
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === "agents" ? (
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

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === "assistance" ? (
              <div className="lp-click-folder-detail">
                <ClickFolderBack
                  iconOnly
                  onBack={() => setClickFolderView(null)}
                  label={t("sidebar.assistanceTitle")}
                />
                <div className="lp-click-folder-detail-list">
                  <AssistanceListCard
                    onTalk={openGinaDashboard}
                    onOpenMeeting={openGinaMeeting}
                    onOpenKnowledge={() => setGinaKnowledgeOpen(true)}
                    isAdmin={isGinaAdmin}
                    knowledgeDocCount={knowledgeDocs.length}
                    chatOpen={ginaDashboardOpen && !ginaMeetingSession}
                  />
                </div>
              </div>
            ) : null}

            {!packImportActive && !stepsLibraryActive && !lazyTodosActive && !urlTableLibraryActive && clickFolderView === "subgroups" ? (
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
                    onOpenProducts={openProductsFromToolbar}
                    onOpenCampaign={openCampaignFromToolbar}
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
                <div className="lp-department-filter">
                  <label className="sr-only" htmlFor="lp-department-filter">
                    {t("sidebar.departmentFilterLabel")}
                  </label>
                  <label className="sr-only" htmlFor="lp-department-category-filter">
                    {t("sidebar.departmentCategoryFilterLabel")}
                  </label>
                  <div className="lp-department-filter__control lp-department-filter__control--merged">
                    <DepartmentsGlyph className="lp-department-filter__icon" />
                    <select
                      id="lp-department-filter"
                      className="lp-department-filter__select lp-department-filter__select--dept"
                      value={departmentFilterId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setCategoryByDepartmentId((prev) => {
                          if (!departmentFilterId) return prev;
                          if (prev[departmentFilterId] === departmentCategoryFilter) {
                            return prev;
                          }
                          return {
                            ...prev,
                            [departmentFilterId]: departmentCategoryFilter,
                          };
                        });
                        setDepartmentFilterId(nextId);
                        setDepartmentCategoryFilter(
                          nextId ? (categoryByDepartmentId[nextId] || "") : "",
                        );
                      }}
                    >
                      <option value={UNASSIGNED_DEPARTMENT_FILTER_ID}>
                        {t("sidebar.departmentFilterUnassigned")}
                      </option>
                      {departmentFilterOptions.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.category || t("sidebar.departmentsTitle")}
                        </option>
                      ))}
                    </select>
                    <span className="lp-department-filter__divider" aria-hidden />
                    <img
                      src="/uploads/file-open.svg"
                      alt=""
                      aria-hidden
                      className={
                        "lp-department-filter__category-icon"
                        + (!departmentFilterId ? " is-disabled" : "")
                      }
                    />
                    <select
                      id="lp-department-category-filter"
                      className="lp-department-filter__select lp-department-filter__select--category"
                      value={departmentCategoryFilter}
                      disabled={!departmentFilterId}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        setDepartmentCategoryFilter(nextCategory);
                        if (!departmentFilterId) return;
                        setCategoryByDepartmentId((prev) => ({
                          ...prev,
                          [departmentFilterId]: nextCategory,
                        }));
                      }}
                    >
                      {!departmentFilterId ? (
                        <option value="">
                          {t("sidebar.departmentCategoryFilterNeedParent")}
                        </option>
                      ) : (
                        <>
                          <option value="">
                            {t("sidebar.departmentCategoryFilterAll")}
                          </option>
                          {departmentCategoryFilterOptions.map((label) => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
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
                  {isDepartmentInboxView ? (
                    <DocNodesBlockCard
                      doc={null}
                      orphan
                      nodes={departmentInboxNodes}
                      objects={objects}
                      showWhenEmpty
                      defaultExpanded
                      highlightNodeId={revealHighlightNodeId}
                      onCreateDocument={() => openCreateDocument(null)}
                      onNodeClick={(node) => {
                        setActiveId(node.id);
                        setNodeEditContentFocus(false);
                        setNodeEditId(node.id);
                      }}
                      onNodeInsert={(node) => onInsertToCanvas?.(node)}
                      onNodeDelete={handleDeleteNode}
                    />
                  ) : null}
                  {visibleContentDocs.length || visibleUncategorizedDocs.length ? (
                    <>
                      {visibleContentDocs.map((doc) => (
                        <DocNodesBlockCard
                          key={doc.id}
                          doc={doc}
                          nodes={nodesByDocId.get(doc.id) || []}
                          objects={objects}
                          showWhenEmpty
                          forceExpanded={revealExpandFolderId === doc.id}
                          highlightNodeId={revealExpandFolderId === doc.id ? revealHighlightNodeId : null}
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
                          {...folderSidebarReorderProps(doc.id, visibleContentDocIds)}
                        />
                      ))}
                      {visibleUncategorizedDocs.map((doc) => (
                        <DocNodesBlockCard
                          key={doc.id}
                          doc={doc}
                          nodes={nodesByDocId.get(doc.id) || []}
                          objects={objects}
                          showWhenEmpty
                          forceExpanded={revealExpandFolderId === doc.id}
                          highlightNodeId={revealExpandFolderId === doc.id ? revealHighlightNodeId : null}
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
                          {...folderSidebarReorderProps(doc.id, visibleUncategorizedDocIds)}
                        />
                      ))}
                    </>
                  ) : departmentFilterId || departmentCategoryFilter ? (
                    <div className="lp-empty lp-empty--department">
                      <p className="lp-empty-department-title">
                        <DepartmentsGlyph className="lp-empty-department-icon" />
                        <span className="doc-department-of-label">
                          {t("sidebar.departmentOf", {
                            name: selectedDepartmentFilter?.category
                              || t("sidebar.departmentsTitle"),
                          })}
                        </span>
                      </p>
                      {departmentCategoryFilter ? (
                        <p className="lp-empty-department-category">
                          {departmentCategoryFilter}
                        </p>
                      ) : null}
                      <p className="dim">
                        {t("sidebar.useNewContentInDepartment")}
                      </p>
                    </div>
                  ) : isDepartmentInboxView ? (
                    null
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

        {/* Independent Documents panel removed — inbox lives under Documents → # Department */}

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
          defaultDepartmentId={
            docCreateMode === "content" && departmentFilterId
              ? departmentFilterId
              : null
          }
          defaultCategory={
            docCreateMode === "content" && departmentFilterId && departmentCategoryFilter
              ? departmentCategoryFilter
              : ""
          }
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
      {ginaDashboardOpen ? (
        <GinaChatOverlay
          documentId={null}
          assistantName={t("gina.name")}
          openingMessage={ginaOpeningMessage || t("gina.dashboardOpening")}
          placeholder={t("gina.placeholder")}
          speechLang={locale === "es" ? "es-ES" : "en-US"}
          allowMeetingMode={ginaMeetingSession}
          lockMeetingMode={ginaMeetingSession}
          initialMeetingMode={ginaMeetingSession}
          meetingDocumentTitle={ginaMeetingSession ? t("gina.meetingsSessionTitle") : ""}
          autoRunPrompt={ginaAutoRunPrompt}
          labels={{
            messageAria: t("gina.messageAria"),
            sendAria: t("gina.sendAria"),
            micAria: t("gina.micAria"),
            micUnsupported: t("gina.micUnsupported"),
            listeningHold: t("gina.listeningHold"),
            listeningCancel: t("gina.listeningCancel"),
            dictationInsert: t("gina.dictationInsert"),
            deletePhraseArmed: t("gina.deletePhraseArmed"),
            deletePhraseMiss: t("gina.deletePhraseMiss"),
            closeAria: t("gina.closeAria"),
            typingAria: t("gina.typingAria"),
            dialogAria: t("gina.dialogAria"),
            queued: t("gina.queued"),
            ttsOn: t("gina.ttsOn"),
            ttsOff: t("gina.ttsOff"),
            meetingToggle: t("gina.meetingToggle"),
            meetingActiveHint: t("gina.meetingsActiveHint"),
            meetingThisDocument: t("gina.meetingsSessionTitle"),
            meetingOffHint: t("gina.meetingOffHint"),
            learnSave: t("gina.learnSave"),
          }}
          onSendMessage={handleGinaDashboardSend}
          onClose={() => {
            setGinaDashboardOpen(false);
            setGinaMeetingSession(false);
            setGinaLearnBrief(null);
            setGinaPendingLearn(null);
            setGinaAutoRunPrompt(null);
          }}
        />
      ) : null}
      {ginaTalkNotifySession ? (
        <GinaChatOverlay
          key={`talk-notify-${ginaTalkNotifySession.runKey}`}
          documentId={ginaTalkNotifySession.documentId}
          compact
          assistantName={t("gina.name")}
          openingMessage=""
          placeholder={t("gina.placeholder")}
          speechLang={locale === "es" ? "es-ES" : "en-US"}
          autoRunPrompt={ginaTalkNotifySession.prompt}
          autoRunDisplayText={ginaTalkNotifySession.displayText}
          labels={{
            messageAria: t("gina.messageAria"),
            sendAria: t("gina.sendAria"),
            micAria: t("gina.micAria"),
            micUnsupported: t("gina.micUnsupported"),
            listeningHold: t("gina.listeningHold"),
            listeningCancel: t("gina.listeningCancel"),
            dictationInsert: t("gina.dictationInsert"),
            deletePhraseArmed: t("gina.deletePhraseArmed"),
            deletePhraseMiss: t("gina.deletePhraseMiss"),
            closeAria: t("gina.closeAria"),
            typingAria: t("gina.typingAria"),
            dialogAria: t("gina.dialogAria"),
            queued: t("gina.queued"),
            ttsOn: t("gina.ttsOn"),
            ttsOff: t("gina.ttsOff"),
          }}
          onSendMessage={handleGinaDashboardSend}
          onClose={closeGinaTalkNotifySession}
        />
      ) : null}
      <GinaTalkRequestPopover
        open={
          ginaTalkRequestOpen
          && !ginaDashboardOpen
          && !ginaTalkNotifySession
          && !ginaDailyReportPopoverOpen
        }
        locale={locale === "es" ? "es" : "en"}
        onAccept={openGinaFromTalkRequestPopover}
        onDecline={declineGinaTalkRequestPopover}
      />
      <GinaDailyReportPopover
        open={ginaDailyReportPopoverOpen && !ginaDashboardOpen && !ginaTalkNotifySession}
        locale={locale === "es" ? "es" : "en"}
        kind={ginaDailyReportPopoverKind}
        onOpenChat={openGinaFromDailyReportPopover}
        onDefer={deferDailyReportNudge}
      />
      {ginaKnowledgeOpen ? (
        <GinaKnowledgeOverlay
          knowledgeDocs={knowledgeDocs}
          isAdmin={isGinaAdmin}
          onOpenDocument={(docId) => handleOpenFolderDoc(docId)}
          onCreateKnowledge={async ({ title, body, knowledgeImport }) => {
            const newDocId = addDoc(
              title,
              null,
              [],
              [],
              body ?? "",
              null,
              null,
              {
                docKind: "knowledge",
                knowledgeImport: knowledgeImport ?? null,
              },
            );
            if (newDocId) {
              try {
                await flushPersistenceSync();
              } catch {
                /* local ok */
              }
            }
          }}
          onDeleteKnowledge={(docId) => {
            const doc = docs[docId];
            if (doc) handleDeleteDoc(doc);
          }}
          onClose={() => setGinaKnowledgeOpen(false)}
        />
      ) : null}
    </div>
  );
}
