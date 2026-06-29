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
  usePlanStore,
  useUpgradeModalStore,
  FREE_LIMITS,
} from './stores/index.js';
import { UpgradeModal } from './components/plans/UpgradeModal.jsx';
import { useNavigate } from 'react-router-dom';
import { CompanySelectorPage } from './pages/CompanySelectorPage.jsx';
import { LeftPanel } from './components/left/LeftPanel.jsx';
import { DocExpandedView } from './components/docs/DocExpandedView.jsx';
import { StandaloneNodeModal } from './components/nodes/StandaloneNodeModal.jsx';
import { VideoReferencePanel } from './components/intel/VideoReferencePanel.jsx';
import { TimelineAlertToast } from './components/alerts/TimelineAlertToast.tsx';
import { resolveActiveTimelineAlert } from './lib/resolveTimelineAlert.js';
import {
  ensureNodeForDocBlock,
  shouldIncludeBlockOnCanvas,
  collectNodeIdsReferencedByBlocks,
  findOrphanNodeIdsForDoc,
} from './lib/docNodeSync.js';
import {
  adoptOrphanNodeToDocument,
  releaseStaleNodeParentRefs,
} from './lib/nodeParentAdoption.js';
import { AdoptNodeConfirmModal } from './components/nodes/AdoptNodeConfirmModal.jsx';
import { useI18n, translate } from './i18n/useI18n.js';
import { normalizeDocBlocks } from './lib/docBlocks.js';
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
  collectCanvasNodeIdsForEntityIds,
  syncContentDocCanvasNodes,
} from './lib/canvasDocSync.js';
import { nextCompactPosition } from './lib/canvasMath.js';
import { normalizeDoc } from './lib/normalizeDoc.js';
import { isContentDoc, isKnowledgeDoc, resolveLinkedProductCategories } from './lib/templateDoc.js';
import { AGENT_CAMPAIGN_ANALYST, AGENT_MARKETING_GUIDE, AGENT_SOCIAL_HYPE_ANALYST, getAgentCanvasTitle, isAgentEnabled } from './lib/agents/registry.js';
import { initialNodeShapeFromSlash } from './lib/docBlockSlash.js';
import { mergeVideoNodeContent } from './lib/videoEmbed.js';
import { NODE_DATA_TYPES } from './lib/nodeDataTypes.js';
import { runCampaignAnalyst } from './lib/agents/runCampaignAnalyst.js';
import { runMarketingGuideAgent } from './lib/agents/runMarketingGuideAgent.js';
import { runSocialHypeAnalystAgent } from './lib/agents/runSocialHypeAnalystAgent.js';
import { ensureCompanyObject } from './lib/ensureCompanyObject.js';
import { supabase } from './lib/supabaseClient';
import {
  clearPendingLibrary,
  getBlankWorkspace,
  LAST_COMPANY_KEY,
  readLastCompany,
  resolveInitialAppState,
} from './lib/onboardingFlow.js';



const DOC_CHILD_OFFSET_X = CANVAS_DOC_CHILD_OFFSET_X;
const DOC_CHILD_ROW_STEP = 88;

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

