import { useCallback, useMemo, useState } from "react";
import { resolveCurrentCorpus, resolveIntelCampaignBrand } from "../../lib/currentCorpus.js";
import {
  computeCampaignWindowProjection,
  computeLaunchCadenceProjection,
} from "../../lib/launchCadenceMath.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import { runLaunchRadarAnalysis } from "../../lib/agents/runLaunchRadar.js";
import { AGENT_RUN_CREDIT_COST, formatCreditAmount } from "../../lib/planConfig.js";
import { LaunchRadarToggle } from "./LaunchRadarToggle.jsx";
import { useLaunchRadarPanelStore } from "../../stores/launchRadarPanelStore.js";
import "../../styles/launch-predictor.css";

const EMPTY_LAUNCH_RADAR_SESSION = {
  status: "idle",
  cadence: null,
  toggleOn: false,
  actionError: null,
};

function formatTodayLabel(date, locale) {
  const lang = locale === "es" ? "es-ES" : "en-US";
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date instanceof Date ? date : new Date(date));
}

function storedCadenceToMode(storedCadence) {
  if (!storedCadence) return null;

  const hasVerifiedLaunch = Boolean(
    storedCadence.launchDate
    && (
      storedCadence.detectionMode === "confirmed_campaign"
      || (
        storedCadence.launchConfidence !== "estimated"
        && storedCadence.detectionMode !== "cadence_only"
      )
    ),
  );

  if (hasVerifiedLaunch) {
    return {
      mode: "campaign",
      launchDate: storedCadence.launchDate,
      announcementDate: storedCadence.announcementDate || null,
      lastLaunchDate: storedCadence.lastLaunchDate || null,
      averageIntervalMonths: storedCadence.averageIntervalMonths ?? null,
      overview: storedCadence.overview || "",
      category: storedCadence.category || "",
      source: storedCadence.source || "hero_signal",
    };
  }

  const hasCadenceEstimate = Boolean(
    storedCadence.lastLaunchDate
    && storedCadence.averageIntervalMonths != null
    && (
      storedCadence.detectionMode === "cadence_only"
      || storedCadence.detectionMode === "heuristic_estimate"
      || storedCadence.launchConfidence === "estimated"
      || storedCadence.launchConfidence === "speculative"
      || !storedCadence.launchDate
    ),
  );

  if (hasCadenceEstimate) {
    return {
      mode: storedCadence.detectionMode === "heuristic_estimate" ? "heuristic" : "cadence",
      averageIntervalMonths: Number(storedCadence.averageIntervalMonths),
      lastLaunchDate: storedCadence.lastLaunchDate,
      overview: storedCadence.overview || storedCadence.cadenceMessage || "",
      category: storedCadence.category || "",
      source: storedCadence.source || "hero_signal",
      detectionMode: storedCadence.detectionMode || "cadence_only",
      launchConfidence: storedCadence.launchConfidence || null,
    };
  }

  return null;
}

function cadenceRecordToView(cadenceRecord) {
  return storedCadenceToMode(cadenceRecord);
}

function LaunchRadarPanelHeader({ brandName, reportKind }) {
  const { t } = useI18n();

  return (
    <header className="launch-predictor__head">
      <h4 className="launch-predictor__title">{t("intel.launchRadarKicker")}</h4>
      <p className="launch-predictor__role">{t("intel.launchRadarRole")}</p>
      <p className="launch-predictor__role launch-predictor__role--secondary">
        {t("intel.launchRadarSelectBrand")}
      </p>
      {brandName ? (
        <p className="launch-predictor__brand">{brandName}</p>
      ) : null}
      {reportKind === "active" ? (
        <p className="launch-predictor__report-kind">{t("intel.launchRadarActiveReport")}</p>
      ) : null}
      {reportKind === "inactive" ? (
        <p className="launch-predictor__report-kind">{t("intel.launchRadarInactiveReport")}</p>
      ) : null}
    </header>
  );
}

