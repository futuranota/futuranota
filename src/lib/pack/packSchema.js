/** @typedef {'product-model' | 'corpus-pack'} PackType */
/** @typedef {'new-object' | 'merge-into'} PackImportMode */

export const PACK_SCHEMA_VERSION = 1;
export const PACK_SCHEMA_VERSION_V2 = 2;
export const PACK_FORMAT_FOLDER_V2 = "folder-v2";
export const PACK_FILE_EXTENSION = ".zip";
export const PACK_V2_FILE_SUFFIX = "-v2";
/** @deprecated legacy single-file export */
export const PACK_LEGACY_EXTENSION = ".fnota";
export const PACK_MIME = "application/zip";

/** Import wizard stacks (Knowledge omitted from packs). */
export const PACK_STEPS = ["brand", "products", "content"];

/**
 * @param {unknown} value
 */
export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} manifest
 */
export function validateManifest(manifest) {
  if (!isRecord(manifest)) throw new Error("Invalid pack: missing manifest");
  const version = manifest.schemaVersion;
  if (version !== PACK_SCHEMA_VERSION && version !== PACK_SCHEMA_VERSION_V2) {
    throw new Error(`Unsupported pack version (${version})`);
  }
  if (!manifest.name || typeof manifest.name !== "string") {
    throw new Error("Invalid pack: manifest.name required");
  }
  return /** @type {import('./packSchema.js').PackManifest} */ (manifest);
}

/**
 * @param {unknown} raw
 */
export function parsePackFile(raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    parsed = JSON.parse(raw);
  }
  if (!isRecord(parsed)) throw new Error("Invalid pack file");

  const manifest = validateManifest(parsed.manifest);
  const model = parsed.model;
  if (!isRecord(model?.objects) || !isRecord(model?.docs) || !isRecord(model?.nodes)) {
    throw new Error("Invalid pack: model.objects, model.docs, model.nodes required");
  }

  const graph = isRecord(parsed.graph) ? parsed.graph : null;
  return {
    manifest,
    model: {
      objects: model.objects,
      docs: model.docs,
      nodes: model.nodes,
      docKeys: isRecord(model.docKeys) ? model.docKeys : {},
    },
    graph: graph
      ? {
          canvasNodes: isRecord(graph.canvasNodes) ? graph.canvasNodes : {},
          canvasConnections: isRecord(graph.canvasConnections) ? graph.canvasConnections : {},
          groupings: isRecord(graph.groupings) ? graph.groupings : {},
        }
      : null,
  };
}

/**
 * @typedef {Object} PackManifest
 * @property {number} schemaVersion
 * @property {PackType} packType
 * @property {string} name
 * @property {string} [brand]
 * @property {string} [description]
 * @property {string} createdAt
 * @property {string} [appVersion]
 * @property {string[]} steps
 * @property {Object} counts
 * @property {string} [rootObjectId]
 * @property {boolean} includesGraph
 */

/**
 * @param {Object} params
 * @param {PackType} params.packType
 * @param {string} params.name
 * @param {string} [params.brand]
 * @param {Object} params.counts
 * @param {string} [params.rootObjectId]
 * @param {boolean} [params.includesGraph]
 * @returns {PackManifest}
 */
export function buildManifest({
  packType,
  name,
  brand = "",
  description = "",
  counts,
  rootObjectId,
  includesGraph = false,
}) {
  return {
    schemaVersion: PACK_SCHEMA_VERSION,
    packType,
    name,
    brand,
    description,
    createdAt: new Date().toISOString(),
    appVersion: "0.6.0",
    steps: PACK_STEPS,
    counts,
    rootObjectId,
    includesGraph,
  };
}
