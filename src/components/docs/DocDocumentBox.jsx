import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOC_FILE_TXT_ICON } from "../../lib/docMediumAssets.js";
import { createDocBlock, DOC_BLOCK_TYPES, normalizeDocBlocks, updateBlockAt } from "../../lib/docBlocks.js";
import {
  createDocBlockFromSlash,
  parseSlashQuery,
  splitBodyForSlash,
} from "../../lib/docBlockSlash.js";
import { findLinkableBlockIndexForFocus } from "../../lib/docNodeSync.js";
import {
  isNoNodeLinkMode,
  normalizeNodeLinkColorId,
  resolveBlockNodeLinkColor,
} from "../../lib/docNodeLinkColors.js";
import { DocMetaStrip } from "./DocMetaStrip.jsx";
import { DocBlockStack } from "./blocks/DocBlockStack.jsx";
import { SlashAwareTextarea } from "./blocks/SlashAwareTextarea.jsx";

const DEFAULT_HEADER_LABEL = "";
const CONTENT_BOX_MIN_HEIGHT = 100;
const CONTENT_BOX_DEFAULT_HEIGHT = 200;
const CONTENT_BOX_MAX_HEIGHT = 520;

function getContentBoxMaxHeight() {
  if (typeof window === "undefined") return CONTENT_BOX_MAX_HEIGHT;
  return Math.min(window.innerHeight * 0.72, CONTENT_BOX_MAX_HEIGHT);
}

/**
 * Document medium box — layout from Figma node 291:494 (datos).
 */
