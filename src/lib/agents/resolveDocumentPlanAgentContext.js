import { docBlocksFromBody, normalizeDocBlocks } from "../docBlocks.js";
import {
  docBlocksHaveAgentInstruction,
  extractAgentInstructionFromDocBlocks,
  extractAgentInstructionFromNodeEntity,
} from "../resolveAgentInstruction.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { isOrchestratorTargetDoc, resolveAgentGraph } from "./resolveAgentGraph.js";
import {
  resolveCompanyFilesContext,
} from "./resolveContentCreatorContext.js";
import { isKnowledgeDoc } from "../templateDoc.js";

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

function getDocBlocks(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc.body || doc.content || "");
}

function getDocBlocksWithDraft(doc, docId) {
  if (docId) {
    const draft = useUIStateStore.getState().docEditorDrafts[docId];
    if (draft?.blocks?.length) {
      const normalized = normalizeDocBlocks(draft.blocks);
      const hasAgentInstruction = docBlocksHaveAgentInstruction(normalized);
      const hasText = normalized.some((block) => String(block?.text || "").trim());
      if (hasAgentInstruction || hasText) {
        return normalized;
      }
    }
  }
  return getDocBlocks(doc);
}

/**
 * @param {object[]} nodes
 * @param {Record<string, object>} docsById
 */
function findWiredTargetDoc(nodes, docsById) {
  for (const node of nodes) {
    const doc = resolveDocFromCanvasNode(node, docsById);
    if (doc && isOrchestratorTargetDoc(doc)) {
      return { doc, node };
    }
  }
  return { doc: null, node: null };
}

/**
 * @param {object[]} inputNodes
 * @param {Record<string, object>} nodeEntitiesById
 */
function extractMacroAgentInstruction(inputNodes = [], nodeEntitiesById = {}) {
  for (const node of inputNodes) {
    if (!node?.noteId) continue;
    const entity = nodeEntitiesById[node.noteId];
    if (!entity) continue;
    const instruction = extractAgentInstructionFromNodeEntity(entity);
    if (instruction) return instruction;
  }
  return "";
}

/**
 * @param {object[]} inputNodes
 * @param {Record<string, object>} nodeEntitiesById
 * @param {Record<string, object>} docsById
 */
function resolveMacroParentContentDoc(inputNodes = [], nodeEntitiesById = {}, docsById = {}) {
  for (const node of inputNodes) {
    if (!node?.noteId) continue;
    const entity = nodeEntitiesById[node.noteId];
    const parentDocId = entity?.parentDocId || node.parentDocId;
    if (!parentDocId) continue;
    const parentDoc = docsById[parentDocId];
    if (parentDoc && isOrchestratorTargetDoc(parentDoc)) {
      return parentDoc;
    }
  }
  return null;
}

/**
 * Document-plan agents: instruction from Agent block in wired content doc or macro node.
 */
export function resolveDocumentPlanAgentContext({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
  nodeEntitiesById = {},
  selectedObjectId = null,
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

  const inputMatch = findWiredTargetDoc(graph.inputs || [], docsById);
  const outputMatch = findWiredTargetDoc(graph.outputs || [], docsById);

  let targetDoc = graph.targetDoc || inputMatch.doc || outputMatch.doc || null;
  let wireOutputDocCanvasNodeId = null;

  if (!inputMatch.doc && outputMatch.doc) {
    wireOutputDocCanvasNodeId = outputMatch.node?.id || null;
  }

  if (!targetDoc) {
    targetDoc = resolveMacroParentContentDoc(
      graph.inputs || [],
      nodeEntitiesById,
      docsById,
    );
  }

  let instruction = "";
  if (targetDoc?.id) {
    instruction = extractAgentInstructionFromDocBlocks(
      getDocBlocksWithDraft(targetDoc, targetDoc.id),
    );
  }

  if (!instruction) {
    instruction = extractMacroAgentInstruction(graph.inputs || [], nodeEntitiesById);
  }

  if (!targetDoc && instruction) {
    targetDoc = resolveMacroParentContentDoc(
      graph.inputs || [],
      nodeEntitiesById,
      docsById,
    );
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
    instruction,
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
