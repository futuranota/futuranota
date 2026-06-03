import {
  isContentDoc,
  isKnowledgeDoc,
  isProductDoc,
  listContentDocs,
  listKnowledgeDocs,
  listProductDocs,
} from "../templateDoc.js";
import { buildManifest } from "./packSchema.js";

/**
 * @param {Record<string, import('../../types/docs.js').Doc>} docs
 * @param {string} docId
 */
function buildDocKey(docs, docId) {
  const doc = docs[docId];
  if (!doc) return `doc:${docId}`;
  if (isProductDoc(doc)) {
    const cat = (doc.category || "").trim() || "product";
    const ver = (doc.version || "").trim();
    return `product:${cat}:${ver}`;
  }
  if (isContentDoc(doc)) {
    const title = (doc.title || "").trim() || "content";
    return `content:${title}`;
  }
  if (isKnowledgeDoc(doc)) {
    const label = doc.knowledgeImport?.fileName || doc.title || docId;
    return `knowledge:${label}`;
  }
  return `doc:${doc.title || docId}`;
}

/**
 * @param {Object} state
 * @param {string} rootObjectId
 * @param {{ includeGraph?: boolean, includeKnowledge?: boolean }} [options]
 */
export function collectPackSlice(
  state,
  rootObjectId,
  options = {},
) {
  const { includeGraph = false, includeKnowledge = false } = options;
  const { objects, docs, nodes, canvasNodes, canvasConnections, groupings } = state;

  const root = objects[rootObjectId];
  if (!root) {
    throw new Error("Object not found for export");
  }

  const docIds = new Set();
  listProductDocs(docs, rootObjectId).forEach((d) => docIds.add(d.id));
  listContentDocs(docs, rootObjectId).forEach((d) => docIds.add(d.id));

  if (includeKnowledge) {
    listKnowledgeDocs(docs).forEach((d) => docIds.add(d.id));
  }

  const nodeIds = new Set();
  for (const node of Object.values(nodes)) {
    if (node.parentDocId && docIds.has(node.parentDocId)) {
      nodeIds.add(node.id);
    }
    if (node.objectId === rootObjectId) {
      nodeIds.add(node.id);
    }
  }

  const exportedDocs = {};
  const docKeys = {};
  for (const id of docIds) {
    if (docs[id]) {
      exportedDocs[id] = { ...docs[id] };
      docKeys[id] = buildDocKey(docs, id);
    }
  }

  const exportedNodes = {};
  for (const id of nodeIds) {
    if (nodes[id]) exportedNodes[id] = { ...nodes[id] };
  }

  const exportedObjects = {
    [rootObjectId]: { ...root },
  };

  /** @type {import('./packSchema.js').PackManifest['counts']} */
  const counts = {
    objects: 1,
    products: listProductDocs(docs, rootObjectId).length,
    content: listContentDocs(docs, rootObjectId).length,
    knowledge: includeKnowledge ? listKnowledgeDocs(docs).length : 0,
    docs: Object.keys(exportedDocs).length,
    nodes: Object.keys(exportedNodes).length,
  };

  let graph = null;
  if (includeGraph) {
    const canvasNodeIds = new Set();
    for (const cn of Object.values(canvasNodes)) {
      if (cn.nodeId && nodeIds.has(cn.nodeId)) {
        canvasNodeIds.add(cn.id);
      }
    }
    const exportedCanvasNodes = {};
    for (const id of canvasNodeIds) {
      exportedCanvasNodes[id] = { ...canvasNodes[id] };
    }
    const exportedConnections = {};
    for (const conn of Object.values(canvasConnections)) {
      if (canvasNodeIds.has(conn.from) && canvasNodeIds.has(conn.to)) {
        exportedConnections[conn.id] = { ...conn };
      }
    }
    graph = {
      canvasNodes: exportedCanvasNodes,
      canvasConnections: exportedConnections,
      groupings: { ...groupings },
    };
    counts.canvasNodes = Object.keys(exportedCanvasNodes).length;
    counts.connections = Object.keys(exportedConnections).length;
  }

  const manifest = buildManifest({
    packType: "corpus-pack",
    name: root.name || "Untitled model",
    brand: root.brand || "",
    description: root.description || "",
    counts,
    rootObjectId,
    includesGraph: Boolean(graph),
  });

  return {
    manifest,
    model: {
      objects: exportedObjects,
      docs: exportedDocs,
      nodes: exportedNodes,
      docKeys,
    },
    graph,
  };
}

/**
 * Empty starter pack for sharing structure (one product + one content shell).
 * @param {Object} params
 * @param {string} params.brandName
 * @param {string} params.productCategory
 */
export function buildStarterProductPack({ brandName, productCategory }) {
  const now = new Date().toISOString();
  const rootId = "OBJ-EXPORT-ROOT";
  const productId = "DOC-EXPORT-PRODUCT";
  const contentId = "DOC-EXPORT-CONTENT";

  const manifest = buildManifest({
    packType: "product-model",
    name: `${brandName} launch kit`,
    brand: brandName,
    counts: {
      objects: 1,
      products: 1,
      content: 1,
      knowledge: 0,
      docs: 2,
      nodes: 0,
    },
    rootObjectId: rootId,
    includesGraph: false,
  });

  return {
    manifest,
    model: {
      objects: {
        [rootId]: {
          id: rootId,
          name: brandName,
          brand: brandName,
          description: "",
          children: [productId, contentId],
          color: null,
          role: "corpus",
          createdAt: now,
          updatedAt: now,
        },
      },
      docs: {
        [productId]: {
          id: productId,
          title: productCategory,
          parentObjectId: rootId,
          content: "",
          body: "",
          blocks: [],
          dataProperties: [],
          tags: [],
          nodeIds: [],
          docKind: "product",
          category: productCategory,
          version: "",
          subcategoryDocIds: [],
          createdAt: now,
          updatedAt: now,
        },
        [contentId]: {
          id: contentId,
          title: "Launch brief",
          parentObjectId: rootId,
          content: "",
          body: "",
          blocks: [],
          dataProperties: [],
          tags: [],
          nodeIds: [],
          docKind: "content",
          category: "",
          version: "",
          subcategoryDocIds: [productId],
          createdAt: now,
          updatedAt: now,
        },
      },
      nodes: {},
      docKeys: {
        [productId]: `product:${productCategory}:`,
        [contentId]: "content:Launch brief",
      },
    },
    graph: null,
  };
}
