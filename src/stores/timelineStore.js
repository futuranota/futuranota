import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import {
  captureTimelineDateSnapshot,
  isTimelineDateCanvasNode,
  resolveTimelineDateNodeDate,
} from "../lib/campaignTimelineRail.js";
import {
  pushDocToTimelineQueue,
  resolveHeadlineBlockIdForCanvasNode,
  resolveParentDocIdForCanvasNode,
} from "../lib/timelineSelection.js";
import {
  captureTimelineDocSnapshot,
  resolveQueuedDocTimelineDate,
} from "../lib/timelineDocSnapshot.js";
import { buildTacticalWireAnchorMap } from "../lib/timelineAnchors.js";
import { captureTimelineAgentSetsForInsert } from "../lib/agents/captureTimelineAgentSets.js";
import {
  CAMPAIGN_DOC_STATUS_ACTIVE,
  canSetCampaignTimelineSource,
  replaceCampaignFoldersInTimelineQueue,
  syncCampaignFolderLaunchDateQueue,
} from "../lib/campaignDocSource.js";
import { buildTimelineGuestLinksFromConnections } from "../lib/timelineGuestLinks.js";
import { useDocsStore } from "./docsStore.js";
import { useNodesStore } from "./nodesStore.js";

/** Drop persisted guest links that reference any of the given doc ids. */
function pruneGuestLinksByDocIds(linksById, docIds) {
  const drop = new Set((docIds || []).filter(Boolean));
  if (!drop.size) return linksById || {};
  const next = {};
  for (const [id, link] of Object.entries(linksById || {})) {
    if (drop.has(link?.hostDocId) || drop.has(link?.guestDocId)) continue;
    next[id] = link;
  }
  return next;
}

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
      /** Opt-in: floating minute reminder when a folder/macro start is inside its lead window. */
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
      /** Scheduled agent triggers pinned to timeline (Set / Ready chips). */
      timelineAgentSets: [],
      /** Canvas date/launch node ids manually inserted as rail time markers. */
      timelineDateNodeIds: [],
      /** Persisted date/Launch payloads — survive canvas delete until × or switch. */
      timelineDateSnapshotsById: {},
      /** Host→guest folder links captured at Insert — survive canvas wire/chip delete. */
      timelineGuestLinksById: {},
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
      /**
       * Pair stretches persist per row + focus node (targetPct on that rail only).
       * Never pans the shared folder window. [{ rowId, focusMs, pairNextMs, targetPct }]
       */
      tacticalLoupe: null,
      tacticalPairStretches: [],

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
        timelineAgentSets: [],
        timelineDateNodeIds: [],
        timelineDateSnapshotsById: {},
        timelineGuestLinksById: {},
        tacticalRangeOverride: null,
        tacticalLoupe: null,
        tacticalPairStretches: [],
      }),

      setTacticalRangeOverride: (override) => set({ tacticalRangeOverride: override }),

      clearTacticalRangeOverride: () => set({ tacticalRangeOverride: null }),

      setTacticalLoupe: (loupe) => set({ tacticalLoupe: loupe }),

      clearTacticalLoupe: () => set({ tacticalLoupe: null }),

      setTacticalPairStretch: (stretch) => {
        if (!stretch || !stretch.rowId || !Number.isFinite(stretch.targetPct)) return;
        const isToday = stretch.focusKey === "today";
        if (!isToday && stretch.focusMs == null) return;
        set((state) => {
          const rowId = String(stretch.rowId);
          const focusKey = isToday ? "today" : null;
          const focusMs = isToday ? null : Number(stretch.focusMs);
          const pairNextMs = stretch.pairNextMs != null ? Number(stretch.pairNextMs) : null;
          const pairPrevMs = stretch.pairPrevMs != null ? Number(stretch.pairPrevMs) : null;
          const targetPct = Math.min(100, Math.max(0, Number(stretch.targetPct)));
          const rest = (state.tacticalPairStretches || []).filter((s) => {
            if (String(s.rowId) !== rowId) return true;
            if (isToday) return s.focusKey !== "today";
            return !(s.focusKey !== "today" && Number(s.focusMs) === focusMs);
          });
          return {
            tacticalPairStretches: [
              ...rest,
              { rowId, focusKey, focusMs, pairNextMs, pairPrevMs, targetPct },
            ],
          };
        });
      },

      clearTacticalPairStretches: () => set({ tacticalPairStretches: [] }),

      clearTacticalPairStretchesForRow: (rowId) => {
        if (!rowId) return;
        set((state) => ({
          tacticalPairStretches: (state.tacticalPairStretches || []).filter(
            (s) => String(s.rowId) !== String(rowId),
          ),
        }));
      },

      clearTacticalViewOverrides: () => set({
        tacticalRangeOverride: null,
        tacticalLoupe: null,
        tacticalPairStretches: [],
      }),

      removeTimelineAgentSet: (setId) => {
        if (!setId) return;
        set((state) => ({
          timelineAgentSets: state.timelineAgentSets.filter((set) => set.id !== setId),
        }));
      },

      removeTimelineDateNode: (nodeId) => {
        if (!nodeId) return;
        set((state) => {
          const { [nodeId]: _drop, ...dateSnapRest } = state.timelineDateSnapshotsById || {};
          return {
            timelineDateNodeIds: state.timelineDateNodeIds.filter((id) => id !== nodeId),
            timelineDateSnapshotsById: dateSnapRest,
          };
        });
      },

      updateTimelineAgentSetStatus: (setId, status, error = null) => {
        if (!setId || !status) return;
        set((state) => ({
          timelineAgentSets: state.timelineAgentSets.map((set) => {
            if (set.id !== setId) return set;
            return {
              ...set,
              status,
              error: error || null,
              completedAt: status === "ready" || status === "failed"
                ? Date.now()
                : set.completedAt,
            };
          }),
        }));
      },

      removeTimelineDocFromQueue: (docId) => {
        if (!docId) return;
        set((state) => {
          const { [docId]: _removed, ...focusRest } = state.timelineDocQueueFocusByDocId;
          const { [docId]: _snap, ...snapRest } = state.timelineDocSnapshotsByDocId;
          const { [docId]: _excl, ...exclRest } = state.timelineExcludedChildrenByDocId;
          const dateSnaps = state.timelineDateSnapshotsById || {};
          const dropDateIds = new Set(
            Object.entries(dateSnaps)
              .filter(([, snap]) => snap?.parentDocId === docId)
              .map(([id]) => id),
          );
          const nextDateSnaps = Object.fromEntries(
            Object.entries(dateSnaps).filter(([id]) => !dropDateIds.has(id)),
          );
          return {
            timelineDocQueue: state.timelineDocQueue.filter((id) => id !== docId),
            timelineDocQueueFocusByDocId: focusRest,
            timelineDocSnapshotsByDocId: snapRest,
            timelineExcludedChildrenByDocId: exclRest,
            timelineAgentSets: state.timelineAgentSets.filter((set) => set.docId !== docId),
            expandedDocIds: state.expandedDocIds.filter((id) => id !== docId),
            timelineDateNodeIds: state.timelineDateNodeIds.filter((id) => !dropDateIds.has(id)),
            timelineDateSnapshotsById: nextDateSnaps,
            timelineGuestLinksById: pruneGuestLinksByDocIds(
              state.timelineGuestLinksById,
              [docId],
            ),
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

      /**
       * Hard-delete / left-panel delete: strip entity from every folder snapshot and
       * exclude the key (same as timeline chip ×) so it cannot reappear on the rail.
       */
      removeTimelineEntityFromSnapshots: (entityId, parentDocId = null) => {
        if (!entityId) return;
        set((state) => {
          const nextSnap = { ...state.timelineDocSnapshotsByDocId };
          const nextExcl = { ...state.timelineExcludedChildrenByDocId };
          let snapChanged = false;
          let exclChanged = false;

          const excludeOnDoc = (docId) => {
            if (!docId) return;
            const prev = nextExcl[docId] || [];
            if (prev.includes(entityId)) return;
            nextExcl[docId] = [...prev, entityId];
            exclChanged = true;
          };

          if (parentDocId) excludeOnDoc(parentDocId);

          for (const [docId, snap] of Object.entries(nextSnap)) {
            const children = snap?.children || [];
            const filtered = children.filter(
              (c) => c.entityId !== entityId && c.key !== entityId,
            );
            if (filtered.length !== children.length) {
              nextSnap[docId] = { ...snap, children: filtered };
              snapChanged = true;
              excludeOnDoc(docId);
            }
          }

          if (!snapChanged && !exclChanged) return state;
          return {
            timelineDocSnapshotsByDocId: snapChanged
              ? nextSnap
              : state.timelineDocSnapshotsByDocId,
            timelineExcludedChildrenByDocId: exclChanged
              ? nextExcl
              : state.timelineExcludedChildrenByDocId,
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
            // Recompute auto zoom for the new set (don't keep a stale stretch window).
            tacticalRangeOverride: null,
            tacticalLoupe: null,
            tacticalPairStretches: [],
          };
        });
      },

      /**
       * Re-capture schedule snapshot after a content/doc save so the rail moves with Launch/Schedule.
       */
      refreshTimelineDocSnapshot: (
        docId,
        {
          canvasNodes = [],
          connections = [],
          docsById = {},
          nodeEntitiesById = {},
        } = {},
      ) => {
        if (!docId) return;
        const state = get();
        if (!state.timelineDocQueue.includes(docId) && !state.timelineDocSnapshotsByDocId[docId]) {
          return;
        }
        const meta = { docsById, nodeEntitiesById };
        const { anchors: wireAnchors } = buildTacticalWireAnchorMap(canvasNodes, connections, meta);
        const snapshot = captureTimelineDocSnapshot(docId, {
          canvasNodes,
          wireAnchors,
          docsById,
          nodeEntitiesById,
        });
        set({
          timelineDocSnapshotsByDocId: {
            ...state.timelineDocSnapshotsByDocId,
            [docId]: snapshot,
          },
        });
      },

      enqueueTimelineDocsFromCanvasNodes: (
        canvasNodeIds,
        canvasNodes,
        nodeEntitiesById,
        docsById,
        connections = [],
        objectsById = {},
      ) => {
        const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
        // Multi-family selections are allowed: each folder renders on its own
        // company timeline, and cross-company guests surface via inherit wires.

        const prevQueue = get().timelineDocQueue;
        let queue = prevQueue;
        const focusByDocId = { ...get().timelineDocQueueFocusByDocId };
        const snapshots = { ...get().timelineDocSnapshotsByDocId };
        const dateNodeIds = new Set(get().timelineDateNodeIds);
        const dateSnapshotsById = { ...(get().timelineDateSnapshotsById || {}) };
        const touchedDocIds = new Set();
        const nodesByDocId = new Map();
        let added = 0;
        let datesAdded = 0;
        let dateNodesTouched = 0;
        /** @type {string[]} Campaign folder ids inserted via a file in this batch (order preserved). */
        const campaignFoldersInserted = [];
        /** @type {string[]} */
        let removedCampaignIds = [];

        const pruneDateSnapshotsToIds = () => {
          for (const id of Object.keys(dateSnapshotsById)) {
            if (!dateNodeIds.has(id)) delete dateSnapshotsById[id];
          }
        };

        for (const canvasId of canvasNodeIds) {
          const node = nodeById.get(canvasId);
          if (!node) continue;
          // Dates are time markers on the rail — never queued as docs.
          // Select the Launch/date node → Insert pins it permanently (snapshot).
          if (isTimelineDateCanvasNode(node)) {
            const dateSnap = captureTimelineDateSnapshot(node);
            if (!dateSnap) continue;
            // Launch cannot sit before today on the rail.
            if (node.canvasKind === "launch" && !resolveTimelineDateNodeDate(node)) continue;
            dateNodesTouched += 1;
            if (!dateNodeIds.has(node.id)) {
              dateNodeIds.add(node.id);
              datesAdded += 1;
            }
            dateSnapshotsById[node.id] = dateSnap;

            // Inserting a campaign Launch can switch the folder source to that file.
            if (node.canvasKind === "launch" && node.parentDocId && node.sourceNodeId) {
              const folder = docsById[node.parentDocId];
              const entity = nodeEntitiesById[node.sourceNodeId];
              if (folder?.campaignActive && entity && canSetCampaignTimelineSource(folder, entity)) {
                useDocsStore.getState().updateDoc(folder.id, {
                  timelineSourceNodeId: entity.id,
                });
                useNodesStore.getState().updateNode(entity.id, {
                  campaignStatus: CAMPAIGN_DOC_STATUS_ACTIVE,
                  completed: false,
                });
                const synced = syncCampaignFolderLaunchDateQueue(dateNodeIds, {
                  folderDocId: folder.id,
                  sourceEntityId: entity.id,
                  canvasNodes,
                  dateSnapshotsById,
                });
                dateNodeIds.clear();
                for (const id of synced) dateNodeIds.add(id);
                pruneDateSnapshotsToIds();
                if (!campaignFoldersInserted.includes(folder.id) && queue.includes(folder.id)) {
                  campaignFoldersInserted.push(folder.id);
                }
              }
            }
            continue;
          }
          const docId = resolveParentDocIdForCanvasNode(node, nodeEntitiesById, docsById);
          if (!docId) continue;
          const folder = docsById[docId];

          touchedDocIds.add(docId);
          if (!nodesByDocId.has(docId)) nodesByDocId.set(docId, []);
          nodesByDocId.get(docId).push(canvasId);
          queue = pushDocToTimelineQueue(queue, docId);
          const focusBlockId = resolveHeadlineBlockIdForCanvasNode(
            node,
            nodeEntitiesById,
            docsById,
          );
          if (focusBlockId) focusByDocId[docId] = focusBlockId;

          // Same parent campaign folder: freshest file wins. Launch is NOT
          // auto-queued — select the Launch date node and Insert separately.
          const entityId = node.noteId || null;
          const entity = entityId ? nodeEntitiesById[entityId] : null;
          if (folder?.campaignActive && entity && canSetCampaignTimelineSource(folder, entity)) {
            useDocsStore.getState().updateDoc(docId, {
              timelineSourceNodeId: entity.id,
            });
            useNodesStore.getState().updateNode(entity.id, {
              campaignStatus: CAMPAIGN_DOC_STATUS_ACTIVE,
              completed: false,
            });
            const synced = syncCampaignFolderLaunchDateQueue(dateNodeIds, {
              folderDocId: docId,
              sourceEntityId: entity.id,
              canvasNodes,
              dateSnapshotsById,
            });
            dateNodeIds.clear();
            for (const id of synced) dateNodeIds.add(id);
            pruneDateSnapshotsToIds();
          }
          if (folder?.campaignActive && !campaignFoldersInserted.includes(docId)) {
            campaignFoldersInserted.push(docId);
          }
        }

        // Live docs after source switches (caller snapshot may be stale).
        const liveDocsById = { ...docsById, ...useDocsStore.getState().docs };

        // Campaigns: one product on the timeline at a time — new insert replaces
        // any other campaign folder already in the queue.
        if (campaignFoldersInserted.length) {
          const keepCampaignId = campaignFoldersInserted[campaignFoldersInserted.length - 1];
          for (const extraId of campaignFoldersInserted) {
            if (extraId === keepCampaignId) continue;
            touchedDocIds.delete(extraId);
            nodesByDocId.delete(extraId);
            delete focusByDocId[extraId];
            queue = queue.filter((id) => id !== extraId);
          }
          const { queue: nextQueue, removed: removedCampaigns } = replaceCampaignFoldersInTimelineQueue(
            queue,
            liveDocsById,
            keepCampaignId,
          );
          queue = nextQueue;
          removedCampaignIds = removedCampaigns;
          for (const removedId of removedCampaigns) {
            delete focusByDocId[removedId];
            delete snapshots[removedId];
          }
          // Drop launch date markers that belonged to the replaced campaign folder(s).
          if (removedCampaigns.length) {
            const removedSet = new Set(removedCampaigns);
            for (const dateId of [...dateNodeIds]) {
              const dateNode = nodeById.get(dateId)
                || canvasNodes.find((n) => n.id === dateId);
              const parentDocId = dateNode?.parentDocId
                || dateSnapshotsById[dateId]?.parentDocId;
              if (parentDocId && removedSet.has(parentDocId)) {
                dateNodeIds.delete(dateId);
                delete dateSnapshotsById[dateId];
              }
            }
          }
        }

        const prevQueueSet = new Set(prevQueue);
        added = [...touchedDocIds].filter((id) => queue.includes(id) && !prevQueueSet.has(id)).length;

        if (!touchedDocIds.size && !dateNodesTouched) {
          return {
            ok: false,
            code: "NO_DOCS",
            message: "Selected nodes are not linked to a document.",
          };
        }

        const meta = { docsById: liveDocsById, nodeEntitiesById };
        const { anchors: wireAnchors } = buildTacticalWireAnchorMap(canvasNodes, connections, meta);
        if (touchedDocIds.size) {
          // Refresh every queued doc so prior Schedule edits are not stuck on createdAt snapshots.
          const docsToSnapshot = new Set([...queue, ...touchedDocIds]);
          for (const docId of docsToSnapshot) {
            snapshots[docId] = captureTimelineDocSnapshot(docId, {
              canvasNodes,
              wireAnchors,
              docsById: liveDocsById,
              nodeEntitiesById,
              preferredCanvasNodeIds: nodesByDocId.get(docId) || [],
            });
          }

          const missingDateDocIds = [...touchedDocIds].filter((docId) => !resolveQueuedDocTimelineDate(
            docId,
            canvasNodes,
            wireAnchors,
            liveDocsById,
            meta,
            snapshots[docId],
          ));
          if (missingDateDocIds.length) {
            return {
              ok: false,
              code: "NO_ANCHOR_DATE",
              message: "Timeline needs at least one dated node or wire anchor on the selected document.",
            };
          }
        }

        const excluded = { ...get().timelineExcludedChildrenByDocId };
        for (const docId of touchedDocIds) {
          excluded[docId] = [];
        }
        for (const removedId of removedCampaignIds) {
          delete excluded[removedId];
        }

        const { sets: timelineAgentSets, added: setsAdded } = captureTimelineAgentSetsForInsert({
          canvasNodeIds,
          canvasNodes,
          connections,
          nodeEntitiesById,
          docsById,
          objectsById,
          touchedDocIds: [...touchedDocIds],
          existingSets: get().timelineAgentSets,
        });

        const removedCampaignSet = new Set(removedCampaignIds);
        const nextAgentSets = removedCampaignSet.size
          ? timelineAgentSets.filter((set) => !removedCampaignSet.has(set.docId))
          : timelineAgentSets;
        const nextExpanded = removedCampaignSet.size
          ? get().expandedDocIds.filter((id) => !removedCampaignSet.has(id))
          : get().expandedDocIds;

        pruneDateSnapshotsToIds();

        // Capture cross-family host→guest links so guest strips survive canvas delete.
        let guestLinksById = { ...(get().timelineGuestLinksById || {}) };
        if (removedCampaignIds.length) {
          guestLinksById = pruneGuestLinksByDocIds(guestLinksById, removedCampaignIds);
        }
        const capturedGuestLinks = buildTimelineGuestLinksFromConnections({
          connections,
          canvasNodes,
          docsById: liveDocsById,
          nodeEntitiesById,
          objectsById,
          touchedDocIds: [...touchedDocIds],
        });
        for (const link of capturedGuestLinks) {
          if (!link?.id) continue;
          guestLinksById[link.id] = link;
        }

        set({
          timelineDocQueue: queue,
          timelineDocQueueFocusByDocId: focusByDocId,
          timelineDocSnapshotsByDocId: snapshots,
          timelineExcludedChildrenByDocId: excluded,
          timelineAgentSets: nextAgentSets,
          timelineDateNodeIds: [...dateNodeIds],
          timelineDateSnapshotsById: dateSnapshotsById,
          timelineGuestLinksById: guestLinksById,
          expandedDocIds: nextExpanded,
          // Fresh auto zoom after insert — avoids collapsed month snap / stale stretch.
          tacticalRangeOverride: null,
          tacticalLoupe: null,
          tacticalPairStretches: [],
        });
        return {
          ok: true,
          added,
          setsAdded,
          datesAdded,
          replacedCampaigns: removedCampaignIds.length,
          refreshed: added === 0 && setsAdded === 0 && datesAdded === 0,
        };
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
