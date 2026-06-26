import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** @typedef {'idle'|'loading'|'ready'|'error'} ForecastPanelStatus */

export const useForecastPanelStore = create(
  devtools(
    (set) => ({
      status: "idle",
      locationKey: "",
      dayIds: [],
      forecastLocation: "",

      setLoading: (locationKey) => set({
        status: "loading",
        locationKey,
        dayIds: [],
        forecastLocation: "",
      }),

      setReady: ({ locationKey, dayIds, forecastLocation }) => set({
        status: "ready",
        locationKey,
        dayIds: Array.isArray(dayIds) ? dayIds : [],
        forecastLocation: forecastLocation || "",
      }),

      setError: (locationKey) => set({
        status: "error",
        locationKey,
        dayIds: [],
        forecastLocation: "",
      }),

      reset: () => set({
        status: "idle",
        locationKey: "",
        dayIds: [],
        forecastLocation: "",
      }),
    }),
    { name: "forecast-panel-store" },
  ),
);
