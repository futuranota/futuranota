import { useState, useRef, useEffect } from "react";
import {
  useObjectsStore, useDocsStore, useNodesStore, useUIStateStore,
} from "../../stores/index.js";
import { DocExpandedView } from "../docs/DocExpandedView.jsx";
import { DATA_TYPE_ICONS, DATA_TYPE_LABELS, NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { findObjectIdByName } from "../../lib/storeSanitize.js";
import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { ObjectIcon } from "./objectIcons.jsx";

function startObjectDrag(e, objectId) {
  setCanvasDragData(e.dataTransfer, { kind: "object", objectId });
}

/* ── helpers ────────────────────────────────── */
const PANEL_TYPES = ["Objects", "Documents", "Nodes"];

const TYPE_ICON = {
  Objects:   "◈",
  Documents: "📄",
  Nodes:     "◯",
};

/* Objects grid: cube + name below, draggable */
function ObjectThumb({ object, active, onClick, onDoubleClick }) {
  return (
    <button
      type="button"
      className={"obj-thumb" + (active ? " active" : "")}
      draggable
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={(e) => startObjectDrag(e, object.id)}
      title="Drag to canvas · double-click for documents"
    >
      <ObjectIcon variant="md" />
      <span className="obj-thumb-name">{object.name}</span>
    </button>
  );
}

/** Documents: flat rows — small cube + name (no pill chips) */
function ObjectPickerList({ objects, activeObjectId, onSelect }) {
  if (!objects.length) return null;
  return (
    <div className="lp-object-picker">
      {objects.map((obj) => (
        <button
          key={obj.id}
          type="button"
          className={"lp-object-picker-row" + (activeObjectId === obj.id ? " active" : "")}
          draggable
          onDragStart={(e) => startObjectDrag(e, object.id)}
          onClick={() => onSelect(obj.id)}
          title="Drag to canvas"
        >
          <ObjectIcon variant="sm" />
          <span className="lp-object-picker-name">{obj.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Doc list card
───────────────────────────────────────────── */
function DocListCard({ doc, objects, onClick }) {
  const parent = doc.parentObjectId ? objects[doc.parentObjectId] : null;
  return (
    <button type="button" className="lp-doc-card fn-card" onClick={onClick}>
      <span className="lp-doc-icon">📄</span>
      <div className="fn-card-body">
        <b>{doc.title}</b>
        <span className="fn-card-meta">
          {parent ? `↳ ${parent.name}` : "sin padre"} · {(doc.nodeIds || []).length} nodos
        </span>
      </div>
      <span className="lp-expand-btn">↗</span>
    </button>
  );
}

/* ─────────────────────────────────────────────
   Node list card (with parent + type + insert)
───────────────────────────────────────────── */
function NodeListCard({ node, docs, onClick, onInsert, onDelete }) {
  const parentDoc = node.parentDocId ? docs[node.parentDocId] : null;
  const icon = DATA_TYPE_ICONS[node.dataType] || "◯";
  const contentPreview = typeof node.content === "string"
    ? node.content.slice(0, 80)
    : node.content != null ? JSON.stringify(node.content).slice(0, 60) : "";

  return (
    <div className="lp-node-card">
      <div className="lp-node-card-head" onClick={onClick}>
        <span className="lp-node-type-icon">{icon}</span>
        <span className="lp-node-parent">{parentDoc ? parentDoc.title : "sin padre"}</span>
        <button type="button" className="lp-expand-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>↗</button>
      </div>
      <div className="lp-node-card-body" onClick={onClick}>
        <b className="lp-node-title">{node.title}</b>
        {contentPreview && <p className="lp-node-preview">{contentPreview}</p>}
      </div>
      <div className="lp-node-card-foot">
        <button type="button" className="btn xs ghost danger-text" onClick={onDelete}>delete</button>
        <button type="button" className="btn xs solid" onClick={onInsert}>Insert node</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Node detail / expanded view
───────────────────────────────────────────── */
function NodeDetailView({ node, docs, onClose, onInsert, onDelete }) {
  const updateNode = useNodesStore(s => s.updateNode);
  const [content, setContent] = useState(
    typeof node.content === "string" ? node.content : JSON.stringify(node.content ?? ""),
  );
  const parentDoc = node.parentDocId ? docs[node.parentDocId] : null;

  const handleSave = () => {
    updateNode(node.id, { content });
  };

  return (
    <div className="lp-node-detail">
      <div className="lp-node-detail-head">
        <div className="lp-node-detail-breadcrumb">
          <span className="lp-node-type-icon">{DATA_TYPE_ICONS[node.dataType] || "◯"}</span>
          <span className="lp-node-parent">{parentDoc ? parentDoc.title : "sin padre"}</span>
        </div>
        <button type="button" className="btn xs ghost" onClick={onClose}>✕</button>
      </div>

      <h3 className="lp-node-detail-title">{node.title}</h3>

      <div className="lp-node-detail-type">
        <span className="lp-type-label">TYPE :</span>
        <span className="lp-type-badge">{node.dataType || "text"}</span>
      </div>

      <div className="lp-node-detail-body">
        {node.dataType === "date" ? (
          <input
            type="date" className="note-form-field"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        ) : (
          <textarea
            className="note-form-field lp-node-textarea"
            value={content}
            rows={6}
            onChange={e => setContent(e.target.value)}
          />
        )}
      </div>

      <div className="lp-node-detail-foot">
        <span className="lp-tokens-hint">tokens</span>
        <button type="button" className="btn xs ghost" onClick={handleSave}>Save</button>
        <button type="button" className="btn xs ghost">Search 🔍</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL: Create Object  "CREATE YOUR MODEL"
───────────────────────────────────────────── */
function ObjectCreateModal({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#5a1f1f");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="lp-overlay" onClick={onCancel}>
      <div className="lp-modal obj-create-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="lp-modal-close btn xs ghost" onClick={onCancel}>✕</button>

        <div className="obj-create-preview-row">
          <ObjectIcon variant="lg" />
          <label className="obj-color-row">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            <span>Color</span>
          </label>
        </div>

        <div>
          <h3 className="obj-create-title">CREATE OBJECT</h3>
          <input
            ref={ref}
            className="note-form-field obj-name-input"
            placeholder="Object name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && name.trim()) onSubmit({ name: name.trim(), description: desc, color });
              if (e.key === "Escape") onCancel();
            }}
          />
          <textarea
            className="note-form-field obj-desc-input"
            placeholder="Description (optional)"
            value={desc}
            rows={3}
            onChange={e => setDesc(e.target.value)}
          />
          <div className="obj-create-actions">
            <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="btn primary"
              disabled={!name.trim()}
              onClick={() => onSubmit({ name: name.trim(), description: desc, color })}
            >
              Save object
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL: Create Document  "New File" Notion-like
───────────────────────────────────────────── */
function DocCreateModal({ objects, defaultParentId, onSubmit, onCancel }) {
  const [title, setTitle] = useState("New File");
  const fallbackParent =
    defaultParentId ||
    findObjectIdByName(Object.fromEntries(objects.map((o) => [o.id, o])), "yo") ||
    objects[0]?.id ||
    "";
  const [parentId, setParentId] = useState(fallbackParent);
  const titleRef = useRef(null);

  useEffect(() => {
    setParentId(fallbackParent);
  }, [fallbackParent]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const submitDoc = () => {
    onSubmit({
      title: title.trim() || "New File",
      parentObjectId: parentId || null,
    });
  };

  return (
    <div className="lp-overlay" onClick={onCancel}>
      <div className="lp-modal doc-new-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="lp-modal-close btn xs ghost" onClick={onCancel}>✕</button>
        <div className="doc-new-inner">
          <input
            ref={titleRef}
            type="text"
            className="doc-new-title note-form-field"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitDoc();
              }
              if (e.key === "Escape") onCancel();
            }}
          />
          <div className="doc-new-meta">
            <div className="doc-new-row">
              <span className="doc-new-icon">⏱</span>
              <span className="doc-new-key">Created</span>
              <span className="doc-new-val dim">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="doc-new-row">
              <span className="doc-new-icon">≡</span>
              <span className="doc-new-key">Tags</span>
              <span className="doc-new-val dim">—</span>
            </div>
            <div className="doc-new-row">
              <span className="doc-new-icon">⊢</span>
              <span className="doc-new-key">Parent</span>
              <select
                className="doc-new-select"
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                onClick={e => e.stopPropagation()}
              >
                <option value="">— sin padre —</option>
                {objects.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="doc-new-hint">Press Enter or Continue to open an empty page</p>
          <div className="doc-new-actions">
            <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn primary" onClick={submitDoc}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL: Create Node  (inline TYPE selector)
───────────────────────────────────────────── */
function NodeCreateModal({ docs, defaultParentDocId = "", onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [dataType, setDataType] = useState("text");
  const [content, setContent] = useState("");
  const [parentDocId, setParentDocId] = useState(defaultParentDocId);
  const ref = useRef(null);

  useEffect(() => {
    setParentDocId(defaultParentDocId);
  }, [defaultParentDocId]);

  useEffect(() => { ref.current?.focus(); }, []);

  const handleSave = () => {
    if (!title.trim()) return;
    let payload = content;
    if (dataType === "metric") {
      const n = Number(content);
      payload = { value: Number.isNaN(n) ? content : n, unit: "" };
    }
    onSubmit({ title: title.trim(), dataType, content: payload, parentDocId: parentDocId || null });
  };

  return (
    <div className="lp-overlay" onClick={onCancel}>
      <div className="lp-modal node-create-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="lp-modal-close btn xs ghost" onClick={onCancel}>✕</button>
        <input
          ref={ref}
          className="note-form-field node-create-title"
          placeholder="Title (e.g. Campaign, Note, Aim…)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <div className="node-create-type-row">
          <span className="label">TYPE</span>
          {["text", "date", "metric"].map(t => (
            <button
              key={t}
              type="button"
              className={"node-type-btn" + (dataType === t ? " active" : "")}
              onClick={() => setDataType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {docs.length > 0 && (
          <select
            className="note-form-field node-create-parent"
            value={parentDocId}
            onChange={e => setParentDocId(e.target.value)}
          >
            <option value="">— sin doc padre —</option>
            {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        )}
        {dataType === "date" ? (
          <input type="date" className="note-form-field" value={content} onChange={e => setContent(e.target.value)} />
        ) : (
          <textarea
            className="note-form-field"
            value={content}
            rows={3}
            placeholder="Content…"
            onChange={e => setContent(e.target.value)}
          />
        )}
        <div className="node-create-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSave}>
            Save · Free
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Dropdown  (shared)
───────────────────────────────────────────── */
function Dropdown({ label, open, onToggle, children, secondary }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div className="lp-dropdown-wrap" ref={ref}>
      <button
        type="button"
        className={"lp-dropdown-btn" + (secondary ? " secondary" : "")}
        onClick={onToggle}
      >
        {label} <span className="lp-chevron">▾</span>
      </button>
      {open && <div className="lp-dropdown-menu">{children}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   LEFT PANEL  (main export)
───────────────────────────────────────────── */
export function LeftPanel({ onInsertToCanvas }) {
  const [panelType, setPanelType]   = useState("Objects");
  const [activeId, setActiveId]     = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [typeOpen, setTypeOpen]     = useState(false);
  const [optOpen, setOptOpen]       = useState(false);

  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const filterDocId = useUIStateStore((s) => s.filterDocId);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setFilterDocId = useUIStateStore((s) => s.setFilterDocId);

  /* stores */
  const objects    = useObjectsStore(s => s.objects);
  const addObject  = useObjectsStore(s => s.addObject);
  const docs       = useDocsStore(s => s.docs);
  const addDoc     = useDocsStore(s => s.addDoc);
  const getDocsByObject = useDocsStore(s => s.getDocsByObject);
  const nodes      = useNodesStore(s => s.nodes);
  const addNode    = useNodesStore(s => s.addNode);
  const getNodesByDoc = useNodesStore(s => s.getNodesByDoc);
  const deleteNode = useNodesStore(s => s.deleteNode);

  const objList  = Object.values(objects);
  const docList  = Object.values(docs);
  const nodeList = Object.values(nodes);

  const filteredDocList = filterObjectId
    ? getDocsByObject(filterObjectId)
    : [];
  const filteredNodeList = filterDocId
    ? getNodesByDoc(filterDocId)
    : [];

  const filterObject = filterObjectId ? objects[filterObjectId] : null;
  const filterDoc = filterDocId ? docs[filterDocId] : null;

  const openDocumentsForObject = (objectId) => {
    setFilterObjectId(objectId);
    setPanelType("Documents");
    setActiveId(null);
    setShowCreate(false);
    setOptOpen(false);
  };

  const items = panelType === "Objects" ? objList : [];

  const activeItem =
    panelType === "Objects"
      ? objList.find((i) => i.id === activeId)
      : panelType === "Documents"
        ? docList.find((i) => i.id === activeId)
        : nodeList.find((i) => i.id === activeId);

  const getLabel = (item) =>
    panelType === "Objects" ? item.name : item.title;

  const switchType = (t) => {
    setPanelType(t);
    setActiveId(null);
    setTypeOpen(false);
    setOptOpen(false);
  };

  const handleCreate = (data) => {
    if (panelType === "Objects") {
      addObject(data.name, data.description, data.color);
    } else if (panelType === "Documents") {
      const parentId = data.parentObjectId || filterObjectId || null;
      const docId = addDoc(data.title, parentId);
      setActiveId(docId);
    } else {
      const parentDoc = data.parentDocId || filterDocId || null;
      addNode(data.title, data.dataType, data.content, parentDoc);
    }
    setShowCreate(false);
  };

  const optLabel =
    panelType === "Objects"
      ? activeItem
        ? getLabel(activeItem).slice(0, 18)
        : "Select option"
      : panelType === "Documents"
        ? activeItem
          ? activeItem.title.slice(0, 18)
          : "Select document"
        : filterDoc
          ? filterDoc.title.slice(0, 18)
          : "Select document";

  return (
    <div className="left-panel">

      {/* ── Selector row ── */}
      <div className="lp-selectors">
        <Dropdown
          label={panelType}
          open={typeOpen}
          onToggle={() => setTypeOpen(o => !o)}
        >
          {PANEL_TYPES.map(t => (
            <button
              key={t}
              type="button"
              className={"lp-dropdown-item" + (panelType === t ? " active" : "")}
              onClick={() => switchType(t)}
            >
              {TYPE_ICON[t]} {t}
            </button>
          ))}
        </Dropdown>

        {panelType === "Objects" && (
          <Dropdown
            label={optLabel}
            secondary
            open={optOpen}
            onToggle={() => setOptOpen((o) => !o)}
          >
            <button
              type="button"
              className="lp-dropdown-item create"
              onClick={() => { setShowCreate(true); setOptOpen(false); }}
            >
              <span className="lp-item-icon">✏</span>
              Create new object
            </button>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={"lp-dropdown-item" + (item.id === activeId ? " checked" : "")}
                onClick={() => {
                  setActiveId(item.id === activeId ? null : item.id);
                  setOptOpen(false);
                }}
              >
                <span className="lp-item-icon">◈</span>
                <span className="lp-item-label">{getLabel(item)}</span>
                {item.id === activeId && <span className="lp-check">✓</span>}
              </button>
            ))}
          </Dropdown>
        )}

        {panelType === "Documents" && (
          <Dropdown
            label={optLabel}
            secondary
            open={optOpen}
            onToggle={() => setOptOpen((o) => !o)}
          >
            <button
              type="button"
              className="lp-dropdown-item create"
              onClick={() => { setShowCreate(true); setOptOpen(false); }}
            >
              <span className="lp-item-icon">✏</span>
              Create new document
            </button>
            {filteredDocList.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={"lp-dropdown-item" + (doc.id === activeId ? " checked" : "")}
                onClick={() => {
                  setActiveId(doc.id);
                  setOptOpen(false);
                }}
              >
                <span className="lp-item-icon">📄</span>
                <span className="lp-item-label">{doc.title}</span>
                {doc.id === activeId && <span className="lp-check">✓</span>}
              </button>
            ))}
          </Dropdown>
        )}

        {panelType === "Nodes" && (
          <Dropdown
            label={optLabel}
            secondary
            open={optOpen}
            onToggle={() => setOptOpen((o) => !o)}
          >
            <button
              type="button"
              className="lp-dropdown-item create"
              onClick={() => { setShowCreate(true); setOptOpen(false); }}
            >
              <span className="lp-item-icon">✏</span>
              Create new node
            </button>
            {docList.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={"lp-dropdown-item" + (doc.id === filterDocId ? " checked" : "")}
                onClick={() => {
                  setFilterDocId(doc.id);
                  setActiveId(null);
                  setOptOpen(false);
                }}
              >
                <span className="lp-item-icon">📄</span>
                <span className="lp-item-label">{doc.title}</span>
                {doc.id === filterDocId && <span className="lp-check">✓</span>}
              </button>
            ))}
          </Dropdown>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="lp-content">

        {/* OBJECTS */}
        {panelType === "Objects" && (
          <div className="lp-objects-grid">
            {objList.map(obj => (
              <ObjectThumb
                key={obj.id}
                object={obj}
                active={obj.id === activeId}
                onClick={(e) => {
                  if (e.detail > 1) return;
                  setActiveId(obj.id === activeId ? null : obj.id);
                }}
                onDoubleClick={() => openDocumentsForObject(obj.id)}
              />
            ))}
            {objList.length === 0 && (
              <div className="lp-empty">
                <p>No objects yet</p>
                <p className="dim">Create your first model</p>
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS — filters + list */}
        {panelType === "Documents" && !activeItem && (
          <>
            <button
              type="button"
              className="btn xs solid lp-inline-create"
              onClick={() => setShowCreate(true)}
            >
              + Create new document
            </button>
            <ObjectPickerList
              objects={objList}
              activeObjectId={filterObjectId}
              onSelect={(id) => {
                setFilterObjectId(id);
                setActiveId(null);
              }}
            />
            {!filterObjectId && (
              <div className="lp-empty">
                <p>Select an object</p>
                <p className="dim">Or double-click an object to open its documents</p>
              </div>
            )}
            {filterObjectId && filteredDocList.map((doc) => (
              <DocListCard
                key={doc.id}
                doc={doc}
                objects={objects}
                onClick={() => setActiveId(doc.id)}
              />
            ))}
            {filterObjectId && filteredDocList.length === 0 && (
              <div className="lp-empty">
                <p>No documents for {filterObject?.name}</p>
                <p className="dim">Create one with Parent pre-selected</p>
              </div>
            )}
          </>
        )}

        {/* DOCUMENTS — expanded */}
        {panelType === "Documents" && activeItem && (
          <DocExpandedView docId={activeItem.id} onClose={() => setActiveId(null)} />
        )}

        {/* NODES — list */}
        {panelType === "Nodes" && !activeItem && (
          <>
            {filterDoc && (
              <p className="lp-context-label">{filterDoc.title}</p>
            )}
            {!filterDocId && (
              <div className="lp-empty">
                <p>Select a document</p>
                <p className="dim">Use the menu above — Create new node or pick a document</p>
              </div>
            )}
            {filterDocId && filteredNodeList.map((node) => (
              <NodeListCard
                key={node.id}
                node={node}
                docs={docs}
                onClick={() => setActiveId(node.id)}
                onInsert={() => onInsertToCanvas?.(node)}
                onDelete={() => deleteNode(node.id)}
              />
            ))}
            {filterDocId && filteredNodeList.length === 0 && (
              <div className="lp-empty">
                <p>No nodes in this document</p>
                <p className="dim">Create a node or use # in the doc editor</p>
              </div>
            )}
          </>
        )}

        {/* NODES — detail */}
        {panelType === "Nodes" && activeItem && (
          <NodeDetailView
            node={activeItem} docs={docs}
            onClose={() => setActiveId(null)}
            onInsert={() => onInsertToCanvas?.(activeItem)}
            onDelete={() => { deleteNode(activeItem.id); setActiveId(null); }}
          />
        )}
      </div>

      {/* ── Footer: tokens ── */}
      <div className="lp-footer">
        <div className="lp-tokens-row">
          <span className="lp-tokens-label">TOKENS</span>
          <div className="lp-tokens-value">
            <span className="lp-tokens-num">0</span>
            <span className="lp-tokens-sep"> / </span>
            <span className="lp-tokens-max">10</span>
          </div>
        </div>
        <div className="lp-tokens-bar">
          <div className="lp-tokens-fill" style={{ width: "0%" }} />
        </div>
        <div className="lp-tokens-meta">
          <span>{nodeList.length} manual · 0 AI</span>
          <button type="button" className="btn xs ghost">Upgrade →</button>
        </div>
      </div>

      {/* ── Create modals ── */}
      {showCreate && panelType === "Objects" && (
        <ObjectCreateModal onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}
      {showCreate && panelType === "Documents" && (
        <DocCreateModal
          objects={objList}
          defaultParentId={filterObjectId || ""}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {showCreate && panelType === "Nodes" && (
        <NodeCreateModal
          docs={docList}
          defaultParentDocId={filterDocId || ""}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
