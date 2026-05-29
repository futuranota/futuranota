import { useState } from "react";
import { getToday } from "../../data.jsx";
import { formatCampaignLabel, formatWindowDays } from "../../lib/docMetaBar.js";
import { formatMmDdYy, isoFromDateInput } from "../../lib/docDates.js";
import { NodeLinkColorPicker } from "./blocks/NodeLinkColorPicker.jsx";

const PARENT_PLACEHOLDER = "Select parent";

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
}) {
  const empty = value == null || value === "" || value === "—";
  const display = empty ? (placeholder ?? emptyDisplay) : value;
  const isPlaceholder = empty && Boolean(placeholder);

  return (
    <div className="doc-meta-chip" title={!empty ? String(value) : undefined}>
      <span className="doc-meta-chip-k">{label}</span>
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
    </div>
  );
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
  category = "",
  onCategoryChange,
  launchDate = "",
  onLaunchDateChange,
  campaignActive = false,
  onCampaignActiveChange,
  parentId = "",
  onParentIdChange,
  nodeLinkColor = "dark",
  onNodeLinkColorChange,
  objects = null,
  showCampaignMeta = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const showParent = objects && onParentIdChange;
  const launchIso = launchDate ? isoFromDateInput(launchDate) : null;
  const today = getToday();
  const windowSummary = formatWindowDays(today, launchIso);
  const parentName =
    objects?.find((o) => o.id === parentId)?.name?.trim()
    || (brandLabel && brandLabel !== "— sin padre —" ? brandLabel : null);

  const campaignSummary = showCampaignMeta
    ? formatCampaignLabel(campaignActive)
    : null;

  const launchFormatted = formatMmDdYy(launchDate);

  return (
    <div className={"doc-meta-strip" + (expanded ? " doc-meta-strip--open" : "")}>
      <div className="doc-meta-strip__summary">
        <div className="doc-meta-strip__chips" role="list">
          <MetaChip
            label="Created"
            value={formatMmDdYy(createdDate)}
            tone="created"
          />
          {showCampaignMeta ? (
            <>
              <MetaChip label="Brand" value={parentName} />
              <MetaChip label="Version" value={version.trim() || null} />
              <MetaChip label="Campaign" value={campaignSummary} valueLowercase />
              <MetaChip label="Category" value={category.trim() || null} />
              <MetaChip label="Launch" value={launchFormatted || null} />
              <MetaChip label="Window" value={windowSummary} />
            </>
          ) : null}
          {showParent && !showCampaignMeta ? (
            <MetaChip label="Parent" value={parentName} />
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

          {showCampaignMeta ? (
            <>
              <label className="doc-meta-field">
                <span className="doc-meta-field-k">Version</span>
                <input
                  type="text"
                  className="doc-new-meta-input doc-meta-field-input"
                  value={version}
                  onChange={(e) => onVersionChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Type your version"
                  spellCheck={false}
                />
              </label>
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
              <label className="doc-meta-field">
                <span className="doc-meta-field-k">Categories</span>
                <input
                  type="text"
                  className="doc-new-meta-input doc-meta-field-input"
                  value={category}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Type your category"
                  spellCheck={false}
                />
              </label>
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
              <div className="doc-meta-field doc-meta-field--readonly">
                <span className="doc-meta-field-k">Window</span>
                <span className="doc-new-meta-readonly">{windowSummary}</span>
              </div>
            </>
          ) : null}

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
