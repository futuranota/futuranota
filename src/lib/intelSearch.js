import { INTEL } from "../data.jsx";
import { useUIStateStore } from "../stores/uiStateStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { useDocsStore } from "../stores/docsStore.js";

const MOCK_SEARCH_MS = 2200;

/** @typedef {{ id: string, title: string, dataType: string, content: unknown, anchorAt?: string|null, order: number }} ContextNode */

function formatContentForPrompt(content, dataType) {
  if (content == null) return "";
  if (dataType === "metric" && typeof content === "object") {
    const v = content.value ?? "";
    const u = content.unit ? ` ${content.unit}` : "";
    return `${v}${u}`.trim();
  }
  if (dataType === "date" && typeof content === "object") {
    const d = content.date || "";
    const t = content.time ? ` ${content.time}` : "";
    return `${d}${t}`.trim();
  }
  if (dataType === "checkbox") return content === true || content === "true" ? "yes" : "no";
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function canvasNodeToEntityId(canvasNode, nodeEntities) {
  if (!canvasNode) return null;
  if (canvasNode.noteId && nodeEntities[canvasNode.noteId]) return canvasNode.noteId;
  return null;
}

function entityToContextSlice(entity, order) {
  if (!entity) return null;
  return {
    id: entity.id,
    title: (entity.sourceQuery || entity.title || "Untitled").trim(),
    dataType: entity.dataType || "text",
    content: entity.content,
    anchorAt: entity.anchorAt ?? null,
    order,
  };
}

/**
 * Walk canvas wires backward (incoming edges to the query canvas node).
 * @returns {ContextNode[]}
 */
export function collectUpstreamFromCanvas({
  queryCanvasNodeId,
  queryNodeEntityId,
  canvasNodes,
  connections,
  nodeEntities,
}) {
  if (!canvasNodes?.length || !connections?.length) return [];

  let targetCanvasId = queryCanvasNodeId;
  if (!targetCanvasId && queryNodeEntityId) {
    const match = canvasNodes.find((n) => n.noteId === queryNodeEntityId);
    targetCanvasId = match?.id;
  }
  if (!targetCanvasId) return [];

  const incoming = new Map();
  for (const c of connections) {
    if (!incoming.has(c.to)) incoming.set(c.to, []);
    incoming.get(c.to).push(c.from);
  }

  const visited = new Set();
  const orderedCanvasIds = [];

  const walk = (canvasId) => {
    if (visited.has(canvasId)) return;
    visited.add(canvasId);
    const preds = incoming.get(canvasId) || [];
    for (const fromId of preds) walk(fromId);
    if (canvasId !== targetCanvasId) orderedCanvasIds.push(canvasId);
  };
  walk(targetCanvasId);

  return orderedCanvasIds
    .map((cid, idx) => {
      const cn = canvasNodes.find((n) => n.id === cid);
      const entityId = canvasNodeToEntityId(cn, nodeEntities);
      const entity = entityId ? nodeEntities[entityId] : null;
      if (!entity && cn) {
        return {
          id: cn.id,
          title: (cn.title || "Canvas node").trim(),
          dataType: cn.dataType || "text",
          content: cn.content ?? "",
          anchorAt: null,
          order: idx,
        };
      }
      return entityToContextSlice(entity, idx);
    })
    .filter(Boolean);
}

/**
 * Fallback: nodes in the same document before the active block (by index).
 */
export function collectUpstreamFromDoc({ docId, queryNodeEntityId, blockIndex }) {
  const doc = useDocsStore.getState().docs[docId];
  if (!doc?.blocks?.length) return [];

  const nodes = useNodesStore.getState().nodes;
  const ctx = [];
  const end = typeof blockIndex === "number" ? blockIndex : doc.blocks.length;

  for (let i = 0; i < end; i += 1) {
    const block = doc.blocks[i];
    const nodeId = block?.nodeId;
    if (!nodeId || nodeId === queryNodeEntityId) continue;
    const entity = nodes[nodeId];
    const slice = entityToContextSlice(entity, ctx.length);
    if (slice) ctx.push(slice);
  }
  return ctx;
}

export function collectUpstreamContext(payload) {
  const nodeEntities = payload.nodeEntities || useNodesStore.getState().nodes;
  const snap = payload.canvasSnapshot || useUIStateStore.getState().canvasSearchSnapshot;
  const canvasNodes = payload.canvasNodes ?? snap?.nodes ?? [];
  const connections = payload.canvasConnections ?? snap?.connections ?? [];

  const fromCanvas = collectUpstreamFromCanvas({
    queryCanvasNodeId: payload.queryCanvasNodeId,
    queryNodeEntityId: payload.queryNodeEntityId,
    canvasNodes,
    connections,
    nodeEntities,
  });
  if (fromCanvas.length > 0) return fromCanvas;

  if (payload.docId) {
    return collectUpstreamFromDoc({
      docId: payload.docId,
      queryNodeEntityId: payload.queryNodeEntityId,
      blockIndex: payload.blockIndex,
    });
  }
  return [];
}

function buildMockOverview(query, contextNodes) {
  const ctxLines = contextNodes
    .map((n, i) => `${i + 1}. **${n.title}** (${n.dataType}): ${formatContentForPrompt(n.content, n.dataType) || "—"}`)
    .join("\n");

  const ctxBlock = contextNodes.length
    ? `Using ${contextNodes.length} connected input node(s) as context:\n${ctxLines}\n\n`
    : "";

  return `${ctxBlock}**Answer:** ${query}\n\nBased on current web signals and your node graph, here is a synthesized overview. Key themes include product timing, supplier activity, and market reception. Use the citations below to verify sources and drill into details.`;
}

function intelToCitations(intelItems) {
  return intelItems.slice(0, 8).map((item, i) => ({
    id: item.id || `cite-${i + 1}`,
    title: item.title,
    url: `https://example.com/${encodeURIComponent(item.src || "source")}/${item.id}`,
    snippet: `${item.title} — reported by ${item.src}. Confidence ${item.confidence}%.`,
    source: item.src,
    confidence: item.confidence,
    category: item.category,
  }));
}

/**
 * Mock API — replace with POST /api/intel/search when backend exists.
 */
export async function fetchIntelSearch(query, contextNodes) {
  await new Promise((r) => setTimeout(r, MOCK_SEARCH_MS));
  const filtered = INTEL.filter((s) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q)
      || s.src.toLowerCase().includes(q)
      || (contextNodes.some((n) => String(n.title).toLowerCase().includes(q)))
    );
  });
  const citations = intelToCitations(filtered.length ? filtered : INTEL);
  return {
    overview: buildMockOverview(query, contextNodes),
    citations,
    tokensUsed: 1,
    model: "Ai 1.0",
  };
}

/**
 * Run full intel search pipeline (upstream context + model + store update).
 */
export async function runIntelSearch(payload) {
  const {
    query,
    queryNodeEntityId = null,
    queryCanvasNodeId = null,
    docId = null,
    blockIndex = null,
    nodeEntities,
    canvasNodes,
    canvasConnections,
  } = payload;

  const q = (query || "").trim();
  if (!q) return;

  const store = useUIStateStore.getState();
  store.setIntelSearchLoading({
    query: q,
    queryNodeEntityId,
    queryCanvasNodeId,
    docId,
    blockIndex,
  });

  try {
    const contextNodes = collectUpstreamContext({
      queryNodeEntityId,
      queryCanvasNodeId,
      docId,
      blockIndex,
      nodeEntities,
      canvasNodes,
      canvasConnections,
    });

    const result = await fetchIntelSearch(q, contextNodes);
    store.setIntelSearchSuccess({
      ...result,
      query: q,
      contextNodes,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    store.setIntelSearchError(err?.message || "Search failed");
  }
}
