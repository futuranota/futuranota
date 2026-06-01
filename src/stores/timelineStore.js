import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import {
  pushDocToTimelineQueue,
  resolveHeadlineBlockIdForCanvasNode,
  resolveParentDocIdForCanvasNode,
} from "../lib/timelineSelection.js";

const TIMELINE_ALERTS_KEY = "futura-timeline-alerts";

function readTimelineAlertsEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TIMELINE_ALERTS_KEY) === "1";
  } catch {
    return false;
  }
}

export const useTimelineStore = create(
  devtools(
    (set, get) => ({
      timelines: {},
      externalEvents: [],
      currentTier: "all",
      tier: "all",
      zoomedTimelineId: null,
      zoomedPlanId: null,
      zoomedObjectId: null,
      objectTimelineTitles: {},
      /** Opt-in: show TimelineAlertToast when checkTimelineTrigger fires (30/7/1d). */
      timelineAlertsEnabled: readTimelineAlertsEnabled(),
      /** Multi-select on canvas + doc queue in left panel for timeline insert. */
      timelineQueueMode: false,
      /** Doc ids queued for timeline insert (accumulates while queue mode is on). */
      timelineDocQueue: [],
      /** Optional headline block id per queued doc (from canvas child selection). */
      timelineDocQueueFocusByDocId: {},

      getTimeline: (id) => get().timelines[id] || null,

      getAllTimelines: () => Object.values(get().timelines),

      getTimelinesByTier: (tier) =>
        Object.values(get().timelines).filter((tl) => tl.tier === tier),

      getCurrentTierTimelines: () => get().getTimelinesByTier(get().currentTier),

      getAllEntries: () => {
        const entries = [];
        Object.values(get().timelines).forEach((tl) => {
          (tl.entries || []).forEach((entry) => entries.push(entry));
        });
        return entries;
      },

      addExternalEvent: (event) =>
        set((state) => ({
          externalEvents: [...state.externalEvents.filter((e) => e.id !== event.id), event],
        })),

      dismissExternalEvent: (id) =>
        set((state) => ({
          externalEvents: state.externalEvents.filter((e) => e.id !== id),
        })),

      syncEntriesFromNodes: (nodes) => {
        const dateNodes = Object.values(nodes || {}).filter((n) => n.dataType === "date" && n.content);
        if (!dateNodes.length) return;

        set((state) => {
          const timelines = { ...state.timelines };
          let timelineId = Object.values(timelines).find((t) => t.tier === "nodes")?.id;
          if (!timelineId) {
            timelineId = generateId("TL");
            timelines[timelineId] = {
              id: timelineId,
              name: "Nodes",
              tier: "nodes",
              entries: [],
              createdAt: new Date().toISOString(),
            };
          }
          const timeline = { ...timelines[timelineId], entries: [...(timelines[timelineId].entries || [])] };
          const existing = new Set(timeline.entries.map((e) => `${e.itemId}:${e.date}`));

          dateNodes.forEach((node) => {
            const date = typeof node.content === "string" ? node.content : "";
            const key = `${node.id}:${date}`;
            if (!date || existing.has(key)) return;
            timeline.entries.push({
              id: generateId("ENTRY"),
              itemId: node.id,
              itemType: "node",
              date,
              duration: null,
            });
            existing.add(key);
          });

          timelines[timelineId] = timeline;
          return { timelines };
        });
      },

      addTimeline: (name, tier) => {
        const id = generateId("TL");
        set((state) => ({
          timelines: {
            ...state.timelines,
            [id]: {
              id,
              name,
              tier,
              entries: [],
              createdAt: new Date().toISOString(),
            },
          },
        }));
        return id;
      },

      addTimelineEntry: (timelineId, itemId, itemType, date, duration = null) =>
        set((state) => {
          const timeline = state.timelines[timelineId];
          if (!timeline) return state;
          const entry = {
            id: generateId("ENTRY"),
            itemId,
            itemType,
            date: date instanceof Date ? date.toISOString() : date,
            duration,
          };
          return {
            timelines: {
              ...state.timelines,
              [timelineId]: {
                ...timeline,
                entries: [...timeline.entries, entry],
              },
            },
          };
        }),

      removeTimelineEntry: (timelineId, entryId) =>
        set((state) => {
          const timeline = state.timelines[timelineId];
          if (!timeline) return state;
          return {
            timelines: {
              ...state.timelines,
              [timelineId]: {
                ...timeline,
                entries: timeline.entries.filter((e) => e.id !== entryId),
              },
            },
          };
        }),

      setCurrentTier: (tier) => set({ currentTier: tier, tier }),

      setTier: (tier) => get().setCurrentTier(tier),

      setZoomedTimeline: (timelineId) => set({ zoomedTimelineId: timelineId }),

      setZoomedPlanId: (id) => set({ zoomedPlanId: id, zoomedTimelineId: id }),

      setZoomedObjectId: (id) => set({ zoomedObjectId: id }),

      setObjectTimelineTitle: (objectId, title) =>
        set((state) => ({
          objectTimelineTitles: {
            ...state.objectTimelineTitles,
            [objectId]: String(title ?? ""),
          },
        })),

      clearZoom: () => set({ zoomedTimelineId: null, zoomedPlanId: null, zoomedObjectId: null }),

      setTimelineAlertsEnabled: (enabled) => {
        const on = Boolean(enabled);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(TIMELINE_ALERTS_KEY, on ? "1" : "0");
          } catch {
            /* private mode */
          }
        }
        set({ timelineAlertsEnabled: on });
      },

      toggleTimelineAlertsEnabled: () => {
        get().setTimelineAlertsEnabled(!get().timelineAlertsEnabled);
      },

      setTimelineQueueMode: (enabled) => {
        const on = Boolean(enabled);
        set(on
          ? { timelineQueueMode: true }
          : {
            timelineQueueMode: false,
            timelineDocQueue: [],
            timelineDocQueueFocusByDocId: {},
          });
      },

      toggleTimelineQueueMode: () => {
        const next = !get().timelineQueueMode;
        get().setTimelineQueueMode(next);
      },

      clearTimelineDocQueue: () => set({ timelineDocQueue: [], timelineDocQueueFocusByDocId: {} }),

      removeTimelineDocFromQueue: (docId) => {
        if (!docId) return;
        set((state) => {
          const { [docId]: _removed, ...focusRest } = state.timelineDocQueueFocusByDocId;
          return {
            timelineDocQueue: state.timelineDocQueue.filter((id) => id !== docId),
            timelineDocQueueFocusByDocId: focusRest,
          };
        });
      },

      pushTimelineDocToQueue: (docId, focusBlockId = null) => {
        if (!docId) return;
        set((state) => {
          const nextFocus = { ...state.timelineDocQueueFocusByDocId };
          if (focusBlockId) nextFocus[docId] = focusBlockId;
          return {
            timelineDocQueue: pushDocToTimelineQueue(state.timelineDocQueue, docId),
            timelineDocQueueFocusByDocId: nextFocus,
          };
        });
      },

      enqueueTimelineDocsFromCanvasNodes: (canvasNodeIds, canvasNodes, nodeEntitiesById, docsById) => {
        const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
        let queue = get().timelineDocQueue;
        const focusByDocId = { ...get().timelineDocQueueFocusByDocId };
        for (const canvasId of canvasNodeIds) {
          const node = nodeById.get(canvasId);
          if (!node) continue;
          const docId = resolveParentDocIdForCanvasNode(node, nodeEntitiesById, docsById);
          if (!docId) continue;
          queue = pushDocToTimelineQueue(queue, docId);
          const focusBlockId = resolveHeadlineBlockIdForCanvasNode(
            node,
            nodeEntitiesById,
            docsById,
          );
          if (focusBlockId) focusByDocId[docId] = focusBlockId;
        }
        set({ timelineDocQueue: queue, timelineDocQueueFocusByDocId: focusByDocId });
      },

      deleteTimeline: (id) =>
        set((state) => {
          const next = { ...state.timelines };
          delete next[id];
          return { timelines: next };
        }),
    }),
    { name: "TimelineStore" },
  ),
);
