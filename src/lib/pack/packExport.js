import { useCanvasStore } from "../../stores/canvasStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { buildStarterProductPack, collectPackSlice } from "./packCollect.js";

export { buildStarterProductPack };
import { PACK_FILE_EXTENSION } from "./packSchema.js";
import { packToZipBlob } from "./packZip.js";

/**
 * @param {string} rootObjectId
 * @param {{ includeGraph?: boolean, includeKnowledge?: boolean }} [options]
 */
export function buildPackFromStores(rootObjectId, options = {}) {
  const state = {
    objects: useObjectsStore.getState().objects,
    docs: useDocsStore.getState().docs,
    nodes: useNodesStore.getState().nodes,
    canvasNodes: useCanvasStore.getState().canvasNodes,
    canvasConnections: useCanvasStore.getState().canvasConnections,
    groupings: useCanvasStore.getState().groupings,
  };
  return collectPackSlice(state, rootObjectId, options);
}

/**
 * @param {ReturnType<typeof collectPackSlice>} pack
 * @param {string} [filename]
 */
export async function downloadPackFile(pack, filename) {
  const safeName = (pack.manifest.name || "futura-nota-pack")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "futura-nota-pack";
  const blob = await packToZipBlob(pack);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${safeName}${PACK_FILE_EXTENSION}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {string} rootObjectId
 * @param {{ includeGraph?: boolean }} [options]
 */
export async function exportObjectPack(rootObjectId, options = {}) {
  const pack = buildPackFromStores(rootObjectId, {
    includeGraph: options.includeGraph ?? false,
    includeKnowledge: false,
  });
  await downloadPackFile(pack);
  return pack;
}
