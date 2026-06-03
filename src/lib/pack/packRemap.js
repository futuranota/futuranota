import { generateId } from "../ids.js";
import { normalizeDoc } from "../normalizeDoc.js";
import { isKnowledgeDoc } from "../templateDoc.js";

const PREFIX_MAP = {
  OBJ: "OBJ",
  DOC: "DOC",
  NODE: "NODE",
  CN: "CN",
};

/**
 * @param {string} oldId
 */
function prefixFromId(oldId) {
  const head = String(oldId || "").split("-")[0];
  return PREFIX_MAP[head] || "ID";
}

/**
 * @param {Record<string, { id: string }>} entitiesById
 */
export function createIdRemap(entitiesById) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const oldId of Object.keys(entitiesById || {})) {
    map[oldId] = generateId(prefixFromId(oldId));
  }
  return map;
}

/**
 * @param {string[]} ids
 * @param {Record<string, string>} idMap
 */
function remapIdList(ids, idMap) {
  return (ids || [])
    .map((id) => idMap[id] || id)
    .filter(Boolean);
}

/**
 * @param {import('./packSchema.js').ReturnType<import('./packImport.js').parsePackFromJson> extends never ? any : object} pack
 * @param {Record<string, string>} idMap
 */
export function remapPackModel(pack, idMap) {
  const { model, graph } = pack;

  const objects = {};
  for (const [oldId, obj] of Object.entries(model.objects)) {
    const newId = idMap[oldId] || generateId("OBJ");
    idMap[oldId] = newId;
    objects[newId] = {
      ...obj,
      id: newId,
      children: remapIdList(obj.children, idMap),
    };
  }

  const docs = {};
  for (const [oldId, doc] of Object.entries(model.docs)) {
    const newId = idMap[oldId] || generateId("DOC");
    idMap[oldId] = newId;
    const subIds = doc.subcategoryDocIds ?? doc.templateSubcategoryDocIds ?? [];
    docs[newId] = normalizeDoc({
      ...doc,
      id: newId,
      parentObjectId: isKnowledgeDoc(doc) ? null : doc.parentObjectId,
      nodeIds: remapIdList(doc.nodeIds, idMap),
      subcategoryDocIds: remapIdList(subIds, idMap),
      templateSubcategoryDocIds: remapIdList(subIds, idMap),
    });
  }

  const nodes = {};
  for (const [oldId, node] of Object.entries(model.nodes)) {
    const newId = idMap[oldId] || generateId("NODE");
    idMap[oldId] = newId;
    nodes[newId] = {
      ...node,
      id: newId,
      parentDocId: node.parentDocId ? idMap[node.parentDocId] || null : null,
      parentNodeId: node.parentNodeId ? idMap[node.parentNodeId] || null : null,
      objectId: node.objectId ? idMap[node.objectId] || null : null,
      canvasConnections: remapIdList(node.canvasConnections, idMap),
    };
  }

  let remappedGraph = null;
  if (graph) {
    const canvasNodes = {};
    for (const [oldId, cn] of Object.entries(graph.canvasNodes || {})) {
      const newId = idMap[oldId] || generateId("CN");
      idMap[oldId] = newId;
      canvasNodes[newId] = {
        ...cn,
        id: newId,
        nodeId: cn.nodeId ? idMap[cn.nodeId] || cn.nodeId : cn.nodeId,
      };
    }
    const canvasConnections = {};
    for (const [oldId, conn] of Object.entries(graph.canvasConnections || {})) {
      const newId = idMap[oldId] || generateId("ID");
      idMap[oldId] = newId;
      canvasConnections[newId] = {
        ...conn,
        id: newId,
        from: idMap[conn.from] || conn.from,
        to: idMap[conn.to] || conn.to,
      };
    }
    remappedGraph = {
      canvasNodes,
      canvasConnections,
      groupings: graph.groupings || {},
    };
  }

  const oldRoot = pack.manifest.rootObjectId;
  const newRootId = oldRoot ? idMap[oldRoot] : Object.keys(objects)[0];

  return {
    objects,
    docs,
    nodes,
    graph: remappedGraph,
    newRootObjectId: newRootId,
    idMap,
  };
}
