import { create } from "zustand";
import { devtools } from "zustand/middleware";

const LEFT_PANEL_NAV_KEY = "futura-nota-left-panel-v1";
const FOLDER_DENSITY_KEY = "futura-nota-folder-density-v1";

/** @typedef {'comfortable' | 'compact'} FolderDensity */

/** @returns {FolderDensity} */
function readFolderDensity() {
  try {
    const raw = localStorage.getItem(FOLDER_DENSITY_KEY);
    if (raw === "compact" || raw === "comfortable") return raw;
  } catch {
    // private mode / quota
  }
  return "comfortable";
}

/** @param {FolderDensity} density */
function writeFolderDensity(density) {
  try {
    localStorage.setItem(FOLDER_DENSITY_KEY, density);
  } catch {
    // private mode / quota
  }
}

/**
 * @typedef {{
 *   panelType?: string,
 *   objectWorkspaceActive?: boolean,
 *   filterObjectId?: string|null,
 *   selectedObjectId?: string|null,
 *   clickFolderView?: string|null,
 *   departmentFilterId?: string,
 *   departmentCategoryFilter?: string,
 *   categoryByDepartmentId?: Record<string, string>,
 *   folderSearchQuery?: string,
 * }} LeftPanelNavSnapshot
 */

/** @returns {LeftPanelNavSnapshot|null} */
export function readLeftPanelNavSnapshot() {
  try {
    const raw = localStorage.getItem(LEFT_PANEL_NAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {LeftPanelNavSnapshot} snapshot */
export function writeLeftPanelNavSnapshot(snapshot) {
  try {
    localStorage.setItem(LEFT_PANEL_NAV_KEY, JSON.stringify(snapshot || {}));
  } catch {
    // private mode / quota
  }
}

export function clearLeftPanelNavSnapshot() {
  try {
    localStorage.removeItem(LEFT_PANEL_NAV_KEY);
  } catch {
    // private mode / quota
  }
}

export const useUIStateStore = create(
  devtools(
    (set) => ({
      expandedFolder: null,
      expandedObjectId: null,
      expandedDocId: null,
      expandedNodeId: null,

      /** Sidebar: filter documents by parent object */
      filterObjectId: null,
      /** Sidebar: selected object (corpus) for meta bar */
      selectedObjectId: null,
      /** True while left panel is inside a company Documents workspace (not companies list). */
      objectWorkspaceActive: false,
      /** Click-folder inside the company workspace: null = outer cards, "subgroups" = Documents. */
      clickFolderView: null,
      /** Sidebar: filter nodes by parent document */
      filterDocId: null,
      /** Documents panel: Knowledge folder is open (disables canvas timeline Select). */
      knowledgeFolderActive: false,
      /** Products list: filter by product category (partial match). */
      productCategoryFilter: null,
      /** Content list: filter by linked subcategory label (partial match). */
      contentProductFilter: null,
      /** Content/Folder list density: comfortable = 1 col (max), compact = 2 cols. */
      folderDensity: readFolderDensity(),

      /**
       * True after first local or remote workspace paint.
       * Prevents "No companies yet" flash while Supabase hydrate is in flight.
       */
      workspaceHydrated: false,
      setWorkspaceHydrated: (value) => set({ workspaceHydrated: Boolean(value) }),

      focusedCanvasNodeId: null,
      selectedCanvasNodeIds: [],
      isDrawingConnection: false,
      connectionFrom: null,

      activeModal: null,
      modalData: null,

      toast: null,

      /** Live query/title from open node modal (editable query input). */
      activeNodeQueryDraft: "",
      /** Last query pushed from node modal Search action. */
      intelSearchSeed: "",
      intelSearchRequest: 0,

      /** Canvas snapshot for upstream wire resolution during intel search. */
      canvasSearchSnapshot: null,

      /** idle | loading | success | error */
      intelSearchStatus: "idle",
      intelSearchError: null,
      intelSearchResult: null,

      /** Active search meta while loading or for last run */
      intelSearchMeta: null,

      /** Intel overview LLM selection (groq-llama-70b, groq-llama-8b) */
      intelSelectedModelId: "groq-llama-70b",

      /** Groq/provider rate limit cooldown (ms timestamp + total duration). */
      intelRateLimitUntil: null,
      intelRateLimitTotalSec: 90,

      /** Live doc meta while document overlay is open (syncs MetaBar). */
      activeDocMetaDraft: null,

      /** Tactical timeline bottom sheet: peek (default) | expanded */
      timelineSheet: "peek",
      timelineAlertsOpen: false,

      /** In-memory doc editor drafts (session only, keyed by docId). */
      docEditorDrafts: {},

      setExpandedFolder: (folder) => set({ expandedFolder: folder }),
      setExpandedObject: (id) => set({ expandedObjectId: id }),
      setExpandedDoc: (id) => set({ expandedDocId: id }),
      setExpandedNode: (id) => set({ expandedNodeId: id }),

      setFilterObjectId: (id) => set({ filterObjectId: id }),
      setSelectedObjectId: (id) => set({ selectedObjectId: id }),
      setObjectWorkspaceActive: (active) => set({ objectWorkspaceActive: Boolean(active) }),
      setClickFolderView: (view) => set({
        clickFolderView: view == null ? null : String(view),
      }),
      setFilterDocId: (id) => set({ filterDocId: id }),
      setKnowledgeFolderActive: (active) => set({ knowledgeFolderActive: Boolean(active) }),
      setProductCategoryFilter: (query) => set({
        productCategoryFilter: query?.trim() ? query.trim() : null,
      }),
      setContentProductFilter: (query) => set({
        contentProductFilter: query?.trim() ? query.trim() : null,
      }),

      setFolderDensity: (density) => {
        const next = density === "compact" ? "compact" : "comfortable";
        writeFolderDensity(next);
        set({ folderDensity: next });
      },
      densifyFolderList: () => {
        writeFolderDensity("compact");
        set({ folderDensity: "compact" });
      },
      expandFolderList: () => {
        writeFolderDensity("comfortable");
        set({ folderDensity: "comfortable" });
      },

      setFocusedCanvasNode: (id) => set({ focusedCanvasNodeId: id }),

      toggleCanvasNodeSelection: (id) =>
        set((state) => {
          const isSelected = state.selectedCanvasNodeIds.includes(id);
          return {
            selectedCanvasNodeIds: isSelected
              ? state.selectedCanvasNodeIds.filter((nid) => nid !== id)
              : [...state.selectedCanvasNodeIds, id],
          };
        }),

      selectMultipleCanvasNodes: (ids) => set({ selectedCanvasNodeIds: ids }),

      clearCanvasSelection: () => set({ selectedCanvasNodeIds: [] }),

      startDrawingConnection: (canvasNodeId) =>
        set({
          isDrawingConnection: true,
          connectionFrom: { canvasNodeId, portType: "output" },
        }),

      endDrawingConnection: () =>
        set({
          isDrawingConnection: false,
          connectionFrom: null,
        }),

      openModal: (modalName, data = null) => set({ activeModal: modalName, modalData: data }),

      closeModal: () => set({ activeModal: null, modalData: null }),

      showToast: (message, type = "info", duration = 3000) => {
        set({ toast: { message, type } });
        setTimeout(() => {
          set({ toast: null });
        }, duration);
      },

      setActiveNodeQueryDraft: (query) => set({ activeNodeQueryDraft: query || "" }),
      triggerIntelSearchFromNode: (query) =>
        set((state) => ({
          intelSearchSeed: query || "",
          intelSearchRequest: state.intelSearchRequest + 1,
        })),

      setCanvasSearchSnapshot: (snapshot) =>
        set({ canvasSearchSnapshot: snapshot }),

      setIntelSearchLoading: (meta) =>
        set({
          intelSearchStatus: "loading",
          intelSearchError: null,
          intelSearchMeta: meta,
        }),

      setIntelSearchSuccess: (result) =>
        set((state) => ({
          intelSearchStatus: "success",
          intelSearchError: null,
          intelSearchResult: result,
          intelSearchMeta: {
            ...state.intelSearchMeta,
            query: result.query,
            queryNodeEntityId:
              result.queryNodeEntityId
              ?? state.intelSearchMeta?.queryNodeEntityId
              ?? null,
            queryCanvasNodeId:
              result.queryCanvasNodeId
              ?? state.intelSearchMeta?.queryCanvasNodeId
              ?? null,
            docId: result.docId ?? state.intelSearchMeta?.docId ?? null,
            blockIndex: result.blockIndex ?? state.intelSearchMeta?.blockIndex ?? null,
          },
        })),

      setIntelSearchError: (message) =>
        set({
          intelSearchStatus: "error",
          intelSearchError: message || "Search failed",
        }),

      setIntelSelectedModelId: (modelId) =>
        set({ intelSelectedModelId: modelId || "groq-llama-70b" }),

      startIntelRateLimitCooldown: (seconds = 90) => {
        const total = Math.max(5, Math.ceil(Number(seconds) || 90));
        set({
          intelRateLimitTotalSec: total,
          intelRateLimitUntil: Date.now() + total * 1000,
        });
      },

      clearIntelRateLimitCooldown: () =>
        set({ intelRateLimitUntil: null }),

      clearIntelSearch: () =>
        set({
          intelSearchStatus: "idle",
          intelSearchError: null,
          intelSearchResult: null,
          intelSearchMeta: null,
        }),

      /** After saving intel notes to a newly created node, keep meta in sync. */
      patchIntelSearchNodeId: (nodeId) =>
        set((state) => {
          if (!nodeId || !state.intelSearchMeta) return state;
          return {
            intelSearchMeta: {
              ...state.intelSearchMeta,
              queryNodeEntityId: nodeId,
            },
          };
        }),

      /** One-shot request for LeftPanel to switch folder after intel note save. */
      leftPanelNavigateRequest: null,
      requestLeftPanelNavigate: (payload) =>
        set({ leftPanelNavigateRequest: { ...payload, ts: Date.now() } }),
      clearLeftPanelNavigateRequest: () => set({ leftPanelNavigateRequest: null }),

      /** One-shot: enter company document workspace (e.g. after company selector). */
      requestEnterWorkspaceId: null,
      requestEnterObjectWorkspace: (objectId) =>
        set({ requestEnterWorkspaceId: objectId || null }),
      clearRequestEnterObjectWorkspace: () => set({ requestEnterWorkspaceId: null }),

      /**
       * In-doc document to-do → App find-or-opens LazyTodoDashboardOverlay.
       * @type {{ objectId: string, documentId?: string|null, listTitle?: string|null, nonce: number }|null}
       */
      lazyTodoCreateRequest: null,
      requestCreateLazyTodo: ({ objectId, documentId = null, listTitle = null } = {}) => {
        if (!objectId) return;
        set({
          lazyTodoCreateRequest: {
            objectId,
            documentId: documentId || null,
            listTitle: listTitle || null,
            nonce: Date.now(),
          },
        });
      },
      clearLazyTodoCreateRequest: () => set({ lazyTodoCreateRequest: null }),

      setActiveDocMetaDraft: (draft) => set({ activeDocMetaDraft: draft }),
      clearActiveDocMetaDraft: () => set({ activeDocMetaDraft: null }),

      setTimelineSheet: (mode) => set({
        timelineSheet: mode === "expanded" ? "expanded" : "peek",
      }),
      toggleTimelineSheet: () => set((state) => ({
        timelineSheet: state.timelineSheet === "expanded" ? "peek" : "expanded",
      })),
      openTimelineAlerts: () => set({ timelineAlertsOpen: true }),
      closeTimelineAlerts: () => set({ timelineAlertsOpen: false }),

      setDocEditorDraft: (docId, draft) => {
        if (!docId || !draft) return;
        set((state) => ({
          docEditorDrafts: {
            ...state.docEditorDrafts,
            [docId]: draft,
          },
        }));
      },

      clearDocEditorDraft: (docId) => {
        if (!docId) return;
        set((state) => {
          if (!state.docEditorDrafts[docId]) return state;
          const next = { ...state.docEditorDrafts };
          delete next[docId];
          return { docEditorDrafts: next };
        });
      },
    }),
    { name: "UIStateStore" },
  ),
);
