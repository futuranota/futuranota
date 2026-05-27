import { useState, useEffect, useRef, useMemo } from 'react';
import { daysBetween, fmtDate, timelineWindowDays } from './data.jsx';
import { Sidebar } from './components/sidebar/Sidebar.jsx';
import { FuturaCanvas } from './components/canvas/FuturaCanvas.jsx';
import {
  parseDate,
  computeMetricValue,
  computeEdgeTemporalLabel,
  noteToTrackItem,
  timelineNodeLeftPct,
} from './temporal.js';
import { useTimelineStore } from './stores/index.js';

/* panels.jsx — Notes panel (left), Intel panel (right), Stacked Timelines */

const DATA_TYPES = [
  { id: "text",   label: "Text" },
  { id: "date",   label: "Date" },
  { id: "metric", label: "Metric" },
];

/* ─── NEW NOTE FORM (inline) ───────────────────────── */

function NewNoteForm({ onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [dataType, setDataType] = useState("text");
  const [content, setContent] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const commit = () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    let payload = content;
    if (dataType === "metric") {
      const num = Number(content);
      payload = { value: isNaN(num) ? content : num, unit: metricUnit };
    }
    onSave({ title: title.trim(), dataType, content: payload });
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
      {dataType === "metric" && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="number"
            className="note-form-field"
            placeholder="Value"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            className="note-form-field"
            placeholder="Unit"
            value={metricUnit}
            onChange={(e) => setMetricUnit(e.target.value)}
            style={{ width: 70 }}
          />
        </div>
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
            <textarea
              className="note-form-field"
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
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
          <span style={{ color: "var(--warm)", cursor: "pointer" }}>Upgrade →</span>
        </div>
      </div>
    </>
  );
}

/* ─── INTEL PANEL ─────────────────────────────────────────── */

const TAB_OPTIONS = [
  { id: "all",      label: "All" },
  { id: "news",     label: "News" },
  { id: "campaign", label: "Campaigns" },
];

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

function IntelPanel({ intel, addedIds, loadingIds, onGetOverview, onScanBlogs, hasScannedBlogs, today, launchDate, onSelectDate }) {
  const [tab, setTab] = useState("all");
  const filtered = intel.filter((s) => tab === "all" || s.category === tab);

  return (
    <>
      <div className="col-header">
        <span className="ttl">Intelligence</span>
        <Tabs value={tab} options={TAB_OPTIONS} onChange={setTab} />
      </div>
      <div className="col-body scroll" style={{ padding: 14 }}>
        {!hasScannedBlogs && intel.length === 0 && (
          <div className="empty-block">
            <b>No signals loaded</b>
            <button className="btn sm primary" style={{ marginTop: 10 }} onClick={onScanBlogs}>Scan blogs</button>
          </div>
        )}
        {hasScannedBlogs && filtered.length === 0 && (
          <div className="empty-block">
            <b>No {tab} signals</b>
            Try another tab or run scan again.
          </div>
        )}
        {filtered.map((s) => (
          <Signal key={s.id} item={s}
                  added={addedIds.includes(s.id)}
                  isLoading={loadingIds.includes(s.id)}
                  onGetOverview={onGetOverview} />
        ))}

        <div style={{ borderTop: "1px solid var(--hairline)", margin: "14px -14px 0", padding: "14px 14px 0" }}>
          <div className="col-section-h" style={{ marginBottom: 8 }}>
            <span className="label">Calendar</span>
            {launchDate && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--warm)" }}>
                T−{daysBetween(today, launchDate)}d
              </span>
            )}
          </div>
          <Calendar today={today} launchDate={launchDate} onSelectDate={onSelectDate} />
        </div>
      </div>
    </>
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
  track, trackNodes, dateNodes, textNodes, metricNodes, today,
  focusedNoteId, onMarkerClick, zoomed, onZoomToggle,
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

  const dates = dateNodes.map((n) => parseDate(n.content)).filter(Boolean);
  const sorted = dates.length ? [...dates].sort((a, b) => a - b) : [];
  const minD = sorted[0] || null;
  const maxD = sorted.length ? sorted[sorted.length - 1] : null;

  const padMs = (zoomed ? 2 : 10) * 86400000;
  const fallbackPad = (zoomed ? 7 : 30) * 86400000;
  let start;
  let end;
  if (minD && maxD) {
    start = new Date(Math.min(minD.getTime(), today.getTime()) - padMs);
    end = new Date(Math.max(maxD.getTime(), today.getTime()) + padMs);
  } else {
    start = new Date(today.getTime() - fallbackPad);
    end = new Date(today.getTime() + fallbackPad);
  }
  const total = end - start || 1;
  const pct = (d) => ((d - start) / total) * 100;

  const { winStart: winStartD, winEnd: winEndD, winDays } = timelineWindowDays(minD, maxD, today);
  const winStart = winStartD ? pct(winStartD) : 0;
  const winEnd = winEndD ? pct(winEndD) : 0;
  const remaining = maxD && maxD > today ? daysBetween(today, maxD) : 0;
  const todayPct = Math.min(100, Math.max(0, pct(today)));
  const trackConnections = [];

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
  };

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
            {winDays > 0 && <span> · {winDays}d span</span>}
            {remaining > 0 && <span className="tl-track-meta-countdown">· T−{remaining}d</span>}
          </span>
        </div>
      </div>
      <div className="tl-track-bar">
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
          <div className="tl-today" style={{ left: todayPct + "%" }}>
            <span className="tl-today-pill">today</span>
            <div className="tl-today-line" />
            <div className="tl-today-caption">
              <span className="tl-today-caption-title">today</span>
              <span className="tl-today-caption-date">{fmtDate(today, "short")}</span>
            </div>
          </div>
        )}

        {trackConnections.map((c) => {
          const fromNode = trackNodes.find((n) => n.id === c.from);
          const toNode = trackNodes.find((n) => n.id === c.to);
          const label = computeEdgeTemporalLabel(fromNode, toNode, today, trackNodes, trackConnections, []);
          if (!label || !fromNode || !toNode) return null;
          const leftA = timelineNodeLeftPct(fromNode, tlCtx);
          const leftB = timelineNodeLeftPct(toNode, tlCtx);
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

        {dateNodes.map((n) => {
          const d = parseDate(n.content);
          if (!d) return null;
          const noteId = n.noteId || n.id;
          const left = pct(d);
          const t = d.getTime();
          const isStart = minD && t === minD.getTime();
          const isEnd = maxD && t === maxD.getTime() && (!isStart || minD.getTime() !== maxD.getTime());
          const isEndpoint = isStart || isEnd;

          if (isEndpoint) {
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                className={
                  "tl-endpoint" +
                  (isStart ? " start" : " end") +
                  (focusedNoteId === noteId ? " tl-marker-focus" : "")
                }
                style={{ left: left + "%" }}
                onClick={() => onMarkerClick(noteId)}
                onKeyDown={(e) => e.key === "Enter" && onMarkerClick(noteId)}
              >
                <div className="tl-endpoint-node" />
                <div className="tl-endpoint-label">
                  <b>{n.title}</b>
                  <span className="tl-marker-date">{fmtDate(d, "short")}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              className={"tl-marker" + (focusedNoteId === noteId ? " tl-marker-focus" : "")}
              data-t="date"
              style={{ left: left + "%" }}
              onClick={() => onMarkerClick(noteId)}
              onKeyDown={(e) => e.key === "Enter" && onMarkerClick(noteId)}
            >
              <div className="tl-marker-dot" />
              <div className="tl-marker-label">
                <b>{n.title}</b>
                <span className="tl-marker-date">{fmtDate(d, "short")}</span>
              </div>
            </div>
          );
        })}

        {textNodes.map((n, i) => {
          const noteId = n.noteId || n.id;
          const preview = String(n.content || "").slice(0, 48);
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              className={"tl-marker" + (focusedNoteId === noteId ? " tl-marker-focus" : "")}
              data-t="text"
              style={{
                left: todayPct + "%",
                transform: `translateX(${(i - (textNodes.length - 1) / 2) * 18}px)`,
              }}
              onClick={() => onMarkerClick(noteId)}
              onKeyDown={(e) => e.key === "Enter" && onMarkerClick(noteId)}
            >
              <div className="tl-marker-dot tl-marker-dot-sm" />
              <div className="tl-marker-label">
                <b>{n.title}</b>
                {preview && <span className="tl-marker-preview">{preview}</span>}
              </div>
            </div>
          );
        })}

        {metricNodes.map((n) => {
          const { value, unit } = computeMetricValue(n, trackNodes, trackConnections, today);
          const left = timelineNodeLeftPct(n, tlCtx);
          const noteId = n.noteId || n.id;
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              className={"tl-marker" + (focusedNoteId === noteId ? " tl-marker-focus" : "")}
              data-t="metric"
              style={{ left: left + "%" }}
              onClick={() => onMarkerClick(noteId)}
              onKeyDown={(e) => e.key === "Enter" && onMarkerClick(noteId)}
            >
              <div className="tl-marker-dot tl-marker-dot-metric" />
              <div className="tl-marker-label">
                <b>{n.title}</b>
                <span className="tl-marker-date">{String(value)}{unit ? ` ${unit}` : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({
  nodes = [],
  today,
  focusedNoteId,
  onFocusNote,
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  filterObjectId = null,
}) {
  const [zoomedBlueprintId, setZoomedBlueprintId] = useState(null);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);
  const setObjectTimelineTitle = useTimelineStore((s) => s.setObjectTimelineTitle);

  const tracks = useMemo(() => {
    const groups = new Map();
    for (const objectId of Object.keys(objectsById)) {
      groups.set(objectId, []);
    }

    const ensureGroup = (objectId) => {
      if (!objectId) return null;
      if (!groups.has(objectId)) groups.set(objectId, []);
      return groups.get(objectId);
    };

    for (const canvasNode of nodes) {
      let objectId = null;
      if (canvasNode.canvasKind === "object") {
        objectId = canvasNode.objectId || null;
      } else if (canvasNode.canvasKind === "document") {
        const doc = docsById[canvasNode.docId];
        objectId = doc?.parentObjectId || null;
      } else if (canvasNode.noteId) {
        const sourceNode = nodeEntitiesById[canvasNode.noteId];
        const parentDoc = sourceNode?.parentDocId ? docsById[sourceNode.parentDocId] : null;
        objectId = parentDoc?.parentObjectId || null;
      }
      const bucket = ensureGroup(objectId);
      if (!bucket) continue;
      bucket.push(canvasNode);
    }

    const buildTrack = (objectId, objectNodes) => {
      const object = objectsById[objectId];
      const fallbackLabel = object?.name || "Timeline";
      const label = (objectTimelineTitles[objectId] || "").trim() || fallbackLabel;
      const trackNodes = objectNodes.map((n) => {
        if (n.noteId && nodeEntitiesById[n.noteId]) {
          const source = nodeEntitiesById[n.noteId];
          return noteToTrackItem({
            id: n.id,
            title: source.sourceQuery || source.title || n.title,
            dataType: source.dataType || n.dataType || "text",
            content: source.content ?? n.content ?? "",
          });
        }
        return noteToTrackItem({
          id: n.id,
          title: n.title,
          dataType: n.dataType || "text",
          content: n.content ?? "",
        });
      });

      return {
        track: {
          id: objectId,
          label,
          color: object?.color
            ? {
              stroke: object.color,
              soft: `${object.color}22`,
            }
            : { stroke: "var(--hud)", soft: "var(--hud-soft)" },
          onEditTitle: () => {
            const next = window.prompt("Timeline title", label);
            if (next == null) return;
            setObjectTimelineTitle(objectId, next.trim());
          },
        },
        trackNodes,
        dateNodes: trackNodes.filter((item) => item.dataType === "date"),
        textNodes: trackNodes.filter((item) => item.dataType === "text"),
        metricNodes: trackNodes.filter((item) => item.dataType === "metric"),
      };
    };

    let result = Array.from(groups.entries()).map(([objectId, objectNodes]) =>
      buildTrack(objectId, objectNodes),
    );

    if (result.length === 0) {
      result = [{
        track: {
          id: DEFAULT_TIMELINE_TRACK_ID,
          label: "Timeline",
          color: { stroke: "var(--hud)", soft: "var(--hud-soft)" },
          onEditTitle: () => {},
        },
        trackNodes: [],
        dateNodes: [],
        textNodes: [],
        metricNodes: [],
      }];
    }

    result.sort((a, b) => a.track.label.localeCompare(b.track.label));

    return result.filter((t) => !filterObjectId || t.track.id === filterObjectId);
  }, [nodes, docsById, objectsById, nodeEntitiesById, objectTimelineTitles, setObjectTimelineTitle, filterObjectId]);

  const trackIdsKey = useMemo(
    () => tracks.map((t) => t.track.id).join("|"),
    [tracks],
  );

  useEffect(() => {
    if (!zoomedBlueprintId) return;
    const ids = trackIdsKey ? trackIdsKey.split("|") : [];
    if (!ids.includes(zoomedBlueprintId)) setZoomedBlueprintId(null);
  }, [trackIdsKey, zoomedBlueprintId]);

  const visibleTracks = zoomedBlueprintId
    ? tracks.filter((t) => t.track.id === zoomedBlueprintId)
    : tracks;

  const objectTrackCount = tracks.filter((t) => t.track.id !== DEFAULT_TIMELINE_TRACK_ID).length;

  return (
    <div
      className={"timeline stacked" + (zoomedBlueprintId ? " is-zoomed" : "")}
      style={{ "--track-count": visibleTracks.length }}
    >
      <div className="timeline-header">
        <span>
          <b>Timelines</b>
          {objectTrackCount > 0
            ? ` · ${objectTrackCount} object${objectTrackCount > 1 ? "s" : ""}`
            : " · empty space"}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--dim)" }}>
          {zoomedBlueprintId ? "zoomed" : "stacked"}
        </span>
      </div>
      <div className="tl-tracks">
        {visibleTracks.map((t) => {
          const isZoomed = zoomedBlueprintId === t.track.id;
          return (
            <TimelineTrack
              key={t.track.id}
              track={t.track}
              trackNodes={t.trackNodes}
              dateNodes={t.dateNodes}
              textNodes={t.textNodes}
              metricNodes={t.metricNodes}
              today={today}
              focusedNoteId={focusedNoteId}
              onMarkerClick={onFocusNote}
              zoomed={isZoomed}
              onZoomToggle={() => setZoomedBlueprintId(isZoomed ? null : t.track.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

export { NewNoteForm, NoteCard, NotesPanel, Tabs, Signal, IntelPanel, Calendar, Timeline, TimelineTrack };
