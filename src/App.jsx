import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  COMPANIES, INTEL, shortId, getToday,
} from './data.jsx';
import { BlueprintCanvas } from './canvas.jsx';
import { IntelPanel, Timeline } from './panels.jsx';
import { TopBar, MetaBar, ScanOverlay, Toast } from './dashboard.jsx';
import { useThemeStore } from './stores/themeStore.js';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton,
} from './tweaks-panel.jsx';
import { useLocaleStore } from './i18n/localeStore.js';
import {
  initStores,
  useDocsStore,
  useNodesStore,
  useObjectsStore,
  useTimelineStore,
  useUIStateStore,
  useObjectTargetHoldStore,
  usePlanStore,
  useUpgradeModalStore,
  useReferralModalStore,
  FREE_LIMITS,
} from './stores/index.js';
import { resolveEffectiveDashboardObjectId } from './lib/objectTargetHold.js';
import { setCorpusTimelineAuthority } from './lib/timelineCorpusAuthority.js';
import { useLazyTodosStore } from './stores/lazyTodosStore.js';
import { cloneLazyTodo } from './lib/lazyTodos.js';
import { lazyTodoHasContent } from './lib/lazyTodoItemKeyDown.js';
import { UpgradeModal } from './components/plans/UpgradeModal.jsx';
import { ReferralModal } from './components/plans/ReferralModal.jsx';
import { ConfirmActionCard } from './components/shared/ConfirmActionCard.jsx';
import { useConfirmStore } from './stores/confirmStore.js';
import { useAuthStore } from './stores/authStore.js';
import { useNavigate } from 'react-router-dom';
import { useStripeCheckoutReturn } from './lib/useStripeCheckoutReturn.js';
import { useProCheckoutAbandonPrompt } from './lib/useProCheckoutAbandonPrompt.js';
import { ProCheckoutAbandonModal } from './components/plans/ProCheckoutAbandonModal.jsx';
import { CompanySelectorPage } from './pages/CompanySelectorPage.jsx';
import { LeftPanel } from './components/left/LeftPanel.jsx';
import { GinaCanvasFab } from './components/gina/GinaCanvasFab.jsx';
import { DocExpandedView } from './components/docs/DocExpandedView.jsx';
import { StepsRunnerOverlay } from './components/steps/StepsRunnerOverlay.jsx';
import { StepPlaybookDashboardOverlay } from './components/steps/StepPlaybookDashboardOverlay.jsx';
import { UrlTableDashboardOverlay } from './components/urltable/UrlTableDashboardOverlay.jsx';
import { PasswordTableDashboardOverlay } from './components/passwordtable/PasswordTableDashboardOverlay.jsx';
import { LazyTodoDashboardOverlay } from './components/lazyTodos/LazyTodoDashboardOverlay.jsx';
import {
  createBlankStepPlaybookSession,
  persistStepPlaybookSession,
  stepPlaybookSessionFromRef,
  stepPlaybookSessionHasContent,
} from './lib/stepPlaybookSession.js';
import { shareStepPlaybookAndCopy } from './lib/stepPlaybookShare.js';
import { flushPersistenceSync } from './stores/middleware/persistenceMiddleware.js';
import {
  loadCompanyUrlTableSession,
  loadUrlTableSessionById,
  createBlankUrlTableForObject,
  migrateLocalUrlEntriesToTables,
} from './lib/urlTableLibrary.js';
import {
  persistUrlTableSessionAndFlush,
  setUrlTableOpenCallback,
  setUrlTableQueueCallback,
  urlTableSessionFromRef,
} from './lib/urlTableSession.js';
import { createLinkEntry } from './lib/vaultBlocks.js';
import {
  persistPasswordTableSessionAndFlush,
  setPasswordTableQueueCallback,
} from './lib/passwordTableSession.js';
import { loadCompanyPasswordTableSession } from './lib/passwordTableLibrary.js';
import { StandaloneNodeModal } from './components/nodes/StandaloneNodeModal.jsx';
import { VideoReferencePanel } from './components/intel/VideoReferencePanel.jsx';
import { TimelineReminderCard } from './components/alerts/TimelineReminderCard.jsx';
import { resolveActiveTimelineReminder, inspectTimelineReminderState } from './lib/resolveTimelineAlert.js';
import {
  readSkippedTimelineReminderKeys,
  skipTimelineReminderKey,
  clearSkippedTimelineReminderKeys,
  reminderOccurrenceKey,
} from './lib/timelineReminderSkip.js';
import { unlockTimelineReminderSound } from './lib/timelineReminderSound.js';
import {
  collectDocNodeIdsForSave,
} from './lib/docNodeSync.js';
import {
  adoptOrphanNodeToDocument,
  releaseStaleNodeParentRefs,
} from './lib/nodeParentAdoption.js';
import { pruneStaleTimelineSnapshotChildren } from './lib/nodeSurfacePurge.js';
import { AdoptNodeConfirmModal } from './components/nodes/AdoptNodeConfirmModal.jsx';
import { useI18n, translate } from './i18n/useI18n.js';
import { buildMetaBarFromCanvas } from './lib/docMetaBar.js';
import {
  filterSelectableCanvasNodeIds,
  resolveParentDocIdForCanvasNode,
  resolveHeadlineBlockIdForCanvasNode,
} from './lib/timelineSelection.js';
import {
  buildLaunchDateCanvasNode,
  CANVAS_DOC_CHILD_OFFSET_X,
  collectCanvasNodeIdsForDoc,
  syncContentDocCanvasNodes,
} from './lib/canvasDocSync.js';
import { canSetCampaignTimelineSource } from './lib/campaignDocSource.js';
import { isFolderScheduleReserved } from './lib/folderScheduleReservation.js';
import { nextCompactPosition } from './lib/canvasMath.js';
import { clampNodePosition, getCanvasBoardBounds } from './lib/canvasBounds.js';
import { normalizeDoc } from './lib/normalizeDoc.js';
import { resolveCanvasNodeObjectId } from './lib/objectColors.js';
import { isTimelineDateCanvasNode } from './lib/campaignTimelineRail.js';
import { isContentDoc, isKnowledgeDoc, resolveLinkedProductCategories } from './lib/templateDoc.js';
import { AGENT_CAMPAIGN_ANALYST, getAgentCanvasTitle } from './lib/agents/registry.js';
import { executeAgentRun } from './lib/agents/executeAgentRun.js';
import { useScheduledAgentRunner } from './hooks/useScheduledAgentRunner.js';
import { useScheduledTasksStore } from './stores/scheduledTasksStore.js';
import { initialNodeShapeFromSlash } from './lib/docBlockSlash.js';
import { mergeVideoNodeContent } from './lib/videoEmbed.js';
import { parseWeatherForecastNodeContent } from './lib/forecastSearch.js';
import { parseCalendarEventNodeContent } from './lib/eventCalendarSearch.js';
import {
  appendIntelWidgetToNodeContent,
  buildCalendarEmbeddedFromPayload,
  buildForecastEmbeddedFromPayload,
  nodeContentAcceptsIntelWidget,
} from './lib/nodeIntelWidget.js';
import { parseNodeWritingBody } from './lib/nodeInlineContent.js';
import { NODE_DATA_TYPES } from './lib/nodeDataTypes.js';
import { ensureCompanyObject } from './lib/ensureCompanyObject.js';
import { supabase } from './lib/supabaseClient';
import {
  clearPendingLibrary,
  getBlankWorkspace,
  LAST_COMPANY_KEY,
  readLastCompany,
  resolveInitialAppState,
} from './lib/onboardingFlow.js';



function buildCanvasNodeFromEntity(zustandNode, x, y, overrides = {}) {
  return {
    id: shortId("CN"),
    noteId: zustandNode.id,
    title: (zustandNode.title || zustandNode.content || "NODE").toUpperCase().slice(0, 20),
    dataType: zustandNode.dataType || "text",
    content: zustandNode.content ?? "",
    x,
    y,
    ...overrides,
  };
}

/* app.jsx — root state + orchestration
 *
 * Three-tier model:
 *   notes[]       — source of truth for blueprint content (blueprintId on grouped notes)
 *   nodes[]       — optional canvas instances (noteId, x, y, hidden?)
 *   blueprints[]  — logical groups (noteIds, nodeIds, edges, label, color)
 *   connections[] — node→node edges on canvas
 *   Timeline reads notes + blueprint.edges; canvas delete does not remove timeline.
 */


const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "typography": "sans",
  "accent": "mint"
}/*EDITMODE-END*/;

