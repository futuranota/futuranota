import JSZip from "jszip";
import { isKnowledgeDoc } from "../templateDoc.js";
import { PACK_FORMAT_FOLDER_V2, PACK_SCHEMA_VERSION_V2 } from "./packSchema.js";
import { extractDocAssets, hydrateDocAssetsFromZip } from "./packV2Assets.js";
import { parsePackFile } from "./packSchema.js";
import {
  nodeFileSlug,
  resolveDocFolderPath,
  slugify,
} from "./packV2Paths.js";

const README_V2 = `Futura Nota — Pack v2 (readable folders)
============================================

Unzip to browse the product like a project on disk.

Structure:
  Brand/object.json       — root brand / object
  Products/…/doc.json   — product docs (+ assets/ for images)
  Content/…/doc.json    — content docs, queries, todos (+ assets/)
  Content/…/nodes/      — nodes linked to that doc
  Nodes/                — nodes tied to the object only
  manifest.json         — schema + counts
  model.json            — full model (paths point to assets/ files)

Re-import the same ZIP in Futura Nota (Import pack).

Note: Knowledge PDFs are listed under source/ with metadata only unless
the file was stored in the app (future versions may include the binary).
`;

/**
 * @param {ReturnType<import('./packCollect.js').collectPackSlice>} pack
 */
export async function packToZipBlobV2(pack) {
  const zip = new JSZip();
  const rootName = slugify(pack.manifest.name || "futura-nota-pack");
  const root = zip.folder(rootName);

  if (!root) throw new Error("Could not create pack folder");

  const usedSlugs = new Set();
  const folderPaths = {};
  const sanitizedDocs = {};
  const allAssetFiles = [];

  for (const [docId, doc] of Object.entries(pack.model.docs)) {
    const folderPath = resolveDocFolderPath(doc, usedSlugs);
    folderPaths[docId] = folderPath;

    const { doc: stripped, files } = extractDocAssets(doc, folderPath);
    sanitizedDocs[docId] = stripped;
    allAssetFiles.push(...files);

    const folder = root.folder(folderPath);
    if (folder) {
      folder.file("doc.json", JSON.stringify(stripped, null, 2));

      if (isKnowledgeDoc(doc) && doc.knowledgeImport) {
        const source = folder.folder("source");
        const meta = doc.knowledgeImport;
        const safeFile = (meta.fileName || "document.pdf").replace(/[/\\]/g, "_");
        source?.file(
          `${safeFile}.meta.json`,
          JSON.stringify(
            {
              ...meta,
              note: "Original file bytes were not stored in Futura Nota. Re-attach the PDF manually if needed.",
            },
            null,
            2,
          ),
        );
        source?.file(
          "README.txt",
          `Referenced file: ${meta.fileName}\n`
            + "This export includes metadata only. Place the PDF here with the same name before re-import if you add file support later.\n",
        );
      }
    }

    for (const { path, bytes } of files) {
      root.file(path, bytes);
    }
  }

  const nodesByDoc = new Map();
  const orphanNodes = [];

  for (const [nodeId, node] of Object.entries(pack.model.nodes)) {
    if (node.parentDocId && sanitizedDocs[node.parentDocId]) {
      if (!nodesByDoc.has(node.parentDocId)) nodesByDoc.set(node.parentDocId, []);
      nodesByDoc.get(node.parentDocId).push({ nodeId, node });
    } else {
      orphanNodes.push({ nodeId, node });
    }
  }

  for (const [docId, nodeList] of nodesByDoc) {
    const folderPath = folderPaths[docId];
    const nodesFolder = root.folder(`${folderPath}/nodes`);
    const usedNodeSlugs = new Set();
    if (!nodesFolder) continue;

    for (const { nodeId, node } of nodeList) {
      const slug = nodeFileSlug(node, usedNodeSlugs);
      nodesFolder.file(`${slug}.json`, JSON.stringify(node, null, 2));
    }
  }

  if (orphanNodes.length) {
    const nodesRoot = root.folder("Nodes");
    const usedNodeSlugs = new Set();
    for (const { nodeId, node } of orphanNodes) {
      const slug = nodeFileSlug(node, usedNodeSlugs);
      nodesRoot?.file(`${slug}.json`, JSON.stringify(node, null, 2));
    }
  }

  const rootObject = Object.values(pack.model.objects)[0];
  if (rootObject) {
    root.folder("Brand")?.file("object.json", JSON.stringify(rootObject, null, 2));
  }

  const manifest = {
    ...pack.manifest,
    schemaVersion: PACK_SCHEMA_VERSION_V2,
    packFormat: PACK_FORMAT_FOLDER_V2,
    folderLayout: "Products/Content/Nodes/Brand",
  };

  const model = {
    ...pack.model,
    docs: sanitizedDocs,
    folderPaths,
  };

  root.file("README.txt", README_V2);
  root.file("manifest.json", JSON.stringify(manifest, null, 2));
  root.file("model.json", JSON.stringify(model, null, 2));

  if (pack.graph) {
    root.file("graph.json", JSON.stringify(pack.graph, null, 2));
  }

  const counts = {
    ...pack.manifest.counts,
    assetFiles: allAssetFiles.length,
    folders: Object.keys(folderPaths).length,
  };
  manifest.counts = counts;
  root.file("manifest.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/**
 * @param {JSZip} zip loaded zip (root may be flat or single top folder)
 */
export async function parseZipPackV2(zip) {
  let base = zip;
  const topEntries = Object.keys(zip.files).filter((p) => !p.endsWith("/"));
  const hasRootModel = zip.file("manifest.json") && zip.file("model.json");

  if (!hasRootModel) {
    const firstPath = topEntries[0]?.split("/")[0];
    if (firstPath && zip.folder(firstPath)) {
      const nested = zip.folder(firstPath);
      if (nested?.file("manifest.json")) base = nested;
    }
  }

  const manifestEntry = base.file("manifest.json");
  const modelEntry = base.file("model.json");
  if (!manifestEntry || !modelEntry) {
    throw new Error("Pack v2 ZIP must contain manifest.json and model.json");
  }

  const manifest = JSON.parse(await manifestEntry.async("string"));
  const model = JSON.parse(await modelEntry.async("string"));
  const folderPaths = model.folderPaths || {};

  const hydratedDocs = {};
  for (const [docId, doc] of Object.entries(model.docs || {})) {
    const prefix = folderPaths[docId];
    if (prefix) {
      hydratedDocs[docId] = await hydrateDocFromZip(doc, prefix, base);
    } else {
      hydratedDocs[docId] = doc;
    }
  }

  let graph = null;
  const graphEntry = base.file("graph.json");
  if (graphEntry) {
    graph = JSON.parse(await graphEntry.async("string"));
  }

  return parsePackFile({
    manifest,
    model: { ...model, docs: hydratedDocs },
    graph,
  });
}

/**
 * @param {object} doc
 * @param {string} folderPrefix
 * @param {JSZip} zip
 */
async function hydrateDocFromZip(doc, folderPrefix, zip) {
  return hydrateDocAssetsFromZip(doc, folderPrefix, zip);
}
