import { useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { exportWorkspaceTreeZip } from "../../lib/exportWorkspaceTreeZip.js";
import { ExportWorkspaceModal } from "./ExportWorkspaceModal.jsx";
import { ExportPackModal } from "./ExportPackModal.jsx";
import { IePackChooserModal } from "./IePackChooserModal.jsx";

/** Swap to `/uploads/ie-pack.svg` when the asset is ready. */
const IE_PACK_ICON_SRC = "/uploads/import.svg";
const EXPORT_ICON_SRC = "/uploads/botones/Export.svg";
const STEPS_ICON_SRC = "/uploads/step-by-step.svg";
const LAZY_TODO_ICON_SRC = "/uploads/to-do.svg";
const URL_TABLE_ICON_SRC = "/uploads/url-table.svg";
const CAMPAIGN_ICON_SRC = "/uploads/web-advertising.svg";

/** @param {{ src: string, className?: string }} props */
function PackActionsToolbarIcon({ src, className = "pack-actions__btn-icon" }) {
  return (
    <span
      className={className}
      style={{ "--pack-btn-icon-mask": `url("${src}")` }}
      aria-hidden
    />
  );
}

/**
 * @param {Object} props
 * @param {'objects'|'documents'} props.placement
 * @param {() => void} props.onOpenImport
 * @param {() => void} [props.onOpenStepsLibrary]
 * @param {() => void} [props.onOpenLazyTodos]
 * @param {() => void} [props.onOpenUrlTable]
 * @param {() => void} [props.onOpenCampaign]
 * @param {boolean} [props.companySelected]
 * @param {'category'|null} [props.filterMode]
 * @param {{ id: string, label: string }[]} [props.filterOptions]
 * @param {string|null} [props.filterValue]
 * @param {(query: string | null) => void} [props.onFilterChange]
 */
export function PackActionsBar({
  placement,
  onOpenImport,
  onOpenStepsLibrary,
  onOpenLazyTodos,
  onOpenUrlTable,
  onOpenCampaign,
  companySelected = false,
  filterMode = null,
  filterOptions = [],
  filterValue = null,
  onFilterChange,
}) {
  const { t } = useI18n();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPackOpen, setExportPackOpen] = useState(false);
  const [ieChooserOpen, setIeChooserOpen] = useState(false);

  const filterEnabled = filterMode === "category"
    && placement === "documents"
    && typeof onFilterChange === "function";

  const handleSelectChange = (e) => {
    const value = e.target.value;
    if (!value) {
      onFilterChange?.(null);
      return;
    }
    const option = filterOptions.find((o) => o.id === value);
    onFilterChange?.(option?.label ?? null);
  };

  const selectedOptionId = filterValue
    ? filterOptions.find(
      (o) => o.label.toLowerCase() === filterValue.toLowerCase(),
    )?.id ?? ""
    : "";

  return (
    <>
      <div className={"pack-actions pack-actions--" + placement} role="toolbar" aria-label={t("pack.toolbar")}>
        {companySelected && onOpenStepsLibrary ? (
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--toolbar"
            onClick={onOpenStepsLibrary}
            title={t("pack.stepsLibraryTitle")}
          >
            <PackActionsToolbarIcon src={STEPS_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.stepsLibrary")}</span>
          </button>
        ) : null}
        {companySelected && onOpenLazyTodos ? (
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--toolbar"
            onClick={onOpenLazyTodos}
            title={t("pack.lazyTodosTitle")}
          >
            <PackActionsToolbarIcon src={LAZY_TODO_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.lazyTodos")}</span>
          </button>
        ) : null}
        {companySelected && onOpenUrlTable ? (
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--toolbar"
            onClick={onOpenUrlTable}
            title={t("pack.urlTableTitle")}
          >
            <PackActionsToolbarIcon src={URL_TABLE_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.urlTable")}</span>
          </button>
        ) : null}
        {companySelected && onOpenCampaign ? (
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--toolbar"
            onClick={onOpenCampaign}
            title={t("pack.campaignTitle")}
          >
            <PackActionsToolbarIcon src={CAMPAIGN_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.campaign")}</span>
          </button>
        ) : null}
        {filterEnabled ? (
          <select
            className="pack-actions__filter-select btn xs pack-actions__btn pack-actions__filter-select--category"
            value={selectedOptionId}
            onChange={handleSelectChange}
            aria-label={t("pack.filterProductsAria")}
            title={t("pack.filterProducts")}
          >
            <option value="">{t("pack.category")}</option>
            {filterOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        ) : null}

        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--toolbar pack-actions__btn--ie"
          onClick={() => setIeChooserOpen(true)}
          title={t("pack.iePackTitle")}
        >
          <PackActionsToolbarIcon src={IE_PACK_ICON_SRC} />
          <span className="pack-actions__btn-label">{t("pack.iePack")}</span>
        </button>

        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--toolbar"
          onClick={() => setExportModalOpen(true)}
          title={t("pack.exportAllOpenTitle")}
        >
          <PackActionsToolbarIcon src={EXPORT_ICON_SRC} />
          <span className="pack-actions__btn-label">{t("pack.exportAll")}</span>
        </button>
      </div>

      {ieChooserOpen ? (
        <IePackChooserModal
          onClose={() => setIeChooserOpen(false)}
          onImport={() => onOpenImport?.()}
          onExport={() => setExportPackOpen(true)}
        />
      ) : null}
      {exportModalOpen ? (
        <ExportWorkspaceModal
          onClose={() => setExportModalOpen(false)}
          onExportAll={async () => {
            const result = await exportWorkspaceTreeZip();
            if (!result?.ok) {
              throw new Error(result?.error || t("pack.exportAllFailed"));
            }
            setExportModalOpen(false);
          }}
        />
      ) : null}
      {exportPackOpen ? (
        <ExportPackModal onClose={() => setExportPackOpen(false)} />
      ) : null}
    </>
  );
}
