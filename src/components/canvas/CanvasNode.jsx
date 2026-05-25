import { useState } from "react";
import { useCanvasStore } from "../../stores/canvasStore.js";
import { DATA_TYPE_ICONS } from "../../lib/nodeDataTypes.js";
import { NodeSearchModal } from "../nodes/NodeSearchModal.jsx";

export function CanvasNode({ node, data, onMouseDown }) {
  const toggleSelection = useCanvasStore((s) => s.toggleCanvasNodeSelection);
  const [showSearch, setShowSearch] = useState(false);

  const title = data?.title || node.title || "NOTE";
  const dataType = data?.dataType || node.dataType || "text";
  const icon = DATA_TYPE_ICONS[dataType] || "◯";
  const linkedNodeId = node.nodeId || null;

  return (
    <>
      <div
        className={"fn-canvas-node" + (node.selected ? " selected" : "")}
        style={{ left: `${node.x}px`, top: `${node.y}px` }}
        onMouseDown={onMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          toggleSelection(node.id);
        }}
        role="button"
        tabIndex={0}
      >
        <span className="fn-canvas-node-icon" aria-hidden>{icon}</span>
        <span className="fn-canvas-node-title">{title}</span>
        {linkedNodeId && (
          <button
            type="button"
            className="fn-canvas-node-search"
            title="Buscar con AI"
            onClick={(e) => {
              e.stopPropagation();
              setShowSearch(true);
            }}
          >
            ⌕
          </button>
        )}
        <span className="fn-canvas-node-port" title="Salida">●</span>
      </div>

      {showSearch && linkedNodeId && (
        <NodeSearchModal
          nodeId={linkedNodeId}
          onClose={() => setShowSearch(false)}
        />
      )}
    </>
  );
}
