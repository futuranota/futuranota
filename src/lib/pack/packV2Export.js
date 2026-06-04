import { buildPackFromStores } from "./packExport.js";
import { PACK_FILE_EXTENSION, PACK_V2_FILE_SUFFIX } from "./packSchema.js";
import { packToZipBlobV2 } from "./packV2Zip.js";

/**
 * @param {ReturnType<import('./packCollect.js').collectPackSlice>} pack
 * @param {string} [filename]
 */
export async function downloadPackV2File(pack, filename) {
  const safeName = (pack.manifest.name || "futura-nota-pack")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "futura-nota-pack";
  const blob = await packToZipBlobV2(pack);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${safeName}${PACK_V2_FILE_SUFFIX}${PACK_FILE_EXTENSION}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {string} rootObjectId
 * @param {{ includeGraph?: boolean }} [options]
 */
export async function exportObjectPackV2(rootObjectId, options = {}) {
  const pack = buildPackFromStores(rootObjectId, {
    includeGraph: options.includeGraph ?? false,
    includeKnowledge: false,
  });
  await downloadPackV2File(pack);
  return pack;
}
