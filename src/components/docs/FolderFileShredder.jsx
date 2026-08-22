import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import {
  beginFolderFileDrag,
  dataTransferHasFolderFile,
  endFolderFileDrag,
  readFolderFileDragNodeId,
  subscribeFolderFileDrag,
  writeFolderFileDragData,
} from "../../lib/folderFileShred.js";

const SHREDDER_OFF_SRC = "/uploads/trituradora-de-files-off.svg?v=c5";
const SHREDDER_HOVER_SRC = "/uploads/trituradora-de-files-hover.svg?v=c5";
const FILE_STICKER_SRC = "/uploads/file-sticker.svg";
/** Same file art: gray layer → folder title accent (#dcb2a6); black strokes kept. */
const FILE_STICKER_HOVER_SRC = "/uploads/file-sticker-hover.svg";

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
 * Static file sticker beside a folder document title.
 * Click opens the document; drag (when enabled) shreds via the demoledor.
 * Hover tints the sticker + linked title together (no title mesh).
 */
export function FolderFileShredHandle({
  nodeId,
  onOpen = null,
  dragEnabled = true,
}) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const didDragRef = useRef(false);
  const id = String(nodeId || "").trim();
  if (!id) return null;

  const canOpen = typeof onOpen === "function";
  const canDrag = Boolean(dragEnabled);
  const label = canOpen && canDrag
    ? t("sidebar.fileShredderOpenOrDrag")
    : canOpen
      ? t("sidebar.fileShredderOpen")
      : t("sidebar.fileShredderGrab");

  return (
    <span
      className={"folder-file-shred-handle" + (dragging ? " is-dragging" : "")}
      draggable={canDrag}
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (!canOpen) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
        if (canOpen) onOpen();
      }}
      onDragStart={(event) => {
        event.stopPropagation();
        if (!canDrag) {
          event.preventDefault();
          return;
        }
        didDragRef.current = true;
        writeFolderFileDragData(event.dataTransfer, id);
        beginFolderFileDrag(id);
        setDragging(true);
        const sticker = getFileStickerDragImage();
        if (sticker?.complete && sticker.naturalWidth > 0) {
          try {
            event.dataTransfer.setDragImage(sticker, 10, 10);
          } catch {
            /* some browsers reject custom drag images */
          }
        }
      }}
      onDragEnd={() => {
        setDragging(false);
        endFolderFileDrag();
        // Keep didDragRef true until click is suppressed, then clear on next tick
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      }}
    >
      <img
        className="folder-file-shred-handle__sticker"
        src={FILE_STICKER_SRC}
        alt=""
        aria-hidden
        draggable={false}
      />
      <img
        className="folder-file-shred-handle__sticker folder-file-shred-handle__sticker--hover"
        src={FILE_STICKER_HOVER_SRC}
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
