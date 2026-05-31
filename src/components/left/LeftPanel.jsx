import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useObjectsStore, useDocsStore, useNodesStore, useUIStateStore,
} from "../../stores/index.js";
import { DATA_TYPE_ICONS, DATA_TYPE_ICON_ASSETS, NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { ObjectIcon } from "./objectIcons.jsx";
import { isoFromDateInput, todayDateInputValue } from "../../lib/docDates.js";
import { DocDocumentBox } from "../docs/DocDocumentBox.jsx";
import { docBlocksToBody } from "../../lib/docBlocks.js";
import { useDocBlockNodeModal, linkBlockNodesToDoc } from "../docs/useDocBlockNodeModal.jsx";
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

const SELECTOR_ICON_ASSETS = {
  Objects: "/uploads/botones/all-objects.svg",
  Documents: "/uploads/botones/docs.svg",
  Nodes: "/uploads/so-ref-nodes.svg",
};

function SelectorTypeIcon({ type, className = "lp-item-icon" }) {
  const src = SELECTOR_ICON_ASSETS[type];
  if (src) {
    return <img src={src} alt="" aria-hidden className={`${className} lp-item-icon-img`} />;
  }
  return <span className={className}>{TYPE_ICON[type] || "◯"}</span>;
}

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
        <span className="lp-doc-icon">
          <img src="/uploads/botones/docs.svg" alt="" aria-hidden className="lp-item-icon-img" />
        </span>
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
  const iconAsset = DATA_TYPE_ICON_ASSETS[node.dataType] || null;
  const displayTitle = getNodeDisplayTitle(node);
  const contentPreview = typeof node.content === "string"
    ? node.content.slice(0, 80)
    : node.content != null ? JSON.stringify(node.content).slice(0, 60) : "";

  return (
    <div className="lp-node-card">
      <div className="lp-node-card-head" onClick={onClick}>
        <span className="lp-node-type-icon">
          {iconAsset ? (
            <img src={iconAsset} alt="" aria-hidden className="lp-node-type-icon-img" />
          ) : (
            icon
          )}
        </span>
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
const CREATE_BUSINESS_ILLUSTRATION = "/uploads/botones/create-business-name.svg";

function ObjectCreateModal({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submitPayload = () => ({
    name: name.trim(),
    description: desc,
    color: "#5a1f1f",
  });

  return (
    <div className="lp-overlay" onClick={onCancel}>
      <div className="lp-modal obj-create-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="lp-modal-close btn xs ghost" onClick={onCancel}>✕</button>

        <div className="obj-create-preview-row">
          <img
            src={CREATE_BUSINESS_ILLUSTRATION}
            alt=""
            className="obj-create-illustration"
            draggable={false}
          />
        </div>

        <div>
          <h3 className="obj-create-title">Insert business reference</h3>
          <input
            ref={ref}
            className="note-form-field obj-name-input"
            placeholder="Corpus name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && name.trim()) onSubmit(submitPayload());
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
              className="btn primary obj-create-save"
              disabled={!name.trim()}
              onClick={() => onSubmit(submitPayload())}
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
  const fallbackParent = defaultParentId || "";
  const [parentId, setParentId] = useState(fallbackParent);
  const [createdDate, setCreatedDate] = useState(todayDateInputValue);
  const [version, setVersion] = useState("");
  const [category, setCategory] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [campaignActive, setCampaignActive] = useState(false);
  const [nodeLinkColor, setNodeLinkColor] = useState("dark");
  const titleRef = useRef(null);

  useEffect(() => {
    setParentId(fallbackParent);
  }, [fallbackParent]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const parentObject = objects.find((o) => o.id === parentId);

  const {
    onOpenNodeForBlock,
    onBlockAnchorChange,
    onAnswerBelowH1Change,
    nodeModal,
  } = useDocBlockNodeModal({
    blocks,
    setBlocks,
    createdDate,
    docId: null,
    docTitle: title,
    nodeLinkColor,
  });

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
      version: version.trim(),
      category: category.trim(),
      launchAt: launchDate ? isoFromDateInput(launchDate) : null,
      campaignActive,
      nodeLinkColor,
    });
  };

  return (
    <div className="lp-overlay lp-overlay--solid lp-overlay--center">
      <div className="lp-modal doc-new-modal" onClick={e => e.stopPropagation()}>
        <DocDocumentBox
          headerLabel={parentObject?.name || ""}
          title={title}
          onTitleChange={setTitle}
          titleRef={titleRef}
          body={body}
          onBodyChange={setBody}
          blocks={blocks}
          onBlocksChange={setBlocks}
          createdDate={createdDate}
          onCreatedDateChange={setCreatedDate}
          version={version}
          onVersionChange={setVersion}
          category={category}
          onCategoryChange={setCategory}
          launchDate={launchDate}
          onLaunchDateChange={setLaunchDate}
          campaignActive={campaignActive}
          onCampaignActiveChange={setCampaignActive}
          nodeLinkColor={nodeLinkColor}
          onNodeLinkColorChange={setNodeLinkColor}
          parentId={parentId}
          onParentIdChange={setParentId}
          objects={objects}
          onDelete={onCancel}
          onSave={submitDoc}
          onCloseExpand={onCancel}
          onOpenNodeForBlock={onOpenNodeForBlock}
          onAnswerBelowH1Change={onAnswerBelowH1Change}
          onBlockAnchorChange={onBlockAnchorChange}
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
      {nodeModal}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Dropdown  (shared)
───────────────────────────────────────────── */
function Dropdown({ label, open, onToggle, children }) {
  const ref = useRef(null);
  const leaveTimerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  useEffect(
    () => () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    },
    [],
  );

  return (
    <div
      className="lp-dropdown-wrap"
      ref={ref}
      onMouseEnter={() => {
        if (leaveTimerRef.current) {
          clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
      }}
      onMouseLeave={() => {
        if (!open) return;
        if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = setTimeout(() => {
          onToggle();
          leaveTimerRef.current = null;
        }, 180);
      }}
    >
      <button
        type="button"
        className="lp-dropdown-btn"
        onClick={onToggle}
      >
        {label}
      </button>
      {open && <div className="lp-dropdown-menu">{children}</div>}
    </div>
  );
}

function FolderTypeIcon({ panelType }) {
  return (
    <span className="lp-folder-icon lp-folder-icon--object" aria-hidden>
      <SelectorTypeIcon type={panelType} className="lp-folder-icon-img" />
    </span>
  );
}

/* ─────────────────────────────────────────────
   LEFT PANEL  (main export)
───────────────────────────────────────────── */
export function LeftPanel({
  onInsertToCanvas,
  onOpenDocument,
  onDocumentDeleted,
  tokenCurrent = 0,
  tokenMax = 10,
}) {
  const [panelType, setPanelType] = useState("Objects");
  const [activeId, setActiveId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [previewPanelType, setPreviewPanelType] = useState("Objects");
  const [hoveredPanelType, setHoveredPanelType] = useState(null);
  const [nodeEditId, setNodeEditId] = useState(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [objectScopeId, setObjectScopeId] = useState(null);

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
  const filteredObjectList = objectScopeId
    ? objList.filter((obj) => obj.id === objectScopeId)
    : objList;
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
    setFolderOpen(false);
  };

  const switchType = (t) => {
    setPanelType(t);
    setPreviewPanelType(t);
    setActiveId(null);
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
      const newDocId = addDoc(
        data.title,
        parentId,
        [],
        data.tags || [],
        data.body ?? "",
        data.createdAt,
        data.blocks ?? null,
        {
          version: data.version ?? "",
          category: data.category ?? "",
          launchAt: data.launchAt ?? null,
          campaignActive: Boolean(data.campaignActive),
          nodeLinkColor: data.nodeLinkColor ?? "dark",
        },
      );
      if (newDocId && data.blocks?.length) {
        linkBlockNodesToDoc(data.blocks, newDocId);
      }
      setActiveId(null);
      setShowCreate(false);
      if (newDocId && onOpenDocument) {
        onOpenDocument(newDocId);
      }
      return;
    }
    setShowCreate(false);
  };

  const folderScopeLabel =
    panelType === "Objects"
      ? objectScopeId
        ? objects[objectScopeId]?.name || "object"
        : "object"
      : panelType === "Documents"
        ? filterObjectId
          ? filterObject?.name || "object"
          : "document"
        : filterDoc
          ? filterDoc.title || "node"
          : "node";

  const folderLabel = `${panelType.slice(0, -1).toLowerCase()} : ${folderScopeLabel}`;

  const handleNewByFolder = () => {
    setShowCreate(true);
    setFolderOpen(false);
  };

  const commitPreviewType = () => {
    if (panelType !== previewPanelType) {
      setPanelType(previewPanelType);
      setActiveId(null);
    }
  };

  return (
    <div className="left-panel">

      {/* ── Selector row ── */}
      <div className="lp-selectors">
        <Dropdown
          label={
            <span className="lp-folder-trigger">
              <FolderTypeIcon panelType={panelType} />
              <span className="lp-folder-trigger-label">{folderLabel}</span>
            </span>
          }
          open={folderOpen}
          onToggle={() =>
            setFolderOpen((o) => {
              const next = !o;
              if (next) setPreviewPanelType(panelType);
              return next;
            })
          }
        >
          <div
            className="lp-dropdown-flyout"
            onMouseLeave={() => {
              setPreviewPanelType(panelType);
              setHoveredPanelType(null);
            }}
          >
            <div className="lp-dropdown-pane lp-dropdown-pane--types">
              {PANEL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={
                    "lp-dropdown-item lp-dropdown-item--type"
                    + (panelType === t ? " active" : "")
                    + (hoveredPanelType === t ? " preview" : "")
                  }
                  onMouseEnter={() => {
                    setPreviewPanelType(t);
                    setHoveredPanelType(t);
                  }}
                  onFocus={() => {
                    setPreviewPanelType(t);
                    setHoveredPanelType(t);
                  }}
                  onClick={() => switchType(t)}
                >
                  <SelectorTypeIcon type={t} />
                  {t}
                </button>
              ))}
            </div>
            <div className="lp-dropdown-pane lp-dropdown-pane--items">
              {previewPanelType === "Objects" && (
                <>
                  <button
                    type="button"
                    className={"lp-dropdown-item" + (!objectScopeId ? " checked" : "")}
                    onClick={() => {
                      commitPreviewType();
                      setObjectScopeId(null);
                      setActiveId(null);
                      setFolderOpen(false);
                    }}
                  >
                    <img
                      src="/uploads/botones/all-objects.svg"
                      alt=""
                      aria-hidden
                      className="lp-item-icon lp-item-icon-img"
                    />
                    <span className="lp-item-label">all objects</span>
                    {!objectScopeId && <span className="lp-check">✓</span>}
                  </button>
                  {objList.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      className={"lp-dropdown-item" + (obj.id === objectScopeId ? " checked" : "")}
                      onClick={() => {
                        commitPreviewType();
                        setObjectScopeId(obj.id);
                        setActiveId(obj.id);
                        setFolderOpen(false);
                      }}
                    >
                      <SelectorTypeIcon type="Objects" />
                      <span className="lp-item-label">{obj.name}</span>
                      {obj.id === objectScopeId && <span className="lp-check">✓</span>}
                    </button>
                  ))}
                </>
              )}
              {previewPanelType === "Documents" && (
                <>
                  <button
                    type="button"
                    className={"lp-dropdown-item" + (!filterObjectId ? " checked" : "")}
                    onClick={() => {
                      commitPreviewType();
                      setFilterObjectId(null);
                      setActiveId(null);
                      setFolderOpen(false);
                    }}
                  >
                    <SelectorTypeIcon type="Documents" />
                    <span className="lp-item-label">all documents</span>
                    {!filterObjectId && <span className="lp-check">✓</span>}
                  </button>
                  {objList.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      className={"lp-dropdown-item" + (obj.id === filterObjectId ? " checked" : "")}
                      onClick={() => {
                        commitPreviewType();
                        setFilterObjectId(obj.id);
                        setActiveId(null);
                        setFolderOpen(false);
                      }}
                    >
                      <SelectorTypeIcon type="Objects" />
                      <span className="lp-item-label">{obj.name}</span>
                      {obj.id === filterObjectId && <span className="lp-check">✓</span>}
                    </button>
                  ))}
                </>
              )}
              {previewPanelType === "Nodes" && (
                <>
                  <button
                    type="button"
                    className={"lp-dropdown-item" + (!filterDocId ? " checked" : "")}
                    onClick={() => {
                      commitPreviewType();
                      setFilterDocId(null);
                      setActiveId(null);
                      setFolderOpen(false);
                    }}
                  >
                    <SelectorTypeIcon type="Nodes" />
                    <span className="lp-item-label">all nodes</span>
                    {!filterDocId && <span className="lp-check">✓</span>}
                  </button>
                  {docList.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className={"lp-dropdown-item" + (doc.id === filterDocId ? " checked" : "")}
                      onClick={() => {
                        commitPreviewType();
                        setFilterDocId(doc.id);
                        setActiveId(null);
                        setFolderOpen(false);
                      }}
                    >
                      <SelectorTypeIcon type="Documents" />
                      <span className="lp-item-label">{doc.title}</span>
                      {doc.id === filterDocId && <span className="lp-check">✓</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </Dropdown>

        <button
          type="button"
          className="lp-new-btn"
          onClick={handleNewByFolder}
          aria-label={`Create new ${panelType.slice(0, -1).toLowerCase()}`}
        >
          <span className="lp-new-label">+ new</span>
        </button>
      </div>

      {/* ── Content area ── */}
      <div className="lp-content">

        {/* OBJECTS */}
        {panelType === "Objects" && (
          <>
            <div className="lp-objects-grid">
              {filteredObjectList.map(obj => (
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
              {filteredObjectList.length === 0 && (
                <div className="lp-empty">
                  <p>{objectScopeId ? "No object in this filter" : "No objects yet"}</p>
                  <p className="dim">{objectScopeId ? "Choose another subfolder" : "Create your first model"}</p>
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
            <span className="lp-tokens-num">{tokenCurrent}</span>
            <span className="lp-tokens-sep"> / </span>
            <span className="lp-tokens-max">{tokenMax}</span>
          </div>
        </div>
        <div className="lp-tokens-bar">
          <div
            className="lp-tokens-fill"
            style={{ width: `${Math.max(0, Math.min(100, (tokenCurrent / Math.max(tokenMax, 1)) * 100))}%` }}
          />
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
