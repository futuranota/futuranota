import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FOLDER_VIEW_MODE_QUICK,
  FOLDER_VIEW_MODE_STORY,
  normalizeFolderViewMode,
} from "../../lib/folderViewMode.js";
import {
  FOLDER_WRITING_LAYOUT_PAGED,
  FOLDER_WRITING_LAYOUT_SCROLL,
  isFolderPagedWriting,
  normalizeFolderWritingLayout,
} from "../../lib/folderWritingLayout.js";
import { useI18n } from "../../i18n/useI18n.js";
import { PremiumToggle } from "../shared/PremiumToggle.jsx";

const SETTINGS_ICON = "/uploads/settings.svg";
const CAMPAIGN_ICON = "/uploads/ad-frame.svg";
const WRITING_LAYOUT_ICON = "/uploads/scroll-pages-options.svg";

const VIEW_OPTIONS = [
  {
    id: FOLDER_VIEW_MODE_STORY,
    icon: "/uploads/descriptive-view.svg",
    titleKey: "meta.folderViewStoryTitle",
    structureKey: "meta.folderViewStoryStructure",
    bodyKey: "meta.folderViewStoryBody",
  },
  {
    id: FOLDER_VIEW_MODE_QUICK,
    icon: "/uploads/quickview.svg",
    titleKey: "meta.folderViewQuickTitle",
    structureKey: "meta.folderViewQuickStructure",
    bodyKey: "meta.folderViewQuickBody",
  },
];

function FolderViewModeOverlay({
  current,
  onSelect,
  onClose,
  campaignActive = false,
  onCampaignActiveChange,
  writingLayout = FOLDER_WRITING_LAYOUT_SCROLL,
  onWritingLayoutChange,
}) {
  const { t } = useI18n();
  const showCampaignToggle = typeof onCampaignActiveChange === "function";
  const showWritingLayoutToggle = typeof onWritingLayoutChange === "function";
  const normalizedWritingLayout = normalizeFolderWritingLayout(writingLayout);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="folder-view-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("meta.folderViewSettingsAria")}
    >
      <button
        type="button"
        className="folder-view-overlay__backdrop"
        aria-label={t("meta.folderViewClose")}
        onClick={onClose}
      />
      <div className="folder-view-overlay__shell">
        <header className="folder-view-overlay__header">
          <div className="folder-view-overlay__titles">
            <h2 className="folder-view-overlay__title">{t("meta.settings")}</h2>
            <span className="folder-view-overlay__subtitle">
              {t("meta.folderViewSettingsAria")}
            </span>
          </div>
          <button
            type="button"
            className="folder-view-overlay__close"
            onClick={onClose}
            aria-label={t("meta.folderViewClose")}
            title={t("meta.folderViewClose")}
          >
            ×
          </button>
        </header>

        {showCampaignToggle ? (
          <div className="folder-view-overlay__campaign" role="group" aria-label={t("meta.campaignMode")}>
            <div className="folder-view-overlay__campaign-copy">
              <img
                src={CAMPAIGN_ICON}
                alt=""
                aria-hidden
                className="folder-view-overlay__row-icon"
                draggable={false}
              />
              <span className="folder-view-overlay__row-copy">
                <span className="folder-view-overlay__row-title">
                  {t("meta.campaignMode")}
                </span>
                <span className="folder-view-overlay__row-body">
                  {t("meta.campaignModeBody")}
                </span>
              </span>
            </div>
            <PremiumToggle
              checked={Boolean(campaignActive)}
              onChange={onCampaignActiveChange}
              aria-label={t("meta.campaignMode")}
            />
          </div>
        ) : null}

        {showWritingLayoutToggle ? (
          <div
            className="folder-view-overlay__campaign folder-view-overlay__writing-layout"
            role="group"
            aria-label={t("meta.writingLayoutAria")}
          >
            <div className="folder-view-overlay__campaign-copy">
              <img
                src={WRITING_LAYOUT_ICON}
                alt=""
                aria-hidden
                className="folder-view-overlay__row-icon"
                draggable={false}
              />
              <span className="folder-view-overlay__row-copy">
                <span className="folder-view-overlay__row-title">
                  {t("meta.writingLayoutTitle")}
                </span>
                <span className="folder-view-overlay__row-body">
                  {t("meta.writingLayoutBody")}
                </span>
              </span>
            </div>
            <PremiumToggle
              checked={isFolderPagedWriting(normalizedWritingLayout)}
              onChange={(on) => onWritingLayoutChange?.(
                on ? FOLDER_WRITING_LAYOUT_PAGED : FOLDER_WRITING_LAYOUT_SCROLL,
              )}
              aria-label={t("meta.writingLayoutAria")}
            />
          </div>
        ) : null}

        <div
          className="folder-view-overlay__table"
          role="listbox"
          aria-label={t("meta.folderViewSettingsAria")}
        >
          {VIEW_OPTIONS.map((option) => {
            const selected = option.id === current;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={
                  "folder-view-overlay__row" + (selected ? " is-selected" : "")
                }
                onClick={() => onSelect(option.id)}
              >
                <img
                  src={option.icon}
                  alt=""
                  aria-hidden
                  className="folder-view-overlay__row-icon"
                  draggable={false}
                />
                <span className="folder-view-overlay__row-copy">
                  <span className="folder-view-overlay__row-title">
                    {t(option.titleKey)}
                  </span>
                  <span className="folder-view-overlay__row-structure">
                    {t(option.structureKey)}
                  </span>
                  <span className="folder-view-overlay__row-body">
                    {t(option.bodyKey)}
                  </span>
                </span>
                <span className="folder-view-overlay__row-state" aria-hidden>
                  {selected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Folder Story / Quick presentation settings + optional Campaign mode.
 * Trigger lives in the open-folder meta drawer; the chooser is a standalone overlay.
 */
export function FolderViewModeSettings({
  viewMode,
  onViewModeChange,
  campaignActive = false,
  onCampaignActiveChange,
  writingLayout = FOLDER_WRITING_LAYOUT_SCROLL,
  onWritingLayoutChange,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = normalizeFolderViewMode(viewMode);
  const showTrigger = Boolean(onViewModeChange)
    || typeof onCampaignActiveChange === "function"
    || typeof onWritingLayoutChange === "function";

  if (!showTrigger) return null;

  const selectMode = (nextMode) => {
    if (!onViewModeChange) return;
    const normalized = normalizeFolderViewMode(nextMode);
    if (normalized !== current) {
      onViewModeChange(normalized);
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="doc-folder-view-settings-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <img
          src={SETTINGS_ICON}
          alt=""
          aria-hidden
          className="doc-folder-view-settings-trigger__icon"
          draggable={false}
        />
        <span>{t("meta.settings")}</span>
      </button>
      {open ? (
        <FolderViewModeOverlay
          current={current}
          onSelect={selectMode}
          onClose={() => setOpen(false)}
          campaignActive={campaignActive}
          onCampaignActiveChange={onCampaignActiveChange}
          writingLayout={writingLayout}
          onWritingLayoutChange={onWritingLayoutChange}
        />
      ) : null}
    </>
  );
}
