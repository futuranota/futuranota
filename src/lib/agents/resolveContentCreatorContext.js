import { docBlocksFromBody, docBlocksToBody, normalizeDocBlocks } from "../docBlocks.js";
import {
  extractAgentInstructionFromDocBlocks,
  extractAgentInstructionFromNodeEntity,
} from "../resolveAgentInstruction.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { resolveAgentGraph } from "./resolveAgentGraph.js";
import { extractKnowledgeDocBody } from "./resolveAgentKnowledgeContext.js";
import {
  isContentDoc,
  isKnowledgeDoc,
  listKnowledgeDocs,
  resolveKnowledgeDocDisplayTitle,
} from "../templateDoc.js";

const DEFAULT_MAX_CHARS = 8000;

/**
 * @param {object | null | undefined} node
 * @param {Record<string, object>} docsById
 */
function resolveDocFromCanvasNode(node, docsById = {}) {
  if (!node) return null;
  const docId = node.docId || node.noteId;
  if (!docId) return null;
  return docsById[docId] || null;
}

/**
 * @param {object | null | undefined} doc
 * @returns {unknown[]}
 */
function getDocBlocks(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc.body || doc.content || "");
}

/**
 * Prefer unsaved editor draft blocks (user may have /agent open without saving).
 * @param {object | null | undefined} doc
 * @param {string | null | undefined} docId
 */
function getDocBlocksWithDraft(doc, docId) {
  if (docId) {
    const draft = useUIStateStore.getState().docEditorDrafts[docId];
    if (draft?.blocks?.length) {
      return normalizeDocBlocks(draft.blocks);
    }
  }
  return getDocBlocks(doc);
}

/**
 * @param {object[]} nodes
 * @param {Record<string, object>} docsById
 */
function findWiredContentDoc(nodes, docsById) {
  for (const node of nodes) {
    const doc = resolveDocFromCanvasNode(node, docsById);
    if (doc && isContentDoc(doc)) {
      return { doc, node };
    }
  }
  return { doc: null, node: null };
}

/**
 * @param {object[]} inputNodes
 * @param {Record<string, object>} nodeEntitiesById
 * @param {string | null} [preferredMacroEntityId]
 */
function findWiredMacroBlogSource(
  inputNodes = [],
  nodeEntitiesById = {},
  preferredMacroEntityId = null,
) {
  const tryNode = (node) => {
    if (!node?.noteId) return null;
    const entity = nodeEntitiesById[node.noteId];
    if (!entity) return null;
    const instruction = extractAgentInstructionFromNodeEntity(entity)
      || String(entity.title || node.title || "").trim();
    if (!instruction) return null;
    const title = String(entity.title || node.title || "").trim();
    return {
      nodeEntityId: node.noteId,
      canvasNodeId: node.id,
      title,
      instruction,
      anchorAt: entity.anchorAt || node.anchorAt || null,
      parentDocId: entity.parentDocId || node.parentDocId || null,
    };
  };

  if (preferredMacroEntityId) {
    const preferred = inputNodes.find((n) => n.noteId === preferredMacroEntityId);
    const match = preferred ? tryNode(preferred) : null;
    if (match) return match;
  }

  for (const node of inputNodes) {
    const match = tryNode(node);
    if (match) return match;
  }
  return null;
}

/**
 * @param {object[]} inputNodes
 * @param {Record<string, object>} nodeEntitiesById
 */
function extractMacroAgentInstruction(inputNodes, nodeEntitiesById = {}) {
  return findWiredMacroBlogSource(inputNodes, nodeEntitiesById)?.instruction || "";
}

/**
 * Knowledge wired on canvas + global knowledge corpus (company files / memory).
 */
export function resolveCompanyFilesContext(
  inputNodes = [],
  docsById = {},
  excludeDocIds = [],
  maxChars = DEFAULT_MAX_CHARS,
) {
  const exclude = new Set(excludeDocIds.filter(Boolean));
  const seenDocIds = new Set();
  const sections = [];

  const pushDoc = (doc) => {
    if (!doc?.id || exclude.has(doc.id) || seenDocIds.has(doc.id)) return;
    if (!isKnowledgeDoc(doc)) return;
    const body = extractKnowledgeDocBody(doc);
    if (!body) return;
    seenDocIds.add(doc.id);
    const title = resolveKnowledgeDocDisplayTitle(doc) || doc.title || "Knowledge";
    sections.push(`## ${title}\n${body}`);
  };

  for (const node of inputNodes) {
    pushDoc(resolveDocFromCanvasNode(node, docsById));
  }

  for (const doc of listKnowledgeDocs(docsById)) {
    pushDoc(doc);
  }

  if (sections.length === 0) return "";

  let combined = sections.join("\n\n");
  if (combined.length > maxChars) {
    combined = `${combined.slice(0, maxChars)}\n…`;
  }
  return combined;
}

