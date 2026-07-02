import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { resolveCanvasNodeObjectId } from "../lib/objectColors.js";
import {
  pushDocToTimelineQueue,
  resolveHeadlineBlockIdForCanvasNode,
  resolveParentDocIdForCanvasNode,
} from "../lib/timelineSelection.js";
import { captureTimelineDocSnapshot } from "../lib/timelineDocSnapshot.js";
import { buildTacticalWireAnchorMap } from "../lib/timelineAnchors.js";

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
      /** Snapshot anchor dates + macronodos per queued doc (persists without canvas). */
      timelineDocSnapshotsByDocId: {},
      /** Macronodo keys hidden from timeline per doc (user removed chip). */
      timelineExcludedChildrenByDocId: {},
      /** Cognitive snapshot mode (Trace Funix) — Intel / mixed doc+object queries. */
      traceFunixMode: false,
      /** Fase 2: cross-family doc links + timeline inherit (Bloque A). */
      inheritObjMode: false,
      /**
       * Reference object for the tactical timeline axis (primary family).
       * Secondary families inherit time from this set when cross-linked — not from creation order.
       */
      primaryTimelineObjectId: null,
      /** Drill-down / timeline selection focus (Bloque A → B UI). */
      timelineFocus: null,
      /** Doc ids expanded to show child nodes on tactical timeline. */
      expandedDocIds: [],
      /** Manual zoom-out: extend visible grid start/end (ms, calendar day). */
      tacticalRangeOverride: null,

      getEffectiveCanvasMode: () => {
        const s = get();
        if (s.inheritObjMode) return "inherit-obj";
        if (s.timelineQueueMode) return "queue";
        return "free";
      },

      setTraceFunixMode: (enabled) => {
        const on = Boolean(enabled);
        if (on) console.log("Trace Funix activated");
        set({ traceFunixMode: on });
      },

      toggleTraceFunixMode: () => {
        const next = !get().traceFunixMode;
        if (next) console.log("Trace Funix activated");
        set({ traceFunixMode: next });
      },

      setInheritObjMode: (enabled) => {
        const on = Boolean(enabled);
        set(on
          ? { inheritObjMode: true, timelineQueueMode: false }
          : { inheritObjMode: false });
      },

      toggleInheritObjMode: () => {
        get().setInheritObjMode(!get().inheritObjMode);
      },

      setPrimaryTimelineObjectId: (objectId) => {
        set({ primaryTimelineObjectId: objectId || null });
      },

      setTimelineFocus: (focus) => {
        if (!focus) {
          set({ timelineFocus: null });
          return;
        }
        set({
          timelineFocus: {
            level: focus.level || "family",
            objectId: focus.objectId || null,
            docId: focus.docId || null,
            canvasNodeId: focus.canvasNodeId || null,
          },
        });
      },

      clearTimelineFocus: () => set({ timelineFocus: null }),

      setExpandedDocIds: (docIds) => {
        set({ expandedDocIds: Array.isArray(docIds) ? [...docIds] : [] });
      },

      toggleExpandedDocId: (docId) => {
        if (!docId) return;
        set((state) => {
          const setIds = new Set(state.expandedDocIds);
          if (setIds.has(docId)) setIds.delete(docId);
          else setIds.add(docId);
          return { expandedDocIds: [...setIds] };
        });
      },

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
          ? { timelineQueueMode: true, inheritObjMode: false }
          : { timelineQueueMode: false });
      },

      toggleTimelineQueueMode: () => {
        const next = !get().timelineQueueMode;
        get().setTimelineQueueMode(next);
      },

      clearTimelineDocQueue: () => set({
        timelineDocQueue: [],
        timelineDocQueueFocusByDocId: {},
        timelineDocSnapshotsByDocId: {},
        timelineExcludedChildrenByDocId: {},
        tacticalRangeOverride: null,
      }),

      setTacticalRangeOverride: (override) => set({ tacticalRangeOverride: override }),

      clearTacticalRangeOverride: () => set({ tacticalRangeOverride: null }),

      removeTimelineDocFromQueue: (docId) => {
        if (!docId) return;
        set((state) => {
          const { [docId]: _removed, ...focusRest } = state.timelineDocQueueFocusByDocId;
          const { [docId]: _snap, ...snapRest } = state.timelineDocSnapshotsByDocId;
          const { [docId]: _excl, ...exclRest } = state.timelineExcludedChildrenByDocId;
          return {
            timelineDocQueue: state.timelineDocQueue.filter((id) => id !== docId),
            timelineDocQueueFocusByDocId: focusRest,
            timelineDocSnapshotsByDocId: snapRest,
            timelineExcludedChildrenByDocId: exclRest,
            expandedDocIds: state.expandedDocIds.filter((id) => id !== docId),
          };
        });
      },

      removeTimelineChildFromQueue: (docId, childKey) => {
        if (!docId || !childKey) return;
        set((state) => {
          const snap = state.timelineDocSnapshotsByDocId[docId];
          const nextSnap = snap
            ? {
              ...state.timelineDocSnapshotsByDocId,
              [docId]: {
                ...snap,
                children: snap.children.filter(
                  (c) => c.key !== childKey && c.entityId !== childKey && c.canvasNodeId !== childKey,
                ),
              },
            }
            : state.timelineDocSnapshotsByDocId;
          const prevExcluded = state.timelineExcludedChildrenByDocId[docId] || [];
          const excluded = prevExcluded.includes(childKey)
            ? prevExcluded
            : [...prevExcluded, childKey];
          return {
            timelineDocSnapshotsByDocId: nextSnap,
            timelineExcludedChildrenByDocId: {
              ...state.timelineExcludedChildrenByDocId,
              [docId]: excluded,
            },
          };
        });
      },

      removeTimelineEntityFromSnapshots: (entityId) => {
        if (!entityId) return;
        set((state) => {
          const nextSnap = { ...state.timelineDocSnapshotsByDocId };
          let snapChanged = false;
          for (const [docId, snap] of Object.entries(nextSnap)) {
            const filtered = snap.children.filter((c) => c.entityId !== entityId && c.key !== entityId);
            if (filtered.length !== snap.children.length) {
              nextSnap[docId] = { ...snap, children: filtered };
              snapChanged = true;
            }
          }
          const nextExcl = { ...state.timelineExcludedChildrenByDocId };
          let exclChanged = false;
          for (const [docId, keys] of Object.entries(nextExcl)) {
            if (!keys.includes(entityId)) continue;
            nextExcl[docId] = keys.filter((k) => k !== entityId);
            exclChanged = true;
          }
          if (!snapChanged && !exclChanged) return state;
          return {
            timelineDocSnapshotsByDocId: snapChanged ? nextSnap : state.timelineDocSnapshotsByDocId,
            timelineExcludedChildrenByDocId: exclChanged ? nextExcl : state.timelineExcludedChildrenByDocId,
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

      enqueueTimelineDocsFromCanvasNodes: (
        canvasNodeIds,
        canvasNodes,
        nodeEntitiesById,
        docsById,
        connections = [],
      ) => {
        const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
        const familyIds = new Set();
        for (const canvasId of canvasNodeIds) {
          const node = nodeById.get(canvasId);
          if (!node) continue;
          const objectId = resolveCanvasNodeObjectId(node, docsById, nodeEntitiesById);
          if (objectId) familyIds.add(objectId);
        }
        if (familyIds.size > 1) {
          return {
            ok: false,
            code: "MULTI_FAMILY",
            message: "Insert to timeline requires nodes from a single object family.",
          };
        }

        let queue = get().timelineDocQueue;
        const focusByDocId = { ...get().timelineDocQueueFocusByDocId };
        const snapshots = { ...get().timelineDocSnapshotsByDocId };
        const touchedDocIds = new Set();
        let added = 0;
        for (const canvasId of canvasNodeIds) {
          const node = nodeById.get(canvasId);
          if (!node) continue;
          const docId = resolveParentDocIdForCanvasNode(node, nodeEntitiesById, docsById);
          if (!docId) continue;
          touchedDocIds.add(docId);
          const prevLen = queue.length;
          queue = pushDocToTimelineQueue(queue, docId);
          if (queue.length > prevLen) added += 1;
          const focusBlockId = resolveHeadlineBlockIdForCanvasNode(
            node,
            nodeEntitiesById,
            docsById,
          );
          if (focusBlockId) focusByDocId[docId] = focusBlockId;
        }

        const meta = { docsById, nodeEntitiesById };
        const { anchors: wireAnchors } = buildTacticalWireAnchorMap(canvasNodes, connections, meta);
        for (const docId of touchedDocIds) {
          snapshots[docId] = captureTimelineDocSnapshot(docId, {
            canvasNodes,
            wireAnchors,
            docsById,
            nodeEntitiesById,
          });
        }

        const excluded = { ...get().timelineExcludedChildrenByDocId };
        for (const docId of touchedDocIds) {
          excluded[docId] = [];
        }

        set({
          timelineDocQueue: queue,
          timelineDocQueueFocusByDocId: focusByDocId,
          timelineDocSnapshotsByDocId: snapshots,
          timelineExcludedChildrenByDocId: excluded,
        });
        return { ok: true, added };
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
