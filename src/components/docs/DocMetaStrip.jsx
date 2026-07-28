import { useEffect, useRef, useState } from "react";
import { getToday } from "../../data.jsx";
import { formatCampaignLabel, formatWindowDays } from "../../lib/docMetaBar.js";
import { formatMmDdYy, isoFromDateInput } from "../../lib/docDates.js";
import { formatFolderScheduleDuration } from "../../lib/folderScheduleReservation.js";
import {
  FolderScheduleRangeField,
  formatScheduleRangeDisplay,
} from "./FolderScheduleRangeField.jsx";
import {
  importKnowledgeFile,
  KNOWLEDGE_FILE_ACCEPT,
  FLOPPY_DISK_ICON,
  normalizeKnowledgeImport,
} from "../../lib/knowledgeImport.js";
import { resolveSubcategoryLines, resolveLinkedProductCategories } from "../../lib/templateDoc.js";
import { NodeLinkColorPicker } from "./blocks/NodeLinkColorPicker.jsx";
import { SubcategoryField } from "./SubcategoryField.jsx";
import { ProductCategoryField } from "./ProductCategoryField.jsx";
import { ProductVersionField } from "./ProductVersionField.jsx";
import { DepartmentCategoryField } from "./DepartmentCategoryField.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { resolveFolderStatus } from "../../lib/folderStatus.js";

const SCHEDULE_INFO_ICON = "/uploads/Info.svg";

const FOLDER_STATUS_ICON = {
  not_started: "/uploads/not-started.svg",
  pending: "/uploads/pending.svg",
  completed: "/uploads/completed.svg",
};

