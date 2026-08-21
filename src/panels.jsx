import { useState, useEffect, useRef, useMemo } from 'react';
import { daysBetween, fmtDate, timelineWindowDays } from './data.jsx';
import { Sidebar } from './components/sidebar/Sidebar.jsx';
import { FuturaCanvas } from './components/canvas/FuturaCanvas.jsx';
import {
  parseDate,
  computeEdgeTemporalLabel,
  noteToTrackItem,
  timelineNodeLeftPct,
  computeTimelineRange,
  assignTimelineChipLanes,
  resolveNodeAnchorDate,
  buildChipDisplay,
} from './temporal.js';
import { TimelineEventChip } from './components/timeline/TimelineEventChip.jsx';
import { TacticalTimeline } from './components/timeline/TacticalTimeline.jsx';
import { useTimelineStore, useUIStateStore } from './stores/index.js';
import { CalendarPanel, getScheduleHintForNode } from './components/intel/CalendarPanel.jsx';
import { MarketHypePanel } from './components/intel/MarketHypePanel.jsx';
import { LaunchPredictor } from './components/analytics/LaunchPredictor.jsx';
import { ForecastPanel } from './components/intel/ForecastPanel.jsx';
import { ForecastSearchFooter } from './components/intel/ForecastSearchFooter.jsx';
import { VideoReferencePanel } from './components/intel/VideoReferencePanel.jsx';
import { StudioPanel } from './components/studio/StudioPanel.jsx';
import { IntelModelSelect } from './components/intel/IntelModelSelect.jsx';
import { clearStudioSessionDraft } from './lib/studioConfig.js';
import { resolveActiveForecastNode } from './lib/forecastSearch.js';
import { resolveCurrentCorpus, resolveIntelCampaignBrand } from './lib/currentCorpus.js';
import { resolveLaunchRadarObjectId } from './lib/agents/resolveLaunchRadarObjectId.js';
import { isCalendarEventNodeContent } from './lib/eventCalendarSearch.js';
import { isWeatherForecastNodeContent } from './lib/forecastSearch.js';
import { CalendarEventNodeView } from './components/intel/CalendarEventNodeView.jsx';
import { ForecastNodeView } from './components/intel/ForecastNodeView.jsx';
import { useI18n } from './i18n/useI18n.js';
import { usePlanStore } from './stores/planStore.js';
import { isIntelPanelLocked } from './lib/planConfig.js';
import { PlanFeatureGate } from './components/plans/PlanFeatureGate.jsx';
import { useUpgradeModalStore } from './stores/upgradeModalStore.js';

const INTEL_EMBED_LINK_ICON = "/uploads/url-table.svg";

/* panels.jsx — Notes panel (left), Intel panel (right), Stacked Timelines */

const DATA_TYPES = [
  { id: "text", label: "Text" },
  { id: "date", label: "Date" },
];

/* ─── NEW NOTE FORM (inline) ───────────────────────── */

