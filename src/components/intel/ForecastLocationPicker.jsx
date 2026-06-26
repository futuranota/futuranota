import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { hasWeatherLocation } from "../../lib/weatherLocation.js";
import { useWeatherLocationStore } from "../../stores/weatherLocationStore.js";

export function ForecastLocationPicker() {
  const { t } = useI18n();
  const source = useWeatherLocationStore((s) => s.source);
  const city = useWeatherLocationStore((s) => s.city);
  const lat = useWeatherLocationStore((s) => s.lat);
  const lon = useWeatherLocationStore((s) => s.lon);
  const label = useWeatherLocationStore((s) => s.label);
  const geoLoading = useWeatherLocationStore((s) => s.geoLoading);
  const error = useWeatherLocationStore((s) => s.error);
  const setManualCity = useWeatherLocationStore((s) => s.setManualCity);
  const detectGeolocation = useWeatherLocationStore((s) => s.detectGeolocation);
  const clearError = useWeatherLocationStore((s) => s.clearError);

  const location = { source, city, lat, lon, label };
  const saved = hasWeatherLocation(location);
  const activeLabel = source === "geolocation"
    ? (label || t("intel.forecastLocationGeo"))
    : (label || city || t("intel.forecastLocationDefault"));

  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(city || label);

  useEffect(() => {
    if (!editing) {
      setDraft(city || label);
    }
  }, [city, label, editing]);

  useEffect(() => {
    if (saved) {
      setEditing(false);
    }
  }, [saved]);

  const handleApply = () => {
    clearError();
    setManualCity(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    clearError();
    setDraft(city || label);
    setEditing(false);
  };

  const handleGeolocation = async () => {
    try {
      await detectGeolocation();
      setEditing(false);
    } catch {
      /* error stored in zustand */
    }
  };

  if (saved && !editing) {
    return (
      <div className="forecast-location forecast-location--compact">
        <div className="forecast-location__display">
          <span className="forecast-location__pin" aria-hidden>⌖</span>
          <span className="forecast-location__value" title={activeLabel}>{activeLabel}</span>
          <button
            type="button"
            className="btn xs ghost forecast-location__edit"
            onClick={() => {
              setDraft(city || label);
              setEditing(true);
            }}
          >
            {t("intel.forecastLocationEdit")}
          </button>
        </div>
        {error ? <p className="forecast-location__error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="forecast-location forecast-location--compact">
      <div className="forecast-location__bar">
        <label className="forecast-location__label" htmlFor="forecast-location-input">
          {t("intel.forecastLocationLabelShort")}
        </label>
        <input
          id="forecast-location-input"
          type="text"
          className="forecast-location__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder={t("intel.forecastLocationPlaceholder")}
          title={t("intel.forecastLocationHint")}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn xs forecast-location__apply"
          onClick={handleApply}
          disabled={!draft.trim()}
        >
          {t("intel.forecastLocationApply")}
        </button>
        <button
          type="button"
          className="btn xs ghost forecast-location__geo"
          onClick={handleGeolocation}
          disabled={geoLoading}
          aria-busy={geoLoading}
          aria-label={geoLoading ? t("intel.forecastLocationDetecting") : t("intel.forecastLocationUseGeo")}
          title={t("intel.forecastLocationUseGeo")}
        >
          {geoLoading ? "…" : "⌖"}
        </button>
        {saved ? (
          <button
            type="button"
            className="btn xs ghost forecast-location__cancel"
            onClick={handleCancel}
          >
            {t("common.cancel")}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="forecast-location__error" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
