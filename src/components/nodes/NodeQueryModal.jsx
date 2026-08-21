import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { MetricFieldsEditor } from "../shared/MetricFieldsEditor.jsx";
import { BlockAnchorFields } from "../docs/blocks/BlockAnchorFields.jsx";
import { SlashAwareTextarea } from "../docs/blocks/SlashAwareTextarea.jsx";
import { DocSlashCommandPicker } from "../docs/blocks/DocSlashCommandPicker.jsx";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";
import { NodeWritingBlockStack } from "./NodeWritingBlockStack.jsx";
import { createTodoItem, DOC_BLOCK_TYPES } from "../../lib/docBlocks.js";
import {
  initialNodeShapeFromSlash,
  isLibrarySlashAction,
  isNodeSlashCommandEnabled,
  isDocLinkedNodeSlashCommandEnabled,
  LIBRARY_SLASH_ACTIONS,
  NODE_SLASH_COMMANDS,
  DOC_LINKED_NODE_SLASH_COMMANDS,
  DOCUMENT_SLASH_GHOST_HINTS,
  parseNodeSlashQuery,
  parseDocLinkedNodeSlashQuery,
} from "../../lib/docBlockSlash.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { ContentTextSizeControls } from "../docs/ContentTextSizeControls.jsx";
import { useDocTextTypography } from "../../hooks/useDocTextTypography.js";
import {
  applySlashInTextBlock,
  createEmptyTextBlock,
  insertNodeWritingSlashAtFocus,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../../lib/nodeInlineContent.js";
import { measureWritingCellCapacities } from "../../lib/organizeDocCellCapacity.js";
import { planOrganizeWritingBlocks } from "../../lib/organizeDocPaste.js";
import {
  exportWritingBlocksToPdf,
  writingBlocksHaveExportableProse,
} from "../../lib/exportDocToPdf.js";
import {
  exportWritingBlocksToMarkdown,
  saveWritingBlocksMarkdownToFolderLibrary,
} from "../../lib/exportDocToMarkdown.js";
import { saveWritingBlocksPdfToFolderLibrary } from "../../lib/saveDocPdfToLibrary.js";
import {
  mergePdfTextIntoWritingBlocks,
  writingTextAreasAreEmpty,
  extractTextFromPdfData,
} from "../../lib/importPdfText.js";
import { writeImageSplitPromptsFromBlocks } from "../../lib/libraryImageCardSync.js";
import {
  normalizeNodeTodoContent,
} from "../../lib/nodeTodoContent.js";
import { mergeVideoNodeContent } from "../../lib/videoEmbed.js";
import { VideoEmbedBar } from "../intel/VideoEmbedBar.jsx";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { parseCalendarEventNodeContent } from "../../lib/eventCalendarSearch.js";
import { CalendarEventNodeView } from "../intel/CalendarEventNodeView.jsx";
import {
  listAdoptableDocs,
  resolveAdoptableDocLabel,
  resolveNodeParentDocId,
} from "../../lib/nodeParentAdoption.js";
import { useI18n } from "../../i18n/useI18n.js";
import { DOC_SOURCE_OPTIONS, resolveDocSource } from "../../lib/docSources.js";
import { canUseDocStatusMeta } from "../../lib/docMetaAccess.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useGinaOccupiedStrikethroughActive } from "../../hooks/useGinaOccupiedStrikethroughActive.js";
import { FolderLibraryOverlay } from "../docs/FolderLibraryOverlay.jsx";
import { LibraryNeedSaveNotice } from "../docs/LibraryNeedSaveNotice.jsx";
import { LibrarySetInputModal } from "../docs/LibrarySetInputModal.jsx";
import { pickGinaOpening, resolveGinaUserDisplayName } from "../../lib/gina/ginaOpenings.js";
import { formatMmDdYy } from "../../lib/docDates.js";
import {
  DOC_WORK_STATUS,
  docWorkStatusLabel,
  resolveDocWorkStatus,
  syncDocWorkStatusFields,
} from "../../lib/docWorkStatus.js";
import { DocStatusChip } from "../docs/FolderDocumentRow.jsx";
import { ProductCategoryField } from "../docs/ProductCategoryField.jsx";
import { listSiblingNodeSubcategories } from "../../lib/campaignDocSource.js";
import { GinaChatOverlay } from "../gina/GinaChatOverlay.jsx";
import { fetchGinaChat } from "../../lib/fetchGinaChat.js";
import { runGinaQueryFamily } from "../../lib/gina/ginaQueryFamily.js";
import { buildGinaVisualization } from "../../lib/gina/buildGinaVisualization.js";
import {
  buildGinaFunnelHeadline,
  buildGinaReplyChips,
  buildGinaOpeningChips,
  buildTodayOverviewPostTableCopy,
  buildTodayOverviewIntroText,
} from "../../lib/gina/ginaReplyChips.js";
import {
  buildGinaSearchSequence,
  shouldUseGinaSearchSequence,
} from "../../lib/gina/ginaSearchSequence.js";
import { get_workspace_inventory, matchDepartmentInText, get_today_scope } from "../../lib/gina/ginaTools.js";
import { hasDaySheet, anchorDaySheetFromTodayDocs } from "../../lib/gina/ginaDaySheetStore.js";
import {
  isTalkNotificationsEnabled,
  armTalkRequestNow,
} from "../../lib/gina/ginaTalkRequestStore.js";
import { pickNextDaySheetDoc, buildInDocDaySheetIdleChips } from "../../lib/gina/ginaDaySheet.js";
import { resolveGinaDayWeatherIntro } from "../../lib/gina/ginaDayWeatherIntro.js";
import { markTodayAgendaCheckedFromFamily } from "../../lib/gina/ginaTodayAgendaCheckStore.js";
import {
  buildTalkNotificationsSkippedAck,
  buildTalkRequestNotifyChips,
  buildTalkRequestNotifyStartDocLines,
  buildTalkRequestNotifyText,
  buildTalkRequestThanksText,
  getTalkRequestTodoMock,
  listUnfinishedPriorBlocks,
  buildTalkRequestConditionText,
} from "../../lib/gina/ginaTalkRequest.js";
import { buildOccupiedHoursReplyMessage } from "../../lib/gina/ginaSyntaxOccupiedHours.js";
import { formatGinaWallClockMessage } from "../../lib/gina/ginaSyntaxClock.js";
import {
  buildLastTurnModifyChips,
  buildLastTurnModifyMessage,
  buildLastTurnRefineMessage,
  buildLastTurnCategoryRefineMessage,
  buildLastTurnDepartmentRefineMessage,
  buildLastTurnFolderRefineMessage,
} from "../../lib/gina/ginaSyntaxLastTurn.js";
import {
  buildWordScopeAskMessage,
  buildWordScopeEmptyMessage,
  buildWordScopeChips,
} from "../../lib/gina/ginaSyntaxWordScope.js";
import { buildGinaTableColumnRefineMessage } from "../../lib/gina/ginaTableColumnRefine.js";
import { stampGinaLastTurnFromRouted, enrichGinaLastTurnFromVisualization, getGinaLastTurn } from "../../lib/gina/ginaLastTurn.js";
import { inferConfirmContinueAction } from "../../lib/gina/ginaConfirmContinue.js";
import {
  parseGinaSilentSetDocStatus,
  applyRescheduleBatchFromToolContext,
  buildRescheduleAppliedText,
  buildRescheduleCancelCloseText,
  buildRescheduleCancelCloseChips,
  buildReschedulePickerText,
  isGinaCloseChatIntent,
} from "../../lib/gina/ginaScheduleRecovery.js";
import { clearPendingGinaOffer, setPendingGinaOffer } from "../../lib/gina/ginaPendingOffer.js";
import { playTrashBoxSound } from "../../lib/trashBoxSound.js";
import { useDocsStore, useNodesStore, useObjectsStore } from "../../stores/index.js";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";

const NODE_FOOTER_SAVE_ICON = "/uploads/save-buttom.svg";

const DEFAULT_DATA_TYPES = ["text", "date", "checkbox"];

function openDatePicker(e) {
  e.stopPropagation();
  const input = e.currentTarget;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      /* some browsers reject showPicker outside direct user gesture */
    }
  }
}

/**
 * Node editor modal — Figma 296:627.
 * Doc H1 flow: read-only query/parent/type. Standalone: editable query, type, optional parent doc.
 */