function applyTheme(t, themeMode = t.theme) {
  if (themeMode === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  if (t.typography === "sans") {
    document.documentElement.style.setProperty("--font-body", '"Hanken Grotesk", system-ui, sans-serif');
    document.documentElement.style.setProperty("--font-display", '"Space Grotesk", system-ui, sans-serif');
  } else if (t.typography === "mono") {
    document.documentElement.style.setProperty("--font-body", "var(--mono)");
    document.documentElement.style.setProperty("--font-display", "var(--mono)");
  } else if (t.typography === "mixed") {
    document.documentElement.style.setProperty("--font-body", '"Hanken Grotesk", system-ui, sans-serif');
    document.documentElement.style.setProperty("--font-display", '"Space Grotesk", system-ui, sans-serif');
  }
  const accents = {
    mint:   { hud: "#8ee9a3", glow: "#8ee9a380", soft: "rgba(142, 233, 163, 0.12)" },
    cyan:   { hud: "#7be6e0", glow: "#7be6e080", soft: "rgba(123, 230, 224, 0.12)" },
    violet: { hud: "#c9b8ff", glow: "#c9b8ff80", soft: "rgba(201, 184, 255, 0.14)" },
    amber:  { hud: "#ffc56b", glow: "#ffc56b80", soft: "rgba(255, 197, 107, 0.14)" },
  };
  const a = accents[t.accent] || accents.mint;
  document.documentElement.style.setProperty("--hud", a.hud);
  document.documentElement.style.setProperty("--hud-glow", a.glow);
  document.documentElement.style.setProperty("--hud-soft", a.soft);
}

/* ── DASHBOARD ───────────────────────────────────────────── */
function Dashboard({ company, onBack }) {
  const [today, setToday]             = useState(() => getToday());
  const [toast, setToast]             = useState(null);
  const [timelineReminder, setTimelineReminder] = useState(null);
  const dismissedTimelineReminderKey = useRef(null);
  const [reminderTick, setReminderTick] = useState(0);
  const reminderEmptyHintShown = useRef(false);
  const canvasViewRef = useRef({ x: 320, y: 190, stage: { width: 960, height: 640 } });
  const [canvasRevealToken, setCanvasRevealToken] = useState(null);
  const [intel, setIntel]             = useState([]);
  const [hasScannedBlogs, setBlogs]   = useState(false);
  const [scanState, setScanState]     = useState("idle");
  const [scanLogs, setScanLogs]       = useState([]);
  const [canvasNodes, setCanvasNodes] = useState([]);
  const [canvasConns, setCanvasConns] = useState([]);
  const [selection, setSelection]     = useState([]);
  const [blueprints, setBlueprints]   = useState([]);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [activeStepPlaybook, setActiveStepPlaybook] = useState(null);
  const [activeStepPlaybookSession, setActiveStepPlaybookSession] = useState(null);
  const activeStepPlaybookSessionRef = useRef(null);
  const stepPlaybookSaveLockRef = useRef(false);
  const [stepPlaybookShareBusy, setStepPlaybookShareBusy] = useState(false);
  activeStepPlaybookSessionRef.current = activeStepPlaybookSession;
  const [activeUrlTableSession, setActiveUrlTableSession] = useState(null);
  const activeUrlTableSessionRef = useRef(null);
  const urlTableSaveLockRef = useRef(false);
  activeUrlTableSessionRef.current = activeUrlTableSession;

  const [activePasswordTableSession, setActivePasswordTableSession] = useState(null);
  const activePasswordTableSessionRef = useRef(null);
  const passwordTableSaveLockRef = useRef(false);
  activePasswordTableSessionRef.current = activePasswordTableSession;
  const [activeLazyTodo, setActiveLazyTodo] = useState(null);
  const [docViewGeneration, setDocViewGeneration] = useState(0);
  const [docOpenFocusBlockId, setDocOpenFocusBlockId] = useState(null);
  const docCloseInterceptorRef = useRef(null);
  const registerDocCloseInterceptor = useCallback((handler) => {
    docCloseInterceptorRef.current = handler;
  }, []);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [expandedNodeContentFocus, setExpandedNodeContentFocus] = useState(false);
  const [adoptPrompt, setAdoptPrompt] = useState(null);
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const locale = useLocaleStore((s) => s.locale);
  const [ginaDashboardOpen, setGinaDashboardOpen] = useState(false);
  const openGinaDashboardFromFab = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("gina:open-dashboard"));
    } catch { /* ignore */ }
  }, []);
  const docs = useDocsStore((s) => s.docs);
  const objects = useObjectsStore((s) => s.objects);
  const nodeEntities = useNodesStore((s) => s.nodes);
  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const objectWorkspaceActive = useUIStateStore((s) => s.objectWorkspaceActive);
  const clickFolderView = useUIStateStore((s) => s.clickFolderView);
  const heldObjectId = useObjectTargetHoldStore((s) => s.heldObjectId);
  const holdObjectTarget = useObjectTargetHoldStore((s) => s.hold);
  const releaseObjectTarget = useObjectTargetHoldStore((s) => s.release);
  const reconcileObjectHold = useObjectTargetHoldStore((s) => s.reconcile);
  // Import Object pin: Dashboard/Timeline stay on the held company while sidebar browses freely.
  const dashboardObjectId = resolveEffectiveDashboardObjectId(heldObjectId, filterObjectId);
  const dashboardSelectedObjectId = resolveEffectiveDashboardObjectId(
    heldObjectId,
    selectedObjectId || filterObjectId,
  );
  const heldObjectName = heldObjectId
    ? (objects[heldObjectId]?.name || objects[heldObjectId]?.title || "").trim() || "Company"
    : null;
  const activeDocMetaDraft = useUIStateStore((s) => s.activeDocMetaDraft);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);
  const timelineAlertsEnabled = useTimelineStore((s) => s.timelineAlertsEnabled);
  const timelineQueueMode = useTimelineStore((s) => s.timelineQueueMode);
  const toggleTimelineQueueMode = useTimelineStore((s) => s.toggleTimelineQueueMode);
  const enqueueTimelineDocsFromCanvasNodes = useTimelineStore((s) => s.enqueueTimelineDocsFromCanvasNodes);
  const timelineDocQueue = useTimelineStore((s) => s.timelineDocQueue);
  const timelineDateNodeIds = useTimelineStore((s) => s.timelineDateNodeIds);
  const timelineDocSnapshotsByDocId = useTimelineStore((s) => s.timelineDocSnapshotsByDocId);
  const timelineAgentSets = useTimelineStore((s) => s.timelineAgentSets);
  const knowledgeFolderActive = useUIStateStore((s) => s.knowledgeFolderActive);
  const timelineSheet = useUIStateStore((s) => s.timelineSheet);
  const timelines = useTimelineStore((s) => s.timelines);
  const prevTimelineAlertsEnabled = useRef(false);
  const planProfile = usePlanStore((s) => s.profile);
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);

  const metaBarMetadata = useMemo(() => {
    const showCompanyMeta = Boolean(heldObjectId || objectWorkspaceActive);
    if (!showCompanyMeta) {
      return {
        corpus: null,
        brand: null,
        product: null,
        campaign: null,
        subcategories: null,
        launch: null,
        window: null,
      };
    }
    return buildMetaBarFromCanvas({
      selection,
      canvasNodes,
      docs,
      objectsById: objects,
      selectedObjectId: dashboardSelectedObjectId,
      expandedDocId,
      activeDocMetaDraft,
      timelineDocQueue,
      nodeEntitiesById: nodeEntities,
      today,
    });
  }, [
    heldObjectId,
    objectWorkspaceActive,
    selection,
    canvasNodes,
    docs,
    objects,
    dashboardSelectedObjectId,
    expandedDocId,
    activeDocMetaDraft,
    timelineDocQueue,
    nodeEntities,
    today,
  ]);

  const handleTimelineCanvasSelect = useCallback(
    (canvasNodeId) => {
      const node = canvasNodes.find((n) => n.id === canvasNodeId);
      if (!node) return true;
      const docId = resolveParentDocIdForCanvasNode(node, nodeEntities, docs);
      if (isKnowledgeDoc(docId ? docs[docId] : null)) return true;
      if (!timelineQueueMode) return true;
      // Date/launch already pinned: block re-pick. Folder docs already queued stay
      // markable so host+guest batches work when the host is already on the rail.
      if (isTimelineDateCanvasNode(node) && timelineDateNodeIds.includes(node.id)) {
        setToast({
          message: "Date is already on the timeline",
          kind: "warm",
        });
        return false;
      }
      return true;
    },
    [
      timelineQueueMode,
      canvasNodes,
      nodeEntities,
      docs,
      timelineDateNodeIds,
    ],
  );

  const handleToggleTimelineQueueMode = useCallback(() => {
    const turningOn = !useTimelineStore.getState().timelineQueueMode;
    // Clear synchronously before mode flips so the next card click always marks.
    if (turningOn) setSelection([]);
    toggleTimelineQueueMode();
  }, [toggleTimelineQueueMode]);

  const handleInsertToTimeline = useCallback(() => {
    if (!selection.length) return;
    const result = enqueueTimelineDocsFromCanvasNodes(
      selection,
      canvasNodes,
      nodeEntities,
      docs,
      canvasConns,
      objects,
    );
    if (!result?.ok) {
      setToast({
        message: result?.message || "Insert to timeline failed.",
        kind: "warm",
      });
      return;
    }

    const parts = [];
    if (result.added > 0) {
      parts.push(`${result.added} doc${result.added === 1 ? "" : "s"}`);
    }
    if (result.setsAdded > 0) {
      parts.push(`${result.setsAdded} set${result.setsAdded === 1 ? "" : "s"}`);
    }
    if (result.datesAdded > 0) {
      parts.push(`${result.datesAdded} date${result.datesAdded === 1 ? "" : "s"}`);
    }
    setToast({
      message: parts.length
        ? `Added ${parts.join(" · ")} to timeline`
        : result.refreshed
          ? "Timeline snapshot refreshed"
          : "Timeline updated",
      kind: "ok",
    });

    // Insert is a one-shot action: leave Select mode and drop the numbered
    // picks so the green active area turns off until the user re-enables it.
    useTimelineStore.getState().setTimelineQueueMode(false);
    setSelection([]);
  }, [selection, canvasNodes, nodeEntities, docs, canvasConns, objects, enqueueTimelineDocsFromCanvasNodes]);

  const handleTimelineCanvasSelectMany = useCallback(
    (canvasNodeIds) => {
      if (!timelineQueueMode || !canvasNodeIds?.length) return;
      for (const canvasId of canvasNodeIds) {
        handleTimelineCanvasSelect(canvasId);
      }
    },
    [timelineQueueMode, handleTimelineCanvasSelect],
  );

  // Import Object: pin current company as Dashboard/Timeline target (indefinite toggle).
  const handleToggleObjectHold = useCallback(() => {
    if (heldObjectId) {
      // Stay on the button company (pin). Sync filter/selection so after release
      // dashboardObjectId does not fall through to sidebar browse (e.g. Home Depot).
      const stayOn = heldObjectId;
      releaseObjectTarget();
      useUIStateStore.getState().setFilterObjectId(stayOn);
      useUIStateStore.getState().setSelectedObjectId(stayOn);
      setCorpusTimelineAuthority(stayOn);
      return;
    }
    const target = filterObjectId || selectedObjectId || null;
    if (!target) {
      setToast({
        message: t("canvas.importObjectNeedCompany"),
        kind: "warm",
      });
      return;
    }
    holdObjectTarget(target);
    setCorpusTimelineAuthority(target);
  }, [
    heldObjectId,
    filterObjectId,
    selectedObjectId,
    holdObjectTarget,
    releaseObjectTarget,
    t,
  ]);

  useEffect(() => {
    const pinned = useObjectTargetHoldStore.getState().heldObjectId;
    reconcileObjectHold(objects);
    // Pinned company deleted → release hold and point authority at current browse target.
    if (pinned && !objects[pinned]) {
      setCorpusTimelineAuthority(filterObjectId || selectedObjectId || null);
    }
  }, [objects, reconcileObjectHold, filterObjectId, selectedObjectId]);


  //modified 


