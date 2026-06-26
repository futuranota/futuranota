import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import {
  buildForecastNodePayload,
  buildForecastNodeTitle,
  fetchForecastForNode,
  getForecastSearchGate,
  resolveActiveForecastNode,
} from "../../lib/forecastSearch.js";
import {
  getWeatherLocationKey,
  hasWeatherLocation,
  normalizeWeatherLocation,
} from "../../lib/weatherLocation.js";
import {
  formatWeatherActionCounter,
  notifyWeatherActionLimit,
  persistForecastNodeInserted,
  readForecastNodeInserted,
} from "../../lib/weatherUsage.js";
import { useForecastPanelStore } from "../../stores/forecastPanelStore.js";
import { useWeatherLocationStore } from "../../stores/weatherLocationStore.js";
import { ForecastConditionIcon, ForecastIconRain, ForecastIconWind } from "./ForecastIcons.jsx";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";
import { usePlanStore } from "../../stores/planStore.js";

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

/**
 * @param {string} reason
 * @param {(key: string, vars?: Record<string, string>) => string} t
 * @param {{ windowLabel?: string }} vars
 */
function forecastSearchHint(reason, t, vars = {}) {
  const key = `intel.forecastSearchHint${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;
  return t(key, vars);
}

/**
 * @param {{ reason: string, enabled: boolean, windowLabel?: string }} gate
 * @param {(key: string, vars?: Record<string, string>) => string} t
 * @param {{ windowLabel?: string }} vars
 * @param {boolean} showInstruction
 */
function resolveFooterHint(gate, t, vars = {}, showInstruction = false) {
  if (gate.reason === "loading") {
    return t("intel.forecastSearchHintLoading");
  }
  if (gate.reason === "past") {
    return forecastSearchHint("past", t, vars);
  }
  if (gate.reason === "outOfRange") {
    return forecastSearchHint("outOfRange", t, vars);
  }
  if (gate.enabled && gate.reason === "ready") {
    return t("intel.forecastSearchHintReady", vars);
  }
  if (showInstruction) {
    return t("intel.forecastSearchInstruction", vars);
  }
  return "";
}

export function ForecastSearchFooter({
  nodeEntities = {},
  docsById = {},
  expandedNodeId = null,
  selection = [],
  canvasNodes = [],
  onInsertForecastNode,
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [hasInsertedForecastNode, setHasInsertedForecastNode] = useState(
    () => readForecastNodeInserted(),
  );
  const source = useWeatherLocationStore((s) => s.source);
  const city = useWeatherLocationStore((s) => s.city);
  const lat = useWeatherLocationStore((s) => s.lat);
  const lon = useWeatherLocationStore((s) => s.lon);
  const label = useWeatherLocationStore((s) => s.label);
  const rememberResolvedLabel = useWeatherLocationStore((s) => s.rememberResolvedLabel);
  const panelStatus = useForecastPanelStore((s) => s.status);
  const panelLocationKey = useForecastPanelStore((s) => s.locationKey);
  const panelDayIds = useForecastPanelStore((s) => s.dayIds);
  const plan = usePlanStore((s) => s.profile.plan);
  const isPro = usePlanStore((s) => s.isPro());
  const weatherActionsUsed = usePlanStore((s) => s.profile.weatherActionsCount ?? 0);
  const weatherActionCap = usePlanStore((s) => s.getWeatherActionCap());
  const canUseWeatherAction = usePlanStore((s) => s.canUseWeatherAction());

  const weatherLocation = useMemo(
    () => normalizeWeatherLocation({ source, city, lat, lon, label }),
    [source, city, lat, lon, label],
  );
  const locationKey = useMemo(
    () => getWeatherLocationKey(normalizeWeatherLocation({ source, city, lat, lon, label: "" })),
    [source, city, lat, lon],
  );

  const resolveNode = useCallback(
    () => resolveActiveForecastNode(
      nodeEntities,
      { expandedNodeId, selection, canvasNodes },
      docsById,
    ),
    [nodeEntities, docsById, expandedNodeId, selection, canvasNodes],
  );

  const activeNode = useMemo(
    () => resolveNode(),
    [resolveNode],
  );

  const gate = useMemo(
    () => getForecastSearchGate({
      hasLocation: hasWeatherLocation(weatherLocation),
      panelStatus,
      panelLocationKey,
      locationKey,
      dayIds: panelDayIds,
      node: activeNode,
    }),
    [weatherLocation, panelStatus, panelLocationKey, locationKey, panelDayIds, activeNode],
  );

  useEffect(() => {
    if (!gate.enabled) {
      setResult(null);
      setStatus("idle");
    }
  }, [gate.enabled, locationKey, panelLocationKey, panelDayIds]);

  const hintVars = { window: gate.windowLabel || "" };
  const showInstruction = !hasInsertedForecastNode;
  const hint = resolveFooterHint(gate, t, hintVars, showInstruction);
  const actionCounter = formatWeatherActionCounter(weatherActionsUsed, plan);
  const canSearch = gate.enabled && status !== "loading";
  const limitMessage = isPro
    ? t("intel.weatherActionLimitPro", { used: String(weatherActionsUsed), cap: String(weatherActionCap) })
    : t("intel.weatherActionLimit", { used: String(weatherActionsUsed), cap: String(weatherActionCap) });

  const handleSearch = async () => {
    if (!canSearch) return;

    const node = resolveNode();
    setStatus("loading");
    const next = await fetchForecastForNode(node, new Date(), weatherLocation);
    if (next.status === "success" && next.location) {
      rememberResolvedLabel(next.location);
    }
    setResult(next);
    setStatus(next.status === "success" ? "success" : "unavailable");
  };

  const handleInsert = async () => {
    if (!result || result.status !== "success" || !onInsertForecastNode) return;
    if (!canUseWeatherAction) {
      notifyWeatherActionLimit();
      return;
    }

    const spent = await usePlanStore.getState().incrementWeatherAction();
    if (!spent) {
      notifyWeatherActionLimit();
      return;
    }

    persistForecastNodeInserted();
    setHasInsertedForecastNode(true);

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
  const insertDisabled = !canUseWeatherAction;

  return (
    <div className="forecast-search-footer">
      <div className="forecast-search-footer__row">
        <button
          type="button"
          className={
            "forecast-search-footer__btn"
            + (loading ? " is-loading" : "")
            + (canSearch ? "" : " is-disabled")
          }
          onClick={handleSearch}
          disabled={!canSearch}
          aria-busy={loading}
          aria-disabled={!canSearch}
          aria-label={loading ? t("intel.forecastSearchSearching") : t("intel.forecastSearchLabel")}
          title={canSearch ? t("intel.forecastSearchLabel") : (hint || limitMessage)}
        >
          {loading ? (
            <SearchSpinner size={14} />
          ) : (
            <img src={FORECAST_SEARCH_ICON} alt="" aria-hidden className="forecast-search-footer__icon" />
          )}
        </button>
        {!result && hint ? (
          <p className="forecast-search-footer__hint" role="status">
            {hint}
          </p>
        ) : (
          <span className="forecast-search-footer__hint forecast-search-footer__hint--spacer" aria-hidden />
        )}
        <span
          className="forecast-search-footer__counter tnum"
          title={t("intel.forecastActionCounterHint")}
          aria-label={t("intel.forecastActionCounterHint")}
        >
          {actionCounter}
        </span>
      </div>

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
                className={
                  "forecast-search-result__insert btn xs"
                  + (insertDisabled ? " is-disabled" : "")
                }
                onClick={handleInsert}
                disabled={insertDisabled}
                title={insertDisabled ? limitMessage : undefined}
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
