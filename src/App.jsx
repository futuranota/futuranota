import { useState, useEffect, useRef } from 'react';
import {
  COMPANIES, TODAY, CAMPAIGN_VOLTWAY, CAMPAIGN_LUMEN, INTEL, OVERVIEWS,
  BLUEPRINT_COLORS, daysBetween, fmtDate, shortId, defaultOverview, getToday,
} from './data.jsx';
import { BlueprintCanvas } from './canvas.jsx';
import {
  NotesPanel, IntelPanel, Timeline,
} from './panels.jsx';
import { TopBar, MetaBar, ScanOverlay, UrlModal, Toast } from './dashboard.jsx';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton,
} from './tweaks-panel.jsx';
import { initStores } from './stores/index.js';
import { LandingPage } from './pages/LandingPage.jsx';
import { CompanySelectorPage } from './pages/CompanySelectorPage.jsx';
import { FuturaTimeline } from './components/timeline/FuturaTimeline.jsx';

/* app.jsx — root state + orchestration
 *
 * Three-tier model:
 *   notes[]       — source of truth for blueprint content (blueprintId on grouped notes)
 *   nodes[]       — optional canvas instances (noteId, x, y, hidden?)
 *   blueprints[]  — logical groups (noteIds, nodeIds, edges, label, color)
 *   connections[] — node→node edges on canvas
 *   Timeline reads notes + blueprint.edges; canvas delete does not remove timeline.
 */

function buildBlueprintEdges(nodeIds, connections, nodes) {
  const idSet = new Set(nodeIds);
  return connections
    .filter((c) => idSet.has(c.from) && idSet.has(c.to))
    .map((c) => {
      const fromNote = nodes.find((n) => n.id === c.from)?.noteId;
      const toNote = nodes.find((n) => n.id === c.to)?.noteId;
      return fromNote && toNote ? { fromNoteId: fromNote, toNoteId: toNote } : null;
    })
    .filter(Boolean);
}

function edgesKey(edges) {
  return JSON.stringify(
    (edges || []).map((e) => `${e.fromNoteId}->${e.toNoteId}`).sort(),
  );
}

