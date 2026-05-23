import { useObjectsStore } from "../../stores/objectsStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { formatDateShort } from "../../lib/dates.js";

export function TimelineEntry({ entry }) {
  const objects = useObjectsStore((s) => s.objects);
  const docs = useDocsStore((s) => s.docs);
  const nodes = useNodesStore((s) => s.nodes);

  let label = entry.itemId;
  if (entry.itemType === "object" && objects[entry.itemId]) {
    label = objects[entry.itemId].name;
  }
  if (entry.itemType === "doc" && docs[entry.itemId]) {
    label = docs[entry.itemId].title;
  }
  if (entry.itemType === "node" && nodes[entry.itemId]) {
    label = nodes[entry.itemId].title;
  }

  const dateLabel = formatDateShort(entry.date) || entry.date;

  return (
    <div className="fn-tl-entry" data-type={entry.itemType}>
      <span className="fn-tl-entry-dot" />
      <span className="fn-tl-entry-label">{label}</span>
      <span className="fn-tl-entry-date">{dateLabel}</span>
      <span className="fn-tl-entry-tier">{entry.itemType}</span>
    </div>
  );
}
