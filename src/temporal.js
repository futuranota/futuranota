import { daysBetween } from './data.jsx';

export function parseDate(content) {
  if (content instanceof Date) return content;
  if (content && typeof content === "object" && content.date) {
    const time = content.time || "12:00";
    const normalized = String(time).length === 5 ? `${time}:00` : time;
    const d = new Date(`${content.date}T${normalized}`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof content === "string") {
    const dateOnly = content.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateOnly) {
      const d = new Date(`${dateOnly[1]}T12:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(content);
    return isNaN(d) ? null : d;
  }
  return null;
}

function resolveEntityAnchor(entity) {
  if (!entity?.anchorAt) return null;
  return parseDate(entity.anchorAt);
}

export function startOfCalendarDay(d) {
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  return startOfCalendarDay(a).getTime() === startOfCalendarDay(b).getTime();
}

export function noteToTrackItem(note) {
  return {
    id: note.id,
    noteId: note.noteId || note.id,
    docId: note.docId || null,
    canvasKind: note.canvasKind || null,
    title: note.title || "NOTE",
    dataType: note.dataType || "text",
    content: note.content,
    anchorAt: note.anchorAt || null,
  };
}

/** Resolve anchor date: optional anchorAt; date → content; text/doc → createdAt. */
export function resolveNodeAnchorDate(node, { nodeEntitiesById = {}, docsById = {} } = {}) {
  if (!node) return null;

  const entityId = node.noteId;
  const entity = entityId ? nodeEntitiesById[entityId] : null;
  const directAnchor = parseDate(node.anchorAt) || resolveEntityAnchor(entity);
  if (directAnchor) return directAnchor;

  if (node.dataType === "date") {
    return parseDate(node.content);
  }

  if (node.dataType === "document") {
    const doc = docsById[node.docId] || docsById[node.noteId];
    if (doc?.createdAt) return parseDate(doc.createdAt);
  }

  if (node.dataType === "text" || node.dataType === "metric" || node.dataType === "checkbox") {
    if (entity?.createdAt) return parseDate(entity.createdAt);
    if (entity?.parentDocId) {
      const doc = docsById[entity.parentDocId];
      if (doc?.createdAt) return parseDate(doc.createdAt);
    }
    const text = String(node.content || "");
    if (/created/i.test(text)) {
      const iso = text.match(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?/);
      if (iso) return parseDate(iso[0]);
    }
  }

  return null;
}

/** Wire same-calendar-day pulls text/metric anchors to that day. */
export function buildWireAnchorMap(nodes, connections, meta) {
  const anchors = new Map();
  for (const n of nodes) {
    const d = resolveNodeAnchorDate(n, meta);
    if (d) anchors.set(n.id, startOfCalendarDay(d));
  }

  for (const c of connections) {
    const a = nodes.find((n) => n.id === c.from);
    const b = nodes.find((n) => n.id === c.to);
    if (!a || !b) continue;

    let da = anchors.get(a.id) || resolveNodeAnchorDate(a, meta);
    let db = anchors.get(b.id) || resolveNodeAnchorDate(b, meta);
    if (da) da = startOfCalendarDay(da);
    if (db) db = startOfCalendarDay(db);

    if (da && db && sameCalendarDay(da, db)) {
      anchors.set(a.id, da);
      anchors.set(b.id, db);
      continue;
    }
    if (da && !db) anchors.set(b.id, da);
    if (db && !da) anchors.set(a.id, db);
  }

  return anchors;
}

export function computeTimelineRange(trackNodes, connections, today, meta, { zoomed = false } = {}) {
  const anchors = buildWireAnchorMap(trackNodes, connections, meta);
  const dates = [startOfCalendarDay(today)];

  for (const n of trackNodes) {
    const d = anchors.get(n.id) || resolveNodeAnchorDate(n, meta);
    if (d) dates.push(startOfCalendarDay(d));
  }

  const hasWires = connections.length > 0;
  const padMs = (zoomed ? 2 : hasWires ? 3 : 6) * 86400000;
  const fallbackPad = (zoomed ? 7 : 14) * 86400000;

  if (dates.length <= 1) {
    return {
      start: new Date(today.getTime() - fallbackPad),
      end: new Date(today.getTime() + fallbackPad),
      anchors,
      minD: null,
      maxD: null,
    };
  }

  const sorted = [...dates].sort((a, b) => a - b);
  const minD = sorted[0];
  const maxD = sorted[sorted.length - 1];
  const start = new Date(Math.min(minD.getTime(), today.getTime()) - padMs);
  const end = new Date(Math.max(maxD.getTime(), today.getTime()) + padMs);

  return { start, end, anchors, minD, maxD };
}

const LANE_GAP_PCT = 3.2;
const CHIP_LANE_GAP_PCT = 9;

export function assignTimelineLanes(markers) {
  const sorted = [...markers].sort((a, b) => {
    if (a.leftPct !== b.leftPct) return a.leftPct - b.leftPct;
    return (a.sortTime || 0) - (b.sortTime || 0);
  });
  const placed = [];

  for (const m of sorted) {
    let lane = 0;
    while (placed.some((p) => p.lane === lane && Math.abs(p.leftPct - m.leftPct) < LANE_GAP_PCT)) {
      lane += 1;
    }
    placed.push({ ...m, lane });
  }

  return placed;
}

/** Wider gap for horizontal event chips (full label width). */
export function assignTimelineChipLanes(markers, minGapPct = CHIP_LANE_GAP_PCT) {
  const sorted = [...markers].sort((a, b) => {
    if (a.leftPct !== b.leftPct) return a.leftPct - b.leftPct;
    return (a.sortTime || 0) - (b.sortTime || 0);
  });
  const placed = [];

  for (const m of sorted) {
    let lane = 0;
    while (placed.some((p) => p.lane === lane && Math.abs(p.leftPct - m.leftPct) < minGapPct)) {
      lane += 1;
    }
    placed.push({ ...m, lane });
  }

  return placed;
}

const CHIP_MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

export function formatChipDate(d) {
  if (!d) return "";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd.getTime())) return "";
  return `${CHIP_MONTHS[dd.getMonth()]} ${dd.getDate()}`;
}

export function buildChipDisplay(node, trackObject, meta, extras = {}) {
  const { docsById = {}, nodeEntitiesById = {} } = meta;
  let name = (node.title || "Untitled").trim();

  if (node.dataType === "document" && node.docId) {
    const doc = docsById[node.docId];
    if (doc?.title) name = doc.title;
  } else if (node.noteId && nodeEntitiesById[node.noteId]) {
    const source = nodeEntitiesById[node.noteId];
    name = (source.sourceQuery || source.title || name).trim();
  }

  const anchor =
    resolveNodeAnchorDate(node, meta)
    || (node.dataType === "date" ? parseDate(node.content) : null);

  let dateLabel = "";
  if (node.dataType === "metric" && extras.trackNodes && extras.today) {
    const { value, unit } = computeMetricValue(
      node,
      extras.trackNodes,
      extras.trackConnections || [],
      extras.today,
      meta,
    );
    dateLabel = `${value}${unit ? ` ${unit}` : ""}`;
  } else if (anchor) {
    dateLabel = formatChipDate(anchor);
  } else if (node.dataType === "date") {
    dateLabel = "Set date";
  }

  return {
    name,
    dateLabel,
    anchor,
    objectTint: trackObject?.color || null,
  };
}

function blueprintContainsItem(bp, itemId) {
  return (bp.noteIds || []).includes(itemId) || (bp.nodeIds || []).includes(itemId);
}

function earliestDateInBlueprint(itemId, allItems, blueprints, meta) {
  const bp = blueprints.find((b) => blueprintContainsItem(b, itemId));
  if (!bp) return null;
  const ids = bp.noteIds?.length ? bp.noteIds : bp.nodeIds || [];
  const dates = ids
    .map((id) => allItems.find((n) => n.id === id || n.noteId === id))
    .map((n) => resolveNodeAnchorDate(n, meta) || (n?.dataType === "date" ? parseDate(n.content) : null))
    .filter(Boolean);
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/** Virtual connections for timeline (note-id keyed). */
export function getTrackConnections(blueprint) {
  return (blueprint.edges || []).map((e, i) => ({
    id: `te-${blueprint.id}-${i}`,
    from: e.fromNoteId,
    to: e.toNoteId,
  }));
}

function countdownLabel(today, date) {
  const diff = daysBetween(today, date);
  if (diff > 0) return `T−${diff}d`;
  if (diff < 0) return `T+${-diff}d`;
  return "TODAY";
}

export function computeMetricValue(metricNode, allNodes, allConnections, today, meta = {}) {
  const content = metricNode.content || {};
  if (content.value != null && content.kind !== "bridge") {
    return { value: content.value, unit: content.unit || "" };
  }
  if (content.kind === "bridge" || metricNode._bridge) {
    const incoming = allConnections.filter((c) => c.to === metricNode.id);
    const outgoing = allConnections.filter((c) => c.from === metricNode.id);
    const linked = [...incoming.map((c) => c.from), ...outgoing.map((c) => c.to)]
      .map((id) => allNodes.find((n) => n.id === id))
      .filter(Boolean);
    const linkedDates = linked
      .map((n) => resolveNodeAnchorDate(n, meta) || (n.dataType === "date" ? parseDate(n.content) : null))
      .filter(Boolean);
    if (linkedDates.length >= 2) {
      const diff = Math.abs(daysBetween(linkedDates[0], linkedDates[1]));
      return { value: diff, unit: content.unit || "days", bridged: true };
    }
    if (linkedDates.length === 1) {
      const da = linkedDates[0];
      const diff = daysBetween(today, da);
      const sign = diff > 0 ? "T−" : diff < 0 ? "T+" : "T";
      return { value: `${sign}${Math.abs(diff)}`, unit: content.unit || "d", bridged: true };
    }
    return { value: "—", unit: content.unit || "", bridged: true };
  }
  return { value: String(content), unit: "" };
}

export function computeEdgeTemporalLabel(
  fromNode,
  toNode,
  today,
  allNodes,
  allConnections,
  blueprints = [],
  meta = {},
) {
  if (!fromNode || !toNode) return null;

  const fromDate = resolveNodeAnchorDate(fromNode, meta)
    || (fromNode.dataType === "date" ? parseDate(fromNode.content) : null);
  const toDate = resolveNodeAnchorDate(toNode, meta)
    || (toNode.dataType === "date" ? parseDate(toNode.content) : null);

  if (fromDate && toDate) {
    if (sameCalendarDay(fromDate, toDate)) return "same day";
    return `${Math.abs(daysBetween(fromDate, toDate))}d`;
  }

  if (toDate) {
    const first = earliestDateInBlueprint(toNode.id, allNodes, blueprints, meta);
    if (first && sameCalendarDay(toDate, first)) {
      return countdownLabel(today, toDate);
    }
    return countdownLabel(today, toDate);
  }

  if (fromDate && toNode.dataType === "metric") {
    const content = toNode.content || {};
    if (content.kind === "bridge" || toNode._bridge) {
      const existing = allConnections.filter(
        (c) => (c.to === toNode.id || c.from === toNode.id) && c.from !== fromNode.id && c.to !== fromNode.id,
      );
      const otherDates = existing
        .map((c) => allNodes.find((n) => n.id === (c.from === toNode.id ? c.to : c.from)))
        .map((n) => resolveNodeAnchorDate(n, meta) || (n?.dataType === "date" ? parseDate(n.content) : null))
        .filter(Boolean);
      if (otherDates.length === 0) {
        return countdownLabel(today, fromDate);
      }
    }
  }

  if (toNode.dataType === "metric" && fromNode.dataType !== "date") {
    const incoming = allConnections.filter((c) => c.to === toNode.id);
    const linkedDates = [...incoming.map((c) => c.from), fromNode.id]
      .map((id) => allNodes.find((n) => n.id === id))
      .map((n) => resolveNodeAnchorDate(n, meta) || (n?.dataType === "date" ? parseDate(n.content) : null))
      .filter(Boolean);
    if (linkedDates.length === 1) {
      return countdownLabel(today, linkedDates[0]);
    }
  }

  if (fromDate) {
    return countdownLabel(today, fromDate);
  }

  return null;
}

export function getBlueprintConnections(blueprint, connections, allNodes, { includeHidden = false } = {}) {
  const ids = new Set(blueprint.nodeIds || []);
  return connections.filter((c) => {
    if (!ids.has(c.from) || !ids.has(c.to)) return false;
    const a = allNodes.find((n) => n.id === c.from);
    const b = allNodes.find((n) => n.id === c.to);
    if (!a || !b) return false;
    if (!includeHidden && (a.hidden || b.hidden)) return false;
    return true;
  });
}

export function timelineNodeLeftPct(node, ctx) {
  const {
    start,
    end,
    todayPct,
    winStart,
    winEnd,
    minD,
    maxD,
    allNodes,
    connections,
    anchors,
    meta = {},
  } = ctx;
  const total = end - start || 1;
  const pct = (d) => ((d - start) / total) * 100;

  const anchored = anchors?.get(node.id);
  if (anchored) return pct(anchored);

  const resolved = resolveNodeAnchorDate(node, meta);
  if (resolved) return pct(resolved);

  if (node.dataType === "date") {
    const d = parseDate(node.content);
    return d ? pct(d) : todayPct;
  }

  if (node.dataType === "metric") {
    const content = node.content || {};
    if (content.kind === "bridge" || node._bridge) {
      const inc = connections.filter((c) => c.to === node.id).map((c) => c.from);
      const out = connections.filter((c) => c.from === node.id).map((c) => c.to);
      const linkedDates = [...inc, ...out]
        .map((id) => allNodes.find((nd) => nd.id === id))
        .map((nd) => {
          if (!nd) return null;
          return anchors?.get(nd.id) || resolveNodeAnchorDate(nd, meta)
            || (nd.dataType === "date" ? parseDate(nd.content) : null);
        })
        .filter(Boolean);
      if (linkedDates.length >= 2 && minD && maxD) {
        return (winStart + winEnd) / 2;
      }
      if (linkedDates.length === 1) return pct(linkedDates[0]);
    }
    return todayPct;
  }

  return todayPct;
}

export function bezierMidpoint(a, b) {
  const dx = b.x - a.x;
  const k = Math.max(40, Math.abs(dx) * 0.4);
  const t = 0.5;
  const mt = 1 - t;
  const x = mt * mt * mt * a.x + 3 * mt * mt * t * (a.x + k) + 3 * mt * t * t * (b.x - k) + t * t * t * b.x;
  const y = mt * mt * mt * a.y + 3 * mt * mt * t * a.y + 3 * mt * t * t * b.y + t * t * t * b.y;
  return { x, y };
}

function cubicBezierAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Control points for canvas connection cubic bezier (matches pathBetween in canvas.jsx). */
export function getConnectionBezierControls(a, b) {
  const dx = b.x - a.x;
  const k = Math.max(40, Math.abs(dx) * 0.4);
  return {
    p0: a,
    p1: { x: a.x + k, y: a.y },
    p2: { x: b.x - k, y: b.y },
    p3: b,
  };
}

/**
 * Point on a connection bezier at least `minOffset` px along the curve from start or end.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {number} [minOffset]
 * @param {{ fromEnd?: boolean }} [options]
 */
export function bezierPointAtArcOffset(a, b, minOffset = 36, { fromEnd = false } = {}) {
  const { p0, p1, p2, p3 } = getConnectionBezierControls(a, b);
  const steps = 48;
  let accumulated = 0;
  let prev = fromEnd ? p3 : p0;

  for (let i = 1; i <= steps; i += 1) {
    const t = fromEnd ? 1 - i / steps : i / steps;
    const pt = cubicBezierAt(p0, p1, p2, p3, t);
    accumulated += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    if (accumulated >= minOffset) return pt;
    prev = pt;
  }

  return fromEnd ? p2 : p1;
}
