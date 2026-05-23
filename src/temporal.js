import { daysBetween } from './data.jsx';

export function parseDate(content) {
  if (content instanceof Date) return content;
  if (typeof content === "string") {
    const d = new Date(content);
    return isNaN(d) ? null : d;
  }
  return null;
}

export function noteToTrackItem(note) {
  return {
    id: note.id,
    noteId: note.id,
    title: note.title || "NOTE",
    dataType: note.dataType || "text",
    content: note.content,
  };
}

function blueprintContainsItem(bp, itemId) {
  return (bp.noteIds || []).includes(itemId) || (bp.nodeIds || []).includes(itemId);
}

function earliestDateInBlueprint(itemId, allItems, blueprints) {
  const bp = blueprints.find((b) => blueprintContainsItem(b, itemId));
  if (!bp) return null;
  const ids = bp.noteIds?.length ? bp.noteIds : bp.nodeIds || [];
  const dates = ids
    .map((id) => allItems.find((n) => n.id === id || n.noteId === id))
    .filter((n) => n && n.dataType === "date")
    .map((n) => parseDate(n.content))
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

export function computeMetricValue(metricNode, allNodes, allConnections, today) {
  const content = metricNode.content || {};
  if (content.value != null && content.kind !== "bridge") {
    return { value: content.value, unit: content.unit || "" };
  }
  if (content.kind === "bridge" || metricNode._bridge) {
    const incoming = allConnections.filter((c) => c.to === metricNode.id);
    const outgoing = allConnections.filter((c) => c.from === metricNode.id);
    const linked = [...incoming.map((c) => c.from), ...outgoing.map((c) => c.to)]
      .map((id) => allNodes.find((n) => n.id === id))
      .filter((n) => n && n.dataType === "date");
    if (linked.length >= 2) {
      const da = parseDate(linked[0].content);
      const db = parseDate(linked[1].content);
      if (da && db) {
        const diff = Math.abs(daysBetween(da, db));
        return { value: diff, unit: content.unit || "days", bridged: true };
      }
    }
    if (linked.length === 1) {
      const da = parseDate(linked[0].content);
      if (da) {
        const diff = daysBetween(today, da);
        const sign = diff > 0 ? "T−" : diff < 0 ? "T+" : "T";
        return { value: `${sign}${Math.abs(diff)}`, unit: content.unit || "d", bridged: true };
      }
    }
    return { value: "—", unit: content.unit || "", bridged: true };
  }
  return { value: String(content), unit: "" };
}

export function computeEdgeTemporalLabel(fromNode, toNode, today, allNodes, allConnections, blueprints = []) {
  if (!fromNode || !toNode) return null;

  const fromDate = fromNode.dataType === "date" ? parseDate(fromNode.content) : null;
  const toDate = toNode.dataType === "date" ? parseDate(toNode.content) : null;

  if (fromDate && toDate) {
    return `${Math.abs(daysBetween(fromDate, toDate))}d`;
  }

  if (toDate) {
    const first = earliestDateInBlueprint(toNode.id, allNodes, blueprints);
    if (first && toDate.getTime() === first.getTime()) {
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
        .filter((n) => n && n.dataType === "date");
      if (otherDates.length === 0) {
        return countdownLabel(today, fromDate);
      }
    }
  }

  if (toNode.dataType === "metric" && fromNode.dataType !== "date") {
    const incoming = allConnections.filter((c) => c.to === toNode.id);
    const linkedDates = [...incoming.map((c) => c.from), fromNode.id]
      .map((id) => allNodes.find((n) => n.id === id))
      .filter((n) => n && n.dataType === "date");
    if (linkedDates.length === 1) {
      const d = parseDate(linkedDates[0].content);
      if (d) return countdownLabel(today, d);
    }
  }

  if (fromNode.dataType !== "date" && toDate) {
    return countdownLabel(today, toDate);
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
    today,
    todayPct,
    winStart,
    winEnd,
    minD,
    maxD,
    allNodes,
    connections,
  } = ctx;
  const total = end - start || 1;
  const pct = (d) => ((d - start) / total) * 100;

  if (node.dataType === "date") {
    const d = parseDate(node.content);
    return d ? pct(d) : todayPct;
  }

  if (node.dataType === "text") {
    return todayPct;
  }

  if (node.dataType === "metric") {
    const content = node.content || {};
    if (content.kind === "bridge" || node._bridge) {
      const inc = connections.filter((c) => c.to === node.id).map((c) => c.from);
      const out = connections.filter((c) => c.from === node.id).map((c) => c.to);
      const linkedDates = [...inc, ...out]
        .map((id) => allNodes.find((nd) => nd.id === id))
        .filter((nd) => nd && nd.dataType === "date")
        .map((nd) => parseDate(nd.content))
        .filter(Boolean);
      if (linkedDates.length >= 2 && minD && maxD) {
        return (winStart + winEnd) / 2;
      }
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
