import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useObjectsStore, useDocsStore, useNodesStore, useUIStateStore,
} from "../../stores/index.js";
import { DATA_TYPE_ICONS, DATA_TYPE_LABELS, NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { findObjectIdByName } from "../../lib/storeSanitize.js";
import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { ObjectIcon } from "./objectIcons.jsx";
import { isoFromDateInput, todayDateInputValue } from "../../lib/docDates.js";
import { DocDocumentBox } from "../docs/DocDocumentBox.jsx";
import { docBlocksToBody } from "../../lib/docBlocks.js";
import { StandaloneNodeModal } from "../nodes/StandaloneNodeModal.jsx";

function startObjectDrag(e, objectId) {
  setCanvasDragData(e.dataTransfer, { kind: "object", objectId });
}

function startDocDrag(e, docId) {
  setCanvasDragData(e.dataTransfer, { kind: "document", docId });
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

/* ─────────────────────────────────────────────
   Doc list card
───────────────────────────────────────────── */
function DocListCard({ doc, objects, onClick, onExpand, onDelete }) {
  const parent = doc.parentObjectId ? objects[doc.parentObjectId] : null;
  return (
    <div className="lp-doc-card fn-card">
      <button type="button" className="lp-doc-card-main" onClick={onClick}>
        <span
          className="lp-doc-drag-area"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            startDocDrag(e, doc.id);
          }}
          title="Drag document to canvas"
        >
          ⋮⋮
        </span>
        <span className="lp-doc-icon">📄</span>
        <div className="fn-card-body">
          <b>{doc.title}</b>
          <span className="fn-card-meta">
            {parent ? `↳ ${parent.name}` : "sin padre"} · {(doc.nodeIds || []).length} nodos
          </span>
        </div>
        <span
          className="lp-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            onExpand?.();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onExpand?.();
            }
          }}
        >
          ↗
        </span>
      </button>
      <button
        type="button"
        className="btn xs ghost danger-text lp-doc-card-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
      >
        delete
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Node list card (with parent + type + insert)
───────────────────────────────────────────── */
function getNodeDisplayTitle(node) {
  return (node.sourceQuery || node.title || "Untitled query").trim() || "Untitled query";
}

