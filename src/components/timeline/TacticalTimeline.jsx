import { useMemo } from "react";
import { daysBetween, fmtDate } from "../../data.jsx";
import { buildChipDisplay, startOfCalendarDay } from "../../temporal.js";
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

function resolveNodeAnchorAlign() {
  return "center";
}

function TacticalObjectRow({
  row,
  today,
  grid,
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
  const { nodeGroups = [], segments = [] } = row.rail || {};
  const chainNodes = row.chain
    ? row.chain.nodeIds.map((id) => trackItemsById.get(id)).filter(Boolean)
    : [];
  const chainConnections = row.chain
    ? connections.filter(
      (c) => row.chain.nodeIds.includes(c.from) && row.chain.nodeIds.includes(c.to),
    )
    : [];
  const chipExtras = { today, trackNodes: chainNodes, trackConnections: chainConnections };
  const markerCount = nodeGroups.reduce((acc, g) => acc + g.items.length, 0);
  const lastGroupDate = nodeGroups.length ? nodeGroups[nodeGroups.length - 1].date : null;
  const lastDay = lastGroupDate ? startOfCalendarDay(lastGroupDate) : null;
  const todayDay = startOfCalendarDay(today);
  const daysLeft = lastDay && lastDay.getTime() > todayDay.getTime()
    ? daysBetween(today, lastGroupDate)
    : 0;
  const futureMidPct = grid
    ? grid.todayPct + (100 - grid.todayPct) / 2
    : 50;

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
        {nodeGroups.length === 0 ? (
          <span className="tl-tactical-row__empty mute">No dated events</span>
        ) : (
          <div className="tl-tactical-rail">
            <div className="tl-tactical-rail__inset">
            <div className="tl-tactical-rail__plot">
            <div className="tl-tactical-bar">
              <div className="tl-tactical-ruler" aria-hidden>
                {(grid?.ticks || []).map((tick, i) => (
                  <span
                    key={i}
                    className={"tl-tactical-ruler__tick" + (tick.major ? " is-major" : "")}
                    style={{ left: `${tick.leftPct}%` }}
                  />
                ))}
              </div>
              {grid && today >= grid.start && today <= grid.end && (
                <div
                  className="tl-tactical-rail__past"
                  style={{ width: `${grid.todayPct}%` }}
                  aria-hidden
                />
              )}
              <div className="tl-tactical-rail__axis" aria-hidden />
              {segments.map((segment) => (
                <div
                  key={`range-${segment.key}`}
                  className="tl-tactical-range-window"
                  style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
                  aria-hidden
                />
              ))}
              {segments.map((segment) => (
                <div
                  key={segment.key}
                  className="tl-tactical-segment"
                  style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
                >
                  <span className="tl-tactical-segment__edge" aria-hidden />
                </div>
              ))}
              {grid && today >= grid.start && today <= grid.end && (
                <div
                  className="tl-tactical-rail__today"
                  style={{ left: `${grid.todayPct}%` }}
                >
                  <div className="tl-tactical-rail__today-head">
                    <span className="tl-tactical-rail__today-date">{fmtDate(today, "short")}</span>
                  </div>
                  <span className="tl-tactical-rail__today-line" aria-hidden />
                </div>
              )}
              {daysLeft > 0 && grid && segments.length > 0 && (
                <div
                  className="tl-tactical-rail__remaining"
                  style={{ left: `${futureMidPct}%` }}
                >
                  {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                </div>
              )}
            </div>
            <div className="tl-tactical-rail__anchors" aria-hidden>
              {nodeGroups.map((group, groupIndex) => {
                const anchorAlign = resolveNodeAnchorAlign(
                  group.leftPct,
                  groupIndex,
                  nodeGroups.length,
                );
                return (
                  <span
                    key={`dot-${group.columnKey}`}
                    className={`tl-tactical-rail__anchor is-anchor-${anchorAlign}`}
                    style={{ left: `${group.leftPct}%` }}
                  />
                );
              })}
            </div>
            <div className="tl-tactical-rail__nodes">
              {nodeGroups.map((group, groupIndex) => {
                const anchorAlign = resolveNodeAnchorAlign(
                  group.leftPct,
                  groupIndex,
                  nodeGroups.length,
                );
                return (
                <div
                  key={group.columnKey}
                  className={`tl-tactical-node-group is-anchor-${anchorAlign}`}
                  style={{ left: `${group.leftPct}%` }}
                >
                  <div
                    className="tl-tactical-node-group__stack"
                    style={{ "--tl-stack-count": group.items.length }}
                  >
                    {group.items.map((marker) => {
                      const item = trackItemsById.get(marker.nodeId);
                      const display = item
                        ? buildChipDisplay(item, trackObject, meta, chipExtras)
                        : {
                          name: (docsById[marker.docId]?.title || "Document").trim(),
                          dateLabel: fmtDate(marker.date, "short"),
                          objectTint: accent,
                        };
                      const chipName = marker.dataType && marker.dataType !== "document"
                        ? `${display.name} · ${marker.dataType}`
                        : display.name;

                      return (
                        <TimelineEventChip
                          key={marker.nodeId}
                          variant="card"
                          compact
                          name={chipName}
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
                  <time
                    className="tl-tactical-node-group__date"
                    dateTime={group.date.toISOString()}
                  >
                    {fmtDate(group.date, "short")}
                  </time>
                </div>
                );
              })}
            </div>
            </div>
            </div>
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

  const { displayRows, trackItemsById, grid } = view;
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
              {grid?.spanDays ? ` · ${grid.spanDays}d span` : ""}
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
                grid={grid}
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
