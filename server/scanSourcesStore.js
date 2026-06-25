import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.join(__dirname, "../content/admin/scan-sources.json");

/**
 * @typedef {Object} ScanSource
 * @property {string} [id]
 * @property {string} label
 * @property {string} domain
 * @property {string} [pathPrefix]
 * @property {"primary"|"secondary"} [tier]
 * @property {string[]} [categories]
 * @property {boolean} [enabled]
 */

/**
 * @param {unknown} row
 * @returns {ScanSource|null}
 */
function normalizeSource(row) {
  if (!row || typeof row !== "object") return null;
  const domain = typeof row.domain === "string" ? row.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  if (!domain) return null;
  return {
    id: row.id,
    label: typeof row.label === "string" ? row.label.trim() : domain,
    domain,
    pathPrefix: typeof row.path_prefix === "string"
      ? row.path_prefix
      : (typeof row.pathPrefix === "string" ? row.pathPrefix : ""),
    tier: row.tier === "secondary" ? "secondary" : "primary",
    categories: Array.isArray(row.categories) ? row.categories : [],
    enabled: row.enabled !== false,
  };
}

/**
 * Default curated sources from repo JSON (server-side fallback).
 * @returns {ScanSource[]}
 */
export function loadScanSourcesFromFile() {
  try {
    const raw = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
    const list = Array.isArray(raw?.sources) ? raw.sources : [];
    return list.map(normalizeSource).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {ScanSource[]} clientSources
 * @returns {ScanSource[]}
 */
export function resolveScanSources(clientSources) {
  const fromClient = (clientSources || []).map(normalizeSource).filter(Boolean);
  if (fromClient.length > 0) return fromClient.filter((s) => s.enabled !== false);
  return loadScanSourcesFromFile().filter((s) => s.enabled !== false);
}
