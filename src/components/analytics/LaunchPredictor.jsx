import { useCallback, useMemo, useState } from "react";
import { resolveCurrentCorpus, resolveIntelCampaignBrand } from "../../lib/currentCorpus.js";
import { computeCampaignWindowProjection } from "../../lib/launchCadenceMath.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import { resolveLaunchRadarObjectId } from "../../lib/agents/resolveLaunchRadarObjectId.js";
import {
  resolvePanelCorpusObjectId,
  readLaunchRadarPanelSaved,
  writeLaunchRadarPanelSaved,
} from "../../lib/panelAgentLoop.js";
import { usePlanStore } from "../../stores/planStore.js";
import { LaunchRadarToggle } from "./LaunchRadarToggle.jsx";
import "../../styles/launch-predictor.css";

const DESCRIPTION_MAX = 400;

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

/**
 * @param {unknown} raw
 * @returns {{ headline: string, dateStart: string, launchDate: string, description: string } | null}
 */
function normalizeManualEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const headline = String(raw.headline || "").trim();
  const dateStart = String(raw.dateStart || "").trim();
  const launchDate = String(raw.launchDate || "").trim();
  const description = String(raw.description || "").trim().slice(0, DESCRIPTION_MAX);
  if (!headline && !dateStart && !launchDate && !description) return null;
  return { headline, dateStart, launchDate, description };
}

/**
 * @param {{ headline: string, dateStart: string, launchDate: string, description: string }} entry
 */
function manualEntryToCadenceView(entry) {
  if (!entry?.launchDate) return null;
  return {
    mode: "campaign",
    launchDate: entry.launchDate,
    announcementDate: entry.dateStart || null,
    overview: entry.description || "",
    category: "",
    headline: entry.headline || "",
    source: "manual",
  };
}

function emptyDraft() {
  return {
    headline: "",
    dateStart: "",
    launchDate: "",
    description: "",
  };
}

function LaunchRadarPanelHeader({ brandName, demo = false, headline = "", compact = false }) {
  const { t } = useI18n();
  const displayName = headline || brandName;
  const featured = Boolean(headline) && compact;

  return (
    <header className="launch-predictor__head">
      <h4 className="launch-predictor__title">
        {t("intel.launchRadarKicker")}
        {demo ? <span className="launch-predictor__demo-badge">{t("intel.launchRadarDemo")}</span> : null}
      </h4>
      {!compact ? (
        <p className="launch-predictor__role">{t("intel.launchRadarRole")}</p>
      ) : null}
      {!displayName ? (
        <p className="launch-predictor__role launch-predictor__role--secondary">
          {t("intel.launchRadarSelectBrand")}
        </p>
      ) : (
        <p
          className={
            featured
              ? "launch-predictor__brand launch-predictor__brand--featured"
              : "launch-predictor__brand"
          }
        >
          {displayName}
        </p>
      )}
    </header>
  );
}

function LaunchRadarControl({
  running,
  toggleOn,
  onToggleChange,
  disabled,
  creditHint,
}) {
  const { t } = useI18n();

  return (
    <div className="launch-predictor__control">
      <div className="launch-predictor__control-row">
        <LaunchRadarToggle
          checked={toggleOn}
          disabled={disabled}
          onCheckedChange={onToggleChange}
          ariaLabel={t("intel.launchRadarKicker")}
        />
        {creditHint ? (
          <span className="launch-predictor__credit-cost">{creditHint}</span>
        ) : null}
      </div>
      {running ? (
        <p className="launch-predictor__control-status">{t("intel.launchRadarRunning")}</p>
      ) : null}
    </div>
  );
}

function LaunchRadarToolbar({ editing, canEdit, onEdit, onSave, onCancel, saveDisabled }) {
  const { t } = useI18n();

  if (editing) {
    return (
      <div className="launch-predictor__toolbar">
        <button type="button" className="btn sm ghost" onClick={onCancel}>
          {t("intel.launchRadarCancel")}
        </button>
        <button
          type="button"
          className="btn sm primary"
          onClick={onSave}
          disabled={saveDisabled}
        >
          {t("intel.launchRadarSave")}
        </button>
      </div>
    );
  }

  return (
    <div className="launch-predictor__toolbar">
      <button
        type="button"
        className="btn sm primary"
        onClick={onEdit}
        disabled={!canEdit}
      >
        {t("intel.launchRadarEdit")}
      </button>
    </div>
  );
}

