import { convertImageSourceToWebp } from "./convertImageToWebp.js";
import {
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { uploadDocImageBlob } from "./docImageStorage.js";
import { generateId } from "./ids.js";

/**
 * True for embedded document images (base64) that should move to Storage.
 * Skips tiny inline SVG icons (UI chrome), not user photo uploads.
 * @param {unknown} src
 */
export function isDocImageDataUrl(src) {
  if (typeof src !== "string") return false;
  const value = src.trim();
  if (!value.startsWith("data:image/")) return false;
  if (/^data:image\/svg\+xml/i.test(value) && value.length < 4096) return false;
  return true;
}

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const trimmed = String(dataUrl || "").trim();
  const comma = trimmed.indexOf(",");
  if (comma < 0) throw new Error("Invalid data URL.");
  const header = trimmed.slice(0, comma);
  const payload = trimmed.slice(comma + 1);
  const mime = (header.match(/data:([^;,]+)/i) || [])[1] || "application/octet-stream";
  const isBase64 = /;base64/i.test(header);
  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

/**
 * Prefer structured blocks; fall back to body/content serialization (legacy).
 * @param {{ blocks?: unknown, body?: string, content?: string }|null|undefined} doc
 */
export function resolveDocBlocksForImageMigration(doc) {
  const fromBlocks = normalizeDocBlocks(
    Array.isArray(doc?.blocks) && doc.blocks.length
      ? doc.blocks
      : [],
  );
  if (docBlocksHaveImageDataUrls(fromBlocks)) return fromBlocks;

  const fromBody = normalizeDocBlocks(
    docBlocksFromBody(doc?.body ?? doc?.content ?? ""),
  );
  if (docBlocksHaveImageDataUrls(fromBody)) return fromBody;

  return fromBlocks.length ? fromBlocks : fromBody;
}

/**
 * @param {unknown} blocks
 * @returns {boolean}
 */
export function docBlocksHaveImageDataUrls(blocks) {
  return countImageDataUrlsInBlocks(blocks) > 0;
}

/**
 * @param {unknown} blocks
 * @returns {number}
 */
export function countImageDataUrlsInBlocks(blocks) {
  let count = 0;
  walkImageSrcSlots(normalizeDocBlocks(blocks), () => {
    count += 1;
  });
  return count;
}

/**
 * @param {object[]} blocks
 * @param {(src: string, meta: { blockId: string, scopeHint: string }) => void} visit
 */
function walkImageSrcSlots(blocks, visit) {
  if (!Array.isArray(blocks)) return;

  const visitSrc = (src, meta) => {
    if (!isDocImageDataUrl(src)) return;
    visit(src, meta);
  };

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const blockId = String(block.id || "block");
    const type = block.type;

    if (
      type === DOC_BLOCK_TYPES.IMAGE
      || type === DOC_BLOCK_TYPES.IMAGE_SPLIT
      || type === DOC_BLOCK_TYPES.BANNER
      || type === DOC_BLOCK_TYPES.SPECS_CARD
    ) {
      visitSrc(block.src, { blockId, scopeHint: blockId });
    }

    if (type === DOC_BLOCK_TYPES.PRODUCT_CARD && Array.isArray(block.images)) {
      for (const img of block.images) {
        if (!img || typeof img !== "object") continue;
        visitSrc(img.src, { blockId, scopeHint: blockId });
      }
    }

    if (type === DOC_BLOCK_TYPES.MOODBOARD && Array.isArray(block.columns)) {
      for (const col of block.columns) {
        const images = Array.isArray(col?.images) ? col.images : [];
        for (const img of images) {
          if (!img || typeof img !== "object") continue;
          visitSrc(img.src, {
            blockId,
            scopeHint: img.slotId || blockId,
          });
        }
      }
    }

    if (type === DOC_BLOCK_TYPES.STEP_SEQUENCE && Array.isArray(block.steps)) {
      for (const step of block.steps) {
        walkImageSrcSlots(step?.blocks, visit);
      }
    }
  }
}

