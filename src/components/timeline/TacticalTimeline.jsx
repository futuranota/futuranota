import { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { daysBetween, fmtDate } from "../../data.jsx";
import { buildChipDisplay, startOfCalendarDay } from "../../temporal.js";
import {
  buildDocChildLinks,
  buildTacticalObjectRows,
  buildTacticalDisplayGrid,
  groupDisplayRowsByObject,
  resolveDaysLeftCenterPct,
  resolveTimelineScheduleStatus,
  formatTimelineScheduleStatusLabel,
  formatTimelineTimeGapLabel,
} from "../../lib/tacticalTimelineView.js";
import { formatSameDayPairLabel, formatNowUntilScheduleLabel } from "../../lib/docSchedule.js";
import { resolveParentTagFamilyStyle } from "../../lib/objectColors.js";
import { resolvePrimaryTimelineObjectId } from "../../lib/timelinePrimary.js";
import { resolveNodeIdForTimelineMarker } from "../../lib/timelineSelection.js";
import { useTacticalRangeDrag } from "../../hooks/useTacticalRangeDrag.js";
import { useTranslatedText } from "../../hooks/useTranslatedText.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useTimelineStore } from "../../stores/index.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { TimelineEventChip } from "./TimelineEventChip.jsx";
import { TimelineDocChildLinks } from "./TimelineDocChildLinks.jsx";
import { TimelineAlertsModal } from "./TimelineAlertsModal.jsx";

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

/** Local clock for thermometer caption (e.g. 9:11 PM). */
function fmtClock(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

function TacticalRulerBar({
  grid,
  today,
  now,
  t,
  todayLeftPct = null,
  todayStretchable = false,
  todayPairNextDate = null,
  rowId = null,
  rangeDrag = null,
  plotRef = null,
  localOnly = true,
}) {
  const markerAt = now instanceof Date ? now : today;
  const inRange = Boolean(grid && markerAt >= grid.start && markerAt <= grid.end);
  const thermoPct = Number.isFinite(todayLeftPct)
    ? todayLeftPct
    : (grid?.nowPct ?? grid?.todayPct ?? 0);
  const todayHandleKey = rowId ? `${rowId}:today:anchor` : null;
  const isTodayActive = Boolean(
    rangeDrag?.isDragging
    && todayHandleKey
    && rangeDrag?.activeHandleKey === todayHandleKey,
  );
  const canStretchToday = Boolean(
    todayStretchable && todayPairNextDate && rowId && rangeDrag && plotRef,
  );

  return (
    <>
      <div className="tl-tactical-ruler" aria-hidden>
        {(grid?.ticks || []).map((tick, i) => (
          <span
            key={i}
            className={"tl-tactical-ruler__tick" + (tick.major ? " is-major" : "")}
            style={{ left: `${tick.leftPct}%` }}
          />
        ))}
      </div>
      {grid && inRange && (
        <div
          className="tl-tactical-rail__past"
          style={{ width: `${thermoPct}%` }}
          aria-hidden
        />
      )}
      {grid && inRange && (
        <div
          className="tl-tactical-rail__future"
          style={{ left: `${thermoPct}%`, width: `${Math.max(0, 100 - thermoPct)}%` }}
          aria-hidden
        />
      )}
      <div className="tl-tactical-rail__axis" aria-hidden />
      {grid && inRange && (
        <div
          className={
            "tl-tactical-rail__today is-thermometer"
            + (canStretchToday ? " is-range-handle is-range-anchor" : "")
            + (isTodayActive ? " is-range-active" : "")
          }
          style={{ left: `${thermoPct}%` }}
          role={canStretchToday ? "slider" : undefined}
          tabIndex={canStretchToday ? 0 : undefined}
          aria-label={canStretchToday ? (t ? t("timeline.dragToday") : "Drag today") : undefined}
          title={canStretchToday ? (t ? t("timeline.dragToday") : undefined) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(thermoPct)}
          onPointerDown={
            canStretchToday
              ? (e) => {
                e.stopPropagation();
                rangeDrag.onRangeHandlePointerDown(
                  "anchor",
                  plotRef.current,
                  e,
                  {
                    handleKey: todayHandleKey,
                    focusKey: "today",
                    pairNextDate: todayPairNextDate,
                    rowId,
                    allowRangePan: false,
                  },
                );
              }
              : undefined
          }
          onDoubleClick={
            canStretchToday
              ? (e) => rangeDrag.onRangeHandleDoubleClick(e, {
                rowId,
                localOnly,
              })
              : undefined
          }
        >
          <div className="tl-tactical-rail__today-head">
            <span className="tl-tactical-rail__today-pill">
              {t ? t("timeline.today") : "today"}
            </span>
          </div>
          <span className="tl-tactical-rail__today-stem" aria-hidden />
          <span className="tl-tactical-rail__today-caption">
            <span className="tl-tactical-rail__today-date">{fmtDate(today, "short")}</span>
            {markerAt ? (
              <span className="tl-tactical-rail__today-time">{fmtClock(markerAt)}</span>
            ) : null}
          </span>
        </div>
      )}
    </>
  );
}

function resolveMarkerCompleted(marker) {
  if (marker?.dataType === "agent-set") {
    return marker.setStatus === "ready";
  }
  return Boolean(marker?.completed || marker?.isCompleted);
}

function TacticalDecorativeRuler({ grid, today, now, t }) {
  return (
    <div className="tl-tactical-decorative-ruler" aria-hidden>
      <div className="tl-tactical-rail tl-tactical-rail--decorative">
        <div className="tl-tactical-rail__inset">
          <div className="tl-tactical-rail__plot">
            <div className="tl-tactical-bar tl-tactical-bar--decorative">
              <TacticalRulerBar grid={grid} today={today} now={now} t={t} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveAnchorStatus(groupDate, today) {
  const d = startOfCalendarDay(groupDate);
  const tDay = startOfCalendarDay(today);
  if (d.getTime() < tDay.getTime()) return "past";
  if (d.getTime() === tDay.getTime()) return "active";
  return "future";
}

function TacticalRowGroup({
  group,
  groupIndex = 0,
  docChildLinks,
  today,
  now,
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
      {group.rows.map((row, rowIndex) => (
        <TacticalObjectRow
          key={row.id}
          row={row}
          nudgeRail={groupIndex > 0 || rowIndex > 0}
          today={today}
          now={now}
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
          enableRangeHandles={(row.rail?.nodeGroups?.length ?? 0) > 0}
          rangeDrag={rangeDrag}
          t={t}
        />
      ))}
    </div>
  );
}

function TacticalObjectRow({
  row,
  nudgeRail = false,
  today,
  now,
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
  const { nodeGroups = [], segments = [], todayLeftPct = null, todayPairNextDate = null, todayStretchable = false } = row.rail || {};
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
    nudgeRail ? "is-rail-nudge" : "",
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
        <div
          className={
            "tl-tactical-rail"
            + (rangeDrag?.isDragging && rangeDrag?.activeHandleKey?.startsWith(`${row.id}:`)
              ? " is-dragging-range"
              : "")
            + (nodeGroups.length === 0 ? " tl-tactical-rail--empty" : "")
          }
        >
            <div className="tl-tactical-rail__inset">
            <div className="tl-tactical-rail__plot" ref={plotRef}>
            <div className="tl-tactical-bar">
              <TacticalRulerBar
                grid={grid}
                today={today}
                now={now}
                t={t}
                todayLeftPct={todayLeftPct}
                todayStretchable={todayStretchable && enableRangeHandles}
                todayPairNextDate={todayPairNextDate}
                rowId={row.id}
                rangeDrag={rangeDrag}
                plotRef={plotRef}
                localOnly={isChildRow}
              />
              {nodeGroups.length > 0 ? (
                <>
              {segments.map((segment) => (
                (segment.isDocDimension || segment.isRowEndpointSpan) ? (
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
                ) : null
              ))}
              {segments.map((segment) => (
                <div
                  key={segment.key}
                  className={
                    "tl-tactical-segment"
                    + (segment.isAdjacentGap ? " is-adjacent-gap" : "")
                    + (segment.isSameDayGap ? " is-same-day-gap" : "")
                    + (segment.isNowGap ? " is-now-gap" : "")
                    + (segment.isRowEndpointSpan ? " is-row-endpoint-span" : "")
                  }
                  style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
                >
                  <span className="tl-tactical-segment__edge" aria-hidden />
                  {segment.isAdjacentGap ? (() => {
                    const clock = now instanceof Date ? now : new Date();
                    const pair = segment.isNowGap && segment.toDate
                      ? formatNowUntilScheduleLabel({
                        target: segment.toDate,
                        now: clock,
                        hasExplicitTime: Boolean(segment.isSameDayGap),
                      }, t)
                      : (segment.isSameDayGap && segment.fromDate && segment.toDate
                        ? formatSameDayPairLabel({
                          from: segment.fromDate,
                          to: segment.toDate,
                          now: clock,
                          hasExplicitTime: (segment.gapMinutes || 0) >= 1,
                        }, t)
                        : null);
                    const gapText = pair?.singleLine
                      || formatTimelineScheduleStatusLabel(segment.schedule, t, {
                        gapDays: segment.gapDays,
                      })
                      || formatTimelineTimeGapLabel(segment.timeGap, t)
                      || segment.label;
                    return (
                      <span
                        className={
                          "tl-tactical-segment__label"
                          + (segment.scheduleKind ? ` is-${segment.scheduleKind}` : "")
                          + (segment.isSameDayGap ? " is-same-day" : "")
                          + (segment.isNowGap ? " is-now-gap" : "")
                          + (segment.isLiveCountdown || pair?.isLiveCountdown ? " is-live-countdown" : "")
                          + (pair ? " is-pair-stack" : "")
                        }
                        title={gapText || undefined}
                      >
                        {pair ? (
                          <>
                            <span className="tl-tactical-segment__label-head">{pair.headline}</span>
                            {pair.detail ? (
                              <span className="tl-tactical-segment__label-detail">{pair.detail}</span>
                            ) : null}
                          </>
                        ) : gapText}
                      </span>
                    );
                  })() : null}
                </div>
              ))}
              {daysLeft > 0 && (
                <div
                  className="tl-tactical-rail__remaining"
                  style={{ left: `${daysLeftCenterPct}%` }}
                >
                  {t("timeline.daysLeft", { count: daysLeft, s: pluralS(daysLeft) })}
                </div>
              )}
                </>
              ) : (
                <span className="tl-tactical-row__empty mute">{t("timeline.noDatedEvents")}</span>
              )}
            </div>
            {nodeGroups.length > 0 ? (
            <>
            <div className="tl-tactical-rail__anchors">
              {nodeGroups.map((group, groupIndex) => {
                const anchorAlign = resolveNodeAnchorAlign(
                  group.leftPct,
                  groupIndex,
                  nodeGroups.length,
                );
                const anchorStatus = resolveAnchorStatus(group.date, today);
                const isFirst = groupIndex === 0;
                const isLast = groupIndex === nodeGroups.length - 1;
                const pairNext = !isLast ? nodeGroups[groupIndex + 1] : null;
                // Every node with a next: individual pair stretch (1 moves, 2 static, …).
                // Doc/child rails never pan the shared folder timeline.
                const rangeEdge = !enableRangeHandles
                  ? null
                  : pairNext
                    ? "anchor"
                    : (!isChildRow && isFirst && isLast ? "start" : null);
                const handleKeyPrefix = `${row.id}:${group.columnKey}:`;
                const isRangeHandle = Boolean(rangeEdge);
                const isActiveHandle = Boolean(
                  rangeDrag?.isDragging
                  && typeof rangeDrag?.activeHandleKey === "string"
                  && rangeDrag.activeHandleKey.startsWith(handleKeyPrefix),
                );
                const handleClass = [
                  "tl-tactical-rail__anchor",
                  `is-status-${anchorStatus}`,
                  `is-anchor-${anchorAlign}`,
                  isRangeHandle ? "is-range-handle" : "",
                  rangeEdge === "start" ? "is-range-start" : "",
                  rangeEdge === "end" ? "is-range-end" : "",
                  rangeEdge === "anchor" ? "is-range-anchor" : "",
                  isActiveHandle ? "is-range-active" : "",
                ].filter(Boolean).join(" ");
                const stretchHint = rangeEdge === "anchor"
                  ? t("timeline.dragNode")
                  : rangeEdge === "start"
                    ? t("timeline.dragStart")
                    : null;

                return (
                  <span
                    key={`dot-${group.columnKey}`}
                    className={handleClass}
                    style={{ left: `${group.leftPct}%` }}
                    data-tl-anchor={`dot-${row.id}-${group.columnKey}`}
                    data-range-edge={rangeEdge || undefined}
                    role={isRangeHandle ? "slider" : undefined}
                    aria-label={stretchHint || undefined}
                    title={
                      stretchHint
                      || (anchorStatus === "past" ? t("timeline.pastDueHint") : undefined)
                    }
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(group.leftPct)}
                    tabIndex={isRangeHandle ? 0 : undefined}
                    onPointerDown={
                      rangeEdge
                        ? (e) => {
                          e.stopPropagation();
                          let edge = rangeEdge;
                          if (isFirst && isLast && !pairNext && plotRef.current) {
                            const rect = plotRef.current.getBoundingClientRect();
                            const pct = rect.width <= 0
                              ? group.leftPct
                              : ((e.clientX - rect.left) / rect.width) * 100;
                            edge = pct <= group.leftPct ? "start" : "end";
                          }
                          rangeDrag?.onRangeHandlePointerDown(
                            edge,
                            plotRef.current,
                            e,
                            {
                              handleKey: `${row.id}:${group.columnKey}:${edge}`,
                              anchorDate: group.date,
                              markerDates: nodeGroups
                                .map((g) => g.date)
                                .filter(Boolean),
                              pairNextDate: pairNext?.date || null,
                              rowId: row.id,
                              // Children/doc cords: pair only — never move folder timeline.
                              allowRangePan: !isChildRow && !pairNext,
                            },
                          );
                        }
                        : undefined
                    }
                    onDoubleClick={
                      isRangeHandle
                        ? (e) => rangeDrag?.onRangeHandleDoubleClick(e, {
                          rowId: row.id,
                          localOnly: isChildRow,
                        })
                        : undefined
                    }
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
                  initial={{ opacity: 0, y: 12, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, x: "-50%" }}
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
                      const isMacronodo = Boolean(
                        marker.dataType
                        && marker.dataType !== "document"
                        && !isAgentSet,
                      );
                      const schedule = resolveTimelineScheduleStatus(
                        marker.date || group.date,
                        today,
                        { completed: resolveMarkerCompleted(marker) },
                      );
                      const isPastDue = schedule.kind === "past-due";
                      const isPending = schedule.kind === "pending";
                      const isCompleted = schedule.kind === "completed";
                      const fallbackName = isMacronodo
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
                        : isMacronodo
                          ? `${display.name} · ${marker.dataType}`
                          : display.name;
                      // Gap between same-day nodes owns "sched Xm (past due)" — chips stay clean.
                      const chipLabel = chipName;
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
                        || (isMacronodo && marker.childKey);
                      const macronodoGreen = "#86A296";

                      return (
                        <TimelineEventChip
                          key={marker.nodeId}
                          variant="card"
                          compact
                          name={chipLabel}
                          familyAccent={isMacronodo ? macronodoGreen : familyAccent}
                          objectTint={isMacronodo ? macronodoGreen : (display.objectTint || accent)}
                          focused={focusedNoteId === (item?.noteId || marker.nodeId)}
                          dataAnchor={dataAnchor}
                          statusBadge={isAgentSet ? (marker.setStatus || "pending") : null}
                          className={
                            [
                              isAgentSet ? resolveAgentSetChipClass(marker) : "",
                              isMacronodo ? "is-macronodo" : "",
                              isPastDue ? "is-past-due" : "",
                              isPending ? "is-pending" : "",
                              isCompleted ? "is-completed" : "",
                            ].filter(Boolean).join(" ")
                          }
                          title={
                            display.dateLabel
                              || (isAgentSet
                                ? t("timeline.agentSetHint")
                                : marker.dataType === "document"
                                  ? t("timeline.docChipHint")
                                  : marker.docId
                                    ? t("timeline.childChipHint")
                                    : undefined)
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
                  {(() => {
                    const groupCompleted = group.items.some((m) => resolveMarkerCompleted(m));
                    const groupSchedule = resolveTimelineScheduleStatus(group.date, today, {
                      completed: groupCompleted,
                    });
                    if (groupSchedule.kind !== "past-due") return null;
                    const groupStatusLabel = formatTimelineScheduleStatusLabel(groupSchedule, t);
                    if (!groupStatusLabel) return null;
                    return (
                      <span
                        className="tl-tactical-node-group__status is-past-due"
                        title={groupStatusLabel}
                      >
                        {groupStatusLabel}
                      </span>
                    );
                  })()}
                </motion.div>
                );
              })}
            </div>
            </>
            ) : null}
            </div>
            </div>
          </div>
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
  onOpenNode,
}) {
  const inheritObjMode = useTimelineStore((s) => s.inheritObjMode);
  const timelineDocQueue = useTimelineStore((s) => s.timelineDocQueue);
  const timelineDocSnapshotsByDocId = useTimelineStore((s) => s.timelineDocSnapshotsByDocId);
  const timelineExcludedChildrenByDocId = useTimelineStore((s) => s.timelineExcludedChildrenByDocId);
  const timelineAgentSets = useTimelineStore((s) => s.timelineAgentSets);
  const timelineSheet = useUIStateStore((s) => s.timelineSheet);
  const toggleTimelineSheet = useUIStateStore((s) => s.toggleTimelineSheet);
  const isSheetExpanded = timelineSheet === "expanded";
  const expandedDocIds = useTimelineStore((s) => s.expandedDocIds);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);
  const explicitPrimaryId = useTimelineStore((s) => s.primaryTimelineObjectId);
  const setTimelineFocus = useTimelineStore((s) => s.setTimelineFocus);
  const toggleExpandedDocId = useTimelineStore((s) => s.toggleExpandedDocId);
  const removeTimelineDocFromQueue = useTimelineStore((s) => s.removeTimelineDocFromQueue);
  const removeTimelineChildFromQueue = useTimelineStore((s) => s.removeTimelineChildFromQueue);
  const removeTimelineAgentSet = useTimelineStore((s) => s.removeTimelineAgentSet);
  const timelineAlertsOpen = useUIStateStore((s) => s.timelineAlertsOpen);
  const openTimelineAlerts = useUIStateStore((s) => s.openTimelineAlerts);
  const closeTimelineAlerts = useUIStateStore((s) => s.closeTimelineAlerts);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const tacticalRangeOverride = useTimelineStore((s) => s.tacticalRangeOverride);
  const tacticalLoupe = useTimelineStore((s) => s.tacticalLoupe);
  const tacticalPairStretches = useTimelineStore((s) => s.tacticalPairStretches);
  const { t, locale } = useI18n();
  const pluralS = (n) => (n === 1 ? "" : "s");
  const familySuffix = (n) => {
    if (locale === "es") return n === 1 ? "ia" : "ias";
    return n === 1 ? "y" : "ies";
  };

  // Wall-clock ticker — thermometer + countdown advance every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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
      today: now,
      filterObjectId,
      inheritObjMode,
      primaryTimelineObjectId,
      rangeOverride: tacticalRangeOverride,
      loupe: tacticalLoupe,
      pairStretches: tacticalPairStretches,
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
      now,
      filterObjectId,
      inheritObjMode,
      primaryTimelineObjectId,
      tacticalRangeOverride,
      tacticalLoupe,
      tacticalPairStretches,
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
  const emptyGrid = useMemo(
    () => buildTacticalDisplayGrid([], now, {
      rangeOverride: tacticalRangeOverride,
      queueDocCount: 0,
      now,
    }),
    [now, tacticalRangeOverride],
  );
  const activeGrid = grid || emptyGrid;
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

  /** Parent doc chip = folder: toggle children. Macronode = open node modal (not whole doc). */
  const runChipClick = (marker, row) => {
    const docId = marker.docId || null;

    if (marker.dataType === "document" && docId) {
      const willExpand = !expandedDocIds.includes(docId);
      toggleExpandedDocId(docId);
      setTimelineFocus({
        level: willExpand ? "children" : "doc",
        objectId: row.objectId,
        docId,
        canvasNodeId: marker.virtual ? null : marker.nodeId,
      });
      return;
    }

    if (marker.dataType !== "agent-set") {
      const nodeId = resolveNodeIdForTimelineMarker(marker, canvasNodes);
      if (nodeId && onOpenNode) {
        onOpenNode(nodeId);
      }
    }
    setTimelineFocus({
      level: "doc",
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
    // Double-click a parent doc opens the document itself.
    if (marker.dataType === "document" && docId && onOpenDocument) {
      onOpenDocument(docId, { focusBlockId: null });
      setTimelineFocus({
        level: "doc",
        objectId: row.objectId,
        docId,
        canvasNodeId: marker.virtual ? null : marker.nodeId,
      });
      return;
    }
    runChipClick(marker, row);
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
    <div
      className={
        "timeline stacked tl-tactical"
        + (hasQueue ? "" : " tl-tactical--empty")
        + (isSheetExpanded ? " is-sheet-expanded" : " is-sheet-peek")
      }
    >
      <div className="tl-sheet-top">
        <button
          type="button"
          className="tl-sheet-toggle"
          onClick={toggleTimelineSheet}
          aria-expanded={isSheetExpanded}
          title={isSheetExpanded ? t("timeline.sheetCollapse") : t("timeline.sheetExpand")}
        >
          <span className="tl-sheet-handle" aria-hidden="true" />
          <span className="tl-sheet-toggle__chevron" aria-hidden="true">
            {isSheetExpanded ? "▾" : "▴"}
          </span>
          <span className="sr-only">
            {isSheetExpanded ? t("timeline.sheetCollapse") : t("timeline.sheetExpand")}
          </span>
        </button>
      </div>
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
                {activeGrid?.spanDays ? ` · ${t("timeline.span", { days: activeGrid.spanDays })}` : ""}
              </span>
            </span>
            <button
              type="button"
              className="tl-alerts-open-btn"
              onClick={openTimelineAlerts}
              title={t("timeline.alertsTitle")}
            >
              {t("timeline.alerts")}
            </button>
          </div>

          <div className="tl-tactical-body">
            {rowGroups.length > 0 ? rowGroups.map((group, groupIndex) => (
              <TacticalRowGroup
                key={group.objectId}
                group={group}
                groupIndex={groupIndex}
                docChildLinks={docChildLinks}
                today={today}
                now={now}
                grid={activeGrid}
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
            )) : (
              <TacticalDecorativeRuler grid={activeGrid} today={today} now={now} t={t} />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="tl-tactical-header">
            <span className="tl-tactical-header__title">
              <b>{t("timeline.title")}</b>
            </span>
            <button
              type="button"
              className="tl-alerts-open-btn"
              onClick={openTimelineAlerts}
              title={t("timeline.alertsTitle")}
            >
              {t("timeline.alerts")}
            </button>
          </div>
          <div className="tl-tactical-body">
            <TacticalDecorativeRuler grid={emptyGrid} today={today} now={now} t={t} />
          </div>
        </>
      )}
      <TimelineAlertsModal
        open={timelineAlertsOpen}
        onClose={closeTimelineAlerts}
        docs={docsById}
        objects={objectsById}
        objectTimelineTitles={objectTimelineTitles}
        selectedObjectId={selectedObjectId || filterObjectId}
        canvasNodes={canvasNodes}
        timelineDocQueue={timelineDocQueue}
        timelineDocSnapshotsByDocId={timelineDocSnapshotsByDocId}
        timelineAgentSets={timelineAgentSets}
      />
    </div>
  );
}
