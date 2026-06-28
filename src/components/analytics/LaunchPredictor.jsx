import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveCurrentCorpus, resolveIntelCampaignBrand } from "../../lib/currentCorpus.js";
import {
  computeCampaignWindowProjection,
  computeLaunchCadenceProjection,
  toIsoDateString,
} from "../../lib/launchCadenceMath.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useTimelineStore } from "../../stores/timelineStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import { runLaunchRadarAnalysis } from "../../lib/agents/runLaunchRadar.js";
import { LaunchRadarToggle } from "./LaunchRadarToggle.jsx";
import "../../styles/launch-predictor.css";

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
  brandName,
  running,
  toggleOn,
  onToggleChange,
}) {
  const { t } = useI18n();

  return (
    <div className="launch-predictor__control">
      <LaunchRadarToggle
        checked={toggleOn}
        disabled={running}
        onCheckedChange={onToggleChange}
        ariaLabel={t("intel.launchRadarKicker")}
      />
      {running ? (
        <p className="launch-predictor__control-status">{t("intel.launchRadarRunning")}</p>
      ) : null}
      {!brandName && !running ? (
        <p className="launch-predictor__control-status launch-predictor__control-status--warn">
          {t("intel.launchRadarNeedBrand")}
        </p>
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

  const [status, setStatus] = useState("idle");
  const [cadence, setCadence] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [running, setRunning] = useState(false);
  const [toggleOn, setToggleOn] = useState(false);

  useEffect(() => {
    setCadence(null);
    setStatus("idle");
    setActionError(null);
    setToggleOn(false);
  }, [brandName, corpusId]);

  const applyCadenceResult = useCallback((result) => {
    if (!result?.ok || !result.cadence) {
      setActionError(result?.message || t("intel.launchRadarActionError"));
      setToggleOn(false);
      return false;
    }
    const view = cadenceRecordToView(result.cadence);
    if (view) {
      setCadence(view);
      setStatus("ready");
      setActionError(null);
      setToggleOn(true);
      return true;
    }
    setActionError(t("intel.launchRadarActionError"));
    setToggleOn(false);
    return false;
  }, [t]);

  const handleRun = useCallback(async () => {
    if (!brandName || running) return false;
    setRunning(true);
    setActionError(null);
    try {
      const result = await runLaunchRadarAnalysis({
        brandName,
        corpusId,
        locale: locale === "es" ? "es" : "en",
      });
      if (result.code === "gate_tokens") {
        showUpgradeModal("tokens");
      }
      return applyCadenceResult(result);
    } finally {
      setRunning(false);
    }
  }, [brandName, corpusId, running, locale, applyCadenceResult, showUpgradeModal]);

  const handleToggleChange = useCallback(async (next) => {
    if (running) return;

    if (!next) {
      setToggleOn(false);
      setCadence(null);
      setStatus("idle");
      setActionError(null);
      return;
    }

    if (!brandName) {
      setActionError(t("intel.launchRadarNeedBrand"));
      setToggleOn(false);
      return;
    }

    setToggleOn(true);
    const ok = await handleRun();
    if (!ok) setToggleOn(false);
  }, [brandName, running, handleRun, t]);

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
          corpusId={corpusId}
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
          corpusId={corpusId}
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

function CampaignWindowView({ brandName, corpusId, window, embedded = false }) {
  const { t } = useI18n();
  const handleTrackOnTimeline = () => {
    const docs = useDocsStore.getState().getDocsByObject(corpusId);
    const parentDocId = docs[0]?.id || null;

    const nodeId = useNodesStore.getState().addNode(
      `Launch · ${brandName}`,
      "date",
      window.launchDate,
      parentDocId,
    );

    useTimelineStore.getState().addExternalEvent({
      id: nodeId,
      title: `Launch · ${brandName}`,
      date: window.launchDate,
      source: "launch-radar",
    });
  };

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

      <button type="button" className="btn sm primary" onClick={handleTrackOnTimeline}>
        {t("intel.launchRadarTrackTimeline")}
      </button>
    </div>
  );
}

function CadenceEstimateView({
  brandName,
  corpusId,
  cadence,
  projection,
  today = new Date(),
  variant = "cadence",
  embedded = false,
}) {
  const { t, locale } = useI18n();
  const isHeuristic = variant === "heuristic";
  const handleTrackOnTimeline = () => {
    const dateStr = toIsoDateString(projection.estimatedLaunchDate);
    const docs = useDocsStore.getState().getDocsByObject(corpusId);
    const parentDocId = docs[0]?.id || null;

    const nodeId = useNodesStore.getState().addNode(
      isHeuristic ? `Est. Launch · ${brandName}` : `Est. Launch · ${brandName}`,
      "date",
      dateStr,
      parentDocId,
    );

    useTimelineStore.getState().addExternalEvent({
      id: nodeId,
      title: `Est. Launch · ${brandName}`,
      date: dateStr,
      source: "launch-radar",
    });
  };

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

      <button type="button" className="btn sm primary" onClick={handleTrackOnTimeline}>
        {t("intel.launchRadarTrackTimeline")}
      </button>
    </div>
  );
}