/**
 * v1 workspace data export — ZIP of structured JSON (no media binary re-download).
 * Fast for typical workspaces; media stays as URLs inside the JSON.
 */

import JSZip from "jszip";
import { useAuthStore } from "../stores/authStore.js";
import { useCanvasStore } from "../stores/canvasStore.js";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import { useTimelineStore } from "../stores/timelineStore.js";
import {
  NODE_BLOCK_TYPES,
  isNodeWritingBody,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";

const EXPORT_VERSION = 1;

const README = `Futura Nota — workspace data export (v1)

This ZIP contains a snapshot of your workspace as JSON:
- manifest.json — export metadata
- workspace/objects.json — companies / objects
- workspace/docs.json — folders (documents panel)
- workspace/nodes.json — documents / entities (passwords redacted)
- workspace/canvas.json — canvas nodes, connections, groupings
- workspace/timelines.json — timeline ranges

Media and library attachments are referenced by URL inside the JSON.
Binary files are not re-downloaded into this ZIP (keeps the export fast).

Password vault secrets are omitted for security.
`;

/**
 * @param {unknown} content
 * @returns {unknown}
 */
function redactWritingContent(content) {
  if (!isNodeWritingBody(content) || !Array.isArray(content.blocks)) {
    return content;
  }
  const blocks = normalizeWritingBlocks(content.blocks).map((block) => {
    if (block.type !== NODE_BLOCK_TYPES.PASSWORD_VAULT) return block;
    const entries = (Array.isArray(block.entries) ? block.entries : []).map((entry) => ({
      ...entry,
      password: entry?.password ? "[omitted]" : "",
    }));
    return { ...block, entries };
  });
  return { ...content, blocks };
}

/**
 * @param {Record<string, object>} nodes
 * @returns {Record<string, object>}
 */
function redactNodes(nodes) {
  const out = {};
  for (const [id, node] of Object.entries(nodes || {})) {
    if (!node || typeof node !== "object") {
      out[id] = node;
      continue;
    }
    out[id] = {
      ...node,
      content: redactWritingContent(node.content),
    };
  }
  return out;
}

/**
 * Collect a plain JSON snapshot from live stores.
 * @returns {{
 *   manifest: object,
 *   objects: object,
 *   docs: object,
 *   nodes: object,
 *   canvas: object,
 *   timelines: object,
 * }}
 */
export function collectWorkspaceExportSnapshot() {
  const user = useAuthStore.getState().user;
  const objects = useObjectsStore.getState().objects || {};
  const docs = useDocsStore.getState().docs || {};
  const nodes = redactNodes(useNodesStore.getState().nodes || {});
  const canvas = {
    canvasNodes: useCanvasStore.getState().canvasNodes || {},
    canvasConnections: useCanvasStore.getState().canvasConnections || {},
    groupings: useCanvasStore.getState().groupings || {},
  };
  const timelines = useTimelineStore.getState().timelines || {};

  return {
    manifest: {
      version: EXPORT_VERSION,
      kind: "futuranota.workspace-export",
      exportedAt: new Date().toISOString(),
      userId: user?.id || null,
      email: user?.email || null,
      counts: {
        objects: Object.keys(objects).length,
        docs: Object.keys(docs).length,
        nodes: Object.keys(nodes).length,
        canvasNodes: Object.keys(canvas.canvasNodes || {}).length,
        timelines: Object.keys(timelines).length,
      },
      notes: [
        "Media/attachment binaries are URL references only (not embedded).",
        "Password vault secrets are omitted.",
      ],
    },
    objects,
    docs,
    nodes,
    canvas,
    timelines,
  };
}

/**
 * @param {string} [prefix]
 */
function buildExportFileName(prefix = "futuranota-workspace") {
  const day = new Date().toISOString().slice(0, 10);
  const safe = String(prefix || "futuranota-workspace")
    .replace(/[^\w\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "futuranota-workspace";
  return `${safe}-${day}.zip`;
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 */
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * Build and download a workspace data ZIP (structured JSON, no media binaries).
 * @returns {Promise<{ ok: boolean, fileName?: string, error?: string }>}
 */
export async function exportWorkspaceDataZip() {
  try {
    const snapshot = collectWorkspaceExportSnapshot();
    const zip = new JSZip();
    zip.file("README.txt", README);
    zip.file("manifest.json", JSON.stringify(snapshot.manifest, null, 2));
    const folder = zip.folder("workspace");
    folder.file("objects.json", JSON.stringify(snapshot.objects, null, 2));
    folder.file("docs.json", JSON.stringify(snapshot.docs, null, 2));
    folder.file("nodes.json", JSON.stringify(snapshot.nodes, null, 2));
    folder.file("canvas.json", JSON.stringify(snapshot.canvas, null, 2));
    folder.file("timelines.json", JSON.stringify(snapshot.timelines, null, 2));

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const fileName = buildExportFileName();
    downloadBlob(blob, fileName);
    return { ok: true, fileName };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}
