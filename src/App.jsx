import { useState, useEffect, useMemo } from 'react';
import {
  COMPANIES, INTEL, shortId, getToday,
} from './data.jsx';
import { BlueprintCanvas } from './canvas.jsx';
import { IntelPanel, Timeline } from './panels.jsx';
import { TopBar, MetaBar, ScanOverlay, Toast } from './dashboard.jsx';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton,
} from './tweaks-panel.jsx';
import { initStores, useDocsStore, useNodesStore, useObjectsStore, useUIStateStore } from './stores/index.js';
import { LandingPage } from './pages/LandingPage.jsx';
import { CompanySelectorPage } from './pages/CompanySelectorPage.jsx';
import { LeftPanel } from './components/left/LeftPanel.jsx';
import { DocExpandedView } from './components/docs/DocExpandedView.jsx';
import { StandaloneNodeModal } from './components/nodes/StandaloneNodeModal.jsx';
import { buildMetaBarFromCanvas } from './lib/docMetaBar.js';
import {
  buildLaunchDateCanvasNode,
  CANVAS_DOC_CHILD_OFFSET_X,
  collectCanvasNodeIdsForDoc,
  syncContentDocCanvasNodes,
} from './lib/canvasDocSync.js';
import { normalizeDoc } from './lib/normalizeDoc.js';
import { isContentDoc, resolveLinkedProductCategories } from './lib/templateDoc.js';

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

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t.theme);
  if (t.typography === "sans") {
    document.documentElement.style.setProperty("--font-body", "var(--sans)");
    document.documentElement.style.setProperty("--font-display", "var(--sans)");
  } else if (t.typography === "mono") {
    document.documentElement.style.setProperty("--font-body", "var(--mono)");
    document.documentElement.style.setProperty("--font-display", "var(--mono)");
  } else if (t.typography === "mixed") {
    document.documentElement.style.setProperty("--font-body", "var(--sans)");
    document.documentElement.style.setProperty("--font-display", "var(--mono)");
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
  const [intel, setIntel]             = useState([]);
  const [hasScannedBlogs, setBlogs]   = useState(false);
  const [scanState, setScanState]     = useState("idle");
  const [scanLogs, setScanLogs]       = useState([]);
  const [canvasNodes, setCanvasNodes] = useState([]);
  const [canvasConns, setCanvasConns] = useState([]);
  const [selection, setSelection]     = useState([]);
  const [blueprints, setBlueprints]   = useState([]);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const docs = useDocsStore((s) => s.docs);
  const objects = useObjectsStore((s) => s.objects);
  const nodeEntities = useNodesStore((s) => s.nodes);
  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const activeDocMetaDraft = useUIStateStore((s) => s.activeDocMetaDraft);
  const tokenCurrent = 0;
  const tokenMax = 10;

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

  useEffect(() => { initStores(); }, []);

  useEffect(() => {
    const tick = setInterval(() => setToday(getToday()), 60_000);
    return () => clearInterval(tick);
  }, []);

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
    const occupied = [
      ...canvasNodes.map((n) => ({ x: n.x, y: n.y })),
      ...extraOccupied,
    ];
    let x = preferredX ?? 30;
    let y = preferredY ?? 30;
    let guard = 0;
    while (occupied.some((p) => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60) && guard < 80) {
      x += 40;
      if (x > 600) { x = 30; y += 110; }
      guard += 1;
    }
    return { x, y };
  };

  /* ── INSERT ZUSTAND NODE → canvas ─ */
  const insertNodeToCanvas = (zustandNode, options = null) => {
    const preferredX = options?.center ? 320 : options?.x;
    const preferredY = options?.center ? 190 : options?.y;
    const { x, y } = nextCanvasPosition(preferredX, preferredY);
    const newNode = buildCanvasNodeFromEntity(zustandNode, x, y);
    setCanvasNodes((all) => [...all, newNode]);
    setToast({ message: `Node added · "${newNode.title}"`, kind: "ok" });
  };

  const handleInsertForecastNode = ({ title, payload, sourceNode, anchorAt }) => {
    const addNode = useNodesStore.getState().addNode;
    const nodeId = addNode(
      title,
      "text",
      JSON.stringify(payload),
      sourceNode?.parentDocId || null,
      {
        anchorAt: anchorAt || null,
        sourceQuery: title,
      },
    );
    const created = useNodesStore.getState().getNode(nodeId);
    if (created) insertNodeToCanvas(created, { center: true });
  };

  const handleInsertEventNode = ({ title, payload, sourceNode, anchorAt }) => {
    const addNode = useNodesStore.getState().addNode;
    const nodeId = addNode(
      title,
      "text",
      JSON.stringify(payload),
      sourceNode?.parentDocId || null,
      {
        anchorAt: anchorAt || null,
        sourceQuery: title,
      },
    );
    const created = useNodesStore.getState().getNode(nodeId);
    if (created) insertNodeToCanvas(created, { center: true });
  };

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
      content: object.description || object.name || "",
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
      ...(isContentDoc(normalizedDoc)
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

    const launchCanvasNode = isContentDoc(normalizedDoc)
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

  const openDocumentOverlay = (docId) => {
    setExpandedDocId(docId);
  };

  const openCanvasEntity = (noteId, canvasNode = null) => {
    if (!noteId && !canvasNode) return;
    const targetDocId = noteId && docs[noteId] ? noteId : canvasNode?.docId;
    if (targetDocId && docs[targetDocId]) {
      setExpandedNodeId(null);
      setExpandedDocId(targetDocId);
      return;
    }

    if (noteId && nodeEntities[noteId]) {
      setExpandedDocId(null);
      setExpandedNodeId(noteId);
    }
  };

  return (
    <div className="dash">
      <TopBar
        company={company}
        onBack={onBack}
        status="ARMED"
        signal={company.signal}
        scanState={scanState}
        onScan={() => {}}
        onScanBlogs={scanBlogs}
        onPasteUrl={() => {}}
        onAltSeed={null}
      />

      <MetaBar metadata={metaBarMetadata} />

      <div className="dash-main">
        <div className="dash-col">
          <LeftPanel
            onInsertToCanvas={insertNodeToCanvas}
            onOpenDocument={openDocumentOverlay}
            tokenCurrent={tokenCurrent}
            tokenMax={tokenMax}
            onDocumentDeleted={handleDocumentDeleted}
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
            onCreateBlueprint={() => {}}
            onDeleteNode={deleteCanvasNode}
            onEditNode={() => {}}
            onFocusNote={() => {}}
            onOpenNote={openCanvasEntity}
            onRemoveBlueprintFromCanvas={() => {}}
            onCanvasDrop={handleCanvasDrop}
          />
          {scanState === "scanning-blogs" && (
            <ScanOverlay logs={scanLogs} kind="blogs" />
          )}
        </div>

        <div className="dash-col">
          <IntelPanel
            intel={intel}
            addedIds={[]}
            loadingIds={[]}
            onGetOverview={() => {}}
            onScanBlogs={scanBlogs}
            hasScannedBlogs={hasScannedBlogs}
            tokenCurrent={tokenCurrent}
            tokenMax={tokenMax}
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
              docId={expandedDocId}
              onClose={() => setExpandedDocId(null)}
              onNavigateToDoc={setExpandedDocId}
              onInsertToCanvas={insertNodeToCanvas}
              onDocumentDeleted={handleDocumentDeleted}
            />
          </div>
        </div>
      )}
      {expandedNodeId && nodeEntities[expandedNodeId] ? (
        <StandaloneNodeModal
          node={nodeEntities[expandedNodeId]}
          docs={Object.values(docs)}
          queryCanvasNodeId={
            canvasNodes.find((n) => n.noteId === expandedNodeId)?.id ?? null
          }
          onClose={() => setExpandedNodeId(null)}
          onSaved={() => setExpandedNodeId(null)}
          onDeleted={() => setExpandedNodeId(null)}
        />
      ) : null}

      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </div>
  );
}

/* ── APP ROOT ──────────────────────────────────────── */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState("landing");
  const [company, setCompany] = useState(null);
  useEffect(() => { applyTheme(t); }, [t.theme, t.typography, t.accent]);

  return (
    <>
      {screen === "landing" && <LandingPage onStart={() => setScreen("selector")} />}
      {screen === "selector" && (
        <CompanySelectorPage
          onSelect={(c) => { setCompany(c); setScreen("dashboard"); }}
          onBack={() => setScreen("landing")}
        />
      )}
      {screen === "dashboard" && company && (
        <Dashboard company={company} onBack={() => setScreen("selector")} />
      )}

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
          <TweakButton label="Landing"   secondary onClick={() => setScreen("landing")} />
          <TweakButton label="Selector"  secondary onClick={() => setScreen("selector")} />
          <TweakButton label="Dashboard" secondary onClick={() => {
            if (!company) setCompany(COMPANIES[0]);
            setScreen("dashboard");
          }} />
        </div>
      </TweaksPanel>
    </>
  );
}

export default App;
