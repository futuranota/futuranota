import { useEffect, useRef } from "react";
import { getDocNodeLinkColorPreset } from "../../../lib/docNodeLinkColors.js";
import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";
import { FolderFileShredHandle } from "../FolderFileShredder.jsx";

const QUERY_HANDLE_GLYPH =
  "M7.54149 7.14327C7.34698 7.1432 7.15443 7.18138 6.97524 7.25554C6.79606 7.3297 6.63388 7.43832 6.49832 7.57499L4.81801 6.51693C4.95019 6.18487 4.95019 5.81628 4.81801 5.48422L6.49832 4.42615C6.75071 4.67945 7.09012 4.8319 7.45072 4.85396C7.81133 4.87602 8.16746 4.76611 8.45005 4.54555C8.73265 4.32498 8.92158 4.00947 8.98022 3.66019C9.03886 3.3109 8.96303 2.95273 8.76743 2.65511C8.57183 2.35749 8.2704 2.14163 7.92157 2.04937C7.57275 1.95711 7.20139 1.99503 6.87948 2.15578C6.55758 2.31653 6.30806 2.58866 6.17932 2.9194C6.05057 3.25014 6.05177 3.61594 6.18267 3.94587L4.50237 5.00393C4.30002 4.80041 4.04033 4.66064 3.75648 4.60247C3.47264 4.5443 3.17753 4.57037 2.90889 4.67737C2.64025 4.78436 2.41028 4.96741 2.24838 5.20311C2.08648 5.43882 2 5.71647 2 6.00057C2 6.28468 2.08648 6.56233 2.24838 6.79803C2.41028 7.03373 2.64025 7.21678 2.90889 7.32378C3.17753 7.43077 3.47264 7.45685 3.75648 7.39868C4.04033 7.34051 4.30002 7.20073 4.50237 6.99721L6.18267 8.05528C6.0701 8.33971 6.05345 8.65198 6.13514 8.94636C6.21683 9.24074 6.39258 9.50176 6.63664 9.69121C6.88071 9.88065 7.18028 9.98856 7.49148 9.99914C7.80268 10.0097 8.10916 9.92241 8.36604 9.74999C8.62293 9.57758 8.81672 9.32912 8.91904 9.04099C9.02136 8.75287 9.02684 8.44022 8.93466 8.14883C8.84249 7.85743 8.65751 7.60261 8.40682 7.42166C8.15612 7.24071 7.85288 7.14315 7.54149 7.14327ZM7.54149 2.57249C7.71451 2.57249 7.88364 2.62275 8.02749 2.71692C8.17135 2.8111 8.28347 2.94494 8.34968 3.10154C8.41589 3.25814 8.43322 3.43046 8.39946 3.59671C8.36571 3.76295 8.2824 3.91566 8.16006 4.03552C8.03772 4.15537 7.88184 4.237 7.71215 4.27006C7.54246 4.30313 7.36657 4.28616 7.20673 4.22129C7.04688 4.15643 6.91026 4.04658 6.81414 3.90565C6.71802 3.76471 6.66671 3.59901 6.66671 3.42951C6.66671 3.20221 6.75888 2.98423 6.92293 2.82351C7.08698 2.66278 7.30949 2.57249 7.54149 2.57249ZM3.45919 6.85759C3.28618 6.85759 3.11705 6.80733 2.97319 6.71316C2.82933 6.61899 2.71721 6.48514 2.651 6.32854C2.58479 6.17194 2.56747 5.99962 2.60122 5.83338C2.63497 5.66713 2.71829 5.51442 2.84063 5.39457C2.96297 5.27471 3.11884 5.19309 3.28853 5.16002C3.45822 5.12695 3.63411 5.14392 3.79395 5.20879C3.9538 5.27365 4.09042 5.3835 4.18654 5.52444C4.28267 5.66537 4.33397 5.83107 4.33397 6.00057C4.33397 6.22787 4.24181 6.44585 4.07775 6.60658C3.9137 6.7673 3.6912 6.85759 3.45919 6.85759ZM7.54149 9.42865C7.36848 9.42865 7.19935 9.37839 7.05549 9.28422C6.91164 9.19005 6.79951 9.0562 6.7333 8.8996C6.66709 8.743 6.64977 8.57068 6.68352 8.40444C6.71728 8.23819 6.80059 8.08548 6.92293 7.96563C7.04527 7.84577 7.20114 7.76415 7.37083 7.73108C7.54052 7.69801 7.71641 7.71498 7.87626 7.77985C8.0361 7.84471 8.17272 7.95456 8.26885 8.0955C8.36497 8.23643 8.41627 8.40213 8.41627 8.57163C8.41627 8.79893 8.32411 9.01691 8.16006 9.17764C7.996 9.33836 7.7735 9.42865 7.54149 9.42865Z";

