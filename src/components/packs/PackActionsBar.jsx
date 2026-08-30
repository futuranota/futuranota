import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { exportWorkspaceTreeZip } from "../../lib/exportWorkspaceTreeZip.js";
import { ExportWorkspaceModal } from "./ExportWorkspaceModal.jsx";
import { ExportPackModal } from "./ExportPackModal.jsx";
import { IePackChooserModal } from "./IePackChooserModal.jsx";

/** Swap to `/uploads/ie-pack.svg` when the asset is ready. */
const IE_PACK_ICON_SRC = "/uploads/import.svg";
const EXPORT_ICON_SRC = "/uploads/botones/Export.svg";
const STEPS_ICON_SRC = "/uploads/step-by-step.svg";
const QLOOPS_ICON_SRC = "/uploads/RepeatOnce.svg";
const LAZY_TODO_ICON_SRC = "/uploads/to-do.svg";
const URL_TABLE_ICON_SRC = "/uploads/url-table.svg";
const LIBRARY_ICON_SRC = "/uploads/Library.svg";
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
 * @param {boolean} [props.isAdmin]
 * @param {() => void} [props.onOpenStepsLibrary]
 * @param {() => void} [props.onOpenQLoopsLibrary]
 * @param {() => void} [props.onOpenLazyTodos]
 * @param {() => void} [props.onOpenUrlTable]
 * @param {() => void} [props.onOpenFolderLibrary]
 * @param {boolean} [props.folderLibraryActive]
 * @param {() => void} [props.onToggleCampaignFilter]
 * @param {boolean} [props.campaignFilterActive]
 * @param {boolean} [props.companySelected]
 * @param {'category'|null} [props.filterMode]
 * @param {{ id: string, label: string }[]} [props.filterOptions]
 * @param {string|null} [props.filterValue]
 * @param {(query: string | null) => void} [props.onFilterChange]
 */