function LaunchRadarControl({
  running,
  toggleOn,
  onToggleChange,
}) {
  const { t } = useI18n();
  const creditLabel = t("agents.creditCost", {
    cost: formatCreditAmount(AGENT_RUN_CREDIT_COST),
  });

  return (
    <div className="launch-predictor__control">
      <div className="launch-predictor__control-row">
        <LaunchRadarToggle
          checked={toggleOn}
          disabled={running}
          onCheckedChange={onToggleChange}
          ariaLabel={t("intel.launchRadarKicker")}
        />
        <span className="launch-predictor__credit-cost" aria-hidden={running}>
          {creditLabel}
        </span>
      </div>
      {running ? (
        <p className="launch-predictor__control-status">{t("intel.launchRadarRunning")}</p>
      ) : null}
    </div>
  );
}

/**
 * Launch Radar — manual run only (no auto-load).
 * @param {{ today?: Date }} props
 */
export function LaunchPredictor({ today = new Date() }) {
  const { t, locale } = useI18n();
  const objects = useObjectsStore((s) => s.objects);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);

  const { currentCorpus, brandName } = useMemo(() => {
    const { currentCorpus: corpus, brandName: corpusBrand } = resolveCurrentCorpus(objects, selectedObjectId);
    const brand = corpusBrand || resolveIntelCampaignBrand(objects, selectedObjectId);
    return { currentCorpus: corpus, brandName: brand };
  }, [objects, selectedObjectId]);

  const corpusId = currentCorpus?.id || selectedObjectId || null;
  const scopeKey = useMemo(
    () => `${corpusId || "none"}::${(brandName || "").trim().toLowerCase() || "none"}`,
    [corpusId, brandName],
  );

  const session = useLaunchRadarPanelStore(
    (s) => s.sessions[scopeKey] ?? EMPTY_LAUNCH_RADAR_SESSION,
  );
  const patchSession = useLaunchRadarPanelStore((s) => s.patchSession);

  const { status, cadence, toggleOn, actionError } = session;
  const [running, setRunning] = useState(false);

  const applyCadenceResult = useCallback((result) => {
    if (!result?.ok || !result.cadence) {
      const message = result?.message || t("intel.launchRadarActionError");
      patchSession(corpusId, brandName, {
        status: "idle",
        cadence: null,
        toggleOn: false,
        actionError: message,
      });
      return false;
    }
    const view = cadenceRecordToView(result.cadence);
    if (view) {
      patchSession(corpusId, brandName, {
        status: "ready",
        cadence: view,
        toggleOn: true,
        actionError: null,
      });
      return true;
    }
    patchSession(corpusId, brandName, {
      status: "idle",
      cadence: null,
      toggleOn: false,
      actionError: t("intel.launchRadarActionError"),
    });
    return false;
  }, [t, patchSession, corpusId, brandName]);

  const handleRun = useCallback(async () => {
    if (!brandName || running) return false;
    setRunning(true);
    patchSession(corpusId, brandName, { actionError: null });
    try {
      const result = await runLaunchRadarAnalysis({
        brandName,
        corpusId,
        locale: locale === "es" ? "es" : "en",
      });
      if (result.code === "gate_tokens" || result.code === "gate_search") {
        showUpgradeModal(result.code === "gate_search" ? "search" : "tokens");
      }
      return applyCadenceResult(result);
    } finally {
      setRunning(false);
    }
  }, [brandName, corpusId, running, locale, applyCadenceResult, showUpgradeModal, patchSession]);

  const handleToggleChange = useCallback(async (next) => {
    if (running) return;

    if (!next) {
      patchSession(corpusId, brandName, { ...EMPTY_LAUNCH_RADAR_SESSION });
      return;
    }

    if (!brandName) {
      patchSession(corpusId, brandName, { ...EMPTY_LAUNCH_RADAR_SESSION });
      return;
    }

    patchSession(corpusId, brandName, { toggleOn: true, actionError: null });
    await handleRun();
  }, [brandName, running, handleRun, t, patchSession, corpusId]);

  const headerProps = { brandName, reportKind: null };

  const controlProps = {
    brandName,
    running,
    toggleOn,
    onToggleChange: handleToggleChange,
  };

  const campaignWindow = useMemo(() => {
    if (!cadence || cadence.mode !== "campaign" || !cadence.launchDate) return null;
    return computeCampaignWindowProjection({
      today,
      launchDate: cadence.launchDate,
      announcementDate: cadence.announcementDate,
      overview: cadence.overview,
      category: cadence.category,
    });
  }, [cadence, today]);

  const cadenceProjection = useMemo(() => {
    if (!cadence || (cadence.mode !== "cadence" && cadence.mode !== "heuristic") || !cadence.lastLaunchDate) {
      return null;
    }
    return computeLaunchCadenceProjection({
      today,
      averageIntervalMonths: cadence.averageIntervalMonths,
      lastLaunchDate: cadence.lastLaunchDate,
    });
  }, [cadence, today]);

  if (status === "idle") {
    return (
      <LaunchRadarIdleView
        headerProps={headerProps}
        controlProps={controlProps}
        actionError={actionError}
      />
    );
  }

  if (campaignWindow) {
    return (
      <div className="launch-predictor">
        <LaunchRadarPanelHeader {...headerProps} reportKind="active" />
        <LaunchRadarControl {...controlProps} />
        <CampaignWindowView
          brandName={brandName}
          window={campaignWindow}
          embedded
        />
      </div>
    );
  }

  if (cadenceProjection && cadence) {
    return (
      <div className="launch-predictor">
        <LaunchRadarPanelHeader {...headerProps} reportKind="inactive" />
        <LaunchRadarControl {...controlProps} />
        <CadenceEstimateView
          brandName={brandName}
          cadence={cadence}
          projection={cadenceProjection}
          today={today}
          variant={cadence.mode === "heuristic" ? "heuristic" : "cadence"}
          embedded
        />
      </div>
    );
  }

  return (
    <LaunchRadarIdleView
      headerProps={headerProps}
      controlProps={controlProps}
      actionError={actionError}
    />
  );
}

