import { docBlocksFromBody, normalizeDocBlocks } from "../docBlocks.js";
import { extractAgentInstructionFromDocBlocks } from "../resolveAgentInstruction.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { resolveAgentGraph } from "./resolveAgentGraph.js";
import {
  resolveCompanyFilesContext,
} from "./resolveContentCreatorContext.js";
import { isContentDoc, isKnowledgeDoc } from "../templateDoc.js";

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
      return normalizeDocBlocks(draft.blocks);
    }
  }
  return getDocBlocks(doc);
}

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
 * Document-plan agents: instruction from /agent in wired content doc only (no macro_blog).
 */
export function resolveDocumentPlanAgentContext({
  agentCanvasNodeId,
  canvasNodes = [],
  connections = [],
  docsById = {},
  objectsById = {},
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

  const inputMatch = findWiredContentDoc(graph.inputs || [], docsById);
  const outputMatch = findWiredContentDoc(graph.outputs || [], docsById);

  let targetDoc = inputMatch.doc || outputMatch.doc || null;
  let wireOutputDocCanvasNodeId = null;

  if (!inputMatch.doc && outputMatch.doc) {
    wireOutputDocCanvasNodeId = outputMatch.node?.id || null;
  }

  const instruction = targetDoc?.id
    ? extractAgentInstructionFromDocBlocks(getDocBlocksWithDraft(targetDoc, targetDoc.id))
    : "";

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
