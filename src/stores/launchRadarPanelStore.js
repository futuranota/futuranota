import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** @typedef {'idle'|'ready'} LaunchRadarPanelStatus */

const EMPTY_SESSION = {
  status: "idle",
  cadence: null,
  toggleOn: false,
  actionError: null,
  /** Agent produced launch data at least once for this corpus scope. */
  reportReady: false,
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
      /** Campaign Analyst ran once for this corpus object. */
      corpusReady: {},

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

      /**
       * Sticky flag: Campaign Analyst (or equivalent) ran once for this scope.
       * Keeps the toggle enabled even when sidebar focus moves to another file.
       * @param {string|null|undefined} corpusId
       * @param {string|null|undefined} brandName
       */
      markReportReady(corpusId, brandName) {
        get().patchSession(corpusId, brandName, { reportReady: true });
        get().markCorpusReady(corpusId);
      },

      /**
       * @param {string|null|undefined} corpusObjectId
       */
      markCorpusReady(corpusObjectId) {
        if (!corpusObjectId) return;
        set((state) => ({
          corpusReady: {
            ...state.corpusReady,
            [corpusObjectId]: true,
          },
        }));
      },
    }),
    { name: "LaunchRadarPanelStore" },
  ),
);
