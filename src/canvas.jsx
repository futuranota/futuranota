import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { daysBetween, fmtDate, shortId } from './data.jsx';
import {
  parseDate,
  computeMetricValue,
  computeEdgeTemporalLabel,
  bezierMidpoint,
  bezierPointAtArcOffset,
} from './temporal.js';
import { formatScheduleLabelFromIso } from './lib/nodeAnchor.js';
import { resolveConnectionLinkColor } from './lib/docNodeLinkColors.js';
import { hasCanvasDrag, readCanvasDragData } from './lib/canvasDrag.js';
import { isContentDoc, resolveLinkedProductCategories } from './lib/templateDoc.js';
/* canvas.jsx — Blueprint Canvas v3
 *
 * Notes ↔ Nodes ↔ Blueprints. Three-tier model:
 *   - Node has dataType ∈ {text, date, metric} (no 'company')
 *   - Multi-select: tap nodes to add/remove; tap empty canvas to clear
 *   - "Create Blueprint" groups selected nodes (logical folder + colored frame)
 *   - "Metric bridge" — a metric node connected to two date nodes auto-computes day-diff
 *   - "Clear canvas" hides nodes (keeps data + blueprints intact)
 */

function Icon({ name, size = 14 }) {
  const paths = {
    select:  <path d="M3 3l5 14 2-6 6-2L3 3z" />,
    pencil:  <path d="M2 14l8.5-8.5 3 3L5 17H2v-3zm9.5-9.5l2-2 3 3-2 2-3-3z" />,
    ruler:   <path d="M2 6h16v6H2V6zm2 0v3m3-3v2m3-2v3m3-3v2m3-2v3" stroke="currentColor" strokeWidth="1.2" fill="none" />,
    eraser:  <path d="M3 14l8-8 5 5-8 8H4l-1-1zm5-1l5-5" stroke="currentColor" strokeWidth="1.4" fill="none" />,
    text:    <path d="M4 4h12v3M10 4v12M7 16h6" stroke="currentColor" strokeWidth="1.4" fill="none" />,
    clear:   <path d="M5 6h10l-1 11H6L5 6zm3-3h4l1 2H7l1-2z" stroke="currentColor" strokeWidth="1.2" fill="none" />,
    download:<path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15h12" stroke="currentColor" strokeWidth="1.4" fill="none" />,
    group:   <path d="M3 6h6v3M11 6h6v8H8V9" stroke="currentColor" strokeWidth="1.4" fill="none" />,
    show:    <path d="M10 5C5 5 2 10 2 10s3 5 8 5 8-5 8-5-3-5-8-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" stroke="currentColor" strokeWidth="1.2" fill="none" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      {paths[name]}
    </svg>
  );
}

const PENCIL_COLORS = [
  { name: "mint",   value: "#8ee9a3" },
  { name: "blue",   value: "#7aa8ff" },
  { name: "amber",  value: "#ffc56b" },
  { name: "white",  value: "#e6e9ee" },
  { name: "red",    value: "#ff7a85" },
];

const UNITS = [
  { id: "px", label: "px", factor: 1 },
  { id: "mm", label: "mm", factor: 0.264 },
  { id: "cm", label: "cm", factor: 0.0264 },
  { id: "in", label: "in", factor: 0.0104 },
];

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const CONN_ATOM_ICON = "/uploads/botones/Atom.svg";
const CONN_ATOM_SIZE = 23;
const CONN_ATOM_MIN_OFFSET = 22;
const CONN_ATOM_LIFT = 22;

function ConnLabel({ x, y, text, pending }) {
  const cls = pending ? "conn-label pending" : "conn-label";
  const w = Math.max(28, text.length * 6.5 + 14);
  return (
    <g className={cls} transform={`translate(${x}, ${y})`}>
      <rect x={-w / 2} y={-9} width={w} height={18} rx={4} />
      <text textAnchor="middle" dominantBaseline="central">{text}</text>
    </g>
  );
}

function ConnAtomMarker({ x, y }) {
  const half = CONN_ATOM_SIZE / 2;
  return (
    <g className="conn-atom" transform={`translate(${x - half}, ${y - half - CONN_ATOM_LIFT})`}>
      <image
        href={CONN_ATOM_ICON}
        width={CONN_ATOM_SIZE}
        height={CONN_ATOM_SIZE}
        aria-hidden
      />
    </g>
  );
}

function isDocAssignedCanvasNode(canvasNode, nodeEntitiesById = {}) {
  if (!canvasNode?.noteId) return false;
  const entity = nodeEntitiesById[canvasNode.noteId];
  if (!entity) return false;
  return Boolean(entity.parentDocId || entity.linkedToDoc);
}

function resolveConnAtomPlacement(fromNode, toNode, p1, p2, nodeEntitiesById = {}) {
  const fromAssigned = isDocAssignedCanvasNode(fromNode, nodeEntitiesById);
  const toAssigned = isDocAssignedCanvasNode(toNode, nodeEntitiesById);
  if (!fromAssigned && !toAssigned) return null;

  if (fromAssigned) {
    return bezierPointAtArcOffset(p1, p2, CONN_ATOM_MIN_OFFSET, { fromEnd: false });
  }

  return bezierPointAtArcOffset(p1, p2, CONN_ATOM_MIN_OFFSET, { fromEnd: true });
}

/* ─── CANVAS NODE ──────────────────────────────────────────── */

function resolveCanvasNodeAnchor(node, nodeEntitiesById = {}) {
  const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
  return parseDate(node.anchorAt) || parseDate(entity?.anchorAt);
}

function resolveCanvasDisplayTitle(node, nodeEntitiesById = {}) {
  const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
  return (entity?.sourceQuery || entity?.title || node.title || "Untitled").trim();
}

function resolveCanvasParentDocTag(node, nodeEntitiesById = {}, docsById = {}) {
  const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
  if (!entity?.parentDocId) return null;
  const doc = docsById[entity.parentDocId];
  return {
    kind: "Document",
    name: (doc?.title || "Untitled").trim(),
  };
}

function resolveCanvasDocTitle(node, docsById = {}) {
  const docId = node.docId || node.noteId;
  const doc = docId ? docsById[docId] : null;
  return (doc?.title || node.title || "Untitled").trim();
}

function resolveCanvasParentObjectTag(node, docsById = {}, objectsById = {}) {
  const docId = node.docId || node.noteId;
  const doc = docId ? docsById[docId] : null;
  if (!doc?.parentObjectId) return null;
  const obj = objectsById[doc.parentObjectId];
  return {
    kind: "Object",
    name: (obj?.name || "Untitled").trim(),
  };
}

