import JSZip from "jszip";
import { parsePackFile } from "./packSchema.js";

const README = `Futura Nota — product pack (ZIP)
================================

Edit these files locally, then re-import the ZIP in Futura Nota (Import pack).

Files:
  manifest.json  — name, brand, counts, schema version
  model.json     — objects, docs (products + content only), nodes
  graph.json     — optional canvas layout (if exported with graph)

Stacks included: Products, Content (Knowledge is not part of this pack).
`;

/**
 * @param {import('./packSchema.js').ReturnType<typeof parsePackFile>} pack
 */
export async function packToZipBlob(pack) {
  const zip = new JSZip();
  zip.file("README.txt", README);
  zip.file("manifest.json", JSON.stringify(pack.manifest, null, 2));
  zip.file("model.json", JSON.stringify(pack.model, null, 2));
  if (pack.graph) {
    zip.file("graph.json", JSON.stringify(pack.graph, null, 2));
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/**
 * @param {ArrayBuffer} buffer
 */
export async function parseZipPack(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const manifestEntry = zip.file("manifest.json");
  const modelEntry = zip.file("model.json");
  if (!manifestEntry || !modelEntry) {
    throw new Error("ZIP must contain manifest.json and model.json");
  }
  const manifest = JSON.parse(await manifestEntry.async("string"));
  const model = JSON.parse(await modelEntry.async("string"));
  let graph = null;
  const graphEntry = zip.file("graph.json");
  if (graphEntry) {
    graph = JSON.parse(await graphEntry.async("string"));
  }
  return parsePackFile({ manifest, model, graph });
}
