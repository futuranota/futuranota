import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import {
  beginFolderFileDrag,
  dataTransferHasFolderFile,
  endFolderFileDrag,
  readFolderFileDragNodeId,
  subscribeFolderFileDrag,
  writeFolderFileDragData,
} from "../../lib/folderFileShred.js";

const SHREDDER_OFF_SRC = "/uploads/trituradora-de-files-off.svg";
const SHREDDER_HOVER_SRC = "/uploads/trituradora-de-files-hover.svg";

/**
 * Notion-style grab handle to the left of a folder document title.
 * Dragging it shreds the whole document (title + description + body).
 */
export function FolderFileShredHandle({ nodeId }) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const id = String(nodeId || "").trim();
  if (!id) return null;
  const label = t("sidebar.fileShredderGrab");

  return (
    <span
      className={"folder-file-shred-handle" + (dragging ? " is-dragging" : "")}
      draggable
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.stopPropagation();
        writeFolderFileDragData(event.dataTransfer, id);
        beginFolderFileDrag(id);
        setDragging(true);
      }}
      onDragEnd={() => {
        setDragging(false);
        endFolderFileDrag();
      }}
    >
      <span className="folder-file-shred-handle__icon" aria-hidden>
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
          <circle cx="2" cy="2" r="1.15" fill="currentColor" />
          <circle cx="6" cy="2" r="1.15" fill="currentColor" />
          <circle cx="2" cy="6" r="1.15" fill="currentColor" />
          <circle cx="6" cy="6" r="1.15" fill="currentColor" />
          <circle cx="2" cy="10" r="1.15" fill="currentColor" />
          <circle cx="6" cy="10" r="1.15" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

/**
 * Folder drop target: idle vs hot (pointer hover or dragging a file toward it).
 * Click does not delete — drop does (phase 2).
 */
export function FolderFileShredder({ onShred }) {
  const { t } = useI18n();
  const [pointerHot, setPointerHot] = useState(false);
  const [dragArmed, setDragArmed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => subscribeFolderFileDrag((nodeId) => {
    setDragArmed(Boolean(nodeId));
    if (!nodeId) setDragOver(false);
  }), []);

  const hot = pointerHot || dragArmed || dragOver;
  const label = t("sidebar.fileShredderLabel");

  const handleDragOver = (event) => {
    if (!dataTransferHasFolderFile(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nodeId = readFolderFileDragNodeId(event.dataTransfer);
    setDragOver(false);
    endFolderFileDrag();
    if (nodeId) onShred?.(nodeId);
  };

  return (
    <div
      className={"folder-file-shredder" + (hot ? " is-hot" : "")}
      role="img"
      aria-label={label}
      title={label}
      onPointerEnter={() => setPointerHot(true)}
      onPointerLeave={() => setPointerHot(false)}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <img
        className="folder-file-shredder__img"
        src={hot ? SHREDDER_HOVER_SRC : SHREDDER_OFF_SRC}
        alt=""
        aria-hidden
        draggable={false}
      />
    </div>
  );
}