/**
 * Upload one data-URL image to Storage.
 * WebP data-URLs upload as-is (no canvas). Other rasters re-encode to WebP.
 *
 * @param {string} dataUrl
 * @param {{ scopeId?: string, fileId?: string, idPrefix?: string }} [options]
 * @returns {Promise<string>}
 */
export async function migrateDataUrlToStorage(dataUrl, options = {}) {
  const fileId = options.fileId || generateId(options.idPrefix || "MIG");
  const trimmed = String(dataUrl || "").trim();

  let blob;
  if (/^data:image\/webp[;,]/i.test(trimmed)) {
    blob = dataUrlToBlob(trimmed);
  } else {
    const converted = await convertImageSourceToWebp(trimmed, {
      idPrefix: options.idPrefix || "MIG",
      fileName: fileId,
      // Cap extremes so canvas backfill does not OOM on huge legacy assets.
      maxWidth: 4096,
      maxHeight: 4096,
    });
    if (!converted?.blob) {
      throw new Error("Could not convert legacy image for Storage upload.");
    }
    blob = converted.blob;
  }

  return uploadDocImageBlob(blob, {
    fileId,
    scopeId: options.scopeId,
    // Unique fileIds — never overwrite a sibling image in the same folder.
    upsert: false,
  });
}

/**
 * @param {unknown} blocks
 * @param {{ docId?: string }} [options]
 * @returns {Promise<{ blocks: object[], migratedCount: number, failedCount: number }>}
 */
export async function migrateDocBlocksImageDataUrls(blocks, options = {}) {
  const normalized = normalizeDocBlocks(blocks);
  const docScope = options.docId || "doc";
  let migratedCount = 0;
  let failedCount = 0;

  const migrateSrc = async (src, meta) => {
    try {
      const publicUrl = await migrateDataUrlToStorage(src, {
        // Match Paso 1 layout: folder per block id (easier to audit in Dashboard).
        scopeId: meta?.blockId || docScope,
        fileId: generateId("MIG"),
        idPrefix: "MIG",
      });
      migratedCount += 1;
      return publicUrl;
    } catch (err) {
      failedCount += 1;
      console.warn(
        "[doc-images] backfill failed for block",
        meta?.blockId,
        err?.message || err,
      );
      return src;
    }
  };

  const nextBlocks = await mapBlocksImageSrcs(normalized, migrateSrc);
  return { blocks: nextBlocks, migratedCount, failedCount };
}

/**
 * @param {object[]} blocks
 * @param {(src: string, meta: { blockId: string, scopeHint: string }) => Promise<string>} migrateSrc
 */
