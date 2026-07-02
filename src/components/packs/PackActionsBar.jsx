import { useState } from "react";
import { exportObjectPackV2 } from "../../lib/pack/packV2Export.js";
import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { useI18n } from "../../i18n/useI18n.js";

const GUIDE_ICON_SRC = "/uploads/branding.svg";

/**
 * @param {Object} props
 * @param {'objects'|'documents'} props.placement
 * @param {() => void} props.onOpenImport
 * @param {() => void} [props.onInsertGuide]
 * @param {string|null} [props.exportObjectId]
 * @param {'category'|'content'|null} [props.filterMode]
 * @param {{ id: string, label: string }[]} [props.filterOptions]
 * @param {string|null} [props.filterValue]
 * @param {(query: string | null) => void} [props.onFilterChange]
 */
export function PackActionsBar({
  placement,
  onOpenImport,
  onInsertGuide,
  exportObjectId = null,
  filterMode = null,
  filterOptions = [],
  filterValue = null,
  onFilterChange,
}) {
  const { t } = useI18n();
  const isPro = usePlanStore((s) => s.isPro());
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);
  const [exportingV2, setExportingV2] = useState(false);

  const handleExportV2 = async () => {
    if (!exportObjectId || exportingV2) return;
    if (!isPro) {
      showUpgradeModal("export");
      return;
    }
    setExportingV2(true);
    try {
      await exportObjectPackV2(exportObjectId, { includeGraph: false });
    } finally {
      setExportingV2(false);
    }
  };

  const filterEnabled = filterMode
    && placement === "documents"
    && exportObjectId
    && typeof onFilterChange === "function";

  const filterPlaceholder = filterMode === "category" ? t("pack.category") : t("pack.content");

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
    <div className={"pack-actions pack-actions--" + placement} role="toolbar" aria-label={t("pack.toolbar")}>
      <button
        type="button"
        className="btn xs pack-actions__btn"
        onClick={onOpenImport}
      >
        {t("pack.importPack")}
      </button>
      {placement === "documents" && onInsertGuide ? (
        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--guide"
          onClick={onInsertGuide}
          title={t("pack.guideTitle")}
        >
          <img
            src={GUIDE_ICON_SRC}
            alt=""
            className="pack-actions__guide-icon"
            aria-hidden
            draggable={false}
          />
          {t("pack.guide")}
        </button>
      ) : null}
      {placement === "documents" && exportObjectId ? (
        <>
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--accent"
            onClick={handleExportV2}
            disabled={exportingV2}
            title={t("pack.packV2Title")}
          >
            {exportingV2 ? t("pack.exporting") : t("pack.packV2")}
          </button>
          {filterEnabled ? (
            <select
              className={
                "pack-actions__filter-select btn xs pack-actions__btn"
                + (filterMode === "category"
                  ? " pack-actions__filter-select--category"
                  : " pack-actions__filter-select--content")
              }
              value={selectedOptionId}
              onChange={handleSelectChange}
              aria-label={filterMode === "category" ? t("pack.filterProductsAria") : t("pack.filterContentAria")}
              title={filterMode === "category" ? t("pack.filterProducts") : t("pack.filterContent")}
            >
              <option value="">{filterPlaceholder}</option>
              {filterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
