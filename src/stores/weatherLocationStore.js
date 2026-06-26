import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  DEFAULT_WEATHER_LOCATION,
  formatCoordsLabel,
  normalizeWeatherLocation,
  requestBrowserGeolocation,
} from "../lib/weatherLocation.js";
import {
  checkCityChangeAllowed,
  readCityChangesUsedToday,
  recordCityChangeApply,
} from "../lib/weatherCityRateLimit.js";
import { usePlanStore } from "./planStore.js";
import { useUpgradeModalStore } from "./upgradeModalStore.js";

const STORAGE_KEY = "futuranota-weather-location";

function readStoredLocation() {
  try {
    if (typeof localStorage === "undefined") {
      return { ...DEFAULT_WEATHER_LOCATION };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEATHER_LOCATION };
    return normalizeWeatherLocation(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WEATHER_LOCATION };
  }
}

function persistLocation(location) {
  try {
    if (typeof localStorage === "undefined") return;
    const payload = normalizeWeatherLocation(location);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/**
 * @param {ReturnType<typeof normalizeWeatherLocation>} next
 * @param {() => import("../lib/weatherLocation.js").WeatherLocation} getCurrent
 */
function applyLocationUpdate(next, getCurrent) {
  const prev = normalizeWeatherLocation(getCurrent());
  const plan = usePlanStore.getState().profile.plan;
  const check = checkCityChangeAllowed(prev, next, plan);

  if (!check.ok) {
    if (check.reason === "daily_limit" && !usePlanStore.getState().isPro()) {
      useUpgradeModalStore.getState().show("weather");
    }
    return { ok: false, reason: check.reason, ...check };
  }

  if (check.reason === "same") {
    persistLocation(next);
    return { ok: true, reason: "same" };
  }

  const used = recordCityChangeApply();
  persistLocation(next);
  return { ok: true, reason: "consume", cityChangesUsed: used };
}

export const useWeatherLocationStore = create(
  devtools(
    (set, get) => ({
      ...readStoredLocation(),
      geoLoading: false,
      error: "",
      locationRevision: 0,
      cityChangesUsedToday: readCityChangesUsedToday(),

      setManualCity: async (city) => {
        const trimmed = city.trim();
        if (!trimmed) return { ok: false, reason: "empty" };

        const next = normalizeWeatherLocation({
          source: "manual",
          city: trimmed,
          label: trimmed,
        });
        const result = applyLocationUpdate(next, get);
        if (!result.ok) {
          if (result.reason === "daily_limit") {
            set({ error: "weather_city_daily_limit" });
          } else if (result.reason === "cooldown") {
            set({ error: "weather_city_cooldown" });
          }
          return result;
        }

        set((state) => ({
          ...next,
          error: "",
          locationRevision: result.reason === "consume"
            ? state.locationRevision + 1
            : state.locationRevision,
          cityChangesUsedToday: result.cityChangesUsed ?? readCityChangesUsedToday(),
        }));
        return result;
      },

      setGeolocation: async ({ lat, lon, label }) => {
        const next = normalizeWeatherLocation({
          source: "geolocation",
          lat,
          lon,
          label: label || formatCoordsLabel(lat, lon),
        });
        const result = applyLocationUpdate(next, get);
        if (!result.ok) {
          if (result.reason === "daily_limit") {
            set({ error: "weather_city_daily_limit" });
          } else if (result.reason === "cooldown") {
            set({ error: "weather_city_cooldown" });
          }
          return result;
        }

        set((state) => ({
          ...next,
          error: "",
          locationRevision: result.reason === "consume"
            ? state.locationRevision + 1
            : state.locationRevision,
          cityChangesUsedToday: result.cityChangesUsed ?? readCityChangesUsedToday(),
        }));
        return result;
      },

      detectGeolocation: async () => {
        set({ geoLoading: true, error: "" });
        try {
          const { lat, lon } = await requestBrowserGeolocation();
          const result = await get().setGeolocation({ lat, lon });
          if (!result.ok) {
            const code = result.reason === "daily_limit"
              ? "weather_city_daily_limit"
              : result.reason === "cooldown"
                ? "weather_city_cooldown"
                : "geolocation_failed";
            throw new Error(code);
          }
          return { lat, lon };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not read your location";
          if (message.startsWith("weather_city_")) {
            set({ error: message });
          } else {
            set({ error: message });
          }
          throw err;
        } finally {
          set({ geoLoading: false });
        }
      },

      rememberResolvedLabel: (label) => {
        const trimmed = (label || "").trim();
        if (!trimmed) return;
        const current = normalizeWeatherLocation(get());
        if (current.label === trimmed) return;
        const next = { ...current, label: trimmed };
        persistLocation(next);
        set({ label: trimmed });
      },

      clearError: () => set({ error: "" }),

      refreshCityChangesUsed: () => {
        set({ cityChangesUsedToday: readCityChangesUsedToday() });
      },
    }),
    { name: "weather-location-store" },
  ),
);