async function mapBlocksImageSrcs(blocks, migrateSrc) {
  if (!Array.isArray(blocks)) return [];

  const out = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      out.push(block);
      continue;
    }

    const blockId = String(block.id || "block");
    const type = block.type;
    let next = block;

    if (
      type === DOC_BLOCK_TYPES.IMAGE
      || type === DOC_BLOCK_TYPES.IMAGE_SPLIT
      || type === DOC_BLOCK_TYPES.BANNER
      || type === DOC_BLOCK_TYPES.SPECS_CARD
    ) {
      if (isDocImageDataUrl(block.src)) {
        const src = await migrateSrc(block.src, { blockId, scopeHint: blockId });
        if (src !== block.src) next = { ...next, src };
      }
    }

    if (type === DOC_BLOCK_TYPES.PRODUCT_CARD && Array.isArray(block.images)) {
      const images = [];
      let imagesChanged = false;
      for (const img of block.images) {
        if (!img || typeof img !== "object") {
          images.push(img);
          continue;
        }
        if (!isDocImageDataUrl(img.src)) {
          images.push(img);
          continue;
        }
        const src = await migrateSrc(img.src, { blockId, scopeHint: blockId });
        if (src !== img.src) {
          imagesChanged = true;
          images.push({ ...img, src });
        } else {
          images.push(img);
        }
      }
      if (imagesChanged) next = { ...next, images };
    }

    if (type === DOC_BLOCK_TYPES.MOODBOARD && Array.isArray(block.columns)) {
      const columns = [];
      let columnsChanged = false;
      for (const col of block.columns) {
        if (!col || typeof col !== "object") {
          columns.push(col);
          continue;
        }
        const prevImages = Array.isArray(col.images) ? col.images : [];
        const images = [];
        let imagesChanged = false;
        for (const img of prevImages) {
          if (!img || typeof img !== "object") {
            images.push(img);
            continue;
          }
          if (!isDocImageDataUrl(img.src)) {
            images.push(img);
            continue;
          }
          const src = await migrateSrc(img.src, {
            blockId,
            scopeHint: img.slotId || blockId,
          });
          if (src !== img.src) {
            imagesChanged = true;
            images.push({ ...img, src });
          } else {
            images.push(img);
          }
        }
        if (imagesChanged) {
          columnsChanged = true;
          columns.push({ ...col, images });
        } else {
          columns.push(col);
        }
      }
      if (columnsChanged) next = { ...next, columns };
    }

    if (type === DOC_BLOCK_TYPES.STEP_SEQUENCE && Array.isArray(block.steps)) {
      const steps = [];
      let stepsChanged = false;
      for (const step of block.steps) {
        if (!step || typeof step !== "object") {
          steps.push(step);
          continue;
        }
        const stepBlocks = await mapBlocksImageSrcs(step.blocks || [], migrateSrc);
        const changed = JSON.stringify(stepBlocks) !== JSON.stringify(step.blocks || []);
        if (changed) {
          stepsChanged = true;
          steps.push({ ...step, blocks: stepBlocks });
        } else {
          steps.push(step);
        }
      }
      if (stepsChanged) next = { ...next, steps };
    }

    out.push(next);
  }
  return out;
}

const sessionMigratedClean = new Set();
const sessionInFlight = new Set();
let sweepRunning = false;
let scheduleTimer = null;

/**
 * Migrate folder/doc `icon` data-URL → Storage. Returns the public URL when changed.
 * @param {string} docId
 * @param {{ docsStore?: { getDoc: Function, updateDoc: Function, docs?: object } }} [deps]
 * @returns {Promise<{ changed: boolean, icon: string }>}
 */
export async function migrateAndPersistDocIcon(docId, deps = {}) {
  if (!docId) return { changed: false, icon: "" };
  const docsStore = deps.docsStore || (await import("../stores/docsStore.js")).useDocsStore.getState();
  const doc = docsStore.getDoc?.(docId) || docsStore.docs?.[docId];
  if (!doc) return { changed: false, icon: "" };

  const icon = typeof doc.icon === "string" ? doc.icon.trim() : "";
  if (!isDocImageDataUrl(icon)) {
    return { changed: false, icon };
  }

  try {
    const publicUrl = await migrateDataUrlToStorage(icon, {
      scopeId: docId,
      fileId: generateId("FICON"),
      idPrefix: "FICON",
    });
    docsStore.updateDoc(docId, { icon: publicUrl });
    return { changed: true, icon: publicUrl };
  } catch (err) {
    console.warn("[doc-images] folder icon backfill failed:", docId, err?.message || err);
    return { changed: false, icon };
  }
}

/**
 * @param {string} docId
 * @param {{ docsStore?: { getDoc: Function, updateDoc: Function, docs?: object } }} [deps]
 */
