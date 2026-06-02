import { useMemo } from "react";
import { fmtDate } from "../../data.jsx";
import { buildChipDisplay } from "../../temporal.js";
import { buildTacticalObjectRows } from "../../lib/tacticalTimelineView.js";
import { resolveParentTagFamilyStyle } from "../../lib/objectColors.js";
import { resolvePrimaryTimelineObjectId } from "../../lib/timelinePrimary.js";
import { useTimelineStore } from "../../stores/index.js";
import { TimelineEventChip } from "./TimelineEventChip.jsx";

function resolveFamilyAccent(objectId, objectsById, fallbackColor) {
  const family = resolveParentTagFamilyStyle(objectId, objectsById);
  if (family?.kindStyle?.color) return family.kindStyle.color;
  return fallbackColor || "var(--hud)";
}

function TacticalObjectRow({
  row,
  today,
  trackItemsById,
  docsById,
  nodeEntitiesById,
  objectsById,
  connections,
  focusedNoteId,
  onChipClick,
  onChipDoubleClick,
}) {
  const accent = row.objectColor;
  const familyAccent = resolveFamilyAccent(row.objectId, objectsById, accent);
  const meta = { nodeEntitiesById, docsById };
  const trackObject = objectsById[row.objectId] || null;
  const isChildRow = row.rowKind === "children";
  const columns = row.columns || [];
  const chainNodes = row.chain
    ? row.chain.nodeIds.map((id) => trackItemsById.get(id)).filter(Boolean)
    : [];
  const chainConnections = row.chain
    ? connections.filter(
      (c) => row.chain.nodeIds.includes(c.from) && row.chain.nodeIds.includes(c.to),
    )
    : [];
  const chipExtras = { today, trackNodes: chainNodes, trackConnections: chainConnections };
  const markerCount = columns.reduce((acc, col) => acc + col.items.length, 0);

  const rowClass = [
    "tl-tactical-row",
    row.isCorpus ? "is-corpus" : "is-satellite",
    row.isInheritLayer ? "is-inherit-layer" : "",
    isChildRow ? "is-child-row" : "",
    row.hasCrossLink ? "is-linked-row" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={rowClass}
      style={{ "--tl-accent": accent, "--tl-family-accent": familyAccent }}
    >
      <div className="tl-tactical-row__label">
        <span className="tl-tactical-object-name" title={row.objectName}>
          {isChildRow ? `↳ ${row.objectName}` : row.objectName}
        </span>
        <span className="tl-tactical-row__meta">
          {markerCount} event{markerCount === 1 ? "" : "s"}
          {row.isPrimary ? " · primary" : ""}
          {row.isInheritLayer ? " · inherit" : ""}
        </span>
      </div>

      <div className="tl-tactical-row__track">
        {columns.length === 0 ? (
          <span className="tl-tactical-row__empty mute">No dated events</span>
        ) : (
          <div className="tl-tactical-columns">
            {columns.map((column) => (
              <div key={column.columnKey} className="tl-tactical-column">
                <time className="tl-tactical-column__date" dateTime={column.date.toISOString()}>
                  {fmtDate(column.date, "short")}
                </time>
                <div
                  className="tl-tactical-column__stack"
                  style={{ "--tl-stack-count": column.items.length }}
                >
                  {column.items.map((marker) => {
                    const item = trackItemsById.get(marker.nodeId);
                    const display = item
                      ? buildChipDisplay(item, trackObject, meta, chipExtras)
                      : {
                        name: (docsById[marker.docId]?.title || "Document").trim(),
                        dateLabel: fmtDate(marker.date, "short"),
                        objectTint: accent,
                      };
                    const dateLabel = display.dateLabel || fmtDate(marker.date, "short");
                    const chipName = marker.dataType && marker.dataType !== "document"
                      ? `${display.name} · ${marker.dataType}`
                      : display.name;

                    return (
                      <TimelineEventChip
                        key={marker.nodeId}
                        variant="card"
                        name={chipName}
                        dateLabel={dateLabel}
                        familyAccent={familyAccent}
                        objectTint={display.objectTint || accent}
                        focused={focusedNoteId === (item?.noteId || marker.nodeId)}
                        onClick={() => onChipClick(marker, row)}
                        onDoubleClick={() => onChipDoubleClick(marker, row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onChipClick(marker, row);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TacticalTimeline({
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  today = new Date(),
  filterObjectId = null,
  focusedNoteId = null,
}) {
  const inheritObjMode = useTimelineStore((s) => s.inheritObjMode);
  const timelineDocQueue = useTimelineStore((s) => s.timelineDocQueue);
  const expandedDocIds = useTimelineStore((s) => s.expandedDocIds);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);
  const explicitPrimaryId = useTimelineStore((s) => s.primaryTimelineObjectId);
  const setTimelineFocus = useTimelineStore((s) => s.setTimelineFocus);
  const toggleExpandedDocId = useTimelineStore((s) => s.toggleExpandedDocId);
  const timelineAlertsEnabled = useTimelineStore((s) => s.timelineAlertsEnabled);
  const setTimelineAlertsEnabled = useTimelineStore((s) => s.setTimelineAlertsEnabled);

  const primaryTimelineObjectId = useMemo(
    () => resolvePrimaryTimelineObjectId({
      explicitId: explicitPrimaryId,
      timelineDocQueue,
      docsById,
      objectsById,
    }),
    [explicitPrimaryId, timelineDocQueue, docsById, objectsById],
  );

  const view = useMemo(
    () => buildTacticalObjectRows({
      canvasNodes,
      connections,
      docsById,
      nodeEntitiesById,
      objectsById,
      objectTimelineTitles,
      timelineDocQueue,
      expandedDocIds,
      today,
      filterObjectId,
      inheritObjMode,
      primaryTimelineObjectId,
    }),
    [
      canvasNodes,
      connections,
      docsById,
      nodeEntitiesById,
      objectsById,
      objectTimelineTitles,
      timelineDocQueue,
      expandedDocIds,
      today,
      filterObjectId,
      inheritObjMode,
      primaryTimelineObjectId,
    ],
  );

  const { displayRows, trackItemsById } = view;
  const hasQueue = timelineDocQueue.length > 0;
  const objectRowCount = displayRows.filter((r) => r.rowKind === "object").length;

  const handleChipClick = (marker, row) => {
    const docId = marker.docId || null;
    if (docId) toggleExpandedDocId(docId);
    setTimelineFocus({
      level: docId && expandedDocIds.includes(docId) ? "children" : "doc",
      objectId: row.objectId,
      docId,
      canvasNodeId: marker.virtual ? null : marker.nodeId,
    });
  };

  const handleChipDoubleClick = (marker, row) => {
    const docId = marker.docId || null;
    if (!docId) return;
    if (!expandedDocIds.includes(docId)) toggleExpandedDocId(docId);
    setTimelineFocus({
      level: "children",
      objectId: row.objectId,
      docId,
      canvasNodeId: marker.virtual ? null : marker.nodeId,
    });
  };

  return (
    <div className={"timeline stacked tl-tactical" + (hasQueue ? "" : " tl-tactical--empty")}>
      {hasQueue ? (
        <>
          <div className="tl-tactical-header">
            <span className="tl-tactical-header__title">
              <b>Timeline</b>
              {` · ${objectRowCount} famil${objectRowCount === 1 ? "y" : "ies"}`}
              {` · ${timelineDocQueue.length} doc${timelineDocQueue.length === 1 ? "" : "s"}`}
            </span>
            <label
              className="tl-alerts-toggle"
              data-on={timelineAlertsEnabled ? "1" : "0"}
              title="Show timeline alerts on canvas at T-30, T-7, and T-1 day windows"
            >
              <input
                type="checkbox"
                checked={timelineAlertsEnabled}
                onChange={(e) => setTimelineAlertsEnabled(e.target.checked)}
              />
              <span>Timeline alerts</span>
            </label>
          </div>

          <div className="tl-tactical-body">
            {displayRows.map((row) => (
              <TacticalObjectRow
                key={row.id}
                row={row}
                today={today}
                trackItemsById={trackItemsById}
                docsById={docsById}
                nodeEntitiesById={nodeEntitiesById}
                objectsById={objectsById}
                connections={connections}
                focusedNoteId={focusedNoteId}
                onChipClick={handleChipClick}
                onChipDoubleClick={handleChipDoubleClick}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="tl-empty-hint">Enable Select → pick nodes → Insert to timeline</p>
      )}
    </div>
  );
}
