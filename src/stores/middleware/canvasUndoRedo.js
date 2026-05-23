import { useCanvasStore } from "../canvasStore.js";

const MAX_HISTORY = 40;
let past = [];
let future = [];

function snapshot() {
  const { canvasNodes, canvasConnections } = useCanvasStore.getState();
  return {
    canvasNodes: JSON.parse(JSON.stringify(canvasNodes)),
    canvasConnections: JSON.parse(JSON.stringify(canvasConnections)),
  };
}

export function pushCanvasHistory() {
  past.push(snapshot());
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
}

export function undoCanvas() {
  if (!past.length) return false;
  future.push(snapshot());
  const prev = past.pop();
  useCanvasStore.setState({
    canvasNodes: prev.canvasNodes,
    canvasConnections: prev.canvasConnections,
  });
  return true;
}

export function redoCanvas() {
  if (!future.length) return false;
  past.push(snapshot());
  const next = future.pop();
  useCanvasStore.setState({
    canvasNodes: next.canvasNodes,
    canvasConnections: next.canvasConnections,
  });
  return true;
}

export function canUndoCanvas() {
  return past.length > 0;
}

export function canRedoCanvas() {
  return future.length > 0;
}

export function initCanvasUndoRedo() {
  useCanvasStore.subscribe((state, prev) => {
    if (state.canvasNodes === prev.canvasNodes && state.canvasConnections === prev.canvasConnections) {
      return;
    }
    pushCanvasHistory();
  });
}
