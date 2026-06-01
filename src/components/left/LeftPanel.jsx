import { useState, useRef, useEffect, useMemo } from "react";
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
import {
  isTemplateDoc,
  findProductVersionDoc,
  formatProductDocTitle,
  listProductDocs,
  listContentDocs,
  resolveProductDocDisplayTitle,
} from "../../lib/templateDoc.js";

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
function ObjectThumb({ object, active, onClick, onDoubleClick, onDelete, onEdit }) {
  return (
    <div className={"obj-thumb-cell" + (active ? " active" : "")}>
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
      {active && (
        <div className="obj-thumb-actions">
          <button
            type="button"
            className="btn xs ghost obj-thumb-action obj-thumb-action--delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            delete
          </button>
          <button
            type="button"
            className="btn xs ghost obj-thumb-action obj-thumb-action--edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
          >
            edit
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Doc list card
───────────────────────────────────────────── */
function ClickFolderBox({ variant, onClick }) {
  return (
    <button
      type="button"
      className={`lp-click-folder-box lp-click-folder-box--${variant}`}
      onClick={onClick}
      title="Click to open folder"
    >
      <ClickFolderIcon variant={variant} />
    </button>
  );
}

function ClickFolderBack({ onBack, label, lowercase = false }) {
  return (
    <button type="button" className="lp-click-folder-back" onClick={onBack}>
      <span className="lp-click-folder-back-arrow" aria-hidden>←</span>
      <span className={"lp-click-folder-back-label" + (lowercase ? " is-lowercase" : "")}>{label}</span>
    </button>
  );
}

function ClickFolderIcon({ variant, className = "lp-click-folder-box-icon" }) {
  if (variant === "groups") {
    return (
      <svg className={className} viewBox="90 68 32 26" fill="none" aria-hidden>
        <path
          fill="currentColor"
          d="M99.7878 72.4041C99.7152 72.1863 99.5759 71.9968 99.3897 71.8625C99.2035 71.7283 98.9797 71.656 98.7501 71.656C98.5205 71.656 98.2967 71.7283 98.1105 71.8625C97.9242 71.9968 97.7849 72.1863 97.7124 72.4041L92.2436 88.8104C92.1888 88.9748 92.1739 89.1499 92.2 89.3212C92.2261 89.4925 92.2926 89.6552 92.394 89.7958C92.4953 89.9364 92.6286 90.0509 92.7829 90.1299C92.9372 90.2088 93.108 90.25 93.2813 90.25H104.219C104.392 90.25 104.563 90.2088 104.717 90.1299C104.872 90.0509 105.005 89.9364 105.106 89.7958C105.208 89.6552 105.274 89.4925 105.3 89.3212C105.326 89.1499 105.311 88.9748 105.257 88.8104L99.7878 72.4041ZM94.7989 88.0625L98.7501 76.209L102.701 88.0625H94.7989ZM118.438 74.3906C118.438 72.9845 118.021 71.61 117.239 70.4409C116.458 69.2717 115.348 68.3605 114.049 67.8224C112.75 67.2843 111.32 67.1435 109.941 67.4179C108.562 67.6922 107.295 68.3693 106.301 69.3635C105.307 70.3578 104.63 71.6246 104.355 73.0037C104.081 74.3827 104.222 75.8122 104.76 77.1113C105.298 78.4103 106.209 79.5207 107.378 80.3019C108.548 81.083 109.922 81.5 111.328 81.5C113.213 81.4978 115.02 80.7481 116.353 79.4153C117.686 78.0825 118.435 76.2755 118.438 74.3906ZM106.406 74.3906C106.406 73.4172 106.695 72.4656 107.236 71.6562C107.777 70.8468 108.545 70.2159 109.445 69.8434C110.344 69.4709 111.334 69.3734 112.288 69.5633C113.243 69.7532 114.12 70.222 114.808 70.9103C115.497 71.5987 115.966 72.4757 116.156 73.4304C116.345 74.3852 116.248 75.3748 115.875 76.2741C115.503 77.1735 114.872 77.9422 114.063 78.483C113.253 79.0238 112.302 79.3125 111.328 79.3125C110.023 79.3125 108.771 78.7939 107.848 77.8709C106.925 76.9479 106.406 75.696 106.406 74.3906ZM120.625 83.6875H108.594C108.304 83.6875 108.026 83.8027 107.820 84.0079C107.615 84.213 107.5 84.4912 107.5 84.7813V92.4375C107.5 92.7276 107.615 93.0058 107.820 93.2109C108.026 93.416 108.304 93.5313 108.594 93.5313H120.625C120.915 93.5313 121.193 93.416 121.398 93.2109C121.604 93.0058 121.719 92.7276 121.719 92.4375V84.7813C121.719 84.4912 121.604 84.213 121.398 84.0079C121.193 83.8027 120.915 83.6875 120.625 83.6875ZM119.531 91.3438H109.688V85.875H119.531V91.3438Z"
        />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="97 58 28 47" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M121.5 85.25H100.5C100.036 85.25 99.5908 85.4344 99.2626 85.7626C98.9344 86.0908 98.75 86.5359 98.75 87V89.625C98.75 90.0891 98.9344 90.5342 99.2626 90.8624C99.5908 91.1906 100.036 91.375 100.5 91.375V101C100.5 101.464 100.684 101.909 101.013 102.237C101.341 102.566 101.786 102.75 102.25 102.75H119.75C120.214 102.75 120.659 102.566 120.987 102.237C121.316 101.909 121.5 101.464 121.5 101V91.375C121.964 91.375 122.409 91.1906 122.737 90.8624C123.066 90.5342 123.25 90.0891 123.25 89.625V87C123.25 86.5359 123.066 86.0908 122.737 85.7626C122.409 85.4344 121.964 85.25 121.5 85.25ZM119.75 101H102.25V91.375H119.75V101ZM121.5 89.625H100.5V87H121.5V89.625ZM107.5 94.875C107.5 94.6429 107.592 94.4204 107.756 94.2563C107.92 94.0922 108.143 94 108.375 94H113.625C113.857 94 114.08 94.0922 114.244 94.2563C114.408 94.4204 114.5 94.6429 114.5 94.875C114.5 95.1071 114.408 95.3296 114.244 95.4937C114.08 95.6578 113.857 95.75 113.625 95.75H108.375C108.143 95.75 107.92 95.6578 107.756 95.4937C107.592 95.3296 107.5 95.1071 107.5 94.875Z"
      />
      <path
        fill="currentColor"
        d="M104.39 62.2035C104.327 62.0168 104.208 61.8544 104.048 61.7393C103.889 61.6242 103.697 61.5623 103.5 61.5623C103.303 61.5623 103.111 61.6242 102.952 61.7393C102.792 61.8544 102.673 62.0168 102.611 62.2035L97.9231 76.266C97.8761 76.407 97.8633 76.557 97.8857 76.7039C97.9081 76.8507 97.9651 76.9902 98.052 77.1107C98.1388 77.2312 98.2531 77.3293 98.3853 77.397C98.5176 77.4647 98.664 77.5 98.8126 77.5H108.188C108.336 77.5 108.483 77.4647 108.615 77.397C108.747 77.3293 108.861 77.2312 108.948 77.1107C109.035 76.9902 109.092 76.8507 109.114 76.7039C109.137 76.557 109.124 76.407 109.077 76.266L104.39 62.2035ZM100.113 75.625L103.5 65.4648L106.887 75.625H100.113ZM120.375 63.9063C120.375 62.701 120.018 61.5229 119.348 60.5207C118.678 59.5186 117.727 58.7376 116.613 58.2764C115.5 57.8151 114.275 57.6945 113.092 57.9296C111.91 58.1647 110.825 58.7451 109.972 59.5973C109.12 60.4495 108.54 61.5353 108.305 62.7174C108.07 63.8995 108.19 65.1247 108.651 66.2382C109.113 67.3517 109.894 68.3034 110.896 68.973C111.898 69.6426 113.076 70 114.281 70C115.897 69.9981 117.446 69.3555 118.588 68.2131C119.731 67.0707 120.373 65.5218 120.375 63.9063ZM110.063 63.9063C110.063 63.0719 110.31 62.2562 110.774 61.5624C111.237 60.8687 111.896 60.3279 112.667 60.0086C113.438 59.6893 114.286 59.6058 115.104 59.7686C115.923 59.9313 116.674 60.3331 117.264 60.9231C117.854 61.5131 118.256 62.2649 118.419 63.0832C118.582 63.9016 118.498 64.7498 118.179 65.5207C117.86 66.2916 117.319 66.9505 116.625 67.414C115.931 67.8776 115.116 68.125 114.281 68.125C113.162 68.125 112.089 67.6805 111.298 66.8894C110.507 66.0982 110.063 65.0251 110.063 63.9063ZM122.25 71.875H111.938C111.689 71.875 111.45 71.9738 111.275 72.1496C111.099 72.3254 111 72.5639 111 72.8125V79.375C111 79.6236 111.099 79.8621 111.275 80.0379C111.45 80.2137 111.689 80.3125 111.938 80.3125H122.25C122.499 80.3125 122.737 80.2137 122.913 80.0379C123.089 79.8621 123.188 79.6236 123.188 79.375V72.8125C123.188 72.5639 123.089 72.3254 122.913 72.1496C122.737 71.9738 122.499 71.875 122.25 71.875ZM121.313 78.4375H112.875V73.75H121.313V78.4375Z"
      />
    </svg>
  );
}

function DocListCard({ doc, objects, onClick, onExpand, onDelete }) {
  const parent = doc.parentObjectId ? objects[doc.parentObjectId] : null;
  const isTemplate = isTemplateDoc(doc);
  const displayTitle = resolveProductDocDisplayTitle(doc);
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
          <b>{displayTitle}</b>
          <span className="fn-card-meta">
            {isTemplate ? "template · " : ""}
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

function ObjectCreateModal({ onSubmit, onCancel, initial = null }) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submitPayload = () => ({
    name: name.trim(),
    brand: brand.trim(),
    description: desc,
    color: initial?.color ?? "#5a1f1f",
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
          <h3 className="obj-create-title">
            {isEdit ? "Edit business reference" : "Insert business reference"}
          </h3>
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
          <input
            className="note-form-field obj-brand-input"
            placeholder="Brand"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && name.trim()) onSubmit(submitPayload());
              if (e.key === "Escape") onCancel();
            }}
            spellCheck={false}
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
              {isEdit ? "Save changes" : "Save object"}
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
function DocCreateModal({
  objects,
  allDocs,
  defaultParentId,
  createMode = "content",
  defaultCategory = "",
  onSubmit,
  onCancel,
  onOpenDocument,
  onInsertToCanvas,
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [blocks, setBlocks] = useState([]);
  const fallbackParent = defaultParentId || "";
  const [parentId, setParentId] = useState(fallbackParent);
  const [createdDate, setCreatedDate] = useState(todayDateInputValue);
  const [version, setVersion] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [launchDate, setLaunchDate] = useState("");
  const [campaignActive, setCampaignActive] = useState(false);
  const [subcategoryDocIds, setSubcategoryDocIds] = useState([]);
  const [nodeLinkColor, setNodeLinkColor] = useState("dark");
  const titleRef = useRef(null);
  const isProductMode = createMode === "product";
  const metaMode = isProductMode ? "product" : "content";
  const docKind = isProductMode ? "product" : "content";

  useEffect(() => {
    setParentId(fallbackParent);
  }, [fallbackParent]);

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const parentObject = objects.find((o) => o.id === parentId);

  const handleTitleChange = (value) => {
    setTitle(value);
    if (isProductMode) setCategory(value);
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    if (isProductMode) setTitle(value);
  };

  const {
    onOpenNodeForBlock,
    onEnsureNodeForBlock,
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
    onInsertToCanvas,
  });

  const handleVersionCommit = (trimmedVersion) => {
    const trimmed = trimmedVersion.trim();
    if (!trimmed) {
      setVersion("");
      return;
    }
    const cat = category.trim();
    if (cat) {
      const existing = findProductVersionDoc(allDocs, parentId, cat, trimmed);
      if (existing) {
        onCancel();
        onOpenDocument?.(existing.id);
        return;
      }
    }
    setVersion(trimmed);
    setBlocks([]);
    setBody("");
  };

  const submitDoc = () => {
    const trimmedCategory = category.trim();
    const productName = title.trim() || trimmedCategory;
    const finalCategory = isProductMode
      ? (trimmedCategory || productName)
      : trimmedCategory;
    const finalTitle = isProductMode
      ? (formatProductDocTitle(finalCategory || productName, version.trim()) || productName || "New product")
      : (title.trim() || "New document");
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
      category: finalCategory,
      launchAt: launchDate ? isoFromDateInput(launchDate) : null,
      campaignActive,
      subcategoryDocIds,
      nodeLinkColor,
      docKind,
    });
  };

  return (
    <div className="lp-overlay lp-overlay--solid lp-overlay--center">
      <div className="lp-modal doc-new-modal" onClick={(e) => e.stopPropagation()}>
        <DocDocumentBox
          title={title}
          onTitleChange={handleTitleChange}
          titleRef={titleRef}
          titlePlaceholder={isProductMode ? "Product's name" : "Write your description"}
          body={body}
          onBodyChange={setBody}
          blocks={blocks}
          onBlocksChange={setBlocks}
          createdDate={createdDate}
          onCreatedDateChange={setCreatedDate}
          version={version}
          onVersionChange={setVersion}
          onVersionCommit={handleVersionCommit}
          category={category}
          onCategoryChange={handleCategoryChange}
          launchDate={launchDate}
          onLaunchDateChange={setLaunchDate}
          campaignActive={campaignActive}
          onCampaignActiveChange={setCampaignActive}
          subcategoryDocIds={subcategoryDocIds}
          onSubcategoryDocIdsChange={setSubcategoryDocIds}
          allDocs={allDocs}
          nodeLinkColor={nodeLinkColor}
          onNodeLinkColorChange={setNodeLinkColor}
          parentId={parentId}
          onParentIdChange={setParentId}
          objects={objects}
          docKind={docKind}
          metaMode={metaMode}
          onDelete={onCancel}
          onSave={submitDoc}
          onCloseExpand={onCancel}
          onOpenNodeForBlock={onOpenNodeForBlock}
          onEnsureNodeForBlock={onEnsureNodeForBlock}
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
  const [editObjectId, setEditObjectId] = useState(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [previewPanelType, setPreviewPanelType] = useState("Objects");
  const [hoveredPanelType, setHoveredPanelType] = useState(null);
  const [nodeEditId, setNodeEditId] = useState(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [objectScopeId, setObjectScopeId] = useState(null);
  const [clickFolderView, setClickFolderView] = useState(null);

  const filterObjectId = useUIStateStore((s) => s.filterObjectId);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const filterDocId = useUIStateStore((s) => s.filterDocId);
  const setFilterObjectId = useUIStateStore((s) => s.setFilterObjectId);
  const setSelectedObjectId = useUIStateStore((s) => s.setSelectedObjectId);
  const setFilterDocId = useUIStateStore((s) => s.setFilterDocId);

  /* stores */
  const objects    = useObjectsStore(s => s.objects);
  const addObject  = useObjectsStore(s => s.addObject);
  const updateObject = useObjectsStore(s => s.updateObject);
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

  const productDocs = useMemo(
    () => (filterObjectId ? listProductDocs(docs, filterObjectId) : []),
    [docs, filterObjectId],
  );
  const contentDocs = useMemo(
    () => (filterObjectId ? listContentDocs(docs, filterObjectId) : []),
    [docs, filterObjectId],
  );

  useEffect(() => {
    setClickFolderView(null);
  }, [panelType, filterObjectId]);

  const handleOpenFolderDoc = (docId) => {
    setActiveId(docId);
    onOpenDocument?.(docId);
  };

  const handleDeleteDoc = (doc) => {
    const label = resolveProductDocDisplayTitle(doc);
    if (!window.confirm(`Delete "${label}" and its nodes? This cannot be undone.`)) {
      return;
    }
    onDocumentDeleted?.(doc.id);
    deleteDoc(doc.id);
    if (activeId === doc.id) setActiveId(null);
    if (filterDocId === doc.id) setFilterDocId(null);
  };

  const openDocumentsForObject = (objectId) => {
    setFilterObjectId(objectId);
    setSelectedObjectId(objectId);
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
    if (selectedObjectId === objectId) setSelectedObjectId(null);
    if (editObjectId === objectId) setEditObjectId(null);
  };

  const handleUpdateObject = (data) => {
    if (!editObjectId) return;
    updateObject(editObjectId, {
      name: data.name,
      brand: data.brand,
      description: data.description,
    });
    setEditObjectId(null);
  };

  const handleCreate = (data) => {
    if (panelType === "Objects") {
      const newObjectId = addObject(data.name, data.description, data.color, data.brand);
      if (newObjectId) {
        setActiveId(newObjectId);
        setSelectedObjectId(newObjectId);
      }
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
          docKind: data.docKind ?? "standard",
          templateKind: data.templateKind ?? null,
          templateSubcategoryDocIds: data.subcategoryDocIds ?? data.templateSubcategoryDocIds ?? [],
          subcategoryDocIds: data.subcategoryDocIds ?? data.templateSubcategoryDocIds ?? [],
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
    if (panelType === "Documents" && !clickFolderView) return;
    setShowCreate(true);
    setFolderOpen(false);
  };

  const newDisabled = panelType === "Documents" && !clickFolderView;
  const docCreateMode = clickFolderView === "groups" ? "product" : "content";

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
                      <span className="lp-item-label">{resolveProductDocDisplayTitle(doc)}</span>
                      {doc.id === filterDocId && <span className="lp-check">✓</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </Dropdown>

        <div className="lp-selector-actions">
          <button
            type="button"
            className="lp-new-btn"
            onClick={handleNewByFolder}
            disabled={newDisabled}
            title={newDisabled ? "Open a folder first" : undefined}
            aria-label={`Create new ${panelType.slice(0, -1).toLowerCase()}`}
          >
            <span className="lp-new-label">+ new</span>
          </button>
        </div>
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
                    const nextId = obj.id === activeId ? null : obj.id;
                    setActiveId(nextId);
                    setSelectedObjectId(nextId);
                  }}
                  onDoubleClick={() => openDocumentsForObject(obj.id)}
                  onDelete={() => handleDeleteObject(obj.id)}
                  onEdit={() => setEditObjectId(obj.id)}
                />
              ))}
              {filteredObjectList.length === 0 && (
                <div className="lp-empty">
                  <p>{objectScopeId ? "No object in this filter" : "No objects yet"}</p>
                  <p className="dim">{objectScopeId ? "Choose another subfolder" : "Create your first model"}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* DOCUMENTS — click folder navigation */}
        {panelType === "Documents" && (
          <div className="lp-click-folders-stack">
            {clickFolderView === null ? (
              <>
                <ClickFolderBox variant="groups" onClick={() => setClickFolderView("groups")} />
                <ClickFolderBox variant="subgroups" onClick={() => setClickFolderView("subgroups")} />
              </>
            ) : null}

            {clickFolderView === "groups" ? (
              <div className="lp-click-folder-detail">
                <ClickFolderBack onBack={() => setClickFolderView(null)} label="Products" />
                <div className="lp-click-folder-detail-list">
                  {productDocs.length ? (
                    productDocs.map((doc) => (
                      <DocListCard
                        key={doc.id}
                        doc={doc}
                        objects={objects}
                        onClick={() => handleOpenFolderDoc(doc.id)}
                        onExpand={() => handleOpenFolderDoc(doc.id)}
                        onDelete={() => handleDeleteDoc(doc)}
                      />
                    ))
                  ) : (
                    <div className="lp-empty">
                      <p className="dim">No products yet</p>
                      <p className="dim">Use + new to create a product</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {clickFolderView === "subgroups" ? (
              <div className="lp-click-folder-detail">
                <ClickFolderBack onBack={() => setClickFolderView(null)} label="Content" />
                <div className="lp-click-folder-detail-list">
                  {contentDocs.length ? (
                    contentDocs.map((doc) => (
                      <DocListCard
                        key={doc.id}
                        doc={doc}
                        objects={objects}
                        onClick={() => handleOpenFolderDoc(doc.id)}
                        onExpand={() => handleOpenFolderDoc(doc.id)}
                        onDelete={() => handleDeleteDoc(doc)}
                      />
                    ))
                  ) : (
                    <div className="lp-empty">
                      <p className="dim">No content docs yet</p>
                      <p className="dim">Use + new to create content</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
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
      {editObjectId && objects[editObjectId] && (
        <ObjectCreateModal
          initial={objects[editObjectId]}
          onSubmit={handleUpdateObject}
          onCancel={() => setEditObjectId(null)}
        />
      )}
      {showCreate && panelType === "Documents" && typeof document !== "undefined" && createPortal(
        <DocCreateModal
          objects={objList}
          allDocs={docs}
          defaultParentId={filterObjectId || ""}
          createMode={docCreateMode}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          onOpenDocument={onOpenDocument}
          onInsertToCanvas={onInsertToCanvas}
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
