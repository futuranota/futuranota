import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveCurrentCorpus, resolveIntelCampaignBrand } from "../../lib/currentCorpus.js";
import {
  computeCampaignWindowProjection,
  computeLaunchCadenceProjection,
} from "../../lib/launchCadenceMath.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import { syncLaunchRadarFromAnalystDoc, runLaunchRadarAnalysis } from "../../lib/agents/runLaunchRadar.js";
import { resolveLaunchRadarObjectId } from "../../lib/agents/resolveLaunchRadarObjectId.js";
import {
  findLatestAnalystDocForScope,
  launchRadarSnapshotHasData,
  resolveLaunchRadarSnapshotForCorpus,
} from "../../lib/launchRadarSnapshot.js";
import { AnimatedIntelLine } from "../intel/AnimatedIntelLine.jsx";
import {
  resolvePanelCorpusObjectId,
  readLaunchRadarPanelSaved,
  writeLaunchRadarPanelSaved,
} from "../../lib/panelAgentLoop.js";
import { getLaunchRadarRunCost } from "../../lib/agents/agentCreditCosts.js";
import { formatCreditAmount } from "../../lib/planConfig.js";
import { usePlanStore } from "../../stores/planStore.js";
import { LaunchRadarToggle } from "./LaunchRadarToggle.jsx";
import { useLaunchRadarPanelStore, launchRadarScopeKey } from "../../stores/launchRadarPanelStore.js";
import { cadenceRecordToPanelView } from "../../lib/launchRadarPanelView.js";
import "../../styles/launch-predictor.css";

const EMPTY_LAUNCH_RADAR_SESSION = {
  status: "idle",
  cadence: null,
  toggleOn: false,
  actionError: null,
  reportReady: false,
};

function formatTodayLabel(date, locale) {
  const lang = locale === "es" ? "es-ES" : "en-US";
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date instanceof Date ? date : new Date(date));
}

function cadenceRecordToView(cadenceRecord) {
  return cadenceRecordToPanelView(cadenceRecord);
}

