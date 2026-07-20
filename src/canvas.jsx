import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { daysBetween, fmtDate, shortId } from './data.jsx';
import {
  parseDate,
  computeMetricValue,
  computeEdgeTemporalLabel,
  bezierMidpoint,
  bezierPointAtArcOffset,
} from './temporal.js';
import { formatScheduleLabelFromIso, resolveExplicitScheduleIso } from './lib/nodeAnchor.js';
import { resolveConnectionLinkColor } from './lib/docNodeLinkColors.js';
import { resolveVideoEmbedFromNodeContent } from './lib/videoEmbed.js';
import {
  calendarEventPayloadToResult,
  parseCalendarEventNodeContent,
} from './lib/eventCalendarSearch.js';
import {
  parseWeatherForecastNodeContent,
} from './lib/forecastSearch.js';
import { CalendarEventResultBox } from './components/intel/CalendarEventResultBox.jsx';
import { CalendarEventNodeView } from './components/intel/CalendarEventNodeView.jsx';
import { ForecastNodeView } from './components/intel/ForecastNodeView.jsx';
import { hasCanvasDrag, readCanvasDragData } from './lib/canvasDrag.js';
import { FLOPPY_DISK_ICON } from './lib/knowledgeImport.js';
import {
  isContentDoc,
  isKnowledgeDoc,
  resolveKnowledgeDocDisplayTitle,
  resolveLinkedProductCategories,
} from './lib/templateDoc.js';

