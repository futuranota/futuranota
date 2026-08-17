import { normalizeDoc } from "../normalizeDoc.js";
import { OBJECT_ROLE_CORPUS, OBJECT_ROLE_SATELLITE } from "../objectColors.js";
import { isKnowledgeDoc } from "../templateDoc.js";
import { useCanvasStore } from "../../stores/canvasStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { parsePackFile } from "./packSchema.js";
import { createIdRemap, remapPackModel } from "./packRemap.js";
import { PACK_FORMAT_FOLDER_V2 } from "./packSchema.js";
import { parseZipPack } from "./packZip.js";
import { parseZipPackV2 } from "./packV2Zip.js";
import JSZip from "jszip";

/**
 * @typedef {'new-object' | 'merge-into'} PackImportMode
 */

/**
 * @param {string|object} raw
 */
export function parsePackFromJson(raw) {
  return parsePackFile(raw);
}

/**
 * Drop knowledge docs from pack (products + content only).
 * @param {ReturnType<typeof parsePackFile>} pack
 */
export function stripKnowledgeFromPack(pack) {
  const docs = {};
  for (const [id, doc] of Object.entries(pack.model.docs)) {
    if (!isKnowledgeDoc(doc)) docs[id] = doc;
  }
  return {
    ...pack,
    manifest: {
      ...pack.manifest,
      counts: {
        ...pack.manifest.counts,
        knowledge: 0,
        docs: Object.keys(docs).length,
      },
    },
    model: {
      ...pack.model,
      docs,
    },
  };
}

/**
 * @param {File} file
 */
async function readManifestFromZip(zip) {
  const direct = zip.file("manifest.json");
  if (direct) {
    try {
      return JSON.parse(await direct.async("string"));
    } catch {
      return null;
    }
  }
  const nestedPath = Object.keys(zip.files).find(
    (p) => !zip.files[p].dir && /(^|\/)manifest\.json$/.test(p),
  );
  if (!nestedPath) return null;
  try {
    return JSON.parse(await zip.file(nestedPath).async("string"));
  } catch {
    return null;
  }
}

export async function readPackFile(file) {
  const name = (file.name || "").toLowerCase();
  const isZip = name.endsWith(".zip") || file.type === "application/zip";
  let parsed;
  if (isZip) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const manifest = await readManifestFromZip(zip);
    if (manifest?.packFormat === PACK_FORMAT_FOLDER_V2) {
      parsed = await parseZipPackV2(zip);
    } else {
      parsed = await parseZipPack(buffer);
    }
  } else {
    parsed = parsePackFromJson(await file.text());
  }
  return stripKnowledgeFromPack(parsed);
}

/**
 * @param {ReturnType<typeof parsePackFile>} pack
 * @param {{ mode: PackImportMode, targetObjectId?: string|null }} options
 */
export function applyPackImport(pack, options) {
  const { mode, targetObjectId = null } = options;
  const idMap = createIdRemap({
    ...pack.model.objects,
    ...pack.model.docs,
    ...pack.model.nodes,
    ...(pack.graph?.canvasNodes || {}),
    ...(pack.graph?.canvasConnections || {}),
  });

  const remapped = remapPackModel(pack, idMap);
  const srcRoot = Object.values(remapped.objects)[0];
  if (!srcRoot) throw new Error("Pack has no object to import");

  const objectsStore = useObjectsStore.getState();
  const existingObjects = objectsStore.objects;
  const hasCorpus = Object.values(existingObjects).some(
    (o) => o.role === OBJECT_ROLE_CORPUS,
  );

  let rootObjectId = targetObjectId;

  if (mode === "new-object") {
    rootObjectId = objectsStore.addObject(
      srcRoot.name || pack.manifest.name,
      srcRoot.description || "",
      srcRoot.color || undefined,
      srcRoot.brand || pack.manifest.brand || "",
      hasCorpus ? OBJECT_ROLE_SATELLITE : OBJECT_ROLE_CORPUS,
    );
  } else if (!rootObjectId) {
    throw new Error("Select an object to merge into");
  }

  const nextObjects = { ...useObjectsStore.getState().objects };
  const nextDocs = { ...useDocsStore.getState().docs };
  const nextNodes = { ...useNodesStore.getState().nodes };
  const nextCanvasNodes = { ...useCanvasStore.getState().canvasNodes };
  const nextConnections = { ...useCanvasStore.getState().canvasConnections };
  const nextGroupings = { ...useCanvasStore.getState().groupings };

  const root = nextObjects[rootObjectId];
  const childDocIds = [...(root?.children || [])];

  for (const [id, obj] of Object.entries(remapped.objects)) {
    if (id === remapped.newRootObjectId) continue;
    nextObjects[id] = obj;
  }

  for (const [docId, doc] of Object.entries(remapped.docs)) {
    if (isKnowledgeDoc(doc)) continue;
    const normalized = normalizeDoc({
      ...doc,
      parentObjectId: rootObjectId,
    });
    nextDocs[docId] = normalized;
    if (!childDocIds.includes(docId)) {
      childDocIds.push(docId);
    }
  }

  for (const [nodeId, node] of Object.entries(remapped.nodes)) {
    nextNodes[nodeId] = node;
    const parentDocId = node.parentDocId;
    if (parentDocId && nextDocs[parentDocId]) {
      const doc = nextDocs[parentDocId];
      const nodeIds = doc.nodeIds?.includes(nodeId)
        ? doc.nodeIds
        : [...(doc.nodeIds || []), nodeId];
      nextDocs[parentDocId] = { ...doc, nodeIds };
    }
  }

  if (remapped.graph) {
    Object.assign(nextCanvasNodes, remapped.graph.canvasNodes);
    Object.assign(nextConnections, remapped.graph.canvasConnections);
    Object.assign(nextGroupings, remapped.graph.groupings);
  }

  nextObjects[rootObjectId] = {
    ...nextObjects[rootObjectId],
    name: mode === "merge-into"
      ? nextObjects[rootObjectId].name
      : (srcRoot.name || nextObjects[rootObjectId].name),
    brand: srcRoot.brand || pack.manifest.brand || nextObjects[rootObjectId].brand,
    children: [...new Set(childDocIds)],
    updatedAt: new Date().toISOString(),
  };

  useObjectsStore.setState({ objects: nextObjects });
  useDocsStore.setState({ docs: nextDocs });
  useNodesStore.setState({ nodes: nextNodes });
  if (remapped.graph) {
    useCanvasStore.setState({
      canvasNodes: nextCanvasNodes,
      canvasConnections: nextConnections,
      groupings: nextGroupings,
    });
  }

  return {
    rootObjectId,
    counts: {
      docs: Object.keys(remapped.docs).length,
      nodes: Object.keys(remapped.nodes).length,
      products: pack.manifest.counts?.products ?? 0,
      content: pack.manifest.counts?.content ?? 0,
      knowledge: pack.manifest.counts?.knowledge ?? 0,
    },
  };
}

/**
 * @param {ReturnType<typeof parsePackFile>} pack
 */
export function summarizePack(pack) {
  return {
    name: pack.manifest.name,
    brand: pack.manifest.brand || "",
    packType: pack.manifest.packType,
    counts: pack.manifest.counts,
    includesGraph: pack.manifest.includesGraph,
    steps: pack.manifest.steps || [],
  };
}
