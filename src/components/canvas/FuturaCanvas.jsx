import { useRef, useState } from "react";
import { useCanvasStore, useNodesStore } from "../../stores/index.js";
import { CanvasNode } from "./CanvasNode.jsx";
import { CanvasConnection } from "./CanvasConnection.jsx";
import { extractDatesFromCanvas } from "../../lib/canvasHelpers.js";

/**
 * Canvas Zustand (Parte 3) — vista compacta de nodos en store.
 * El canvas principal de campaña sigue en `src/canvas.jsx`.
 */
export function FuturaCanvas() {
  const canvasRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const canvasNodes = useCanvasStore((s) => s.canvasNodes);
  const canvasConnections = useCanvasStore((s) => s.canvasConnections);
  const updateCanvasNodePosition = useCanvasStore((s) => s.updateCanvasNodePosition);
  const nodesStore = useNodesStore();
  const getNode = useNodesStore((s) => s.getNode);

  const dates = extractDatesFromCanvas(canvasNodes, nodesStore);

  const handleMouseDown = (nodeId, e) => {
    e.stopPropagation();
    setDragId(nodeId);
    const cn = canvasNodes[nodeId];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !cn) return;
    setOffset({
      x: e.clientX - rect.left - cn.x,
      y: e.clientY - rect.top - cn.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    updateCanvasNodePosition(
      dragId,
      e.clientX - rect.left - offset.x,
      e.clientY - rect.top - offset.y,
    );
  };

  const endDrag = () => setDragId(null);

  const visible = Object.values(canvasNodes).filter((n) => !n.hidden);

  return (
    <div className="fn-canvas-wrap">
      <div className="fn-canvas-meta">
        <span>{visible.length} nodos en store</span>
        {dates.length > 0 && <span> · {dates.length} fechas</span>}
      </div>
      <div
        ref={canvasRef}
        className="fn-blueprint-canvas"
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <svg className="fn-canvas-connections" aria-hidden>
          {Object.values(canvasConnections).map((conn) => (
            <CanvasConnection
              key={conn.id}
              connection={conn}
              fromNode={canvasNodes[conn.fromCanvasNodeId || conn.from]}
              toNode={canvasNodes[conn.toCanvasNodeId || conn.to]}
            />
          ))}
        </svg>
        <div className="fn-canvas-nodes-layer">
          {visible.map((cn) => (
            <CanvasNode
              key={cn.id}
              node={cn}
              data={cn.nodeId ? getNode(cn.nodeId) : null}
              onMouseDown={(e) => handleMouseDown(cn.id, e)}
            />
          ))}
        </div>
        {visible.length === 0 && (
          <p className="fn-canvas-empty">Usa «Canvas» en un nodo del folder para añadirlo aquí.</p>
        )}
      </div>
    </div>
  );
}