export function DocQueryHandleButton({
  queryEnabled = false,
  nodeLinkColor = "mint",
  onClick,
  className = "doc-query-handle",
}) {
  const handleFill = getDocNodeLinkColorPreset(nodeLinkColor).stroke;
  const handleClass =
    className
    + (queryEnabled ? " doc-query-handle--active" : "");
  const handleLabel = queryEnabled ? "Abrir nodo de query" : "Activar query";

  return (
    <button
      type="button"
      className={handleClass}
      aria-label={handleLabel}
      title={handleLabel}
      onClick={onClick}
    >
      <svg
        className="doc-query-handle__svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
      >
        <rect width="12" height="12" rx="1" fill={handleFill} className="doc-query-handle__box" />
        <path d={QUERY_HANDLE_GLYPH} fill="#2B2C2D" />
      </svg>
    </button>
  );
}

/** Shared query-handle + title row for linkable doc blocks. */
export function DocQueryHandleRow({
  value,
  onChange,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  queryEnabled = false,
  nodeLinkColor = "mint",
  showQueryHandle = true,
  onFocus,
  placeholder = "Insert Query (?) or title",
  ariaLabel = "Block title or query",
  multiline = false,
  minHeightPx = 22,
  maxHeightPx = 200,
  ghostHints,
  titleAddon = null,
  readOnly = false,
  shredNodeId = null,
  onOpenFile = null,
  shredDragEnabled = true,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (readOnly || !autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus, readOnly]);

  const headerClass =
    (multiline ? "doc-h1-block__header doc-h1-block__header--multiline" : "doc-h1-block__header")
    + (showQueryHandle ? "" : " doc-h1-block__header--no-handle");

  const focusInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if ("setSelectionRange" in el) {
      const pos = el.value.length;
      el.setSelectionRange(pos, pos);
    }
  };

  const handleHeaderPointerDown = (e) => {
    if (readOnly) return;
    const el = inputRef.current;
    if (!el || e.target === el) return;
    if (e.target.closest("button")) return;
    if (e.target.closest(".folder-file-shred-handle")) return;
    e.preventDefault();
    focusInput();
  };

  const readonlyTitle = (
    <div
      className={
        "doc-h1-block__input"
        + (multiline ? " doc-h1-block__input--multiline" : "")
        + " doc-h1-block__input--readonly"
      }
      aria-label={ariaLabel}
    >
      {value || placeholder}
    </div>
  );

  return (
    <div className={headerClass} onMouseDown={handleHeaderPointerDown}>
      {shredNodeId ? (
        <FolderFileShredHandle
          nodeId={shredNodeId}
          onOpen={onOpenFile}
          dragEnabled={shredDragEnabled}
        />
      ) : null}
      {showQueryHandle ? (
        <DocQueryHandleButton
          queryEnabled={queryEnabled}
          nodeLinkColor={nodeLinkColor}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQueryHandleClick?.();
          }}
        />
      ) : null}
      {multiline && titleAddon ? (
        <div className="doc-h1-block__title-flow">
          {/* Hidden twin sizes the field to its text so the badge follows it in flow. */}
          <div className="doc-h1-block__title-sizer">
            <span className="doc-h1-block__title-mirror" aria-hidden>
              {value || placeholder}
            </span>
            {readOnly ? readonlyTitle : (
              <SlashAwareTextarea
                inputRef={inputRef}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onFocus={onFocus}
                placeholder={placeholder}
                showPlaceholder
                ariaLabel={ariaLabel}
                wrapClassName="doc-h1-block__slash-wrap"
                className="doc-h1-block__input doc-h1-block__input--multiline"
                minHeightPx={minHeightPx}
                maxHeightPx={maxHeightPx}
                ghostHints={ghostHints}
              />
            )}
          </div>
          {titleAddon}
        </div>
      ) : multiline ? (
        readOnly ? readonlyTitle : (
          <SlashAwareTextarea
            inputRef={inputRef}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            placeholder={placeholder}
            showPlaceholder
            ariaLabel={ariaLabel}
            wrapClassName="doc-h1-block__slash-wrap"
            className="doc-h1-block__input doc-h1-block__input--multiline"
            minHeightPx={minHeightPx}
            maxHeightPx={maxHeightPx}
            ghostHints={ghostHints}
          />
        )
      ) : (
        <>
          {readOnly ? readonlyTitle : (
            <input
              ref={inputRef}
              type="text"
              className="doc-h1-block__input"
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              onFocus={onFocus}
              onKeyDown={onKeyDown}
              spellCheck={false}
              aria-label={ariaLabel}
            />
          )}
          {titleAddon}
        </>
      )}
    </div>
  );
}