function LaunchRadarManualForm({ draft, onChange, dateError }) {
  const { t } = useI18n();
  const descLen = draft.description.length;

  return (
    <div className="launch-predictor__form">
      <label className="launch-predictor__field">
        <span className="launch-predictor__field-label">{t("intel.launchRadarHeadline")}</span>
        <input
          type="text"
          className="launch-predictor__input"
          value={draft.headline}
          onChange={(e) => onChange({ ...draft, headline: e.target.value })}
          placeholder={t("intel.launchRadarHeadlinePlaceholder")}
          autoComplete="off"
        />
      </label>

      <div className="launch-predictor__field-row">
        <label className="launch-predictor__field">
          <span className="launch-predictor__field-label">{t("intel.launchRadarDateStart")}</span>
          <input
            type="date"
            className="launch-predictor__input launch-predictor__input--date"
            value={draft.dateStart}
            onChange={(e) => onChange({ ...draft, dateStart: e.target.value })}
            onClick={openDatePicker}
          />
        </label>
        <label className="launch-predictor__field">
          <span className="launch-predictor__field-label">{t("intel.launchRadarLaunchDate")}</span>
          <input
            type="date"
            className="launch-predictor__input launch-predictor__input--date"
            value={draft.launchDate}
            onChange={(e) => onChange({ ...draft, launchDate: e.target.value })}
            onClick={openDatePicker}
          />
        </label>
      </div>

      {dateError ? (
        <p className="launch-predictor__note launch-predictor__note--pending">{dateError}</p>
      ) : null}

      <label className="launch-predictor__field">
        <span className="launch-predictor__field-label">{t("intel.launchRadarDescription")}</span>
        <textarea
          className="launch-predictor__textarea"
          value={draft.description}
          maxLength={DESCRIPTION_MAX}
          rows={4}
          onChange={(e) => onChange({ ...draft, description: e.target.value.slice(0, DESCRIPTION_MAX) })}
          placeholder={t("intel.launchRadarDescriptionPlaceholder")}
        />
        <span className="launch-predictor__char-count">
          {descLen}/{DESCRIPTION_MAX}
        </span>
      </label>
    </div>
  );
}

/**
 * Launch Radar — manual entry first; automatic scan stays non-functional for now.
 * @param {{ today?: Date }} props
 */