function LaunchRadarIdleView({
  headerProps,
  controlProps,
  actionError,
}) {
  return (
    <div className="launch-predictor">
      <LaunchRadarPanelHeader {...headerProps} reportKind={null} />
      <LaunchRadarControl {...controlProps} />
      {actionError ? (
        <p className="launch-predictor__note launch-predictor__note--pending">{actionError}</p>
      ) : null}
    </div>
  );
}

function CampaignWindowView({ brandName, window, embedded = false }) {
  const { t } = useI18n();

  const announceBridgeDays = window.daysUntilAnnouncement != null && window.daysUntilAnnouncement > 0
    ? window.daysUntilAnnouncement
    : null;
  const launchBridgeDays = Math.max(0, window.rangeDaysRemaining);

  return (
    <div className={embedded ? "launch-predictor__body" : "launch-predictor"}>
      {!embedded ? (
        <header className="launch-predictor__head">
          <span className="launch-predictor__kicker">{t("intel.launchRadarKicker")}</span>
          <h4 className="launch-predictor__brand">{brandName}</h4>
          {window.category ? (
            <span className="launch-predictor__category">{window.category}</span>
          ) : null}
        </header>
      ) : null}

      {window.overview ? (
        <p className="launch-predictor__overview">{window.overview}</p>
      ) : null}

      <div className="launch-predictor__compare" aria-label="Date comparison">
        <div className="launch-predictor__compare-row">
          <span className="launch-predictor__compare-key">Today</span>
          <span className="launch-predictor__compare-val">{window.todayLabel}</span>
        </div>
        {window.announcementLabel ? (
          <div className="launch-predictor__compare-row">
            <span className="launch-predictor__compare-key">Announce</span>
            <span className="launch-predictor__compare-val">{window.announcementLabel}</span>
          </div>
        ) : null}
        <div className="launch-predictor__compare-row">
          <span className="launch-predictor__compare-key">Launch</span>
          <span className="launch-predictor__compare-val launch-predictor__compare-val--accent">{window.launchLabel}</span>
        </div>
      </div>

      <div className="launch-predictor__timeline launch-predictor__timeline--campaign" aria-label="Campaign window timeline">
        <div className="launch-predictor__node launch-predictor__node--today">
          <span className="launch-predictor__node-label">Today</span>
          <span className="launch-predictor__node-date">{window.todayLabel}</span>
        </div>

        {window.announcementLabel ? (
          <>
            <div className="launch-predictor__bridge">
              <span className="launch-predictor__bridge-line" aria-hidden />
              <span className="launch-predictor__bridge-caption">
                {announceBridgeDays != null ? `${announceBridgeDays}d` : "—"}
              </span>
            </div>
            <div className="launch-predictor__node">
              <span className="launch-predictor__node-label">Announce</span>
              <span className="launch-predictor__node-date">{window.announcementLabel}</span>
            </div>
          </>
        ) : null}

        <div className="launch-predictor__bridge">
          <span className="launch-predictor__bridge-line" aria-hidden />
          <span className="launch-predictor__bridge-caption">
            {launchBridgeDays} day{launchBridgeDays === 1 ? "" : "s"} left
          </span>
        </div>

        <div className="launch-predictor__node launch-predictor__node--estimate">
          <span className="launch-predictor__node-label">Launch</span>
          <span className="launch-predictor__node-date">{window.launchLabel}</span>
        </div>
      </div>

      <p className="launch-predictor__range">{window.rangeLabel}</p>
      {window.windowTotalDays != null ? (
        <p className="launch-predictor__note">
          Ship window: {window.windowTotalDays} day{window.windowTotalDays === 1 ? "" : "s"} from announcement to launch.
          {window.phase === "ship-window" && window.windowDaysRemaining != null
            ? ` ${window.windowDaysRemaining} day${window.windowDaysRemaining === 1 ? "" : "s"} remaining in scope.`
            : null}
        </p>
      ) : null}
    </div>
  );
}

