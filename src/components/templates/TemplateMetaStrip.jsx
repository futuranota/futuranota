import { useState } from "react";
import {
  resolveSubcategoryLines,
  templateKindLabel,
  TEMPLATE_KIND_CAMPAIGN,
} from "../../lib/templateDoc.js";
import { NodeLinkColorPicker } from "../docs/blocks/NodeLinkColorPicker.jsx";
import { SubcategoryField } from "../docs/SubcategoryField.jsx";

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

/**
 * Meta strip for campaign analysis template documents.
 */
export function TemplateMetaStrip({
  createdDate,
  onCreatedDateChange,
  parentId = "",
  templateKind = TEMPLATE_KIND_CAMPAIGN,
  subcategoryDocIds = [],
  onSubcategoryDocIdsChange,
  templateSubcategoryDocIds = [],
  onTemplateSubcategoryDocIdsChange,
  allDocs = null,
  excludeDocId = null,
  nodeLinkColor = "dark",
  onNodeLinkColorChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const campaignLabel = templateKindLabel(templateKind);
  const resolvedSubcategoryDocIds = subcategoryDocIds?.length
    ? subcategoryDocIds
    : templateSubcategoryDocIds;
  const handleSubcategoryChange = onSubcategoryDocIdsChange || onTemplateSubcategoryDocIdsChange;
  const subcategoryLines = resolveSubcategoryLines(allDocs, resolvedSubcategoryDocIds);
  const subcategorySummary = subcategoryLines.length
    ? `${subcategoryLines.length} line${subcategoryLines.length === 1 ? "" : "s"}`
    : null;

  return (
    <div className={"doc-meta-strip template-meta-strip" + (expanded ? " doc-meta-strip--open" : "")}>
      <div className="doc-meta-strip__summary">
        <div className="doc-meta-strip__chips" role="list">
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

          <div className="doc-meta-field">
            <span className="doc-meta-field-k">Category</span>
            <span className="doc-product-category-tag template-meta-campaign-tag">
              {campaignLabel}
            </span>
          </div>

          {handleSubcategoryChange ? (
            <SubcategoryField
              parentId={parentId}
              allDocs={allDocs}
              selectedDocIds={resolvedSubcategoryDocIds}
              onChange={handleSubcategoryChange}
              excludeDocId={excludeDocId}
              optional={false}
            />
          ) : null}

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
