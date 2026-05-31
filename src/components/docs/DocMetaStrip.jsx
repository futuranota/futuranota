import { useEffect, useRef, useState } from "react";
import { getToday } from "../../data.jsx";
import { formatCampaignLabel, formatWindowDays } from "../../lib/docMetaBar.js";
import { formatMmDdYy, isoFromDateInput } from "../../lib/docDates.js";
import { resolveSubcategoryLines, resolveLinkedProductCategories } from "../../lib/templateDoc.js";
import { NodeLinkColorPicker } from "./blocks/NodeLinkColorPicker.jsx";
import { SubcategoryField } from "./SubcategoryField.jsx";
import { ProductCategorySubcategoryField } from "./ProductCategorySubcategoryField.jsx";
import { ProductVersionField } from "./ProductVersionField.jsx";

function openDatePicker(e) {
  e.stopPropagation();
  const input = e.currentTarget;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      /* some browsers reject showPicker outside direct user gesture */
    }
  }
}

/** Summary cell — ref: public/uploads/botones/referencia.jpg */
function MetaChip({
  label,
  value,
  tone = "muted",
  placeholder = null,
  emptyDisplay = "",
  valueLowercase = false,
  asTag = false,
}) {
  const empty = value == null || value === "" || value === "—";
  const display = empty ? (placeholder ?? emptyDisplay) : value;
  const isPlaceholder = empty && Boolean(placeholder);

  return (
    <div className="doc-meta-chip" title={!empty ? String(value) : undefined}>
      <span className="doc-meta-chip-k">{label}</span>
      {asTag && !empty ? (
        <span className="doc-product-category-tag doc-product-category-tag--summary">{display}</span>
      ) : (
        <span
          className={
            "doc-meta-chip-v"
            + (tone === "created" ? " tone-created" : " tone-muted")
            + (isPlaceholder ? " is-placeholder" : "")
            + (empty && !placeholder ? " is-empty" : "")
            + (valueLowercase ? " is-lowercase" : "")
          }
        >
          {display}
        </span>
      )}
    </div>
  );
}

function ProductCategoryField({ value, onChange, placeholder = "Type product category" }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const trimmed = value.trim();
  const showInput = !trimmed || editing;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="doc-meta-field">
      <span className="doc-meta-field-k">Category</span>
      <div className="doc-product-category-wrap">
        {trimmed && !editing ? (
          <button
            type="button"
            className="doc-product-category-tag"
            title={`${trimmed} · click to edit`}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {trimmed}
          </button>
        ) : null}
        {showInput ? (
          <input
            ref={inputRef}
            type="text"
            className="doc-new-meta-input doc-meta-field-input doc-product-category-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (trimmed) setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            placeholder={trimmed ? "Edit category" : placeholder}
            spellCheck={false}
          />
        ) : null}
      </div>
    </div>
  );
}

function resolveParentObject(objects, parentId) {
  if (!parentId || !objects) return null;
  if (Array.isArray(objects)) return objects.find((o) => o.id === parentId) ?? null;
  return objects[parentId] ?? null;
}

/**
 * Compact meta strip: one summary row + collapsible editor drawer.
 */
