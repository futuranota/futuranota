import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { launchRadarScopeKey } from "./launchRadarPanelStore.js";

const EMPTY_SESSION = {
  /** Social Hype agent ran once for this corpus scope. */
  reportReady: false,
  /** User inserted preview data (not yet saved to object). */
  widgetLoaded: false,
  /** User saved panel data permanently on the corpus object. */
  panelSaved: false,
};

export const useMarketHypePanelStore = create(
  devtools(
    (set, get) => ({
      sessions: {},
      /** Sticky per corpus object — survives brand label mismatches in scope keys. */
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

      /**
       * @param {string|null|undefined} corpusObjectId
       */
      isCorpusReady(corpusObjectId) {
        if (!corpusObjectId) return false;
        return Boolean(get().corpusReady[corpusObjectId]);
      },
    }),
    { name: "MarketHypePanelStore" },
  ),
);
