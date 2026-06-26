import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  DEFAULT_WEATHER_LOCATION,
  formatCoordsLabel,
  normalizeWeatherLocation,
  requestBrowserGeolocation,
} from "../lib/weatherLocation.js";

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

export const useWeatherLocationStore = create(
  devtools(
    (set, get) => ({
      ...readStoredLocation(),
      geoLoading: false,
      error: "",
      locationRevision: 0,

      setManualCity: (city) => {
        const trimmed = city.trim();
        const next = normalizeWeatherLocation({
          source: "manual",
          city: trimmed,
          label: trimmed,
        });
        persistLocation(next);
        set((state) => ({
          ...next,
          error: "",
          locationRevision: state.locationRevision + 1,
        }));
      },

      setGeolocation: ({ lat, lon, label }) => {
        const next = normalizeWeatherLocation({
          source: "geolocation",
          lat,
          lon,
          label: label || formatCoordsLabel(lat, lon),
        });
        persistLocation(next);
        set((state) => ({
          ...next,
          error: "",
          locationRevision: state.locationRevision + 1,
        }));
      },

      detectGeolocation: async () => {
        set({ geoLoading: true, error: "" });
        try {
          const { lat, lon } = await requestBrowserGeolocation();
          get().setGeolocation({ lat, lon });
          return { lat, lon };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not read your location";
          set({ error: message });
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
    }),
    { name: "weather-location-store" },
  ),
);
