import { useUIStateStore } from "../stores/uiStateStore.js";
import { useCanvasStore } from "../stores/canvasStore.js";

/** Canvas + UI selection state */
export function useSelection() {
  const selectedCanvasNodeIds = useUIStateStore((s) => s.selectedCanvasNodeIds);
  const toggleCanvasNodeSelection = useUIStateStore((s) => s.toggleCanvasNodeSelection);
  const selectMultipleCanvasNodes = useUIStateStore((s) => s.selectMultipleCanvasNodes);
  const clearCanvasSelection = useUIStateStore((s) => s.clearCanvasSelection);
  const canvasSelection = useCanvasStore((s) => s.selection);

  return {
    selectedCanvasNodeIds,
    canvasSelection,
    toggle: toggleCanvasNodeSelection,
    selectMultiple: selectMultipleCanvasNodes,
    clear: clearCanvasSelection,
    isSelected: (id) => selectedCanvasNodeIds.includes(id),
  };
}