function resolveDocChildNodes(doc) {
  const nodesStore = useNodesStore.getState();
  const childMap = new Map(
    nodesStore.getNodesByDoc(doc.id).map((node) => [node.id, node]),
  );

  for (const nodeId of doc.nodeIds || []) {
    if (childMap.has(nodeId)) continue;
    const node = nodesStore.getNode(nodeId);
    if (node) childMap.set(node.id, node);
  }

  const blocks = normalizeDocBlocks(doc.blocks || []);
  const docCreatedAt = doc.createdAt || null;
  blocks.forEach((block, blockIndex) => {
    if (!shouldIncludeBlockOnCanvas(block)) return;
    if (block.nodeId && childMap.has(block.nodeId)) return;

    const ensuredId = ensureNodeForDocBlock({
      block,
      blocks,
      blockIndex,
      docId: doc.id,
      docCreatedAt,
      createOrUpdateNodeFromDocBlock: nodesStore.createOrUpdateNodeFromDocBlock,
    });
    if (!ensuredId) return;
    const node = nodesStore.getNode(ensuredId);
    if (node) childMap.set(node.id, node);
  });

  return [...childMap.values()];
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
  const [timelineAlert, setTimelineAlert] = useState(null);
  const dismissedTimelineAlertKey = useRef(null);
  const [intel, setIntel]             = useState([]);
  const [hasScannedBlogs, setBlogs]   = useState(false);
  const [scanState, setScanState]     = useState("idle");
  const [scanLogs, setScanLogs]       = useState([]);
  const [canvasNodes, setCanvasNodes] = useState([]);
  const [canvasConns, setCanvasConns] = useState([]);
  const [selection, setSelection]     = useState([]);
  const [blueprints, setBlueprints]   = useState([]);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [docViewGeneration, setDocViewGeneration] = useState(0);
  const [docOpenFocusBlockId, setDocOpenFocusBlockId] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [expandedNodeContentFocus, setExpandedNodeContentFocus] = useState(false);
  const [adoptPrompt, setAdoptPrompt] = useState(null);
  const { t } = useI18n();
  const docs = useDocsStore((s) => s.docs);
  const objects = useObjectsStore((s) => s.objects);
  const nodeEntities = useNodesStore((s) => s.nodes);
  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setSelectedObjectId = useUIStateStore((s) => s.setSelectedObjectId);
  const activeDocMetaDraft = useUIStateStore((s) => s.activeDocMetaDraft);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);
  const timelineAlertsEnabled = useTimelineStore((s) => s.timelineAlertsEnabled);
  const timelineQueueMode = useTimelineStore((s) => s.timelineQueueMode);
  const toggleTimelineQueueMode = useTimelineStore((s) => s.toggleTimelineQueueMode);
  const enqueueTimelineDocsFromCanvasNodes = useTimelineStore((s) => s.enqueueTimelineDocsFromCanvasNodes);
  const timelineDocQueue = useTimelineStore((s) => s.timelineDocQueue);
  const knowledgeFolderActive = useUIStateStore((s) => s.knowledgeFolderActive);
  const timelines = useTimelineStore((s) => s.timelines);
  const prevTimelineAlertsEnabled = useRef(false);
  const planProfile = usePlanStore((s) => s.profile);
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);

  const metaBarMetadata = useMemo(
    () =>
      buildMetaBarFromCanvas({
        selection,
        canvasNodes,
        docs,
        objectsById: objects,
        selectedObjectId,
        expandedDocId,
        activeDocMetaDraft,
        today,
      }),
    [selection, canvasNodes, docs, objects, selectedObjectId, expandedDocId, activeDocMetaDraft, today],
  );

  const handleTimelineCanvasSelect = useCallback(
    (canvasNodeId) => {
      const node = canvasNodes.find((n) => n.id === canvasNodeId);
      if (!node) return true;
      const docId = resolveParentDocIdForCanvasNode(node, nodeEntities, docs);
      const doc = docId ? docs[docId] : null;
      if (isKnowledgeDoc(doc)) return true;
      if (doc?.parentObjectId) {
        setFilterObjectId(doc.parentObjectId);
        setSelectedObjectId(doc.parentObjectId);
      }
      if (!timelineQueueMode) return true;
      if (docId && timelineDocQueue.includes(docId)) {
        setToast({
          message: `"${doc?.title || "Document"}" is already on the timeline`,
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
      timelineDocQueue,
      setFilterObjectId,
      setSelectedObjectId,
    ],
  );

  const handleInsertToTimeline = useCallback(() => {
    if (!selection.length) return;
    const result = enqueueTimelineDocsFromCanvasNodes(selection, canvasNodes, nodeEntities, docs);
    if (!result?.ok) {
      setToast({
        message: result?.message || "Insert to timeline failed.",
        kind: "warm",
      });
      return;
    }
    setToast({
      message: `Added ${result.added} node${result.added === 1 ? "" : "s"} to timeline queue`,
      kind: "ok",
    });
  }, [selection, canvasNodes, nodeEntities, docs, enqueueTimelineDocsFromCanvasNodes]);

  const handleTimelineCanvasSelectMany = useCallback(
    (canvasNodeIds) => {
      if (!timelineQueueMode || !canvasNodeIds?.length) return;
      for (const canvasId of canvasNodeIds) {
        handleTimelineCanvasSelect(canvasId);
      }
    },
    [timelineQueueMode, handleTimelineCanvasSelect],
  );


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
    if (timelineAlertsEnabled && !prevTimelineAlertsEnabled.current) {
      dismissedTimelineAlertKey.current = null;
    }
    prevTimelineAlertsEnabled.current = timelineAlertsEnabled;

    if (!timelineAlertsEnabled) {
      setTimelineAlert(null);
      return;
    }

    const alert = resolveActiveTimelineAlert({
      docs,
      objects,
      objectTimelineTitles,
      selectedObjectId: selectedObjectId || filterObjectId,
      canvasNodes,
    });

    if (!alert) {
      setTimelineAlert(null);
      return;
    }

    const key = `${alert.title}|${alert.campaignRef}`;
    if (dismissedTimelineAlertKey.current === key) return;

    setTimelineAlert(alert);
  }, [
    timelineAlertsEnabled,
    docs,
    objects,
    objectTimelineTitles,
    selectedObjectId,
    filterObjectId,
    canvasNodes,
    today,
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
    }));
  }, [docs, expandedDocId, activeDocMetaDraft]);

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
        if (x > 600) { x = 30; y += 110; }
        guard += 1;
      }
      return { x, y };
    }
    return nextCompactPosition(canvasNodes, extraOccupied);
  };

  /* ── INSERT ZUSTAND NODE → canvas ─ */
  const insertNodeToCanvas = (zustandNode, options = null) => {
    if (!zustandNode?.id) return;
    const alreadyOnCanvas = canvasNodes.some((n) => n.noteId === zustandNode.id);
    if (alreadyOnCanvas) {
      setToast({ message: `Already on canvas · "${zustandNode.title || "node"}"`, kind: "ok" });
      return;
    }
    const preferredX = options?.center ? 320 : options?.x;
    const preferredY = options?.center ? 190 : options?.y;
    const { x, y } = nextCanvasPosition(preferredX, preferredY);
    const newNode = buildCanvasNodeFromEntity(zustandNode, x, y);
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
    const preferredX = options?.center ? 320 : options?.x;
    const preferredY = options?.center ? 190 : options?.y;
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
    const existingNoteIds = new Set(
      canvasNodes.map((n) => n.noteId).filter(Boolean),
    );

    const occupied = [];
    const { x, y } = nextCanvasPosition(
      worldX != null ? worldX - 50 : undefined,
      worldY != null ? worldY - 40 : undefined,
      occupied,
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
            campaignActive: Boolean(normalizedDoc.campaignActive),
          }
        : {}),
    });
    occupied.push({ x, y });

    const launchCanvasNode = isContentDoc(normalizedDoc) && !isKnowledgeDoc(normalizedDoc)
      ? buildLaunchDateCanvasNode(normalizedDoc.launchAt, normalizedDoc.id)
      : null;
    const childNodes = resolveDocChildNodes(normalizedDoc).filter(
      (node) => !existingNoteIds.has(node.id),
    );
    const totalChildren = childNodes.length + (launchCanvasNode ? 1 : 0);
    const rowOffset = totalChildren > 1
      ? ((totalChildren - 1) * DOC_CHILD_ROW_STEP) / 2
      : 0;

    const childCanvasNodes = [];
    let childIndex = 0;

    if (launchCanvasNode) {
      const pos = nextCanvasPosition(
        x + DOC_CHILD_OFFSET_X,
        y + childIndex * DOC_CHILD_ROW_STEP - rowOffset,
        occupied,
      );
      occupied.push(pos);
      childCanvasNodes.push({ ...launchCanvasNode, x: pos.x, y: pos.y });
      childIndex += 1;
    }

    childNodes.forEach((childNode) => {
      const preferredX = x + DOC_CHILD_OFFSET_X;
      const preferredY = y + childIndex * DOC_CHILD_ROW_STEP - rowOffset;
      const pos = nextCanvasPosition(preferredX, preferredY, occupied);
      occupied.push(pos);
      childCanvasNodes.push(buildCanvasNodeFromEntity(childNode, pos.x, pos.y, {
        parentDocId: normalizedDoc.id,
      }));
      childIndex += 1;
    });

    const newCanvasNodes = [docCanvasNode, ...childCanvasNodes];

    setCanvasNodes((all) => [...all, ...newCanvasNodes]);
    setSelection([docCanvasNode.id]);
    const childMsg = childCanvasNodes.length
      ? ` + ${childCanvasNodes.length} node${childCanvasNodes.length === 1 ? "" : "s"}`
      : "";
    setToast({
      message: `Document placed · "${normalizedDoc.title}"${childMsg}`,
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

  const removeCanvasNodesForEntityIds = useCallback((entityNodeIds) => {
    const ids = (entityNodeIds || []).filter(Boolean);
    if (!ids.length) return;
    let idsToRemove = null;
    setCanvasNodes((all) => {
      idsToRemove = collectCanvasNodeIdsForEntityIds(all, ids);
      if (!idsToRemove.size) return all;
      return all.filter((n) => !idsToRemove.has(n.id));
    });
    if (idsToRemove?.size) {
      pruneCanvasRefs(idsToRemove);
    }
  }, []);

  const handleAfterDocSave = useCallback((docId, blocks) => {
    if (!docId) return;
    const nodesById = useNodesStore.getState().nodes;
    const orphanNodeIds = findOrphanNodeIdsForDoc(docId, blocks, nodesById);
    const referencedNodeIds = [...collectNodeIdsReferencedByBlocks(blocks)];
    useDocsStore.getState().updateDoc(docId, { nodeIds: referencedNodeIds });

    if (!orphanNodeIds.length) return;

    removeCanvasNodesForEntityIds(orphanNodeIds);
    const deleteNode = useNodesStore.getState().deleteNode;
    for (const nodeId of orphanNodeIds) {
      deleteNode(nodeId);
    }
  }, [removeCanvasNodesForEntityIds]);

  const clearAllCanvasElements = useCallback(() => {
    setCanvasNodes([]);
    setCanvasConns([]);
    setBlueprints([]);
    setSelection([]);
    setToast({ message: t("canvas.clearSuccess"), kind: "ok" });
  }, [t]);

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
    setExpandedDocId(docId);
    setDocOpenFocusBlockId(options.focusBlockId ?? null);
  };

  const openNodeOverlay = useCallback((nodeId, options = {}) => {
    if (!nodeId || !nodeEntities[nodeId]) return;
    setExpandedDocId(null);
    setExpandedNodeContentFocus(Boolean(options.contentFocus));
    setExpandedNodeId(nodeId);
  }, [nodeEntities]);

  const patchCanvasNode = useCallback((canvasNodeId, patch) => {
    setCanvasNodes((all) => all.map((n) => (
      n.id === canvasNodeId ? { ...n, ...patch } : n
    )));
  }, []);

  const handleRunAgent = useCallback(async (canvasNodeId) => {
    const agentNode = canvasNodes.find((n) => n.id === canvasNodeId);
    if (!agentNode || (agentNode.canvasKind !== "agent" && agentNode.dataType !== "agent")) return;
    if (agentNode.agentStatus === "running") return;

    patchCanvasNode(canvasNodeId, { agentStatus: "running", agentError: "" });

    const selectedObjectId = useUIStateStore.getState().selectedObjectId;
    const locale = useLocaleStore.getState().locale;
    const agentId = agentNode.agentId || AGENT_CAMPAIGN_ANALYST;

    if (!isAgentEnabled(agentId)) {
      patchCanvasNode(canvasNodeId, {
        agentStatus: "error",
        agentError: translate("agents.orchestrator.disabled", locale),
      });
      setToast({ message: translate("agents.orchestrator.disabled", locale), kind: "warm" });
      return;
    }

    if (agentId !== AGENT_CAMPAIGN_ANALYST
      && agentId !== AGENT_MARKETING_GUIDE
      && agentId !== AGENT_SOCIAL_HYPE_ANALYST) {
      patchCanvasNode(canvasNodeId, {
        agentStatus: "error",
        agentError: translate("agents.errors.generic", locale),
      });
      setToast({ message: translate("agents.errors.generic", locale), kind: "warm" });
      return;
    }

    const result = agentId === AGENT_MARKETING_GUIDE
      ? await runMarketingGuideAgent({
        agentCanvasNodeId: canvasNodeId,
        canvasNodes,
        connections: canvasConns,
        docsById: useDocsStore.getState().docs,
        objectsById: objects,
        selectedObjectId,
        locale,
      })
      : agentId === AGENT_SOCIAL_HYPE_ANALYST
        ? await runSocialHypeAnalystAgent({
          agentCanvasNodeId: canvasNodeId,
          canvasNodes,
          connections: canvasConns,
          docsById: useDocsStore.getState().docs,
          objectsById: objects,
          selectedObjectId,
          locale,
        })
        : await runCampaignAnalyst({
        agentCanvasNodeId: canvasNodeId,
        canvasNodes,
        connections: canvasConns,
        docsById: useDocsStore.getState().docs,
        objectsById: objects,
        nodeEntitiesById: nodeEntities,
        selectedObjectId,
        locale,
      });

    if (result.status === "success") {
      patchCanvasNode(canvasNodeId, {
        agentStatus: "done",
        agentError: "",
      });
      const openDocId = result.docId;
      if (result.wireOutputDocCanvasNodeId && openDocId) {
        const savedDoc = useDocsStore.getState().getDoc(openDocId);
        patchCanvasNode(result.wireOutputDocCanvasNodeId, {
          docId: openDocId,
          noteId: openDocId,
          content: savedDoc?.body || savedDoc?.content || "",
        });
      } else if (openDocId) {
        const savedDoc = useDocsStore.getState().getDoc(openDocId);
        const docCanvasNode = canvasNodes.find(
          (n) => (n.docId === openDocId || n.noteId === openDocId)
            && (n.canvasKind === "document" || n.dataType === "document"),
        );
        if (docCanvasNode && savedDoc) {
          patchCanvasNode(docCanvasNode.id, {
            content: savedDoc.body || savedDoc.content || "",
          });
        }
      }
      if (openDocId) {
        setDocViewGeneration((n) => n + 1);
        setExpandedDocId(openDocId);
      }
      setToast({
        message: result.userFacingMessage
          || (agentId === AGENT_MARKETING_GUIDE
            ? translate("agents.playbookSuccess", locale, { brand: result.brandName })
            : agentId === AGENT_SOCIAL_HYPE_ANALYST
              ? translate("agents.socialHypeSuccess", locale, { brand: result.brandName })
              : translate("agents.runSuccess", locale, { brand: result.brandName })),
        kind: "ok",
      });
      return;
    }

    patchCanvasNode(canvasNodeId, {
      agentStatus: "error",
      agentError: result.message,
    });
    setToast({ message: result.message, kind: "warm" });
  }, [canvasNodes, canvasConns, docs, objects, nodeEntities, patchCanvasNode]);

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
      setExpandedDocId(null);
      setExpandedNodeContentFocus(Boolean(options?.contentFocus));
      setExpandedNodeId(noteId);
    }
  };

  return (
    <div className="dash">
      <TopBar onBack={onBack} onAltSeed={null} />

      <MetaBar metadata={metaBarMetadata} />

      <div className="dash-main">
        <div className="dash-col">
          <LeftPanel
            onInsertToCanvas={insertNodeToCanvas}
            onInsertAgent={handleInsertAgent}
            onOpenDocument={openDocumentOverlay}
            onExpandNode={openNodeOverlay}
            onDocumentDeleted={handleDocumentDeleted}
            timelineCanvasSelection={selection}
            canvasNodesForQueue={canvasNodes}
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
            onToggleTimelineQueueMode={toggleTimelineQueueMode}
            onInsertToTimeline={handleInsertToTimeline}
            onTimelineCanvasSelect={handleTimelineCanvasSelect}
            onTimelineCanvasSelectMany={handleTimelineCanvasSelectMany}
            onNotify={(message, kind = "warm") => setToast({ message, kind })}
            onDeleteNode={deleteCanvasNode}
            onClearCanvas={clearAllCanvasElements}
            onEditNode={() => {}}
            onFocusNote={() => {}}
            onOpenNote={openCanvasEntity}
            onRemoveBlueprintFromCanvas={() => {}}
            onCanvasDrop={handleCanvasDrop}
            onRequestDocAdoption={handleRequestDocAdoption}
            onDocumentAdoptOrphan={handleDocumentAdoptOrphan}
            onRunAgent={handleRunAgent}
          />
          {scanState === "scanning-blogs" && (
            <ScanOverlay logs={scanLogs} kind="blogs" />
          )}
          {timelineAlert ? (
            <TimelineAlertToast
              alert={timelineAlert}
              onDismiss={() => {
                dismissedTimelineAlertKey.current = `${timelineAlert.title}|${timelineAlert.campaignRef}`;
                setTimelineAlert(null);
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
            selectedObjectId={selectedObjectId}
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
        filterObjectId={filterObjectId}
      />

      {expandedDocId && (
        <div className="doc-overlay-global">
          <div className="doc-overlay-global-card" onClick={(e) => e.stopPropagation()}>
            <DocExpandedView
              key={`${expandedDocId}:${docViewGeneration}`}
              docId={expandedDocId}
              initialFocusBlockId={docOpenFocusBlockId}
              onExpandNode={openNodeOverlay}
              onClose={() => {
                setExpandedDocId(null);
                setDocOpenFocusBlockId(null);
              }}
              onNavigateToDoc={(nextDocId) => openDocumentOverlay(nextDocId)}
              onInsertToCanvas={insertNodeToCanvas}
              onDocumentDeleted={handleDocumentDeleted}
              onAfterDocSave={handleAfterDocSave}
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
            onClose={() => setExpandedNodeId(null)}
            onSlashCreateNode={createNodeFromSlashAndInsert}
          />
        ) : (
          <StandaloneNodeModal
            node={nodeEntities[expandedNodeId]}
            docs={Object.values(docs)}
            parentObjectId={filterObjectId || selectedObjectId || null}
            queryCanvasNodeId={
              canvasNodes.find((n) => n.noteId === expandedNodeId)?.id ?? null
            }
            initialContentFocus={expandedNodeContentFocus}
            onClose={() => {
              setExpandedNodeId(null);
              setExpandedNodeContentFocus(false);
            }}
            onSaved={() => {
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
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = useThemeStore((s) => s.theme);
  const initialApp = useMemo(() => resolveInitialAppState(), []);
  const [screen, setScreen] = useState(initialApp.screen);
  const [company, setCompany] = useState(initialApp.company);
  const upgradeOpen = useUpgradeModalStore((s) => s.open);
  const upgradeReason = useUpgradeModalStore((s) => s.reason);
  const hideUpgradeModal = useUpgradeModalStore((s) => s.hide);

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
