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
      /** YYYY-MM-DD — user picks by expanding a day in the forecast panel. */
      selectedDayId: "",

      setLoading: (locationKey) => set({
        status: "loading",
        locationKey,
        dayIds: [],
        forecastLocation: "",
        selectedDayId: "",
      }),

      setReady: ({ locationKey, dayIds, forecastLocation }) => set((state) => {
        const ids = Array.isArray(dayIds) ? dayIds : [];
        const selectedDayId = ids.includes(state.selectedDayId) ? state.selectedDayId : "";
        return {
          status: "ready",
          locationKey,
          dayIds: ids,
          forecastLocation: forecastLocation || "",
          selectedDayId,
        };
      }),

      setError: (locationKey) => set({
        status: "error",
        locationKey,
        dayIds: [],
        forecastLocation: "",
        selectedDayId: "",
      }),

      setSelectedDayId: (dayId) => set({
        selectedDayId: String(dayId || "").trim(),
      }),

      reset: () => set({
        status: "idle",
        locationKey: "",
        dayIds: [],
        forecastLocation: "",
        selectedDayId: "",
      }),
    }),
    { name: "forecast-panel-store" },
  ),
);
