import { useState } from "react";
import { formatMmDdYy } from "../../lib/docDates.js";
import {
  listProductSubcategoryCandidates,
  resolveSubcategoryLines,
  templateKindLabel,
  TEMPLATE_KIND_CAMPAIGN,
} from "../../lib/templateDoc.js";
import { NodeLinkColorPicker } from "../docs/blocks/NodeLinkColorPicker.jsx";

const PARENT_PLACEHOLDER = "Select parent";

function openDatePicker(e) {
  e.stopPropagation();
  const input = e.currentTarget;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      /* ignore */
    }
  }
}

function MetaChip({ label, value, asTag = false }) {
  const empty = value == null || value === "";
  return (
    <div className="doc-meta-chip" title={!empty ? String(value) : undefined}>
      <span className="doc-meta-chip-k">{label}</span>
      {asTag && !empty ? (
        <span className="doc-product-category-tag doc-product-category-tag--summary">{value}</span>
      ) : (
        <span className={"doc-meta-chip-v tone-muted" + (empty ? " is-empty" : "")}>
          {empty ? "" : value}
        </span>
      )}
    </div>
  );
}

function SubcategoryPicker({ parentId, allDocs, selectedDocIds, onChange, excludeDocId = null }) {
  const candidates = listProductSubcategoryCandidates(allDocs, parentId, excludeDocId);
  const selectedSet = new Set(selectedDocIds || []);

  const toggle = (docId) => {
    const next = selectedSet.has(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...(selectedDocIds || []), docId];
    onChange(next);
  };

  if (!parentId) {
    return (
      <p className="template-subcategory-empty dim">
        Select a parent to list product lines.
      </p>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="template-subcategory-empty dim">
        No product docs with category + version yet. Create products first.
      </p>
    );
  }

  return (
    <ul className="template-subcategory-list" role="list">
      {candidates.map(({ docId, label }) => {
        const checked = selectedSet.has(docId);
        return (
          <li key={docId}>
            <label className="template-subcategory-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(docId)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="template-subcategory-option-label">{label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Meta strip for campaign analysis template documents.
 */
export function TemplateMetaStrip({
  createdDate,
  onCreatedDateChange,
  parentId = "",
  onParentIdChange,
  objects = null,
  templateKind = TEMPLATE_KIND_CAMPAIGN,
  templateSubcategoryDocIds = [],
  onTemplateSubcategoryDocIdsChange,
  allDocs = null,
  excludeDocId = null,
  nodeLinkColor = "dark",
  onNodeLinkColorChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const showParent = objects && onParentIdChange;
  const campaignLabel = templateKindLabel(templateKind);
  const subcategoryLines = resolveSubcategoryLines(allDocs, templateSubcategoryDocIds);
  const subcategorySummary = subcategoryLines.length
    ? `${subcategoryLines.length} line${subcategoryLines.length === 1 ? "" : "s"}`
    : null;

  return (
    <div className={"doc-meta-strip template-meta-strip" + (expanded ? " doc-meta-strip--open" : "")}>
      <div className="doc-meta-strip__summary">
        <div className="doc-meta-strip__chips" role="list">
          <MetaChip label="Created" value={formatMmDdYy(createdDate)} />
          <MetaChip label="Category" value={campaignLabel} asTag />
          <MetaChip label="Subcategories" value={subcategorySummary} />
        </div>
        <button
          type="button"
          className="doc-meta-strip__toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide template fields" : "Edit template fields"}
        >
          <span className="doc-meta-strip__chevron" aria-hidden>
            {expanded ? "▾" : "›"}
          </span>
        </button>
      </div>

      <div className="doc-meta-strip__drawer" aria-hidden={!expanded}>
        <div className="doc-meta-strip__fields">
          <label className="doc-meta-field">
            <span className="doc-meta-field-k">Created</span>
            <input
              type="date"
              className="doc-new-date doc-meta-field-input"
              value={createdDate}
              onChange={(e) => onCreatedDateChange(e.target.value)}
              onClick={openDatePicker}
              onFocus={openDatePicker}
            />
          </label>

          {showParent ? (
            <label className="doc-meta-field">
              <span className="doc-meta-field-k">Parent</span>
              <select
                className={
                  "doc-new-select doc-meta-field-input"
                  + (!parentId ? " is-placeholder-option" : "")
                }
                value={parentId}
                onChange={(e) => onParentIdChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">{PARENT_PLACEHOLDER}</option>
                {objects.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="doc-meta-field">
            <span className="doc-meta-field-k">Category</span>
            <span className="doc-product-category-tag template-meta-campaign-tag">
              {campaignLabel}
            </span>
          </div>

          <div className="doc-meta-field template-subcategory-field">
            <span className="doc-meta-field-k">Products Subcategories</span>
            {subcategoryLines.length > 0 ? (
              <ul className="template-subcategory-lines" role="list">
                {subcategoryLines.map(({ docId, label }) => (
                  <li key={docId}>
                    <span className="template-subcategory-line-tag">{label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <SubcategoryPicker
              parentId={parentId}
              allDocs={allDocs}
              selectedDocIds={templateSubcategoryDocIds}
              onChange={onTemplateSubcategoryDocIdsChange}
              excludeDocId={excludeDocId}
            />
          </div>

          {onNodeLinkColorChange ? (
            <NodeLinkColorPicker
              variant="meta"
              value={nodeLinkColor}
              onChange={onNodeLinkColorChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
