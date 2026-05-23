import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";

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

      clearZoom: () => set({ zoomedTimelineId: null, zoomedPlanId: null, zoomedObjectId: null }),

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