export async function migrateAndPersistDocImages(docId, deps = {}) {
  if (!docId) return null;
  if (sessionMigratedClean.has(docId)) {
    return { changed: false, blocks: [], migratedCount: 0, failedCount: 0, skipped: true };
  }
  if (sessionInFlight.has(docId)) return null;

  const docsStore = deps.docsStore || (await import("../stores/docsStore.js")).useDocsStore.getState();
  const doc = docsStore.getDoc?.(docId) || docsStore.docs?.[docId];
  if (!doc) return null;

  sessionInFlight.add(docId);
  try {
    const iconResult = await migrateAndPersistDocIcon(docId, { docsStore });

    const blocks = resolveDocBlocksForImageMigration(doc);
    if (!docBlocksHaveImageDataUrls(blocks)) {
      const iconStillData = isDocImageDataUrl(
        (docsStore.getDoc?.(docId) || docsStore.docs?.[docId])?.icon,
      );
      if (!iconStillData) sessionMigratedClean.add(docId);
      return {
        changed: iconResult.changed,
        blocks,
        icon: iconResult.icon,
        migratedCount: iconResult.changed ? 1 : 0,
        failedCount: 0,
      };
    }

    const result = await migrateDocBlocksImageDataUrls(blocks, { docId });
    if (result.migratedCount > 0) {
      docsStore.updateDoc(docId, { blocks: result.blocks });
    }
    const iconStillData = isDocImageDataUrl(
      (docsStore.getDoc?.(docId) || docsStore.docs?.[docId])?.icon,
    );
    if (
      result.failedCount === 0
      && !docBlocksHaveImageDataUrls(result.blocks)
      && !iconStillData
    ) {
      sessionMigratedClean.add(docId);
    }
    return {
      changed: result.migratedCount > 0 || iconResult.changed,
      blocks: result.blocks,
      icon: iconResult.icon,
      migratedCount: result.migratedCount + (iconResult.changed ? 1 : 0),
      failedCount: result.failedCount,
    };
  } finally {
    sessionInFlight.delete(docId);
  }
}

/**
 * Walk all in-memory docs and migrate legacy data-URL images (one doc at a time).
 */
export async function runDocImageDataUrlBackfill(deps = {}) {
  if (sweepRunning) return { ran: false, reason: "in_flight" };
  sweepRunning = true;
  try {
    const docsStore = deps.docsStore || (await import("../stores/docsStore.js")).useDocsStore.getState();
    const docs = docsStore.getAllDocs?.() || Object.values(docsStore.docs || {});
    let docsChanged = 0;
    let imagesMigrated = 0;
    let imagesFailed = 0;
    let imagesPending = 0;

    for (const doc of docs) {
      const id = doc?.id;
      if (!id) continue;
      const pending = countImageDataUrlsInBlocks(resolveDocBlocksForImageMigration(doc));
      imagesPending += pending;
    }

    console.log("[doc-images] backfill sweep start", {
      docs: docs.length,
      dataUrlImages: imagesPending,
    });

    if (imagesPending === 0) {
      return { ran: true, docsChanged: 0, imagesMigrated: 0, imagesFailed: 0, imagesPending: 0 };
    }

    for (const doc of docs) {
      const id = doc?.id;
      if (!id) continue;
      const result = await migrateAndPersistDocImages(id, { docsStore });
      if (!result || result.skipped) continue;
      if (result.changed) docsChanged += 1;
      imagesMigrated += result.migratedCount || 0;
      imagesFailed += result.failedCount || 0;
    }

    console.log("[doc-images] backfill sweep done", {
      docsChanged,
      imagesMigrated,
      imagesFailed,
    });
    return { ran: true, docsChanged, imagesMigrated, imagesFailed, imagesPending };
  } finally {
    sweepRunning = false;
  }
}

/**
 * Debounced schedule after workspace hydrate. Re-calling resets the timer
 * so a late hydrate still runs against the final docs map.
 * @param {{ delayMs?: number }} [opts]
 */
export function scheduleDocImageDataUrlBackfill(opts = {}) {
  const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 2500;
  if (scheduleTimer) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  const start = () => {
    scheduleTimer = null;
    runDocImageDataUrlBackfill().catch((err) => {
      console.warn("[doc-images] backfill sweep failed:", err?.message || err);
    });
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    scheduleTimer = window.setTimeout(() => {
      window.requestIdleCallback(start, { timeout: 8000 });
    }, delayMs);
  } else {
    scheduleTimer = setTimeout(start, delayMs);
  }
}
