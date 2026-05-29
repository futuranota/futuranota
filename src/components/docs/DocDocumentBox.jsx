import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  DOC_FILE_TXT_ICON,
  DOC_PARENT_ICON,
  DOC_TIMER_ICON,
} from "../../lib/docMediumAssets.js";
import { createDocBlock, DOC_BLOCK_TYPES, normalizeDocBlocks } from "../../lib/docBlocks.js";
import {
  createDocBlockFromSlash,
  parseSlashQuery,
  splitBodyForSlash,
} from "../../lib/docBlockSlash.js";
import { getToday } from "../../data.jsx";
import { computeWindowLabel } from "../../lib/docMetaBar.js";
import { isoFromDateInput } from "../../lib/docDates.js";
import { DocBlockStack } from "./blocks/DocBlockStack.jsx";
import { SlashAwareTextarea } from "./blocks/SlashAwareTextarea.jsx";

const DEFAULT_HEADER_LABEL = "— sin padre —";

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
}) {
  const showParent = objects && onParentIdChange;
  const showCampaignMeta = Boolean(onVersionChange);
  const docHeaderLabel = (headerLabel ?? "").trim() || DEFAULT_HEADER_LABEL;
  const launchIso = launchDate ? isoFromDateInput(launchDate) : null;
  const windowPreview = computeWindowLabel(getToday(), launchIso) || "—";
  const bodyRef = useRef(null);
  const [focusBlockId, setFocusBlockId] = useState(null);

  const normalizedBlocks = normalizeDocBlocks(blocks);
  const hasBlocks = normalizedBlocks.length > 0;
  const { slash: slashTail } = splitBodyForSlash(body);

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
    if (hasBlocks) return;
    syncBodyHeight();
  }, [body, syncBodyHeight, hasBlocks]);

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
    onBlocksChange?.(nextBlocks);
    onBodyChange?.("");
    setFocusBlockId(newBlock.id);
    return true;
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && slashTail) {
      if (handleSlashConfirmFromBody()) {
        e.preventDefault();
        return;
      }
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
          <span className="doc-new-doc-label">{docHeaderLabel}</span>
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
        <input
          ref={titleRef}
          type="text"
          className="doc-new-head-title"
          value={title}
          placeholder={titlePlaceholder}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={onTitleKeyDown}
          aria-label="Document title"
        />
      </header>

      <div className={"doc-new-meta" + (showCampaignMeta ? " doc-new-meta--campaign" : "")}>
        <div className="doc-new-row">
          <img className="doc-new-meta-icon" src={DOC_TIMER_ICON} alt="" aria-hidden />
          <span className="doc-new-key">Created</span>
          <input
            type="date"
            className="doc-new-date"
            value={createdDate}
            onChange={(e) => onCreatedDateChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {showCampaignMeta ? (
          <>
            <div className="doc-new-row">
              <img className="doc-new-meta-icon" src={DOC_FILE_TXT_ICON} alt="" aria-hidden />
              <span className="doc-new-key">Version</span>
              <input
                type="text"
                className="doc-new-meta-input"
                value={version}
                onChange={(e) => onVersionChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="—"
                spellCheck={false}
                aria-label="Version"
              />
            </div>
            <div className="doc-new-row">
              <img className="doc-new-meta-icon" src={DOC_FILE_TXT_ICON} alt="" aria-hidden />
              <span className="doc-new-key">Campaign</span>
              <div className="doc-new-campaign-toggle" role="group" aria-label="Campaign status">
                <button
                  type="button"
                  className={"doc-new-campaign-opt" + (campaignActive ? " is-on" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCampaignActiveChange(true);
                  }}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={"doc-new-campaign-opt" + (!campaignActive ? " is-on" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCampaignActiveChange(false);
                  }}
                >
                  Not active
                </button>
              </div>
            </div>
            <div className="doc-new-row">
              <img className="doc-new-meta-icon" src={DOC_FILE_TXT_ICON} alt="" aria-hidden />
              <span className="doc-new-key">Categories</span>
              <input
                type="text"
                className="doc-new-meta-input"
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Category tag"
                spellCheck={false}
                aria-label="Categories"
              />
            </div>
            <div className="doc-new-row">
              <img className="doc-new-meta-icon" src={DOC_TIMER_ICON} alt="" aria-hidden />
              <span className="doc-new-key">Launch date</span>
              <input
                type="date"
                className="doc-new-date"
                value={launchDate}
                onChange={(e) => onLaunchDateChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Launch date"
              />
            </div>
            <div className="doc-new-row">
              <img className="doc-new-meta-icon" src={DOC_TIMER_ICON} alt="" aria-hidden />
              <span className="doc-new-key">Window</span>
              <span className="doc-new-meta-readonly" aria-live="polite">
                {windowPreview}
              </span>
            </div>
          </>
        ) : null}
        {showParent && (
          <div className="doc-new-row">
            <img
              className="doc-new-meta-icon doc-new-meta-icon--parent"
              src={DOC_PARENT_ICON}
              alt=""
              aria-hidden
            />
            <span className="doc-new-key doc-new-key--parent">Parent</span>
            <select
              className="doc-new-select"
              value={parentId}
              onChange={(e) => onParentIdChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">— sin padre —</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="doc-new-content-box doc-new-content-box--resizable">
        <div className="doc-new-content-scroll">
          {hasBlocks ? (
            <DocBlockStack
              blocks={normalizedBlocks}
              onBlocksChange={onBlocksChange}
              focusBlockId={focusBlockId}
              onFocusBlock={setFocusBlockId}
              bodyPlaceholder={bodyPlaceholder}
              onBodyKeyDown={onBodyKeyDown}
              onOpenNodeForBlock={onOpenNodeForBlock || onOpenNodeForH1}
              onOpenNodeForH1={onOpenNodeForH1}
              onAnswerBelowH1Change={onAnswerBelowH1Change}
              onBlockAnchorChange={onBlockAnchorChange}
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
