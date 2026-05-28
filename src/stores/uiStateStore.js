import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useUIStateStore = create(
  devtools(
    (set) => ({
      expandedFolder: null,
      expandedObjectId: null,
      expandedDocId: null,
      expandedNodeId: null,

      /** Sidebar: filter documents by parent object */
      filterObjectId: null,
      /** Sidebar: filter nodes by parent document */
      filterDocId: null,

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

      setExpandedFolder: (folder) => set({ expandedFolder: folder }),
      setExpandedObject: (id) => set({ expandedObjectId: id }),
      setExpandedDoc: (id) => set({ expandedDocId: id }),
      setExpandedNode: (id) => set({ expandedNodeId: id }),

      setFilterObjectId: (id) => set({ filterObjectId: id }),
      setFilterDocId: (id) => set({ filterDocId: id }),

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
        set({
          intelSearchStatus: "success",
          intelSearchError: null,
          intelSearchResult: result,
          intelSearchMeta: {
            query: result.query,
            queryNodeEntityId: result.queryNodeEntityId ?? null,
          },
        }),

      setIntelSearchError: (message) =>
        set({
          intelSearchStatus: "error",
          intelSearchError: message || "Search failed",
        }),

      clearIntelSearch: () =>
        set({
          intelSearchStatus: "idle",
          intelSearchError: null,
          intelSearchResult: null,
          intelSearchMeta: null,
        }),
    }),
    { name: "UIStateStore" },
  ),
);