function NodeListCard({ node, docs, onClick, onInsert, onDelete }) {
  const parentDoc = node.parentDocId ? docs[node.parentDocId] : null;
  const icon = DATA_TYPE_ICONS[node.dataType] || "◯";
  const displayTitle = getNodeDisplayTitle(node);
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
        <b className="lp-node-title">{displayTitle}</b>
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [blocks, setBlocks] = useState([]);
  const fallbackParent =
    defaultParentId ||
    findObjectIdByName(Object.fromEntries(objects.map((o) => [o.id, o])), "yo") ||
    objects[0]?.id ||
    "";
  const [parentId, setParentId] = useState(fallbackParent);
  const [createdDate, setCreatedDate] = useState(todayDateInputValue);
  const titleRef = useRef(null);

  useEffect(() => {
    setParentId(fallbackParent);
  }, [fallbackParent]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const parentObject = objects.find((o) => o.id === parentId);

  const submitDoc = () => {
    const finalTitle = title.trim() || "New document";
    const autoTags = parentObject?.name ? [parentObject.name] : [];
    const serializedBody = docBlocksToBody(blocks) || body;
    onSubmit({
      title: finalTitle,
      parentObjectId: parentId || null,
      tags: autoTags,
      body: serializedBody,
      blocks,
      createdAt: isoFromDateInput(createdDate),
    });
  };

  return (
    <div className="lp-overlay lp-overlay--solid lp-overlay--center" onClick={onCancel}>
      <div className="lp-modal doc-new-modal" onClick={e => e.stopPropagation()}>
        <DocDocumentBox
          title={title}
          onTitleChange={setTitle}
          titleRef={titleRef}
          body={body}
          onBodyChange={setBody}
          blocks={blocks}
          onBlocksChange={setBlocks}
          createdDate={createdDate}
          onCreatedDateChange={setCreatedDate}
          parentId={parentId}
          onParentIdChange={setParentId}
          objects={objects}
          onDelete={onCancel}
          onSave={submitDoc}
          onCloseExpand={onCancel}
          onTitleKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          onBodyKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submitDoc();
            }
          }}
        />
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
export function LeftPanel({ onInsertToCanvas, onOpenDocument, onDocumentDeleted }) {
  const [panelType, setPanelType]   = useState("Objects");
  const [activeId, setActiveId]     = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [typeOpen, setTypeOpen]     = useState(false);
  const [optOpen, setOptOpen]       = useState(false);
  const [nodeEditId, setNodeEditId] = useState(null);
  const [nodeSearch, setNodeSearch] = useState("");

  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const filterDocId = useUIStateStore((s) => s.filterDocId);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setFilterDocId = useUIStateStore((s) => s.setFilterDocId);

  /* stores */
  const objects    = useObjectsStore(s => s.objects);
  const addObject  = useObjectsStore(s => s.addObject);
  const docs       = useDocsStore(s => s.docs);
  const addDoc     = useDocsStore(s => s.addDoc);
  const deleteDoc  = useDocsStore(s => s.deleteDoc);
  const getDocsByObject = useDocsStore(s => s.getDocsByObject);
  const deleteObjectWithCascade = useObjectsStore(s => s.deleteObjectWithCascade);
  const nodes      = useNodesStore(s => s.nodes);
  const addNode    = useNodesStore(s => s.addNode);
  const getNodesByDoc = useNodesStore(s => s.getNodesByDoc);
  const deleteNode = useNodesStore(s => s.deleteNode);

  const objList  = Object.values(objects);
  const docList  = Object.values(docs);
  const nodeList = Object.values(nodes);

  const docsWithoutParent = docList.filter((doc) => !doc.parentObjectId);
  const filteredDocList = filterObjectId ? getDocsByObject(filterObjectId) : docsWithoutParent;
  const objectDocSections = objList
    .map((obj) => ({ object: obj, docs: getDocsByObject(obj.id) }))
    .filter((section) => section.docs.length > 0);
  const filteredNodeList = (filterDocId ? getNodesByDoc(filterDocId) : nodeList).filter((node) => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return true;
    const title = (node.sourceQuery || node.title || "").toLowerCase();
    const content =
      typeof node.content === "string" ? node.content.toLowerCase() : JSON.stringify(node.content || "").toLowerCase();
    return title.includes(q) || content.includes(q);
  });

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

  const handleDeleteDoc = (doc) => {
    const label = doc.title || "this document";
    if (!window.confirm(`Delete "${label}" and its nodes? This cannot be undone.`)) {
      return;
    }
    deleteDoc(doc.id);
    if (activeId === doc.id) setActiveId(null);
    if (filterDocId === doc.id) setFilterDocId(null);
    onDocumentDeleted?.(doc.id);
  };

  const handleDeleteObject = (objectId) => {
    const obj = objects[objectId];
    if (!obj) return;
    const docCount = getDocsByObject(objectId).length;
    const msg =
      docCount > 0
        ? `Delete object "${obj.name}" and its ${docCount} document(s)? This cannot be undone.`
        : `Delete object "${obj.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    deleteObjectWithCascade(objectId);
    if (activeId === objectId) setActiveId(null);
    if (filterObjectId === objectId) setFilterObjectId(null);
  };

  const handleCreate = (data) => {
    if (panelType === "Objects") {
      addObject(data.name, data.description, data.color);
    } else if (panelType === "Documents") {
      const parentId = data.parentObjectId || null;
      addDoc(
        data.title,
        parentId,
        [],
        data.tags || [],
        data.body ?? "",
        data.createdAt,
        data.blocks ?? null,
      );
      setActiveId(null);
    }
    setShowCreate(false);
  };

  const optLabel =
    panelType === "Objects"
      ? activeItem
        ? getLabel(activeItem).slice(0, 18)
        : "Select option"
        : panelType === "Documents"
        ? filterObjectId
          ? filterObject?.name || "Select object"
          : "Documents"
        : filterDoc
          ? filterDoc.title.slice(0, 18)
          : "nodes";

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
            <button
              type="button"
              className={"lp-dropdown-item" + (!filterObjectId ? " checked" : "")}
              onClick={() => {
                setFilterObjectId(null);
                setActiveId(null);
                setOptOpen(false);
              }}
            >
              <span className="lp-item-icon">📄</span>
              <span className="lp-item-label">Documents</span>
              {!filterObjectId && <span className="lp-check">✓</span>}
            </button>
            {objList.map((obj) => (
              <button
                key={obj.id}
                type="button"
                className={"lp-dropdown-item" + (obj.id === filterObjectId ? " checked" : "")}
                onClick={() => {
                  setFilterObjectId(obj.id);
                  setActiveId(null);
                  setOptOpen(false);
                }}
              >
                <span className="lp-item-icon">◈</span>
                <span className="lp-item-label">{obj.name}</span>
                {obj.id === filterObjectId && <span className="lp-check">✓</span>}
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
            <button
              type="button"
              className={"lp-dropdown-item" + (!filterDocId ? " checked" : "")}
              onClick={() => {
                setFilterDocId(null);
                setActiveId(null);
                setOptOpen(false);
              }}
            >
              <span className="lp-item-icon">◯</span>
              <span className="lp-item-label">nodes</span>
              {!filterDocId && <span className="lp-check">✓</span>}
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
          <>
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
            {activeId && objects[activeId] && (
              <button
                type="button"
                className="btn xs ghost danger-text lp-object-delete"
                onClick={() => handleDeleteObject(activeId)}
              >
                delete object
              </button>
            )}
          </>
        )}

        {/* DOCUMENTS — filters + list */}
        {panelType === "Documents" && (
          <>
            {filteredDocList.map((doc) => (
              <DocListCard
                key={doc.id}
                doc={doc}
                objects={objects}
                onClick={() => {
                  setActiveId(doc.id);
                  onOpenDocument?.(doc.id);
                }}
                onExpand={() => onOpenDocument?.(doc.id)}
                onDelete={() => handleDeleteDoc(doc)}
              />
            ))}
            {!filterObjectId && objectDocSections.map((section) => (
              <div key={section.object.id} className="lp-doc-section">
                <p className="lp-context-label">{section.object.name}</p>
                {section.docs.map((doc) => (
                  <DocListCard
                    key={doc.id}
                    doc={doc}
                    objects={objects}
                    onClick={() => {
                      setActiveId(doc.id);
                      onOpenDocument?.(doc.id);
                    }}
                    onExpand={() => onOpenDocument?.(doc.id)}
                    onDelete={() => handleDeleteDoc(doc)}
                  />
                ))}
              </div>
            ))}
            {filteredDocList.length === 0 && (
              <div className="lp-empty">
                <p>{filterObjectId ? `No documents for ${filterObject?.name}` : "No documents without parent"}</p>
                <p className="dim">Create one and leave Parent empty</p>
              </div>
            )}
          </>
        )}

        {/* NODES — list */}
        {panelType === "Nodes" && !nodeEditId && (
          <>
            <input
              type="text"
              className="note-form-field"
              placeholder="Search nodes"
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
            />
            {filterDoc ? (
              <p className="lp-context-label">{filterDoc.title}</p>
            ) : (
              <p className="lp-context-label dim">all nodes</p>
            )}
            {filteredNodeList.map((node) => (
              <NodeListCard
                key={node.id}
                node={node}
                docs={docs}
                onClick={() => {
                  setActiveId(node.id);
                  setNodeEditId(node.id);
                }}
                onInsert={() => onInsertToCanvas?.(node)}
                onDelete={() => deleteNode(node.id)}
              />
            ))}
            {filteredNodeList.length === 0 && (
              <div className="lp-empty">
                <p>{filterDocId ? "No nodes in this document" : "No nodes yet"}</p>
                <p className="dim">Create new node above</p>
              </div>
            )}
          </>
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
      {showCreate && panelType === "Documents" && typeof document !== "undefined" && createPortal(
        <DocCreateModal
          objects={objList}
          defaultParentId={filterObjectId || ""}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />,
        document.body,
      )}
      {showCreate && panelType === "Nodes" && typeof document !== "undefined" && createPortal(
        <StandaloneNodeModal
          docs={docList}
          defaultParentDocId={filterDocId || ""}
          onClose={() => setShowCreate(false)}
          onSaved={() => setShowCreate(false)}
        />,
        document.body,
      )}
      {nodeEditId && nodes[nodeEditId] && panelType === "Nodes" && typeof document !== "undefined" && createPortal(
        <StandaloneNodeModal
          node={nodes[nodeEditId]}
          docs={docList}
          defaultParentDocId={filterDocId || ""}
          onClose={() => {
            setNodeEditId(null);
            setActiveId(null);
          }}
          onSaved={() => {}}
          onDeleted={(id) => {
            deleteNode(id);
            setNodeEditId(null);
            setActiveId(null);
          }}
        />,
        document.body,
      )}
    </div>
  );
}
