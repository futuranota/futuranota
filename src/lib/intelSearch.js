import { API_ROUTES } from "../api/routes.js";
import { supabase } from "./supabaseClient.js";
import { getSupabaseAccessToken } from "./apiAuth.js";
import { useLocaleStore } from "../i18n/localeStore.js";
import { messages } from "../i18n/messages.js";
import { useUIStateStore } from "../stores/uiStateStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { useDocsStore } from "../stores/docsStore.js";
import { usePlanStore } from "../stores/planStore.js";
import { useUpgradeModalStore } from "../stores/upgradeModalStore.js";
import { canSpendCredits } from "./planConfig.js";
import { isAdminBillingBypassEnabled, isAdminSessionEmail } from "./adminPlanCredits.js";
import { DEFAULT_INTEL_MODEL_ID, getIntelModel, resolveIntelModelForPlan } from "./intelModels.js";

/** @typedef {{ id: string, title: string, dataType: string, content: unknown, anchorAt?: string|null, order: number }} ContextNode */

async function authedFetch(url, init = {}, { retried = false } = {}) {
  const accessToken = await getSupabaseAccessToken({ forceRefresh: retried });
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && !retried) {
    return authedFetch(url, init, { retried: true });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const err = new Error(parsed?.error || body.slice(0, 200) || res.statusText);
    err.status = res.status;
    err.code = parsed?.code;
    throw err;
  }
  return res.json();
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

export async function fetchIntelSearch(query, contextNodes, modelId, locale = "es") {
  return authedFetch(API_ROUTES.intelOverview, {
    method: "POST",
    body: JSON.stringify({
      query,
      contextNodes,
      modelId: modelId || DEFAULT_INTEL_MODEL_ID,
      locale: locale === "en" ? "en" : "es",
    }),
  });
}

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
    modelId: payloadModelId = null,
  } = payload;

  const q = (query || "").trim();
  if (!q) return;

  const locale = useLocaleStore.getState().locale === "en" ? "en" : "es";
  const tIntel = (key) => messages[locale]?.intel?.[key] ?? messages.en.intel[key];

  const uiState = useUIStateStore.getState();
  if (uiState.intelSearchStatus === "loading") return;

  const requestedModelId = payloadModelId || uiState.intelSelectedModelId || DEFAULT_INTEL_MODEL_ID;

  const planStore = usePlanStore.getState();
  const { profile } = planStore;
  const accessToken = await getSupabaseAccessToken();
  const { data: { session } } = await supabase.auth.getSession();
  const sessionEmail = session?.user?.email;
  const isAdminUser = isAdminSessionEmail(sessionEmail);
  const effectivePlan = (isAdminUser && isAdminBillingBypassEnabled()) || profile.plan === "pro"
    ? "pro"
    : "free";
  const model = resolveIntelModelForPlan(requestedModelId, effectivePlan);

  if (model.id !== requestedModelId) {
    uiState.setIntelSelectedModelId(model.id);
  }

  if (!accessToken) {
    uiState.setIntelSearchError(tIntel("sessionExpired"));
    return;
  }

  if (!canSpendCredits(profile, model.creditCost)) {
    useUpgradeModalStore.getState().show(effectivePlan === "free" ? "search" : "tokens");
    return;
  }

  const usageSnapshot = planStore.chargeIntelSearchCredit({
    creditCost: model.creditCost,
    tokenCost: model.tokenCost,
  });

  uiState.setIntelSearchLoading({
    query: q,
    queryNodeEntityId,
    queryCanvasNodeId,
    docId,
    blockIndex,
    modelId: model.id,
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

    const result = await fetchIntelSearch(q, contextNodes, model.id, locale);

    planStore.applyServerIntelUsage({
      plan: result.plan === "pro" ? "pro" : result.plan === "free" ? "free" : undefined,
      tokensBalance: result.tokensBalance,
      searchCount: result.searchCount,
    });

    uiState.setIntelSearchSuccess({
      overview: result.overview,
      citations: result.citations,
      tokensUsed: result.tokensDebited ?? result.tokensUsed,
      creditsDebited: result.creditsDebited ?? model.creditCost,
      modelId: result.modelId ?? model.id,
      modelLabel: result.modelLabel ?? model.label,
      model: result.modelLabel ?? model.label,
      query: q,
      queryNodeEntityId,
      queryCanvasNodeId,
      docId,
      blockIndex,
      contextNodes,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    planStore.rollbackIntelSearchCredit(usageSnapshot);
    if (err?.status === 401 || err?.code === "auth") {
      uiState.setIntelSearchError(tIntel("sessionExpired"));
      return;
    }
    if (err?.code === "search" || err?.code === "tokens") {
      useUpgradeModalStore.getState().show(err.code);
    } else if (err?.code === "model") {
      useUpgradeModalStore.getState().show("search");
    }
    uiState.setIntelSearchError(err?.message || tIntel("searchFailed"));
  }
}
