import { useState } from "react";
import { exportObjectPack } from "../../lib/pack/packExport.js";
import { exportObjectPackV2 } from "../../lib/pack/packV2Export.js";

/**
 * @param {Object} props
 * @param {'objects'|'documents'} props.placement
 * @param {() => void} props.onOpenImport
 * @param {string|null} [props.exportObjectId]
 * @param {'category'|'content'|null} [props.filterMode]
 * @param {{ id: string, label: string }[]} [props.filterOptions]
 * @param {string|null} [props.filterValue]
 * @param {(query: string | null) => void} [props.onFilterChange]
 */
export function PackActionsBar({
  placement,
  onOpenImport,
  exportObjectId = null,
  filterMode = null,
  filterOptions = [],
  filterValue = null,
  onFilterChange,
}) {
  const [exporting, setExporting] = useState(false);
  const [exportingV2, setExportingV2] = useState(false);

  const handleExport = async () => {
    if (!exportObjectId || exporting || exportingV2) return;
    setExporting(true);
    try {
      await exportObjectPack(exportObjectId, { includeGraph: false });
    } finally {
      setExporting(false);
    }
  };

  const handleExportV2 = async () => {
    if (!exportObjectId || exporting || exportingV2) return;
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

  const filterPlaceholder = filterMode === "category" ? "Category" : "Content";

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
    <div className={"pack-actions pack-actions--" + placement} role="toolbar" aria-label="Pack import export">
      <button
        type="button"
        className="btn xs pack-actions__btn"
        onClick={onOpenImport}
      >
        Import pack
      </button>
      {placement === "documents" && exportObjectId ? (
        <>
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--accent"
            onClick={handleExport}
            disabled={exporting || exportingV2}
          >
            {exporting ? "Exporting…" : "Export pack"}
          </button>
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--accent"
            onClick={handleExportV2}
            disabled={exporting || exportingV2}
            title="Readable folders + image files (Pack v2)"
          >
            {exportingV2 ? "Exporting…" : "Pack v2"}
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
              aria-label={filterMode === "category" ? "Filter products by category" : "Filter content by subcategory"}
              title={filterMode === "category"
                ? "Filter Products by category"
                : "Filter Content by linked product subcategory"}
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
