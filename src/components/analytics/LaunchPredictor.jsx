import { useEffect, useMemo, useState } from "react";
import { resolveCurrentCorpus } from "../../lib/currentCorpus.js";
import { fetchBrandCadence } from "../../lib/fetchBrandCadence.js";
import {
  computeLaunchCadenceProjection,
  formatReferenceMonthLabelEn,
} from "../../lib/launchCadenceMath.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useTimelineStore } from "../../stores/timelineStore.js";
import { generateId } from "../../lib/ids.js";
import "../../styles/launch-predictor.css";

function toIsoDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Launch cadence module — reads brand from current corpus, no user input.
 * @param {{ today?: Date }} props
 */
export function LaunchPredictor({ today = new Date() }) {
  const objects = useObjectsStore((s) => s.objects);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);

  const { currentCorpus, brandName } = useMemo(
    () => resolveCurrentCorpus(objects, selectedObjectId),
    [objects, selectedObjectId],
  );

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

    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchBrandCadence({ brandName, referenceMonthLabel })
      .then((data) => {
        if (cancelled) return;
        setCadence(data);
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
  }, [brandName, referenceMonthLabel]);

  const projection = useMemo(() => {
    if (!cadence) return null;
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
          Select a corpus object with a brand to infer launch cadence.
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

  if (!projection) return null;

  const handleTrackOnTimeline = () => {
    const dateStr = toIsoDateString(projection.estimatedLaunchDate);
    const docs = useDocsStore.getState().getDocsByObject(currentCorpus.id);
    const parentDocId = docs[0]?.id || null;

    const nodeId = useNodesStore.getState().addNode(
      `Est. Launch · ${currentCorpus.brandName}`,
      "date",
      dateStr,
      parentDocId,
    );

    useTimelineStore.getState().addExternalEvent({
      id: nodeId,
      title: `Est. Launch · ${currentCorpus.brandName}`,
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
        <h4 className="launch-predictor__brand">{currentCorpus.brandName}</h4>
      </header>

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