export function DocMetaStrip({
  createdDate,
  onCreatedDateChange,
  brandLabel = "",
  version = "",
  onVersionChange,
  onVersionCommit,
  category = "",
  onCategoryChange,
  launchDate = "",
  onLaunchDateChange,
  campaignActive = false,
  onCampaignActiveChange,
  parentId = "",
  subcategoryDocIds = [],
  onSubcategoryDocIdsChange,
  allDocs = null,
  docId = null,
  nodeLinkColor = "dark",
  onNodeLinkColorChange,
  objects = null,
  showCampaignMeta = false,
  metaMode = "campaign",
}) {
  const [expanded, setExpanded] = useState(false);
  const isProductMode = metaMode === "product";
  const isContentMode = metaMode === "content";
  const isLegacyCampaign = metaMode === "campaign" && showCampaignMeta;
  const showMetaFields = isProductMode || isContentMode || isLegacyCampaign;
  const launchIso = launchDate ? isoFromDateInput(launchDate) : null;
  const today = getToday();
  const windowSummary = formatWindowDays(today, launchIso);
  const parentObject = resolveParentObject(objects, parentId);
  const brandSummary = parentObject?.brand?.trim() || brandLabel?.trim() || null;
  const showLegacySubcategories = isLegacyCampaign && Boolean(onSubcategoryDocIdsChange && allDocs);
  const showProductSubcategories = isContentMode && Boolean(onSubcategoryDocIdsChange && allDocs);
  const subcategoryLines = showLegacySubcategories
    ? resolveSubcategoryLines(allDocs, subcategoryDocIds)
    : [];
  const linkedProductLabels = isContentMode
    ? resolveLinkedProductCategories(allDocs, subcategoryDocIds)
    : [];
  const subcategorySummary = subcategoryLines.length
    ? `${subcategoryLines.length} doc${subcategoryLines.length === 1 ? "" : "s"}`
    : linkedProductLabels.length
      ? linkedProductLabels.join(", ")
      : isContentMode && subcategoryDocIds?.length
        ? `${subcategoryDocIds.length} product${subcategoryDocIds.length === 1 ? "" : "s"}`
        : null;

  const campaignSummary = (isLegacyCampaign || isContentMode)
    ? formatCampaignLabel(campaignActive)
    : null;

  const launchFormatted = formatMmDdYy(launchDate);

  return (
    <div className={"doc-meta-strip" + (expanded ? " doc-meta-strip--open" : "")}>
      <div className="doc-meta-strip__summary">
        <div className="doc-meta-strip__chips" role="list">
          {isProductMode ? (
            <>
              <MetaChip label="Category" value={category.trim() || null} asTag />
              <MetaChip label="Version" value={version.trim() || null} />
            </>
          ) : null}
          {isContentMode ? (
            <>
              <MetaChip label="Brand" value={brandSummary} />
              <MetaChip label="Category" value={category.trim() || null} asTag />
              <MetaChip label="Campaign" value={campaignSummary} valueLowercase />
              <MetaChip label="Subcategories" value={subcategorySummary} />
              <MetaChip label="Launch" value={launchFormatted || null} />
              <MetaChip label="Window" value={windowSummary} />
            </>
          ) : null}
          {isLegacyCampaign ? (
            <>
              <MetaChip label="Brand" value={brandSummary} />
              <MetaChip label="Version" value={version.trim() || null} />
              <MetaChip label="Campaign" value={campaignSummary} valueLowercase />
              <MetaChip label="Category" value={category.trim() || null} asTag />
              <MetaChip label="Launch" value={launchFormatted || null} />
              <MetaChip label="Window" value={windowSummary} />
              {showLegacySubcategories ? (
                <MetaChip label="Subcategories" value={subcategorySummary} />
              ) : null}
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="doc-meta-strip__toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide document fields" : "Edit document fields"}
          title={expanded ? "Hide" : "Edit"}
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

          {isProductMode ? (
            <>
              <ProductVersionField
                onCommit={onVersionCommit}
                parentId={parentId}
                category={category}
                allDocs={allDocs}
                docId={docId}
              />
              <ProductCategoryField value={category} onChange={onCategoryChange} />
            </>
          ) : null}

          {isContentMode ? (
            <>
              <div className="doc-meta-field">
                <span className="doc-meta-field-k">Campaign</span>
                <div className="doc-new-campaign-toggle" role="group" aria-label="Campaign status">
                  <button
                    type="button"
                    className={"doc-new-campaign-opt" + (campaignActive ? " is-on" : "")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCampaignActiveChange(true);
                    }}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={"doc-new-campaign-opt" + (!campaignActive ? " is-on" : "")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCampaignActiveChange(false);
                    }}
                  >
                    inactive
                  </button>
                </div>
              </div>
              <ProductCategoryField
                value={category}
                onChange={onCategoryChange}
                placeholder="e.g. blogs"
              />
              <label className="doc-meta-field">
                <span className="doc-meta-field-k">Launch</span>
                <input
                  type="date"
                  className="doc-new-date doc-meta-field-input"
                  value={launchDate}
                  onChange={(e) => onLaunchDateChange(e.target.value)}
                  onClick={openDatePicker}
                  onFocus={openDatePicker}
                />
              </label>
              {showProductSubcategories ? (
                <ProductCategorySubcategoryField
                  parentId={parentId}
                  allDocs={allDocs}
                  selectedDocIds={subcategoryDocIds}
                  onChange={onSubcategoryDocIdsChange}
                  excludeDocId={docId}
                />
              ) : null}
              <div className="doc-meta-field doc-meta-field--readonly">
                <span className="doc-meta-field-k">Window</span>
                <span className="doc-new-meta-readonly">{windowSummary}</span>
              </div>
            </>
          ) : null}

          {isLegacyCampaign ? (
            <>
              <ProductVersionField
                onCommit={onVersionCommit}
                parentId={parentId}
                category={category}
                allDocs={allDocs}
                docId={docId}
              />
              <div className="doc-meta-field">
                <span className="doc-meta-field-k">Campaign</span>
                <div className="doc-new-campaign-toggle" role="group" aria-label="Campaign status">
                  <button
                    type="button"
                    className={"doc-new-campaign-opt" + (campaignActive ? " is-on" : "")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCampaignActiveChange(true);
                    }}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={"doc-new-campaign-opt" + (!campaignActive ? " is-on" : "")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCampaignActiveChange(false);
                    }}
                  >
                    inactive
                  </button>
                </div>
              </div>
              <ProductCategoryField value={category} onChange={onCategoryChange} />
              <label className="doc-meta-field">
                <span className="doc-meta-field-k">Launch</span>
                <input
                  type="date"
                  className="doc-new-date doc-meta-field-input"
                  value={launchDate}
                  onChange={(e) => onLaunchDateChange(e.target.value)}
                  onClick={openDatePicker}
                  onFocus={openDatePicker}
                />
              </label>
              {showLegacySubcategories ? (
                <SubcategoryField
                  parentId={parentId}
                  allDocs={allDocs}
                  selectedDocIds={subcategoryDocIds}
                  onChange={onSubcategoryDocIdsChange}
                  excludeDocId={docId}
                />
              ) : null}
              <div className="doc-meta-field doc-meta-field--readonly">
                <span className="doc-meta-field-k">Window</span>
                <span className="doc-new-meta-readonly">{windowSummary}</span>
              </div>
            </>
          ) : null}

          {showMetaFields && onNodeLinkColorChange ? (
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
