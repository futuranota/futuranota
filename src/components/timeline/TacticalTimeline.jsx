import { useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { daysBetween, fmtDate } from "../../data.jsx";
import { buildChipDisplay, startOfCalendarDay } from "../../temporal.js";
import {
  buildDocChildLinks,
  buildTacticalObjectRows,
  groupDisplayRowsByObject,
  resolveDaysLeftCenterPct,
} from "../../lib/tacticalTimelineView.js";
import { resolveParentTagFamilyStyle } from "../../lib/objectColors.js";
import { resolvePrimaryTimelineObjectId } from "../../lib/timelinePrimary.js";
import { resolveFocusBlockIdForTimelineMarker } from "../../lib/timelineSelection.js";
import { useTacticalRangeDrag } from "../../hooks/useTacticalRangeDrag.js";
import { useTranslatedText } from "../../hooks/useTranslatedText.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useTimelineStore } from "../../stores/index.js";
import { TimelineEventChip } from "./TimelineEventChip.jsx";
import { TimelineDocChildLinks } from "./TimelineDocChildLinks.jsx";

function resolveFamilyAccent(objectId, objectsById, fallbackColor) {
  const family = resolveParentTagFamilyStyle(objectId, objectsById);
  if (family?.kindStyle?.color) return family.kindStyle.color;
  return fallbackColor || "var(--hud)";
}

function resolveNodeAnchorAlign(leftPct, index, total) {
  if (index === 0 && leftPct < 14) return "start";
  if (index === total - 1 && leftPct > 86) return "end";
  return "center";
}

function resolveAgentSetChipLabel(marker, t) {
  const title = String(marker.setTitle || "Task").trim();
  const status = marker.setStatus || "pending";
  if (status === "ready") return t("timeline.agentSetReady", { title });
  if (status === "running") return t("timeline.agentSetRunning", { title });
  if (status === "failed") return t("timeline.agentSetFailed", { title });
  return t("timeline.agentSetPending", { title });
}

function resolveAgentSetChipClass(marker) {
  const status = marker.setStatus || "pending";
  return `is-agent-set is-status-${status}`;
}

function resolveAnchorStatus(groupDate, today) {
  const d = startOfCalendarDay(groupDate);
  const t = startOfCalendarDay(today);
  if (d.getTime() < t.getTime()) return "past";
  if (d.getTime() === t.getTime()) return "active";
  return "future";
}

function TacticalRowGroup({
  group,
  docChildLinks,
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
  onChipRemove,
  queuedDocIds,
  rangeDrag,
  t,
}) {
  const groupRef = useRef(null);
  const groupLinks = useMemo(
    () => docChildLinks.filter((link) => link.objectId === group.objectId),
    [docChildLinks, group.objectId],
  );
  const objectRow = group.rows.find((row) => row.rowKind === "object");
  const accent = objectRow?.objectColor || "var(--hud)";
  const familyAccent = resolveFamilyAccent(group.objectId, objectsById, accent);

  return (
    <div
      className="tl-tactical-row-group"
      ref={groupRef}
      style={{ "--tl-accent": accent, "--tl-family-accent": familyAccent }}
    >
      <TimelineDocChildLinks links={groupLinks} containerRef={groupRef} />
      {group.rows.map((row) => (
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
          onChipClick={onChipClick}
          onChipDoubleClick={onChipDoubleClick}
          onChipRemove={onChipRemove}
          queuedDocIds={queuedDocIds}
          enableRangeHandles={
            row.rowKind === "object" && (row.rail?.nodeGroups?.length ?? 0) > 0
          }
          rangeDrag={rangeDrag}
          t={t}
        />
      ))}
    </div>
  );
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
  onChipRemove,
  queuedDocIds,
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
                    data-tl-anchor={`dot-${row.id}-${group.columnKey}`}
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
                      const entity = marker.entityId
                        ? nodeEntitiesById[marker.entityId]
                        : null;
                      const isAgentSet = marker.dataType === "agent-set";
                      const fallbackName = marker.dataType && marker.dataType !== "document"
                        ? (entity?.title || entity?.name || marker.dataType).trim()
                        : (docsById[marker.docId]?.title || "Document").trim();
                      const display = item
                        ? buildChipDisplay(item, trackObject, meta, chipExtras)
                        : {
                          name: fallbackName,
                          dateLabel: fmtDate(marker.date, "short"),
                          objectTint: accent,
                        };
                      const chipName = isAgentSet
                        ? resolveAgentSetChipLabel(marker, t)
                        : marker.dataType && marker.dataType !== "document"
                          ? `${display.name} · ${marker.dataType}`
                          : display.name;
                      const dataAnchor = isAgentSet
                        ? `set-${marker.agentSetId}`
                        : marker.dataType === "document" && marker.docId
                          ? `doc-${marker.docId}`
                          : `node-${marker.nodeId}`;
                      const isQueuedDoc = marker.dataType === "document"
                        && marker.docId
                        && queuedDocIds?.has(marker.docId);
                      const canRemove = isAgentSet
                        || isQueuedDoc
                        || (marker.dataType !== "document" && marker.childKey);

                      return (
                        <TimelineEventChip
                          key={marker.nodeId}
                          variant="card"
                          compact
                          name={chipName}
                          familyAccent={familyAccent}
                          objectTint={display.objectTint || accent}
                          focused={focusedNoteId === (item?.noteId || marker.nodeId)}
                          dataAnchor={dataAnchor}
                          statusBadge={isAgentSet ? (marker.setStatus || "pending") : null}
                          className={isAgentSet ? resolveAgentSetChipClass(marker) : ""}
                          title={
                            isAgentSet
                              ? t("timeline.agentSetHint")
                              : marker.dataType === "document"
                                ? t("timeline.docChipHint")
                                : marker.docId
                                  ? t("timeline.childChipHint")
                                  : undefined
                          }
                          onClick={() => onChipClick(marker, row)}
                          onDoubleClick={() => onChipDoubleClick(marker, row)}
                          onRemove={canRemove
                            ? (e) => {
                              e.stopPropagation();
                              onChipRemove(marker, row);
                            }
                            : undefined}
                          removeLabel={t("timeline.removeFromTimeline")}
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
  onOpenDocument,
}) {
  const inheritObjMode = useTimelineStore((s) => s.inheritObjMode);
  const timelineDocQueue = useTimelineStore((s) => s.timelineDocQueue);
  const timelineDocSnapshotsByDocId = useTimelineStore((s) => s.timelineDocSnapshotsByDocId);
  const timelineExcludedChildrenByDocId = useTimelineStore((s) => s.timelineExcludedChildrenByDocId);
  const timelineAgentSets = useTimelineStore((s) => s.timelineAgentSets);
  const expandedDocIds = useTimelineStore((s) => s.expandedDocIds);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);
  const explicitPrimaryId = useTimelineStore((s) => s.primaryTimelineObjectId);
  const setTimelineFocus = useTimelineStore((s) => s.setTimelineFocus);
  const toggleExpandedDocId = useTimelineStore((s) => s.toggleExpandedDocId);
  const removeTimelineDocFromQueue = useTimelineStore((s) => s.removeTimelineDocFromQueue);
  const removeTimelineChildFromQueue = useTimelineStore((s) => s.removeTimelineChildFromQueue);
  const removeTimelineAgentSet = useTimelineStore((s) => s.removeTimelineAgentSet);
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

  const queuedDocIds = useMemo(
    () => new Set(timelineDocQueue),
    [timelineDocQueue],
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
      timelineDocSnapshotsByDocId,
      timelineExcludedChildrenByDocId,
      timelineAgentSets,
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
      timelineDocSnapshotsByDocId,
      timelineExcludedChildrenByDocId,
      timelineAgentSets,
      expandedDocIds,
      today,
      filterObjectId,
      inheritObjMode,
      primaryTimelineObjectId,
      tacticalRangeOverride,
    ],
  );

  const { displayRows, trackItemsById, grid } = view;
  const rowGroups = useMemo(
    () => groupDisplayRowsByObject(displayRows),
    [displayRows],
  );
  const docChildLinks = useMemo(
    () => buildDocChildLinks(displayRows, expandedDocIds),
    [displayRows, expandedDocIds],
  );
  const rangeDrag = useTacticalRangeDrag(grid);
  const hasQueue = timelineDocQueue.length > 0 || timelineAgentSets.length > 0;
  const objectRowCount = displayRows.filter((r) => r.rowKind === "object").length;
  const chipClickTimerRef = useRef(null);

  useEffect(() => () => {
    if (chipClickTimerRef.current) {
      window.clearTimeout(chipClickTimerRef.current);
      chipClickTimerRef.current = null;
    }
  }, []);

  const clearPendingChipClick = () => {
    if (!chipClickTimerRef.current) return;
    window.clearTimeout(chipClickTimerRef.current);
    chipClickTimerRef.current = null;
  };

  const runChipClick = (marker, row) => {
    const docId = marker.docId || null;
    const willExpand = docId ? !expandedDocIds.includes(docId) : false;
    if (docId) toggleExpandedDocId(docId);
    setTimelineFocus({
      level: docId && willExpand ? "children" : "doc",
      objectId: row.objectId,
      docId,
      canvasNodeId: marker.virtual ? null : marker.nodeId,
    });
  };

  const handleChipClick = (marker, row) => {
    clearPendingChipClick();
    chipClickTimerRef.current = window.setTimeout(() => {
      chipClickTimerRef.current = null;
      runChipClick(marker, row);
    }, 280);
  };

  const handleChipDoubleClick = (marker, row) => {
    clearPendingChipClick();
    const docId = marker.docId || null;
    if (!docId || !onOpenDocument) return;
    const focusBlockId = marker.dataType === "document"
      ? null
      : resolveFocusBlockIdForTimelineMarker(marker, {
        canvasNodes,
        nodeEntitiesById,
        docsById,
      });
    onOpenDocument(docId, { focusBlockId });
  };

  const handleChipRemove = (marker) => {
    if (marker.dataType === "agent-set" && marker.agentSetId) {
      removeTimelineAgentSet(marker.agentSetId);
      return;
    }
    if (marker.dataType === "document" && marker.docId) {
      removeTimelineDocFromQueue(marker.docId);
      return;
    }
    if (marker.docId && marker.childKey) {
      removeTimelineChildFromQueue(marker.docId, marker.childKey);
    }
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
                {timelineAgentSets.length > 0
                  ? ` · ${t("timeline.sets", { count: timelineAgentSets.length, s: pluralS(timelineAgentSets.length) })}`
                  : ""}
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
            {rowGroups.map((group) => (
              <TacticalRowGroup
                key={group.objectId}
                group={group}
                docChildLinks={docChildLinks}
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
                onChipRemove={handleChipRemove}
                queuedDocIds={queuedDocIds}
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