export function LaunchPredictor({ today = new Date() }) {
  const { t } = useI18n();
  const isPro = usePlanStore((s) => s.isPro());
  const isDemo = !isPro;
  const objects = useObjectsStore((s) => s.objects);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const { brandName } = useMemo(() => {
    const resolved = resolveCurrentCorpus(objects, selectedObjectId);
    const brand = resolved.brandName || resolveIntelCampaignBrand(objects, selectedObjectId);
    return { brandName: brand };
  }, [objects, selectedObjectId]);

  const corpusId = useMemo(() => {
    const resolved = resolveCurrentCorpus(objects, selectedObjectId);
    return resolved.currentCorpus?.id || selectedObjectId || null;
  }, [objects, selectedObjectId]);

  const launchRadarObjectId = useMemo(
    () => resolveLaunchRadarObjectId(objects, brandName || "", corpusId),
    [objects, brandName, corpusId],
  );
  const panelCorpusId = useMemo(
    () => resolvePanelCorpusObjectId(objects, corpusId || launchRadarObjectId),
    [objects, corpusId, launchRadarObjectId],
  );

  const persistedPanel = useMemo(
    () => readLaunchRadarPanelSaved(objects, panelCorpusId),
    [objects, panelCorpusId],
  );

  const manualEntry = useMemo(
    () => normalizeManualEntry(persistedPanel?.manualEntry),
    [persistedPanel],
  );

  const campaignCadence = useMemo(() => {
    const fromManual = manualEntry ? manualEntryToCadenceView(manualEntry) : null;
    if (fromManual) return fromManual;
    const saved = persistedPanel?.cadenceView;
    if (saved?.mode === "campaign" && saved.launchDate) return saved;
    return null;
  }, [manualEntry, persistedPanel]);

  const campaignWindow = useMemo(() => {
    if (!campaignCadence?.launchDate) return null;
    return computeCampaignWindowProjection({
      today,
      launchDate: campaignCadence.launchDate,
      announcementDate: campaignCadence.announcementDate,
      overview: campaignCadence.overview,
      category: campaignCadence.category,
    });
  }, [campaignCadence, today]);

  const dateError = useMemo(() => {
    if (!draft.dateStart || !draft.launchDate) return null;
    if (draft.dateStart > draft.launchDate) {
      return t("intel.launchRadarDateStartAfterLaunch");
    }
    return null;
  }, [draft.dateStart, draft.launchDate, t]);

  const canPersist = Boolean(panelCorpusId);
  const draftHasContent = Boolean(
    draft.headline.trim()
    || draft.dateStart
    || draft.launchDate
    || draft.description.trim(),
  );

  const handleEdit = useCallback(() => {
    if (!canPersist) return;
    setDraft(manualEntry ? { ...manualEntry } : emptyDraft());
    setEditing(true);
  }, [canPersist, manualEntry]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft(emptyDraft());
  }, []);

  const handleSave = useCallback(() => {
    if (!canPersist || !panelCorpusId || dateError) return;
    const entry = normalizeManualEntry(draft) || {
      headline: "",
      dateStart: "",
      launchDate: "",
      description: "",
    };
    const cadenceView = manualEntryToCadenceView(entry);
    writeLaunchRadarPanelSaved(panelCorpusId, {
      manualEntry: entry,
      ...(cadenceView ? { cadenceView } : { cadenceView: null }),
    });
    setEditing(false);
  }, [canPersist, panelCorpusId, dateError, draft]);

  const headline = manualEntry?.headline || campaignCadence?.headline || "";
  const hasSavedView = Boolean(campaignWindow || manualEntry);
  const headerProps = {
    brandName,
    demo: isDemo,
    headline,
    compact: hasSavedView && !editing,
  };

  // Red joystick stays visible; search/scan is deferred — toggle is a no-op.
  const controlProps = {
    running: false,
    toggleOn: Boolean(campaignWindow),
    onToggleChange: () => {},
    disabled: false,
    creditHint: null,
  };

  const toolbar = (
    <LaunchRadarToolbar
      editing={editing}
      canEdit={canPersist}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      saveDisabled={!draftHasContent || Boolean(dateError)}
    />
  );

  const footer = (
    <div className="launch-predictor__control-bar launch-predictor__control-bar--footer">
      <LaunchRadarControl {...controlProps} />
      {toolbar}
    </div>
  );

  if (editing) {
    return (
      <div className="launch-predictor">
        <LaunchRadarPanelHeader {...headerProps} compact={false} headline="" />
        <div className="launch-predictor__main">
          <LaunchRadarManualForm draft={draft} onChange={setDraft} dateError={dateError} />
        </div>
        {footer}
      </div>
    );
  }

  if (campaignWindow) {
    return (
      <div className="launch-predictor">
        <LaunchRadarPanelHeader {...headerProps} />
        <div className="launch-predictor__main">
          <CampaignWindowView window={campaignWindow} />
        </div>
        {footer}
      </div>
    );
  }

  if (manualEntry) {
    return (
      <div className="launch-predictor">
        <LaunchRadarPanelHeader {...headerProps} />
        <div className="launch-predictor__main">
          {manualEntry.description ? (
            <p className="launch-predictor__overview">{manualEntry.description}</p>
          ) : null}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="launch-predictor">
      <LaunchRadarPanelHeader {...headerProps} />
      <div className="launch-predictor__main">
        {canPersist ? (
          <p className="launch-predictor__note launch-predictor__note--pending">
            {t("intel.launchRadarManualHint")}
          </p>
        ) : null}
      </div>
      {footer}
    </div>
  );
}

/** Horizontal campaign window: Anuncio — días restantes — Lanzamiento. */
function CampaignWindowView({ window }) {
  const { t } = useI18n();

  const daysLeft = Math.max(0, window.rangeDaysRemaining);
  const hasAnnounce = Boolean(window.announcementLabel);

  return (
    <div className="launch-predictor__body">
      {window.overview ? (
        <p className="launch-predictor__overview">{window.overview}</p>
      ) : null}

      <div
        className="launch-predictor__timeline launch-predictor__timeline--pair"
        aria-label={t("intel.launchRadarCampaignTimeline")}
      >
        {hasAnnounce ? (
          <div className="launch-predictor__node">
            <span className="launch-predictor__node-label">{t("intel.launchRadarAnnounce")}</span>
            <span className="launch-predictor__node-date">{window.announcementLabel}</span>
          </div>
        ) : (
          <div className="launch-predictor__node" aria-hidden />
        )}

        <div className="launch-predictor__bridge">
          <span className="launch-predictor__bridge-caption">
            {t("intel.launchRadarDaysLeft", { count: daysLeft })}
          </span>
          <span className="launch-predictor__bridge-line" aria-hidden />
        </div>

        <div className="launch-predictor__node launch-predictor__node--estimate">
          <span className="launch-predictor__node-label">{t("intel.launchRadarLaunch")}</span>
          <span className="launch-predictor__node-date">{window.launchLabel}</span>
        </div>
      </div>
    </div>
  );
}