export function NodeQueryModal({
  query,
  onQueryChange,
  content,
  onContentChange,
  dataType = "text",
  onDataTypeChange,
  dataTypes = DEFAULT_DATA_TYPES,
  createdDate,
  onCreatedDateChange,
  completed = false,
  onCompletedChange,
  /** Folder-doc work status: not_started | reserved | in_progress | submitted | past_due | completed | null */
  status = null,
  onStatusChange,
  /** Parent folder has scheduleStartAt→scheduleFinishAt reservation. */
  folderScheduleReserved = false,
  /**
   * Inclusive folder frame YYYY-MM-DD (always when folder is reserved).
   * When the document schedule date falls inside this frame, all work statuses show.
   */
  folderFrameMinDate = "",
  folderFrameMaxDate = "",
  /** Campaign documents: active|inactive (+ launch) instead of completed. */
  campaignMode = false,
  campaignStatus = "inactive",
  onCampaignStatusChange,
  announceDate = "",
  onAnnounceDateChange,
  subcategory = "",
  onSubcategoryChange,
  sourceId = null,
  onSourceIdChange,
  parentDocLabel,
  parentDocId = "",
  onParentDocIdChange,
  docs = [],
  parentObjectId = null,
  onClose,
  onSave,
  onBackToDocument,
  /** Close and discard without re-running schedule/unsaved gates (optional). */
  onCloseWithoutSave,
  initialContentFocus = false,
  onInsertToCanvas: _onInsertToCanvas,
  entityNodeId = null,
  intelSearchMeta: _intelSearchMeta = null,
  anchorDate = "",
  anchorTime = "",
  anchorFinishTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  onAnchorFinishTimeChange,
  scheduleOccupied = [],
  scheduleOverlapHint = "",
  /** Inclusive YYYY-MM-DD from parent folder reservation (optional). */
  scheduleMinDate = "",
  scheduleMaxDate = "",
  embedded = false,
}) {
  const { t, locale } = useI18n();
  const requestCreateLazyTodo = useUIStateStore((s) => s.requestCreateLazyTodo);
  const bodyRef = useRef(null);
  const queryInputRef = useRef(null);
  const focusCategoryRef = useRef(null);
  const contentScrollRef = useRef(null);
  const [contentFocusMode, setContentFocusMode] = useState(initialContentFocus);
  const [todoFocusItemId, setTodoFocusItemId] = useState(null);
  const [writingFocusTarget, setWritingFocusTarget] = useState(null);
  const [ginaChatOpen, setGinaChatOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySlashAction, setLibrarySlashAction] = useState(null);
  const [libraryInitialTab, setLibraryInitialTab] = useState(null);
  const [libraryAutoPdfImport, setLibraryAutoPdfImport] = useState(false);
  const [organizingWriting, setOrganizingWriting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState("");
  const [savingPdfLibrary, setSavingPdfLibrary] = useState(false);
  const [savePdfLibraryError, setSavePdfLibraryError] = useState("");
  const [savePdfLibraryOk, setSavePdfLibraryOk] = useState(false);
  const writingCaretRef = useRef(null);
  const organizeRunIdRef = useRef(0);
  const ginaPdfUploadInputRef = useRef(null);
  /** @type {React.MutableRefObject<null | { resolve: (v?: unknown) => void, reject: (e?: Error) => void }>} */
  const ginaPdfUploadPendingRef = useRef(null);
  const ginaPdfUploadBusyRef = useRef(false);

  useEffect(() => {
    if (librarySlashAction !== LIBRARY_SLASH_ACTIONS.OUTPUT) return;
    if (!entityNodeId) return;
    setLibraryInitialTab("documents");
    setLibraryOpen(true);
    setLibrarySlashAction(null);
  }, [librarySlashAction, entityNodeId]);

  // Accept on talk popover opens a floating small chat — close in-doc overlay so we don't stack two.
  useEffect(() => {
    const onTalkNotify = () => setGinaChatOpen(false);
    window.addEventListener("gina:talk-notify-open", onTalkNotify);
    return () => window.removeEventListener("gina:talk-notify-open", onTalkNotify);
  }, []);

  const typographyStorageKey = entityNodeId ? `node:${entityNodeId}` : null;
  const { typographyId, setTypographyId, typographyStyle } = useDocTextTypography(typographyStorageKey);
  const displayQuery = (query || "").trim() || "Untitled";
  const queryEditable = Boolean(onQueryChange);
  const parentSelectable = Boolean(onParentDocIdChange);
  const adoptableDocs = listAdoptableDocs(docs, { parentObjectId });
  const adoptableDocsById = Object.fromEntries(adoptableDocs.map((d) => [d.id, d]));
  const resolvedParentDocId = resolveNodeParentDocId(
    parentDocId ? { parentDocId } : null,
    null,
    adoptableDocsById,
    { parentObjectId },
  );
  const companyObjectId = parentObjectId
    || adoptableDocsById[resolvedParentDocId]?.parentObjectId
    || null;

  const handleOpenLinkedLazyTodo = useCallback(() => {
    if (!companyObjectId) return;
    const title = String(query || "").trim();
    requestCreateLazyTodo({
      objectId: companyObjectId,
      documentId: entityNodeId || null,
      listTitle: title || null,
    });
  }, [companyObjectId, entityNodeId, query, requestCreateLazyTodo]);

  const dateEditable = Boolean(onCreatedDateChange);
  const userEmail = useAuthStore((s) => s.user?.email);
  const authUser = useAuthStore((s) => s.user);
  const occupiedStrikethroughActive = useGinaOccupiedStrikethroughActive(authUser?.id || "anon");
  const gatedScheduleOccupied = occupiedStrikethroughActive ? scheduleOccupied : [];
  const gatedScheduleOverlapHint = occupiedStrikethroughActive ? scheduleOverlapHint : "";
  const docsMap = useDocsStore((s) => s.docs);
  const nodesMap = useNodesStore((s) => s.nodes);
  const departments = useDepartmentsStore((s) => s.departments);
  const objectsMap = useObjectsStore((s) => s.objects);
  const showCampaignStatus = Boolean(campaignMode) && typeof onCampaignStatusChange === "function";
  const showStatusMeta = showCampaignStatus
    || (canUseDocStatusMeta(userEmail)
      && (typeof onStatusChange === "function" || typeof onCompletedChange === "function"));
  const workStatus = resolveDocWorkStatus({ status, completed });
  const workStatusLabel = docWorkStatusLabel(workStatus, t);
  const sourceOption = showStatusMeta ? resolveDocSource(sourceId) : null;
  const isCampaignActive = campaignStatus === "active";
  const siblingSubcategories = showCampaignStatus
    ? listSiblingNodeSubcategories(nodesMap, parentDocId, entityNodeId)
    : [];
  const announceEditable = Boolean(onAnnounceDateChange);
  const [statusMetaExpanded, setStatusMetaExpanded] = useState(false);
  const handleDismiss = onBackToDocument || onClose;
  /** Same × pill as folder DocDocumentBox (also when opened from a folder). */
  const showCloseButton = Boolean(handleDismiss);
  const syncFocusCategoryHeight = useCallback(() => {
    const el = focusCategoryRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const focusContentArea = useCallback(() => {
    const scroll = contentScrollRef.current;
    if (!scroll) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement
      && scroll.contains(active)
      && active.matches("textarea, input:not([type='hidden']), [contenteditable='true']")
    ) {
      return;
    }
    const target = scroll.querySelector(
      "textarea, input:not([type='hidden']), [contenteditable='true']",
    );
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
      return;
    }
    scroll.focus({ preventScroll: true });
  }, []);

  const syncQueryInputHeight = useCallback(() => {
    const el = queryInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = "hidden";
  }, []);

  const scrollContentToTop = useCallback(() => {
    const el = contentScrollRef.current;
    if (el) el.scrollTop = 0;
  }, []);

  const exitContentFocusMode = useCallback(() => {
    setContentFocusMode(false);
    requestAnimationFrame(() => {
      syncQueryInputHeight();
      // Zoom-out / collapsed: always show the start of the writing (not empty tail cells).
      scrollContentToTop();
    });
  }, [syncQueryInputHeight, scrollContentToTop]);

  const toggleContentFocus = useCallback(() => {
    if (contentFocusMode) {
      exitContentFocusMode();
      return;
    }
    setContentFocusMode(true);
  }, [contentFocusMode, exitContentFocusMode, embedded]);

  // Open / reopen collapsed: pin scroll to the beginning of the text.
  useEffect(() => {
    if (contentFocusMode) return undefined;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(scrollContentToTop);
    });
    return () => cancelAnimationFrame(frame);
  }, [contentFocusMode, entityNodeId, scrollContentToTop]);
  const setActiveNodeQueryDraft = useUIStateStore((s) => s.setActiveNodeQueryDraft);

  const normalizedDateContent =
    dataType === "date"
      ? typeof content === "string"
        ? { date: content, time: "" }
        : content && typeof content === "object"
          ? { date: content.date || "", time: content.time || "" }
          : { date: "", time: "" }
      : { date: "", time: "" };

  const normalizedMetricContent =
    dataType === "metric"
      ? content && typeof content === "object"
        ? {
            value: content.value != null && content.value !== "" ? String(content.value) : "",
            unit: content.unit || "",
          }
        : { value: content != null && content !== "" ? String(content) : "", unit: "" }
      : { value: "", unit: "" };

  const checkboxTodoContent =
    dataType === "checkbox"
      ? normalizeNodeTodoContent(content, displayQuery || "Todo list:")
      : null;

  const updateTodoContent = useCallback((patch) => {
    if (!checkboxTodoContent) return;
    onContentChange({ ...checkboxTodoContent, ...patch });
  }, [checkboxTodoContent, onContentChange]);

  const handleTodoItemKeyDown = useCallback((itemIndex, e) => {
    if (!checkboxTodoContent) return;
    const items = checkboxTodoContent.items || [];
    const item = items[itemIndex];
    if (!item) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newItem = createTodoItem({ text: "" });
      const nextItems = [
        ...items.slice(0, itemIndex + 1),
        newItem,
        ...items.slice(itemIndex + 1),
      ];
      updateTodoContent({ items: nextItems });
      setTodoFocusItemId(newItem.id);
    }
  }, [checkboxTodoContent, updateTodoContent]);

  const canScheduleChild =
    Boolean(onAnchorDateChange)
    && (dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX);

  const showScheduleAnchor = canScheduleChild
    && !campaignMode
    && (Boolean(folderScheduleReserved) || workStatus === DOC_WORK_STATUS.RESERVED);
  /** All work statuses when this file's schedule date is inside the folder Start→Finish frame. */
  const docDate = String(anchorDate || "").trim();
  const frameMin = String(folderFrameMinDate || "").trim();
  const frameMax = String(folderFrameMaxDate || "").trim();
  const docDateInFolderFrame = Boolean(docDate && frameMin && frameMax)
    && docDate >= frameMin
    && docDate <= frameMax;
  const showWorkStatuses = docDateInFolderFrame;
  /** Campaign docs: Launch lives in the meta toggle (not the footer Schedule row). */
  const showLaunchInMeta = Boolean(campaignMode)
    && canScheduleChild
    && typeof onAnchorDateChange === "function";

  const calendarPayload =
    dataType === NODE_DATA_TYPES.TEXT ? parseCalendarEventNodeContent(content) : null;
  const showTextSizeControls = dataType === NODE_DATA_TYPES.TEXT && !calendarPayload;
  const scheduleStartIso = anchorDate && anchorTime ? `${anchorDate}T${anchorTime}:00` : "";
  const scheduleFinishIso = anchorDate && anchorFinishTime ? `${anchorDate}T${anchorFinishTime}:00` : "";
  const scheduleHasAny = Boolean(anchorDate || anchorTime || anchorFinishTime);
  const scheduleValidationError = !showScheduleAnchor || !scheduleHasAny
    ? ""
    : (!anchorDate || !anchorTime || !anchorFinishTime)
      ? t("meta.scheduleTimeframeIncomplete")
      : (Date.parse(scheduleFinishIso) <= Date.parse(scheduleStartIso)
        ? t("meta.scheduleFinishInvalid")
        : "");

  const isTextWritingMode = dataType === NODE_DATA_TYPES.TEXT && !calendarPayload;

  // Local source of truth for the writing stack so empty/blank cells survive
  // while editing (serialized content drops them). Re-seed only when the node
  // identity or data type changes.
  const [writingBlocks, setWritingBlocks] = useState(() => parseNodeWritingBody(content).blocks);
  const writingSeedRef = useRef(`${entityNodeId ?? "new"}:${dataType}`);

  useEffect(() => {
    const seedKey = `${entityNodeId ?? "new"}:${dataType}`;
    if (writingSeedRef.current === seedKey) return;
    writingSeedRef.current = seedKey;
    setWritingBlocks(parseNodeWritingBody(content).blocks);
  }, [entityNodeId, dataType, content]);

  const handleGinaInDocSend = useCallback(async (text, meta = {}) => {
    const corpusName = companyObjectId
      ? (objectsMap?.[companyObjectId]?.name || null)
      : null;
    const ginaUserId = authUser?.id || "anon";
    const now = new Date();

    if (isGinaCloseChatIntent(text)) {
      return "";
    }

    const silentRowStatus = parseGinaSilentSetDocStatus(text);
    if (silentRowStatus?.docId && silentRowStatus.status) {
      useNodesStore.getState().updateNode(
        silentRowStatus.docId,
        syncDocWorkStatusFields({ status: silentRowStatus.status }),
      );
      return "";
    }

    const lastTurnSnap = getGinaLastTurn();
    const ctx = {
      docs: docsMap,
      nodes: nodesMap,
      departments,
      objectId: companyObjectId || null,
      corpusName,
      now,
      userId: ginaUserId,
      documentId: entityNodeId || null,
      priorDepartment: lastTurnSnap?.department || null,
      lastTurn: lastTurnSnap,
      recentMessages: Array.isArray(meta?.messages) ? meta.messages : [],
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
    try {
      markTodayAgendaCheckedFromFamily(ginaUserId, routed.family, now);
    } catch { /* ignore */ }

    if (
      routed.family === "gina_talk_notifications_enable"
      || routed.family === "gina_talk_notifications_skip"
    ) {
      if (routed.family === "gina_talk_notifications_skip") {
        return {
          message: buildTalkNotificationsSkippedAck(localeKey),
          visualization: null,
          chips: null,
        };
      }
      const today = get_today_scope({
        docs: docsMap,
        nodes: nodesMap,
        departments,
        objectId: companyObjectId || null,
        now,
        userId: ginaUserId,
      }, { includeCompleted: true });
      const docs = Array.isArray(today.documents) ? today.documents : [];
      try {
        anchorDaySheetFromTodayDocs(ginaUserId, docs, {
          now,
          source: "document_today_hours",
        });
      } catch { /* ignore */ }
      const preferred = docs.find((d) => String(d.id) === String(entityNodeId))
        || pickNextDaySheetDoc(docs)
        || docs.find((d) => d?.id && !d.completed && d.status !== "completed")
        || docs[0]
        || null;
      armTalkRequestNow(ginaUserId, preferred, now);
      return { closeChat: true };
    }

    if (routed.family === "gina_chat_restart") {
      return {
        message: pickGinaOpening({
          locale: localeKey,
          userName: resolveGinaUserDisplayName(authUser),
          now,
          mode: "return",
        }),
        visualization: null,
        chips: buildGinaOpeningChips({
          locale: localeKey,
          surface: "document",
          mode: "return",
        }),
        resetChat: true,
      };
    }

    if (routed.family === "schedule_recovery_reschedule_cancel") {
      try { clearPendingGinaOffer(); } catch { /* ignore */ }
      return {
        message: buildRescheduleCancelCloseText(localeKey),
        visualization: null,
        chips: buildRescheduleCancelCloseChips(localeKey),
      };
    }

    if (routed.family === "schedule_recovery_reschedule_apply") {
      const applied = applyRescheduleBatchFromToolContext(routed.toolContext, {
        updateNode: useNodesStore.getState().updateNode,
        deleteNodeAndDocBlocks: useNodesStore.getState().deleteNodeAndDocBlocks,
      });
      if (applied.deleteCount) {
        try { playTrashBoxSound(); } catch { /* ignore */ }
      }
      try { clearPendingGinaOffer(); } catch { /* ignore */ }
      return {
        message: buildRescheduleAppliedText({
          locale: localeKey,
          count: applied.appliedCount || 1,
        }),
        visualization: null,
        chips: null,
      };
    }

    if (
      routed.family === "schedule_recovery_reschedule_pick"
      || routed.family === "schedule_recovery_reschedule_fork"
    ) {
      const visualization = buildGinaVisualization("schedule_recovery_reschedule_pick", {
        ...routed.toolContext,
        nodes: nodesMap,
        docs: docsMap,
        objectId: companyObjectId || null,
        rescheduleMode: routed.family === "schedule_recovery_reschedule_fork"
          ? "cascade"
          : (routed.toolContext?.rescheduleMode || "cascade"),
      }, {
        locale: localeKey,
        now,
        userText: text,
      });
      try {
        setPendingGinaOffer({
          type: "reschedule_session",
          sessionMoveDocIds: visualization?.data?.sessionMoveDocIds || [],
          assignedDocIds: visualization?.data?.assignedDocIds || [],
          rescheduleMode: visualization?.data?.rescheduleMode || "cascade",
        });
      } catch { /* ignore */ }
      return {
        message: buildReschedulePickerText({
          locale: localeKey,
          mode: visualization?.data?.rescheduleMode === "gaps" ? "gaps" : "cascade",
          hasFreeSlot: Boolean(visualization?.data?.hasFreeSlot) && !visualization?.data?.noCupo,
          noCupo: Boolean(visualization?.data?.noCupo),
          activeTitle: visualization?.data?.activeTitle || null,
        }),
        visualization,
        chips: null,
      };
    }

    if (routed.family === "wall_clock") {
      const clockNow = routed.toolContext?.nowIso
        ? new Date(routed.toolContext.nowIso)
        : now;
      return {
        message: formatGinaWallClockMessage(clockNow, localeKey),
        visualization: null,
        chips: null,
      };
    }

    if (
      routed.family === "last_turn_modify"
      || routed.family === "last_turn_missing"
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

    if (routed.family === "last_turn_empty") {
      return {
        message: buildLastTurnCategoryRefineMessage({
          locale: localeKey,
          matchKind: "empty",
          needle: routed.toolContext?.needle || null,
        }),
        visualization: null,
        chips: null,
      };
    }

    if (routed.family === "word_scope") {
      const scan = routed.toolContext?.scan || {
        needle: routed.toolContext?.needle,
        departments: routed.toolContext?.departments,
        categories: routed.toolContext?.categories,
        folders: routed.toolContext?.folders,
        documents: routed.toolContext?.documents,
      };
      return {
        message: routed.toolContext?.empty
          ? buildWordScopeEmptyMessage(routed.toolContext?.needle, { locale: localeKey })
          : buildWordScopeAskMessage(scan, { locale: localeKey }),
        visualization: null,
        chips: routed.toolContext?.empty
          ? null
          : buildWordScopeChips(scan, { locale: localeKey }),
      };
    }

    if (
      routed.family === "check_doc_free_hours"
      || routed.family === "activate_occupied_hours"
    ) {
      const visualization = buildGinaVisualization(routed.family, routed.toolContext, {
        locale: localeKey,
        now,
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

    // Talk-request Accept notify — same shape as dashboard (intro + startDocLines).
    if (
      routed.family === "gina_talk_request"
      || routed.family === "gina_talk_request_thanks"
    ) {
      if (routed.family === "gina_talk_request_thanks") {
        return {
          message: buildTalkRequestThanksText(localeKey),
          visualization: null,
          chips: null,
        };
      }
      const next = routed.toolContext?.nextDocument || null;
      const pool = Array.isArray(routed.toolContext?.documents)
        ? routed.toolContext.documents
        : [];
      const prior = listUnfinishedPriorBlocks(pool, next);
      const daySheetViz = buildGinaVisualization("day_sheet", routed.toolContext, {
        locale: localeKey,
        now,
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
            talkRequestDocId: next?.id || null,
            nextDocumentId: next?.id || daySheetViz.data?.nextDocumentId || null,
          },
        }
        : null;
      return {
        message: buildTalkRequestNotifyText({ locale: localeKey }),
        startDocLines: buildTalkRequestNotifyStartDocLines(next, localeKey),
        notifyTodoMock: getTalkRequestTodoMock(localeKey),
        textAfter: buildTalkRequestConditionText({
          locale: localeKey,
          currentTitle: next?.title || "",
          priorTitles: prior.map((d) => d.title || d.name),
        }),
        visualization,
        chips: buildTalkRequestNotifyChips({
          locale: localeKey,
          documentId: next?.id || null,
          title: next?.title || "",
        }),
      };
    }

    // Day schedule reopen/save — deterministic, no Groq (same store as dashboard).
    if (
      routed.family === "day_sheet"
      || routed.family === "day_sheet_next"
      || routed.family === "day_sheet_complete"
      || routed.family === "day_sheet_complete_confirm"
    ) {
      const daySheetAnchored = hasDaySheet(ginaUserId, now);
      const visualization = buildGinaVisualization(
        routed.family === "day_sheet_next" ? "day_sheet_next" : "day_sheet",
        routed.toolContext,
        { locale: localeKey, now, userText: text, compact: true, surface: "document" },
      );
      if (routed.family === "day_sheet_next") {
        const next = routed.toolContext?.nextDocument || null;
        return {
          message: next
            ? (localeKey === "en"
              ? `Your next document is **${next.title}**.`
              : `Tu siguiente documento es **${next.title}**.`)
            : (localeKey === "en"
              ? "Nothing pending left on today’s schedule."
              : "No queda nada pendiente en el horario del día."),
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
      const message = buildGinaFunnelHeadline(visualization, {
        locale: localeKey,
        compact: true,
        surface: "document",
      })
        || (routed.toolContext?.missingAnchor
          ? (localeKey === "en"
            ? "You don’t have today’s schedule saved yet. Ask for today’s schedule from Assistance and save it."
            : "Aún no tienes el horario del día guardado. Pídelo en Assistance y guárdalo.")
          : "");
      const notifsOn = isTalkNotificationsEnabled(ginaUserId, now);
      try {
        anchorDaySheetFromTodayDocs(ginaUserId, visualization?.data?.documents || [], {
          now,
          source: "document_today_hours",
        });
      } catch { /* ignore */ }
      const idleNotify = buildInDocDaySheetIdleChips({ locale: localeKey });
      return {
        message,
        visualization: visualization
          ? {
            ...visualization,
            data: {
              ...(visualization.data || {}),
              compact: true,
              locale: localeKey,
              pendingSelectedIds: [],
              talkNotificationsEnabled: notifsOn,
            },
          }
          : null,
        chips: idleNotify.length ? idleNotify : null,
      };
    }

    if (routed.family === "focus_open") {
      if (routed.openDocumentId) {
        // In-doc chat cannot swap the open editor yet — confirm the match for the user.
        const title = nodesMap?.[routed.openDocumentId]?.title
          || nodesMap?.[routed.openDocumentId]?.name
          || routed.openDocumentId;
        return {
          message: localeKey === "en"
            ? `I found “${title}”. Open it from the Assistant or from Documents when you’re ready.`
            : `Encontré «${title}». Ábrelo desde el Asistente o desde Documents cuando quieras.`,
          visualization: null,
          chips: null,
        };
      }
    }

    if (routed.family === "count_folders") {
      const visualization = buildGinaVisualization("count_folders", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en"
            ? (routed.toolContext?.empty
              ? "You have zero folders created. Start by creating at least one folder."
              : `We have ${routed.toolContext?.count ?? 0} folders.`)
            : (routed.toolContext?.empty
              ? "Tienes cero secciones de folder creadas. Comienza creando al menos un folder."
              : `Tenemos ${routed.toolContext?.count ?? 0} folders.`)),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "count_folders",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "count_categories") {
      const visualization = buildGinaVisualization("count_categories", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en"
            ? (routed.toolContext?.empty
              ? "You have zero categories created."
              : `We have ${routed.toolContext?.count ?? 0} categories.`)
            : (routed.toolContext?.empty
              ? "Tienes cero categorías creadas."
              : `Tenemos ${routed.toolContext?.count ?? 0} categorías.`)),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "count_categories",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "category_scope") {
      const visualization = buildGinaVisualization("category_scope", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en"
            ? `In ${routed.toolContext?.department || "this department"} — ${routed.toolContext?.category || "category"}.`
            : `En ${routed.toolContext?.department || "este departamento"} — ${routed.toolContext?.category || "categoría"}.`),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "category_scope",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "count_documents") {
      const visualization = buildGinaVisualization("count_documents", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      enrichGinaLastTurnFromVisualization(visualization, { locale: localeKey });
      return {
        message: routed.toolContext?.fromLastTurnTableRefine
          ? buildGinaTableColumnRefineMessage({
            locale: localeKey,
            predicates: routed.toolContext?.tableRefine?.predicates || [],
            count: routed.toolContext?.count ?? visualization?.data?.documents?.length ?? 0,
            empty: Boolean(routed.toolContext?.empty),
          })
          : routed.toolContext?.fromLastTurnCategoryRefine
          ? buildLastTurnCategoryRefineMessage({
            locale: localeKey,
            matchKind: routed.toolContext?.matchKind || "category",
            department: routed.toolContext?.department || null,
            category: routed.toolContext?.category || null,
            needle: routed.toolContext?.needle || routed.toolContext?.category || null,
            folderCount: routed.toolContext?.folderCount ?? 0,
            singleFolderName: routed.toolContext?.singleFolderName || null,
            count: routed.toolContext?.count ?? visualization?.data?.documents?.length ?? 0,
          })
          : routed.toolContext?.fromLastTurnDepartmentRefine
          ? buildLastTurnDepartmentRefineMessage({
            locale: localeKey,
            department: routed.toolContext?.department || null,
            count: routed.toolContext?.count ?? visualization?.data?.documents?.length ?? 0,
          })
          : routed.toolContext?.fromLastTurnRefine
          ? buildLastTurnRefineMessage({
            locale: localeKey,
            department: routed.toolContext?.department || null,
            count: routed.toolContext?.count ?? visualization?.data?.documents?.length ?? 0,
          })
          : (buildGinaFunnelHeadline(visualization, { locale: localeKey })
            || (localeKey === "en"
              ? (routed.toolContext?.empty
                ? "You have zero documents created."
                : `We have ${routed.toolContext?.count ?? 0} documents.`)
              : (routed.toolContext?.empty
                ? "Tienes cero documentos creados."
                : `Tenemos ${routed.toolContext?.count ?? 0} documentos.`))),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "count_documents",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "count_departments") {
      const visualization = buildGinaVisualization("count_departments", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en"
            ? `For ${routed.toolContext?.corpusName || "this workspace"} we have ${routed.toolContext?.count ?? 0} departments.`
            : `Para ${routed.toolContext?.corpusName || "este corpus"} tenemos un total de ${routed.toolContext?.count ?? 0} departamentos.`),
        visualization,
        chips: buildGinaReplyChips({
          family: "count_departments",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "find_document") {
      const visualization = buildGinaVisualization("find_document", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en" ? "I searched your workspace." : "Busqué en tu workspace."),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "find_document",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "department") {
      const visualization = buildGinaVisualization("department", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
          || (localeKey === "en"
            ? `From the ${routed.toolContext?.department || "department"} department.`
            : `Del departamento de ${routed.toolContext?.department || "—"}.`),
        visualization,
        chips: buildGinaReplyChips({
          family: "department",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "folder_summary") {
      const visualization = buildGinaVisualization("folder_summary", routed.toolContext, {
        locale: localeKey,
        now: ctx.now,
        userText: text,
      });
      return {
        message: routed.toolContext?.fromLastTurnFolderRefine
          ? buildLastTurnFolderRefineMessage({
            locale: localeKey,
            folderName: routed.toolContext?.folderName || null,
            department: routed.toolContext?.departmentName || routed.toolContext?.department || null,
            count: routed.toolContext?.documents?.length
              ?? routed.toolContext?.aggregated?.total
              ?? 0,
          })
          : (buildGinaFunnelHeadline(visualization, { locale: localeKey })
            || (localeKey === "en"
              ? `Here are the documents in ${routed.toolContext?.folderName || "that folder"}.`
              : `Aquí tienes los documentos de ${routed.toolContext?.folderName || "ese folder"}.`)),
        visualization,
        searchSequence: buildGinaSearchSequence(localeKey),
        chips: buildGinaReplyChips({
          family: "folder_summary",
          visualization,
          locale: localeKey,
        }),
      };
    }

    if (routed.family === "today") {
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
        return {
          message: buildGinaFunnelHeadline(visualization, { locale: localeKey })
            || (localeKey === "en"
              ? (routed.toolContext?.filters?.department
                ? `Today in ${routed.toolContext.filters.department} there are zero scheduled documents.`
                : "Nothing scheduled for today.")
              : (routed.toolContext?.filters?.department
                ? `Hoy en ${routed.toolContext.filters.department} hay cero documentos programados.`
                : "Hoy no hay trabajo programado.")),
          visualization,
          ...(shouldUseGinaSearchSequence("today", routed.toolContext)
            ? { searchSequence: buildGinaSearchSequence(localeKey) }
            : {}),
          chips: buildGinaReplyChips({
            family: "today",
            visualization,
            locale: localeKey,
          }),
        };
      }
    }

    if (routed.family === "confirm_continue") {
      const action = inferConfirmContinueAction(ctx, meta.messages || []);
      if (action?.action === "list_department_docs" && action.departmentName) {
        const deptHit = matchDepartmentInText(ctx, action.departmentName);
        if (deptHit) {
          const deptRouted = runGinaQueryFamily(
            `entregame todos los documentos del departamento de ${deptHit.name}`,
            ctx,
          );
          if (deptRouted.family === "department") {
            const deptViz = buildGinaVisualization("department", deptRouted.toolContext, {
              locale: localeKey,
              now: ctx.now,
              userText: text,
            });
            enrichGinaLastTurnFromVisualization(deptViz, { locale: localeKey });
            stampGinaLastTurnFromRouted(deptRouted, {
              objectId: ctx.objectId || null,
              userText: text,
            });
            return {
              message: buildGinaFunnelHeadline(deptViz, { locale: localeKey })
                || buildLastTurnDepartmentRefineMessage({
                  locale: localeKey,
                  department: deptRouted.toolContext?.department || null,
                  count: deptRouted.toolContext?.documentCount ?? deptViz?.data?.documents?.length ?? 0,
                }),
              visualization: deptViz,
              chips: buildGinaReplyChips({
                family: "department",
                visualization: deptViz,
                locale: localeKey,
              }),
            };
          }
        }
      }
    }

    const workspaceInventory = routed.workspaceInventory || get_workspace_inventory(ctx);
    const visualization = (routed.family === "name_ambiguity"
      || routed.family === "word_scope"
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

    try {
      const history = Array.isArray(meta.messages) && meta.messages.length
        ? meta.messages
        : [{ role: "user", content: text }];
      const result = await fetchGinaChat({
        messages: history,
        toolContext: {
          ...(routed.toolContext || {}),
          openDocument: {
            id: entityNodeId,
            title: displayQuery,
          },
        },
        toolsCalled: routed.toolsCalled,
        family: routed.family || "document_chat",
        locale: locale === "es" ? "es" : "en",
        workspaceInventory,
        meetingMode: false,
        userName: resolveGinaUserDisplayName(authUser) || undefined,
      });
      const message = typeof result?.reply === "string" && result.reply.trim()
        ? result.reply.trim()
        : (locale === "es"
          ? "No pude responder. Intenta de nuevo."
          : "Couldn't reply. Try again.");
      const localeKey = locale === "es" ? "es" : "en";
      const funnelHeadline = buildGinaFunnelHeadline(visualization, { locale: localeKey });
      const weatherIntro = visualization?.data?.todayOverview
        ? await resolveGinaDayWeatherIntro({ locale: localeKey, now })
        : null;
      const ginaUserId = authUser?.id || "anon";
      const daySheetAnchored = hasDaySheet(ginaUserId);
      const textMid = visualization?.data?.todayOverview
        ? buildTodayOverviewIntroText(localeKey)
        : null;
      const postTable = visualization?.data?.todayOverview && !visualization?.data?.omitFollowUpChips
        ? buildTodayOverviewPostTableCopy({
          quickSheet: visualization.data.quickSheet || null,
          documents: visualization.data.documents || [],
          overviewByDepartment: visualization.data.overviewByDepartment || [],
          totalMinutes: visualization.data.totalMinutes,
          totalHoursLabel: visualization.data.totalHoursLabel,
          dayProgress: visualization.data.dayProgress || null,
          folderProgress: visualization.data.folderProgress || [],
          locale: localeKey,
          userId: ginaUserId,
          hasDaySheet: daySheetAnchored,
          hasRecoveryOffer: Boolean(visualization.data.hasRecoveryOffer),
          urgencyCount: visualization.data.urgencyCount,
          lateStartCount: visualization.data.lateStartCount,
          hasOverlap: Boolean(visualization.data.hasOverlap),
        })
        : { textAfter: null, textPitch: null };
      const chips = buildGinaReplyChips({
        family: routed.family,
        visualization,
        locale: localeKey,
        hasDaySheet: daySheetAnchored,
      });
      return {
        message: visualization?.data?.todayOverview
          ? (weatherIntro || funnelHeadline || "")
          : (funnelHeadline || message),
        textMid,
        textAfter: postTable.textAfter,
        textAfterLead: postTable.textAfterLead,
        textAfterRest: postTable.textAfterRest,
        startDocLines: postTable.startDocLines,
        textPitch: null,
        visualization,
        ...(shouldUseGinaSearchSequence(routed.family, routed.toolContext)
          ? { searchSequence: buildGinaSearchSequence(localeKey) }
          : {}),
        chips: chips.length ? chips : null,
      };
    } catch (err) {
      console.warn("[gina] in-doc chat failed", err);
      return locale === "es"
        ? "Hubo un problema al hablar con Gina. ¿GROQ_API_KEY está configurada?"
        : "Something went wrong talking to Gina. Is GROQ_API_KEY set?";
    }
  }, [
    docsMap,
    nodesMap,
    departments,
    objectsMap,
    companyObjectId,
    locale,
    displayQuery,
    entityNodeId,
    authUser,
  ]);
  // Unsaved-changes guard: snapshot the node's content/title when it opens, and
  // prompt to save if the user closes with pending edits (doc-style card).
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const nodeSnapshotRef = useRef(null);

  useEffect(() => {
    nodeSnapshotRef.current = {
      content: JSON.stringify(content ?? ""),
      query: query ?? "",
      anchorDate: anchorDate ?? "",
      anchorTime: anchorTime ?? "",
      anchorFinishTime: anchorFinishTime ?? "",
      completed: Boolean(completed),
      status: workStatus,
      sourceId: sourceId ?? null,
    };
    setShowUnsavedConfirm(false);
    // Snapshot only when the node identity/type changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityNodeId, dataType]);

  const hasUnsavedNodeChanges = useCallback(() => {
    const snap = nodeSnapshotRef.current;
    if (!snap) return false;
    return snap.content !== JSON.stringify(content ?? "")
      || snap.query !== (query ?? "")
      || (snap.anchorDate ?? "") !== (anchorDate ?? "")
      || (snap.anchorTime ?? "") !== (anchorTime ?? "")
      || (snap.anchorFinishTime ?? "") !== (anchorFinishTime ?? "")
      || (snap.sourceId || null) !== (sourceId || null);
  }, [content, query, anchorDate, anchorTime, anchorFinishTime, sourceId]);

  /** Status/Source persist live to the store — keep dismiss snapshot in sync. */
  const syncMetaSnapshot = useCallback((nextStatus, nextSourceId) => {
    if (!nodeSnapshotRef.current) return;
    nodeSnapshotRef.current = {
      ...nodeSnapshotRef.current,
      status: nextStatus || null,
      completed: nextStatus === DOC_WORK_STATUS.COMPLETED,
      sourceId: nextSourceId ?? null,
    };
  }, []);

  const handleStatusChange = useCallback((next) => {
    const resolved = next === workStatus ? null : next;
    if (typeof onStatusChange === "function") {
      onStatusChange(resolved);
    } else {
      onCompletedChange?.(resolved === DOC_WORK_STATUS.COMPLETED);
    }
    syncMetaSnapshot(resolved, sourceId);
  }, [onStatusChange, onCompletedChange, syncMetaSnapshot, sourceId, workStatus]);

  const handleSourceIdChange = useCallback((value) => {
    onSourceIdChange?.(value);
    syncMetaSnapshot(workStatus, value);
  }, [onSourceIdChange, syncMetaSnapshot, workStatus]);

  /**
   * Child date/time is optional. Folder reservation only limits the picker range
   * when the user chooses to set a schedule on the document.
   * @returns {Promise<true>}
   */
  const ensureChildScheduleOrRemind = useCallback(async () => true, []);

  const discardWithoutSave = useCallback(() => {
    // Prefer explicit discard so parent can skip re-prompting schedule.
    if (typeof onCloseWithoutSave === "function") {
      onCloseWithoutSave();
      return;
    }
    handleDismiss?.();
  }, [onCloseWithoutSave, handleDismiss]);

  const handleFooterSave = useCallback(async () => {
    if (!onSave) return;
    // Do not gate on scheduleValidationError — Cmd+Enter and close→Yes also skip it.
    // Incomplete schedule stays a soft hint in the time popover only.
    const gate = await ensureChildScheduleOrRemind();
    if (gate === "stay") return;
    if (gate === "discard") {
      discardWithoutSave();
      return;
    }
    writeImageSplitPromptsFromBlocks(writingBlocks, {
      folderId: entityNodeId ? (resolvedParentDocId || "") : "",
      documentId: entityNodeId || "",
    });
    onSave();
  }, [onSave, ensureChildScheduleOrRemind, discardWithoutSave, writingBlocks, entityNodeId, resolvedParentDocId]);

  const requestDismiss = useCallback(async () => {
    const gate = await ensureChildScheduleOrRemind();
    if (gate === "stay") return;
    if (gate === "discard") {
      discardWithoutSave();
      return;
    }
    if (onSave && hasUnsavedNodeChanges()) {
      setShowUnsavedConfirm(true);
      return;
    }
    handleDismiss?.();
  }, [
    ensureChildScheduleOrRemind,
    discardWithoutSave,
    onSave,
    hasUnsavedNodeChanges,
    handleDismiss,
  ]);

  const slashCommandsEnabled = Boolean(onDataTypeChange) || Boolean(onBackToDocument);
  const linkedFromDocument = Boolean(onBackToDocument);
  const activeSlashCommands = linkedFromDocument
    ? DOC_LINKED_NODE_SLASH_COMMANDS
    : NODE_SLASH_COMMANDS;
  const resolveSlashQuery = linkedFromDocument
    ? parseDocLinkedNodeSlashQuery
    : parseNodeSlashQuery;
  const isSlashCommandEnabled = linkedFromDocument
    ? isDocLinkedNodeSlashCommandEnabled
    : isNodeSlashCommandEnabled;

  const updateWritingBlocks = useCallback((blocks) => {
    setWritingBlocks(blocks);
    onContentChange(serializeNodeWritingBody({ blocks }));
  }, [onContentChange]);

  const handleOrganizeWritingText = useCallback(async () => {
    if (organizingWriting) return;
    const cellCapacities = measureWritingCellCapacities(contentScrollRef.current);
    const plan = planOrganizeWritingBlocks(writingBlocks, { cellCapacities });
    if (!plan.changed || !plan.steps.length) return;

    const runId = organizeRunIdRef.current + 1;
    organizeRunIdRef.current = runId;
    setOrganizingWriting(true);

    const sleep = (ms) => new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

    try {
      // Brief "reading" beat before the first visual change.
      await sleep(520);
      if (organizeRunIdRef.current !== runId) return;

      const stepMs = plan.steps.length > 14 ? 280 : 420;
      for (const snapshot of plan.steps) {
        if (organizeRunIdRef.current !== runId) return;
        updateWritingBlocks(snapshot);
        await sleep(stepMs);
      }
    } finally {
      if (organizeRunIdRef.current === runId) {
        setOrganizingWriting(false);
      }
    }
  }, [organizingWriting, writingBlocks, updateWritingBlocks]);

  useEffect(() => () => {
    organizeRunIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (contentFocusMode || !organizingWriting) return;
    organizeRunIdRef.current += 1;
    setOrganizingWriting(false);
  }, [contentFocusMode, organizingWriting]);

  const handleExportWritingPdf = useCallback(async () => {
    if (exportingPdf || savingPdfLibrary) return;
    if (!writingBlocksHaveExportableProse(writingBlocks)) {
      setExportPdfError(t("docs.exportPdfEmpty"));
      return;
    }
    setExportPdfError("");
    setExportingPdf(true);
    try {
      const result = await exportWritingBlocksToPdf(writingBlocks, {
        title: displayQuery,
      });
      if (result?.empty) {
        setExportPdfError(t("docs.exportPdfEmpty"));
      }
    } catch (err) {
      console.error("[exportPdf]", err);
      setExportPdfError(t("docs.exportPdfFailed"));
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, savingPdfLibrary, writingBlocks, displayQuery, t]);

  const handleExportWritingMarkdown = useCallback(async () => {
    if (exportingPdf || savingPdfLibrary) return;
    if (!writingBlocksHaveExportableProse(writingBlocks)) {
      setExportPdfError(t("docs.exportPdfEmpty"));
      return;
    }
    setExportPdfError("");
    setExportingPdf(true);
    try {
      const result = exportWritingBlocksToMarkdown(writingBlocks, {
        title: displayQuery,
      });
      if (result?.empty) {
        setExportPdfError(t("docs.exportPdfEmpty"));
      }
    } catch (err) {
      console.error("[exportMd]", err);
      setExportPdfError(t("docs.exportPdfFailed"));
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, savingPdfLibrary, writingBlocks, displayQuery, t]);

  const handleImportPdfFromLibrary = useCallback(async ({ text }) => {
    if (!writingTextAreasAreEmpty(writingBlocks)) {
      throw new Error("writing_not_empty");
    }
    const merged = mergePdfTextIntoWritingBlocks(writingBlocks, text);
    if (merged.empty || !merged.changed) {
      throw new Error("empty_pdf");
    }
    updateWritingBlocks(merged.blocks);
    setLibraryOpen(false);
    setLibraryInitialTab(null);
    setLibraryAutoPdfImport(false);
  }, [writingBlocks, updateWritingBlocks]);

  const handleGinaLocalPdfUpload = useCallback(async (event) => {
    const pending = ginaPdfUploadPendingRef.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      ginaPdfUploadPendingRef.current = null;
      pending?.reject(new Error("cancelled"));
      return;
    }
    const isPdf = String(file.type || "").toLowerCase() === "application/pdf"
      || /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      ginaPdfUploadPendingRef.current = null;
      pending?.reject(new Error("invalid"));
      return;
    }
    if (!writingTextAreasAreEmpty(writingBlocks)) {
      ginaPdfUploadPendingRef.current = null;
      pending?.reject(new Error("writing_not_empty"));
      return;
    }
    ginaPdfUploadBusyRef.current = true;
    const sleep = (ms) => new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
    try {
      const bytes = await file.arrayBuffer();
      const extracted = await extractTextFromPdfData(bytes);
      if (extracted.empty) {
        ginaPdfUploadPendingRef.current = null;
        pending?.reject(new Error("empty"));
        return;
      }
      const fullText = String(extracted.text || "");
      const baseBlocks = writingBlocks;
      // Hold the lupa / “espera…” beat, then type into the writing area quickly.
      await sleep(1100);
      const total = fullText.length;
      const steps = Math.min(48, Math.max(12, Math.ceil(total / 18)));
      const stepSize = Math.max(1, Math.ceil(total / steps));
      for (let end = stepSize; end < total; end += stepSize) {
        const merged = mergePdfTextIntoWritingBlocks(baseBlocks, fullText.slice(0, end));
        if (merged.changed) updateWritingBlocks(merged.blocks);
        await sleep(22);
      }
      const finalMerged = mergePdfTextIntoWritingBlocks(baseBlocks, fullText);
      if (finalMerged.empty || !finalMerged.changed) {
        ginaPdfUploadPendingRef.current = null;
        pending?.reject(new Error("empty"));
        return;
      }
      updateWritingBlocks(finalMerged.blocks);
      await sleep(280);
      ginaPdfUploadPendingRef.current = null;
      pending?.resolve({ ok: true });
    } catch (err) {
      console.error("[ginaPdfUpload]", err);
      ginaPdfUploadPendingRef.current = null;
      pending?.reject(err instanceof Error ? err : new Error("failed"));
    } finally {
      ginaPdfUploadBusyRef.current = false;
    }
  }, [writingBlocks, updateWritingBlocks]);

  const handleSaveWritingPdfToLibrary = useCallback(async () => {
    if (exportingPdf || savingPdfLibrary) return;
    if (!writingBlocksHaveExportableProse(writingBlocks)) {
      setSavePdfLibraryError(t("docs.exportPdfEmpty"));
      setSavePdfLibraryOk(false);
      return;
    }
    const folderId = String(
      resolvedParentDocId
      || nodesMap?.[entityNodeId]?.parentDocId
      || "",
    ).trim();
    if (!folderId) {
      setSavePdfLibraryError(t("docs.exportPdfNoFolder"));
      setSavePdfLibraryOk(false);
      return;
    }
    if (docsMap && !docsMap[folderId]) {
      setSavePdfLibraryError(t("docs.exportPdfNoFolder"));
      setSavePdfLibraryOk(false);
      return;
    }
    setSavePdfLibraryError("");
    setSavePdfLibraryOk(false);
    setSavingPdfLibrary(true);
    try {
      const result = await saveWritingBlocksPdfToFolderLibrary(writingBlocks, {
        title: displayQuery,
        folderId,
        tag: displayQuery,
        description: t("docs.exportPdfLibraryDescription", { title: displayQuery }),
      });
      if (!result?.ok) {
        console.error("[exportPdfLibrary]", result?.reason, result?.error || result);
        if (result?.reason === "empty") {
          setSavePdfLibraryError(t("docs.exportPdfEmpty"));
        } else if (result?.reason === "no_folder" || result?.reason === "create_failed") {
          setSavePdfLibraryError(t("docs.exportPdfNoFolder"));
        } else if (
          /sign in|auth|not authenticated/i.test(String(result?.error || ""))
        ) {
          setSavePdfLibraryError(t("docs.exportPdfNeedSignIn"));
        } else {
          setSavePdfLibraryError(
            result?.error
              ? `${t("docs.exportPdfLibraryFailed")}: ${result.error}`
              : t("docs.exportPdfLibraryFailed"),
          );
        }
        return;
      }
      setSavePdfLibraryOk(true);
      setLibraryInitialTab("skill");
      setLibraryOpen(true);
      window.setTimeout(() => setSavePdfLibraryOk(false), 2400);
    } catch (err) {
      console.error("[exportPdfLibrary]", err);
      setSavePdfLibraryError(
        err?.message
          ? `${t("docs.exportPdfLibraryFailed")}: ${err.message}`
          : t("docs.exportPdfLibraryFailed"),
      );
    } finally {
      setSavingPdfLibrary(false);
    }
  }, [
    exportingPdf,
    savingPdfLibrary,
    writingBlocks,
    displayQuery,
    resolvedParentDocId,
    nodesMap,
    entityNodeId,
    docsMap,
    t,
  ]);

  const handleSaveWritingMarkdownToLibrary = useCallback(async () => {
    if (exportingPdf || savingPdfLibrary) return;
    if (!writingBlocksHaveExportableProse(writingBlocks)) {
      setSavePdfLibraryError(t("docs.exportPdfEmpty"));
      setSavePdfLibraryOk(false);
      return;
    }
    const folderId = String(
      resolvedParentDocId
      || nodesMap?.[entityNodeId]?.parentDocId
      || "",
    ).trim();
    if (!folderId) {
      setSavePdfLibraryError(t("docs.exportPdfNoFolder"));
      setSavePdfLibraryOk(false);
      return;
    }
    if (docsMap && !docsMap[folderId]) {
      setSavePdfLibraryError(t("docs.exportPdfNoFolder"));
      setSavePdfLibraryOk(false);
      return;
    }
    setSavePdfLibraryError("");
    setSavePdfLibraryOk(false);
    setSavingPdfLibrary(true);
    try {
      const result = await saveWritingBlocksMarkdownToFolderLibrary(writingBlocks, {
        title: displayQuery,
        folderId,
        tag: displayQuery,
        description: t("docs.exportPdfLibraryDescription", { title: displayQuery })
          .replace(/PDF/g, "Markdown"),
      });
      if (!result?.ok) {
        console.error("[exportMdLibrary]", result?.reason, result?.error || result);
        if (result?.reason === "empty") {
          setSavePdfLibraryError(t("docs.exportPdfEmpty"));
        } else if (result?.reason === "no_folder" || result?.reason === "create_failed") {
          setSavePdfLibraryError(t("docs.exportPdfNoFolder"));
        } else if (
          /sign in|auth|not authenticated/i.test(String(result?.error || ""))
        ) {
          setSavePdfLibraryError(t("docs.exportPdfNeedSignIn"));
        } else {
          setSavePdfLibraryError(
            result?.error
              ? `${t("docs.exportPdfLibraryFailed")}: ${result.error}`
              : t("docs.exportPdfLibraryFailed"),
          );
        }
        return;
      }
      setSavePdfLibraryOk(true);
      setLibraryInitialTab("skill");
      setLibraryOpen(true);
      window.setTimeout(() => setSavePdfLibraryOk(false), 2400);
    } catch (err) {
      console.error("[exportMdLibrary]", err);
      setSavePdfLibraryError(
        err?.message
          ? `${t("docs.exportPdfLibraryFailed")}: ${err.message}`
          : t("docs.exportPdfLibraryFailed"),
      );
    } finally {
      setSavingPdfLibrary(false);
    }
  }, [
    exportingPdf,
    savingPdfLibrary,
    writingBlocks,
    displayQuery,
    resolvedParentDocId,
    nodesMap,
    entityNodeId,
    docsMap,
    t,
  ]);

  const handleGinaDocumentAction = useCallback((action) => {
    const key = String(action || "").trim();
    if (key === "organize") {
      void handleOrganizeWritingText();
      return;
    }
    if (key === "export_pdf") {
      void handleExportWritingPdf();
      return;
    }
    if (key === "save_pdf_library") {
      void handleSaveWritingPdfToLibrary();
      return;
    }
    if (key === "export_md") {
      void handleExportWritingMarkdown();
      return;
    }
    if (key === "save_md_library") {
      void handleSaveWritingMarkdownToLibrary();
      return;
    }
    if (key === "import_pdf") {
      // Keep Gina open — open local file picker and resolve when conversion finishes.
      return new Promise((resolve, reject) => {
        if (ginaPdfUploadPendingRef.current) {
          try {
            ginaPdfUploadPendingRef.current.reject(new Error("cancelled"));
          } catch { /* ignore */ }
          ginaPdfUploadPendingRef.current = null;
        }
        ginaPdfUploadPendingRef.current = { resolve, reject };
        window.setTimeout(() => {
          ginaPdfUploadInputRef.current?.click();
        }, 0);
        const onFocus = () => {
          window.removeEventListener("focus", onFocus);
          window.setTimeout(() => {
            if (ginaPdfUploadBusyRef.current) return;
            if (ginaPdfUploadPendingRef.current?.reject === reject) {
              ginaPdfUploadPendingRef.current = null;
              reject(new Error("cancelled"));
            }
          }, 500);
        };
        window.setTimeout(() => {
          window.addEventListener("focus", onFocus);
        }, 100);
      });
    }
  }, [
    handleOrganizeWritingText,
    handleExportWritingPdf,
    handleSaveWritingPdfToLibrary,
    handleExportWritingMarkdown,
    handleSaveWritingMarkdownToLibrary,
  ]);

  const appendBlockFromPicker = useCallback((alias, textPrefix = "") => {
    const parsed = resolveSlashQuery(alias);
    if (!parsed) return;
    if (isLibrarySlashAction(parsed)) {
      const normalized = normalizeWritingBlocks(writingBlocks);
      const snap = writingCaretRef.current;
      const blockIndex = typeof snap?.blockIndex === "number"
        ? snap.blockIndex
        : writingFocusTarget?.blockIndex;
      if (blockIndex != null && normalized[blockIndex]?.type === NODE_BLOCK_TYPES.TEXT) {
        const nextBlocks = applySlashInTextBlock(normalized, blockIndex, parsed);
        setWritingBlocks(nextBlocks);
        onContentChange(serializeNodeWritingBody({ blocks: nextBlocks }));
      }
      setLibrarySlashAction(parsed.action);
      return;
    }

    const normalized = normalizeWritingBlocks(writingBlocks);
    const snap = writingCaretRef.current;
    const focusForInsert = {
      ...(writingFocusTarget || {}),
      ...(snap && typeof snap.caret === "number"
        && (writingFocusTarget?.blockIndex == null || snap.blockIndex === writingFocusTarget.blockIndex)
        ? { caret: snap.caret }
        : {}),
    };
    const { blocks: nextBlocks, insertedIndex, reusedAgent, focusText } = insertNodeWritingSlashAtFocus(
      normalized,
      focusForInsert,
      parsed,
      textPrefix,
    );
    setWritingBlocks(nextBlocks);
    onContentChange(serializeNodeWritingBody({ blocks: nextBlocks }));
    if (insertedIndex < 0) return;
    // focusKey forces the stack to re-run focus even if blockIndex matches a prior target.
    const focusKey = `${nextBlocks[insertedIndex]?.id || insertedIndex}:${Date.now()}`;
    if (focusText) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusText: true, focusKey });
      return;
    }
    if (reusedAgent) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusAgent: true, focusKey });
      return;
    }
    if (parsed.type === DOC_BLOCK_TYPES.TODO) {
      const todoBlock = nextBlocks[insertedIndex];
      setWritingFocusTarget({
        blockIndex: insertedIndex,
        itemId: todoBlock?.items?.[0]?.id ?? null,
        focusKey,
      });
    } else if (parsed.type === DOC_BLOCK_TYPES.CODE) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusCode: true, focusKey });
    } else if (
      parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT
      || parsed.type === DOC_BLOCK_TYPES.LINK_VAULT
    ) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusVault: true, focusKey });
    } else if (parsed.type === DOC_BLOCK_TYPES.AGENT) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusAgent: true, focusKey });
    } else if (
      parsed.type === DOC_BLOCK_TYPES.IMAGE
      || parsed.type === DOC_BLOCK_TYPES.IMAGE_SPLIT
      || parsed.type === DOC_BLOCK_TYPES.MOODBOARD
      || parsed.type === DOC_BLOCK_TYPES.BANNER
      || parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD
    ) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusKey });
    } else if (
      parsed.type === DOC_BLOCK_TYPES.H1
      || parsed.type === DOC_BLOCK_TYPES.H2
      || parsed.type === DOC_BLOCK_TYPES.H3
    ) {
      setWritingFocusTarget({ blockIndex: insertedIndex, focusHeading: true, focusKey });
    }
  }, [writingBlocks, writingFocusTarget, onContentChange, resolveSlashQuery]);

  const applySlashFromAlias = useCallback((alias, textPrefix = "") => {
    if (dataType === NODE_DATA_TYPES.TEXT && !calendarPayload) {
      appendBlockFromPicker(alias, textPrefix);
      return;
    }
    if (!onDataTypeChange) return;
    const shape = initialNodeShapeFromSlash(alias, textPrefix);
    if (!shape) return;
    onDataTypeChange(shape.dataType);
    onContentChange(shape.content);
    if (shape.defaultTitle && onQueryChange && !(query || "").trim()) {
      onQueryChange(shape.defaultTitle);
    }
  }, [
    appendBlockFromPicker,
    calendarPayload,
    dataType,
    onContentChange,
    onDataTypeChange,
    onQueryChange,
    query,
  ]);

  useEffect(() => {
    if (dataType === "checkbox") return;
    bodyRef.current?.focus();
  }, [dataType]);

  useEffect(() => {
    setContentFocusMode(initialContentFocus);
  }, [initialContentFocus]);

  useEffect(() => {
    if (!contentFocusMode) return undefined;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(focusContentArea);
    });
    return () => cancelAnimationFrame(frame);
  }, [contentFocusMode, focusContentArea]);


  useLayoutEffect(() => {
    if (!contentFocusMode) return;
    syncFocusCategoryHeight();
  }, [contentFocusMode, query, syncFocusCategoryHeight]);

  useEffect(() => {
    syncQueryInputHeight();
  }, [query, syncQueryInputHeight]);

  useEffect(() => {
    setActiveNodeQueryDraft(displayQuery);
    return () => setActiveNodeQueryDraft("");
  }, [displayQuery, setActiveNodeQueryDraft]);

  useEffect(() => {
    if (!contentFocusMode) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      exitContentFocusMode();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [contentFocusMode, exitContentFocusMode]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (contentFocusMode) return;
      if (e.key === "Escape") {
        e.preventDefault();
        requestDismiss();
        return;
      }
      if (!onSave) return;
      const isSaveShortcut = e.key === "Enter" && (e.metaKey || e.ctrlKey);
      if (!isSaveShortcut) return;
      e.preventDefault();
      handleFooterSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contentFocusMode, requestDismiss, onSave, handleFooterSave]);

  const modalCard = (
      <div
        className={
          "lp-modal node-query-modal"
          + (contentFocusMode ? " node-query-modal--content-focus" : "")
        }
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="node-query-modal-title"
      >
        {contentFocusMode ? (
          <header className="doc-focus-top">
            <div className="doc-focus-top__row">
              {queryEditable ? (
                <textarea
                  ref={focusCategoryRef}
                  className="doc-focus-top__category"
                  value={query}
                  placeholder="Describe a Title"
                  rows={1}
                  aria-label="Query or title"
                  spellCheck={false}
                  onChange={(e) => {
                    onQueryChange(e.target.value);
                    requestAnimationFrame(syncFocusCategoryHeight);
                  }}
                />
              ) : (
                <p className="doc-focus-top__category doc-focus-top__category--static">
                  {displayQuery}
                </p>
              )}
              <div className="doc-focus-top__meta">
                {entityNodeId ? (
                  <button
                    type="button"
                    className="node-query-modal__doc-action node-query-modal__library"
                    onClick={() => setLibraryOpen(true)}
                    title={t("doc.library.openWithName", { title: displayQuery })}
                    aria-label={t("doc.library.openDocLibraryAria", { title: displayQuery })}
                  >
                    <span>{t("doc.library.openWithName", { title: displayQuery })}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="node-query-modal__doc-action node-query-modal__call-asistente"
                  onClick={() => setGinaChatOpen(true)}
                  title={t("gina.callAsistenteTitle")}
                  aria-label={t("gina.callAsistenteTitle")}
                >
                  <span>{t("gina.callAsistente")}</span>
                </button>
                <button
                  type="button"
                  className="node-query-modal__doc-action node-query-modal__doc-action--icon-only node-query-modal__new-todo"
                  onClick={handleOpenLinkedLazyTodo}
                  disabled={!companyObjectId}
                  title={
                    companyObjectId
                      ? t("gina.newTodoTitle")
                      : t("lazyTodos.enterCompanyFirst")
                  }
                  aria-label={t("gina.newTodoTitle")}
                >
                  <img
                    className="node-query-modal__doc-action-icon"
                    src="/uploads/to-do.svg"
                    alt=""
                    aria-hidden
                    draggable={false}
                  />
                </button>
                {showCloseButton ? (
                  <button
                    type="button"
                    className="doc-new-head-expand-btn doc-focus-top__close"
                    onClick={requestDismiss}
                    aria-label="Close"
                  >
                    <span className="doc-new-head-close-x" aria-hidden>×</span>
                  </button>
                ) : null}
              </div>
            </div>
          </header>
        ) : null}
        <header className="node-query-modal__head">
          <div
            className={
              "node-query-modal__head-top"
              + (showCloseButton ? " node-query-modal__head-top--closable" : "")
            }
          >
            <img
              className="node-query-modal__node-icon"
              src="/uploads/FileDashed.svg"
              alt=""
              aria-hidden
            />
            {parentSelectable ? (
              <select
                className="node-query-modal__parent-select"
                value={resolvedParentDocId}
                onChange={(e) => onParentDocIdChange(e.target.value || null)}
                aria-label={t("canvas.parentDocLabel")}
              >
                <option value="">{t("canvas.parentDocPlaceholder")}</option>
                {adoptableDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {resolveAdoptableDocLabel(d)}
                  </option>
                ))}
              </select>
            ) : parentDocLabel ? (
              <span className="node-query-modal__parent-doc">{parentDocLabel}</span>
            ) : null}
            <div className="node-query-modal__head-actions">
              {entityNodeId ? (
                <button
                  type="button"
                  className="node-query-modal__doc-action node-query-modal__library"
                  onClick={() => setLibraryOpen(true)}
                  title={t("doc.library.openWithName", { title: displayQuery })}
                  aria-label={t("doc.library.openDocLibraryAria", { title: displayQuery })}
                >
                  <span>{t("doc.library.openWithName", { title: displayQuery })}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="node-query-modal__doc-action node-query-modal__call-asistente"
                onClick={() => setGinaChatOpen(true)}
                title={t("gina.callAsistenteTitle")}
                aria-label={t("gina.callAsistenteTitle")}
              >
                <span>{t("gina.callAsistente")}</span>
              </button>
              <button
                type="button"
                className="node-query-modal__doc-action node-query-modal__doc-action--icon-only node-query-modal__new-todo"
                onClick={handleOpenLinkedLazyTodo}
                disabled={!companyObjectId}
                title={
                  companyObjectId
                    ? t("gina.newTodoTitle")
                    : t("lazyTodos.enterCompanyFirst")
                }
                aria-label={t("gina.newTodoTitle")}
              >
                <img
                  className="node-query-modal__doc-action-icon"
                  src="/uploads/to-do.svg"
                  alt=""
                  aria-hidden
                  draggable={false}
                />
              </button>
              {showCloseButton ? (
                <button
                  type="button"
                  className="doc-new-head-expand-btn"
                  onClick={requestDismiss}
                  aria-label="Close"
                >
                  <span className="doc-new-head-close-x" aria-hidden>×</span>
                </button>
              ) : null}
            </div>
          </div>

          {queryEditable ? (
            <div className="node-query-modal__query-edit" id="node-query-modal-title">
              <textarea
                ref={queryInputRef}
                className="node-query-modal__query-input"
                value={query}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  syncQueryInputHeight();
                }}
                rows={1}
                placeholder="Describe a Title"
                spellCheck={false}
                aria-label="Query or title"
              />
            </div>
          ) : (
            <h2 id="node-query-modal-title" className="node-query-modal__query-title">
              {displayQuery}
            </h2>
          )}

          {!showStatusMeta ? (
            <div className="node-query-modal__created-row">
              <span className="node-query-modal__key">Created:</span>
              <input
                type="date"
                className="node-query-modal__date"
                value={createdDate}
                readOnly={!dateEditable}
                tabIndex={dateEditable ? 0 : -1}
                aria-readonly={!dateEditable}
                onChange={dateEditable ? (e) => onCreatedDateChange(e.target.value) : undefined}
              />
            </div>
          ) : null}

          {showStatusMeta ? (
            <div
              className={
                "doc-meta-strip node-query-modal__doc-meta"
                + (statusMetaExpanded ? " doc-meta-strip--open" : "")
              }
            >
              <div className="doc-meta-strip__summary">
                <div className="doc-meta-strip__chips" role="list">
                  {showCampaignStatus ? (
                    <div className="doc-meta-chip" title={announceDate || t("sidebar.campaignDocDateStart")}>
                      <span className="doc-meta-chip-k">{t("sidebar.campaignDocDateStart")}</span>
                      <span className="doc-meta-chip-v tone-muted">
                        {formatMmDdYy(announceDate) || "—"}
                      </span>
                    </div>
                  ) : (
                    <div className="doc-meta-chip" title={createdDate || "Created"}>
                      <span className="doc-meta-chip-k">Created</span>
                      <span className="doc-meta-chip-v tone-muted">
                        {formatMmDdYy(createdDate) || "—"}
                      </span>
                    </div>
                  )}
                  {showCampaignStatus ? (
                    <div
                      className={
                        "doc-meta-chip"
                        + (isCampaignActive ? " doc-meta-chip--campaign-active" : "")
                      }
                      title={isCampaignActive ? t("sidebar.campaignDocActive") : t("sidebar.campaignDocInactive")}
                    >
                      <span className="doc-meta-chip-k">{t("sidebar.campaignDocStatus")}</span>
                      <span
                        className={
                          "doc-meta-chip-v is-lowercase"
                          + (isCampaignActive ? " is-campaign-active" : " is-campaign-inactive")
                        }
                      >
                        {isCampaignActive ? t("sidebar.campaignDocActive") : t("sidebar.campaignDocInactive")}
                      </span>
                    </div>
                  ) : workStatus && (
                    workStatus === DOC_WORK_STATUS.RESERVED
                    || workStatus === DOC_WORK_STATUS.FLEXIBLE
                    || docDateInFolderFrame
                  ) ? (
                    <div
                      className={
                        "doc-meta-chip doc-meta-chip--work-status"
                        + (workStatus === DOC_WORK_STATUS.COMPLETED ? " doc-meta-chip--completed" : "")
                      }
                      title={workStatusLabel}
                    >
                      <span className="doc-meta-chip-k">{t("meta.status")}</span>
                      <span className="doc-meta-chip-v doc-meta-chip-v--status">
                        <DocStatusChip status={workStatus} />
                      </span>
                    </div>
                  ) : null}
                  {showLaunchInMeta && String(anchorDate || "").trim() ? (
                    <div
                      className="doc-meta-chip"
                      title={`${t("sidebar.campaignDocLaunchDate")} ${formatMmDdYy(anchorDate)}${anchorTime ? ` · ${anchorTime}` : ""}`}
                    >
                      <span className="doc-meta-chip-k">{t("sidebar.campaignDocLaunchDate")}</span>
                      <span className="doc-meta-chip-v tone-muted">
                        {formatMmDdYy(anchorDate) || "—"}
                        {anchorTime ? ` · ${anchorTime}` : ""}
                      </span>
                    </div>
                  ) : null}
                  {showCampaignStatus && String(subcategory || "").trim() ? (
                    <div className="doc-meta-chip" title={subcategory.trim()}>
                      <span className="doc-meta-chip-k">{t("sidebar.campaignDocSubcategory")}</span>
                      <span className="doc-product-category-tag doc-product-category-tag--summary doc-product-category-tag--campaign-sub">
                        {subcategory.trim()}
                      </span>
                    </div>
                  ) : null}
                  {sourceOption ? (
                    <div
                      className="doc-meta-chip doc-meta-chip--source-only"
                      title={sourceOption.label}
                    >
                      <img
                        src={sourceOption.src}
                        alt=""
                        className="node-query-modal__source-chip-icon"
                        draggable={false}
                      />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="doc-meta-strip__toggle"
                  onClick={() => setStatusMetaExpanded((v) => !v)}
                  aria-expanded={statusMetaExpanded}
                  aria-label={statusMetaExpanded ? "Hide meta fields" : "Edit meta fields"}
                  title={statusMetaExpanded ? "Hide" : "Edit"}
                >
                  <span className="doc-meta-strip__chevron" aria-hidden>
                    {statusMetaExpanded ? "▾" : "›"}
                  </span>
                </button>
              </div>

              <div className="doc-meta-strip__drawer" aria-hidden={!statusMetaExpanded}>
                <div
                  className={
                    "doc-meta-strip__fields"
                    + (showCampaignStatus ? " doc-meta-strip__fields--campaign-child" : "")
                  }
                >
                  {showCampaignStatus ? (
                    <label className="doc-meta-field">
                      <span className="doc-meta-field-k">{t("sidebar.campaignDocDateStart")}</span>
                      <input
                        type="date"
                        className="doc-new-date doc-meta-field-input"
                        value={announceDate}
                        readOnly={!announceEditable}
                        tabIndex={announceEditable ? 0 : -1}
                        aria-readonly={!announceEditable}
                        onChange={announceEditable ? (e) => onAnnounceDateChange(e.target.value) : undefined}
                        onClick={announceEditable ? openDatePicker : undefined}
                        onFocus={announceEditable ? openDatePicker : undefined}
                      />
                    </label>
                  ) : (
                    <label className="doc-meta-field">
                      <span className="doc-meta-field-k">Created</span>
                      <input
                        type="date"
                        className="doc-new-date doc-meta-field-input"
                        value={createdDate}
                        readOnly={!dateEditable}
                        tabIndex={dateEditable ? 0 : -1}
                        aria-readonly={!dateEditable}
                        onChange={dateEditable ? (e) => onCreatedDateChange(e.target.value) : undefined}
                        onClick={dateEditable ? openDatePicker : undefined}
                        onFocus={dateEditable ? openDatePicker : undefined}
                      />
                    </label>
                  )}
                  <div className="doc-meta-field">
                    <span className="doc-meta-field-k">
                      {showCampaignStatus ? t("sidebar.campaignDocStatus") : "Status"}
                    </span>
                    {showCampaignStatus ? (
                      <div className="doc-new-campaign-toggle" role="group" aria-label={t("sidebar.campaignDocStatus")}>
                        <button
                          type="button"
                          className={
                            "doc-new-campaign-opt"
                            + (!isCampaignActive ? " is-on" : "")
                          }
                          onClick={() => onCampaignStatusChange?.("inactive")}
                          aria-pressed={!isCampaignActive}
                        >
                          {t("sidebar.campaignDocInactive")}
                        </button>
                        <button
                          type="button"
                          className={
                            "doc-new-campaign-opt doc-new-campaign-opt--active"
                            + (isCampaignActive ? " is-on" : "")
                          }
                          onClick={() => onCampaignStatusChange?.("active")}
                          aria-pressed={isCampaignActive}
                        >
                          {t("sidebar.campaignDocActive")}
                        </button>
                      </div>
                    ) : (
                      <div className="doc-new-campaign-toggle doc-work-status-toggle" role="group" aria-label={t("meta.status")}>
                        {showWorkStatuses ? (
                          <button
                            type="button"
                            className={
                              "doc-new-campaign-opt doc-work-status-opt doc-work-status-opt--not-started"
                              + (workStatus === DOC_WORK_STATUS.NOT_STARTED ? " is-on" : "")
                            }
                            onClick={() => handleStatusChange(DOC_WORK_STATUS.NOT_STARTED)}
                            aria-pressed={workStatus === DOC_WORK_STATUS.NOT_STARTED}
                          >
                            {t("sidebar.docStatusNotStarted")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={
                            "doc-new-campaign-opt doc-work-status-opt doc-work-status-opt--reserved"
                            + (workStatus === DOC_WORK_STATUS.RESERVED ? " is-on" : "")
                          }
                          onClick={() => handleStatusChange(DOC_WORK_STATUS.RESERVED)}
                          aria-pressed={workStatus === DOC_WORK_STATUS.RESERVED}
                        >
                          {t("sidebar.docStatusReserved")}
                        </button>
                        <button
                          type="button"
                          className={
                            "doc-new-campaign-opt doc-work-status-opt doc-work-status-opt--flexible"
                            + (workStatus === DOC_WORK_STATUS.FLEXIBLE ? " is-on" : "")
                          }
                          onClick={() => handleStatusChange(DOC_WORK_STATUS.FLEXIBLE)}
                          aria-pressed={workStatus === DOC_WORK_STATUS.FLEXIBLE}
                        >
                          {t("sidebar.docStatusFlexible")}
                        </button>
                        {showWorkStatuses ? (
                          <>
                            <button
                              type="button"
                              className={
                                "doc-new-campaign-opt doc-work-status-opt doc-work-status-opt--in-progress"
                                + (workStatus === DOC_WORK_STATUS.IN_PROGRESS ? " is-on" : "")
                              }
                              onClick={() => handleStatusChange(DOC_WORK_STATUS.IN_PROGRESS)}
                              aria-pressed={workStatus === DOC_WORK_STATUS.IN_PROGRESS}
                            >
                              {t("sidebar.docStatusInProgress")}
                            </button>
                            <button
                              type="button"
                              className={
                                "doc-new-campaign-opt doc-work-status-opt doc-work-status-opt--submitted"
                                + (workStatus === DOC_WORK_STATUS.SUBMITTED ? " is-on" : "")
                              }
                              onClick={() => handleStatusChange(DOC_WORK_STATUS.SUBMITTED)}
                              aria-pressed={workStatus === DOC_WORK_STATUS.SUBMITTED}
                            >
                              {t("sidebar.docStatusSubmitted")}
                            </button>
                            <button
                              type="button"
                              className={
                                "doc-new-campaign-opt doc-work-status-opt doc-work-status-opt--past-due"
                                + (workStatus === DOC_WORK_STATUS.PAST_DUE ? " is-on" : "")
                              }
                              onClick={() => handleStatusChange(DOC_WORK_STATUS.PAST_DUE)}
                              aria-pressed={workStatus === DOC_WORK_STATUS.PAST_DUE}
                            >
                              {t("sidebar.docStatusPastDue")}
                            </button>
                            <button
                              type="button"
                              className={
                                "doc-new-campaign-opt doc-new-campaign-opt--completed doc-work-status-opt"
                                + (workStatus === DOC_WORK_STATUS.COMPLETED ? " is-on" : "")
                              }
                              onClick={() => handleStatusChange(DOC_WORK_STATUS.COMPLETED)}
                              aria-pressed={workStatus === DOC_WORK_STATUS.COMPLETED}
                            >
                              {t("sidebar.docCompleted")}
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {showLaunchInMeta ? (
                    <div className="doc-meta-field doc-meta-field--launch">
                      <span className="doc-meta-field-k">{t("sidebar.campaignDocLaunchDate")}</span>
                      <BlockAnchorFields
                        className="node-query-modal__launch-in-meta"
                        label={t("sidebar.campaignDocLaunchDate")}
                        hideLabel
                        anchorDate={anchorDate}
                        anchorTime={anchorTime}
                        onAnchorDateChange={onAnchorDateChange}
                        onAnchorTimeChange={onAnchorTimeChange}
                      />
                    </div>
                  ) : null}
                  {showCampaignStatus && onSubcategoryChange ? (
                    <ProductCategoryField
                      value={subcategory}
                      onChange={onSubcategoryChange}
                      label={t("sidebar.campaignDocSubcategory")}
                      placeholder={t("sidebar.campaignDocSubcategoryPlaceholder")}
                      optionsOverride={siblingSubcategories}
                      className="doc-meta-field--campaign-sub"
                    />
                  ) : null}
                  <div className="doc-meta-field doc-meta-field--source">
                    <span className="doc-meta-field-k">Source</span>
                    <div className="node-query-modal__source-grid" role="group" aria-label="Macronode source">
                      <button
                        type="button"
                        className={
                          "node-query-modal__source-opt node-query-modal__source-opt--empty"
                          + (!sourceId ? " is-on" : "")
                        }
                        onClick={() => handleSourceIdChange(null)}
                        title="No source"
                        aria-label="No source"
                      />
                      {DOC_SOURCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={"node-query-modal__source-opt" + (sourceId === opt.id ? " is-on" : "")}
                          onClick={() => {
                            handleSourceIdChange(opt.id);
                            setStatusMetaExpanded(false);
                          }}
                          title={opt.label}
                          aria-label={opt.label}
                        >
                          <img src={opt.src} alt="" draggable={false} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </header>

        <div
          className={
            "node-query-modal__content-box"
            + (calendarPayload ? " node-query-modal__content-box--calendar" : "")
            + (slashCommandsEnabled ? " node-query-modal__content-box--slash" : "")
            + (dataType === "checkbox" ? " node-query-modal__content-box--todo" : "")
            + (contentFocusMode ? " node-query-modal__content-box--focus" : "")
            + (showTextSizeControls ? " node-query-modal__content-box--text-size" : "")
          }
          style={showTextSizeControls ? typographyStyle : undefined}
        >
          <button
            type="button"
            className={
              "doc-new-content-expand-btn node-query-modal__content-expand-btn"
              + (contentFocusMode ? " is-focus" : "")
            }
            onClick={toggleContentFocus}
            aria-label={contentFocusMode ? t("canvas.collapseNode") : t("canvas.expandNode")}
            aria-pressed={contentFocusMode}
            title={contentFocusMode ? t("canvas.collapseNode") : t("canvas.expandNode")}
          >
            <span className="doc-new-content-expand-btn__icon" aria-hidden />
          </button>
          {contentFocusMode && isTextWritingMode ? (
            <div className="node-query-modal__doc-float-stack">
              <button
                type="button"
                className={
                  "node-query-modal__organize-float node-query-modal__export-pdf-float"
                  + (exportingPdf ? " is-loading" : "")
                  + (exportPdfError ? " is-error" : "")
                }
                onClick={handleExportWritingPdf}
                disabled={exportingPdf || savingPdfLibrary}
                aria-busy={exportingPdf}
                aria-label={
                  exportingPdf
                    ? t("docs.exportPdfLoading")
                    : t("docs.exportPdf")
                }
                title={exportPdfError || t("docs.exportPdfTitle")}
              >
                {exportingPdf ? (
                  <span className="node-query-modal__organize-float-spinner" aria-hidden />
                ) : null}
                <span className="node-query-modal__organize-float-label">
                  {exportingPdf
                    ? t("docs.exportPdfLoading")
                    : exportPdfError
                      ? t("docs.exportPdfRetry")
                      : t("docs.exportPdf")}
                </span>
              </button>
              <button
                type="button"
                className={
                  "node-query-modal__organize-float node-query-modal__export-pdf-library-float"
                  + (savingPdfLibrary ? " is-loading" : "")
                  + (savePdfLibraryError ? " is-error" : "")
                  + (savePdfLibraryOk ? " is-ok" : "")
                }
                onClick={handleSaveWritingPdfToLibrary}
                disabled={exportingPdf || savingPdfLibrary}
                aria-busy={savingPdfLibrary}
                aria-label={
                  savingPdfLibrary
                    ? t("docs.exportPdfLibraryLoading")
                    : t("docs.exportPdfLibrary")
                }
                title={
                  savePdfLibraryError
                  || (savePdfLibraryOk ? t("docs.exportPdfLibrarySaved") : t("docs.exportPdfLibraryTitle"))
                }
              >
                {savingPdfLibrary ? (
                  <span className="node-query-modal__organize-float-spinner" aria-hidden />
                ) : null}
                <span className="node-query-modal__organize-float-label">
                  {savingPdfLibrary
                    ? t("docs.exportPdfLibraryLoading")
                    : savePdfLibraryError
                      ? t("docs.exportPdfLibraryRetry")
                      : savePdfLibraryOk
                        ? t("docs.exportPdfLibrarySaved")
                        : t("docs.exportPdfLibrary")}
                </span>
              </button>
              <button
                type="button"
                className={
                  "node-query-modal__organize-float"
                  + (organizingWriting ? " is-loading" : "")
                }
                onClick={handleOrganizeWritingText}
                disabled={organizingWriting || exportingPdf || savingPdfLibrary}
                aria-busy={organizingWriting}
                aria-label={
                  organizingWriting
                    ? t("docs.organizeTextLoading")
                    : t("docs.organizeText")
                }
                title={t("docs.organizeTextTitle")}
              >
                {organizingWriting ? (
                  <span className="node-query-modal__organize-float-spinner" aria-hidden />
                ) : null}
                <span className="node-query-modal__organize-float-label">
                  {organizingWriting
                    ? t("docs.organizeTextLoading")
                    : t("docs.organizeText")}
                </span>
              </button>
            </div>
          ) : null}
          <div
            ref={contentScrollRef}
            tabIndex={-1}
            className={
              "node-query-modal__content-scroll"
              + (contentFocusMode ? " node-query-modal__content-scroll--focus" : "")
            }
          >
          {dataType === NODE_DATA_TYPES.VIDEO ? (
            <VideoEmbedBar
              nodeId={entityNodeId}
              onEmbedChange={(parsed) => {
                onContentChange(mergeVideoNodeContent(content, {
                  rawInput: parsed.rawInput,
                  provider: parsed.provider,
                  videoId: parsed.videoId,
                  embedSrc: parsed.embedSrc,
                }));
              }}
            />
          ) : dataType === "date" ? (
            <div className="node-query-modal__date-editor">
              <input
                ref={bodyRef}
                type="date"
                className="node-query-modal__date-input"
                value={normalizedDateContent.date}
                onChange={(e) => onContentChange({ ...normalizedDateContent, date: e.target.value })}
                aria-label="Date"
              />
              <input
                type="time"
                className="node-query-modal__time-input"
                value={normalizedDateContent.time}
                onChange={(e) => onContentChange({ ...normalizedDateContent, time: e.target.value })}
                aria-label="Time"
              />
            </div>
          ) : dataType === "metric" ? (
            <MetricFieldsEditor
              valueInputRef={bodyRef}
              className="node-query-modal__metric-editor"
              value={normalizedMetricContent.value}
              unit={normalizedMetricContent.unit}
              onValueChange={(value) =>
                onContentChange({ ...normalizedMetricContent, value })
              }
              onUnitChange={(unit) =>
                onContentChange({ ...normalizedMetricContent, unit })
              }
            />
          ) : dataType === "checkbox" ? (
            <div className="node-query-modal__todo">
              <DocTodoPlanBlockView
                listTitle={checkboxTodoContent.listTitle}
                onListTitleChange={(listTitle) => updateTodoContent({ listTitle })}
                linksEnabled={false}
                showDragHandle={false}
                items={checkboxTodoContent.items}
                focusItemId={todoFocusItemId}
                onItemsChange={(items) => updateTodoContent({ items })}
                onItemKeyDown={handleTodoItemKeyDown}
                onAddItem={() => {
                  const newItem = createTodoItem({ text: "" });
                  updateTodoContent({ items: [...checkboxTodoContent.items, newItem] });
                  setTodoFocusItemId(newItem.id);
                }}
              />
            </div>
          ) : isTextWritingMode ? (
            <div className="node-query-modal__field-shell">
              <NodeWritingBlockStack
                className="node-query-modal__writing-stack"
                blocks={writingBlocks}
                onBlocksChange={updateWritingBlocks}
                focusTarget={writingFocusTarget}
                onFocusTargetChange={setWritingFocusTarget}
                writingCaretRef={writingCaretRef}
                slashEnabled={slashCommandsEnabled}
                contentFocusMode={contentFocusMode}
                parseSlashQuery={resolveSlashQuery}
                slashGhostHints={
                  linkedFromDocument
                    ? DOCUMENT_SLASH_GHOST_HINTS
                    : undefined
                }
                textPlaceholder={
                  slashCommandsEnabled
                    ? "Escribe aquí o /macronodo"
                    : "Escribe aquí"
                }
                companyObjectId={companyObjectId}
                libraryOwnerKind={entityNodeId ? "document" : "folder"}
                libraryOwnerId={entityNodeId || resolvedParentDocId || ""}
                folderLibraryId={entityNodeId ? (resolvedParentDocId || "") : ""}
                documentTitle={displayQuery}
                onLibrarySlashAction={setLibrarySlashAction}
              />
            </div>
          ) : calendarPayload ? (
            <CalendarEventNodeView
              content={content}
              className="node-query-modal__calendar-body"
            />
          ) : (
            <SlashAwareTextarea
              inputRef={bodyRef}
              className="node-query-modal__body"
              wrapClassName="node-query-modal__slash-wrap"
              value={typeof content === "string" ? content : ""}
              placeholder="Type your text here"
              onChange={onContentChange}
              minHeightPx={120}
              maxHeightPx={320}
              ariaLabel="Contenido del nodo"
            />
          )}
          </div>
          {slashCommandsEnabled ? (
            <DocSlashCommandPicker
              variant="floating"
              commands={activeSlashCommands}
              onSelectCommand={applySlashFromAlias}
              isCommandEnabled={isSlashCommandEnabled}
            />
          ) : null}
        </div>

        <footer className="node-query-modal__footer-row">
          <div className="node-query-modal__footer-start">
            {showScheduleAnchor ? (
              <BlockAnchorFields
                className="node-query-modal__schedule"
                hideLabel
                anchorDate={anchorDate}
                anchorTime={anchorTime}
                anchorFinishTime={anchorFinishTime}
                onAnchorDateChange={onAnchorDateChange}
                onAnchorTimeChange={onAnchorTimeChange}
                onAnchorFinishTimeChange={onAnchorFinishTimeChange}
                minDate={scheduleMinDate}
                maxDate={scheduleMaxDate}
                enableTimeRange
                occupied={gatedScheduleOccupied}
                overlapHint={gatedScheduleOverlapHint}
                validationError={scheduleValidationError}
              />
            ) : null}
            {onSave ? (
              <button
                type="button"
                className="doc-content-text-size-controls__btn node-query-modal__footer-save"
                onClick={handleFooterSave}
                aria-label={t("common.save")}
                title={t("common.save")}
              >
                <img
                  src={NODE_FOOTER_SAVE_ICON}
                  alt=""
                  width={63}
                  height={22}
                  draggable={false}
                />
              </button>
            ) : null}
            {showTextSizeControls ? (
              <ContentTextSizeControls
                typographyId={typographyId}
                onTypographyChange={setTypographyId}
              />
            ) : null}
          </div>
        </footer>
      </div>
  );

  const unsavedConfirm = showUnsavedConfirm && typeof document !== "undefined"
    ? createPortal(
        <div className="doc-unsaved-confirm-overlay" role="presentation">
          <div
            className="doc-unsaved-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="node-modal-unsaved-title"
          >
            <p id="node-modal-unsaved-title" className="doc-unsaved-confirm__text">
              {t("unsavedChanges.docPrompt")}
            </p>
            <div className="doc-unsaved-confirm__actions">
              <button
                type="button"
                className="doc-unsaved-confirm__btn doc-unsaved-confirm__btn--yes"
                onClick={async () => {
                  setShowUnsavedConfirm(false);
                  const gate = await ensureChildScheduleOrRemind();
                  if (gate === "stay") return;
                  if (gate === "discard") {
                    discardWithoutSave();
                    return;
                  }
                  writeImageSplitPromptsFromBlocks(writingBlocks, {
                    folderId: entityNodeId ? (resolvedParentDocId || "") : "",
                    documentId: entityNodeId || "",
                  });
                  onSave?.();
                  // onSave (flush/handleSave) closes the modal; do not dismiss-without-save after.
                }}
              >
                {t("unsavedChanges.yes")}
              </button>
              <button
                type="button"
                className="doc-unsaved-confirm__btn"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  discardWithoutSave();
                }}
              >
                {t("unsavedChanges.no")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const ginaChat = ginaChatOpen ? (
    <GinaChatOverlay
      documentId={entityNodeId}
      assistantName={t("gina.name")}
      openingMessage=""
      demoReply={t("gina.demoReply")}
      placeholder={t("gina.placeholder")}
      speechLang={locale === "es" ? "es-ES" : "en-US"}
      labels={{
        messageAria: t("gina.messageAria"),
        sendAria: t("gina.sendAria"),
        micAria: t("gina.micAria"),
        micUnsupported: t("gina.micUnsupported"),
        listening: t("gina.listening"),
        listeningHold: t("gina.listeningHold"),
        listeningCancel: t("gina.listeningCancel"),
        deletePhraseArmed: t("gina.deletePhraseArmed"),
        deletePhraseMiss: t("gina.deletePhraseMiss"),
        dictationInsert: t("gina.dictationInsert"),
        dictationSend: t("gina.dictationSend"),
        micPermission: t("gina.micPermission"),
        micNoSpeech: t("gina.micNoSpeech"),
        micNoDevice: t("gina.micNoDevice"),
        micNetwork: t("gina.micNetwork"),
        micStartFailed: t("gina.micStartFailed"),
        micError: t("gina.micError"),
        ttsOn: t("gina.ttsOn"),
        ttsOff: t("gina.ttsOff"),
        closeAria: t("gina.closeAria"),
        typingAria: t("gina.typingAria"),
        dialogAria: t("gina.dialogAria"),
        queued: t("gina.queued"),
        meetingToggle: t("gina.meetingToggle"),
        meetingActiveHint: t("gina.meetingActiveHint"),
        meetingThisDocument: t("gina.meetingThisDocument"),
        meetingOffHint: t("gina.meetingOffHint"),
        moreActions: t("gina.moreActions"),
        moreActionsAria: t("gina.moreActionsAria"),
        moreActionsDisabledHint: t("gina.moreActionsDisabledHint"),
        moreActionsAck: t("gina.moreActionsAck"),
        moreActionsMenuAria: t("gina.moreActionsMenuAria"),
        composerLockedHint: t("gina.composerLockedHint"),
      }}
      onSendMessage={handleGinaInDocSend}
      onDocumentAction={handleGinaDocumentAction}
      writingEmpty={writingTextAreasAreEmpty(writingBlocks)}
      onClose={() => setGinaChatOpen(false)}
    />
  ) : null;

  const ginaPdfUploadInput = (
    <input
      ref={ginaPdfUploadInputRef}
      type="file"
      accept="application/pdf,.pdf"
      hidden
      onChange={handleGinaLocalPdfUpload}
    />
  );

  const libraryOverlay = entityNodeId && libraryOpen ? (
    <FolderLibraryOverlay
      ownerKind="document"
      ownerId={entityNodeId}
      folderLibraryId={
        resolvedParentDocId
        || String(nodesMap?.[entityNodeId]?.parentDocId || "").trim()
        || ""
      }
      initialTab={libraryInitialTab}
      writingEmpty={writingTextAreasAreEmpty(writingBlocks)}
      autoStartPdfImport={libraryAutoPdfImport}
      onAutoStartPdfImportConsumed={() => setLibraryAutoPdfImport(false)}
      onImportPdfToWriting={handleImportPdfFromLibrary}
      onClose={() => {
        setLibraryOpen(false);
        setLibraryInitialTab(null);
        setLibraryAutoPdfImport(false);
      }}
    />
  ) : null;

  const libraryIoUi = librarySlashAction && !entityNodeId ? (
    <LibraryNeedSaveNotice onClose={() => setLibrarySlashAction(null)} />
  ) : librarySlashAction === LIBRARY_SLASH_ACTIONS.INPUT && entityNodeId ? (
    <LibrarySetInputModal
      ownerId={entityNodeId}
      onClose={() => setLibrarySlashAction(null)}
      onSaved={() => {
        setLibrarySlashAction(null);
        setLibraryInitialTab("documents");
        setLibraryOpen(true);
      }}
    />
  ) : null;

  if (embedded) {
    return (
      <>
        {modalCard}
        {unsavedConfirm}
        {ginaChat}
        {ginaPdfUploadInput}
        {libraryOverlay}
        {libraryIoUi}
      </>
    );
  }

  const overlayClass = [
    "node-query-overlay",
    "lp-overlay--solid",
    "lp-overlay--center",
    contentFocusMode ? "node-query-overlay--content-focus" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      {createPortal(
        <div className={overlayClass} role="presentation">
          {modalCard}
        </div>,
        document.body,
      )}
      {unsavedConfirm}
      {ginaChat}
      {ginaPdfUploadInput}
      {libraryOverlay}
      {libraryIoUi}
    </>
  );
}
