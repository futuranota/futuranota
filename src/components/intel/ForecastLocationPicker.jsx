import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { hasWeatherLocation } from "../../lib/weatherLocation.js";
import { getCityChangeCooldownRemainingMs } from "../../lib/weatherCityRateLimit.js";
import { getWeatherCityChangeCap } from "../../lib/planConfig.js";
import { useWeatherLocationStore } from "../../stores/weatherLocationStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";

export function ForecastLocationPicker() {
  const { t } = useI18n();
  const isPro = usePlanStore((s) => s.isPro());
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);
  const plan = usePlanStore((s) => s.profile.plan);
  const cityChangesUsed = useWeatherLocationStore((s) => s.cityChangesUsedToday);
  const cityChangeCap = getWeatherCityChangeCap(plan);
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
  const refreshCityChangesUsed = useWeatherLocationStore((s) => s.refreshCityChangesUsed);

  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    refreshCityChangesUsed();
  }, [refreshCityChangesUsed]);

  useEffect(() => {
    const tick = () => {
      const ms = getCityChangeCooldownRemainingMs();
      setCooldownSec(ms > 0 ? Math.ceil(ms / 1000) : 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [cityChangesUsed, error]);

  const location = { source, city, lat, lon, label };
  const saved = hasWeatherLocation(location);
  const activeLabel = source === "geolocation"
    ? (label || t("intel.forecastLocationGeo"))
    : (label || city || t("intel.forecastLocationDefault"));

  const limitMessage = (() => {
    if (error === "weather_city_locked") {
      return t("intel.weatherCityLockedFree");
    }
    if (error === "weather_city_daily_limit") {
      return isPro
        ? t("intel.weatherCityChangeLimitPro", { used: String(cityChangesUsed), cap: String(cityChangeCap) })
        : t("intel.weatherCityChangeLimit", { used: String(cityChangesUsed), cap: String(cityChangeCap) });
    }
    if (error === "weather_city_cooldown") {
      return t("intel.weatherCityChangeCooldown", { seconds: String(cooldownSec || 3) });
    }
    return error;
  })();

  const handleEditRequest = () => {
    if (!isPro && saved) {
      showUpgradeModal("weather");
      return;
    }
    setDraft(city || label);
    setEditing(true);
  };

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

  const handleApply = async () => {
    clearError();
    const result = await setManualCity(draft);
    if (result?.ok) {
      setEditing(false);
    }
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

  const applyDisabled = !draft.trim() || cooldownSec > 0;

  if (saved && !editing) {
    return (
      <div className="forecast-location forecast-location--compact">
        <div className="forecast-location__display">
          <span className="forecast-location__pin" aria-hidden>⌖</span>
          <span className="forecast-location__value" title={activeLabel}>{activeLabel}</span>
          <button
            type="button"
            className="btn xs ghost forecast-location__edit"
            onClick={handleEditRequest}
          >
            {t("intel.forecastLocationEdit")}
          </button>
        </div>
        {!isPro && saved ? (
          <p className="forecast-location__locked-note">{t("intel.forecastCityLockedHint")}</p>
        ) : null}
        {error ? (
          <p className="forecast-location__error" role="alert">
            {limitMessage}
          </p>
        ) : null}
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
          disabled={applyDisabled}
        >
          {t("intel.forecastLocationApply")}
        </button>
        <button
          type="button"
          className="btn xs ghost forecast-location__geo"
          onClick={handleGeolocation}
          disabled={geoLoading || cooldownSec > 0}
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
        <p className="forecast-location__error" role="alert">
          {limitMessage}
        </p>
      ) : null}
    </div>
  );
}