function LaunchRadarPanelHeader({ brandName, reportKind, demo = false }) {
  const { t } = useI18n();

  return (
    <header className="launch-predictor__head">
      <h4 className="launch-predictor__title">
        {t("intel.launchRadarKicker")}
        {demo ? <span className="launch-predictor__demo-badge">{t("intel.launchRadarDemo")}</span> : null}
      </h4>
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

/**
 * Launch Radar — manual run only (no auto-load).
 * @param {{ today?: Date }} props
 */
export function LaunchPredictor({ today = new Date() }) {
  const { t, locale } = useI18n();
  const isPro = usePlanStore((s) => s.isPro());
  const isDemo = !isPro;
  const objects = useObjectsStore((s) => s.objects);
  const docs = useDocsStore((s) => s.docs);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);
  const [running, setRunning] = useState(false);

  const { currentCorpus, brandName } = useMemo(() => {
    const resolved = resolveCurrentCorpus(objects, selectedObjectId);
    const brand = resolved.brandName || resolveIntelCampaignBrand(objects, selectedObjectId);
    return { currentCorpus: resolved.currentCorpus, brandName: brand };
  }, [objects, selectedObjectId]);

  const corpusId = currentCorpus?.id || selectedObjectId || null;
  const launchRadarObjectId = useMemo(
    () => resolveLaunchRadarObjectId(objects, brandName || "", corpusId),
    [objects, brandName, corpusId],
  );
  const panelCorpusId = useMemo(
    () => resolvePanelCorpusObjectId(objects, corpusId || launchRadarObjectId),
    [objects, corpusId, launchRadarObjectId],
  );
  const scopeIds = useMemo(
    () => [...new Set([corpusId, launchRadarObjectId, panelCorpusId].filter(Boolean))],
    [corpusId, launchRadarObjectId, panelCorpusId],
  );
  const scopeKey = useMemo(
    () => launchRadarScopeKey(panelCorpusId, brandName),
    [panelCorpusId, brandName],
  );

  const persistedPanel = useMemo(
    () => readLaunchRadarPanelSaved(objects, panelCorpusId),
    [objects, panelCorpusId],
  );

  const reportSnapshot = useMemo(
    () => resolveLaunchRadarSnapshotForCorpus(
      docs,
      panelCorpusId,
      brandName || "",
      scopeIds,
      objects,
    ),
    [docs, panelCorpusId, brandName, scopeIds, objects],
  );

  const hasReportData = useMemo(() => {
    if (launchRadarSnapshotHasData(reportSnapshot)) return true;
    if (!panelCorpusId) return false;
    return Boolean(findLatestAnalystDocForScope(docs, {
      corpusId: panelCorpusId,
      scopeIds,
      brandName: brandName || "",
      objectsById: objects,
    })?.doc);
  }, [reportSnapshot, panelCorpusId, docs, scopeIds, brandName, objects]);

  const panelLocked = Boolean(persistedPanel?.cadenceView);

  const previewOverview = useMemo(() => {
    if (!hasReportData || panelLocked || !panelCorpusId) return "";
    const found = findLatestAnalystDocForScope(docs, {
      corpusId: panelCorpusId,
      scopeIds,
      brandName: brandName || "",
      objectsById: objects,
    });
    const snapshot = found?.snapshot || reportSnapshot;
    return (snapshot?.overview || "").trim();
  }, [hasReportData, panelLocked, panelCorpusId, docs, scopeIds, brandName, objects, reportSnapshot]);

  const session = useLaunchRadarPanelStore(
    (s) => s.sessions[scopeKey] ?? EMPTY_LAUNCH_RADAR_SESSION,
  );
  const patchSession = useLaunchRadarPanelStore((s) => s.patchSession);

  const { status, cadence, toggleOn, actionError } = session;

  useEffect(() => {
    if (!persistedPanel?.cadenceView) return;
    patchSession(panelCorpusId, brandName, {
      status: "ready",
      cadence: persistedPanel.cadenceView,
      toggleOn: true,
      actionError: null,
      reportReady: true,
    });
  }, [persistedPanel, panelCorpusId, brandName, patchSession]);

  const applyCadenceResult = useCallback((result) => {
    if (!result?.ok || !result.cadence) {
      const message = result?.message || t("intel.launchRadarActionError");
      patchSession(panelCorpusId, brandName, {
        status: "idle",
        cadence: null,
        toggleOn: false,
        actionError: message,
        reportReady: true,
      });
      return false;
    }
    const view = cadenceRecordToView(result.cadence);
    if (view) {
      writeLaunchRadarPanelSaved(panelCorpusId, {
        cadenceView: view,
        cadenceRecord: result.cadence,
      });
      patchSession(panelCorpusId, brandName, {
        status: "ready",
        cadence: view,
        toggleOn: true,
        actionError: null,
        reportReady: true,
      });
      return true;
    }
    patchSession(panelCorpusId, brandName, {
      status: "idle",
      cadence: null,
      toggleOn: false,
      actionError: t("intel.launchRadarActionError"),
      reportReady: true,
    });
    return false;
  }, [t, patchSession, panelCorpusId, brandName]);

  const handleLoadFromReport = useCallback(() => {
    if (!panelCorpusId || !brandName || !hasReportData) return false;
    patchSession(panelCorpusId, brandName, { actionError: null, reportReady: true });
    const result = syncLaunchRadarFromAnalystDoc({
      corpusId: panelCorpusId,
      brandName: brandName || "",
      locale: locale === "es" ? "es" : "en",
      scopeIds,
    });
    return applyCadenceResult(result);
  }, [panelCorpusId, brandName, hasReportData, locale, scopeIds, applyCadenceResult, patchSession]);

  const handleRunScan = useCallback(async () => {
    if (!brandName || running) return false;
    if (isDemo) {
      showUpgradeModal("generic");
      return false;
    }
    setRunning(true);
    patchSession(panelCorpusId, brandName, { actionError: null, reportReady: true });
    try {
      const result = await runLaunchRadarAnalysis({
        brandName,
        corpusId: panelCorpusId,
        locale: locale === "es" ? "es" : "en",
      });
      if (result.code === "gate_tokens" || result.code === "gate_search") {
        showUpgradeModal(result.code === "gate_search" ? "search" : "tokens");
      }
      return applyCadenceResult(result);
    } finally {
      setRunning(false);
    }
  }, [
    brandName,
    running,
    panelCorpusId,
    locale,
    applyCadenceResult,
    patchSession,
    showUpgradeModal,
    isDemo,
  ]);

  const handleToggleChange = useCallback(async (next) => {
    if (running) return;
    if (panelLocked && !next) return;

    if (isDemo && next) {
      showUpgradeModal("generic");
      return;
    }

    if (!next) {
      patchSession(panelCorpusId, brandName, {
        status: "idle",
        cadence: null,
        toggleOn: false,
        actionError: null,
        reportReady: true,
      });
      return;
    }

    if (!brandName) {
      patchSession(panelCorpusId, brandName, {
        status: "idle",
        cadence: null,
        toggleOn: false,
        actionError: null,
        reportReady: true,
      });
      return;
    }

    patchSession(panelCorpusId, brandName, { toggleOn: true, actionError: null, reportReady: true });

    if (hasReportData) {
      handleLoadFromReport();
      return;
    }

    await handleRunScan();
  }, [
    running,
    panelLocked,
    patchSession,
    panelCorpusId,
    brandName,
    hasReportData,
    handleLoadFromReport,
    handleRunScan,
    isDemo,
    showUpgradeModal,
  ]);

  const effectiveToggleOn = panelLocked || toggleOn;
  const effectiveStatus = panelLocked || status === "ready" ? "ready" : status;
  const effectiveCadence = panelLocked ? persistedPanel.cadenceView : cadence;

  const headerProps = { brandName, reportKind: null, demo: isDemo };

  const scanCreditLabel = isDemo
    ? t("intel.launchRadarDemoHint")
    : t("intel.launchRadarCreditCost", {
      cost: formatCreditAmount(getLaunchRadarRunCost().creditCost),
    });

  const controlProps = {
    brandName,
    running,
    toggleOn: effectiveToggleOn,
    onToggleChange: handleToggleChange,
    disabled: !brandName || running,
    creditHint: hasReportData
      ? t("intel.launchRadarFromReport")
      : brandName
        ? scanCreditLabel
        : null,
  };

  const panelHint = isDemo
    ? t("intel.launchRadarDemoHint")
    : panelLocked
      ? t("intel.launchRadarSavedHint")
      : hasReportData && effectiveStatus === "idle" && !effectiveToggleOn
        ? t("intel.launchRadarInsertHint")
        : null;

  const campaignWindow = useMemo(() => {
    if (!effectiveCadence || effectiveCadence.mode !== "campaign" || !effectiveCadence.launchDate) return null;
    return computeCampaignWindowProjection({
      today,
      launchDate: effectiveCadence.launchDate,
      announcementDate: effectiveCadence.announcementDate,
      overview: effectiveCadence.overview,
      category: effectiveCadence.category,
    });
  }, [effectiveCadence, today]);

  const cadenceProjection = useMemo(() => {
    if (!effectiveCadence || (effectiveCadence.mode !== "cadence" && effectiveCadence.mode !== "heuristic") || !effectiveCadence.lastLaunchDate) {
      return null;
    }
    return computeLaunchCadenceProjection({
      today,
      averageIntervalMonths: effectiveCadence.averageIntervalMonths,
      lastLaunchDate: effectiveCadence.lastLaunchDate,
    });
  }, [effectiveCadence, today]);

  if (isDemo && effectiveStatus === "idle" && !panelLocked) {
    return (
      <div className="launch-predictor launch-predictor--demo">
        <LaunchRadarIdleView
          headerProps={headerProps}
          controlProps={{
            brandName,
            running,
            toggleOn: false,
            onToggleChange: handleToggleChange,
            disabled: !brandName || running,
            creditHint: scanCreditLabel,
          }}
          actionError={null}
          panelHint={panelHint}
          previewOverview={previewOverview}
          animatePreview={Boolean(previewOverview)}
        />
      </div>
    );
  }

  if (effectiveStatus === "idle") {
    return (
      <LaunchRadarIdleView
        headerProps={headerProps}
        controlProps={controlProps}
        actionError={actionError}
        panelHint={panelHint}
        previewOverview={previewOverview}
        animatePreview={hasReportData && !panelLocked && Boolean(previewOverview)}
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

  if (cadenceProjection && effectiveCadence) {
    return (
      <div className="launch-predictor">
        <LaunchRadarPanelHeader {...headerProps} reportKind="inactive" />
        <LaunchRadarControl {...controlProps} />
        <CadenceEstimateView
          brandName={brandName}
          cadence={effectiveCadence}
          projection={cadenceProjection}
          today={today}
          variant={effectiveCadence.mode === "heuristic" ? "heuristic" : "cadence"}
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
      panelHint={panelHint}
    />
  );
}

function LaunchRadarIdleView({
  headerProps,
  controlProps,
  actionError,
  panelHint,
  previewOverview = "",
  animatePreview = false,
}) {
  return (
    <div className="launch-predictor">
      <LaunchRadarPanelHeader {...headerProps} reportKind={null} />
      <LaunchRadarControl {...controlProps} />
      {animatePreview && previewOverview ? (
        <AnimatedIntelLine
          text={previewOverview}
          className="launch-predictor__overview launch-predictor__overview--preview"
        />
      ) : null}
      {panelHint ? (
        <p className="launch-predictor__note launch-predictor__note--pending">{panelHint}</p>
      ) : null}
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

      <div className="launch-predictor__compare" aria-label={t("intel.launchRadarDateCompare")}>
        <div className="launch-predictor__compare-row">
          <span className="launch-predictor__compare-key">{t("intel.launchRadarToday")}</span>
          <span className="launch-predictor__compare-val">{window.todayLabel}</span>
        </div>
        {window.announcementLabel ? (
          <div className="launch-predictor__compare-row">
            <span className="launch-predictor__compare-key">{t("intel.launchRadarAnnounce")}</span>
            <span className="launch-predictor__compare-val">{window.announcementLabel}</span>
          </div>
        ) : null}
        <div className="launch-predictor__compare-row">
          <span className="launch-predictor__compare-key">{t("intel.launchRadarLaunch")}</span>
          <span className="launch-predictor__compare-val launch-predictor__compare-val--accent">{window.launchLabel}</span>
        </div>
      </div>

      <div className="launch-predictor__timeline launch-predictor__timeline--campaign" aria-label={t("intel.launchRadarCampaignTimeline")}>
        <div className="launch-predictor__node launch-predictor__node--today">
          <span className="launch-predictor__node-label">{t("intel.launchRadarToday")}</span>
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
              <span className="launch-predictor__node-label">{t("intel.launchRadarAnnounce")}</span>
              <span className="launch-predictor__node-date">{window.announcementLabel}</span>
            </div>
          </>
        ) : null}

        <div className="launch-predictor__bridge">
          <span className="launch-predictor__bridge-line" aria-hidden />
          <span className="launch-predictor__bridge-caption">
            {t("intel.launchRadarDaysLeft", { count: launchBridgeDays })}
          </span>
        </div>

        <div className="launch-predictor__node launch-predictor__node--estimate">
          <span className="launch-predictor__node-label">{t("intel.launchRadarLaunch")}</span>
          <span className="launch-predictor__node-date">{window.launchLabel}</span>
        </div>
      </div>

      <p className="launch-predictor__range">{window.rangeLabel}</p>
      {window.windowTotalDays != null ? (
        <p className="launch-predictor__note">
          {t("intel.launchRadarShipWindow", { count: window.windowTotalDays })}
          {window.phase === "ship-window" && window.windowDaysRemaining != null
            ? ` ${t("intel.launchRadarScopeRemaining", { count: window.windowDaysRemaining })}`
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