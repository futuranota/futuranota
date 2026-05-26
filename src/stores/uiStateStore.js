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
    }),
    { name: "UIStateStore" },
  ),
);
