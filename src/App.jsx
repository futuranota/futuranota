import { useState, useEffect } from 'react';
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
  const docs = useDocsStore((s) => s.docs);
  const objects = useObjectsStore((s) => s.objects);
  const nodeEntities = useNodesStore((s) => s.nodes);
  const filterObjectId = useUIStateStore((s) => s.filterObjectId);

  useEffect(() => { initStores(); }, []);

  useEffect(() => {
    const tick = setInterval(() => setToday(getToday()), 60_000);
    return () => clearInterval(tick);
  }, []);

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

  const nextCanvasPosition = (preferredX, preferredY) => {
    const occupied = canvasNodes.map((n) => ({ x: n.x, y: n.y }));
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
  const insertNodeToCanvas = (zustandNode) => {
    const { x, y } = nextCanvasPosition();
    const newNode = {
      id: shortId("CN"),
      noteId: zustandNode.id,
      title: (zustandNode.title || zustandNode.content || "NODE").toUpperCase().slice(0, 20),
      dataType: zustandNode.type || "text",
      content: zustandNode.content ?? "",
      x, y,
    };
    setCanvasNodes((all) => [...all, newNode]);
    setToast({ message: `Node added · "${newNode.title}"`, kind: "ok" });
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
    const { x, y } = nextCanvasPosition(
      worldX != null ? worldX - 50 : undefined,
      worldY != null ? worldY - 40 : undefined,
    );
    const newNode = {
      id: shortId("CN"),
      canvasKind: "document",
      docId: doc.id,
      noteId: doc.id,
      title: (doc.title || "DOCUMENT").toUpperCase().slice(0, 20),
      dataType: "document",
      content: doc.body || doc.content || "",
      x, y,
    };
    setCanvasNodes((all) => [...all, newNode]);
    setToast({ message: `Document placed · "${doc.title}"`, kind: "ok" });
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
  const deleteCanvasNode = (nodeId) => {
    setCanvasNodes((all) => all.filter((n) => n.id !== nodeId));
    setCanvasConns((cs) => cs.filter((c) => c.from !== nodeId && c.to !== nodeId));
    setBlueprints((bps) => bps.map((bp) => ({
      ...bp,
      nodeIds: (bp.nodeIds || []).filter((id) => id !== nodeId),
    })));
    setSelection((sel) => sel.filter((id) => id !== nodeId));
    setToast({ message: "Removed from canvas", kind: "ok" });
  };

  const openDocumentOverlay = (docId) => {
    setExpandedDocId(docId);
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

      <MetaBar metadata={{}} />

      <div className="dash-main">
        <div className="dash-col">
          <LeftPanel
            onInsertToCanvas={insertNodeToCanvas}
            onOpenDocument={openDocumentOverlay}
            onDocumentDeleted={(docId) => {
              if (expandedDocId === docId) setExpandedDocId(null);
            }}
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
            onCreateBlueprint={() => {}}
            onDeleteNode={deleteCanvasNode}
            onEditNode={() => {}}
            onFocusNote={() => {}}
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
            today={today}
            launchDate={null}
            onSelectDate={(d) => {
              if (!d) return;
              setToday(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
            }}
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
        <div className="doc-overlay-global" onClick={() => setExpandedDocId(null)}>
          <div className="doc-overlay-global-card" onClick={(e) => e.stopPropagation()}>
            <DocExpandedView docId={expandedDocId} onClose={() => setExpandedDocId(null)} />
          </div>
        </div>
      )}

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