import {
  detectDocAdoptionOnConnect,
  isEntityMacroNode,
  isOrphanEntityNode,
  listOrphanEntityCanvasNodes,
  resolveNodeParentDocId,
} from './lib/nodeParentAdoption.js';
import { useI18n } from './i18n/useI18n.js';
import { AgentCanvasAvatar } from './components/agents/AgentCanvasAvatar.jsx';
import { useScheduledTasksStore } from './stores/scheduledTasksStore.js';
import { listUpcomingScheduledTasks, formatScheduleAtLabel } from './hooks/useScheduledAgentRunner.js';
import { isScheduleNotDue } from './lib/agents/agentScheduleGate.js';
import { getAgentById, getAgentLabel, isAgentEnabledForUser } from './lib/agents/registry.js';
import { useAuthStore } from './stores/authStore.js';
import { getAgentCreditCost } from './lib/agents/agentCreditCosts.js';
import { usePlanStore } from './stores/planStore.js';
import { getCreditsDisplay } from './lib/planConfig.js';
import {
  filterSelectableCanvasNodeIds,
  isKnowledgeCanvasNode,
  isTimelineSelectableCanvasNode,
} from './lib/timelineSelection.js';
import { resolveCanvasNodeParentTagStyle } from './lib/objectColors.js';
import {
  classifyConnectionRecord,
  isCrossFamilyConnectionKind,
  validateCanvasConnectionAttempt,
} from './lib/timelineGraph.js';
import { useTimelineStore } from './stores/index.js';
import { organizeCanvasNodes } from './lib/canvasMath.js';
import { computeSpotlightView, getWiredVisibleNodeIds } from './lib/canvasSpotlight.js';
import {
  shouldShowCrossFamilyCenterPorts,
  normalizeCrossFamilyConnectionEndpoints,
  resolveCanvasWireTemporalLabel,
} from './lib/canvasInheritWire.js';
/* canvas.jsx — Blueprint Canvas v3
 *
 * Notes ↔ Nodes ↔ Blueprints. Three-tier model:
 *   - Node has dataType ∈ {text, date, metric} (no 'company')
 *   - Multi-select: tap nodes to add/remove; tap empty canvas to clear
 *   - "Create Blueprint" groups selected nodes (logical folder + colored frame)
 *   - "Metric bridge" — a metric node connected to two date nodes auto-computes day-diff
 *   - "Clear canvas" removes all nodes and connections (data in folders stays intact)
 *   - "Organize" compacts visible nodes into a grid
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
    import:  <path d="M10 16V7m0 0l-3.5 3.5M10 7l3.5 3.5M4 4h12" stroke="currentColor" strokeWidth="1.4" fill="none" />,
    grid:    <path d="M3 3h5v5H3V3zm9 0h5v5h-5V3zM3 12h5v5H3v-5zm9 0h5v5h-5v-5z" stroke="currentColor" strokeWidth="1.2" fill="none" />,
    focus:   <path d="M8.5 8.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm6.5 6.5-2.8-2.8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />,
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

function shouldStartCanvasMarquee(shiftKey, timelineQueueMode) {
  return Boolean(shiftKey || timelineQueueMode);
}

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
  const docId = resolveNodeParentDocId(entity, node, docsById);
  if (!docId) return null;
  const doc = docsById[docId];
  return {
    kind: "Document",
    name: (doc?.title || "Untitled").trim(),
  };
}

function resolveCanvasDocTitle(node, docsById = {}) {
  const docId = node.docId || node.noteId;
  const doc = docId ? docsById[docId] : null;
  if (isKnowledgeDoc(doc)) return resolveKnowledgeDocDisplayTitle(doc);
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

function CanvasNodeTags({ parentTag, scheduleLabel, parentTitle = "Parent", tagFamily = null }) {
  if (!parentTag && !scheduleLabel) return null;
  return (
    <div className="cnode-v cnode-v--compact">
      <div className="cnode-tags">
        {parentTag ? (
          <span
            className="cnode-parent-tag"
            title={parentTitle}
            style={tagFamily?.style}
          >
            <span className="cnode-parent-tag__kind" style={tagFamily?.kindStyle}>
              {parentTag.kind}
            </span>
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
  onConnectHover, onStartRewire, getWorldFromClient,   onOpen,
  onDocumentAdoptOrphan,
  orphanEntityCanvasNodes = [],
  timelineSelectable = true,
  timelineQueueMode = false,
  selectionIndex = null,
  showCenterPorts = false,
  onRunAgent,
}) {
  const ref = useRef(null);
  const { t } = useI18n();
  const planProfile = usePlanStore((s) => s.profile);
  const planSearchCount = usePlanStore((s) => s.profile.searchCount);
  const planTokensBalance = usePlanStore((s) => s.profile.tokensBalance);
  const userEmail = useAuthStore((s) => s.user?.email);
  const creditsDisplay = getCreditsDisplay({
    ...planProfile,
    searchCount: planSearchCount,
    tokensBalance: planTokensBalance,
  });
  const [editing, setEditing] = useState(null); // 'title' | 'content' | null
  const TAP_THRESHOLD = 5;

  const selConn = selectedConnectionId
    ? connections.find((c) => c.id === selectedConnectionId)
    : null;

  const knowledgeCorpus =
    node.dataType === "document" && isKnowledgeCanvasNode(node, docsById);

  const onPointerDown = (e) => {
    if (e.target.closest('.cnode-port') || e.target.closest('.cnode-del')) return;
    if (e.target.closest('.cnode-parent-select')) return;
    if (e.target.closest('.cnode-adopt-orphan')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (timelineQueueMode && !timelineSelectable) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const wasSelected = selected;

    // Select/timeline pick: mark on press so the badge appears even if the
    // pointerup path is interrupted. Free mode keeps single-select on press.
    if (!wasSelected) {
      onAddToSelection(node.id);
    }

    const world = getWorldFromClient(e.clientX, e.clientY);
    const offX = world.x - node.x;
    const offY = world.y - node.y;
    const move = (ev) => {
      // While picking for timeline, keep cards still — drag fights multi-mark.
      if (timelineQueueMode) return;
      const w = getWorldFromClient(ev.clientX, ev.clientY);
      onMove(node.id, w.x - offX, w.y - offY);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist >= TAP_THRESHOLD) return;
      if (timelineQueueMode) {
        if (wasSelected) {
          onTapToggle(node.id);
        } else {
          // Re-assert mark if press-time add lost a race with Select toggle.
          onAddToSelection(node.id);
        }
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const renderContent = () => {
    if (editing === "content") {
      if (node.dataType === "text") {
        const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
        const rawContent = entity?.content ?? node.content;
        if (parseCalendarEventNodeContent(rawContent)) {
          return (
            <div className="cnode-v cnode-v--compact cnode-v--calendar-event">
              <CalendarEventNodeView content={rawContent} />
            </div>
          );
        }
        if (parseWeatherForecastNodeContent(rawContent)) {
          return (
            <div className="cnode-v cnode-v--compact cnode-v--weather-forecast">
              <ForecastNodeView content={rawContent} />
            </div>
          );
        }
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
        </div>
      );
    }
    if (node.dataType === "document") {
      if (isKnowledgeCanvasNode(node, docsById)) {
        const docId = node.docId || node.noteId;
        const doc = docId ? docsById[docId] : null;
        const subcategory = doc?.category?.trim() || "";
        const importedName = doc?.knowledgeImport?.fileName?.trim() || "";
        return (
          <div className="cnode-v cnode-v--compact cnode-knowledge-corpus" title="Reusable knowledge corpus">
            <div className="cnode-knowledge-corpus__row">
              <img
                src={FLOPPY_DISK_ICON}
                alt=""
                className="cnode-knowledge-corpus__icon"
                draggable={false}
              />
              <div className="cnode-knowledge-corpus__labels">
                {importedName ? (
                  <span className="cnode-knowledge-corpus__file" title={importedName}>
                    {importedName}
                  </span>
                ) : null}
                {subcategory ? (
                  <span className="cnode-knowledge-corpus__sub">{subcategory}</span>
                ) : (
                  <span className="cnode-knowledge-corpus__sub cnode-knowledge-corpus__sub--dim">corpus</span>
                )}
              </div>
            </div>
          </div>
        );
      }
      const parentTag = resolveCanvasDocumentTag(node, docsById, objectsById);
      const tagFamily = resolveCanvasNodeParentTagStyle(
        node, docsById, objectsById, nodeEntitiesById,
      );
      return (
        <CanvasNodeTags
          parentTag={parentTag}
          parentTitle="Linked product"
          tagFamily={tagFamily}
        />
      );
    }
    if (node.dataType === "text") {
      const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
      const calendarPayload = parseCalendarEventNodeContent(entity?.content ?? node.content);
      if (calendarPayload) {
        const calendarResult = calendarEventPayloadToResult(calendarPayload);
        if (calendarResult?.scopeBrief?.body || calendarResult?.displayModel || calendarResult?.event) {
          return (
            <div className="cnode-v cnode-v--compact cnode-v--calendar-event">
              <CalendarEventResultBox result={calendarResult} showInsert={false} />
            </div>
          );
        }
      }
      const forecastPayload = parseWeatherForecastNodeContent(entity?.content ?? node.content);
      if (forecastPayload) {
        return (
          <div className="cnode-v cnode-v--compact cnode-v--weather-forecast">
            <ForecastNodeView payload={forecastPayload} />
          </div>
        );
      }
      const anchorIso = resolveExplicitScheduleIso(entity, node, docsById);
      const scheduleLabel = anchorIso ? formatScheduleLabelFromIso(anchorIso) : "";
      const parentTag = resolveCanvasParentDocTag(node, nodeEntitiesById, docsById);
      const tagFamily = resolveCanvasNodeParentTagStyle(
        node, docsById, objectsById, nodeEntitiesById,
      );
      return (
        <CanvasNodeTags
          parentTag={parentTag}
          scheduleLabel={scheduleLabel}
          parentTitle="Parent document"
          tagFamily={tagFamily}
        />
      );
    }
    if (node.dataType === "checkbox") {
      const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
      const checked = entity
        ? Boolean(entity.content)
        : Boolean(node.content);
      const anchorIso = resolveExplicitScheduleIso(entity, node, docsById);
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
    if (node.dataType === "video") {
      const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
      const payload = resolveVideoEmbedFromNodeContent(entity?.content ?? node.content);
      if (!payload?.embedSrc) {
        return (
          <div className="cnode-v cnode-v--video cnode-v--video-empty">
            Paste a YouTube/Vimeo URL in the document
          </div>
        );
      }
      return (
        <div className="cnode-v cnode-v--video">
          <iframe
            src={payload.embedSrc}
            title={node.title || "Embedded video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    if (node.canvasKind === "agent" || node.dataType === "agent") {
      const status = node.agentStatus || "idle";
      const isRunning = status === "running";
      const statusClass = status === "error"
        ? "is-error"
        : status === "done"
          ? "is-done"
          : "";
      const agentDef = getAgentById(node.agentId || "orchestrator");
      const agentEnabled = isAgentEnabledForUser(node.agentId || "orchestrator", userEmail);
      const creditCost = getAgentCreditCost(node.agentId);
      const { counter: creditsCounter, remaining: creditsRemaining } = creditsDisplay;
      const hasAvatarImage = Boolean(agentDef?.avatarImage);
      const avatarKind = agentDef?.avatarKind || (hasAvatarImage ? "illustration" : "icon");
      return (
        <div className="cnode-agent" onPointerDown={(e) => e.stopPropagation()}>
          <div
            className={[
              "cnode-agent__avatar",
              avatarKind === "brand-icon" ? "cnode-agent__avatar--brand-icon" : "",
              hasAvatarImage && avatarKind !== "brand-icon" ? "cnode-agent__avatar--image" : "",
              isRunning ? "is-running" : "",
            ].filter(Boolean).join(" ")}
          >
            <AgentCanvasAvatar
              imageSrc={agentDef?.avatarImage}
              iconVariant={agentDef?.icon || node.agentId || "orchestrator"}
              avatarKind={avatarKind === "brand-icon" ? "brand-icon" : "illustration"}
            />
          </div>
          <div className="cnode-agent__run-row">
            <button
              type="button"
              className="cnode-agent__run"
              disabled={isRunning || !onRunAgent || !agentEnabled || creditsRemaining < creditCost}
              title={!agentEnabled ? t("agents.orchestrator.disabled") : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (!agentEnabled) return;
                onRunAgent?.(node.id);
              }}
            >
              {isRunning ? t("agents.running") : t("agents.run")}
            </button>
            <span
              className="cnode-agent__counter"
              aria-label={t("plans.creditsCounter", { count: creditsCounter })}
              title={t("plans.creditsCounterHint")}
            >
              {creditsCounter}
            </span>
          </div>
          {status !== "idle" ? (
            <span
              className={`cnode-agent__status ${statusClass}`}
              title={node.agentError || undefined}
            >
              {status === "error"
                ? (node.agentError || t("agents.error"))
                : status === "done"
                  ? t("agents.done")
                  : status}
            </span>
          ) : null}
        </div>
      );
    }
    return null;
  };

  const displayTitle = node.canvasKind === "agent" || node.dataType === "agent"
    ? getAgentLabel(node.agentId || "orchestrator", t).toUpperCase()
    : node.dataType === "text"
      ? resolveCanvasDisplayTitle(node, nodeEntitiesById)
      : node.dataType === "document"
        ? resolveCanvasDocTitle(node, docsById)
        : node.title;

  const canEditCanvasTitle = !knowledgeCorpus
    && node.dataType !== "object"
    && node.dataType !== "agent"
    && node.canvasKind !== "document"
    && node.canvasKind !== "agent";

  const calendarEventPayload = node.dataType === "text"
    ? parseCalendarEventNodeContent(
      (node.noteId ? nodeEntitiesById[node.noteId] : null)?.content ?? node.content,
    )
    : null;

  const weatherForecastPayload = node.dataType === "text" && !calendarEventPayload
    ? parseWeatherForecastNodeContent(
      (node.noteId ? nodeEntitiesById[node.noteId] : null)?.content ?? node.content,
    )
    : null;

  const videoEmbedPayload = node.dataType === "video"
    ? resolveVideoEmbedFromNodeContent(
      (node.noteId ? nodeEntitiesById[node.noteId] : null)?.content ?? node.content,
    )
    : null;

  const isCompactWidgetNode = Boolean(
    calendarEventPayload || weatherForecastPayload || videoEmbedPayload?.embedSrc,
  );

  const cls = ["cnode"];
  if (selected) cls.push("selected");
  if (selected && timelineQueueMode) cls.push("cnode--timeline-pick");
  if (timelineQueueMode && !timelineSelectable) cls.push("cnode--timeline-muted");
  if (connectingFrom === node.id) cls.push("connect-source");
  if (node.hidden) cls.push("hidden");
  if (knowledgeCorpus) {
    cls.push("cnode--knowledge-corpus", "cnode--card-compact");
  } else if (calendarEventPayload) {
    cls.push("cnode--calendar-event", "cnode--card-compact");
  } else if (weatherForecastPayload) {
    cls.push("cnode--weather-forecast", "cnode--card-compact");
  } else if (node.dataType === "text" || node.dataType === "document") {
    cls.push("cnode--card-compact");
  } else if (node.dataType === "video") {
    cls.push("cnode--video");
  } else if (node.canvasKind === "agent" || node.dataType === "agent") {
    cls.push("cnode--agent", "cnode--card-compact");
  }

  if (blueprintColor) cls.push("cnode-in-bp");

  const isEntityNode = isEntityMacroNode(node, nodeEntitiesById);
  const entity = node.noteId ? nodeEntitiesById[node.noteId] : null;
  const docCanvasId = node.dataType === "document" ? (node.docId || node.noteId) : null;
  const showOrphanLinker = Boolean(
    onDocumentAdoptOrphan
    && docCanvasId
    && !knowledgeCorpus
    && node.dataType === "document"
    && orphanEntityCanvasNodes.length > 0,
  );

  const renderOrphanLinker = () => {
    if (!showOrphanLinker) return null;
    return (
      <label className="cnode-parent-field cnode-parent-field--inverse" onPointerDown={(e) => e.stopPropagation()}>
        <span className="cnode-parent-field__label">{t("canvas.linkOrphanNode")}</span>
        <select
          className="cnode-parent-select cnode-adopt-orphan"
          defaultValue=""
          onChange={(e) => {
            e.stopPropagation();
            const orphanCanvasNodeId = e.target.value;
            if (!orphanCanvasNodeId) return;
            onDocumentAdoptOrphan(node.id, orphanCanvasNodeId);
            e.target.value = "";
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("canvas.linkOrphanNode")}
        >
          <option value="">{t("canvas.linkOrphanPlaceholder")}</option>
          {orphanEntityCanvasNodes.map((orphanNode) => {
            const orphanEntity = orphanNode.noteId ? nodeEntitiesById[orphanNode.noteId] : null;
            const label = (orphanEntity?.sourceQuery || orphanEntity?.title || orphanNode.title || t("canvas.adoptNodeUntitled")).trim();
            return (
              <option key={orphanNode.id} value={orphanNode.id}>
                {label}
              </option>
            );
          })}
        </select>
      </label>
    );
  };

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
        if (knowledgeCorpus) return;
        onOpen?.(node.id);
      }}
      onMouseEnter={() => { if (isConnectingFrom && isConnectingFrom !== node.id) onConnectHover?.(node.id); }}
      onMouseLeave={() => onConnectHover?.(null)}
      onMouseUp={(e) => { if (isConnectingFrom && isConnectingFrom !== node.id) onPortMouseUp(node.id); }}
    >
      {timelineQueueMode && selected && selectionIndex != null ? (
        <span className="cnode-select-badge" aria-label={t("canvas.timelineSelectBadge", { index: selectionIndex })}>
          {selectionIndex}
        </span>
      ) : null}
      <div className="cnode-h">
        {calendarEventPayload ? null : editing === "title" ? (
          <input
            className="cnode-k"
            autoFocus
            defaultValue={displayTitle}
            style={{ background: "transparent", border: "none", padding: 0 }}
            onBlur={(e) => { setEditing(null); onEdit(node.id, { title: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter") e.target.blur(); }}
          />
        ) : (
          <span
            className="cnode-k"
            title={displayTitle}
            onClick={(e) => {
              e.stopPropagation();
              // While Select (timeline pick) is on, clicks only mark — don't enter title edit.
              if (timelineQueueMode) return;
              if (canEditCanvasTitle) setEditing("title");
            }}
          >
            {displayTitle}
          </span>
        )}
        <span className="cnode-type" data-t={knowledgeCorpus ? "corpus" : node.dataType}>
          {knowledgeCorpus ? "corpus" : node.dataType === "document" ? "Box" : node.dataType}
        </span>
      </div>
      {renderContent()}
      {renderOrphanLinker()}
      {blueprintColor && (
        <div className="cnode-foot">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <i style={{ width: 6, height: 6, borderRadius: 50, background: blueprintColor.stroke, display: "inline-block" }} />
            {blueprintColor.label}
          </span>
          <span style={{ fontFamily: "var(--mono)" }}>{node.id}</span>
        </div>
      )}
      {showCenterPorts ? (
        <>
          <div
            className={"cnode-port top" + (selConn && selConn.to === node.id ? " rewire-end" : "")}
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
            className={"cnode-port bottom" + (selConn && selConn.from === node.id ? " rewire-end" : "")}
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
        </>
      ) : (
        <>
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
        </>
      )}
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
  onRemoveBlueprintFromCanvas, onCanvasDrop, onClearCanvas,
  docsById = {}, nodeEntitiesById = {}, objectsById = {},
  timelineQueueMode = false,
  timelineSelectEnabled = true,
  onToggleTimelineQueueMode,
  heldObjectId = null,
  heldObjectName = null,
  onToggleObjectHold,
  onTimelineCanvasSelect,
  onTimelineCanvasSelectMany,
  onNotify,
  onRequestDocAdoption,
  onDocumentAdoptOrphan,
  onRunAgent,
  onConnectionCreated,
  scheduledAutoRunEnabled = true,
  onToggleScheduledAutoRun,
}) {
  const { t } = useI18n();
  const completedTaskKeys = useScheduledTasksStore((s) => s.completedTaskKeys);
  const upcomingTasks = useMemo(
    () => listUpcomingScheduledTasks({
      canvasNodes: nodes,
      canvasConns: connections,
      nodeEntities: nodeEntitiesById,
      completedTaskKeys,
    }),
    [nodes, connections, nodeEntitiesById, completedTaskKeys],
  );
  const dueSoonCount = upcomingTasks.filter((task) => !isScheduleNotDue(task.runAt)).length;
  const pendingCount = upcomingTasks.length;
  const effectiveTimelineQueueMode = timelineQueueMode && timelineSelectEnabled;
  const inheritObjMode = useTimelineStore((s) => s.inheritObjMode);
  const primaryTimelineObjectId = useTimelineStore((s) => s.primaryTimelineObjectId);
  const temporalMeta = { docsById, nodeEntitiesById, objectsById };
  const orphanEntityCanvasNodes = useMemo(
    () => listOrphanEntityCanvasNodes(nodes, nodeEntitiesById),
    [nodes, nodeEntitiesById],
  );
  const canvasRef = useRef(null);
  const importInputRef = useRef(null);
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
  const viewRef = useRef(view);
  viewRef.current = view;
  const viewAnimRef = useRef(0);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(null);
  const [importedImage, setImportedImage] = useState(null);
  const importedImageDrag = useRef(null);
  const importedImageResize = useRef(null);
  const panDrag = useRef(null);
  const PAN_CLICK_THRESHOLD = 5;
  const marqueeDrag = useRef(null);

  const selectionIndexById = useMemo(() => {
    const map = new Map();
    selection.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [selection]);

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

  const animateViewTo = useCallback((targetView, duration = 280) => {
    if (!targetView) return;
    if (viewAnimRef.current) cancelAnimationFrame(viewAnimRef.current);
    const start = { ...viewRef.current };
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - (1 - t) ** 3;
      setView({
        scale: start.scale + (targetView.scale - start.scale) * ease,
        panX: start.panX + (targetView.panX - start.panX) * ease,
        panY: start.panY + (targetView.panY - start.panY) * ease,
      });
      if (t < 1) {
        viewAnimRef.current = requestAnimationFrame(tick);
      } else {
        viewAnimRef.current = 0;
      }
    };
    viewAnimRef.current = requestAnimationFrame(tick);
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
      const tag = e.target?.tagName;
      const inEditable = tag === "INPUT" || tag === "TEXTAREA"
        || e.target?.isContentEditable
        || e.target.closest?.(
          ".doc-agent-cell__input, .doc-agent-cell, textarea, input, [contenteditable='true']",
        );
      if (inEditable) return;
      if (e.target.closest?.(".doc-step-sequence, .doc-overlay-global, .steps-runner-overlay, .doc-block-stack")) return;
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
      const tag = e.target?.tagName;
      const inEditable = tag === "INPUT" || tag === "TEXTAREA"
        || e.target?.isContentEditable
        || e.target.closest?.(
          ".doc-agent-cell__input, .doc-agent-cell, textarea, input, [contenteditable='true']",
        );
      if (inEditable) return;
      if (e.target.closest?.(".doc-step-sequence, .doc-overlay-global, .steps-runner-overlay, .doc-block-stack")) return;
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
      if (shouldStartCanvasMarquee(e.shiftKey, effectiveTimelineQueueMode)) {
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
      let selectedNodeIds = nodes
        .filter((n) => !n.hidden && rectIntersectsNode(rect, n))
        .map((n) => n.id);
      selectedNodeIds = filterSelectableCanvasNodeIds(
        selectedNodeIds,
        nodes,
        nodeEntitiesById,
        docsById,
      );
      if (!effectiveTimelineQueueMode && selectedNodeIds.length > 1) {
        selectedNodeIds = [selectedNodeIds[selectedNodeIds.length - 1]];
      }
      const selectedStrokeIdx = strokes
        .map((s, idx) => (rectIntersectsStroke(rect, s) ? idx : -1))
        .filter((idx) => idx >= 0);
      if (effectiveTimelineQueueMode && selectedNodeIds.length > 0) {
        // Gate each id (already-on-timeline) before accumulating picks.
        const allowedIds = selectedNodeIds.filter(
          (id) => onTimelineCanvasSelect?.(id) !== false,
        );
        if (allowedIds.length > 0) {
          setSelection((prev) => [...new Set([...prev, ...allowedIds])]);
        }
      } else {
        setSelection(selectedNodeIds);
      }
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
          if (shouldStartCanvasMarquee(e.shiftKey, effectiveTimelineQueueMode)) {
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
    const allowed = onTimelineCanvasSelect?.(id);
    if (effectiveTimelineQueueMode) {
      if (allowed === false) return;
      setSelection((sel) => (sel.includes(id) ? sel : [...sel, id]));
      return;
    }
    if (allowed === false) return;
    setSelection([id]);
  };

  const handleTapToggle = (id) => {
    if (!effectiveTimelineQueueMode) return;
    setSelectedConnectionId(null);
    setSelectedStrokeIds([]);
    focusNoteForNode(id);
    const wasSelected = selection.includes(id);
    if (wasSelected) {
      setSelection((sel) => sel.filter((x) => x !== id));
    } else {
      const allowed = onTimelineCanvasSelect?.(id);
      if (allowed === false) return;
      setSelection((sel) => (sel.includes(id) ? sel : [...sel, id]));
    }
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
    if (node) {
      const useCenter = shouldShowCrossFamilyCenterPorts(node, {
        inheritObjMode,
        canvasNodes: nodes,
        docsById,
        nodeEntitiesById,
        connectingFromId: id,
        objectsById,
      });
      const w = node._w || 200;
      const h = node._h || 80;
      setHoverConnect(useCenter
        ? { x: node.x + w / 2, y: node.y + h }
        : { x: node.x + w, y: node.y + h / 2 });
    }
  };

  const connectionValidationContext = useMemo(
    () => ({
      canvasNodes: nodes,
      connections,
      docsById,
      nodeEntitiesById,
      objectsById,
      inheritObjMode,
    }),
    [nodes, connections, docsById, nodeEntitiesById, objectsById, inheritObjMode],
  );

  const notifyConnectionError = useCallback((message) => {
    if (message) onNotify?.(message, "warm");
  }, [onNotify]);

  const validateEdge = useCallback((fromId, toId, excludeConnectionId = null) => {
    const result = validateCanvasConnectionAttempt({
      fromNodeId: fromId,
      toNodeId: toId,
      excludeConnectionId,
      ...connectionValidationContext,
    });
    if (!result.ok) notifyConnectionError(result.message);
    return result.ok;
  }, [connectionValidationContext, notifyConnectionError]);

  const connectionLayoutFor = useCallback((fromId, toId) => {
    const classified = classifyConnectionRecord(
      { id: "draft", from: fromId, to: toId },
      nodes,
      docsById,
      nodeEntitiesById,
      objectsById,
    );
    return isCrossFamilyConnectionKind(classified.kind) ? "vertical" : "horizontal";
  }, [nodes, docsById, nodeEntitiesById, objectsById]);

  const handleStartRewire = (connId, end) => {
    const c = connections.find((x) => x.id === connId);
    if (!c) return;
    setRewiring({ connId, end });
    setConnectingFrom(null);
    setConnectHoverTarget(null);
    const layout = connectionLayoutFor(c.from, c.to);
    if (end === "from") {
      const node = nodes.find((n) => n.id === c.from);
      if (node) {
        const w = node._w || 200;
        const h = node._h || 80;
        setHoverConnect(layout === "vertical"
          ? { x: node.x + w / 2, y: node.y + h }
          : { x: node.x + w, y: node.y + h / 2 });
      }
    } else {
      const node = nodes.find((n) => n.id === c.to);
      if (node) {
        const w = node._w || 200;
        const h = node._h || 80;
        setHoverConnect(layout === "vertical"
          ? { x: node.x + w / 2, y: node.y }
          : { x: node.x, y: node.y + h / 2 });
      }
    }
  };

  const handlePortMouseUp = (portNodeId) => {
    const clearConnectState = () => {
      setConnectingFrom(null);
      setHoverConnect(null);
      setConnectHoverTarget(null);
    };

    const applyAdoptionAndConnect = async (fromId, toId, excludeConnectionId, mutateConns) => {
      if (!validateEdge(fromId, toId, excludeConnectionId)) {
        clearConnectState();
        setRewiring(null);
        return false;
      }

      const normalized = normalizeCrossFamilyConnectionEndpoints(fromId, toId, {
        canvasNodes: nodes,
        docsById,
        nodeEntitiesById,
        objectsById,
        primaryObjectId: primaryTimelineObjectId,
      });
      const nextFrom = normalized.from;
      const nextTo = normalized.to;

      const fromNode = nodes.find((n) => n.id === nextFrom);
      const toNode = nodes.find((n) => n.id === nextTo);
      const adoption = detectDocAdoptionOnConnect(
        fromNode,
        toNode,
        nodeEntitiesById,
        docsById,
      );

      if (adoption && onRequestDocAdoption) {
        await onRequestDocAdoption(adoption);
      }

      setConnections((conns) => mutateConns(conns, nextFrom, nextTo));
      clearConnectState();
      setRewiring(null);
      return { ok: true, from: nextFrom, to: nextTo };
    };

    if (rewiring) {
      const { connId, end } = rewiring;
      const c = connections.find((x) => x.id === connId);
      if (!c) {
        setRewiring(null);
        setHoverConnect(null);
        setConnectHoverTarget(null);
        return;
      }
      let nextFrom = c.from;
      let nextTo = c.to;
      if (end === "from") {
        if (portNodeId === c.to) {
          setRewiring(null);
          setHoverConnect(null);
          setConnectHoverTarget(null);
          return;
        }
        nextFrom = portNodeId;
      } else {
        if (portNodeId === c.from) {
          setRewiring(null);
          setHoverConnect(null);
          setConnectHoverTarget(null);
          return;
        }
        nextTo = portNodeId;
      }
      if (connections.some((x) => x.id !== connId && x.from === nextFrom && x.to === nextTo)) {
        setRewiring(null);
        setHoverConnect(null);
        setConnectHoverTarget(null);
        return;
      }
      void applyAdoptionAndConnect(nextFrom, nextTo, connId, (conns, hostFrom, guestTo) => {
        const existing = conns.find((x) => x.id === connId);
        if (!existing) return conns;
        return conns.map((x) => (x.id === connId ? { ...x, from: hostFrom, to: guestTo } : x));
      });
      return;
    }

    if (!connectingFrom || connectingFrom === portNodeId) {
      clearConnectState();
      return;
    }

    const fromId = connectingFrom;
    const toId = portNodeId;
    if (connections.some((c) => c.from === fromId && c.to === toId)) {
      clearConnectState();
      return;
    }

    void applyAdoptionAndConnect(fromId, toId, null, (conns, hostFrom, guestTo) => {
      if (conns.some((c) => c.from === hostFrom && c.to === guestTo)) return conns;
      return [...conns, { from: hostFrom, to: guestTo, id: shortId("CN") }];
    }).then((result) => {
      if (result?.ok) onConnectionCreated?.(result.from, result.to);
    });
  };

  /* connection path helpers */
  const nodeAnchor = (n, side) => {
    const w = n._w || 200;
    const h = n._h || 80;
    if (side === "right") return { x: n.x + w, y: n.y + h / 2 };
    if (side === "left") return { x: n.x, y: n.y + h / 2 };
    if (side === "bottom") return { x: n.x + w / 2, y: n.y + h };
    if (side === "top") return { x: n.x + w / 2, y: n.y };
    return { x: n.x, y: n.y + h / 2 };
  };

  const pathBetweenPoints = (p1, p2, layout = "horizontal") => {
    if (layout === "vertical") {
      const dy = p2.y - p1.y;
      const k = Math.max(40, Math.abs(dy) * 0.4);
      return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + k}, ${p2.x} ${p2.y - k}, ${p2.x} ${p2.y}`;
    }
    const dx = p2.x - p1.x;
    const k = Math.max(40, Math.abs(dx) * 0.4);
    return `M ${p1.x} ${p1.y} C ${p1.x + k} ${p1.y}, ${p2.x - k} ${p2.y}, ${p2.x} ${p2.y}`;
  };

  const endpointsForConnection = (fromNode, toNode, layout) => {
    if (layout === "vertical") {
      return { p1: nodeAnchor(fromNode, "bottom"), p2: nodeAnchor(toNode, "top") };
    }
    return { p1: nodeAnchor(fromNode, "right"), p2: nodeAnchor(toNode, "left") };
  };

  const pathBetween = (a, b, layout = "horizontal") => pathBetweenPoints(a, b, layout);

  const getRewireAnchor = () => {
    if (!rewiring) return null;
    const c = connections.find((x) => x.id === rewiring.connId);
    if (!c) return null;
    const fixed = rewiring.end === "from"
      ? nodes.find((n) => n.id === c.to)
      : nodes.find((n) => n.id === c.from);
    if (!fixed) return null;
    const layout = connectionLayoutFor(c.from, c.to);
    if (layout === "vertical") {
      return rewiring.end === "from"
        ? nodeAnchor(fixed, "top")
        : nodeAnchor(fixed, "bottom");
    }
    return rewiring.end === "from" ? nodeAnchor(fixed, "left") : nodeAnchor(fixed, "right");
  };

  const renderPendingConnection = () => {
    if (!(connectingFrom || rewiring) || !hoverConnect) return null;
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
        const layout = target && c?.to ? connectionLayoutFor(target.id, c.to) : "horizontal";
        p2 = fixed;
        p1 = target
          ? nodeAnchor(target, layout === "vertical" ? "bottom" : "right")
          : hoverConnect;
        a = target;
        b = nodes.find((n) => n.id === c?.to);
      } else {
        const layout = c?.from && target ? connectionLayoutFor(c.from, target.id) : "horizontal";
        p1 = fixed;
        p2 = target
          ? nodeAnchor(target, layout === "vertical" ? "top" : "left")
          : hoverConnect;
        a = nodes.find((n) => n.id === c?.from);
        b = target;
      }
    } else {
      a = nodes.find((n) => n.id === connectingFrom);
      if (!a) return null;
      const target = connectHoverTarget ? nodes.find((n) => n.id === connectHoverTarget) : null;
      const layout = target ? connectionLayoutFor(a.id, target.id) : "horizontal";
      p1 = nodeAnchor(a, layout === "vertical" ? "bottom" : "right");
      p2 = target
        ? nodeAnchor(target, layout === "vertical" ? "top" : "left")
        : hoverConnect;
      b = target;
    }
    const label = a && b
      ? resolveCanvasWireTemporalLabel(
        a,
        b,
        today,
        nodes,
        connections,
        blueprints,
        temporalMeta,
        computeEdgeTemporalLabel,
      )
      : null;
    const mid = bezierMidpoint(p1, p2);
    const layout = a && b ? connectionLayoutFor(a.id, b.id) : "horizontal";
    return (
      <g>
        <path className="conn pending" d={pathBetween(p1, p2, layout)} markerEnd="url(#arrow-pending)" />
        {label && <ConnLabel x={mid.x} y={mid.y} text={label} pending />}
      </g>
    );
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
    const visibleCount = nodes.filter((n) => !n.hidden).length;
    if (!visibleCount && !connections.length && !strokes.length && !importedImage) return;
    if (!window.confirm(t("canvas.clearConfirm"))) return;
    if (onClearCanvas) {
      onClearCanvas();
    } else {
      setNodes([]);
      setConnections([]);
      setBlueprints([]);
    }
    setStrokes([]);
    setRulerPt1(null);
    setSelection([]);
    setSelectedStrokeIds([]);
    setSelectedBlueprintId(null);
    setSelectedConnectionId(null);
    setImportedImage(null);
  };

  const handleOrganize = () => {
    const visibleCount = nodes.filter((n) => !n.hidden).length;
    if (visibleCount < 2) return;
    setNodes((all) => organizeCanvasNodes(all));
    setSelection([]);
    setSelectedBlueprintId(null);
  };

  const wiredNodeCount = useMemo(
    () => getWiredVisibleNodeIds(nodes, connections).size,
    [nodes, connections],
  );

  const handleSpotlightConnected = () => {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect || wiredNodeCount < 1) return;
    const nextView = computeSpotlightView({
      nodes,
      connections,
      selection,
      stageRect,
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
    });
    animateViewTo(nextView);
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

  const handleImportClick = () => {
    const hasCanvasCards = nodes.some((n) => !n.hidden);
    if (hasCanvasCards) {
      window.alert(t("canvas.importNeedsClear"));
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const stage = stageRef.current?.getBoundingClientRect();
        const maxW = Math.min(420, Math.round((stage?.width || 960) * 0.5));
        const naturalW = img.naturalWidth || 240;
        const naturalH = img.naturalHeight || 180;
        const scale = naturalW > maxW ? maxW / naturalW : 1;
        const width = Math.max(120, Math.round(naturalW * scale));
        const height = Math.max(80, Math.round(naturalH * scale));
        setImportedImage({
          src,
          name: file.name || "imported-image",
          x: 120,
          y: 90,
          width,
          height,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleImportedImagePointerDown = (e) => {
    if (!importedImage) return;
    if (e.target.closest(".canvas-import-image__remove")) return;
    e.preventDefault();
    e.stopPropagation();
    importedImageDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      x: importedImage.x,
      y: importedImage.y,
    };
    const move = (ev) => {
      const drag = importedImageDrag.current;
      if (!drag) return;
      setImportedImage((prev) => (prev
        ? {
            ...prev,
            x: drag.x + (ev.clientX - drag.startX) / view.scale,
            y: drag.y + (ev.clientY - drag.startY) / view.scale,
          }
        : prev));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      importedImageDrag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const handleImportedImageResizePointerDown = (e) => {
    if (!importedImage) return;
    e.preventDefault();
    e.stopPropagation();
    importedImageResize.current = {
      startX: e.clientX,
      startY: e.clientY,
      width: importedImage.width,
      height: importedImage.height,
    };
    const move = (ev) => {
      const resize = importedImageResize.current;
      if (!resize) return;
      const nextW = Math.max(80, resize.width + (ev.clientX - resize.startX) / view.scale);
      const nextH = Math.max(60, resize.height + (ev.clientY - resize.startY) / view.scale);
      setImportedImage((prev) => (prev ? { ...prev, width: nextW, height: nextH } : prev));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      importedImageResize.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
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
        <input
          ref={importInputRef}
          type="file"
          accept="image/*"
          onChange={handleImportFileChange}
          style={{ display: "none" }}
        />
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

        {timelineSelectEnabled ? (
          <>
            <button
              type="button"
              className={"btn xs btn-timeline-select" + (timelineQueueMode ? " primary is-active" : " ghost")}
              onClick={onToggleTimelineQueueMode}
              title={t("canvas.timelineSelectTitle")}
            >
              {t("canvas.timelineSelect")}
            </button>
            <button
              type="button"
              className="btn xs primary"
              disabled={!effectiveTimelineQueueMode || selection.length === 0}
              onClick={onInsertToTimeline}
              title={
                timelineQueueMode && selection.length > 0
                  ? t("canvas.insertToTimelineTitle")
                  : t("canvas.insertToTimelineDisabled")
              }
            >
              {t("canvas.insertToTimeline")}
            </button>
            <button
              type="button"
              className={"btn xs btn-scheduled-auto" + (scheduledAutoRunEnabled ? " primary is-active" : " ghost")}
              onClick={onToggleScheduledAutoRun}
              title={t("canvas.scheduledAutoRunTitle")}
            >
              {t("canvas.scheduledAutoRun")}
              {pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          </>
        ) : null}
        {typeof onToggleObjectHold === "function" ? (
          <button
            type="button"
            className={
              "btn xs btn-import-object"
              + (heldObjectId ? " is-active" : " ghost")
            }
            onClick={onToggleObjectHold}
            title={
              heldObjectId
                ? t("canvas.importObjectHeldTitle", { name: heldObjectName || "Company" })
                : t("canvas.importObjectTitle")
            }
          >
            {heldObjectId
              ? t("canvas.importObjectHeld", { name: heldObjectName || "Company" })
              : t("canvas.importObject")}
          </button>
        ) : null}
        {hiddenCount > 0 && (
          <button className="btn xs" onClick={handleShowAll} title={t("canvas.showAllTitle")}>
            <Icon name="show" size={11} /> {t("canvas.showAll")}
          </button>
        )}
        <button
          type="button"
          className="btn xs"
          onClick={handleSpotlightConnected}
          disabled={wiredNodeCount < 1}
          title={t("canvas.spotlightTitle")}
        >
          <Icon name="focus" size={11} /> {t("canvas.spotlight")}
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={handleOrganize}
          disabled={visibleNodes.length < 2}
          title={t("canvas.organizeTitle")}
        >
          <Icon name="grid" size={11} /> {t("canvas.organize")}
        </button>
        <button className="btn xs ghost" onClick={handleClear} title={t("canvas.clearTitle")}>
          <Icon name="clear" size={11} /> {t("canvas.clear")}
        </button>
        <button className="btn xs" onClick={handleImportClick}><Icon name="import" size={11} /> Import</button>
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
        className={
          "canvas-stage"
          + (tool === "select" ? " pan-ready" : "")
          + (effectiveTimelineQueueMode ? " canvas-stage--timeline-select" : "")
        }
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

        {importedImage ? (
          <div
            className="canvas-import-image"
            style={{
              left: importedImage.x,
              top: importedImage.y,
              width: importedImage.width,
              height: importedImage.height,
            }}
            onPointerDown={handleImportedImagePointerDown}
          >
            <img
              src={importedImage.src}
              alt={importedImage.name}
              className="canvas-import-image__img"
              draggable={false}
            />
            <button
              type="button"
              className="canvas-import-image__remove"
              onClick={(e) => {
                e.stopPropagation();
                setImportedImage(null);
              }}
              title="Remove imported image"
            >
              ×
            </button>
            <div
              className="canvas-import-image__resize"
              onPointerDown={handleImportedImageResizePointerDown}
              title="Stretch image"
            />
          </div>
        ) : null}

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
            const layout = connectionLayoutFor(c.from, c.to);
            const { p1, p2 } = endpointsForConnection(a, b, layout);
            const d = pathBetween(p1, p2, layout);
            const label = resolveCanvasWireTemporalLabel(
              a,
              b,
              today,
              nodes,
              connections,
              blueprints,
              temporalMeta,
              computeEdgeTemporalLabel,
            );
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
        </svg>

        {/* nodes */}
        {nodes.map((n) => {
          const timelineSelectable = isTimelineSelectableCanvasNode(
            n,
            nodeEntitiesById,
            docsById,
          );
          return (
          <CanvasNode
            key={n.id}
            node={n}
            today={today}
            selected={selection.includes(n.id)}
            timelineSelectable={timelineSelectable}
            timelineQueueMode={effectiveTimelineQueueMode}
            selectionIndex={selectionIndexById.get(n.id)}
            connectingFrom={connectingFrom}
            isConnectingFrom={!!connectingFrom}
            rewiring={rewiring}
            blueprintColor={blueprintByNodeId[n.id]}
            allNodes={nodes}
            allConnections={connections}
            selectedConnectionId={selectedConnectionId}
            connections={connections}
            showCenterPorts={shouldShowCrossFamilyCenterPorts(n, {
              inheritObjMode,
              canvasNodes: nodes,
              docsById,
              nodeEntitiesById,
              connectingFromId: connectingFrom,
              rewiring,
              connections,
              objectsById,
            })}
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
            onDocumentAdoptOrphan={onDocumentAdoptOrphan}
            orphanEntityCanvasNodes={orphanEntityCanvasNodes}
            onRunAgent={onRunAgent}
          />
          );
        })}

        {/* active wire preview — above nodes so pending/rewire lines stay visible */}
        <svg className="canvas-svg canvas-svg--overlay" aria-hidden>
          {renderPendingConnection()}
        </svg>

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

        {effectiveTimelineQueueMode ? (
          <div className="canvas-timeline-select-hint" role="status">
            <span className="canvas-timeline-select-hint__dot" aria-hidden />
            <span>
              {selection.length > 0
                ? t("canvas.timelineSelectedCount", { count: selection.length })
                : t("canvas.timelineSelectActive")}
            </span>
            <span className="canvas-timeline-select-hint__sub">
              {t("canvas.timelineSelectHint")}
            </span>
          </div>
        ) : null}

        <div className="canvas-coords">
          <span>X <b>{hoverPos ? Math.round(hoverPos.x) : "—"}</b></span>
          <span>Y <b>{hoverPos ? Math.round(hoverPos.y) : "—"}</b></span>
          <span>· {visibleNodes.length}/{nodes.length} nodes · {connections.length} edges · {blueprints.length} blueprints</span>
        </div>
        <div className="canvas-status">
          {selectedConnectionId && (
            <span className="pill warm"><i className="dot" />Edge selected · Del to remove · drag port to reassign</span>
          )}
          {selection.length > 0 && !effectiveTimelineQueueMode && (
            <span className="pill ai">
              <i className="dot" />
              {t("canvas.nodeSelectedCount", { count: selection.length })}
            </span>
          )}
          {effectiveTimelineQueueMode && selection.length > 0 && (
            <span className="pill ok">
              <i className="dot" />
              {t("canvas.timelineSelectedCount", { count: selection.length })}
            </span>
          )}
          {scheduledAutoRunEnabled && pendingCount > 0 && (
            <span className="pill cool" title={upcomingTasks.map((task) => `${task.title} · ${formatScheduleAtLabel(task.runAt)}`).join("\n")}>
              <i className="dot" />
              {dueSoonCount > 0
                ? t("canvas.scheduledDueCount", { count: dueSoonCount })
                : t("canvas.scheduledPendingCount", { count: pendingCount })}
            </span>
          )}
          <span className="pill ok"><i className="dot" />Canvas · Live</span>
        </div>

        {nodes.length === 0 && strokes.length === 0 && !importedImage && (
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
        {nodes.length > 0 && visibleNodes.length === 0 && !importedImage && (
          <div className="canvas-empty">
            <div className="canvas-empty-card">
              <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("canvas.allHiddenTitle")}</div>
              <h3>{t("canvas.allHiddenCount", { count: hiddenCount })}</h3>
              <p>{t("canvas.allHiddenHint")}</p>
              <button className="btn primary" onClick={handleShowAll}>{t("canvas.showAll")}</button>
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
