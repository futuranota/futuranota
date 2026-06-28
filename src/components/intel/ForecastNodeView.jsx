import {
  forecastPayloadToResult,
  parseWeatherForecastNodeContent,
} from "../../lib/forecastSearch.js";
import { ForecastConditionIcon, ForecastIconRain, ForecastIconWind } from "./ForecastIcons.jsx";

function TempPair({ high, low }) {
  return (
    <span className="forecast-node-view__temps tnum">
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
 * Compact read-only forecast widget for canvas and document blocks.
 * @param {{ content?: unknown, payload?: object|null, className?: string, compact?: boolean }} props
 */
export function ForecastNodeView({ content, payload: payloadProp, className = "", compact = true }) {
  const payload = payloadProp || parseWeatherForecastNodeContent(content);
  const result = forecastPayloadToResult(payload);
  if (!result) return null;

  const day = result.day || {};
  const wind = day.wind || {};

  return (
    <div
      className={[
        "forecast-node-view",
        compact ? "forecast-node-view--compact" : "",
        className,
      ].filter(Boolean).join(" ")}
      role="status"
    >
      <div className="forecast-node-view__meta">
        <span className="forecast-node-view__date tnum">{result.uiDate}</span>
        {result.location ? (
          <span className="forecast-node-view__location">{result.location}</span>
        ) : null}
      </div>
      <div className="forecast-node-view__body">
        <ForecastConditionIcon name={day.conditionIcon} size={compact ? 28 : 32} />
        <div className="forecast-node-view__copy">
          <div className="forecast-node-view__headline">
            <TempPair high={day.high} low={day.low} />
            <span>{day.condition}</span>
          </div>
          {!compact && day.day?.description ? (
            <p className="forecast-node-view__summary">{day.day.description}</p>
          ) : null}
          <div className="forecast-node-view__stats">
            <span>
              <ForecastIconRain size={12} />
              {day.precipPct}%
            </span>
            <span>
              <ForecastIconWind size={12} />
              {wind.dir} {wind.speed} {wind.unit || "mph"}
            </span>
          </div>
        </div>
      </div>
      {result.sourceLabel ? (
        <span className="forecast-node-view__source">{result.sourceLabel}</span>
      ) : null}
    </div>
  );
}