function CadenceEstimateView({
  brandName,
  cadence,
  projection,
  today = new Date(),
  variant = "cadence",
  embedded = false,
}) {
  const { t, locale } = useI18n();
  const isHeuristic = variant === "heuristic";
  const intervalLabel = Number.isInteger(cadence.averageIntervalMonths)
    ? cadence.averageIntervalMonths
    : cadence.averageIntervalMonths.toFixed(1);
  const todayLabel = formatTodayLabel(today, locale);

  const noteKey = isHeuristic ? "intel.launchRadarHeuristicNote" : "intel.launchRadarCadenceNote";

  return (
    <div className={embedded ? "launch-predictor__body" : "launch-predictor"}>
      {!embedded ? (
        <header className="launch-predictor__head">
          <span className="launch-predictor__kicker">{t("intel.launchRadarKicker")}</span>
          {isHeuristic ? (
            <span className="launch-predictor__badge">{t("intel.launchRadarHeuristicBadge")}</span>
          ) : null}
          <h4 className="launch-predictor__brand">{brandName}</h4>
          {cadence.category ? (
            <span className="launch-predictor__category">{cadence.category}</span>
          ) : null}
        </header>
      ) : null}

      {isHeuristic ? (
        <span className="launch-predictor__badge">{t("intel.launchRadarHeuristicBadge")}</span>
      ) : null}

      {cadence.overview ? (
        <p className="launch-predictor__overview">{cadence.overview}</p>
      ) : null}

      <div className="launch-predictor__timeline" aria-label="Launch cadence timeline">
        <div className="launch-predictor__node launch-predictor__node--today">
          <span className="launch-predictor__node-label">{t("intel.launchRadarToday")}</span>
          <span className="launch-predictor__node-date">{todayLabel}</span>
        </div>

        <div className="launch-predictor__bridge">
          <span className="launch-predictor__bridge-line" aria-hidden />
          <span className="launch-predictor__bridge-caption">
            {t("intel.launchRadarMonthsLeft", { count: projection.monthsRemaining })}
          </span>
        </div>

        <div className="launch-predictor__node launch-predictor__node--estimate">
          <span className="launch-predictor__node-label">{t("intel.launchRadarEstLaunch")}</span>
          <span className="launch-predictor__node-date">{projection.estimatedMonthLabel}</span>
        </div>
      </div>

      <p className="launch-predictor__note">
        {t(noteKey, {
          brand: brandName,
          interval: intervalLabel,
          today: todayLabel,
          remaining: projection.monthsRemaining,
          estimatedMonth: projection.estimatedMonthLabel,
        })}
      </p>

      <p className="launch-predictor__note launch-predictor__note--pending">
        {t("intel.launchRadarPendingWindow")}
      </p>
    </div>
  );
}