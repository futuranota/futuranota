import { useCanvasStore } from "../stores/index.js";

export function useCanvas() {
  const canvasNodes = useCanvasStore((state) => state.canvasNodes);
  const canvasConnections = useCanvasStore((state) => state.canvasConnections);
  const groupings = useCanvasStore((state) => state.groupings);
  const scale = useCanvasStore((state) => state.scale);
  const panX = useCanvasStore((state) => state.panX);
  const panY = useCanvasStore((state) => state.panY);

  const addCanvasNode = useCanvasStore((state) => state.addCanvasNode);
  const updateCanvasNodePosition = useCanvasStore((state) => state.updateCanvasNodePosition);
  const toggleCanvasNodeSelection = useCanvasStore((state) => state.toggleCanvasNodeSelection);
  const addConnection = useCanvasStore((state) => state.addConnection);
  const deleteConnection = useCanvasStore((state) => state.deleteConnection);
  const createGrouping = useCanvasStore((state) => state.createGrouping);
  const setPan = useCanvasStore((state) => state.setPan);
  const setScale = useCanvasStore((state) => state.setScale);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const getCanvasNodesByNodeId = useCanvasStore((state) => state.getCanvasNodesByNodeId);

  return {
    canvasNodes,
    canvasConnections,
    groupings,
    scale,
    panX,
    panY,
    addCanvasNode,
    updateCanvasNodePosition,
    toggleCanvasNodeSelection,
    addConnection,
    deleteConnection,
    createGrouping,
    setPan,
    setScale,
    clearCanvas,
    getCanvasNodesByNodeId,
  };
}