function NewNoteForm({ onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [dataType, setDataType] = useState("text");
  const [content, setContent] = useState("");
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const commit = () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    onSave({ title: title.trim(), dataType, content });
  };

  return (
    <div className="note new-note-form">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span className="label" style={{ color: "var(--hud)" }}>New note</span>
        <button className="btn xs ghost" onClick={onCancel}>✕</button>
      </div>
      <input
        ref={titleRef}
        className="note-form-field"
        placeholder="Title (e.g. Campaign, Niche, Announcement)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      />
      <div className="note-form-row">
        <span className="label">Type</span>
        <div className="tabs" style={{ flex: 1 }}>
          <div className="tabs-thumb" style={{
            left: 2 + (DATA_TYPES.findIndex((t) => t.id === dataType) * ((100 - 0.5) / DATA_TYPES.length)) + "%",
            width: `calc((100% - 4px) / ${DATA_TYPES.length})`,
          }} />
          {DATA_TYPES.map((t) => (
            <button key={t.id}
                    data-on={dataType === t.id ? "1" : "0"}
                    onClick={() => setDataType(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      {dataType === "text" && (
        <textarea
          className="note-form-field"
          placeholder="Content…"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit(); if (e.key === "Escape") onCancel(); }}
        />
      )}
      {dataType === "date" && (
        <input
          type="date"
          className="note-form-field"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
        />
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button className="btn xs ghost" onClick={onCancel}>Cancel</button>
        <button className="btn xs primary" onClick={commit}>Save · Free</button>
      </div>
    </div>
  );
}

/* ─── NOTE CARD ─────────────────────────────────────── */

function NoteCard({
  note, today, focused, onUpdate, onDelete, onInsertNode, onInsertBlueprint,
  hasBlueprintAction, hasVisibleCanvasNode,
}) {
  const isAI = note.kind === "ai";
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title || "");
  const [editContent, setEditContent] = useState(
    note.dataType === "metric" ? String((note.content || {}).value ?? "") : String(note.content ?? ""),
  );
  const [editMetricUnit, setEditMetricUnit] = useState((note.content || {}).unit || "");
  const cardRef = useRef(null);

  useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focused]);

  useEffect(() => {
    if (!editing) {
      setEditTitle(note.title || "");
      setEditContent(
        note.dataType === "metric" ? String((note.content || {}).value ?? "") : String(note.content ?? ""),
      );
      setEditMetricUnit((note.content || {}).unit || "");
    }
  }, [note, editing]);

  const startEdit = () => {
    setEditTitle(note.title || "");
    setEditContent(
      note.dataType === "metric" ? String((note.content || {}).value ?? "") : String(note.content ?? ""),
    );
    setEditMetricUnit((note.content || {}).unit || "");
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    let content = editContent;
    if (note.dataType === "metric") {
      const num = Number(editContent);
      content = { value: isNaN(num) ? editContent : num, unit: editMetricUnit };
    } else if (note.dataType === "text" && isCalendarEventNodeContent(note.content)) {
      content = note.content;
    } else if (note.dataType === "text" && isWeatherForecastNodeContent(note.content)) {
      content = note.content;
    }
    onUpdate({ ...note, title: editTitle.trim(), content });
    setEditing(false);
  };

  const cls = "note" + (isAI ? " ai" : "") + (focused ? " note-focus" : "");

  const renderContent = () => {
    if (editing && !isAI) {
      return (
        <>
          <input
            className="note-form-field"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
          />
          {note.dataType === "text" && (
            isCalendarEventNodeContent(note.content) ? (
              <CalendarEventNodeView content={note.content} />
            ) : isWeatherForecastNodeContent(note.content) ? (
              <ForecastNodeView content={note.content} />
            ) : (
              <textarea
                className="note-form-field"
                rows={3}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            )
          )}
          {note.dataType === "date" && (
            <input
              type="date"
              className="note-form-field"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          )}
          {note.dataType === "metric" && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                className="note-form-field"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="text"
                className="note-form-field"
                placeholder="Unit"
                value={editMetricUnit}
                onChange={(e) => setEditMetricUnit(e.target.value)}
                style={{ width: 70 }}
              />
            </div>
          )}
        </>
      );
    }
    if (isAI) {
      // AI notes — large narrative
      return (
        <>
          {note.title && <div className="note-title" title={note.title}>{note.title}</div>}
          <div className="note-body">{note.content}</div>
        </>
      );
    }
    // Manual typed note
    if (note.dataType === "text") {
      if (isCalendarEventNodeContent(note.content)) {
        return (
          <>
            <div className="note-title" title={note.title}>{note.title}</div>
            <CalendarEventNodeView content={note.content} className="note-body" />
          </>
        );
      }
      if (isWeatherForecastNodeContent(note.content)) {
        return (
          <>
            <div className="note-title" title={note.title}>{note.title}</div>
            <ForecastNodeView content={note.content} className="note-body" />
          </>
        );
      }
      return (
        <>
          <div className="note-title" title={note.title}>{note.title}</div>
          <div className="note-body">{String(note.content) || <span style={{ color: "var(--mute)" }}>(empty)</span>}</div>
        </>
      );
    }
    if (note.dataType === "date") {
      const d = parseDate(note.content);
      const dd = d && !isNaN(d) ? d : null;
      const countdown = dd && today ? daysBetween(today, dd) : null;
      return (
        <>
          <div className="note-title" title={note.title}>{note.title}</div>
          <div className="note-body" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{dd ? fmtDate(dd) : "—"}</span>
            {countdown != null && (
              <span className="mono" style={{ fontSize: 11, color: countdown > 0 ? "var(--warm)" : countdown < 0 ? "var(--dim)" : "var(--hud)" }}>
                {countdown > 0 ? `T−${countdown}d` : countdown < 0 ? `T+${-countdown}d` : "TODAY"}
              </span>
            )}
          </div>
        </>
      );
    }
    if (note.dataType === "metric") {
      const c = note.content || {};
      return (
        <>
          <div className="note-title" title={note.title}>{note.title}</div>
          <div className="note-body" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--hud)", letterSpacing: "-0.01em" }}>{c.value ?? "—"}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>{c.unit || ""}</span>
          </div>
        </>
      );
    }
    return <div className="note-body">{String(note.content || "")}</div>;
  };

  return (
    <div ref={cardRef} className={cls} data-note-id={note.id}>
      <div className="note-h">
        <div className="note-h-l">
          {isAI ? (
            <span className="pill ai"><i className="dot" />AI · {note.cost != null ? note.cost : 1}</span>
          ) : (
            <span className="pill"><i className="dot" />Manual</span>
          )}
          {!isAI && (
            <span className="note-type-tag" data-t={note.dataType}>{note.dataType}</span>
          )}
          {note.source && (
            <span className="note-source">{note.source}</span>
          )}
        </div>
        <span className="note-id">{note.id}</span>
      </div>

      {renderContent()}

      <div className="note-meta">
        <span>{note.timestamp}</span>
        <span className="actions">
          {!isAI && !editing && (
            <button className="btn xs ghost" onClick={startEdit}>Edit</button>
          )}
          {editing && (
            <>
              <button className="btn xs primary" onClick={saveEdit}>Save</button>
              <button className="btn xs ghost" onClick={() => setEditing(false)}>Cancel</button>
            </>
          )}
          {!hasVisibleCanvasNode && !editing && (
            <button
              className="btn xs primary"
              title="Add this note as a single node on the canvas (not a blueprint)"
              onClick={onInsertNode}
            >
              Add node
            </button>
          )}
          {isAI && hasBlueprintAction && !editing && (
            <button
              className="btn xs primary"
              title="Auto-split this AI overview into typed notes, drop as connected nodes, and group as a Blueprint"
              onClick={onInsertBlueprint}
            >▸ Insert Blueprint</button>
          )}
          {!editing && (
            <button type="button" className="icon-del-btn" onClick={onDelete}>×</button>
          )}
        </span>
      </div>
    </div>
  );
}

/* ─── BLUEPRINT STACK (Notes mockup) ──────────────────── */

