import { useI18n } from "../../i18n/useI18n.js";

const GUIDE_ICON_SRC = "/uploads/branding.svg";

/**
 * @param {Object} props
 * @param {'objects'|'documents'} props.placement
 * @param {() => void} props.onOpenImport
 * @param {() => void} [props.onOpenStepsLibrary]
 * @param {() => void} [props.onOpenLazyTodos]
 * @param {() => void} [props.onInsertGuide]
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
  onInsertGuide,
  filterMode = null,
  filterOptions = [],
  filterValue = null,
  onFilterChange,
}) {
  const { t } = useI18n();

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
    <div className={"pack-actions pack-actions--" + placement} role="toolbar" aria-label={t("pack.toolbar")}>
      <button
        type="button"
        className="btn xs pack-actions__btn"
        onClick={onOpenImport}
      >
        {t("pack.importPack")}
      </button>
      {onOpenStepsLibrary ? (
        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--steps"
          onClick={onOpenStepsLibrary}
          title={t("pack.stepsLibraryTitle")}
        >
          {t("pack.stepsLibrary")}
        </button>
      ) : null}
      {onOpenLazyTodos ? (
        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--lazy"
          onClick={onOpenLazyTodos}
          title={t("pack.lazyTodosTitle")}
        >
          {t("pack.lazyTodos")}
        </button>
      ) : null}
      {placement === "documents" && onInsertGuide ? (
        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--guide"
          onClick={onInsertGuide}
          title={t("pack.guide")}
          aria-label={t("pack.guide")}
        >
          <img
            src={GUIDE_ICON_SRC}
            alt=""
            className="pack-actions__guide-icon"
            aria-hidden
            draggable={false}
          />
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
    </div>
  );
}