function FolderStatusBadge({ status, label }) {
  const src = FOLDER_STATUS_ICON[status] || FOLDER_STATUS_ICON.not_started;
  return (
    <img
      src={src}
      alt={label}
      title={label}
      className={`doc-meta-status-badge doc-meta-status-badge--${status}`}
    />
  );
}

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
  infoText = "",
  infoAria = "",
  statusTone = null,
}) {
  const empty = value == null || value === "" || value === "—";
  const display = empty ? (placeholder ?? emptyDisplay) : value;
  const isPlaceholder = empty && Boolean(placeholder);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!infoOpen) return undefined;
    const onPointerDown = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) {
        setInfoOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setInfoOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [infoOpen]);

  return (
    <div className="doc-meta-chip" title={!empty && !infoText ? String(value) : undefined}>
      <span className="doc-meta-chip-k">
        {label}
        {infoText ? (
          <span className="doc-meta-chip-info" ref={infoRef}>
            <button
              type="button"
              className="doc-meta-chip-info__btn"
              aria-label={infoAria || label}
              aria-expanded={infoOpen}
              onClick={(e) => {
                e.stopPropagation();
                setInfoOpen((v) => !v);
              }}
            >
              <img src={SCHEDULE_INFO_ICON} alt="" aria-hidden className="doc-meta-chip-info__icon" />
            </button>
            {infoOpen ? (
              <div className="doc-meta-chip-info__pop" role="dialog" aria-label={infoAria || label}>
                {infoText}
              </div>
            ) : null}
          </span>
        ) : null}
      </span>
      {asTag && !empty ? (
        <span className="doc-product-category-tag doc-product-category-tag--summary">{display}</span>
      ) : statusTone && !empty ? (
        <FolderStatusBadge status={statusTone} label={display} />
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

function KnowledgeUploadField({ onImport, knowledgeImport = null, hasExistingImport = false }) {
  const inputRef = useRef(null);
  const imported = normalizeKnowledgeImport(knowledgeImport);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onImport) return;
    try {
      const data = await importKnowledgeFile(file);
      if (
        hasExistingImport
        && !window.confirm("Replace the imported file? Your summary text will be kept.")
      ) {
        return;
      }
      onImport(data);
    } catch (err) {
      window.alert(err?.message || "Upload failed");
    }
  };

  return (
    <div className="doc-meta-field doc-meta-field--upload">
      <span className="doc-meta-field-k">File</span>
      <button
        type="button"
        className={
          "doc-meta-upload-btn"
          + (imported ? " doc-meta-upload-btn--imported" : "")
        }
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        title={imported ? `${imported.fileName}, click to replace` : "Upload a file"}
      >
        {imported ? (
          <>
            <img
              src={FLOPPY_DISK_ICON}
              alt=""
              className="doc-meta-upload-btn__icon"
              draggable={false}
            />
            <span className="doc-meta-upload-btn__name">{imported.fileName}</span>
            <span className="doc-meta-upload-btn__state">imported</span>
          </>
        ) : (
          "upload"
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={KNOWLEDGE_FILE_ACCEPT}
        hidden
        onChange={handleChange}
      />
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
  departmentId = null,
  onDepartmentIdChange,
  departments = [],
  departmentLabel = "",
  launchDate = "",
  onLaunchDateChange,
  scheduleStartDate = "",
  onScheduleStartDateChange,
  scheduleFinishDate = "",
  onScheduleFinishDateChange,
  scheduleStartMin = "",
  onScheduleDatesClear,
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
  /**
   * Campaign folder container: Active / Launch / Window live on child docs.
   * Hide those editors on the folder; keep category / subcategories / brand.
   */
  deferCampaignStatusToChildren = false,
  /** Documents folder reservation UI (Start/Finish). */
  useFolderSchedule = false,
  metaMode = "campaign",
  onKnowledgeFileImport,
  knowledgeImport = null,
  hasKnowledgeImport = false,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const isProductMode = metaMode === "product";
  const isContentMode = metaMode === "content";
  const isKnowledgeMode = metaMode === "knowledge";
  const isLegacyCampaign = metaMode === "campaign" && showCampaignMeta;
  const showFolderSchedule = isContentMode && useFolderSchedule;
  const showContentCampaignMeta = isContentMode
    && !useFolderSchedule
    && !deferCampaignStatusToChildren;
  const showFolderCampaignStatus = (isLegacyCampaign || showContentCampaignMeta)
    && !deferCampaignStatusToChildren;
  const showMetaFields = isProductMode || isContentMode || isLegacyCampaign || isKnowledgeMode;
  const launchIso = launchDate ? isoFromDateInput(launchDate) : null;
  const today = getToday();
  const windowSummary = formatWindowDays(today, launchIso);
  const parentObject = resolveParentObject(objects, parentId);
  const brandSummary = parentObject?.brand?.trim() || brandLabel?.trim() || null;
  const showLegacySubcategories = isLegacyCampaign && Boolean(onSubcategoryDocIdsChange && allDocs);
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

  const nodes = useNodesStore((s) => s.nodes);
  const folderStatus = resolveFolderStatus(nodes, docId);
  const folderStatusLabel =
    folderStatus.status === "completed"
      ? t("meta.statusCompleted")
      : folderStatus.status === "pending"
        ? t("meta.statusPending")
        : t("meta.statusNotStarted");

  const campaignSummary = showFolderCampaignStatus
    ? formatCampaignLabel(campaignActive)
    : null;

  const launchFormatted = formatMmDdYy(launchDate);
  const scheduleRangeSummary = showFolderSchedule
    ? formatScheduleRangeDisplay(scheduleStartDate, scheduleFinishDate)
    : "";
  const scheduleDuration = showFolderSchedule
    ? formatFolderScheduleDuration(scheduleStartDate, scheduleFinishDate, t)
    : null;
  const importedFile = normalizeKnowledgeImport(knowledgeImport);

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
              <MetaChip label={t("meta.category")} value={category.trim() || null} />
              {showFolderSchedule ? (
                <>
                  <MetaChip
                    label={t("meta.scheduleRange")}
                    value={scheduleRangeSummary || null}
                    infoText={t("meta.scheduleInfoBody")}
                    infoAria={t("meta.scheduleInfoAria")}
                  />
                  <MetaChip label={t("meta.scheduleDuration")} value={scheduleDuration} />
                  {scheduleRangeSummary ? (
                    <MetaChip
                      label={t("meta.status")}
                      value={folderStatusLabel}
                      statusTone={folderStatus.status}
                    />
                  ) : null}
                </>
              ) : showFolderCampaignStatus ? (
                <>
                  <MetaChip label={t("meta.campaign")} value={campaignSummary} valueLowercase />
                  <MetaChip label={t("meta.launch")} value={launchFormatted || null} />
                  <MetaChip label={t("meta.window")} value={windowSummary} />
                </>
              ) : null}
            </>
          ) : null}
          {isLegacyCampaign ? (
            <>
              <MetaChip label="Brand" value={brandSummary} />
              <MetaChip label="Version" value={version.trim() || null} />
              {showFolderCampaignStatus ? (
                <MetaChip label="Campaign" value={campaignSummary} valueLowercase />
              ) : null}
              <MetaChip label="Category" value={category.trim() || null} asTag />
              {showFolderCampaignStatus ? (
                <>
                  <MetaChip label="Launch" value={launchFormatted || null} />
                  <MetaChip label="Window" value={windowSummary} />
                </>
              ) : null}
              {showLegacySubcategories ? (
                <MetaChip label="Subcategories" value={subcategorySummary} />
              ) : null}
            </>
          ) : null}
          {isKnowledgeMode ? (
            <>
              <MetaChip label="Category" value="knowledge" asTag />
              <MetaChip
                label="Subcategory"
                value={category.trim() || null}
                placeholder="e.g. marketing"
              />
              {importedFile ? (
                <MetaChip label="File" value={importedFile.fileName} />
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
            <span className="doc-meta-field-k">{t("meta.created")}</span>
            {onCreatedDateChange ? (
              <input
                type="date"
                className="doc-new-date doc-meta-field-input"
                value={createdDate}
                onChange={(e) => onCreatedDateChange(e.target.value)}
                onClick={openDatePicker}
                onFocus={openDatePicker}
              />
            ) : (
              <input
                type="date"
                className="doc-new-date doc-meta-field-input is-readonly"
                value={createdDate}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                title="Created date is fixed at creation"
              />
            )}
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
              <ProductCategoryField
                value={category}
                onChange={onCategoryChange}
                parentId={parentId}
                allDocs={allDocs}
                docId={docId}
              />
            </>
          ) : null}

          {isContentMode ? (
            <>
              {showContentCampaignMeta ? (
                <div className="doc-meta-field">
                  <span className="doc-meta-field-k">{t("meta.campaign")}</span>
                  <div className="doc-new-campaign-toggle" role="group" aria-label="Campaign status">
                    <button
                      type="button"
                      className={"doc-new-campaign-opt" + (campaignActive ? " is-on" : "")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCampaignActiveChange?.(true);
                      }}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={"doc-new-campaign-opt" + (!campaignActive ? " is-on" : "")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCampaignActiveChange?.(false);
                      }}
                    >
                      inactive
                    </button>
                  </div>
                </div>
              ) : null}
              <DepartmentCategoryField
                value={category}
                departmentId={departmentId}
                onChange={onCategoryChange}
                departments={departments}
                placeholder={t("sidebar.departmentSubPlaceholder")}
              />
              {showFolderSchedule ? (
                <>
                  <FolderScheduleRangeField
                    label={t("meta.scheduleRange")}
                    startValue={scheduleStartDate}
                    finishValue={scheduleFinishDate}
                    onStartChange={onScheduleStartDateChange}
                    onFinishChange={onScheduleFinishDateChange}
                    onClear={onScheduleDatesClear}
                    minDate={scheduleStartMin || undefined}
                    allDocs={allDocs}
                    parentId={parentId}
                    excludeDocId={docId}
                  />
                  {scheduleStartDate && scheduleFinishDate ? (
                    <div className="doc-meta-field doc-meta-field--readonly">
                      <span className="doc-meta-field-k">{t("meta.status")}</span>
                      <FolderStatusBadge status={folderStatus.status} label={folderStatusLabel} />
                    </div>
                  ) : null}
                  <div className="doc-meta-field doc-meta-field--readonly">
                    <span className="doc-meta-field-k">{t("meta.scheduleDuration")}</span>
                    <span className="doc-new-meta-readonly">
                      {scheduleDuration || "—"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <label className="doc-meta-field">
                    <span className="doc-meta-field-k">{t("meta.launch")}</span>
                    <input
                      type="date"
                      className="doc-new-date doc-meta-field-input"
                      value={launchDate}
                      onChange={(e) => onLaunchDateChange?.(e.target.value)}
                      onClick={openDatePicker}
                      onFocus={openDatePicker}
                    />
                  </label>
                  <div className="doc-meta-field doc-meta-field--readonly">
                    <span className="doc-meta-field-k">{t("meta.window")}</span>
                    <span className="doc-new-meta-readonly">{windowSummary}</span>
                  </div>
                </>
              )}
            </>
          ) : null}

          {isKnowledgeMode ? (
            <>
              <div className="doc-meta-field doc-meta-field--knowledge-tag">
                <span className="doc-meta-field-k">Category</span>
                <span className="doc-product-category-tag doc-product-category-tag--fixed">knowledge</span>
              </div>
              <ProductCategoryField
                value={category}
                onChange={onCategoryChange}
                placeholder="e.g. marketing"
                knowledgeMode
                allDocs={allDocs}
                docId={docId}
              />
              {onKnowledgeFileImport ? (
                <KnowledgeUploadField
                  onImport={onKnowledgeFileImport}
                  knowledgeImport={knowledgeImport}
                  hasExistingImport={hasKnowledgeImport}
                />
              ) : null}
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
              {showFolderCampaignStatus ? (
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
              ) : null}
              <ProductCategoryField
                value={category}
                onChange={onCategoryChange}
                parentId={parentId}
                allDocs={allDocs}
                docId={docId}
              />
              {showFolderCampaignStatus ? (
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
              ) : null}
              {showLegacySubcategories ? (
                <SubcategoryField
                  parentId={parentId}
                  allDocs={allDocs}
                  selectedDocIds={subcategoryDocIds}
                  onChange={onSubcategoryDocIdsChange}
                  excludeDocId={docId}
                />
              ) : null}
              {showFolderCampaignStatus ? (
                <div className="doc-meta-field doc-meta-field--readonly">
                  <span className="doc-meta-field-k">Window</span>
                  <span className="doc-new-meta-readonly">{windowSummary}</span>
                </div>
              ) : null}
            </>
          ) : null}

          {showMetaFields && onNodeLinkColorChange && !isKnowledgeMode ? (
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