function blueprintPreviewText(bpNotes) {
  const textNote = bpNotes.find((n) => n.dataType === "text" && n.content);
  const n = textNote || bpNotes.find((x) => x.content) || bpNotes[0];
  if (!n) return "";
  if (n.dataType === "text") return String(n.content);
  if (n.dataType === "date") {
    const d = parseDate(n.content);
    return d ? fmtDate(d, "short") : n.title || "";
  }
  return n.title || String(n.content ?? "");
}

function BlueprintCard({
  blueprint, bpNotes, expanded, isFocusedGroup, onToggle, onDelete,
  onRestore, onRemove, showRemove, renderNote,
}) {
  const preview = blueprintPreviewText(bpNotes);
  const bpStyle = { "--bp-accent": blueprint.color.stroke, "--bp-soft": blueprint.color.soft };

  return (
    <div
      className={
        "notes-bp-card" +
        (expanded ? " expanded" : "") +
        (isFocusedGroup ? " notes-bp-group-focus" : "")
      }
      style={bpStyle}
    >
      <div
        className="notes-bp-card-header"
        role="button"
        tabIndex={0}
        title={expanded ? "Click to collapse" : "Click to expand"}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <span className="notes-bp-stack-pill">
          <i className="notes-bp-stack-dot" />
          {blueprint.label}
        </span>
        <button
          type="button"
          className="notes-bp-stack-del icon-del-btn"
          title="Delete blueprint"
          onClick={(e) => { e.stopPropagation(); onDelete(blueprint.id); }}
        >
          ×
        </button>
      </div>
      {expanded ? (
        <>
          <div className="notes-bp-card-body">
            {bpNotes.map(renderNote)}
          </div>
          <div className="notes-bp-card-footer">
            <button type="button" className="notes-bp-text-btn" onClick={() => onRestore(blueprint)}>
              Add to canvas
            </button>
            {showRemove && (
              <button type="button" className="notes-bp-text-btn muted" onClick={() => onRemove(blueprint)}>
                remove
              </button>
            )}
          </div>
        </>
      ) : (
        <div
          className="notes-bp-card-preview"
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => e.key === "Enter" && onToggle()}
        >
          <p>{preview || <span className="notes-bp-stack-empty">No preview</span>}</p>
        </div>
      )}
    </div>
  );
}

/* ─── NOTES PANEL ─────────────────────────────────────── */