function resolveCanvasDocumentTag(node, docsById = {}, objectsById = {}) {
  const docId = node.docId || node.noteId;
  const doc = docId ? docsById[docId] : null;
  if (!doc) return null;

  if (isContentDoc(doc)) {
    const categories = node.linkedProductCategories?.length
      ? node.linkedProductCategories
      : resolveLinkedProductCategories(docsById, doc.subcategoryDocIds);
    if (categories.length) {
      return {
        kind: "Product",
        name: categories.join(", "),
      };
    }
  }

  return resolveCanvasParentObjectTag(node, docsById, objectsById);
}

function CanvasNodeTags({ parentTag, scheduleLabel, parentTitle = "Parent" }) {
  if (!parentTag && !scheduleLabel) return null;
  return (
    <div className="cnode-v cnode-v--compact">
      <div className="cnode-tags">
        {parentTag ? (
          <span className="cnode-parent-tag" title={parentTitle}>
            <span className="cnode-parent-tag__kind">{parentTag.kind}</span>
            <span className="cnode-parent-tag__name">{parentTag.name}</span>
          </span>
        ) : null}
        {scheduleLabel ? (
          <span className="cnode-anchor-date" title="Scheduled date">
            {scheduleLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function startCanvasMarquee(getWorldFromClient, setMarqueeRect, marqueeDrag, clientX, clientY) {
  const p = getWorldFromClient(clientX, clientY);
  marqueeDrag.current = { x: p.x, y: p.y };
  setMarqueeRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
}

function CanvasNode({
  node, today, selected, connectingFrom, isConnectingFrom, rewiring, blueprintColor,
  allNodes, allConnections,
  selectedConnectionId, connections,
  nodeEntitiesById = {},
  docsById = {},
  objectsById = {},
  onAddToSelection, onTapToggle, onMove, onEdit, onDelete, onStartConnect, onPortMouseUp,
  onConnectHover, onStartRewire, getWorldFromClient, onOpen,
}) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(null); // 'title' | 'content' | null
  const TAP_THRESHOLD = 5;

  const selConn = selectedConnectionId
    ? connections.find((c) => c.id === selectedConnectionId)
    : null;

  const onPointerDown = (e) => {
    if (e.target.closest('.cnode-port') || e.target.closest('.cnode-del')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const wasSelected = selected;
    if (!wasSelected) onAddToSelection(node.id);

    const world = getWorldFromClient(e.clientX, e.clientY);
    const offX = world.x - node.x;
    const offY = world.y - node.y;
    const move = (ev) => {
      const w = getWorldFromClient(ev.clientX, ev.clientY);
      onMove(node.id, w.x - offX, w.y - offY);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist < TAP_THRESHOLD && wasSelected) onTapToggle(node.id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const renderContent = () => {
    if (editing === "content") {
      if (node.dataType === "text") {
        return (
          <textarea
            autoFocus
            defaultValue={String(node.content || "")}
            onBlur={(e) => { setEditing(null); onEdit(node.id, { content: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }}
          />
        );
      }
      if (node.dataType === "date") {
        const d = parseDate(node.content);
        const iso = d ? fmtDate(d, "iso") : "";
        return (
          <input
            type="date"
            autoFocus
            defaultValue={iso}
            onBlur={(e) => {
              setEditing(null);
              const parsed = new Date(e.target.value);
              if (!isNaN(parsed)) onEdit(node.id, { content: e.target.value });
            }}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter") e.target.blur(); }}
            style={{ background: "var(--panel-3)", border: "1px solid var(--glass-border-2)", borderRadius: 4, padding: "3px 6px" }}
          />
        );
      }
      if (node.dataType === "metric") {
        const v = (node.content && node.content.value != null) ? node.content.value : "";
        const u = (node.content && node.content.unit) || "";
        return (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              autoFocus
              defaultValue={v}
              onBlur={(e) => {
                const num = Number(e.target.value);
                onEdit(node.id, { content: { value: isNaN(num) ? e.target.value : num, unit: u } });
                setEditing(null);
              }}
              onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter") e.target.blur(); }}
              style={{ flex: 1, background: "var(--panel-3)", border: "1px solid var(--glass-border-2)", borderRadius: 4, padding: "3px 6px" }}
            />
            <input
              type="text"
              placeholder="unit"
              defaultValue={u}
              onBlur={(e) => {
                onEdit(node.id, { content: { value: (node.content && node.content.value != null) ? node.content.value : "", unit: e.target.value } });
              }}
              style={{ width: 50, background: "var(--panel-3)", border: "1px solid var(--glass-border-2)", borderRadius: 4, padding: "3px 6px" }}
            />
          </div>
        );
      }
    }

    // VIEW MODE
    if (node.dataType === "object") {
      return (
        <div className="cnode-v cnode-object-ref">
          <img src="/uploads/cube-m.png" alt="" className="cnode-object-img" draggable={false} />
          {node.content ? (
            <p className="cnode-object-desc">{String(node.content)}</p>
          ) : null}
        </div>
      );
    }
    if (node.dataType === "document") {
      const parentTag = resolveCanvasDocumentTag(node, docsById, objectsById);
      return (
        <CanvasNodeTags
          parentTag={parentTag}
          parentTitle="Linked product"
        />
      );
    }
    if (node.dataType === "text") {
      const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
      const anchorIso = entity?.anchorAt || node.anchorAt;
      const scheduleLabel = anchorIso ? formatScheduleLabelFromIso(anchorIso) : "";
      const parentTag = resolveCanvasParentDocTag(node, nodeEntitiesById, docsById);
      return (
        <CanvasNodeTags
          parentTag={parentTag}
          scheduleLabel={scheduleLabel}
          parentTitle="Parent document"
        />
      );
    }
    if (node.dataType === "checkbox") {
      const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
      const checked = entity
        ? Boolean(entity.content)
        : Boolean(node.content);
      const anchorIso = entity?.anchorAt || node.anchorAt;
      const scheduleLabel = anchorIso ? formatScheduleLabelFromIso(anchorIso) : "";
      return (
        <div className="cnode-v cnode-v--with-anchor">
          <span className="cnode-v__main">{checked ? "☑" : "☐"}</span>
          {scheduleLabel ? (
            <span className="cnode-anchor-date" title="Scheduled date">
              {scheduleLabel}
            </span>
          ) : null}
        </div>
      );
    }
    if (node.dataType === "date") {
      const d = parseDate(node.content);
      const countdown = d ? daysBetween(today, d) : null;
      return (
        <div className="cnode-v">
          <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>
            {d ? fmtDate(d) : <span style={{ color: "var(--mute)" }}>(no date)</span>}
          </div>
          {countdown != null && (
            <div style={{
              fontFamily: "var(--mono)", fontSize: 11, marginTop: 3,
              color: countdown > 0 ? "var(--warm)" : countdown < 0 ? "var(--dim)" : "var(--hud)",
            }}>
              {countdown > 0 ? `T−${countdown}d` : countdown < 0 ? `T+${-countdown}d` : "TODAY"}
            </div>
          )}
        </div>
      );
    }
    if (node.dataType === "metric") {
      const { value, unit, bridged } = computeMetricValue(node, allNodes, allConnections, today);
      return (
        <div className="cnode-v metric">
          {String(value)}<span className="unit">{unit}</span>
          {bridged && <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--accent)", marginTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>bridge</div>}
        </div>
      );
    }
    return null;
  };

  const displayTitle = node.dataType === "text"
    ? resolveCanvasDisplayTitle(node, nodeEntitiesById)
    : node.dataType === "document"
      ? resolveCanvasDocTitle(node, docsById)
      : node.title;

  const cls = ["cnode"];
  if (selected) cls.push("selected");
  if (connectingFrom === node.id) cls.push("connect-source");
  if (node.hidden) cls.push("hidden");
  if (node.dataType === "text" || node.dataType === "document") cls.push("cnode--card-compact");

  if (blueprintColor) cls.push("cnode-in-bp");

  return (
    <div
      ref={ref}
      className={cls.join(" ")}
      data-id={node.id}
      style={{
        left: node.x,
        top: node.y,
        "--bp-accent": blueprintColor?.stroke,
        display: node.hidden ? "none" : undefined,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen?.(node.id);
      }}
      onMouseEnter={() => { if (isConnectingFrom && isConnectingFrom !== node.id) onConnectHover?.(node.id); }}
      onMouseLeave={() => onConnectHover?.(null)}
      onMouseUp={(e) => { if (isConnectingFrom && isConnectingFrom !== node.id) onPortMouseUp(node.id); }}
    >
      <div className="cnode-h">
        {editing === "title" ? (
          <input
            className="cnode-k"
            autoFocus
            defaultValue={node.title}
            style={{ background: "transparent", border: "none", padding: 0 }}
            onBlur={(e) => { setEditing(null); onEdit(node.id, { title: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter") e.target.blur(); }}
          />
        ) : (
          <span className="cnode-k" title={displayTitle}>
            {displayTitle}
          </span>
        )}
        <span className="cnode-type" data-t={node.dataType}>{node.dataType}</span>
      </div>
      {renderContent()}
      {blueprintColor && (
        <div className="cnode-foot">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <i style={{ width: 6, height: 6, borderRadius: 50, background: blueprintColor.stroke, display: "inline-block" }} />
            {blueprintColor.label}
          </span>
          <span style={{ fontFamily: "var(--mono)" }}>{node.id}</span>
        </div>
      )}
      <div
        className={"cnode-port left" + (selConn && selConn.to === node.id ? " rewire-end" : "")}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (selConn && selConn.to === node.id) onStartRewire(selConn.id, "to");
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (rewiring?.end === "to") onPortMouseUp(node.id);
          else if (isConnectingFrom) onPortMouseUp(node.id);
        }}
      />
      <div
        className={"cnode-port right" + (selConn && selConn.from === node.id ? " rewire-end" : "")}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (selConn && selConn.from === node.id) onStartRewire(selConn.id, "from");
          else onStartConnect(node.id);
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (rewiring?.end === "from") onPortMouseUp(node.id);
        }}
      />
      <button type="button" className="cnode-del icon-del-btn" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}>×</button>
    </div>
  );
}

/* ─── BLUEPRINT CANVAS ────────────────────────────────────── */

function BlueprintCanvas({
  nodes, setNodes, connections, setConnections,
  blueprints, setBlueprints, selection, setSelection,
  today, onInsertToTimeline, onDeleteNode, onEditNode, onFocusNote,
  onOpenNote,
  onRemoveBlueprintFromCanvas, onCanvasDrop,
  docsById = {}, nodeEntitiesById = {}, objectsById = {},
}) {
  const temporalMeta = { docsById, nodeEntitiesById };
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#8ee9a3");
  const [size, setSize] = useState(2);
  const [unit, setUnit] = useState("mm");

  const [strokes, setStrokes] = useState([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
  const [drawing, setDrawing] = useState(null);
  const [rulerPt1, setRulerPt1] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [hoverConnect, setHoverConnect] = useState(null);
  const [connectHoverTarget, setConnectHoverTarget] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [marqueeRect, setMarqueeRect] = useState(null); // {x1,y1,x2,y2} in world coords
  const [rewiring, setRewiring] = useState(null); // { connId, end: 'from'|'to' }
  const [view, setView] = useState({ scale: 1, panX: 0, panY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(null);
  const panDrag = useRef(null);
  const PAN_CLICK_THRESHOLD = 5;
  const marqueeDrag = useRef(null);

  const getWorldFromClient = useCallback((clientX, clientY) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: (clientX - r.left - view.panX) / view.scale,
      y: (clientY - r.top - view.panY) / view.scale,
    };
  }, [view]);

  const handleCanvasDragOver = useCallback((e) => {
    if (!onCanvasDrop || !hasCanvasDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, [onCanvasDrop]);

  const handleCanvasDrop = useCallback((e) => {
    if (!onCanvasDrop) return;
    const payload = readCanvasDragData(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    e.stopPropagation();
    onCanvasDrop(payload, getWorldFromClient(e.clientX, e.clientY));
  }, [onCanvasDrop, getWorldFromClient]);

  const zoomAt = useCallback((clientX, clientY, delta) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const factor = delta > 0 ? 0.9 : 1.1;
    setView((v) => {
      const nextScale = clampScale(v.scale * factor);
      const wx = (clientX - r.left - v.panX) / v.scale;
      const wy = (clientY - r.top - v.panY) / v.scale;
      return {
        scale: nextScale,
        panX: clientX - r.left - wx * nextScale,
        panY: clientY - r.top - wy * nextScale,
      };
    });
  }, []);

  // map node.id → blueprint color
  const blueprintByNodeId = useMemo(() => {
    const m = {};
    blueprints.forEach((bp) => {
      bp.nodeIds.forEach((nid) => {
        m[nid] = { ...bp.color, label: bp.label, id: bp.id };
      });
    });
    return m;
  }, [blueprints]);

  /* canvas sizing */
  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    c.style.width = rect.width + "px";
    c.style.height = rect.height + "px";
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }, []);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const w = c.width / (window.devicePixelRatio || 1);
    const h = c.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const drawStroke = (s, idx = -1) => {
      if (s.kind === "path") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (s.kind === "measure") {
        ctx.strokeStyle = "#ffc56b";
        ctx.fillStyle = "#ffc56b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.p1.x, s.p1.y);
        ctx.lineTo(s.p2.x, s.p2.y);
        ctx.stroke();
        const ang = Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x);
        const perp = ang + Math.PI / 2;
        const drawCap = (p) => {
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(perp) * 5, p.y + Math.sin(perp) * 5);
          ctx.lineTo(p.x - Math.cos(perp) * 5, p.y - Math.sin(perp) * 5);
          ctx.stroke();
        };
        drawCap(s.p1); drawCap(s.p2);
        const dx = s.p2.x - s.p1.x, dy = s.p2.y - s.p1.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const uDef = UNITS.find((x) => x.id === s.unit) || UNITS[0];
        const distU = (distPx * uDef.factor).toFixed(uDef.id === "px" ? 0 : 1);
        const mx = (s.p1.x + s.p2.x) / 2, my = (s.p1.y + s.p2.y) / 2;
        ctx.font = '500 11px "Geist Mono", "JetBrains Mono", monospace';
        const txt = `${distU} ${uDef.label}`;
        const m = ctx.measureText(txt);
        const padX = 6, padY = 4, bw = m.width + padX * 2, bh = 18;
        ctx.fillStyle = "rgba(20,24,30,0.95)";
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(mx - bw/2, my - bh/2, bw, bh, 4) : ctx.rect(mx - bw/2, my - bh/2, bw, bh);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,197,107,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#ffc56b";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillText(txt, mx, my);
      } else if (s.kind === "text") {
        ctx.fillStyle = s.color || "#e6e9ee";
        ctx.font = '500 13px "Geist", "Inter", sans-serif';
        ctx.textBaseline = "top";
        ctx.fillText(s.text, s.x, s.y);
      }

      if (idx >= 0 && selectedStrokeIds.includes(idx)) {
        let bounds = null;
        if (s.kind === "path" && s.points?.length) {
          const xs = s.points.map((p) => p.x);
          const ys = s.points.map((p) => p.y);
          bounds = {
            left: Math.min(...xs) - 6,
            top: Math.min(...ys) - 6,
            right: Math.max(...xs) + 6,
            bottom: Math.max(...ys) + 6,
          };
        } else if (s.kind === "measure") {
          bounds = {
            left: Math.min(s.p1.x, s.p2.x) - 8,
            top: Math.min(s.p1.y, s.p2.y) - 8,
            right: Math.max(s.p1.x, s.p2.x) + 8,
            bottom: Math.max(s.p1.y, s.p2.y) + 8,
          };
        } else if (s.kind === "text") {
          const width = Math.max(18, String(s.text || "").length * 7);
          bounds = {
            left: s.x - 2,
            top: s.y - 2,
            right: s.x + width + 2,
            bottom: s.y + 18,
          };
        }
        if (bounds) {
          ctx.save();
          ctx.strokeStyle = "rgba(142, 233, 163, 0.82)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(
            bounds.left,
            bounds.top,
            Math.max(1, bounds.right - bounds.left),
            Math.max(1, bounds.bottom - bounds.top),
          );
          ctx.restore();
        }
      }
    };

    strokes.forEach((s, idx) => drawStroke(s, idx));
    if (drawing) drawStroke(drawing);
    if (tool === "ruler" && rulerPt1 && hoverPos) {
      drawStroke({ kind: "measure", p1: rulerPt1, p2: hoverPos, unit });
    }
  }, [strokes, drawing, tool, rulerPt1, hoverPos, unit, selectedStrokeIds]);

  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resize]);

  /* keyboard */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); setSpaceHeld(true); }
      if (e.key === "v" || e.key === "V") setTool("select");
      else if (e.key === "p" || e.key === "P") setTool("pencil");
      else if (e.key === "r" || e.key === "R") setTool("ruler");
      else if (e.key === "e" || e.key === "E") setTool("eraser");
      else if (e.key === "t" || e.key === "T") setTool("text");
      else if (e.key === "Escape") {
        setConnectingFrom(null);
        setHoverConnect(null);
        setConnectHoverTarget(null);
        setRewiring(null);
        setSelectedConnectionId(null);
        setSelection([]);
        setSelectedStrokeIds([]);
        setRulerPt1(null);
      }
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedConnectionId) {
          setConnections((cs) => cs.filter((c) => c.id !== selectedConnectionId));
          setSelectedConnectionId(null);
        }
        if (selection.length) {
          selection.forEach((id) => onDeleteNode(id));
        }
        if (selectedStrokeIds.length) {
          setStrokes((all) => all.filter((_, idx) => !selectedStrokeIds.includes(idx)));
          setSelectedStrokeIds([]);
        }
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setStrokes((s) => s.slice(0, -1));
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selection, selectedConnectionId, selectedStrokeIds, onDeleteNode, setSelection, setConnections]);

  useEffect(() => {
    if (selection.length === 0) {
      setSelectedBlueprintId(null);
      return;
    }
    for (const bp of blueprints) {
      const visibleIds = (bp.nodeIds || []).filter((id) =>
        nodes.some((n) => n.id === id && !n.hidden),
      );
      if (
        visibleIds.length > 0
        && visibleIds.length === selection.length
        && visibleIds.every((id) => selection.includes(id))
      ) {
        setSelectedBlueprintId(bp.id);
        return;
      }
    }
  }, [selection, blueprints, nodes]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const getPos = (e) => getWorldFromClient(e.clientX, e.clientY);

  const normalizeRect = (r) => ({
    left: Math.min(r.x1, r.x2),
    top: Math.min(r.y1, r.y2),
    right: Math.max(r.x1, r.x2),
    bottom: Math.max(r.y1, r.y2),
  });

  const rectIntersectsNode = (rect, node) => {
    const nx1 = node.x;
    const ny1 = node.y;
    const nx2 = node.x + (node._w || 200);
    const ny2 = node.y + (node._h || 80);
    return !(nx2 < rect.left || nx1 > rect.right || ny2 < rect.top || ny1 > rect.bottom);
  };

  const strokeBounds = (s) => {
    if (s.kind === "path" && s.points?.length) {
      const xs = s.points.map((p) => p.x);
      const ys = s.points.map((p) => p.y);
      return {
        left: Math.min(...xs) - 6,
        top: Math.min(...ys) - 6,
        right: Math.max(...xs) + 6,
        bottom: Math.max(...ys) + 6,
      };
    }
    if (s.kind === "measure") {
      return {
        left: Math.min(s.p1.x, s.p2.x) - 8,
        top: Math.min(s.p1.y, s.p2.y) - 8,
        right: Math.max(s.p1.x, s.p2.x) + 8,
        bottom: Math.max(s.p1.y, s.p2.y) + 8,
      };
    }
    if (s.kind === "text") {
      const width = Math.max(18, String(s.text || "").length * 7);
      return {
        left: s.x - 2,
        top: s.y - 2,
        right: s.x + width + 2,
        bottom: s.y + 18,
      };
    }
    return null;
  };

  const rectIntersectsStroke = (rect, s) => {
    const b = strokeBounds(s);
    if (!b) return false;
    return !(b.right < rect.left || b.left > rect.right || b.bottom < rect.top || b.top > rect.bottom);
  };

  const startPanDrag = (e, clearOnClick = false) => {
    e.preventDefault();
    panDrag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: view.panX,
      panY: view.panY,
      moved: false,
      clearOnClick,
    };
  };

  const onStagePointerDown = (e) => {
    const isStageBg = e.target === stageRef.current || e.target.classList?.contains("canvas-stage");
    if (e.button === 1 || (tool === "select" && spaceHeld && e.button === 0 && isStageBg)) {
      startPanDrag(e, e.button === 0 && tool === "select");
      return;
    }
    if (tool === "select" && e.button === 0 && isStageBg) {
      if (e.shiftKey) {
        startCanvasMarquee(getWorldFromClient, setMarqueeRect, marqueeDrag, e.clientX, e.clientY);
      } else {
        startPanDrag(e, true);
      }
      return;
    }
  };

  const onStagePointerMove = (e) => {
    if (marqueeDrag.current) {
      const p = getWorldFromClient(e.clientX, e.clientY);
      const start = marqueeDrag.current;
      setMarqueeRect({ x1: start.x, y1: start.y, x2: p.x, y2: p.y });
      return;
    }
    if (panDrag.current) {
      const d = panDrag.current;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > PAN_CLICK_THRESHOLD) {
        panDrag.current = { ...d, moved: true };
      }
      const drag = panDrag.current;
      setView((v) => ({
        ...v,
        panX: drag.panX + (e.clientX - drag.x),
        panY: drag.panY + (e.clientY - drag.y),
      }));
    }
  };

  const onStagePointerUp = () => {
    if (marqueeDrag.current && marqueeRect) {
      const rect = normalizeRect(marqueeRect);
      const selectedNodeIds = nodes
        .filter((n) => !n.hidden && rectIntersectsNode(rect, n))
        .map((n) => n.id);
      const selectedStrokeIdx = strokes
        .map((s, idx) => (rectIntersectsStroke(rect, s) ? idx : -1))
        .filter((idx) => idx >= 0);
      setSelection(selectedNodeIds);
      setSelectedStrokeIds(selectedStrokeIdx);
      setSelectedConnectionId(null);
      setSelectedBlueprintId(null);
      marqueeDrag.current = null;
      setMarqueeRect(null);
      return;
    }
    marqueeDrag.current = null;
    setMarqueeRect(null);
    const d = panDrag.current;
    if (d?.clearOnClick && !d.moved) {
      setSelection([]);
      setSelectedStrokeIds([]);
      setSelectedConnectionId(null);
      setSelectedBlueprintId(null);
    }
    panDrag.current = null;
  };

  const onPointerDown = (e) => {
    if (panDrag.current) return;
    if (tool === "select") {
      if (e.target === canvasRef.current) {
        if (spaceHeld || e.button === 1) {
          startPanDrag(e, true);
          return;
        }
        if (e.button === 0) {
          if (e.shiftKey) {
            startCanvasMarquee(getWorldFromClient, setMarqueeRect, marqueeDrag, e.clientX, e.clientY);
          } else {
            startPanDrag(e, true);
          }
          return;
        }
      }
      return;
    }
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = getPos(e);
    if (tool === "pencil") setDrawing({ kind: "path", color, size, points: [p] });
    else if (tool === "ruler") {
      if (!rulerPt1) setRulerPt1(p);
      else { setStrokes((s) => [...s, { kind: "measure", p1: rulerPt1, p2: p, unit }]); setRulerPt1(null); }
    } else if (tool === "eraser") eraseAt(p);
    else if (tool === "text") {
      const txt = window.prompt("Text:");
      if (txt) setStrokes((s) => [...s, { kind: "text", x: p.x, y: p.y, text: txt, color }]);
    }
  };

  const onPointerMove = (e) => {
    const p = getPos(e);
    setHoverPos(p);
    if (tool === "pencil" && drawing) setDrawing((d) => ({ ...d, points: [...d.points, p] }));
    else if (tool === "eraser" && e.buttons === 1) eraseAt(p);
    if (connectingFrom || rewiring) {
      setHoverConnect(getWorldFromClient(e.clientX, e.clientY));
    }
  };

  const onPointerUp = () => {
    if (tool === "pencil" && drawing) {
      if (drawing.points.length > 1) setStrokes((s) => [...s, drawing]);
      setDrawing(null);
    }
    if (rewiring) {
      setRewiring(null);
      setHoverConnect(null);
      setConnectHoverTarget(null);
    } else if (connectingFrom) {
      setConnectingFrom(null);
      setHoverConnect(null);
      setConnectHoverTarget(null);
    }
  };

  const eraseAt = (p) => {
    setStrokes((all) =>
      all.filter((s) => {
        if (s.kind === "path") return !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 14);
        if (s.kind === "measure") return pointToSegment(p, s.p1, s.p2) > 10;
        if (s.kind === "text") return Math.hypot(s.x - p.x, s.y - p.y) > 30;
        return true;
      })
    );
  };

  /* node ops */
  const focusNoteForNode = (id) => {
    const node = nodes.find((n) => n.id === id);
    if (node?.noteId && onFocusNote) onFocusNote(node.noteId);
  };

  const handleAddToSelection = (id) => {
    setSelectedConnectionId(null);
    setSelectedBlueprintId(null);
    setSelectedStrokeIds([]);
    focusNoteForNode(id);
    setSelection((sel) => (sel.includes(id) ? sel : [...sel, id]));
  };

  const handleTapToggle = (id) => {
    setSelectedConnectionId(null);
    setSelectedStrokeIds([]);
    focusNoteForNode(id);
    setSelection((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  };
  const handleOpenNode = (id) => {
    const node = nodes.find((n) => n.id === id);
    if (!node || !onOpenNote) return;
    onOpenNote(node.noteId, node);
  };
  const handleMove = (id, x, y) => {
    setNodes((all) => all.map((n) => (n.id === id ? { ...n, x, y } : n)));
  };

  const handleMoveBlueprint = (bpId, dx, dy) => {
    const bp = blueprints.find((b) => b.id === bpId);
    if (!bp || !bp.nodeIds?.length) return;
    const idSet = new Set(bp.nodeIds);
    setNodes((all) => all.map((n) => (
      idSet.has(n.id) && !n.hidden
        ? { ...n, x: n.x + dx, y: n.y + dy }
        : n
    )));
  };

  const handleBlueprintLabelPointerDown = (e, bpId) => {
    if (e.button !== 0 || e.target.closest(".bp-frame-del")) return;
    e.stopPropagation();
    e.preventDefault();
    selectBlueprintOnCanvas(bpId);
    let lastX = e.clientX;
    let lastY = e.clientY;
    const move = (ev) => {
      const dx = (ev.clientX - lastX) / view.scale;
      const dy = (ev.clientY - lastY) / view.scale;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (dx !== 0 || dy !== 0) handleMoveBlueprint(bpId, dx, dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const handleEdit = (id, edits) => {
    if (onEditNode) onEditNode(id, edits);
    else setNodes((all) => all.map((n) => n.id === id ? { ...n, ...edits } : n));
  };
  const handleDeleteNode = (id) => onDeleteNode(id);
  const handleStartConnect = (id) => {
    setSelectedConnectionId(null);
    setRewiring(null);
    setConnectingFrom(id);
    setConnectHoverTarget(null);
    const node = nodes.find((n) => n.id === id);
    if (node) setHoverConnect({ x: node.x + (node._w || 200), y: node.y + (node._h || 80) / 2 });
  };

  const handleStartRewire = (connId, end) => {
    const c = connections.find((x) => x.id === connId);
    if (!c) return;
    setRewiring({ connId, end });
    setConnectingFrom(null);
    setConnectHoverTarget(null);
    if (end === "from") {
      const node = nodes.find((n) => n.id === c.from);
      if (node) setHoverConnect({ x: node.x + (node._w || 200), y: node.y + (node._h || 80) / 2 });
    } else {
      const node = nodes.find((n) => n.id === c.to);
      if (node) setHoverConnect({ x: node.x, y: node.y + (node._h || 80) / 2 });
    }
  };

  const handlePortMouseUp = (portNodeId) => {
    if (rewiring) {
      const { connId, end } = rewiring;
      setConnections((conns) => {
        const c = conns.find((x) => x.id === connId);
        if (!c) return conns;
        let next = { ...c };
        if (end === "from") {
          if (portNodeId === c.to) return conns;
          next.from = portNodeId;
        } else {
          if (portNodeId === c.from) return conns;
          next.to = portNodeId;
        }
        if (conns.some((x) => x.id !== connId && x.from === next.from && x.to === next.to)) return conns;
        return conns.map((x) => (x.id === connId ? next : x));
      });
      setRewiring(null);
      setHoverConnect(null);
      setConnectHoverTarget(null);
      return;
    }
    if (!connectingFrom || connectingFrom === portNodeId) {
      setConnectingFrom(null);
      setHoverConnect(null);
      setConnectHoverTarget(null);
      return;
    }
    setConnections((conns) => {
      if (conns.some((c) => c.from === connectingFrom && c.to === portNodeId)) return conns;
      return [...conns, { from: connectingFrom, to: portNodeId, id: shortId("CN") }];
    });
    setConnectingFrom(null);
    setHoverConnect(null);
    setConnectHoverTarget(null);
  };

  /* connection path helpers */
  const nodeAnchor = (n, side) => {
    const w = n._w || 200;
    const h = n._h || 80;
    if (side === "right") return { x: n.x + w, y: n.y + h / 2 };
    return { x: n.x, y: n.y + h / 2 };
  };

  const pathBetween = (a, b) => {
    const dx = b.x - a.x;
    const k = Math.max(40, Math.abs(dx) * 0.4);
    return `M ${a.x} ${a.y} C ${a.x + k} ${a.y}, ${b.x - k} ${b.y}, ${b.x} ${b.y}`;
  };

  const getRewireAnchor = () => {
    if (!rewiring) return null;
    const c = connections.find((x) => x.id === rewiring.connId);
    if (!c) return null;
    const fixed = rewiring.end === "from"
      ? nodes.find((n) => n.id === c.to)
      : nodes.find((n) => n.id === c.from);
    if (!fixed) return null;
    return rewiring.end === "from" ? nodeAnchor(fixed, "left") : nodeAnchor(fixed, "right");
  };

  /* measure nodes for connection anchors */
  useEffect(() => {
    if (!stageRef.current) return;
    const els = stageRef.current.querySelectorAll(".cnode");
    const updates = {};
    els.forEach((el) => {
      const id = el.getAttribute("data-id");
      if (!id) return;
      updates[id] = { w: el.offsetWidth, h: el.offsetHeight };
    });
    setNodes((all) => all.map((n) => {
      const u = updates[n.id];
      if (u && (n._w !== u.w || n._h !== u.h)) return { ...n, _w: u.w, _h: u.h };
      return n;
    }));
    // eslint-disable-next-line
  }, [nodes.length]);

  const handleClear = () => {
    if (!window.confirm("Hide all nodes? Blueprints and data stay intact.")) return;
    setNodes((all) => all.map((n) => ({ ...n, hidden: true })));
    setStrokes([]);
    setRulerPt1(null);
    setSelection([]);
    setSelectedStrokeIds([]);
  };

  const handleShowAll = () => {
    setNodes((all) => all.map((n) => ({ ...n, hidden: false })));
  };

  const handleDownload = () => {
    const c = canvasRef.current;
    if (!c) return;
    const out = document.createElement("canvas");
    out.width = c.width; out.height = c.height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#07090c";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, 0, 0);
    const url = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `voltway-blueprint.png`; a.click();
  };

  const visibleNodes = nodes.filter((n) => !n.hidden);
  const hiddenCount = nodes.length - visibleNodes.length;

  const selectBlueprintOnCanvas = (bpId) => {
    const bp = blueprints.find((b) => b.id === bpId);
    if (!bp) return;
    const visibleIds = (bp.nodeIds || []).filter((id) => {
      const n = nodes.find((nd) => nd.id === id && !nd.hidden);
      return !!n;
    });
    setSelectedBlueprintId(bpId);
    setSelectedConnectionId(null);
    setSelection(visibleIds);
    setSelectedStrokeIds([]);
  };

  const handleRemoveBlueprintFromCanvas = (bpId) => {
    const bp = blueprints.find((b) => b.id === bpId);
    if (!bp || !onRemoveBlueprintFromCanvas) return;
    onRemoveBlueprintFromCanvas(bp);
    setSelectedBlueprintId(null);
    setSelection([]);
    setSelectedStrokeIds([]);
  };

  /* compute blueprint bounding boxes for frames */
  const bpFrames = blueprints.map((bp) => {
    const bpNodes = bp.nodeIds.map((id) => nodes.find((n) => n.id === id && !n.hidden)).filter(Boolean);
    if (bpNodes.length < 1) return null;
    const minX = Math.min(...bpNodes.map((n) => n.x)) - 12;
    const minY = Math.min(...bpNodes.map((n) => n.y)) - 24;
    const maxX = Math.max(...bpNodes.map((n) => n.x + (n._w || 200))) + 12;
    const maxY = Math.max(...bpNodes.map((n) => n.y + (n._h || 80))) + 12;
    const nodeIds = bpNodes.map((n) => n.id);
    return {
      id: bp.id,
      label: bp.label,
      color: bp.color,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      nodeIds,
    };
  }).filter(Boolean);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-toolbar">
        <button className={"canvas-tool " + (tool === "select" ? "active" : "")} title="Select [V]" onClick={() => setTool("select")}><Icon name="select" /></button>
        <button className={"canvas-tool " + (tool === "pencil" ? "active" : "")} title="Pencil [P]" onClick={() => setTool("pencil")}><Icon name="pencil" /></button>
        <button className={"canvas-tool " + (tool === "ruler" ? "active" : "")}  title="Ruler [R]"  onClick={() => setTool("ruler")}><Icon name="ruler" /></button>
        <button className={"canvas-tool " + (tool === "text" ? "active" : "")}   title="Text [T]"   onClick={() => setTool("text")}><Icon name="text" /></button>
        <button className={"canvas-tool " + (tool === "eraser" ? "active" : "")} title="Eraser [E]" onClick={() => setTool("eraser")}><Icon name="eraser" /></button>

        {tool === "pencil" && (
          <div className="canvas-toolopt">
            {PENCIL_COLORS.map((c) => (
              <div key={c.value} className={"swatch " + (color === c.value ? "active" : "")}
                   style={{ color: c.value }} onClick={() => setColor(c.value)} title={c.name} />
            ))}
            <input type="number" min="1" max="50" className="size-input" value={size}
                   onChange={(e) => setSize(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            <span className="label-mono">px</span>
          </div>
        )}
        {tool === "ruler" && (
          <div className="canvas-toolopt">
            <select className="unit-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            <span className="label-mono">click 2 points</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button
          className="btn xs primary"
          disabled
          onClick={onInsertToTimeline}
          title="Insert selected nodes into the timeline (requires an instruction set — coming soon)"
        >
          Insert to timeline
        </button>
        {hiddenCount > 0 && (
          <button className="btn xs" onClick={handleShowAll} title="Show all hidden nodes">
            <Icon name="show" size={11} /> Show all
          </button>
        )}
        <button className="btn xs ghost" onClick={handleClear}><Icon name="clear" size={11} /> Clear</button>
        <button className="btn xs" onClick={handleDownload}><Icon name="download" size={11} /> Export</button>
        <span className="canvas-tool-divider" />
        <button className="canvas-tool" title="Zoom out" onClick={() => {
          const r = stageRef.current?.getBoundingClientRect();
          if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1);
        }}>−</button>
        <span className="label-mono" style={{ fontSize: 10, minWidth: 36, textAlign: "center" }}>
          {Math.round(view.scale * 100)}%
        </span>
        <button className="canvas-tool" title="Zoom in" onClick={() => {
          const r = stageRef.current?.getBoundingClientRect();
          if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, -1);
        }}>+</button>
        <button className="btn xs ghost" title="Reset view" onClick={() => setView({ scale: 1, panX: 0, panY: 0 })}>100%</button>
      </div>

      <div
        className={"canvas-stage" + (tool === "select" ? " pan-ready" : "")}
        ref={stageRef}
        data-tool={tool}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerLeave={onStagePointerUp}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div
          className="canvas-viewport"
          style={{
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})`,
            transformOrigin: "0 0",
          }}
        >
        <canvas ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { setHoverPos(null); if (drawing) { setStrokes((s) => [...s, drawing]); setDrawing(null); } }}
        />

        {/* blueprint frames */}
        {bpFrames.map((f) => {
          const isBpSelected = selectedBlueprintId === f.id;
          return (
            <div
              key={f.id}
              className={"bp-frame" + (isBpSelected ? " selected" : "")}
              style={{
                left: f.x,
                top: f.y,
                width: f.w,
                height: f.h,
                "--bp-accent": f.color.stroke,
                "--bp-soft": f.color.soft,
                borderColor: f.color.stroke + (isBpSelected ? "" : "80"),
                background: f.color.soft,
                boxShadow: isBpSelected
                  ? `0 0 0 2px ${f.color.stroke}66`
                  : undefined,
              }}
            >
              <div
                className="bp-frame-label"
                onPointerDown={(e) => handleBlueprintLabelPointerDown(e, f.id)}
              >
                <span className="bp-frame-label-text">▸ {f.label}</span>
                {isBpSelected && onRemoveBlueprintFromCanvas && (
                  <button
                    type="button"
                    className="bp-frame-del icon-del-btn"
                    title="Remove blueprint from canvas (notes kept)"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBlueprintFromCanvas(f.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* connections */}
        <svg className="canvas-svg">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--hud)" />
            </marker>
            <marker id="arrow-pending" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
            </marker>
          </defs>
          {connections.map((c) => {
            const a = nodes.find((n) => n.id === c.from);
            const b = nodes.find((n) => n.id === c.to);
            if (!a || !b || a.hidden || b.hidden) return null;
            if (rewiring && rewiring.connId === c.id) return null;
            const p1 = nodeAnchor(a, "right");
            const p2 = nodeAnchor(b, "left");
            const d = pathBetween(p1, p2);
            const label = computeEdgeTemporalLabel(a, b, today, nodes, connections, blueprints, temporalMeta);
            const mid = bezierMidpoint(p1, p2);
            const selected = selectedConnectionId === c.id;
            const linkColor = resolveConnectionLinkColor(a, b, temporalMeta);
            const atomPoint = resolveConnAtomPlacement(a, b, p1, p2, nodeEntitiesById);
            return (
              <g
                key={c.id}
                className={"conn-group" + (selected ? " selected" : "")}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedConnectionId(c.id);
                  setSelection([]);
                  setSelectedStrokeIds([]);
                }}
              >
                <path className="conn-hit" d={d} />
                <path
                  className={"conn" + (selected ? " selected" : "")}
                  d={d}
                  markerEnd="url(#arrow)"
                  style={linkColor && !selected ? { stroke: linkColor } : undefined}
                />
                {atomPoint ? <ConnAtomMarker x={atomPoint.x} y={atomPoint.y} /> : null}
                {label && <ConnLabel x={mid.x} y={mid.y} text={label} />}
              </g>
            );
          })}
          {(connectingFrom || rewiring) && hoverConnect && (() => {
            let p1;
            let p2;
            let a;
            let b;
            if (rewiring) {
              const fixed = getRewireAnchor();
              if (!fixed) return null;
              const c = connections.find((x) => x.id === rewiring.connId);
              const target = connectHoverTarget ? nodes.find((n) => n.id === connectHoverTarget) : null;
              if (rewiring.end === "from") {
                p2 = fixed;
                p1 = target ? nodeAnchor(target, "right") : hoverConnect;
                a = target;
                b = nodes.find((n) => n.id === c?.to);
              } else {
                p1 = fixed;
                p2 = target ? nodeAnchor(target, "left") : hoverConnect;
                a = nodes.find((n) => n.id === c?.from);
                b = target;
              }
            } else {
              a = nodes.find((n) => n.id === connectingFrom);
              if (!a) return null;
              p1 = nodeAnchor(a, "right");
              const target = connectHoverTarget ? nodes.find((n) => n.id === connectHoverTarget) : null;
              p2 = target ? nodeAnchor(target, "left") : hoverConnect;
              b = target;
            }
            const label = a && b
              ? computeEdgeTemporalLabel(a, b, today, nodes, connections, blueprints, temporalMeta)
              : null;
            const mid = bezierMidpoint(p1, p2);
            return (
              <g>
                <path className="conn pending" d={pathBetween(p1, p2)} markerEnd="url(#arrow-pending)" />
                {label && <ConnLabel x={mid.x} y={mid.y} text={label} pending />}
              </g>
            );
          })()}
        </svg>

        {/* nodes */}
        {nodes.map((n) => (
          <CanvasNode
            key={n.id}
            node={n}
            today={today}
            selected={selection.includes(n.id)}
            connectingFrom={connectingFrom}
            isConnectingFrom={!!connectingFrom}
            rewiring={rewiring}
            blueprintColor={blueprintByNodeId[n.id]}
            allNodes={nodes}
            allConnections={connections}
            selectedConnectionId={selectedConnectionId}
            connections={connections}
            onAddToSelection={handleAddToSelection}
            onTapToggle={handleTapToggle}
            onMove={handleMove}
            onEdit={handleEdit}
            onDelete={handleDeleteNode}
            onStartConnect={handleStartConnect}
            onPortMouseUp={handlePortMouseUp}
            onStartRewire={handleStartRewire}
            getWorldFromClient={getWorldFromClient}
            onConnectHover={(connectingFrom || rewiring) ? setConnectHoverTarget : undefined}
            nodeEntitiesById={nodeEntitiesById}
            docsById={docsById}
            objectsById={objectsById}
            onOpen={handleOpenNode}
          />
        ))}
        {marqueeRect && (() => {
          const r = normalizeRect(marqueeRect);
          return (
            <div
              className="canvas-marquee"
              style={{
                left: r.left,
                top: r.top,
                width: Math.max(1, r.right - r.left),
                height: Math.max(1, r.bottom - r.top),
              }}
            />
          );
        })()}
        </div>

        <div className="canvas-coords">
          <span>X <b>{hoverPos ? Math.round(hoverPos.x) : "—"}</b></span>
          <span>Y <b>{hoverPos ? Math.round(hoverPos.y) : "—"}</b></span>
          <span>· {visibleNodes.length}/{nodes.length} nodes · {connections.length} edges · {blueprints.length} blueprints</span>
        </div>
        <div className="canvas-status">
          {selectedConnectionId && (
            <span className="pill warm"><i className="dot" />Edge selected · Del to remove · drag port to reassign</span>
          )}
          {selection.length > 0 && (
            <span className="pill ai"><i className="dot" />{selection.length} selected · tap to toggle</span>
          )}
          <span className="pill ok"><i className="dot" />Canvas · Live</span>
        </div>

        {nodes.length === 0 && strokes.length === 0 && (
          <div className="canvas-empty">
            <div className="canvas-empty-card">
              <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Blueprint empty
              </div>
              <h3>Send notes to the canvas</h3>
              <p>Convert a note into a node, or scan a campaign + click "Insert as Blueprint" to auto-create connected typed nodes.</p>
            </div>
          </div>
        )}
        {nodes.length > 0 && visibleNodes.length === 0 && (
          <div className="canvas-empty">
            <div className="canvas-empty-card">
              <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Canvas cleared</div>
              <h3>{hiddenCount} nodes hidden</h3>
              <p>Data + {blueprints.length} blueprints intact. Click "Show all" to restore.</p>
              <button className="btn primary" onClick={handleShowAll}>Show all nodes</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pointToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export { BlueprintCanvas, CanvasNode, Icon };
export { computeMetricValue, parseDate } from './temporal.js';
