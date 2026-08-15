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
const FILE_STICKER_SRC = "/uploads/file-sticker.svg";

/** Cached drag ghost — setDragImage needs a loaded element. */
let fileStickerDragImg = null;
function getFileStickerDragImage() {
  if (typeof Image === "undefined") return null;
  if (!fileStickerDragImg) {
    fileStickerDragImg = new Image();
    fileStickerDragImg.src = FILE_STICKER_SRC;
  }
  return fileStickerDragImg;
}
if (typeof Image !== "undefined") getFileStickerDragImage();

/**
 * Grab handle to the left of a folder document title.
 * Hover shows file-sticker; drag ghost is the same sticker.
 * Dragging shreds the whole document (title + description + body).
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
        const sticker = getFileStickerDragImage();
        if (sticker?.complete && sticker.naturalWidth > 0) {
          try {
            event.dataTransfer.setDragImage(sticker, 16, 16);
          } catch {
            /* some browsers reject custom drag images */
          }
        }
      }}
      onDragEnd={() => {
        setDragging(false);
        endFolderFileDrag();
      }}
    >
      <img
        className="folder-file-shred-handle__sticker"
        src={FILE_STICKER_SRC}
        alt=""
        aria-hidden
        draggable={false}
      />
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