export function DocDocumentBox({
  title,
  onTitleChange,
  titleRef,
  titlePlaceholder = "Write your description",
  body,
  onBodyChange,
  blocks = [],
  onBlocksChange,
  bodyPlaceholder = 'Type your text here "/"create command',
  createdDate,
  onCreatedDateChange,
  parentId,
  onParentIdChange,
  objects = null,
  onDelete,
  onSave,
  onCloseExpand,
  onTitleKeyDown,
  onBodyKeyDown,
  onOpenNodeForBlock,
  onOpenNodeForH1,
  onAnswerBelowH1Change,
  onBlockAnchorChange,
  headerLabel,
  version = "",
  onVersionChange,
  category = "",
  onCategoryChange,
  launchDate = "",
  onLaunchDateChange,
  campaignActive = false,
  onCampaignActiveChange,
  nodeLinkColor = "dark",
  onNodeLinkColorChange,
}) {
  const showCampaignMeta = Boolean(onVersionChange);
  const docHeaderLabel = (headerLabel ?? "").trim() || DEFAULT_HEADER_LABEL;
  const bodyRef = useRef(null);
  const contentBoxRef = useRef(null);
  const contentScrollRef = useRef(null);
  const [focusBlockId, setFocusBlockId] = useState(null);

  const normalizedBlocks = normalizeDocBlocks(blocks);
  const hasBlocks = normalizedBlocks.length > 0;
  const { slash: slashTail } = splitBodyForSlash(body);

  const linkableFocusIndex = useMemo(
    () => findLinkableBlockIndexForFocus(normalizedBlocks, focusBlockId),
    [normalizedBlocks, focusBlockId],
  );

  const metaStripNodeLinkColor = useMemo(() => {
    if (linkableFocusIndex >= 0) {
      return resolveBlockNodeLinkColor(normalizedBlocks[linkableFocusIndex]);
    }
    return nodeLinkColor;
  }, [linkableFocusIndex, normalizedBlocks, nodeLinkColor]);

  const handleMetaNodeLinkColorChange = useCallback(
    (color) => {
      const normalized = normalizeNodeLinkColorId(color);
      if (linkableFocusIndex >= 0) {
        const patch = { nodeLinkColor: normalized };
        if (isNoNodeLinkMode(normalized)) patch.queryEnabled = false;
        onBlocksChange?.(updateBlockAt(blocks, linkableFocusIndex, patch));
        return;
      }
      onNodeLinkColorChange?.(normalized);
    },
    [linkableFocusIndex, blocks, onBlocksChange, onNodeLinkColorChange],
  );

  const syncTitleHeight = useCallback(() => {
    const el = titleRef?.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [titleRef]);

  const syncContentBoxHeight = useCallback(() => {
    const box = contentBoxRef.current;
    const scroll = contentScrollRef.current;
    if (!box || !scroll) return;

    const maxHeight = getContentBoxMaxHeight();
    const contentHeight = scroll.scrollHeight;
    const desired = Math.min(
      maxHeight,
      Math.max(CONTENT_BOX_MIN_HEIGHT, contentHeight),
    );
    const currentHeight = box.getBoundingClientRect().height;

    if (desired > currentHeight + 1) {
      box.style.height = `${Math.max(desired, CONTENT_BOX_DEFAULT_HEIGHT)}px`;
    }

    if (!hasBlocks && bodyRef.current && scroll.clientHeight) {
      const el = bodyRef.current;
      const cap = scroll.clientHeight - 16;
      if (el.scrollHeight > cap) {
        el.style.height = `${cap}px`;
        el.style.overflowY = "auto";
      }
    }

    const active = document.activeElement;
    if (active instanceof HTMLElement && scroll.contains(active)) {
      active.scrollIntoView({ block: "nearest", behavior: "instant" });
    } else if (desired >= maxHeight - 1) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  }, [hasBlocks]);

  const syncBodyHeightUncapped = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = "hidden";
  }, []);

  const requestContentBoxGrow = useCallback(() => {
    const runSync = () => {
      if (!hasBlocks && bodyRef.current) syncBodyHeightUncapped();
      syncContentBoxHeight();
    };
    requestAnimationFrame(() => {
      runSync();
      requestAnimationFrame(runSync);
    });
  }, [hasBlocks, syncContentBoxHeight, syncBodyHeightUncapped]);

  const syncBodyHeight = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const scroll = el.closest(".doc-new-content-scroll");
    el.style.height = "auto";
    const cap = scroll?.clientHeight ? scroll.clientHeight - 16 : 200;
    const next = Math.min(el.scrollHeight, Math.max(cap, 40));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncTitleHeight();
  }, [title, syncTitleHeight]);

  useLayoutEffect(() => {
    if (hasBlocks) return;
    syncBodyHeight();
  }, [body, syncBodyHeight, hasBlocks]);

  useLayoutEffect(() => {
    if (!hasBlocks) return;
    requestAnimationFrame(() => {
      syncContentBoxHeight();
      requestAnimationFrame(syncContentBoxHeight);
    });
  }, [normalizedBlocks, hasBlocks, syncContentBoxHeight]);

  const handleSlashConfirmFromBody = () => {
    if (!slashTail) return false;
    const parsed = parseSlashQuery(slashTail.slice(1));
    if (!parsed) return false;

    const { prefix } = splitBodyForSlash(body);
    const nextBlocks = [];

    if (prefix.trim()) {
      nextBlocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: prefix }));
    }

    const newBlock = createDocBlockFromSlash(parsed);
    nextBlocks.push(newBlock);
    nextBlocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" }));
    onBlocksChange?.(nextBlocks);
    onBodyChange?.("");
    setFocusBlockId(newBlock.id);
    return true;
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && slashTail) {
      if (handleSlashConfirmFromBody()) {
        e.preventDefault();
        requestContentBoxGrow();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      requestContentBoxGrow();
    }
    if (e.key === "Escape" && slashTail) {
      const { prefix } = splitBodyForSlash(body);
      e.preventDefault();
      onBodyChange?.(prefix);
      return;
    }
    onBodyKeyDown?.(e);
  };

  return (
    <div className="doc-new-inner">
      <header className="doc-new-head">
        <div className="doc-new-head-top">
          <img className="doc-new-head-icon" src={DOC_FILE_TXT_ICON} alt="" aria-hidden />
          {docHeaderLabel ? (
            <span className="doc-new-doc-label">{docHeaderLabel}</span>
          ) : null}
          {onCloseExpand && (
            <button
              type="button"
              className="doc-new-head-expand-btn"
              onClick={onCloseExpand}
              aria-label="Close"
            >
              <span className="doc-new-head-close-x" aria-hidden>
                ×
              </span>
            </button>
          )}
        </div>
        <textarea
          ref={titleRef}
          className="doc-new-head-title"
          value={title}
          placeholder={titlePlaceholder}
          onChange={(e) => {
            onTitleChange(e.target.value);
            requestAnimationFrame(syncTitleHeight);
          }}
          onKeyDown={onTitleKeyDown}
          rows={1}
          aria-label="Document title"
        />
      </header>

      <DocMetaStrip
        createdDate={createdDate}
        onCreatedDateChange={onCreatedDateChange}
        brandLabel={docHeaderLabel}
        version={version}
        onVersionChange={onVersionChange}
        category={category}
        onCategoryChange={onCategoryChange}
        launchDate={launchDate}
        onLaunchDateChange={onLaunchDateChange}
        campaignActive={campaignActive}
        onCampaignActiveChange={onCampaignActiveChange}
        parentId={parentId}
        onParentIdChange={onParentIdChange}
        objects={objects}
        showCampaignMeta={showCampaignMeta}
        nodeLinkColor={metaStripNodeLinkColor}
        onNodeLinkColorChange={handleMetaNodeLinkColorChange}
      />

      <div
        ref={contentBoxRef}
        className="doc-new-content-box doc-new-content-box--resizable"
      >
        <div ref={contentScrollRef} className="doc-new-content-scroll">
          {hasBlocks ? (
            <DocBlockStack
              blocks={normalizedBlocks}
              onBlocksChange={onBlocksChange}
              focusBlockId={focusBlockId}
              onFocusBlock={setFocusBlockId}
              bodyPlaceholder={bodyPlaceholder}
              onBodyKeyDown={onBodyKeyDown}
              onEnterNewLine={requestContentBoxGrow}
              onOpenNodeForBlock={onOpenNodeForBlock || onOpenNodeForH1}
              onOpenNodeForH1={onOpenNodeForH1}
              onAnswerBelowH1Change={onAnswerBelowH1Change}
              onBlockAnchorChange={onBlockAnchorChange}
              docCreatedDate={createdDate}
            />
          ) : (
            <div className="doc-body-field-wrap">
              <SlashAwareTextarea
                inputRef={bodyRef}
                value={body}
                onChange={(v) => {
                  onBodyChange?.(v);
                  requestAnimationFrame(syncBodyHeight);
                }}
                onAfterInput={requestContentBoxGrow}
                onKeyDown={handleTextareaKeyDown}
                placeholder={bodyPlaceholder}
                wrapClassName="doc-body-field-wrap__slash"
                className="doc-new-body-field"
                minHeightPx={26}
                maxHeightPx={520}
              />
            </div>
          )}
        </div>
      </div>

      <div className="doc-new-actions">
        <button type="button" className="doc-new-action doc-new-action--delete" onClick={onDelete}>
          delete
        </button>
        <button type="button" className="doc-new-action doc-new-action--save" onClick={onSave}>
          save
        </button>
      </div>
    </div>
  );
}
