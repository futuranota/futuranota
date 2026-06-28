import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** @typedef {'idle'|'ready'} LaunchRadarPanelStatus */

const EMPTY_SESSION = {
  status: "idle",
  cadence: null,
  toggleOn: false,
  actionError: null,
};

/**
 * @param {string|null|undefined} corpusId
 * @param {string|null|undefined} brandName
 */
export function launchRadarScopeKey(corpusId, brandName) {
  const brand = (brandName || "").trim().toLowerCase();
  return `${corpusId || "none"}::${brand || "none"}`;
}

export const useLaunchRadarPanelStore = create(
  devtools(
    (set, get) => ({
      sessions: {},

      /**
       * @param {string|null|undefined} corpusId
       * @param {string|null|undefined} brandName
       */
      getSession(corpusId, brandName) {
        const key = launchRadarScopeKey(corpusId, brandName);
        return get().sessions[key] || EMPTY_SESSION;
      },

      /**
       * @param {string|null|undefined} corpusId
       * @param {string|null|undefined} brandName
       * @param {Partial<typeof EMPTY_SESSION>} patch
       */
      patchSession(corpusId, brandName, patch) {
        const key = launchRadarScopeKey(corpusId, brandName);
        set((state) => ({
          sessions: {
            ...state.sessions,
            [key]: {
              ...(state.sessions[key] || EMPTY_SESSION),
              ...patch,
            },
          },
        }));
      },

      /**
       * @param {string|null|undefined} corpusId
       * @param {string|null|undefined} brandName
       */
      resetSession(corpusId, brandName) {
        get().patchSession(corpusId, brandName, { ...EMPTY_SESSION });
      },
    }),
    { name: "LaunchRadarPanelStore" },
  ),
);