function deriveBlueprintEdges(bp, connections, nodes) {
  const nodeIdSet = new Set(bp.nodeIds || []);
  return connections
    .filter((c) => nodeIdSet.has(c.from) && nodeIdSet.has(c.to))
    .map((c) => {
      const fromNoteId = nodes.find((n) => n.id === c.from)?.noteId;
      const toNoteId = nodes.find((n) => n.id === c.to)?.noteId;
      return fromNoteId && toNoteId ? { fromNoteId, toNoteId } : null;
    })
    .filter(Boolean);
}

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
  const [scanState, setScanState]   = useState("idle");
  const [scanLogs, setScanLogs]     = useState([]);
  const [scanKind, setScanKind]     = useState("campaigns");
  const [showUrl, setShowUrl]       = useState(false);
  const [hasScannedBlogs, setBlogs] = useState(false);
  const [intel, setIntel]           = useState([]);
  const [addedIntel, setAddedIntel] = useState([]);
  const [loadingIntel, setLoading]  = useState([]);
  const [notes, setNotes]           = useState([]);
  const [nodes, setNodes]           = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [connections, setConn]      = useState([]);
  const [selection, setSelection]   = useState([]);
  const [insertedNoteIds, setIns]   = useState([]);
  const [tokens, setTokens]         = useState(0);
  const [metadata, setMeta]         = useState({});
  const [today, setToday]           = useState(() => getToday());
  const [toast, setToast]           = useState(null);
  const [bpNameModal, setBpModal]   = useState(null);
  const [focusedNoteId, setFocusedNoteId] = useState(null);

  const campaign = CAMPAIGN_VOLTWAY;
  const altCampaign = CAMPAIGN_LUMEN;

  useEffect(() => {
    initStores();
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setToday(getToday()), 60_000);
    return () => clearInterval(tick);
  }, []);

  /* Sync blueprint.edges from canvas wires (e.g. starting date → metric → launch) */
  useEffect(() => {
    setBlueprints((bps) => {
      let changed = false;
      const next = bps.map((bp) => {
        if (!(bp.nodeIds || []).length) return bp;
        const edges = deriveBlueprintEdges(bp, connections, nodes);
        if (edgesKey(edges) === edgesKey(bp.edges)) return bp;
        changed = true;
        return { ...bp, edges };
      });
      return changed ? next : bps;
    });
  }, [connections, nodes]);

  /* ── SCAN CAMPAIGNS — produces ONE AI note with entities[] ─ */
  const scanCampaigns = () => {
    setScanState("scanning");
    setScanKind("campaigns");
    setScanLogs([]);

    const steps = [
      { t: 100,  text: "Initializing scan agent…",                  cls: "dim" },
      { t: 380,  text: "Connecting voltway.com/newsroom",           cls: "dim" },
      { t: 700,  text: "✓ Source reachable · 200 OK",               cls: "ok" },
      { t: 1000, text: "Groq fast-classify · 12 docs",              cls: "dim" },
      { t: 1300, text: "  └ press release · 96% confidence",        cls: "ok" },
      { t: 1500, text: "  └ investor brief · 88%",                  cls: "ok" },
      { t: 1700, text: "Gemini deep-analysis · extracting…",        cls: "dim" },
      { t: 2000, text: "  └ launch date: 2026-07-08",               cls: "warm" },
      { t: 2200, text: "  └ 3 products · 8 specs parsed",           cls: "warm" },
      { t: 2400, text: "  └ 7 typed entities ready",                cls: "warm" },
      { t: 2700, text: "✓ Overview ready · click Insert Blueprint", cls: "ok" },
    ];
    steps.forEach((s) => setTimeout(() => setScanLogs((prev) => [...prev, s]), s.t));

    setTimeout(() => {
      const daysUntil = daysBetween(getToday(), campaign.launchDate);
      setMeta({
        campaign: campaign.name,
        campaignSource: campaign.source,
        niche: "Premium EV · accessories",
        brand: campaign.company,
        category: "Aftermarket trim",
        launch: fmtDate(campaign.launchDate),
        window: `T−${daysUntil}d`,
      });

      // Single AI note with entities — user clicks "Insert Blueprint" to expand
      const summary = `${campaign.name} confirmed for ${fmtDate(campaign.launchDate)}.\n\n${campaign.marketGap}\n\nClick "Insert Blueprint" below to split this overview into ${campaign.entities.length} typed notes and group as a Blueprint on the canvas.`;
      const aiNote = {
        id: shortId("NT"),
        kind: "ai",
        cost: 0,
        title: campaign.name + " — campaign overview",
        content: summary,
        source: campaign.source,
        timestamp: "just now",
        entities: campaign.entities,
        meta: { blueprintLabel: campaign.name },
      };
      setNotes((n) => [aiNote, ...n]);
      setScanState("idle");
      setToast({ message: `Campaign overview ready · ${campaign.entities.length} entities detected`, kind: "ai" });
    }, 2900);
  };

  /* ── SCAN BLOGS ─ */
  const scanBlogs = () => {
    setScanState("scanning-blogs");
    setScanKind("blogs");
    setScanLogs([]);
    const steps = [
      { t: 100,  text: "Querying news APIs…",         cls: "dim" },
      { t: 350,  text: "  └ Electrek · 200 OK",       cls: "ok" },
      { t: 550,  text: "  └ InsideEVs · 200 OK",      cls: "ok" },
      { t: 750,  text: "  └ AutoForge · 200 OK",      cls: "ok" },
      { t: 1000, text: "Filtering Voltway mentions…", cls: "dim" },
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

  /* ── GET OVERVIEW (AI) — costs 1 token, injects AI note w/ entities ─ */
  const getOverview = (item) => {
    if (tokens >= 10) { setToast({ message: "No tokens · upgrade", kind: "danger" }); return; }
    setLoading((l) => [...l, item.id]);
    setTimeout(() => {
      const ov = OVERVIEWS[item.id] || defaultOverview(item);
      const note = {
        id: shortId("NT"),
        kind: "ai",
        cost: 1,
        title: item.title,
        content: ov.text,
        source: item.src,
        timestamp: "just now",
        entities: ov.entities,
        meta: { blueprintLabel: item.src + " — " + item.title.slice(0, 30) },
      };
      setNotes((n) => [note, ...n]);
      setTokens((t) => t + 1);
      setAddedIntel((a) => [...a, item.id]);
      setLoading((l) => l.filter((x) => x !== item.id));
      setToast({ message: `AI overview added · −1 token`, kind: "ai" });
    }, 1300);
  };

  /* ── manual notes (free, typed) ─ */
  const saveManualNote = (payload) => {
    const note = {
      id: shortId("NT"),
      kind: "manual",
      title: payload.title,
      dataType: payload.dataType,
      content: payload.content,
      timestamp: "just now",
    };
    setNotes((n) => [note, ...n]);
    setToast({ message: `${payload.dataType} note saved · Free`, kind: "ok" });
  };
  const syncNodesFromNote = (note) => {
    setNodes((ns) => ns.map((n) => {
      if (n.noteId !== note.id) return n;
      return {
        ...n,
        title: (note.title || "NOTE").toUpperCase().slice(0, 20),
        dataType: note.dataType || n.dataType,
        content: note.content,
      };
    }));
  };

  const updateNote = (updated) => {
    setNotes((n) => n.map((x) => x.id === updated.id ? { ...x, ...updated, timestamp: "saved" } : x));
    syncNodesFromNote(updated);
  };

  const onEditNode = (nodeId, edits) => {
    setNodes((ns) => {
      const node = ns.find((n) => n.id === nodeId);
      if (!node?.noteId) return ns.map((n) => n.id === nodeId ? { ...n, ...edits } : n);
      const merged = { ...node, ...edits };
      setNotes((all) => all.map((note) => {
        if (note.id !== node.noteId) return note;
        const next = { ...note, timestamp: "saved" };
        if (edits.title != null) next.title = edits.title;
        if (edits.content != null) next.content = edits.content;
        if (edits.dataType != null) next.dataType = edits.dataType;
        return next;
      }));
      return ns.map((n) => n.id === nodeId ? merged : n);
    });
  };

  /* ── DELETE NOTE — single note; blueprint track stays unless empty ─ */
  const deleteNote = (note) => {
    setNotes((n) => {
      const nextNotes = n.filter((x) => x.id !== note.id);
      setBlueprints((bps) => bps
        .map((bp) => ({
          ...bp,
          noteIds: (bp.noteIds || []).filter((id) => id !== note.id),
          edges: (bp.edges || []).filter(
            (e) => e.fromNoteId !== note.id && e.toNoteId !== note.id,
          ),
        }))
        .filter((bp) => {
          const ids = (bp.noteIds || []).filter((id) => id !== note.id);
          const stillGrouped = nextNotes.some((x) => x.blueprintId === bp.id);
          return ids.length > 0 || stillGrouped;
        }));
      return nextNotes;
    });
    setNodes((ns) => {
      const removed = ns.filter((nn) => nn.noteId === note.id).map((nn) => nn.id);
      setBlueprints((bps) => bps.map((bp) => ({
        ...bp,
        nodeIds: (bp.nodeIds || []).filter((nid) => !removed.includes(nid)),
      })));
      if (removed.length > 0) {
        setConn((cs) => cs.filter((c) => !removed.includes(c.from) && !removed.includes(c.to)));
        setSelection((sel) => sel.filter((id) => !removed.includes(id)));
      }
      return ns.filter((nn) => nn.noteId !== note.id);
    });
    setIns((ids) => ids.filter((id) => id !== note.id));
    if (focusedNoteId === note.id) setFocusedNoteId(null);
    setToast({ message: `Note removed`, kind: "danger" });
  };

  const deleteBlueprint = (bpId) => {
    const bp = blueprints.find((b) => b.id === bpId);
    if (!bp) return;
    const noteIdSet = new Set(bp.noteIds || []);
    const notesInBp = notes.filter((n) => n.blueprintId === bpId);
    notesInBp.forEach((n) => noteIdSet.add(n.id));
    const allNoteIds = [...noteIdSet];

    setNotes((n) => n.filter((note) => !allNoteIds.includes(note.id)));
    setNodes((ns) => {
      const removed = ns.filter((nn) => allNoteIds.includes(nn.noteId)).map((nn) => nn.id);
      setConn((cs) => cs.filter((c) => !removed.includes(c.from) && !removed.includes(c.to)));
      setSelection((sel) => sel.filter((id) => !removed.includes(id)));
      return ns.filter((nn) => !allNoteIds.includes(nn.noteId));
    });
    setBlueprints((bps) => bps.filter((b) => b.id !== bpId));
    setIns((ids) => ids.filter((id) => !allNoteIds.includes(id)));
    if (allNoteIds.includes(focusedNoteId)) setFocusedNoteId(null);
    setToast({ message: `Blueprint "${bp.label}" deleted`, kind: "danger" });
  };

  /* ── INSERT NOTE → single node on canvas ─ */
  const insertNodeFromNote = (note) => {
    const hidden = nodes.find((n) => n.noteId === note.id && n.hidden);
    if (hidden) {
      setNodes((all) => all.map((n) => (
        n.noteId === note.id ? { ...n, hidden: false } : n
      )));
      setToast({ message: `Node restored on canvas · "${hidden.title}"`, kind: "ok" });
      return;
    }

    const dataType = note.dataType || (note.kind === "ai" ? "text" : "text");
    const content = note.dataType ? note.content : note.content;
    const occupied = nodes.filter((n) => !n.hidden).map((n) => ({ x: n.x, y: n.y }));
    let x = 30, y = 30;
    while (occupied.some((p) => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60)) {
      x += 40;
      if (x > 600) { x = 30; y += 110; }
    }
    const newNode = {
      id: shortId("CN"),
      noteId: note.id,
      title: (note.title || "NOTE").toUpperCase().slice(0, 20),
      dataType,
      content,
      x, y,
    };
    setNodes((all) => [...all, newNode]);
    setIns((ids) => [...new Set([...ids, note.id])]);
    setToast({ message: `Node added · "${newNode.title}"`, kind: "ok" });
  };

  /* ── INSERT BLUEPRINT — split AI note into typed notes + nodes + group ─ */
  const insertAsBlueprint = (aiNote) => {
    if (!aiNote.entities || aiNote.entities.length === 0) return;
    const bpColor = BLUEPRINT_COLORS[blueprints.length % BLUEPRINT_COLORS.length];
    const newNotes = [];
    const newNodes = [];
    const bpId = shortId("BP");
    const baseX = 30, baseY = 30;

    aiNote.entities.forEach((ent, i) => {
      // create note (manual-typed but linked to AI source)
      const noteId = shortId("NT");
      const note = {
        id: noteId,
        kind: "manual",
        title: ent.title,
        dataType: ent.dataType,
        content: ent.content,
        source: aiNote.source,
        derivedFromAi: aiNote.id,
        blueprintId: bpId,
        timestamp: "auto",
      };
      newNotes.push(note);

      // pretty layout: 2 columns
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = baseX + col * 220;
      const y = baseY + row * 120;

      newNodes.push({
        id: shortId("CN"),
        noteId,
        title: ent.title.toUpperCase().slice(0, 20),
        dataType: ent.dataType,
        content: ent.content,
        x, y,
      });
    });

    // assemble connections — chain through date and metric nodes if any
    const dateNodes = newNodes.filter((n) => n.dataType === "date");
    const metricNodes = newNodes.filter((n) => n.dataType === "metric");
    const newConns = [];
    if (dateNodes.length >= 2 && metricNodes.length >= 1) {
      // d1 → metric → d2 chain (first metric used as bridge)
      const bridge = metricNodes[0];
      newConns.push({ id: shortId("CN"), from: dateNodes[0].id, to: bridge.id });
      newConns.push({ id: shortId("CN"), from: bridge.id, to: dateNodes[1].id });
    } else if (dateNodes.length >= 2) {
      // direct chain
      for (let i = 0; i < dateNodes.length - 1; i++) {
        newConns.push({ id: shortId("CN"), from: dateNodes[i].id, to: dateNodes[i + 1].id });
      }
    }

    const noteIds = newNotes.map((n) => n.id);
    const edges = buildBlueprintEdges(newNodes.map((n) => n.id), newConns, newNodes);

    setNotes((all) => [...newNotes, ...all]);
    setNodes((all) => [...all, ...newNodes]);
    setConn((cs) => [...cs, ...newConns]);
    setBlueprints((bps) => [...bps, {
      id: bpId,
      label: aiNote.meta?.blueprintLabel || aiNote.title || "Blueprint",
      noteIds,
      nodeIds: newNodes.map((n) => n.id),
      edges,
      color: bpColor,
      sourceNoteId: aiNote.id,
    }]);
    setIns((ids) => [...new Set([...ids, aiNote.id])]);
    setToast({ message: `Blueprint "${aiNote.meta?.blueprintLabel || aiNote.title}" created · ${newNodes.length} nodes`, kind: "ai" });
  };

  /* ── CREATE BLUEPRINT from current selection ─ */
  const createBlueprintFromSelection = () => {
    if (selection.length === 0) return;
    setBpModal({ defaultName: `Blueprint ${blueprints.length + 1}`, nodeIds: [...selection] });
  };

  const confirmCreateBlueprint = (label) => {
    if (!bpNameModal) return;
    const bpId = shortId("BP");
    const bpColor = BLUEPRINT_COLORS[blueprints.length % BLUEPRINT_COLORS.length];
    const labelFinal = (label || bpNameModal.defaultName || "Blueprint").trim();
    const linkedNoteIds = [];
    const newNotes = [];
    const nodeNotePatches = [];

    bpNameModal.nodeIds.forEach((nid) => {
      const node = nodes.find((n) => n.id === nid);
      if (!node) return;
      if (node.noteId) {
        linkedNoteIds.push(node.noteId);
      } else {
        const noteId = shortId("NT");
        linkedNoteIds.push(noteId);
        newNotes.push({
          id: noteId,
          kind: "manual",
          title: node.title || "Note",
          dataType: node.dataType || "text",
          content: node.content ?? "",
          blueprintId: bpId,
          timestamp: "from canvas",
        });
        nodeNotePatches.push({ nodeId: nid, noteId });
      }
    });

    const edges = buildBlueprintEdges(bpNameModal.nodeIds, connections, nodes);
    setBlueprints((bps) => [...bps, {
      id: bpId,
      label: labelFinal,
      noteIds: linkedNoteIds,
      nodeIds: bpNameModal.nodeIds,
      edges,
      color: bpColor,
    }]);
    setNotes((all) => [
      ...newNotes,
      ...all.map((note) => (
        linkedNoteIds.includes(note.id) ? { ...note, blueprintId: bpId } : note
      )),
    ]);
    if (nodeNotePatches.length) {
      setNodes((all) => all.map((n) => {
        const patch = nodeNotePatches.find((p) => p.nodeId === n.id);
        return patch ? { ...n, noteId: patch.noteId } : n;
      }));
    }
    setSelection([]);
    setBpModal(null);
    if (linkedNoteIds[0]) setFocusedNoteId(linkedNoteIds[0]);
    setToast({ message: `Blueprint "${labelFinal}" added to Notes · ${bpNameModal.nodeIds.length} nodes`, kind: "ok" });
  };

  const deleteNodeCascade = (nodeId) => {
    setNodes((all) => all.filter((n) => n.id !== nodeId));
    setConn((cs) => cs.filter((c) => c.from !== nodeId && c.to !== nodeId));
    setBlueprints((bps) => bps.map((bp) => ({
      ...bp,
      nodeIds: (bp.nodeIds || []).filter((id) => id !== nodeId),
    })));
    setSelection((sel) => sel.filter((id) => id !== nodeId));
    setToast({ message: "Removed from canvas · timeline unchanged", kind: "ok" });
  };

  const restoreBlueprintToCanvas = (bp) => {
    const bpNotes = notes.filter((n) => n.blueprintId === bp.id || (bp.noteIds || []).includes(n.id));
    if (bpNotes.length === 0) return;

    const existingByNote = new Map();
    nodes.forEach((n) => {
      if (n.noteId) existingByNote.set(n.noteId, n);
    });

    const newNodes = [];
    const noteIdToNodeId = {};
    let baseX = 30;
    let baseY = 30;

    bpNotes.forEach((note, i) => {
      const existing = existingByNote.get(note.id);
      if (existing && !existing.hidden) {
        noteIdToNodeId[note.id] = existing.id;
        return;
      }
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = baseX + col * 220;
      const y = baseY + row * 120;
      const node = {
        id: shortId("CN"),
        noteId: note.id,
        title: (note.title || "NOTE").toUpperCase().slice(0, 20),
        dataType: note.dataType || "text",
        content: note.content,
        x, y,
      };
      newNodes.push(node);
      noteIdToNodeId[note.id] = node.id;
      setIns((ids) => [...new Set([...ids, note.id])]);
    });

    const newConns = [];
    (bp.edges || []).forEach((e) => {
      const fromId = noteIdToNodeId[e.fromNoteId];
      const toId = noteIdToNodeId[e.toNoteId];
      if (fromId && toId) {
        const exists = connections.some((c) => c.from === fromId && c.to === toId);
        if (!exists) newConns.push({ id: shortId("CN"), from: fromId, to: toId });
      }
    });

    const allNewNodeIds = Object.values(noteIdToNodeId);
    setNodes((all) => [...all, ...newNodes]);
    setConn((cs) => [...cs, ...newConns]);
    setBlueprints((bps) => bps.map((b) => (
      b.id === bp.id ? { ...b, nodeIds: [...new Set([...(b.nodeIds || []), ...allNewNodeIds])] } : b
    )));
    setToast({ message: `Blueprint "${bp.label}" placed on canvas`, kind: "ok" });
  };

  /** True when this note already has a visible node on the canvas (hides «Add node»). */
  const hasVisibleCanvasNode = (noteId) =>
    nodes.some((n) => n.noteId === noteId && !n.hidden);

  const blueprintOnCanvas = (bp) =>
    (bp.nodeIds || []).some((nid) => nodes.some((n) => n.id === nid))
    || notes.filter((n) => n.blueprintId === bp.id).some((n) => hasVisibleCanvasNode(n.id));

  const removeBlueprintFromCanvas = (bp) => {
    const nodeIds = new Set(bp.nodeIds || []);
    nodes.forEach((n) => {
      if (n.noteId && notes.some((note) => note.blueprintId === bp.id && note.id === n.noteId)) {
        nodeIds.add(n.id);
      }
    });
    if (nodeIds.size === 0) return;
    setNodes((all) => all.filter((n) => !nodeIds.has(n.id)));
    setConn((cs) => cs.filter((c) => !nodeIds.has(c.from) && !nodeIds.has(c.to)));
    setBlueprints((bps) => bps.map((b) => (
      b.id === bp.id ? { ...b, nodeIds: [] } : b
    )));
    setSelection((sel) => sel.filter((id) => !nodeIds.has(id)));
    setToast({ message: `Blueprint "${bp.label}" removed from canvas · notes kept`, kind: "ok" });
  };

  /* ── URL paste flow ─ */
  const handleUrlAccept = (extracted) => {
    setShowUrl(false);
    if (tokens >= 10) { setToast({ message: "No tokens · upgrade", kind: "danger" }); return; }
    const note = {
      id: shortId("NT"),
      kind: "ai",
      cost: 1,
      title: extracted.title,
      content: extracted.summary,
      source: extracted.source,
      timestamp: "just now",
      entities: extracted.entities,
      meta: { blueprintLabel: extracted.source + " — extract" },
    };
    setNotes((n) => [note, ...n]);
    setTokens((t) => t + 1);
    setToast({ message: "URL extracted · −1 token", kind: "ai" });
  };

  /* ── seed an alt blueprint (demo) ─ */
  const seedAltBlueprint = () => {
    const alt = altCampaign;
    const fakeNote = {
      id: shortId("NT"),
      kind: "ai", cost: 0,
      title: alt.name + " — overview",
      content: `${alt.name} · ${alt.marketGap}`,
      source: alt.source,
      timestamp: "demo",
      entities: alt.entities,
      meta: { blueprintLabel: alt.name },
    };
    setNotes((n) => [fakeNote, ...n]);
    setTimeout(() => insertAsBlueprint(fakeNote), 100);
  };

  const manualCount = notes.filter((n) => n.kind !== "ai").length;
  const aiCount     = notes.filter((n) => n.kind === "ai").length;

  return (
    <div className="dash">
      <TopBar
        company={company}
        onBack={onBack}
        status={metadata.campaign ? "TRACKING" : "ARMED"}
        signal={company.signal}
        scanState={scanState}
        onScan={scanCampaigns}
        onScanBlogs={scanBlogs}
        onPasteUrl={() => setShowUrl(true)}
        onAltSeed={blueprints.length === 1 ? seedAltBlueprint : null}
      />

      <MetaBar metadata={metadata} />

      <div className="dash-main">
        <div className="dash-col">
          <NotesPanel
            notes={notes}
            blueprints={blueprints}
            today={today}
            hasVisibleCanvasNode={hasVisibleCanvasNode}
            focusedNoteId={focusedNoteId}
            onFocusNote={setFocusedNoteId}
            onSaveManual={saveManualNote}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            onDeleteBlueprint={deleteBlueprint}
            onRestoreBlueprint={restoreBlueprintToCanvas}
            onRemoveBlueprintFromCanvas={removeBlueprintFromCanvas}
            blueprintOnCanvas={blueprintOnCanvas}
            onInsertNode={insertNodeFromNote}
            onInsertBlueprint={insertAsBlueprint}
            tokens={tokens}
            manualCount={manualCount}
            aiCount={aiCount}
          />
        </div>

        <div className="dash-col canvas-col">
          <BlueprintCanvas
            nodes={nodes}
            setNodes={setNodes}
            connections={connections}
            setConnections={setConn}
            blueprints={blueprints}
            setBlueprints={setBlueprints}
            selection={selection}
            setSelection={setSelection}
            today={today}
            onCreateBlueprint={createBlueprintFromSelection}
            onDeleteNode={deleteNodeCascade}
            onEditNode={onEditNode}
            onFocusNote={(noteId) => noteId && setFocusedNoteId(noteId)}
            onRemoveBlueprintFromCanvas={removeBlueprintFromCanvas}
          />
          {(scanState === "scanning" || scanState === "scanning-blogs") && (
            <ScanOverlay logs={scanLogs} kind={scanKind} />
          )}
        </div>

        <div className="dash-col">
          <IntelPanel
            intel={intel}
            addedIds={addedIntel}
            loadingIds={loadingIntel}
            onGetOverview={getOverview}
            onScanBlogs={scanBlogs}
            hasScannedBlogs={hasScannedBlogs}
            today={today}
            launchDate={metadata.campaign ? campaign.launchDate : null}
            onSelectDate={(d) => setToast({ message: `Selected · ${fmtDate(d, "short")}`, kind: "ok" })}
          />
        </div>
      </div>

      <Timeline
        blueprints={blueprints}
        notes={notes}
        nodes={nodes}
        today={today}
        focusedNoteId={focusedNoteId}
        onFocusNote={setFocusedNoteId}
      />

      <FuturaTimeline />

      {showUrl && <UrlModal onAccept={handleUrlAccept} onClose={() => setShowUrl(false)} />}
      {bpNameModal && (
        <BlueprintNameModal
          defaultName={bpNameModal.defaultName}
          nodeCount={bpNameModal.nodeIds.length}
          onConfirm={confirmCreateBlueprint}
          onCancel={() => setBpModal(null)}
        />
      )}
      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </div>
  );
}

/* ── BlueprintNameModal ─────────────── */
function BlueprintNameModal({ defaultName, nodeCount, onConfirm, onCancel }) {
  const [name, setName] = useState(defaultName);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>Create blueprint</h3>
          <button className="btn xs ghost" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: "0 0 12px", color: "var(--text-2)", fontSize: 12.5 }}>
            Group {nodeCount} selected node{nodeCount > 1 ? "s" : ""} into a logical blueprint. Date nodes inside will draw a timeline track.
          </p>
          <div className="field" style={{ marginBottom: 14 }}>
            <input
              ref={ref}
              placeholder="Blueprint name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onConfirm(name); if (e.key === "Escape") onCancel(); }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
            <button className="btn primary" onClick={() => onConfirm(name)}>Create blueprint</button>
          </div>
        </div>
      </div>
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
