import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchDailyForecastPanel } from "../../lib/forecastPanel.js";
import { scheduleForecastAutoRefresh } from "../../lib/forecastRefresh.js";
import {
  getWeatherLocationKey,
  hasWeatherLocation,
  normalizeWeatherLocation,
} from "../../lib/weatherLocation.js";
import { weatherErrorMessage } from "../../lib/weatherErrors.js";
import { useWeatherLocationStore } from "../../stores/weatherLocationStore.js";
import { useForecastPanelStore } from "../../stores/forecastPanelStore.js";
import { ForecastDayAccordion } from "./ForecastDayAccordion.jsx";
import { ForecastLocationPicker } from "./ForecastLocationPicker.jsx";

export function ForecastPanel({ today = new Date() }) {
  const { t } = useI18n();
  const source = useWeatherLocationStore((s) => s.source);
  const city = useWeatherLocationStore((s) => s.city);
  const lat = useWeatherLocationStore((s) => s.lat);
  const lon = useWeatherLocationStore((s) => s.lon);
  const locationRevision = useWeatherLocationStore((s) => s.locationRevision);
  const rememberResolvedLabel = useWeatherLocationStore((s) => s.rememberResolvedLabel);
  const setPanelLoading = useForecastPanelStore((s) => s.setLoading);
  const setPanelReady = useForecastPanelStore((s) => s.setReady);
  const setPanelError = useForecastPanelStore((s) => s.setError);
  const resetPanel = useForecastPanelStore((s) => s.reset);

  const locationKey = useMemo(
    () => getWeatherLocationKey(normalizeWeatherLocation({ source, city, lat, lon, label: "" })),
    [source, city, lat, lon],
  );

  const [status, setStatus] = useState("idle");
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState("");
  const timezoneOffsetSec = forecast?.timezoneOffsetSec ?? 0;

  const locationRef = useRef({ source, city, lat, lon });
  locationRef.current = { source, city, lat, lon };
  const prevRevisionRef = useRef(locationRevision);

  const applyForecastData = useCallback((data, key) => {
    if (data.location) {
      rememberResolvedLabel(data.location);
    }
    setForecast(data);
    setStatus("ready");
    setError("");
    setPanelReady({
      locationKey: key,
      dayIds: (data.days || []).map((day) => day.id),
      forecastLocation: data.location || "",
    });
  }, [rememberResolvedLabel, setPanelReady]);

  const loadForecast = useCallback(async (key, { soft = false, fresh = false, cityApply = false, cancelled = () => false } = {}) => {
    const location = normalizeWeatherLocation({ ...locationRef.current, label: "" });

    if (!soft) {
      setPanelLoading(key);
      setStatus("loading");
      setError("");
      setForecast(null);
    }

    try {
      const data = await fetchDailyForecastPanel(location, { fresh, cityApply });
      if (cancelled()) return;
      applyForecastData(data, key);
    } catch (err) {
      if (cancelled()) return;
      if (!soft) {
        setForecast(null);
        const code = err instanceof Error ? err.message : "";
        setError(weatherErrorMessage(code, t));
        setStatus("error");
        setPanelError(key);
      }
    }
  }, [applyForecastData, setPanelError, setPanelLoading, t]);

  useEffect(() => {
    let cancelled = false;
    const location = normalizeWeatherLocation({ source, city, lat, lon, label: "" });

    if (!locationKey || !hasWeatherLocation(location)) {
      setStatus("idle");
      setForecast(null);
      setError("");
      resetPanel();
      return undefined;
    }

    const cityApply = locationRevision > prevRevisionRef.current;
    prevRevisionRef.current = locationRevision;

    loadForecast(locationKey, { cancelled: () => cancelled, cityApply });

    return () => {
      cancelled = true;
    };
  }, [locationKey, locationRevision, source, city, lat, lon, loadForecast, resetPanel]);

  useEffect(() => {
    if (status !== "ready" || !locationKey) return undefined;

    return scheduleForecastAutoRefresh(
      (opts = {}) => {
        loadForecast(locationKey, { soft: true, fresh: Boolean(opts.fresh) });
      },
      { timezoneOffsetSec },
    );
  }, [status, locationKey, timezoneOffsetSec, loadForecast]);

  void today;

  return (
    <div className="forecast-panel forecast-panel--compact">
      <ForecastLocationPicker />
      <header className="forecast-panel__header">
        <h2 className="forecast-panel__title">
          {forecast?.days?.length
            ? `${forecast.days.length}-Day Forecast`
            : "Daily Forecast"}
        </h2>
        {forecast?.location && status === "ready" ? (
          <p className="forecast-panel__resolved">{forecast.location}</p>
        ) : null}
        {forecast?.asOf ? (
          <p className="forecast-panel__location">
            {forecast.asOf}
            {forecast.source === "mock" ? ` · ${t("intel.forecastMockWarning")}` : ""}
            {forecast.fromCache ? ` · ${t("intel.forecastCached")}` : ""}
          </p>
        ) : null}
      </header>

      {!locationKey ? (
        <p className="forecast-panel__status">{t("intel.forecastLocationRequired")}</p>
      ) : null}

      {locationKey && status === "loading" ? (
        <p className="forecast-panel__status" role="status">{t("intel.forecastLoading")}</p>
      ) : null}

      {locationKey && status === "error" ? (
        <p className="forecast-panel__status forecast-panel__status--error" role="alert">{error}</p>
      ) : null}

      {status === "ready" && forecast?.days?.length ? (
        <div className="forecast-panel__days">
          {forecast.days.map((day) => (
            <ForecastDayAccordion key={day.id} day={day} defaultOpen={false} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
