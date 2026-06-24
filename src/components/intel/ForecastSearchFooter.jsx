import { useCallback, useState } from "react";
import {
  buildForecastNodePayload,
  buildForecastNodeTitle,
  fetchForecastForNode,
  resolveActiveForecastNode,
} from "../../lib/forecastSearch.js";
import { ForecastConditionIcon, ForecastIconRain, ForecastIconWind } from "./ForecastIcons.jsx";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";
import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";

const FORECAST_SEARCH_ICON = "/uploads/botones/search-active.svg";

function TempPair({ high, low }) {
  return (
    <span className="forecast-search-result__temps tnum">
      <span className="forecast-summary__temp-high">
        {high}
        <span className="forecast-temp__deg">°</span>
      </span>
      {" / "}
      <span className="forecast-summary__temp-low">
        {low}
        <span className="forecast-temp__deg">°</span>
      </span>
    </span>
  );
}

export function ForecastSearchFooter({
  nodeEntities = {},
  docsById = {},
  expandedNodeId = null,
  selection = [],
  canvasNodes = [],
  onInsertForecastNode,
}) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  const resolveNode = useCallback(
    () => resolveActiveForecastNode(
      nodeEntities,
      { expandedNodeId, selection, canvasNodes },
      docsById,
    ),
    [nodeEntities, docsById, expandedNodeId, selection, canvasNodes],
  );

  const handleSearch = async () => {
    const node = resolveNode();
    setStatus("loading");
    const next = await fetchForecastForNode(node);
    setResult(next);
    setStatus(next.status === "success" ? "success" : "unavailable");
  };

  const handleInsert = () => {
    if (!result || result.status !== "success" || !onInsertForecastNode) return;
    const payload = buildForecastNodePayload(result);
    const title = buildForecastNodeTitle(result.uiDate);
    onInsertForecastNode({
      title,
      payload,
      sourceNode: result.node,
      anchorAt: result.scheduleIso || null,
    });
  };

  const loading = status === "loading";

  return (
    <div className="forecast-search-footer">
      <button
        type="button"
        className={"forecast-search-footer__btn" + (loading ? " is-loading" : "")}
        onClick={handleSearch}
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? "Searching forecast" : "Search forecast for node schedule"}
        title={loading ? "Searching…" : "Search forecast"}
      >
        {loading ? (
          <SearchSpinner size={14} />
        ) : (
          <img src={FORECAST_SEARCH_ICON} alt="" aria-hidden className="forecast-search-footer__icon" />
        )}
      </button>

      {result ? (
        <div className="forecast-search-result" role="status">
          {result.status === "success" ? (
            <>
              <div className="forecast-search-result__meta">
                <span className="forecast-search-result__date tnum">{result.uiDate}</span>
                <span className="forecast-search-result__source">{result.sourceLabel}</span>
              </div>
              <div className="forecast-search-result__body">
                <ForecastConditionIcon name={result.day?.conditionIcon} size={32} />
                <div className="forecast-search-result__copy">
                  <div className="forecast-search-result__headline">
                    <TempPair high={result.day?.high} low={result.day?.low} />
                    <span>{result.day?.condition}</span>
                  </div>
                  <p className="forecast-search-result__summary">
                    {result.day?.day?.description || result.day?.condition}
                  </p>
                  <div className="forecast-search-result__stats">
                    <span>
                      <ForecastIconRain size={12} />
                      {result.day?.precipPct}%
                    </span>
                    <span>
                      <ForecastIconWind size={12} />
                      {result.day?.wind?.dir} {result.day?.wind?.speed} {result.day?.wind?.unit || "mph"}
                    </span>
                  </div>
                  <p className="forecast-search-result__disclaimer">{result.disclaimer}</p>
                </div>
              </div>
              <button
                type="button"
                className="forecast-search-result__insert btn xs"
                onClick={handleInsert}
              >
                Insert node
              </button>
            </>
          ) : (
            <p className="forecast-search-result__message">{result.message}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
