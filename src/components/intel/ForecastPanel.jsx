import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchDailyForecastPanel } from "../../lib/forecastPanel.js";
import { normalizeWeatherLocation } from "../../lib/weatherLocation.js";
import { weatherErrorMessage } from "../../lib/weatherErrors.js";
import { useWeatherLocationStore } from "../../stores/weatherLocationStore.js";
import { ForecastDayAccordion } from "./ForecastDayAccordion.jsx";
import { ForecastLocationPicker } from "./ForecastLocationPicker.jsx";

export function ForecastPanel({ today = new Date() }) {
  const { t } = useI18n();
  const source = useWeatherLocationStore((s) => s.source);
  const city = useWeatherLocationStore((s) => s.city);
  const lat = useWeatherLocationStore((s) => s.lat);
  const lon = useWeatherLocationStore((s) => s.lon);
  const label = useWeatherLocationStore((s) => s.label);
  const rememberResolvedLabel = useWeatherLocationStore((s) => s.rememberResolvedLabel);

  const weatherLocation = useMemo(
    () => normalizeWeatherLocation({ source, city, lat, lon, label }),
    [source, city, lat, lon, label],
  );

  const [status, setStatus] = useState("loading");
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchDailyForecastPanel(weatherLocation);
        if (cancelled) return;
        if (data.location) {
          rememberResolvedLabel(data.location);
        }
        setForecast(data);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setForecast(null);
        setError(weatherErrorMessage(
          err instanceof Error ? err.message : "",
          t,
        ));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weatherLocation, rememberResolvedLabel, t]);

  void today;

  return (
    <div className="forecast-panel forecast-panel--compact">
      <ForecastLocationPicker />
      <header className="forecast-panel__header">
        <h2 className="forecast-panel__title">Daily Forecast</h2>
        {forecast?.asOf ? (
          <p className="forecast-panel__location">{forecast.asOf}</p>
        ) : null}
      </header>

      {status === "loading" ? (
        <p className="forecast-panel__status" role="status">Loading forecast…</p>
      ) : null}

      {status === "error" ? (
        <p className="forecast-panel__status forecast-panel__status--error" role="alert">{error}</p>
      ) : null}

      {status === "ready" && forecast?.days?.length ? (
        <div className="forecast-panel__days">
          {forecast.days.map((day, i) => (
            <ForecastDayAccordion key={day.id} day={day} defaultOpen={i === 0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
