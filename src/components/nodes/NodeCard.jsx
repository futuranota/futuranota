import { DATA_TYPE_ICONS, DATA_TYPE_ICON_ASSETS } from "../../lib/nodeDataTypes.js";

export function NodeCard({ node, onClick, active, subtitle }) {
  const icon = DATA_TYPE_ICONS[node.dataType] || "◯";
  const iconAsset = DATA_TYPE_ICON_ASSETS[node.dataType] || null;

  return (
    <button
      type="button"
      className={"fn-card fn-node-card " + (node.dataType || "") + (active ? " active" : "")}
      onClick={onClick}
    >
      <span className="fn-card-dot node">
        {iconAsset ? <img src={iconAsset} alt="" aria-hidden className="fn-card-dot-icon" /> : icon}
      </span>
      <div className="fn-card-body">
        <b>{node.title}</b>
        {subtitle && <span className="fn-card-meta">{subtitle}</span>}
      </div>
    </button>
  );
}