useEffect(() => {
  supabase.from('companies').select('*').limit(1).then(({ data, error }) => {
    if (error) console.error('SUPABASE ERROR:', error.message);
    else console.log('SUPABASE OK desde browser:', data);
  });
}, []);
///////




  const prevTimelineQueueMode = useRef(timelineQueueMode);
  useEffect(() => {
    const wasQueue = prevTimelineQueueMode.current;
    prevTimelineQueueMode.current = timelineQueueMode;
    // Leaving Select: collapse multi-picks back to a single free selection.
    // (Enter clears synchronously in handleToggleTimelineQueueMode.)
    if (!wasQueue || timelineQueueMode) return;
    setSelection((sel) => {
      const filtered = filterSelectableCanvasNodeIds(sel, canvasNodes, nodeEntities, docs);
      if (filtered.length <= 1) return filtered;
      return [filtered[filtered.length - 1]];
    });
  }, [timelineQueueMode, canvasNodes, nodeEntities, docs]);

  useEffect(() => { initStores(); }, []);

  useEffect(() => {
    const tick = setInterval(() => setToday(getToday()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!timelineAlertsEnabled) return undefined;
    const id = window.setInterval(() => setReminderTick((n) => n + 1), 3_000);
    return () => window.clearInterval(id);
  }, [timelineAlertsEnabled]);

  useEffect(() => {
    if (timelineAlertsEnabled && !prevTimelineAlertsEnabled.current) {
      dismissedTimelineReminderKey.current = null;
      clearSkippedTimelineReminderKeys();
      unlockTimelineReminderSound();
      reminderEmptyHintShown.current = false;
    }
    prevTimelineAlertsEnabled.current = timelineAlertsEnabled;

    if (!timelineAlertsEnabled) {
      setTimelineReminder(null);
      reminderEmptyHintShown.current = false;
      return;
    }

    const resolveParams = {
      docs,
      objects,
      objectTimelineTitles,
      selectedObjectId: dashboardSelectedObjectId,
      primaryObjectId: useTimelineStore.getState().primaryTimelineObjectId || dashboardObjectId,
      inheritObjMode: useTimelineStore.getState().inheritObjMode,
      canvasNodes,
      canvasConnections: canvasConns,
      nodeEntities,
      timelineDocQueue,
      timelineDocSnapshotsByDocId,
      timelineAgentSets,
      timelineDateNodeIds,
      skippedAlertKeys: readSkippedTimelineReminderKeys(),
    };

    const reminder = resolveActiveTimelineReminder(resolveParams);
    const inspect = inspectTimelineReminderState(resolveParams);


    if (!reminder) {
      setTimelineReminder(null);
      if (!reminderEmptyHintShown.current) {
        reminderEmptyHintShown.current = true;
        const next = inspect?.upcoming?.[0];
        if (next && Number.isFinite(next.mins)) {
          setToast({
            message: t("timeline.reminder.noneInWindow", {
              name: next.label || "task",
              count: next.mins,
            }),
            kind: "dim",
          });
        } else {
          setToast({
            message: t("timeline.reminder.noneScheduled"),
            kind: "dim",
          });
        }
      }
      return;
    }

    const occurrence = reminderOccurrenceKey(reminder.alertKey, reminder.startAtMs);
    if (dismissedTimelineReminderKey.current === occurrence) return;

    setTimelineReminder(reminder);
  }, [
    timelineAlertsEnabled,
    docs,
    objects,
    objectTimelineTitles,
    dashboardSelectedObjectId,
    dashboardObjectId,
    canvasNodes,
    canvasConns,
    nodeEntities,
    today,
    reminderTick,
    timelineDocQueue,
    timelineDocSnapshotsByDocId,
    timelineAgentSets,
    timelineDateNodeIds,
  ]);

  useEffect(() => {
    useUIStateStore.getState().setCanvasSearchSnapshot({
      nodes: canvasNodes,
      connections: canvasConns,
    });
  }, [canvasNodes, canvasConns]);

  useEffect(() => {
    setCanvasNodes((prev) => syncContentDocCanvasNodes(prev, docs, {
      expandedDocId,
      activeDocMetaDraft,
      nodeEntitiesById: nodeEntities,
    }));
  }, [docs, nodeEntities, expandedDocId, activeDocMetaDraft]);

  // Keep [campaign doc] —— [launch date] wired when sync spawns a Launch child.
  useEffect(() => {
    setCanvasConns((cs) => {
      let next = null;
      for (const node of canvasNodes) {
        if (!node?.noteId) continue;
        const entity = nodeEntities[node.noteId];
        if (!entity?.parentDocId || !entity.launchAt) continue;
        const folder = docs[entity.parentDocId];
        if (!folder?.campaignActive) continue;
        const launchId = `CN-launch-node-${entity.id}`;
        if (!canvasNodes.some((n) => n.id === launchId)) continue;
        const linked = (next || cs).some((c) => (
          (c.from === node.id && c.to === launchId)
          || (c.from === launchId && c.to === node.id)
        ));
        if (linked) continue;
        if (!next) next = [...cs];
        next.push({ id: shortId("CN"), from: node.id, to: launchId });
      }
      return next || cs;
    });
  }, [canvasNodes, nodeEntities, docs]);

  useEffect(() => {
    const releasedNodeIds = releaseStaleNodeParentRefs(docs);
    if (!releasedNodeIds.length) return;
    const releasedSet = new Set(releasedNodeIds);
    setCanvasNodes((prev) => prev.map((cn) => {
      const staleCanvasParent = cn.parentDocId && !docs[cn.parentDocId];
      const staleEntityParent = cn.noteId && releasedSet.has(cn.noteId);
      if (!staleCanvasParent && !staleEntityParent) return cn;
      return { ...cn, parentDocId: null };
    }));
  }, [docs]);

  // Drop snapshot children for entities no longer in the folder (left-panel deleted /
  // parentDocId wiped) so the rail cannot resurrect them.
  useEffect(() => {
    pruneStaleTimelineSnapshotChildren(docs, nodeEntities);
  }, [docs, nodeEntities]);

  useEffect(() => {
    const updateNode = useNodesStore.getState().updateNode;
    const nodesById = useNodesStore.getState().nodes;

    for (const cn of canvasNodes) {
      if (!cn?.noteId) continue;
      const entity = nodesById[cn.noteId];
      if (!entity || entity.parentDocId || entity.objectId) continue;
      const objectId = resolveCanvasNodeObjectId(cn, docs, nodesById);
      if (objectId) updateNode(entity.id, { objectId });
    }
  }, [canvasNodes, docs, objects, nodeEntities]);

  /* ── SCAN BLOGS ─ */
  const scanBlogs = () => {
    setScanState("scanning-blogs");
    setScanLogs([]);
    const steps = [
      { t: 100,  text: "Querying news APIs…",         cls: "dim" },
      { t: 350,  text: "  └ Electrek · 200 OK",       cls: "ok" },
      { t: 550,  text: "  └ InsideEVs · 200 OK",      cls: "ok" },
      { t: 750,  text: "  └ AutoForge · 200 OK",      cls: "ok" },
      { t: 1000, text: "Filtering mentions…",         cls: "dim" },
      { t: 1300, text: "  └ 8 signals retained",      cls: "warm" },
      { t: 1550, text: "Confidence scoring…",         cls: "dim" },
      { t: 1850, text: "✓ Stream live · 8 signals",   cls: "ok" },
    ];
    steps.forEach((s) => setTimeout(() => setScanLogs((prev) => [...prev, s]), s.t));
    setTimeout(() => {
      setIntel(INTEL);
      setBlogs(true);
      setScanState("idle");
      setToast({ message: `${INTEL.length} signals streaming`, kind: "ok" });
    }, 2000);
  };

  const nextCanvasPosition = (preferredX, preferredY, extraOccupied = []) => {
    const board = getCanvasBoardBounds(canvasNodes, canvasViewRef.current.stage);
    let pos;
    if (preferredX != null && preferredY != null) {
      const occupied = [
        ...canvasNodes.filter((n) => !n.hidden).map((n) => ({ x: n.x, y: n.y })),
        ...extraOccupied,
      ];
      let x = preferredX;
      let y = preferredY;
      let guard = 0;
      while (occupied.some((p) => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60) && guard < 80) {
        x += 40;
        if (x > board.maxX - 200) { x = board.minX + 30; y += 110; }
        guard += 1;
      }
      pos = { x, y };
    } else {
      pos = nextCompactPosition(canvasNodes, extraOccupied);
    }
    return clampNodePosition(pos.x, pos.y, { w: 180, h: 72 }, board);
  };

  const viewportInsertOrigin = () => {
    const center = canvasViewRef.current;
    return {
      x: (Number(center.x) || 320) - 90,
      y: (Number(center.y) || 190) - 36,
    };
  };

  /* ── INSERT ZUSTAND NODE → canvas ─ */
  const insertNodeToCanvas = (zustandNode, options = null) => {
    if (!zustandNode?.id) return;
    const already = canvasNodes.find((n) => n.noteId === zustandNode.id);
    if (already) {
      setCanvasRevealToken({ nodeId: already.id, nonce: Date.now() });
      setToast({ message: `Already on canvas · "${zustandNode.title || "node"}"`, kind: "ok" });
      return;
    }
    const origin = viewportInsertOrigin();
    const preferredX = options?.x != null ? options.x : origin.x;
    const preferredY = options?.y != null ? options.y : origin.y;
    const { x, y } = nextCanvasPosition(preferredX, preferredY);

    // Campaign document → spawn Launch date type beside it and wire the connection.
    const parentDoc = zustandNode.parentDocId
      ? useDocsStore.getState().docs[zustandNode.parentDocId]
      : null;

    // No folder Schedule reservation → strip phantom date/time (never invent from Created).
    // Exception: status reserved keeps a free-scope schedule without a folder window.
    let entityForCanvas = zustandNode;
    const statusReserved = String(zustandNode.status || "").trim().toLowerCase() === "reserved";
    if (
      zustandNode.anchorAt
      && parentDoc
      && !parentDoc.campaignActive
      && !isFolderScheduleReserved(parentDoc)
      && !statusReserved
    ) {
      useNodesStore.getState().updateNode(zustandNode.id, {
        anchorAt: null,
        anchorFinishAt: null,
      });
      entityForCanvas = { ...zustandNode, anchorAt: null, anchorFinishAt: null };
    }

    const newNode = buildCanvasNodeFromEntity(entityForCanvas, x, y);
    const launchAt = entityForCanvas.launchAt || null;
    if (parentDoc?.campaignActive && launchAt) {
      const launchNode = buildLaunchDateCanvasNode(launchAt, zustandNode.parentDocId, {
        id: `CN-launch-node-${zustandNode.id}`,
        sourceNodeId: zustandNode.id,
      });
      if (launchNode) {
        const placedLaunch = {
          ...launchNode,
          x: x + CANVAS_DOC_CHILD_OFFSET_X,
          y,
        };
        setCanvasNodes((all) => {
          if (all.some((n) => n.id === placedLaunch.id)) {
            return all.some((n) => n.noteId === zustandNode.id) ? all : [...all, newNode];
          }
          return [...all, newNode, placedLaunch];
        });
        setCanvasConns((cs) => {
          if (cs.some((c) => (
            (c.from === newNode.id && c.to === placedLaunch.id)
            || (c.from === placedLaunch.id && c.to === newNode.id)
          ))) {
            return cs;
          }
          return [...cs, { id: shortId("CN"), from: newNode.id, to: placedLaunch.id }];
        });
        if (canSetCampaignTimelineSource(parentDoc, zustandNode)) {
          useDocsStore.getState().updateDoc(parentDoc.id, {
            timelineSourceNodeId: zustandNode.id,
          });
        }
        setToast({
          message: `Campaign + Launch · "${newNode.title}"`,
          kind: "ok",
        });
        return;
      }
    }

    setCanvasNodes((all) => [...all, newNode]);
    setToast({ message: `Node added · "${newNode.title}"`, kind: "ok" });
  };

  const createNodeFromSlashAndInsert = useCallback((alias, embedPrefill = null) => {
    const shape = initialNodeShapeFromSlash(alias);
    if (!shape) return;
    let content = shape.content;
    if (embedPrefill?.embedSrc && shape.dataType === NODE_DATA_TYPES.VIDEO) {
      content = mergeVideoNodeContent(content, embedPrefill);
    }
    const title = (shape.defaultTitle || "Untitled query").trim();
    const nodeId = useNodesStore.getState().addNode(title, shape.dataType, content, null, {
      sourceQuery: title,
    });
    const entity = useNodesStore.getState().getNode(nodeId);
    if (!entity) return;
    insertNodeToCanvas(entity, { center: true });
    setToast({ message: `Node added · "${title}"`, kind: "ok" });
  }, [insertNodeToCanvas]);

  const handleInsertForecastNode = ({ title, payload, sourceNode, anchorAt }) => {
    const parentDocId = sourceNode?.parentDocId || null;
    const addNode = useNodesStore.getState().addNode;
    const nodeId = addNode(
      title,
      "text",
      JSON.stringify(payload),
      parentDocId,
      {
        anchorAt: anchorAt || null,
        sourceQuery: title,
      },
    );
    if (parentDocId) {
      useNodesStore.getState().syncNodeToParentDoc(nodeId, parentDocId);
      if (expandedDocId === parentDocId) {
        setDocViewGeneration((n) => n + 1);
      }
    }
    const created = useNodesStore.getState().getNode(nodeId);
    if (created) insertNodeToCanvas(created, { center: true });
  };

  /* Connect a macronode with a forecast/calendar node on canvas → paste the widget
     into the macronode body (writing tail stays editable below the widget). */
  const handleCanvasConnectionCreated = (fromId, toId) => {
    const nodesById = useNodesStore.getState().nodes;
    const endpoints = [fromId, toId]
      .map((id) => canvasNodes.find((n) => n.id === id))
      .filter(Boolean);
    if (endpoints.length !== 2) return;

    const resolveEntity = (cn) => (cn?.noteId ? nodesById[cn.noteId] : null);
    const resolveWidget = (cn) => {
      const content = resolveEntity(cn)?.content ?? cn?.content;
      const forecast = parseWeatherForecastNodeContent(content);
      if (forecast) return { kind: "weather-forecast", payload: forecast, end: cn };
      const calendar = parseCalendarEventNodeContent(content);
      if (calendar) return { kind: "calendar-event", payload: calendar, end: cn };
      return null;
    };

    const widget = endpoints.map(resolveWidget).find(Boolean);
    if (!widget) return;

    const targetEnd = endpoints.find((cn) => cn !== widget.end);
    const targetEntity = resolveEntity(targetEnd);
    if (!targetEntity) return;
    if (["document", "object", "agent"].includes(targetEnd.canvasKind)) return;
    // Only macronodes (text writing bodies) — date/metric content has its own semantics.
    if (targetEntity.dataType && targetEntity.dataType !== "text") return;
    if (parseWeatherForecastNodeContent(targetEntity.content)) return;
    if (parseCalendarEventNodeContent(targetEntity.content)) return;
    if (!nodeContentAcceptsIntelWidget(targetEntity.content)) return;

    const { payload, kind: widgetKind } = widget;

    // Dedupe: same widget instance already pasted into this macronode.
    const { blocks } = parseNodeWritingBody(targetEntity.content);
    const alreadyEmbedded = widgetKind === "weather-forecast"
      ? blocks.some((block) => (
        block?.embedded?.kind === "weather-forecast"
        && block.embedded.payload?.fetchedAt === payload.fetchedAt
        && block.embedded.payload?.uiDate === payload.uiDate
      ))
      : blocks.some((block) => (
        block?.embedded?.kind === "calendar-event"
        && block.embedded.eventId === payload.eventId
        && block.embedded.uiDate === payload.uiDate
      ));
    if (alreadyEmbedded) return;

    const embedded = widgetKind === "weather-forecast"
      ? buildForecastEmbeddedFromPayload(payload)
      : buildCalendarEmbeddedFromPayload(payload);
    if (!embedded) return;
    const result = appendIntelWidgetToNodeContent(targetEntity.content, embedded);
    if (!result) return;

    useNodesStore.getState().updateNode(targetEntity.id, { content: result.content });
    const parentDocId = targetEntity.parentDocId || null;
    if (parentDocId) {
      useNodesStore.getState().syncNodeToParentDoc(targetEntity.id, parentDocId);
      if (expandedDocId === parentDocId) {
        setDocViewGeneration((n) => n + 1);
      }
    }
    setToast({
      message: widgetKind === "weather-forecast"
        ? `Forecast pasted into "${targetEntity.title || targetEnd.title || "node"}"`
        : `Calendar event pasted into "${targetEntity.title || targetEnd.title || "node"}"`,
      kind: "ok",
    });
  };

  const handleInsertEventNode = ({ title, payload, sourceNode, anchorAt }) => {
    const parentDocId = sourceNode?.parentDocId || null;
    const addNode = useNodesStore.getState().addNode;
    const nodeId = addNode(
      title,
      "text",
      JSON.stringify(payload),
      parentDocId,
      {
        anchorAt: anchorAt || null,
        sourceQuery: title,
      },
    );
    if (parentDocId) {
      useNodesStore.getState().syncNodeToParentDoc(nodeId, parentDocId);
      if (expandedDocId === parentDocId) {
        setDocViewGeneration((n) => n + 1);
      }
    }
    const created = useNodesStore.getState().getNode(nodeId);
    if (created) insertNodeToCanvas(created, { center: true });
  };

  const insertAgentToCanvas = (agentId, options = null) => {
    if (!agentId) return;
    const origin = viewportInsertOrigin();
    const preferredX = options?.x != null ? options.x : origin.x;
    const preferredY = options?.y != null ? options.y : origin.y;
    const { x, y } = nextCanvasPosition(preferredX, preferredY);
    const newNode = {
      id: shortId("CN"),
      canvasKind: "agent",
      agentId,
      title: getAgentCanvasTitle(agentId),
      dataType: "agent",
      content: "",
      agentStatus: "idle",
      agentError: "",
      x,
      y,
    };
    setCanvasNodes((all) => [...all, newNode]);
    setSelection([newNode.id]);
    setToast({ message: `Agent placed · "${newNode.title}"`, kind: "ok" });
  };

  const handleInsertAgent = useCallback((agentId) => {
    insertAgentToCanvas(agentId, { center: true });
  }, [canvasNodes]);

  const insertObjectToCanvas = (object, worldX, worldY) => {
    const { x, y } = nextCanvasPosition(
      worldX != null ? worldX - 50 : undefined,
      worldY != null ? worldY - 40 : undefined,
    );
    const newNode = {
      id: shortId("CN"),
      canvasKind: "object",
      objectId: object.id,
      noteId: object.id,
      title: (object.name || "OBJECT").toUpperCase().slice(0, 20),
      dataType: "object",
      content: "",
      x, y,
    };
    setCanvasNodes((all) => [...all, newNode]);
    setToast({ message: `Object placed · "${object.name}"`, kind: "ok" });
  };

  const insertDocToCanvas = (doc, worldX, worldY) => {
    const normalizedDoc = normalizeDoc(
      useDocsStore.getState().docs[doc.id] || doc,
    );

    const alreadyOnCanvas = canvasNodes.find(
      (n) => n.canvasKind === "document"
        && (n.docId === normalizedDoc.id || n.noteId === normalizedDoc.id),
    );
    if (alreadyOnCanvas) {
      setCanvasRevealToken({ nodeId: alreadyOnCanvas.id, nonce: Date.now() });
      setToast({
        message: `Already on canvas · "${normalizedDoc.title || "folder"}"`,
        kind: "ok",
      });
      return null;
    }

    const { x, y } = nextCanvasPosition(
      worldX != null ? worldX - 50 : undefined,
      worldY != null ? worldY - 40 : undefined,
    );
    const docCanvasNode = buildCanvasNodeFromEntity(normalizedDoc, x, y, {
      canvasKind: "document",
      docId: normalizedDoc.id,
      noteId: normalizedDoc.id,
      title: (normalizedDoc.title || "DOCUMENT").toUpperCase().slice(0, 20),
      dataType: "document",
      content: normalizedDoc.body || normalizedDoc.content || "",
      ...(isKnowledgeDoc(normalizedDoc) ? { corpusKind: "knowledge" } : {}),
      ...(isContentDoc(normalizedDoc) && !isKnowledgeDoc(normalizedDoc)
        ? {
            linkedProductCategories: resolveLinkedProductCategories(
              useDocsStore.getState().docs,
              normalizedDoc.subcategoryDocIds,
            ),
            contentCategory: normalizedDoc.category?.trim() || "",
            launchAt: normalizedDoc.launchAt ?? null,
            scheduleStartAt: normalizedDoc.scheduleStartAt ?? null,
            scheduleFinishAt: normalizedDoc.scheduleFinishAt
              ?? normalizedDoc.scheduleStartAt
              ?? null,
            campaignActive: Boolean(normalizedDoc.campaignActive),
          }
        : {}),
    });

    // Sync folder card meta only — Campaign Launch dates spawn when a child
    // document is inserted, not when the folder alone is dropped.
    setCanvasNodes((all) => syncContentDocCanvasNodes(
      [...all, docCanvasNode],
      useDocsStore.getState().docs,
      {
        expandedDocId,
        activeDocMetaDraft,
        nodeEntitiesById: useNodesStore.getState().nodes,
      },
    ));
    setSelection([docCanvasNode.id]);
    setToast({
      message: `Document placed · "${normalizedDoc.title}"`,
      kind: "ok",
    });
    return docCanvasNode.id;
  };

  const handleCanvasDrop = (payload, world) => {
    if (payload?.kind === "object" && payload.objectId) {
      const object = useObjectsStore.getState().objects[payload.objectId];
      if (!object) return;
      insertObjectToCanvas(object, world.x, world.y);
      return;
    }
    if (payload?.kind === "document" && payload.docId) {
      const doc = docs[payload.docId];
      if (!doc) return;
      insertDocToCanvas(doc, world.x, world.y);
      return;
    }
    if (payload?.kind === "agent" && payload.agentId) {
      insertAgentToCanvas(payload.agentId, { x: world.x, y: world.y });
    }
  };

  /* ── DELETE CANVAS NODE ─ */
  const pruneCanvasRefs = (idsToRemove) => {
    setCanvasConns((cs) => cs.filter(
      (c) => !idsToRemove.has(c.from) && !idsToRemove.has(c.to),
    ));
    setBlueprints((bps) => bps.map((bp) => ({
      ...bp,
      nodeIds: (bp.nodeIds || []).filter((id) => !idsToRemove.has(id)),
    })));
    setSelection((sel) => sel.filter((id) => !idsToRemove.has(id)));
  };

  const removeCanvasNodesForDoc = (docId) => {
    const nodeEntities = useNodesStore.getState().nodes;
    let idsToRemove = null;
    setCanvasNodes((all) => {
      idsToRemove = collectCanvasNodeIdsForDoc(all, docId, nodeEntities);
      if (!idsToRemove.size) return all;
      return all.filter((n) => !idsToRemove.has(n.id));
    });
    if (idsToRemove?.size) {
      pruneCanvasRefs(idsToRemove);
    }
  };

  const handleAfterDocSave = useCallback((docId, blocks) => {
    if (!docId) return;
    const nodesById = useNodesStore.getState().nodes;
    // Keep panel members even without body layers (unlink ≠ hard-delete).
    const nodeIds = collectDocNodeIdsForSave(docId, blocks, nodesById);
    useDocsStore.getState().updateDoc(docId, { nodeIds });

    // Apply saved Launch/Schedule onto the timeline rail when this doc is queued.
    useTimelineStore.getState().refreshTimelineDocSnapshot(docId, {
      canvasNodes,
      connections: canvasConns,
      docsById: useDocsStore.getState().docs,
      nodeEntitiesById: nodesById,
    });
  }, [canvasNodes, canvasConns]);

  const clearAllCanvasElements = useCallback(() => {
    setCanvasNodes([]);
    setCanvasConns([]);
    setBlueprints([]);
    setSelection([]);
    setToast({ message: t("canvas.clearSuccess"), kind: "ok" });
  }, [t]);

  const handleEditCanvasNode = useCallback((canvasNodeId, edits) => {
    setCanvasNodes((all) => {
      const target = all.find((n) => n.id === canvasNodeId);
      const nextEdits = { ...edits };
      if (edits.title != null) {
        nextEdits.title = String(edits.title).trim() || "Untitled query";
      }
      if (target?.noteId && nextEdits.title != null) {
        const nodesApi = useNodesStore.getState();
        nodesApi.updateNode(target.noteId, {
          title: nextEdits.title,
          sourceQuery: nextEdits.title,
        });
        // Keep linked H1 / parent folder listing in sync with the colored macronode title.
        const entity = nodesApi.getNode(target.noteId);
        const parentDocId = entity?.parentDocId || null;
        if (parentDocId) {
          nodesApi.syncNodeToParentDoc(target.noteId, parentDocId);
        }
      }
      return all.map((n) => (n.id === canvasNodeId ? { ...n, ...nextEdits } : n));
    });
  }, []);

  const deleteCanvasNode = (nodeId) => {
    const nodeEntities = useNodesStore.getState().nodes;
    let idsToRemove = null;
    let removedDoc = false;

    setCanvasNodes((all) => {
      const target = all.find((n) => n.id === nodeId);
      if (!target) return all;

      const docId = target.canvasKind === "document"
        ? (target.docId || target.noteId)
        : null;
      removedDoc = Boolean(docId);
      idsToRemove = docId
        ? collectCanvasNodeIdsForDoc(all, docId, nodeEntities)
        : new Set([nodeId]);
      if (!idsToRemove.has(nodeId)) idsToRemove.add(nodeId);

      return all.filter((n) => !idsToRemove.has(n.id));
    });

    if (!idsToRemove?.size) return;

    pruneCanvasRefs(idsToRemove);

    const toastMessage = removedDoc
      ? "Document removed from canvas"
      : "Removed from canvas";
    setToast({ message: toastMessage, kind: "ok" });
  };

  const handleDocumentDeleted = (docId) => {
    removeCanvasNodesForDoc(docId);
    if (expandedDocId === docId) setExpandedDocId(null);
  };

  const openDocumentOverlay = (docId, options = {}) => {
    if (!docId || !docs[docId]) return;
    const openTarget = () => {
      setExpandedDocId(docId);
      setDocOpenFocusBlockId(options.focusBlockId ?? null);
    };
    if (expandedDocId && expandedDocId !== docId && docCloseInterceptorRef.current) {
      docCloseInterceptorRef.current(openTarget);
      return;
    }
    openTarget();
  };

  const closeExpandedDocForExternalAction = (onProceed) => {
    if (expandedDocId && docCloseInterceptorRef.current) {
      docCloseInterceptorRef.current(onProceed);
      return;
    }
    setExpandedDocId(null);
    setDocOpenFocusBlockId(null);
    onProceed?.();
  };

  const handleRunStepPlaybook = (playbook) => {
    if (!playbook?.steps?.length) return;
    setActiveStepPlaybook({
      ...playbook,
      steps: playbook.steps.map((step) => ({ ...step })),
    });
  };

  const handleOpenStepPlaybook = useCallback((playbook) => {
    if (!playbook) return;
    setActiveStepPlaybookSession(stepPlaybookSessionFromRef(playbook));
  }, []);

  const addDoc = useDocsStore((s) => s.addDoc);
  const updateDoc = useDocsStore((s) => s.updateDoc);

  const handleOpenNewStepPlaybook = useCallback((objectId) => {
    if (!objectId) return;
    setActiveStepPlaybookSession(createBlankStepPlaybookSession(objectId));
  }, []);

  const handleStepPlaybookSessionChange = useCallback((patch) => {
    setActiveStepPlaybookSession((current) => {
      if (!current) return current;
      return { ...current, ...patch };
    });
  }, []);

  const handleStepPlaybookSessionClose = useCallback(async () => {
    const current = activeStepPlaybookSessionRef.current;
    if (!current) return;
    if (!current.saved && stepPlaybookSessionHasContent(current)) {
      const confirmed = await askConfirm({
        title: t('stepsLibrary.discardDraftTitle'),
        message: t('stepsLibrary.discardDraftConfirm'),
        confirmLabel: t('stepsLibrary.discardDraftAction'),
        cancelLabel: t('common.cancel'),
      });
      if (!confirmed) return;
    }
    setActiveStepPlaybookSession(null);
  }, [askConfirm, t]);

  const handleStepPlaybookShare = useCallback(async () => {
    const current = activeStepPlaybookSessionRef.current;
    if (!current) return;
    if (!current.saved || !current.docId) {
      setToast({ message: t('stepsLibrary.shareSaveFirst'), kind: 'warm' });
      return;
    }
    const user = useAuthStore.getState().user;
    if (!user?.id) {
      setToast({ message: t('stepsLibrary.shareSignIn'), kind: 'warm' });
      return;
    }
    if (stepPlaybookShareBusy) return;
    setStepPlaybookShareBusy(true);
    try {
      const result = await shareStepPlaybookAndCopy({ session: current, user });
      setToast({
        message: result.copied
          ? t('stepsLibrary.shareCopied')
          : result.url,
        kind: 'ok',
      });
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg === 'SAVE_FIRST') {
        setToast({ message: t('stepsLibrary.shareSaveFirst'), kind: 'warm' });
      } else {
        setToast({
          message: msg.includes('step_playbook_shares')
            ? msg
            : t('stepsLibrary.shareError'),
          kind: 'warm',
        });
      }
    } finally {
      setStepPlaybookShareBusy(false);
    }
  }, [stepPlaybookShareBusy, t]);

  const handleStepPlaybookSessionSaved = useCallback((finalizedSteps) => {
    if (stepPlaybookSaveLockRef.current) return;
    const current = activeStepPlaybookSessionRef.current;
    if (!current) return;

    const merged = { ...current, steps: finalizedSteps, saved: true };
    if (!stepPlaybookSessionHasContent(merged)) {
      console.warn('[steps] Save skipped: empty playbook');
      return;
    }
    if (!merged.objectId) {
      console.warn('[steps] Save skipped: missing company objectId');
      return;
    }

    stepPlaybookSaveLockRef.current = true;
    try {
      const result = persistStepPlaybookSession(merged, {
        addDoc,
        updateDoc,
        docs: useDocsStore.getState().docs,
        objects: useObjectsStore.getState().objects,
        defaultTitle: t('stepsLibrary.newDocTitle'),
      });
      if (!result?.docId) {
        console.warn('[steps] Save did not write a document', result);
        return;
      }
      flushPersistenceSync().catch((err) => {
        console.warn('[steps] flush after save failed', err);
      });
      // Keep the dashboard open in saved mode so the user can verify content.
      setActiveStepPlaybookSession({
        ...merged,
        docId: result.docId,
        blockId: result.blockId || merged.blockId,
        saved: true,
      });
    } finally {
      stepPlaybookSaveLockRef.current = false;
    }
  }, [addDoc, t, updateDoc]);

  const handleStepPlaybookRemoved = useCallback(({ docId, blockId }) => {
    setActiveStepPlaybook((current) => {
      if (!current) return null;
      if (current.docId === docId && current.blockId === blockId) return null;
      return current;
    });
  }, []);

  const handleUrlTablesDeleted = useCallback((ids) => {
    const deleted = new Set((ids || []).filter(Boolean));
    if (!deleted.size) return;
    setActiveUrlTableSession((current) => {
      if (!current) return null;
      const currentId = current.tableId || current.id;
      if (currentId && deleted.has(currentId)) return null;
      return current;
    });
  }, []);

  const handleOpenUrlTableForCompany = useCallback((objectId) => {
    if (!objectId) return;
    migrateLocalUrlEntriesToTables();
    setActiveUrlTableSession(loadCompanyUrlTableSession(objectId, t('urlTableLibrary.newDocTitle')));
  }, [t]);

  const handleOpenUrlTableRef = useCallback((table) => {
    if (!table) return;
    const session = table.tableId || table.id
      ? loadUrlTableSessionById(table.tableId || table.id)
      : urlTableSessionFromRef(table);
    setActiveUrlTableSession(session);
  }, []);

  const handleOpenNewUrlTable = useCallback((objectId, kind = "links") => {
    if (!objectId) return;
    const session = createBlankUrlTableForObject(objectId, "", {
      kind: kind === "affiliates" ? "affiliates" : "links",
    });
    if (session) setActiveUrlTableSession(session);
  }, []);

  const handleOpenPasswordTableForCompany = useCallback((objectId) => {
    if (!objectId) return;
    setActivePasswordTableSession(loadCompanyPasswordTableSession(objectId, t('passwordTableLibrary.newDocTitle')));
  }, [t]);

  const handleUrlTableSessionChange = useCallback((patch) => {
    setActiveUrlTableSession((current) => {
      if (!current) return current;
      return { ...current, ...patch };
    });
  }, []);

  const handleUrlTableSessionClose = useCallback(() => {
    setActiveUrlTableSession(null);
  }, []);

  const handleUrlTableSessionSaved = useCallback(async (finalizedEntries) => {
    if (urlTableSaveLockRef.current) return;
    const current = activeUrlTableSessionRef.current;
    if (!current) return;

    urlTableSaveLockRef.current = true;
    try {
      const entries = Array.isArray(finalizedEntries) ? finalizedEntries : (current.entries || []);
      if (!current.objectId) {
        console.warn("[url-table] Save skipped: missing company objectId");
        return;
      }
      const merged = { ...current, entries, saved: true };
      const result = await persistUrlTableSessionAndFlush(merged);
      if (!result?.objectId) {
        console.warn("[url-table] Save did not write to SQL store", result);
        return;
      }
      setActiveUrlTableSession(null);
    } finally {
      urlTableSaveLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    setUrlTableQueueCallback((objectId, entry) => {
      setActiveUrlTableSession((current) => {
        if (!current || current.objectId !== objectId) return current;
        if (current.tableId && entry.tableId && current.tableId !== entry.tableId) return current;
        if (current.entries.some((item) => item.id === entry.id)) return current;
        return {
          ...current,
          tableId: current.tableId || entry.tableId || null,
          entries: [...current.entries, createLinkEntry(entry)],
          saved: false,
        };
      });
    });
    return () => setUrlTableQueueCallback(null);
  }, []);

  // Open the URL table overlay from deep components (e.g. @mention hover card),
  // optionally prefilling the search bar so the list opens already filtered.
  useEffect(() => {
    setUrlTableOpenCallback(({ tableId, objectId, searchQuery }) => {
      let session = tableId ? loadUrlTableSessionById(tableId) : null;
      if (!session && objectId) {
        migrateLocalUrlEntriesToTables();
        session = loadCompanyUrlTableSession(objectId, t('urlTableLibrary.newDocTitle'));
      }
      if (!session) return;
      setActiveUrlTableSession({
        ...session,
        initialSearch: String(searchQuery ?? ""),
      });
    });
    return () => setUrlTableOpenCallback(null);
  }, [t]);

  const handlePasswordTableSessionChange = useCallback((patch) => {
    setActivePasswordTableSession((current) => {
      if (!current) return current;
      return { ...current, ...patch };
    });
  }, []);

  const handlePasswordTableSessionClose = useCallback(() => {
    setActivePasswordTableSession(null);
  }, []);

  const handlePasswordTableSessionSaved = useCallback(async (finalizedEntries) => {
    if (passwordTableSaveLockRef.current) return;
    const current = activePasswordTableSessionRef.current;
    if (!current) return;

    passwordTableSaveLockRef.current = true;
    try {
      const entries = Array.isArray(finalizedEntries) ? finalizedEntries : (current.entries || []);
      if (!current.objectId) {
        console.warn("[password-table] Save skipped: missing company objectId");
        return;
      }
      const merged = { ...current, entries, saved: true };
      const result = await persistPasswordTableSessionAndFlush(merged);
      if (!result?.objectId) {
        console.warn("[password-table] Save did not write to SQL store", result);
        return;
      }
      setActivePasswordTableSession(null);
    } finally {
      passwordTableSaveLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    setPasswordTableQueueCallback((objectId, entry) => {
      setActivePasswordTableSession((current) => {
        if (!current || current.objectId !== objectId) return current;
        if (current.entries.some((item) => item.id === entry.id)) return current;
        return { ...current, entries: [...current.entries, entry], saved: false };
      });
    });
    return () => setPasswordTableQueueCallback(null);
  }, []);

  const parkLazyTodo = useLazyTodosStore((s) => s.parkItem);
  const removeLazyTodo = useLazyTodosStore((s) => s.removeItem);
  const updateLazyTodo = useLazyTodosStore((s) => s.updateItem);
  const activateLazyTodo = useLazyTodosStore((s) => s.activateItem);
  const createDraftLazyTodo = useLazyTodosStore((s) => s.createDraftItem);

  const handleOpenNewLazyTodo = useCallback((objectId, extras = {}) => {
    if (!objectId) return;
    const documentId = extras?.documentId ? String(extras.documentId).trim() : "";
    const listTitle = String(extras?.listTitle ?? "").trim() || undefined;

    // Document-linked: reopen existing list if present; else create a fresh id.
    if (documentId) {
      const existing = useLazyTodosStore.getState().findItemByDocumentId(documentId);
      if (existing?.id) {
        const nextTitle = listTitle && listTitle !== String(existing.listTitle || "").trim()
          ? listTitle
          : null;
        if (nextTitle) {
          updateLazyTodo(existing.id, { listTitle: nextTitle });
        }
        const opened = nextTitle ? { ...existing, listTitle: nextTitle } : existing;
        setActiveLazyTodo((current) => {
          if (current) {
            if (lazyTodoHasContent(current)) {
              parkLazyTodo({ ...current, status: 'queued' });
            } else if (current.id && current.id !== existing.id) {
              removeLazyTodo(current.id);
            }
          }
          activateLazyTodo(existing.id);
          return cloneLazyTodo({ ...opened, status: 'active' });
        });
        return;
      }
    }

    setActiveLazyTodo((current) => {
      if (current) {
        if (lazyTodoHasContent(current)) {
          parkLazyTodo({ ...current, status: 'queued' });
        } else if (current.id) {
          removeLazyTodo(current.id);
        }
      }
      return createDraftLazyTodo(objectId, {
        documentId: documentId || null,
        listTitle,
      });
    });
  }, [activateLazyTodo, createDraftLazyTodo, parkLazyTodo, removeLazyTodo, updateLazyTodo]);

  const lazyTodoCreateRequest = useUIStateStore((s) => s.lazyTodoCreateRequest);
  useEffect(() => {
    if (!lazyTodoCreateRequest?.objectId) return;
    handleOpenNewLazyTodo(lazyTodoCreateRequest.objectId, {
      documentId: lazyTodoCreateRequest.documentId || null,
      listTitle: lazyTodoCreateRequest.listTitle || null,
    });
    useUIStateStore.getState().clearLazyTodoCreateRequest();
  }, [lazyTodoCreateRequest, handleOpenNewLazyTodo]);

  const stepPlaybookOpenRequest = useUIStateStore((s) => s.stepPlaybookOpenRequest);
  useEffect(() => {
    if (!stepPlaybookOpenRequest?.playbook) return;
    const { playbook, initialStepIndex = 0 } = stepPlaybookOpenRequest;
    setActiveStepPlaybookSession(
      stepPlaybookSessionFromRef(playbook, {
        saved: false,
        initialStepIndex,
      }),
    );
    useUIStateStore.getState().clearStepPlaybookOpenRequest();
  }, [stepPlaybookOpenRequest]);

  const handleOpenLazyTodoItem = useCallback((item) => {
    if (!item?.id) return;
    setActiveLazyTodo((current) => {
      if (current) {
        if (lazyTodoHasContent(current)) {
          parkLazyTodo({ ...current, status: 'queued' });
        } else if (current.id) {
          removeLazyTodo(current.id);
        }
      }
      activateLazyTodo(item.id);
      return cloneLazyTodo({ ...item, status: 'active' });
    });
  }, [activateLazyTodo, parkLazyTodo, removeLazyTodo]);

  const handleLazyTodoChange = useCallback((patch) => {
    setActiveLazyTodo((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.items) next.items = patch.items;
      if (current.id) {
        updateLazyTodo(current.id, {
          reminder: next.reminder,
          listTitle: next.listTitle,
          items: next.items,
          status: 'active',
        });
      }
      return next;
    });
  }, [updateLazyTodo]);

  const handleLazyTodoCloseTab = useCallback(() => {
    setActiveLazyTodo((current) => {
      if (!current) return null;
      if (lazyTodoHasContent(current)) {
        parkLazyTodo({ ...current, status: 'queued' });
      } else if (current.id) {
        removeLazyTodo(current.id);
      }
      return null;
    });
  }, [parkLazyTodo, removeLazyTodo]);

  const handleLazyTodoSave = useCallback(() => {
    handleLazyTodoCloseTab();
  }, [handleLazyTodoCloseTab]);

  const handleLazyTodoCompleted = useCallback(() => {
    setActiveLazyTodo((current) => {
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5c112'},body:JSON.stringify({sessionId:'b5c112',runId:'run1',hypothesisId:'H-A',location:'App.jsx:handleLazyTodoCompleted',message:'Completed clicked — deleting lazy todo',data:{id:current?.id||null,itemCount:(current?.items||[]).length,checkedCount:(current?.items||[]).filter((i)=>i.checked).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (current?.id) removeLazyTodo(current.id);
      return null;
    });
  }, [removeLazyTodo]);

  const openNodeOverlay = useCallback((nodeId, options = {}) => {
    if (!nodeId || !nodeEntities[nodeId]) return;
    closeExpandedDocForExternalAction(() => {
      setExpandedNodeContentFocus(Boolean(options.contentFocus));
      setExpandedNodeId(nodeId);
    });
  }, [nodeEntities, expandedDocId]);

  const patchCanvasNode = useCallback((canvasNodeId, patch) => {
    setCanvasNodes((all) => all.map((n) => (
      n.id === canvasNodeId ? { ...n, ...patch } : n
    )));
  }, []);

  const runAgentExecution = useCallback(async (options) => executeAgentRun({
    canvasNodes,
    canvasConns,
    nodeEntities,
    objects,
    docs,
    locale,
    patchCanvasNode,
    setToast,
    setExpandedDocId,
    setExpandedNodeId,
    setExpandedNodeContentFocus,
    setDocViewGeneration,
    ...options,
  }), [
    canvasNodes,
    canvasConns,
    nodeEntities,
    objects,
    docs,
    locale,
    patchCanvasNode,
  ]);

  const handleRunAgent = useCallback(async (canvasNodeId) => {
    await runAgentExecution({ canvasNodeId });
  }, [runAgentExecution]);

  const scheduledAutoRunEnabled = useScheduledTasksStore((s) => s.autoRunEnabled);
  useScheduledAgentRunner({
    enabled: scheduledAutoRunEnabled,
    canvasNodes,
    canvasConns,
    nodeEntities,
    executeAgentRun: runAgentExecution,
    setToast,
    locale,
  });

  const runAdoption = useCallback((payload) => {
    const ok = adoptOrphanNodeToDocument({
      nodeEntityId: payload.orphanEntityId,
      docId: payload.docId,
      canvasNodeId: payload.orphanCanvasNodeId,
      patchCanvasNode,
    });
    if (ok) {
      setToast({
        message: t("canvas.adoptSuccess", {
          orphan: payload.orphanTitle,
          doc: payload.docTitle,
        }),
        kind: "ok",
      });
    }
    return ok;
  }, [patchCanvasNode, t]);

  const handleRequestDocAdoption = useCallback((payload) => new Promise((resolve) => {
    setAdoptPrompt({ payload, resolve });
  }), []);

  const handleAdoptPromptYes = useCallback(() => {
    if (!adoptPrompt) return;
    runAdoption(adoptPrompt.payload);
    adoptPrompt.resolve("adopt");
    setAdoptPrompt(null);
  }, [adoptPrompt, runAdoption]);

  const handleAdoptPromptNo = useCallback(() => {
    if (!adoptPrompt) return;
    adoptPrompt.resolve("wire-only");
    setAdoptPrompt(null);
  }, [adoptPrompt]);

  const handleDocumentAdoptOrphan = useCallback((docCanvasNodeId, orphanCanvasNodeId) => {
    const docNode = canvasNodes.find((n) => n.id === docCanvasNodeId);
    const orphanNode = canvasNodes.find((n) => n.id === orphanCanvasNodeId);
    if (!docNode || !orphanNode?.noteId) return;
    const docId = docNode.docId || docNode.noteId;
    if (!docId || !docs[docId]) return;
    runAdoption({
      orphanEntityId: orphanNode.noteId,
      docId,
      orphanCanvasNodeId: orphanNode.id,
      orphanTitle: (nodeEntities[orphanNode.noteId]?.sourceQuery
        || nodeEntities[orphanNode.noteId]?.title
        || orphanNode.title || "").trim(),
      docTitle: (docs[docId]?.title || "Untitled").trim(),
    });
  }, [canvasNodes, nodeEntities, docs, runAdoption]);

  const openCanvasEntity = (noteId, canvasNode = null, options = {}) => {
    if (!noteId && !canvasNode) return;
    const targetDocId = noteId && docs[noteId] ? noteId : canvasNode?.docId;
    if (targetDocId && docs[targetDocId]) {
      setExpandedNodeId(null);
      const focusBlockId = canvasNode
        ? resolveHeadlineBlockIdForCanvasNode(canvasNode, nodeEntities, docs)
        : null;
      openDocumentOverlay(targetDocId, { focusBlockId });
      return;
    }

    if (noteId && nodeEntities[noteId]) {
      closeExpandedDocForExternalAction(() => {
        setExpandedNodeContentFocus(Boolean(options?.contentFocus));
        setExpandedNodeId(noteId);
      });
    }
  };

  return (
    <div className={"dash" + (timelineSheet === "expanded" ? " is-timeline-sheet-expanded" : "")}>
      <TopBar onBack={onBack} onAltSeed={null} />

      <MetaBar metadata={metaBarMetadata} />

      <div className="dash-main">
        <div className="dash-col">
          <LeftPanel
            companyName={company?.name || null}
            onInsertToCanvas={insertNodeToCanvas}
            onInsertAgent={handleInsertAgent}
            onOpenDocument={openDocumentOverlay}
            onExpandNode={openNodeOverlay}
            onDocumentDeleted={handleDocumentDeleted}
            onRunStepPlaybook={handleRunStepPlaybook}
            onOpenStepPlaybook={handleOpenStepPlaybook}
            onOpenNewStepPlaybook={handleOpenNewStepPlaybook}
            onOpenUrlTableForCompany={handleOpenUrlTableForCompany}
            onOpenUrlTableRef={handleOpenUrlTableRef}
            onOpenNewUrlTable={handleOpenNewUrlTable}
            onOpenNewLazyTodo={handleOpenNewLazyTodo}
            onOpenLazyTodoItem={handleOpenLazyTodoItem}
            onStepPlaybookRemoved={handleStepPlaybookRemoved}
            onUrlTablesDeleted={handleUrlTablesDeleted}
            timelineCanvasSelection={selection}
            canvasNodesForQueue={canvasNodes}
            onNotify={(message, kind = "warm") => setToast({ message, kind })}
            onGinaDashboardOpenChange={setGinaDashboardOpen}
          />
        </div>

        <div className="dash-col canvas-col">
          <BlueprintCanvas
            nodes={canvasNodes}
            setNodes={setCanvasNodes}
            connections={canvasConns}
            setConnections={setCanvasConns}
            blueprints={blueprints}
            setBlueprints={setBlueprints}
            selection={selection}
            setSelection={setSelection}
            today={today}
            docsById={docs}
            nodeEntitiesById={nodeEntities}
            objectsById={objects}
            timelineQueueMode={timelineQueueMode}
            timelineSelectEnabled={!knowledgeFolderActive}
            onToggleTimelineQueueMode={handleToggleTimelineQueueMode}
            onInsertToTimeline={handleInsertToTimeline}
            heldObjectId={heldObjectId}
            heldObjectName={heldObjectName}
            onToggleObjectHold={handleToggleObjectHold}
            onTimelineCanvasSelect={handleTimelineCanvasSelect}
            onTimelineCanvasSelectMany={handleTimelineCanvasSelectMany}
            onNotify={(message, kind = "warm") => setToast({ message, kind })}
            onDeleteNode={deleteCanvasNode}
            onClearCanvas={clearAllCanvasElements}
            onEditNode={handleEditCanvasNode}
            onFocusNote={() => {}}
            onOpenNote={openCanvasEntity}
            onRemoveBlueprintFromCanvas={() => {}}
            onCanvasDrop={handleCanvasDrop}
            onRequestDocAdoption={handleRequestDocAdoption}
            onDocumentAdoptOrphan={handleDocumentAdoptOrphan}
            onRunAgent={handleRunAgent}
            onConnectionCreated={handleCanvasConnectionCreated}
            scheduledAutoRunEnabled={scheduledAutoRunEnabled}
            onToggleScheduledAutoRun={() => {
              useScheduledTasksStore.getState().setAutoRunEnabled(!scheduledAutoRunEnabled);
            }}
            onViewportWorldChange={(world) => {
              if (!world) return;
              canvasViewRef.current = world;
            }}
            revealToken={canvasRevealToken}
          />
          {!ginaDashboardOpen
          && objectWorkspaceActive
          && clickFolderView === "subgroups" ? (
            <GinaCanvasFab
              onOpen={openGinaDashboardFromFab}
              label={t("gina.name")}
              title={t("gina.openChat")}
            />
          ) : null}
          {scanState === "scanning-blogs" && (
            <ScanOverlay logs={scanLogs} kind="blogs" />
          )}
          {timelineReminder ? (
            <TimelineReminderCard
              reminder={timelineReminder}
              onGotIt={() => {
                dismissedTimelineReminderKey.current = reminderOccurrenceKey(
                  timelineReminder.alertKey,
                  timelineReminder.startAtMs,
                );
                setTimelineReminder(null);
              }}
              onSkip={() => {
                skipTimelineReminderKey(
                  timelineReminder.alertKey,
                  timelineReminder.startAtMs,
                );
                dismissedTimelineReminderKey.current = reminderOccurrenceKey(
                  timelineReminder.alertKey,
                  timelineReminder.startAtMs,
                );
                setTimelineReminder(null);
              }}
            />
          ) : null}
        </div>

        <div className="dash-col">
          <IntelPanel
            intel={intel}
            addedIds={[]}
            loadingIds={[]}
            onGetOverview={() => {
              showUpgradeModal("search");
            }}
            onScanBlogs={scanBlogs}
            hasScannedBlogs={hasScannedBlogs}
            today={today}
            launchDate={null}
            onSelectDate={(d) => {
              if (!d) return;
              setToday(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
            }}
            nodeEntities={nodeEntities}
            docsById={docs}
            expandedNodeId={expandedNodeId}
            selection={selection}
            canvasNodes={canvasNodes}
            onInsertForecastNode={handleInsertForecastNode}
            onInsertEventNode={handleInsertEventNode}
            onSlashCreateNode={createNodeFromSlashAndInsert}
            objectsById={objects}
            selectedObjectId={dashboardSelectedObjectId}
          />
        </div>
      </div>

      <Timeline
        nodes={canvasNodes}
        connections={canvasConns}
        today={today}
        focusedNoteId={null}
        onFocusNote={() => {}}
        docsById={docs}
        objectsById={objects}
        nodeEntitiesById={nodeEntities}
        filterObjectId={dashboardObjectId}
        onOpenDocument={openDocumentOverlay}
        onOpenNode={openNodeOverlay}
      />

      {activeStepPlaybook ? (
        <StepsRunnerOverlay
          playbook={activeStepPlaybook}
          onClose={() => setActiveStepPlaybook(null)}
          onComplete={() => {}}
        />
      ) : null}

      {activeUrlTableSession ? (
        <UrlTableDashboardOverlay
          session={activeUrlTableSession}
          onChange={handleUrlTableSessionChange}
          onCloseTab={handleUrlTableSessionClose}
          onSaved={handleUrlTableSessionSaved}
        />
      ) : null}

      {activePasswordTableSession ? (
        <PasswordTableDashboardOverlay
          session={activePasswordTableSession}
          onChange={handlePasswordTableSessionChange}
          onCloseTab={handlePasswordTableSessionClose}
          onSaved={handlePasswordTableSessionSaved}
        />
      ) : null}

      {activeStepPlaybookSession ? (
        <StepPlaybookDashboardOverlay
          session={activeStepPlaybookSession}
          onChange={handleStepPlaybookSessionChange}
          onCloseTab={handleStepPlaybookSessionClose}
          onSaved={handleStepPlaybookSessionSaved}
          onShare={handleStepPlaybookShare}
          shareBusy={stepPlaybookShareBusy}
        />
      ) : null}

      {activeLazyTodo ? (
        <LazyTodoDashboardOverlay
          session={activeLazyTodo}
          onChange={handleLazyTodoChange}
          onCloseTab={handleLazyTodoCloseTab}
          onSave={handleLazyTodoSave}
          onCompleted={handleLazyTodoCompleted}
        />
      ) : null}

      {expandedDocId && (
        <div className="doc-overlay-global">
          <div className="doc-overlay-global-card" onClick={(e) => e.stopPropagation()}>
            <DocExpandedView
              key={`${expandedDocId}:${docViewGeneration}`}
              docId={expandedDocId}
              initialFocusBlockId={docOpenFocusBlockId}
              onExpandNode={openNodeOverlay}
              registerCloseInterceptor={registerDocCloseInterceptor}
              onClose={() => {
                setExpandedDocId(null);
                setDocOpenFocusBlockId(null);
              }}
              onNavigateToDoc={(nextDocId) => openDocumentOverlay(nextDocId)}
              onInsertToCanvas={insertNodeToCanvas}
              onDocumentDeleted={handleDocumentDeleted}
              onAfterDocSave={handleAfterDocSave}
              onStepPlaybookRemoved={handleStepPlaybookRemoved}
            />
          </div>
        </div>
      )}
      {expandedNodeId && nodeEntities[expandedNodeId] ? (
        nodeEntities[expandedNodeId].dataType === "video" ? (
        <VideoReferencePanel
          nodeId={expandedNodeId}
          searchQuery={
            (nodeEntities[expandedNodeId].sourceQuery
              || nodeEntities[expandedNodeId].title
              || "").trim()
          }
          parentDocId={nodeEntities[expandedNodeId]?.parentDocId ?? null}
          companyObjectId={dashboardObjectId || dashboardSelectedObjectId || null}
          onClose={() => setExpandedNodeId(null)}
          onSlashCreateNode={createNodeFromSlashAndInsert}
        />
        ) : (
          <StandaloneNodeModal
            node={nodeEntities[expandedNodeId]}
            docs={Object.values(docs)}
            parentObjectId={dashboardObjectId || dashboardSelectedObjectId || null}
            queryCanvasNodeId={
              canvasNodes.find((n) => n.noteId === expandedNodeId)?.id ?? null
            }
            initialContentFocus={expandedNodeContentFocus}
            onClose={() => {
              setExpandedNodeId(null);
              setExpandedNodeContentFocus(false);
            }}
            onSaved={(entity) => {
              const parentDocId = entity?.parentDocId || null;
              if (parentDocId) {
                useTimelineStore.getState().refreshTimelineDocSnapshot(parentDocId, {
                  canvasNodes,
                  connections: canvasConns,
                  docsById: useDocsStore.getState().docs,
                  nodeEntitiesById: useNodesStore.getState().nodes,
                });
              }
              setExpandedNodeId(null);
              setExpandedNodeContentFocus(false);
            }}
            onDeleted={() => {
              setExpandedNodeId(null);
              setExpandedNodeContentFocus(false);
            }}
          />
        )
      ) : null}

      {adoptPrompt ? (
        <AdoptNodeConfirmModal
          docTitle={adoptPrompt.payload.docTitle}
          orphanTitle={adoptPrompt.payload.orphanTitle}
          onAdopt={handleAdoptPromptYes}
          onWireOnly={handleAdoptPromptNo}
        />
      ) : null}

      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </div>
  );
}

/* ── APP ROOT ──────────────────────────────────────── */
function App() {
  const navigate = useNavigate();
  useStripeCheckoutReturn();
  const proAbandon = useProCheckoutAbandonPrompt();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = useThemeStore((s) => s.theme);
  const initialApp = useMemo(() => resolveInitialAppState(), []);
  const [screen, setScreen] = useState(initialApp.screen);
  const [company, setCompany] = useState(initialApp.company);
  const upgradeOpen = useUpgradeModalStore((s) => s.open);
  const upgradeReason = useUpgradeModalStore((s) => s.reason);
  const hideUpgradeModal = useUpgradeModalStore((s) => s.hide);
  const referralOpen = useReferralModalStore((s) => s.open);
  const hideReferralModal = useReferralModalStore((s) => s.hide);

  useEffect(() => {
    initStores();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-site', 'app');
    applyTheme(t, theme);
    return () => document.documentElement.removeAttribute('data-site');
  }, [theme, t.typography, t.accent]);

  return (
    <>
      {screen === "selector" && (
        <CompanySelectorPage
          onSelect={(c) => {
            // Selección de compañía sin límite de plan por diseño — free y pro pueden
            // escoger/cambiar de compañía libremente. No agregar gate aquí.
            clearPendingLibrary();
            ensureCompanyObject(c);
            localStorage.setItem(LAST_COMPANY_KEY, JSON.stringify(c));
            setCompany(c);
            setScreen("dashboard");
          }}
          onSkip={() => {
            clearPendingLibrary();
            setCompany(getBlankWorkspace());
            setScreen("dashboard");
          }}
          onBack={() => navigate("/")}
        />
      )}
      {screen === "dashboard" && company && (
        <Dashboard company={company} onBack={() => setScreen("selector")} />
      )}

      <UpgradeModal open={upgradeOpen} reason={upgradeReason} onClose={hideUpgradeModal} />
      <ReferralModal open={referralOpen} onClose={hideReferralModal} />
      <ProCheckoutAbandonModal
        open={proAbandon.open}
        busy={proAbandon.busy}
        billing={proAbandon.billing}
        onCompletePayment={proAbandon.handleCompletePayment}
        onContinueStarter={proAbandon.handleContinueStarter}
      />
      <ConfirmActionCard />

      <TweaksPanel title="Futura Nota">
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)} />
        <TweakRadio label="Typography" value={t.typography}
          options={[
            { value: "sans",  label: "Sans"  },
            { value: "mono",  label: "Mono"  },
            { value: "mixed", label: "Mix"   },
          ]}
          onChange={(v) => setTweak("typography", v)} />
        <TweakSelect label="Accent" value={t.accent}
          options={[
            { value: "mint",   label: "Mint" },
            { value: "cyan",   label: "Cyan" },
            { value: "violet", label: "Violet" },
            { value: "amber",  label: "Amber" },
          ]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Navigate" />
        <div style={{ display: "flex", gap: 4 }}>
          <TweakButton label="Landing"   secondary onClick={() => navigate("/")} />
          <TweakButton label="Selector"  secondary onClick={() => setScreen("selector")} />
          <TweakButton label="Dashboard" secondary onClick={() => {
            if (!company) setCompany(readLastCompany() || getBlankWorkspace());
            setScreen("dashboard");
          }} />
        </div>
      </TweaksPanel>
    </>
  );
}

export default App;
