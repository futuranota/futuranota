/** Custom MIME so folder-file drags are distinct from canvas / text drags. */
export const FOLDER_FILE_SHRED_MIME = "application/x-futura-folder-node";

const PREFIX = "futura-folder-node:";

/** @type {Set<(nodeId: string|null) => void>} */
const listeners = new Set();

/** @type {string|null} */
let activeNodeId = null;

export function getActiveFolderFileDragId() {
  return activeNodeId;
}

/** @param {(nodeId: string|null) => void} fn */
export function subscribeFolderFileDrag(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(activeNodeId);
}

/** @param {string} nodeId */
export function beginFolderFileDrag(nodeId) {
  const id = String(nodeId || "").trim();
  activeNodeId = id || null;
  notify();
}

export function endFolderFileDrag() {
  if (activeNodeId == null) return;
  activeNodeId = null;
  notify();
}

/**
 * @param {DataTransfer|null|undefined} dataTransfer
 * @param {string} nodeId
 */
export function writeFolderFileDragData(dataTransfer, nodeId) {
  if (!dataTransfer || !nodeId) return;
  const id = String(nodeId);
  try {
    dataTransfer.setData(FOLDER_FILE_SHRED_MIME, id);
  } catch {
    /* some browsers reject custom MIME */
  }
  dataTransfer.setData("text/plain", `${PREFIX}${id}`);
  dataTransfer.effectAllowed = "move";
}

/**
 * @param {DataTransfer|null|undefined} dataTransfer
 * @returns {boolean}
 */
export function dataTransferHasFolderFile(dataTransfer) {
  if (getActiveFolderFileDragId()) return true;
  if (!dataTransfer?.types) return false;
  const types = Array.from(dataTransfer.types);
  return types.includes(FOLDER_FILE_SHRED_MIME);
}

/**
 * @param {DataTransfer|null|undefined} dataTransfer
 * @returns {string}
 */
export function readFolderFileDragNodeId(dataTransfer) {
  if (!dataTransfer) return getActiveFolderFileDragId() || "";
  let raw = "";
  try {
    raw = dataTransfer.getData(FOLDER_FILE_SHRED_MIME) || "";
  } catch {
    raw = "";
  }
  if (raw) return raw;
  const plain = dataTransfer.getData("text/plain") || "";
  if (plain.startsWith(PREFIX)) return plain.slice(PREFIX.length);
  return getActiveFolderFileDragId() || "";
}