/**
 * @param {object} params
 * @param {string} params.agentCanvasNodeId
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.connections
 * @param {Record<string, object>} params.docsById
 * @param {Record<string, object>} params.objectsById
 * @param {Record<string, object>} [params.nodeEntitiesById]
 * @param {string | null} [params.selectedObjectId]
 * @param {string | null} [params.preferredMacroEntityId]
 * @param {'en' | 'es'} [params.locale]
 */
export function resolveContentCreatorContext({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  selectedObjectId = null,
  preferredMacroEntityId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";

  const graph = resolveAgentGraph({
    agentCanvasNodeId,
    canvasNodes,
    connections,
    docsById,
    objectsById,
    selectedObjectId,
    locale: lang,
  });

  const inputMatch = findWiredContentDoc(graph.inputs || [], docsById);
  const outputMatch = findWiredContentDoc(graph.outputs || [], docsById);

  let targetDoc = inputMatch.doc || outputMatch.doc || null;
  let wireOutputDocCanvasNodeId = null;

  if (!inputMatch.doc && outputMatch.doc) {
    wireOutputDocCanvasNodeId = outputMatch.node?.id || null;
  }

  // Macro parent doc as target when doc card not wired directly
  if (!targetDoc) {
    for (const node of graph.inputs || []) {
      if (!node?.noteId) continue;
      const entity = nodeEntitiesById[node.noteId];
      const parentDocId = entity?.parentDocId;
      if (!parentDocId) continue;
      const parentDoc = docsById[parentDocId];
      if (parentDoc && isContentDoc(parentDoc)) {
        targetDoc = parentDoc;
        break;
      }
    }
  }

  const macroSource = findWiredMacroBlogSource(
    graph.inputs || [],
    nodeEntitiesById,
    preferredMacroEntityId,
  );

  let mode = "document_plan";
  let instruction = "";
  let macroTitle = "";
  let targetNodeEntityId = null;
  let targetCanvasNodeId = null;
  let scheduleAt = null;

  if (macroSource) {
    mode = "macro_blog";
    instruction = macroSource.instruction;
    macroTitle = macroSource.title;
    targetNodeEntityId = macroSource.nodeEntityId;
    targetCanvasNodeId = macroSource.canvasNodeId;
    scheduleAt = macroSource.anchorAt;
    if (macroSource.parentDocId) {
      const parentDoc = docsById[macroSource.parentDocId];
      if (parentDoc && isContentDoc(parentDoc)) {
        targetDoc = parentDoc;
      }
    }
  } else if (targetDoc?.id) {
    instruction = extractAgentInstructionFromDocBlocks(
      getDocBlocksWithDraft(targetDoc, targetDoc.id),
    );
  }

  if (!instruction) {
    instruction = extractMacroAgentInstruction(graph.inputs || [], nodeEntitiesById);
  }

  const objectNode = (graph.inputs || []).find(
    (n) => n && (n.canvasKind === "object" || n.dataType === "object"),
  );

  const objectFromWire = objectNode?.objectId ? objectsById[objectNode.objectId] : null;
  const objectFromDoc = targetDoc?.parentObjectId
    ? objectsById[targetDoc.parentObjectId]
    : null;
  const objectFromSelection = selectedObjectId ? objectsById[selectedObjectId] : null;
  const object = objectFromWire || objectFromDoc || objectFromSelection || null;

  const brandName = (
    object?.brand
    || object?.name
    || graph.brandName
    || ""
  ).trim();

  const brandContext = {
    name: (object?.name || brandName || "").trim(),
    brand: brandName,
    description: String(object?.description || "").trim(),
    objectId: object?.id || objectNode?.objectId || targetDoc?.parentObjectId || selectedObjectId || null,
  };

  const knowledgeContext = resolveCompanyFilesContext(
    graph.inputs || [],
    docsById,
    targetDoc?.id ? [targetDoc.id] : [],
  );

  const wiredInputs = (graph.inputs || []).map((node) => {
    if (node.canvasKind === "object" || node.dataType === "object") {
      const obj = objectsById[node.objectId];
      return {
        kind: "object",
        name: obj?.name || "",
        brand: obj?.brand || obj?.name || "",
        description: String(obj?.description || "").slice(0, 400),
      };
    }
    const doc = resolveDocFromCanvasNode(node, docsById);
    if (doc) {
      return {
        kind: isKnowledgeDoc(doc) ? "knowledge" : "document",
        title: doc.title || "",
        docKind: doc.docKind || "",
      };
    }
    if (node.noteId && nodeEntitiesById[node.noteId]) {
      return {
        kind: "macroNode",
        title: nodeEntitiesById[node.noteId]?.title || node.title || "",
      };
    }
    return { kind: node.canvasKind || node.dataType || "node", title: node.title || "" };
  });

  return {
    lang,
    graph,
    mode,
    instruction,
    macroTitle,
    targetNodeEntityId,
    targetCanvasNodeId,
    scheduleAt,
    brandName,
    brandContext,
    targetDocId: targetDoc?.id || null,
    targetDoc,
    wireOutputDocCanvasNodeId,
    knowledgeContext,
    wiredInputs,
    parentObjectId: targetDoc?.parentObjectId || brandContext.objectId || null,
  };
}