export function PackActionsBar({
  placement,
  onOpenImport,
  isAdmin = false,
  onOpenStepsLibrary,
  onOpenQLoopsLibrary,
  onOpenLazyTodos,
  onOpenUrlTable,
  onOpenFolderLibrary,
  folderLibraryActive = false,
  onToggleCampaignFilter,
  campaignFilterActive = false,
  companySelected = false,
  filterMode = null,
  filterOptions = [],
  filterValue = null,
  onFilterChange,
}) {
  const { t } = useI18n();
  const scrollRef = useRef(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPackOpen, setExportPackOpen] = useState(false);
  const [ieChooserOpen, setIeChooserOpen] = useState(false);
  const [scrollState, setScrollState] = useState({
    overflow: false,
    canBack: false,
    canForward: false,
  });

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    setScrollState({
      overflow,
      canBack: overflow && scrollLeft > 1,
      canForward: overflow && scrollLeft + clientWidth < scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    updateScrollState();
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    const mo = new MutationObserver(updateScrollState);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  const scrollToolbar = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(120, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const filterEnabled = filterMode === "category"
    && placement === "documents"
    && typeof onFilterChange === "function";

  useEffect(() => {
    updateScrollState();
  }, [
    companySelected,
    filterEnabled,
    campaignFilterActive,
    folderLibraryActive,
    isAdmin,
    filterOptions.length,
    updateScrollState,
  ]);

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

  const handleExportAll = async () => {
    const result = await exportWorkspaceTreeZip();
    if (!result?.ok) {
      throw new Error(result?.error || t("pack.exportAllFailed"));
    }
    setExportModalOpen(false);
  };

  return (
    <>
      <div
        className={
          "pack-actions-scroll"
          + (scrollState.overflow ? " pack-actions-scroll--overflow" : "")
        }
      >
        <div
          ref={scrollRef}
          className={"pack-actions pack-actions--" + placement}
          role="toolbar"
          aria-label={t("pack.toolbar")}
        >
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
        {companySelected && onOpenQLoopsLibrary ? (
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--toolbar"
            onClick={onOpenQLoopsLibrary}
            title={t("pack.qloopsTitle")}
          >
            <PackActionsToolbarIcon src={QLOOPS_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.qloops")}</span>
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
        {companySelected && onOpenFolderLibrary ? (
          <button
            type="button"
            className={
              "btn xs pack-actions__btn pack-actions__btn--toolbar"
              + (folderLibraryActive ? " is-active" : "")
            }
            onClick={onOpenFolderLibrary}
            title={t("pack.libraryTitle")}
            aria-pressed={folderLibraryActive}
          >
            <PackActionsToolbarIcon src={LIBRARY_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.library")}</span>
          </button>
        ) : null}
        {companySelected && onToggleCampaignFilter ? (
          <button
            type="button"
            className={
              "btn xs pack-actions__btn pack-actions__btn--toolbar"
              + (campaignFilterActive ? " is-active" : "")
            }
            onClick={onToggleCampaignFilter}
            title={t("pack.campaignFilterTitle")}
            aria-pressed={campaignFilterActive}
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

        {isAdmin ? (
          <button
            type="button"
            className="btn xs pack-actions__btn pack-actions__btn--toolbar pack-actions__btn--ie"
            onClick={() => setIeChooserOpen(true)}
            title={t("pack.iePackTitle")}
          >
            <PackActionsToolbarIcon src={IE_PACK_ICON_SRC} />
            <span className="pack-actions__btn-label">{t("pack.iePack")}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn xs pack-actions__btn pack-actions__btn--toolbar pack-actions__btn--ie"
              onClick={() => onOpenImport?.()}
              title={t("pack.importPackTitle")}
            >
              <PackActionsToolbarIcon src={IE_PACK_ICON_SRC} />
              <span className="pack-actions__btn-label">{t("pack.importPack")}</span>
            </button>

            <button
              type="button"
              className="btn xs pack-actions__btn pack-actions__btn--toolbar pack-actions__btn--primary"
              onClick={() => setExportModalOpen(true)}
              title={t("pack.exportAllOpenTitle")}
            >
              <PackActionsToolbarIcon src={EXPORT_ICON_SRC} />
              <span className="pack-actions__btn-label">{t("pack.exportAll")}</span>
            </button>
          </>
        )}
        </div>
        {scrollState.overflow ? (
          <>
            <div className="pack-actions-scroll__fade pack-actions-scroll__fade--start" aria-hidden />
            <div className="pack-actions-scroll__fade pack-actions-scroll__fade--end" aria-hidden />
            <div className="pack-actions-scroll__controls">
              <button
                type="button"
                className="pack-actions-scroll__arrow pack-actions-scroll__arrow--prev"
                onClick={() => scrollToolbar(-1)}
                disabled={!scrollState.canBack}
                aria-label={t("pack.scrollLeft")}
                title={t("pack.scrollLeft")}
              >
                ←
              </button>
              <button
                type="button"
                className="pack-actions-scroll__arrow pack-actions-scroll__arrow--next"
                onClick={() => scrollToolbar(1)}
                disabled={!scrollState.canForward}
                aria-label={t("pack.scrollRight")}
                title={t("pack.scrollRight")}
              >
                →
              </button>
            </div>
          </>
        ) : null}
      </div>

      {isAdmin && ieChooserOpen ? (
        <IePackChooserModal
          onClose={() => setIeChooserOpen(false)}
          onImport={() => onOpenImport?.()}
          onExport={() => setExportPackOpen(true)}
          onExportAll={() => setExportModalOpen(true)}
        />
      ) : null}
      {exportModalOpen ? (
        <ExportWorkspaceModal
          onClose={() => setExportModalOpen(false)}
          onExportAll={handleExportAll}
        />
      ) : null}
      {isAdmin && exportPackOpen ? (
        <ExportPackModal onClose={() => setExportPackOpen(false)} />
      ) : null}
    </>
  );
}
