import { DATA_TYPE_ICONS } from "../../lib/nodeDataTypes.js";

export function NodeCard({ node, onClick, active, subtitle }) {
  return (
    <button
      type="button"
      className={"fn-card fn-node-card " + (node.dataType || "") + (active ? " active" : "")}
      onClick={onClick}
    >
      <span className="fn-card-dot node">{DATA_TYPE_ICONS[node.dataType] || "◯"}</span>
      <div className="fn-card-body">
        <b>{node.title}</b>
        {subtitle && <span className="fn-card-meta">{subtitle}</span>}
      </div>
    </button>
  );
}