function NotesPanel({
  notes, blueprints, today, hasVisibleCanvasNode, focusedNoteId, onFocusNote,
  onSaveManual, onUpdateNote, onDeleteNote, onDeleteBlueprint, onRestoreBlueprint,
  onRemoveBlueprintFromCanvas, blueprintOnCanvas,
  onInsertNode, onInsertBlueprint,
  tokens, manualCount, aiCount,
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedStackId, setExpandedStackId] = useState(null);
  const formAnchorRef = useRef(null);

  const ungrouped = notes.filter((n) => !n.blueprintId);
  const bpSections = blueprints.map((bp) => ({
    blueprint: bp,
    notes: notes.filter((n) => n.blueprintId === bp.id),
  }));

  const onCanvas = (bp) => blueprintOnCanvas(bp);
  const bpIdsKey = useMemo(
    () => blueprints.map((b) => b.id).join("|"),
    [blueprints],
  );

  useEffect(() => {
    const ids = bpIdsKey ? bpIdsKey.split("|") : [];
    const idSet = new Set(ids);
    if (!ids.length) {
      setExpandedStackId(null);
      return;
    }
    setExpandedStackId((prev) => (prev && idSet.has(prev) ? prev : null));
  }, [bpIdsKey]);

  useEffect(() => {
    if (!focusedNoteId) return;
    const note = notes.find((n) => n.id === focusedNoteId);
    if (note?.blueprintId) {
      setExpandedStackId(note.blueprintId);
    }
  }, [focusedNoteId, notes]);

  useEffect(() => {
    if (showForm) {
      formAnchorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [showForm]);

  const renderNote = (n) => (
    <NoteCard
      key={n.id}
      note={n}
      today={today}
      focused={focusedNoteId === n.id}
      hasVisibleCanvasNode={hasVisibleCanvasNode(n.id)}
      hasBlueprintAction={
        n.kind === "ai"
        && Array.isArray(n.entities)
        && n.entities.length > 0
        && !blueprints.some((bp) => bp.sourceNoteId === n.id)
      }
      onUpdate={(updated) => onUpdateNote(updated)}
      onDelete={() => onDeleteNote(n)}
      onInsertNode={() => onInsertNode(n)}
      onInsertBlueprint={() => onInsertBlueprint(n)}
    />
  );

  return (
    <>
      <div className="col-header">
        <span className="ttl">Notes</span>
        <button className="btn xs solid" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "✕ Cancel" : "＋ New note"}
        </button>
      </div>

      <div className="col-body scroll scroll-prominent notes-stack-stage">
        <Sidebar />
        <FuturaCanvas />
        <div className="notes-section-label">Legacy notes</div>
        {showForm && (
          <div ref={formAnchorRef} className="notes-form-anchor">
            <NewNoteForm
              onSave={(payload) => { onSaveManual(payload); setShowForm(false); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
        {notes.length === 0 && !showForm && blueprints.length === 0 && (
          <div className="empty-block">
            <b>No notes yet</b>
            Add a manual note (Title + Type + Content) or scan a campaign. Manual notes are free; AI ops deduct tokens.
          </div>
        )}
        {ungrouped.length > 0 && (
          <>
            {bpSections.length > 0 && (
              <div className="notes-section-label">Ungrouped</div>
            )}
            {ungrouped.map(renderNote)}
          </>
        )}
        {bpSections.length > 0 && (
          <div className="notes-bp-stack-wrap">
            <div className="notes-bp-stack-zone">
              {bpSections.map((section) => {
                const isExpanded = expandedStackId === section.blueprint.id;
                return (
                  <BlueprintCard
                    key={section.blueprint.id}
                    blueprint={section.blueprint}
                    bpNotes={section.notes}
                    expanded={isExpanded}
                    isFocusedGroup={focusedNoteId && section.notes.some((n) => n.id === focusedNoteId)}
                    onToggle={() => setExpandedStackId(isExpanded ? null : section.blueprint.id)}
                    onDelete={(id) => {
                      if (expandedStackId === id) setExpandedStackId(null);
                      onDeleteBlueprint(id);
                    }}
                    onRestore={onRestoreBlueprint}
                    onRemove={onRemoveBlueprintFromCanvas}
                    showRemove={onCanvas(section.blueprint)}
                    renderNote={renderNote}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="token-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="label">Tokens</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)" }}>
            <span style={{ color: "var(--accent)" }}>{tokens}</span>
            <span style={{ color: "var(--mute)" }}> / 10</span>
          </span>
        </div>
        <div className="token-bar">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={"token-cell " + (i < tokens ? "ai-used" : "")} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
          <span>{manualCount} manual · {aiCount} AI</span>
          <span
            style={{ color: "var(--warm)", cursor: "pointer" }}
            onClick={() => useUpgradeModalStore.getState().show("search")}
          >
            Upgrade →
          </span>
        </div>
      </div>
    </>
  );
}

/* ─── INTEL PANEL ─────────────────────────────────────────── */

function useIntelOverlayTabs() {
  const { t } = useI18n();
  return useMemo(() => ([
    { id: "embed-link", label: t("intel.embedLink"), iconSrc: INTEL_EMBED_LINK_ICON },
    { id: "studio", label: t("intel.studio") },
  ]), [t]);
}

function useIntelFolderTabs() {
  const { t } = useI18n();
  return useMemo(() => ([
    { id: "calendar", label: t("intel.calendar") },
    { id: "forecast", label: t("intel.forecast") },
    { id: "launch-radar", label: t("intel.launchRadar") },
    { id: "market-hype", label: t("intel.marketHype") },
  ]), [t]);
}

function Tabs({ value, options, onChange }) {
  const refs = useRef([]);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const idx = options.findIndex((o) => o.id === value);
    const el = refs.current[idx];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);
  return (
    <div className="tabs">
      <div className="tabs-thumb" style={{ left: thumb.left, width: thumb.width }} />
      {options.map((o, i) => (
        <button key={o.id} ref={(el) => (refs.current[i] = el)}
                data-on={value === o.id ? "1" : "0"} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IntelFolderBar({
  value,
  onChange,
  launchBadge = null,
  tabs,
  ariaLabel,
  disabled = false,
  idPrefix = "intel-folder",
}) {
  const { t } = useI18n();
  const refs = useRef([]);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const idx = tabs.findIndex((o) => o.id === value);
    const el = refs.current[idx];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    else setThumb({ left: 0, width: 0 });
  }, [value, tabs]);

  return (
    <div className={"intel-folder-bar" + (disabled ? " is-disabled" : "")}>
      <div
        className="intel-folder-tabs"
        role="tablist"
        aria-label={ariaLabel || t("intel.foldersAria")}
      >
        <div className="intel-folder-tabs-thumb" style={{ left: thumb.left, width: thumb.width }} />
        {tabs.map((o, i) => (
          <button
            key={o.id}
            type="button"
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`${idPrefix}-tab-${o.id}`}
            aria-selected={value === o.id}
            aria-controls={`${idPrefix}-panel-${o.id}`}
            data-on={value === o.id ? "1" : "0"}
            disabled={disabled}
            onClick={() => onChange(o.id)}
          >
            {o.iconSrc ? (
              <img
                className="intel-folder-tabs__icon"
                src={o.iconSrc}
                alt=""
                aria-hidden
              />
            ) : null}
            <span className="intel-folder-tabs__label">{o.label}</span>
          </button>
        ))}
      </div>
      {launchBadge}
    </div>
  );
}

function IntelFoldersSection({
  onFolderChange,
  today,
  launchDate,
  onSelectDate,
  nodeEntities = {},
  docsById = {},
  expandedNodeId = null,
  selection = [],
  canvasNodes = [],
  onInsertForecastNode,
  onInsertEventNode,
  corpusBrandName = "",
  corpusObjectId = null,
  bodyMode = "calendar",
}) {
  const { t } = useI18n();
  const intelFolderTabs = useIntelFolderTabs();
  const activeTab = intelFolderTabs.find((tab) => tab.id === bodyMode) || intelFolderTabs[0];
  const daysUntilLaunch = launchDate ? daysBetween(today, launchDate) : null;
  const launchBadge = bodyMode === "calendar" && launchDate ? (
    <span className="intel-folder-launch-badge tnum mono">
      T−{daysUntilLaunch}d
    </span>
  ) : null;
  const activeNode = resolveActiveForecastNode(
    nodeEntities,
    { expandedNodeId, selection, canvasNodes },
    docsById,
  );
  const scheduleHint = getScheduleHintForNode(activeNode);
  const showForecastSearch = bodyMode === "forecast";

  return (
    <section className="intel-folders-section" aria-label={t("intel.foldersAria")}>
      <IntelFolderBar
        value={bodyMode}
        onChange={onFolderChange}
        launchBadge={launchBadge}
        tabs={intelFolderTabs}
      />
      <div
        id={`intel-folder-panel-${activeTab.id}`}
        className={
          "intel-folder-panel"
          + (bodyMode === "calendar" ? " intel-folder-panel--calendar" : "")
          + (bodyMode === "forecast" ? " intel-folder-panel--forecast" : "")
          + (bodyMode === "launch-radar" ? " intel-folder-panel--launch-radar" : "")
          + (bodyMode === "market-hype" ? " intel-folder-panel--market-hype" : "")
          + (showForecastSearch ? " intel-folder-panel--with-search" : "")
        }
        role="tabpanel"
        aria-labelledby={`intel-folder-tab-${activeTab.id}`}
      >
        {bodyMode === "calendar" && (
          <CalendarPanel
            today={today}
            launchDate={launchDate}
            onSelectDate={onSelectDate}
            scheduleHint={scheduleHint}
            nodeEntities={nodeEntities}
            docsById={docsById}
            expandedNodeId={expandedNodeId}
            selection={selection}
            canvasNodes={canvasNodes}
            onInsertEventNode={onInsertEventNode}
          />
        )}
        {bodyMode === "forecast" && <ForecastPanel today={today} />}
        {bodyMode === "launch-radar" && (
          <LaunchPredictor today={today} />
        )}
        {bodyMode === "market-hype" && (
          <div className="intel-market-hype-wrap">
            <MarketHypePanel
              brandName={corpusBrandName}
              corpusObjectId={corpusObjectId}
              today={today}
            />
          </div>
        )}
        {showForecastSearch ? (
          <ForecastSearchFooter
            nodeEntities={nodeEntities}
            docsById={docsById}
            expandedNodeId={expandedNodeId}
            selection={selection}
            canvasNodes={canvasNodes}
            onInsertForecastNode={onInsertForecastNode}
          />
        ) : null}
      </div>
    </section>
  );
}

function Signal({ item, added, isLoading, onGetOverview }) {
  const conf = item.confidence;
  const colorCls = conf >= 80 ? "color-hi" : conf >= 65 ? "color-md" : "color-lo";
  return (
    <div className={"signal " + (added ? "added" : "")}>
      <div className={"signal-dot " + colorCls} style={{ background: "currentColor" }} />
      <div className="signal-body">
        <div className="signal-src">{item.src}</div>
        <div className="signal-cat">{item.category}</div>
      </div>
      <div className={"signal-conf " + colorCls}>
        <div className="signal-bar"><i style={{ width: conf + "%" }} /></div>
        <span className="signal-conf-num">{conf}</span>
      </div>
      <div className="signal-act">
        {added ? (
          <span className="pill ok" style={{ padding: "1px 6px" }}>Added</span>
        ) : isLoading ? (
          <span className="pill ai" style={{ padding: "1px 6px" }}>
            <i className="dot" />…
          </span>
        ) : (
          <button className="btn xs" title="AI overview · 1 token" onClick={() => onGetOverview(item)}>
            Overview
          </button>
        )}
      </div>
    </div>
  );
}

function IntelPanel({
  today,
  launchDate,
  onSelectDate,
  nodeEntities = {},
  docsById = {},
  expandedNodeId = null,
  selection = [],
  canvasNodes = [],
  onInsertForecastNode,
  onInsertEventNode,
  onSlashCreateNode,
  objectsById = {},
  selectedObjectId = null,
}) {
  const { t } = useI18n();
  const planProfile = usePlanStore((s) => s.profile);
  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const activeCompanyObjectId = selectedObjectId || filterObjectId || null;
  const intelLocked = isIntelPanelLocked(planProfile);
  const overlayTabs = useIntelOverlayTabs();
  const [embedPanelOpen, setEmbedPanelOpen] = useState(false);
  const [studioPanelOpen, setStudioPanelOpen] = useState(false);
  const [bodyMode, setBodyMode] = useState("calendar");

  const overlayTabValue = embedPanelOpen
    ? "embed-link"
    : studioPanelOpen
      ? "studio"
      : null;

  const { corpusScopeBrand, corpusObjectId } = useMemo(() => {
    const { currentCorpus, brandName } = resolveCurrentCorpus(objectsById, selectedObjectId);
    const stableBrand = brandName || resolveIntelCampaignBrand(objectsById, selectedObjectId);
    return {
      corpusScopeBrand: stableBrand,
      corpusObjectId: currentCorpus?.id
        || resolveLaunchRadarObjectId(objectsById, stableBrand, null),
    };
  }, [objectsById, selectedObjectId]);

  useEffect(() => {
    if (!intelLocked) return;
    setEmbedPanelOpen(false);
    clearStudioSessionDraft();
    setStudioPanelOpen(false);
  }, [intelLocked]);

  const handleOverlayTab = (tabId) => {
    if (intelLocked) return;
    if (tabId === "embed-link") {
      setEmbedPanelOpen(true);
      clearStudioSessionDraft();
      setStudioPanelOpen(false);
      return;
    }
    if (tabId === "studio") {
      setStudioPanelOpen(true);
      setEmbedPanelOpen(false);
    }
  };

  const handleEmbedPanelClose = () => {
    setEmbedPanelOpen(false);
  };

  const handleStudioPanelClose = () => {
    clearStudioSessionDraft();
    setStudioPanelOpen(false);
  };

  return (
    <div className={"intel-panel-wrap" + (intelLocked ? " is-locked" : "")}>
      {intelLocked ? (
        <div className="intel-panel-wrap__lock">
          <PlanFeatureGate
            title={t("plans.creditsExpired")}
            body={t("plans.creditsExpiredHint")}
          />
        </div>
      ) : null}
      <div className="intel-panel-wrap__content">
      {embedPanelOpen ? (
        <VideoReferencePanel
          nodeId={null}
          searchQuery=""
          parentDocId={null}
          blockIndex={null}
          companyObjectId={activeCompanyObjectId}
          onClose={handleEmbedPanelClose}
          onSlashCreateNode={onSlashCreateNode}
        />
      ) : null}
      {studioPanelOpen ? (
        <StudioPanel onClose={handleStudioPanelClose} />
      ) : null}
      <div className="col-header intel-header">
        <div className="intel-toolbar-row">
          <IntelModelSelect disabled={intelLocked} className="intel-toolbar-model" />
          <div className="intel-toolbar-overlays">
            <IntelFolderBar
              value={overlayTabValue}
              onChange={handleOverlayTab}
              tabs={overlayTabs}
              ariaLabel={t("intel.overlaysAria")}
              disabled={intelLocked}
              idPrefix="intel-overlay"
            />
          </div>
        </div>
      </div>
      <div className="col-body scroll" style={{ padding: 14 }}>
        <IntelFoldersSection
          onFolderChange={setBodyMode}
          bodyMode={bodyMode}
          today={today}
          launchDate={launchDate}
          onSelectDate={onSelectDate}
          nodeEntities={nodeEntities}
          docsById={docsById}
          expandedNodeId={expandedNodeId}
          selection={selection}
          canvasNodes={canvasNodes}
          onInsertForecastNode={onInsertForecastNode}
          onInsertEventNode={onInsertEventNode}
          corpusBrandName={corpusScopeBrand}
          corpusObjectId={corpusObjectId}
        />
      </div>
      </div>
    </div>
  );
}

/* ─── CALENDAR ─────────────────────────────────────────────── */

function Calendar({ today, launchDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(null);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabel = `${months[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
  const startWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: prevMonthDays - startWeekday + i + 1, mute: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    cells.push({
      day: d, dateObj,
      today: dateObj.toDateString() === today.toDateString(),
      event: launchDate && dateObj.toDateString() === launchDate.toDateString(),
    });
  }
  while (cells.length < 42) cells.push({ day: cells.length - daysInMonth - startWeekday + 1, mute: true });
  const daysUntilLaunch = launchDate ? daysBetween(today, launchDate) : null;
  return (
    <div className="cal">
      <div className="cal-nav">
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button>
        <span className="cal-nav-mid">{monthLabel}</span>
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="cal-grid">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={"h" + i} className="cal-h">{d}</div>)}
        {cells.map((c, i) => {
          let cls = "cal-day";
          if (c.mute) cls += " mute";
          if (c.today) cls += " today";
          if (c.event) cls += " event";
          if (selected && c.dateObj && c.dateObj.toDateString() === selected.toDateString()) cls += " selected";
          return (
            <div key={i} className={cls}
                 onClick={() => { if (c.dateObj) { setSelected(c.dateObj); onSelectDate && onSelectDate(c.dateObj); } }}>
              {c.day}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--text-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span><span style={{ color: "var(--warm)" }}>●</span> Today</span>
          <span className="tnum mono">{fmtDate(today, "short")}</span>
        </div>
        {launchDate && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span><span style={{ color: "var(--hud)" }}>●</span> Launch</span>
            <span className="tnum mono" style={{ color: "var(--hud)" }}>T−{daysUntilLaunch}d</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── STACKED TIMELINES ────────────────────────────────────── */

/* Each blueprint gets its own track with date, text (at today), and metric markers. */

const TL_RULER_TICKS = 41;

const DEFAULT_TIMELINE_TRACK_ID = "__default_timeline__";

function TimelineTrack({
  track, trackNodes, trackConnections = [], today,
  focusedNoteId, onMarkerClick, zoomed, onZoomToggle,
  docsById = {}, nodeEntitiesById = {}, objectsById = {},
}) {
  const accent = track.color.stroke;
  const isEmpty = trackNodes.length === 0;

  if (isEmpty) {
    return (
      <div
        className="tl-track tl-track-empty"
        style={{ "--tl-accent": accent, "--tl-soft": track.color.soft }}
      >
        <div className="tl-track-header">
          <button
            type="button"
            className="tl-track-label"
            style={{ background: track.color.soft, color: accent, borderColor: accent + "55" }}
            onClick={track.onEditTitle}
            title="Edit timeline title"
          >
            <i className="tl-track-label-dot" />
            {track.label}
          </button>
          <span className="tl-track-meta mute">empty space</span>
        </div>
        <div className="tl-track-bar tl-track-bar-empty" aria-hidden>
          <span className="tl-track-empty-label">empty space</span>
        </div>
      </div>
    );
  }

  const meta = { nodeEntitiesById, docsById };
  const dateNodes = trackNodes.filter((n) => n.dataType === "date");
  const { start, end, anchors, minD, maxD } = computeTimelineRange(
    trackNodes,
    trackConnections,
    today,
    meta,
    { zoomed },
  );
  const total = end - start || 1;
  const pct = (d) => ((d - start) / total) * 100;

  const { winStart: winStartD, winEnd: winEndD, winDays } = timelineWindowDays(minD, maxD, today);
  const winStart = winStartD ? pct(winStartD) : 0;
  const winEnd = winEndD ? pct(winEndD) : 0;
  const remaining = maxD && maxD > today ? daysBetween(today, maxD) : 0;
  const todayPct = Math.min(100, Math.max(0, pct(today)));

  const tlCtx = {
    start,
    end,
    today,
    todayPct,
    winStart,
    winEnd,
    minD,
    maxD,
    allNodes: trackNodes,
    connections: trackConnections,
    anchors,
    meta,
  };

  const trackObject = objectsById[track.id] || null;
  const chipExtras = { today, trackNodes, trackConnections };

  const rawChips = trackNodes
    .map((n) => {
      const anchor =
        anchors.get(n.id)
        || resolveNodeAnchorDate(n, meta)
        || (n.dataType === "date" ? parseDate(n.content) : null);
      if (!anchor) return null;
      const display = buildChipDisplay(n, trackObject, meta, chipExtras);
      return {
        node: n,
        id: n.id,
        noteId: n.noteId || n.id,
        leftPct: pct(anchor),
        sortTime: anchor.getTime(),
        name: display.name,
        dateLabel: display.dateLabel,
        objectTint: display.objectTint,
      };
    })
    .filter(Boolean);

  const chips = assignTimelineChipLanes(rawChips);
  const chipLeftById = new Map(chips.map((c) => [c.id, c.leftPct]));
  const maxLane = chips.reduce((m, x) => Math.max(m, x.lane), 0);
  const barExtraH = maxLane * 40;

  const futureMid = todayPct + (100 - todayPct) / 2;

  return (
    <div
      className={"tl-track" + (zoomed ? " is-zoomed" : "")}
      style={{ "--tl-accent": accent, "--tl-soft": track.color.soft }}
    >
      <div className="tl-track-header">
        <button
          type="button"
          className="tl-track-label"
          style={{ background: track.color.soft, color: accent, borderColor: accent + "55" }}
          onClick={track.onEditTitle}
          title="Edit timeline title"
        >
          <i className="tl-track-label-dot" />
          {track.label}
        </button>
        <div className="tl-track-actions">
          <button
            type="button"
            className="btn xs ghost tl-zoom-btn"
            onClick={onZoomToggle}
          >
            {zoomed ? "Zoom out" : "Zoom in"}
          </button>
          <span className="tl-track-meta">
            {trackNodes.length} nodes · {dateNodes.length} dates
            {trackConnections.length > 0 && <span> · {trackConnections.length} wires</span>}
            {winDays > 0 && <span> · {winDays}d span</span>}
            {remaining > 0 && <span className="tl-track-meta-countdown">· T−{remaining}d</span>}
          </span>
        </div>
      </div>
      <div
        className="tl-track-bar"
        style={{ "--tl-bar-extra-h": `${barExtraH}px` }}
      >
        <div className="tl-ruler" aria-hidden>
          {Array.from({ length: TL_RULER_TICKS }, (_, i) => (
            <span
              key={i}
              className={"tl-ruler-tick" + (i % 5 === 0 ? " major" : "")}
              style={{ left: (i / (TL_RULER_TICKS - 1)) * 100 + "%" }}
            />
          ))}
        </div>

        <div className="tl-bar-shell">
          <div className="tl-bar-past" style={{ width: todayPct + "%" }} />
          <div className="tl-bar-future" style={{ left: todayPct + "%", width: (100 - todayPct) + "%" }} />
          {winDays > 0 && winEnd > winStart && (
            <div
              className="tl-bar-window"
              style={{ left: winStart + "%", width: (winEnd - winStart) + "%" }}
            >
              <span className="tl-window-label">{winDays}d</span>
            </div>
          )}
        </div>

        {remaining > 0 && (
          <div className="tl-remaining-pill" style={{ left: futureMid + "%" }}>
            {remaining} day{remaining === 1 ? "" : "s"} left
          </div>
        )}

        {today >= start && today <= end && (
          <div
            className={"tl-today" + (zoomed ? " is-zoomed" : " tl-today--figma")}
            style={{ left: todayPct + "%" }}
          >
            <span className="tl-today-pill">today</span>
            <div className="tl-today-line" />
            {zoomed && (
              <div className="tl-today-caption">
                <span className="tl-today-caption-title">today</span>
                <span className="tl-today-caption-date">{fmtDate(today, "short")}</span>
              </div>
            )}
          </div>
        )}

        {trackConnections.map((c) => {
          const fromNode = trackNodes.find((n) => n.id === c.from);
          const toNode = trackNodes.find((n) => n.id === c.to);
          const label = computeEdgeTemporalLabel(
            fromNode, toNode, today, trackNodes, trackConnections, [], meta,
          );
          if (!label || !fromNode || !toNode) return null;
          const leftA = chipLeftById.get(c.from) ?? timelineNodeLeftPct(fromNode, tlCtx);
          const leftB = chipLeftById.get(c.to) ?? timelineNodeLeftPct(toNode, tlCtx);
          const edgeLeft = Math.min(leftA, leftB);
          const edgeWidth = Math.max(Math.abs(leftB - leftA), 0.5);
          const isCountdown = label.startsWith("T");
          const anchoredAtToday = isCountdown && Math.abs(edgeLeft - todayPct) < 2;
          const labelClass = "tl-edge-label" + (anchoredAtToday || (isCountdown && edgeWidth < 8) ? " start" : "");
          return (
            <div
              key={c.id}
              className={"tl-edge" + (isCountdown ? " countdown" : "")}
              style={{ left: edgeLeft + "%", width: edgeWidth + "%" }}
            >
              <span className={labelClass}>{label}</span>
            </div>
          );
        })}

        {chips.map((chip) => (
          <div
            key={chip.id}
            className="tl-chip-anchor"
            style={{
              left: chip.leftPct + "%",
              "--tl-lane": chip.lane,
            }}
          >
            <TimelineEventChip
              name={chip.name}
              dateLabel={chip.dateLabel}
              objectTint={chip.objectTint}
              focused={focusedNoteId === chip.noteId}
              onClick={() => onMarkerClick(chip.noteId)}
              onKeyDown={(e) => e.key === "Enter" && onMarkerClick(chip.noteId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineChainTrack({
  chain,
  grid,
  trackItemsById,
  wireAnchors,
  connections = [],
  today,
  focusedNoteId,
  onMarkerClick,
  onEditTitle,
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
}) {
  const accent = chain.objectColor;
  const meta = { nodeEntitiesById, docsById };
  const trackObject = objectsById[chain.objectId] || null;
  const chainNodes = chain.nodeIds
    .map((id) => trackItemsById.get(id))
    .filter(Boolean);
  const chainConnections = connections.filter(
    (c) => chain.nodeIds.includes(c.from) && chain.nodeIds.includes(c.to),
  );
  const chipExtras = { today, trackNodes: chainNodes, trackConnections: chainConnections };

  const nodePositions = chain.anchors.map(({ nodeId, date }) => ({
    nodeId,
    leftPct: grid.pct(date),
  }));
  const edgeLeft = nodePositions.length
    ? Math.min(...nodePositions.map((p) => p.leftPct))
    : 0;
  const edgeRight = nodePositions.length
    ? Math.max(...nodePositions.map((p) => p.leftPct))
    : 0;
  const edgeWidth = Math.max(edgeRight - edgeLeft, 0.5);

  return (
    <div
      className={
        "tl-chain-row"
        + (chain.isCorpus ? " is-corpus" : " is-satellite")
        + (chain.hasCrossObjectLink ? " is-linked-row" : "")
      }
      style={{ "--tl-accent": accent, "--tl-soft": chain.colorSoft }}
    >
      <div className="tl-track-header">
        <button
          type="button"
          className="tl-track-label"
          style={{ background: chain.colorSoft, color: accent, borderColor: accent + "55" }}
          onClick={onEditTitle}
          title="Edit timeline title"
        >
          <i className="tl-track-label-dot" />
          {chain.label}
        </button>
        <span className="tl-track-meta mute">
          {chain.nodeIds.length} node{chain.nodeIds.length === 1 ? "" : "s"}
          {chain.hasCrossObjectLink ? " · linked" : ""}
        </span>
      </div>
      <div className="tl-chain-bar">
        <div className="tl-chain-axis" aria-hidden />
        {chain.anchors.length > 1 && (
          <div
            className={"tl-chain-edge" + (chain.hasCrossObjectLink ? " is-linked" : "")}
            style={{ left: edgeLeft + "%", width: edgeWidth + "%" }}
            aria-hidden
          />
        )}
        {chain.anchors.slice(0, -1).map((anchor, i) => {
          const next = chain.anchors[i + 1];
          const left = grid.pct(anchor.date);
          const width = Math.max(grid.pct(next.date) - left, 0.5);
          return (
            <div
              key={`${anchor.nodeId}-${next.nodeId}`}
              className="tl-chain-window"
              style={{ left: left + "%", width: width + "%" }}
            />
          );
        })}
        {today >= grid.start && today <= grid.end && (
          <div className="tl-chain-today" style={{ left: grid.todayPct + "%" }} aria-hidden>
            <span className="tl-today-line" />
          </div>
        )}
        {chain.anchors.map(({ nodeId, date }) => {
          const n = trackItemsById.get(nodeId);
          if (!n) return null;
          const display = buildChipDisplay(n, trackObject, meta, chipExtras);
          const anchorResolved = wireAnchors.get(nodeId) || date;
          const dateLabel = display.dateLabel
            || (anchorResolved ? fmtDate(anchorResolved, "short") : "");
          return (
            <div
              key={nodeId}
              className="tl-chain-node-wrap"
              style={{ left: grid.pct(date) + "%" }}
            >
              <TimelineEventChip
                name={display.name}
                dateLabel={dateLabel}
                objectTint={display.objectTint || accent}
                focused={focusedNoteId === (n.noteId || nodeId)}
                onClick={() => onMarkerClick(n.noteId || nodeId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onMarkerClick(n.noteId || nodeId);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({
  today,
  focusedNoteId,
  onFocusNote: _onFocusNote,
  nodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  filterObjectId = null,
  onOpenDocument,
  onOpenNode,
}) {
  return (
    <TacticalTimeline
      canvasNodes={nodes}
      connections={connections}
      docsById={docsById}
      objectsById={objectsById}
      nodeEntitiesById={nodeEntitiesById}
      today={today}
      filterObjectId={filterObjectId}
      focusedNoteId={focusedNoteId}
      onOpenDocument={onOpenDocument}
      onOpenNode={onOpenNode}
    />
  );
}

export {
  NewNoteForm,
  NoteCard,
  NotesPanel,
  Tabs,
  Signal,
  IntelPanel,
  Calendar,
  Timeline,
  TimelineTrack,
  TimelineChainTrack,
};
