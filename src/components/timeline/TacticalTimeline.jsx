import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { daysBetween, fmtDate } from "../../data.jsx";
import { buildChipDisplay, startOfCalendarDay } from "../../temporal.js";
import { buildTacticalObjectRows, resolveDaysLeftCenterPct } from "../../lib/tacticalTimelineView.js";
import { resolveParentTagFamilyStyle } from "../../lib/objectColors.js";
import { resolvePrimaryTimelineObjectId } from "../../lib/timelinePrimary.js";
import { useTacticalRangeDrag } from "../../hooks/useTacticalRangeDrag.js";
import { useTranslatedText } from "../../hooks/useTranslatedText.js";
import { useI18n } from "../../i18n/useI18n.js";
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

function resolveAnchorStatus(groupDate, today) {
  const d = startOfCalendarDay(groupDate);
  const t = startOfCalendarDay(today);
  if (d.getTime() < t.getTime()) return "past";
  if (d.getTime() === t.getTime()) return "active";
  return "future";
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
  enableRangeHandles = false,
  rangeDrag = null,
  t,
}) {
  const plotRef = useRef(null);
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
  const daysLeftCenterPct = resolveDaysLeftCenterPct(nodeGroups);
  const pluralS = (n) => (n === 1 ? "" : "s");
  const objectNameLabel = useTranslatedText(row.objectName);

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
        <span className="tl-tactical-object-name" title={objectNameLabel}>
          {isChildRow ? `↳ ${objectNameLabel}` : objectNameLabel}
        </span>
        <span className="tl-tactical-row__meta">
          {t("timeline.events", { count: markerCount, s: pluralS(markerCount) })}
          {row.isPrimary ? t("timeline.primary") : ""}
          {row.isInheritLayer ? t("timeline.inherit") : ""}
        </span>
      </div>

      <div className="tl-tactical-row__track">
        {nodeGroups.length === 0 ? (
          <span className="tl-tactical-row__empty mute">{t("timeline.noDatedEvents")}</span>
        ) : (
          <div className={"tl-tactical-rail" + (rangeDrag?.isDragging ? " is-dragging-range" : "")}>
            <div className="tl-tactical-rail__inset">
            <div className="tl-tactical-rail__plot" ref={plotRef}>
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
                  className={
                    "tl-tactical-range-window"
                    + (segment.isDocDimension || segment.isRowEndpointSpan ? " is-doc-dimension" : "")
                    + (segment.isRowEndpointSpan ? " is-row-endpoint-span" : "")
                  }
                  style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
                  title={segment.label || undefined}
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
              {daysLeft > 0 && nodeGroups.length > 0 && (
                <div
                  className="tl-tactical-rail__remaining"
                  style={{ left: `${daysLeftCenterPct}%` }}
                >
                  {t("timeline.daysLeft", { count: daysLeft, s: pluralS(daysLeft) })}
                </div>
              )}
            </div>
            <div className="tl-tactical-rail__anchors">
              {nodeGroups.map((group, groupIndex) => {
                const anchorAlign = resolveNodeAnchorAlign(
                  group.leftPct,
                  groupIndex,
                  nodeGroups.length,
                );
                const anchorStatus = resolveAnchorStatus(group.date, today);
                const isRangeStart = enableRangeHandles && groupIndex === 0;
                const isRangeEnd = enableRangeHandles && groupIndex === nodeGroups.length - 1;
                const isRangeHandle = isRangeStart || isRangeEnd;
                const handleClass = [
                  "tl-tactical-rail__anchor",
                  `is-status-${anchorStatus}`,
                  `is-anchor-${anchorAlign}`,
                  isRangeStart ? "is-range-handle is-range-start" : "",
                  isRangeEnd ? "is-range-handle is-range-end" : "",
                ].filter(Boolean).join(" ");

                return (
                  <span
                    key={`dot-${group.columnKey}`}
                    className={handleClass}
                    style={{ left: `${group.leftPct}%` }}
                    role={isRangeHandle ? "slider" : undefined}
                    aria-label={
                      isRangeStart
                        ? t("timeline.dragStart")
                        : isRangeEnd
                          ? t("timeline.dragEnd")
                          : undefined
                    }
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(group.leftPct)}
                    tabIndex={isRangeHandle ? 0 : undefined}
                    onPointerDown={
                      isRangeStart && isRangeEnd
                        ? (e) => rangeDrag?.onRangeHandlePointerDown(
                          "both",
                          plotRef.current,
                          e,
                          { anchorDate: group.date, anchorPct: group.leftPct },
                        )
                        : isRangeStart
                          ? (e) => rangeDrag?.onRangeHandlePointerDown(
                            "start",
                            plotRef.current,
                            e,
                            { anchorDate: group.date, anchorPct: group.leftPct },
                          )
                          : isRangeEnd
                            ? (e) => rangeDrag?.onRangeHandlePointerDown(
                              "end",
                              plotRef.current,
                              e,
                              { anchorDate: group.date, anchorPct: group.leftPct },
                            )
                            : undefined
                    }
                    onDoubleClick={isRangeHandle ? rangeDrag?.onRangeHandleDoubleClick : undefined}
                  >
                    <span className="tl-tactical-rail__anchor-core" aria-hidden />
                  </span>
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
                <motion.div
                  key={group.columnKey}
                  className={`tl-tactical-node-group is-anchor-${anchorAlign}`}
                  style={{ left: `${group.leftPct}%` }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: groupIndex * 0.12 }}
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
                </motion.div>
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
  const tacticalRangeOverride = useTimelineStore((s) => s.tacticalRangeOverride);
  const { t, locale } = useI18n();
  const pluralS = (n) => (n === 1 ? "" : "s");
  const familySuffix = (n) => {
    if (locale === "es") return n === 1 ? "ia" : "ias";
    return n === 1 ? "y" : "ies";
  };

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
      rangeOverride: tacticalRangeOverride,
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
      tacticalRangeOverride,
    ],
  );

  const { displayRows, trackItemsById, grid } = view;
  const rangeDrag = useTacticalRangeDrag(grid);
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
              <b>{t("timeline.title")}</b>
              <span>
                {t("timeline.families", { count: objectRowCount, suffix: familySuffix(objectRowCount) })}
                {" · "}
                {t("timeline.docs", { count: timelineDocQueue.length, s: pluralS(timelineDocQueue.length) })}
                {grid?.spanDays ? ` · ${t("timeline.span", { days: grid.spanDays })}` : ""}
              </span>
            </span>
            <label
              className="tl-alerts-toggle"
              data-on={timelineAlertsEnabled ? "1" : "0"}
              title={t("timeline.alertsTitle")}
            >
              <input
                type="checkbox"
                checked={timelineAlertsEnabled}
                onChange={(e) => setTimelineAlertsEnabled(e.target.checked)}
              />
              <span>{t("timeline.alerts")}</span>
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
                enableRangeHandles={
                  row.rowKind === "object" && (row.rail?.nodeGroups?.length ?? 0) > 0
                }
                rangeDrag={rangeDrag}
                t={t}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="tl-empty-hint">{t("timeline.emptyHint")}</p>
      )}
    </div>
  );
}
