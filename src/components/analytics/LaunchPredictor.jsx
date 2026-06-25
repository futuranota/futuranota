import { useEffect, useMemo, useState } from "react";
import { resolveCurrentCorpus } from "../../lib/currentCorpus.js";
import { OBJECT_ROLE_CORPUS } from "../../lib/objectColors.js";
import { fetchBrandCadence } from "../../lib/fetchBrandCadence.js";
import {
  computeCampaignWindowProjection,
  computeLaunchCadenceProjection,
  formatReferenceMonthLabelEn,
  toIsoDateString,
} from "../../lib/launchCadenceMath.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useTimelineStore } from "../../stores/timelineStore.js";
import "../../styles/launch-predictor.css";

/**
 * Launch cadence module — reads brand + injected campaign intel from corpus.
 * @param {{ today?: Date }} props
 */
export function LaunchPredictor({ today = new Date() }) {
  const objects = useObjectsStore((s) => s.objects);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);

  const { currentCorpus, brandName, storedCadence } = useMemo(() => {
    const { currentCorpus: corpus, brandName: brand } = resolveCurrentCorpus(objects, selectedObjectId);
    const focusId = selectedObjectId && objects[selectedObjectId]?.role === OBJECT_ROLE_CORPUS
      ? selectedObjectId
      : corpus?.id;
    const focus = focusId ? objects[focusId] : null;
    return {
      currentCorpus: corpus,
      brandName: brand,
      storedCadence: focus?.cadence ?? null,
    };
  }, [objects, selectedObjectId]);

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [cadence, setCadence] = useState(null);

  const referenceMonthLabel = useMemo(
    () => formatReferenceMonthLabelEn(today),
    [today],
  );

  useEffect(() => {
    if (!brandName) {
      setStatus("empty");
      setCadence(null);
      setError(null);
      return;
    }

    if (storedCadence?.launchDate) {
      setCadence({
        mode: "campaign",
        launchDate: storedCadence.launchDate,
        announcementDate: storedCadence.announcementDate || null,
        lastLaunchDate: storedCadence.lastLaunchDate || null,
        averageIntervalMonths: storedCadence.averageIntervalMonths ?? null,
        overview: storedCadence.overview || "",
        category: storedCadence.category || "",
        source: storedCadence.source || "hero_signal",
      });
      setStatus("ready");
      setError(null);
      return;
    }

    if (
      storedCadence?.lastLaunchDate
      && storedCadence?.averageIntervalMonths != null
    ) {
      setCadence({
        mode: "cadence",
        averageIntervalMonths: Number(storedCadence.averageIntervalMonths),
        lastLaunchDate: storedCadence.lastLaunchDate,
        overview: storedCadence.overview || "",
        category: storedCadence.category || "",
        source: storedCadence.source || "hero_signal",
      });
      setStatus("ready");
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchBrandCadence({ brandName, referenceMonthLabel })
      .then((data) => {
        if (cancelled) return;
        setCadence({ mode: "cadence", ...data });
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setCadence(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load cadence");
      });

    return () => {
      cancelled = true;
    };
  }, [brandName, referenceMonthLabel, storedCadence]);

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
    if (!cadence || cadence.mode !== "cadence" || !cadence.lastLaunchDate) return null;
    return computeLaunchCadenceProjection({
      today,
      averageIntervalMonths: cadence.averageIntervalMonths,
      lastLaunchDate: cadence.lastLaunchDate,
    });
  }, [cadence, today]);

  if (!currentCorpus || !brandName) {
    return (
      <div className="launch-predictor launch-predictor--empty">
        <p className="launch-predictor__empty-title">Launch radar</p>
        <p className="launch-predictor__empty-copy">
          Select a campaign from the Library to load launch dates and analysis here.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="launch-predictor launch-predictor--loading">
        <p className="launch-predictor__status">Analyzing {brandName}…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="launch-predictor launch-predictor--error">
        <p className="launch-predictor__status">{error}</p>
      </div>
    );
  }

  if (campaignWindow) {
    return (
      <CampaignWindowView
        brandName={currentCorpus.brandName}
        corpusId={currentCorpus.id}
        window={campaignWindow}
      />
    );
  }

  if (cadenceProjection && cadence) {
    return (
      <CadenceEstimateView
        brandName={currentCorpus.brandName}
        corpusId={currentCorpus.id}
        cadence={cadence}
        projection={cadenceProjection}
      />
    );
  }

  return null;
}

function CampaignWindowView({ brandName, corpusId, window }) {
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
    <div className="launch-predictor">
      <header className="launch-predictor__head">
        <span className="launch-predictor__kicker">Launch radar</span>
        <h4 className="launch-predictor__brand">{brandName}</h4>
        {window.category ? (
          <span className="launch-predictor__category">{window.category}</span>
        ) : null}
      </header>

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
        Track on timeline
      </button>
    </div>
  );
}

function CadenceEstimateView({ brandName, corpusId, cadence, projection }) {
  const handleTrackOnTimeline = () => {
    const dateStr = toIsoDateString(projection.estimatedLaunchDate);
    const docs = useDocsStore.getState().getDocsByObject(corpusId);
    const parentDocId = docs[0]?.id || null;

    const nodeId = useNodesStore.getState().addNode(
      `Est. Launch · ${brandName}`,
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

  return (
    <div className="launch-predictor">
      <header className="launch-predictor__head">
        <span className="launch-predictor__kicker">Launch radar</span>
        <h4 className="launch-predictor__brand">{brandName}</h4>
        {cadence.category ? (
          <span className="launch-predictor__category">{cadence.category}</span>
        ) : null}
      </header>

      {cadence.overview ? (
        <p className="launch-predictor__overview">{cadence.overview}</p>
      ) : null}

      <div className="launch-predictor__timeline" aria-label="Launch cadence timeline">
        <div className="launch-predictor__node launch-predictor__node--today">
          <span className="launch-predictor__node-label">Today</span>
          <span className="launch-predictor__node-date">{projection.todayLabel}</span>
        </div>

        <div className="launch-predictor__bridge">
          <span className="launch-predictor__bridge-line" aria-hidden />
          <span className="launch-predictor__bridge-caption">
            {projection.monthsRemaining} month
            {projection.monthsRemaining === 1 ? "" : "s"} left
          </span>
        </div>

        <div className="launch-predictor__node launch-predictor__node--estimate">
          <span className="launch-predictor__node-label">Est. launch</span>
          <span className="launch-predictor__node-date">{projection.estimatedMonthLabel}</span>
        </div>
      </div>

      <p className="launch-predictor__note">
        This company typically launches products every {intervalLabel} months.{" "}
        They will likely launch their next product within the next{" "}
        {projection.monthsRemaining} month
        {projection.monthsRemaining === 1 ? "" : "s"}.{" "}
        Announcements usually begin about three months before.
      </p>

      <button type="button" className="btn sm primary" onClick={handleTrackOnTimeline}>
        Track on timeline
      </button>
    </div>
  );
}
