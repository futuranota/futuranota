import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOC_FILE_TXT_ICON } from "../../lib/docMediumAssets.js";
import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  hasProductCardBlock,
  normalizeDocBlocks,
  updateBlockAt,
} from "../../lib/docBlocks.js";
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
import { DocParentHeadPicker } from "./DocParentHeadPicker.jsx";
import { TemplateMetaStrip } from "../templates/TemplateMetaStrip.jsx";
import { isTemplateDoc } from "../../lib/templateDoc.js";
import { DocBlockStack } from "./blocks/DocBlockStack.jsx";
import { DocSlashCommandPicker } from "./blocks/DocSlashCommandPicker.jsx";
import { SlashAwareTextarea } from "./blocks/SlashAwareTextarea.jsx";
import { hasKnowledgeImport } from "../../lib/knowledgeImport.js";

const DEFAULT_HEADER_LABEL = "";
const CONTENT_BOX_MIN_HEIGHT = 100;
const CONTENT_BOX_DEFAULT_HEIGHT = 200;
const CONTENT_BOX_KNOWLEDGE_DEFAULT_HEIGHT = 118;
const CONTENT_BOX_MAX_HEIGHT = 520;

const KNOWLEDGE_IMPORT_HINT =
  "Use the text area below to summarize what you imported: key topics, "
  + "what the file is for, or a short outline. This space is for your own reference.";

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
  bodyPlaceholder: bodyPlaceholderProp = 'Type your text here "/"create command',
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
  onEnsureNodeForBlock,
  onAnswerBelowH1Change,
  onBlockAnchorChange,
  onInsertProductToCanvas,
  headerLabel,
  version = "",
  onVersionChange,
  onVersionCommit,
  category = "",
  onCategoryChange,
  launchDate = "",
  onLaunchDateChange,
  campaignActive = false,
  onCampaignActiveChange,
  nodeLinkColor = "dark",
  onNodeLinkColorChange,
  docKind = "standard",
  templateKind = null,
  subcategoryDocIds = [],
  onSubcategoryDocIdsChange,
  templateSubcategoryDocIds = [],
  onTemplateSubcategoryDocIdsChange,
  allDocs = null,
  docId = null,
  saveDisabled = false,
  metaMode = "campaign",
  initialFocusBlockId = null,
  onKnowledgeFileImport,
  knowledgeImport = null,
}) {
  const isTemplate = docKind === "template" || isTemplateDoc({ docKind });
  const isProductMode = metaMode === "product";
  const isContentMode = metaMode === "content";
  const isKnowledgeMode = metaMode === "knowledge";
  const showCampaignMeta = Boolean(onVersionChange) && !isTemplate && !isProductMode && !isKnowledgeMode;
  const resolvedSubcategoryDocIds = subcategoryDocIds?.length
    ? subcategoryDocIds
    : templateSubcategoryDocIds;
  const handleSubcategoryDocIdsChange = onSubcategoryDocIdsChange || onTemplateSubcategoryDocIdsChange;
  const showTemplateMeta = isTemplate && Boolean(handleSubcategoryDocIdsChange);
  const showParentPicker = Boolean(onParentIdChange && objects?.length && !isKnowledgeMode);
  const knowledgeImportActive = hasKnowledgeImport({ knowledgeImport });
  const docHeaderLabel = (headerLabel ?? "").trim() || DEFAULT_HEADER_LABEL;
  const bodyPlaceholder = isKnowledgeMode ? "" : bodyPlaceholderProp;
  const bodyRef = useRef(null);
  const contentBoxRef = useRef(null);
  const contentScrollRef = useRef(null);
  const blockStackRef = useRef(null);
  const [focusBlockId, setFocusBlockId] = useState(null);
  const [knowledgeHintDismissed, setKnowledgeHintDismissed] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);

  useEffect(() => {
    if (!isKnowledgeMode) return;
    setKnowledgeHintDismissed(false);
  }, [isKnowledgeMode, docId]);

  useEffect(() => {
    if (!initialFocusBlockId) return undefined;
    setFocusBlockId(initialFocusBlockId);
    const scrollToTarget = () => {
      if (initialFocusBlockId === "__doc_meta_launch__") {
        const launchInput = document.querySelector(
          ".doc-overlay-global .doc-meta-field input[type='date']",
        );
        launchInput?.scrollIntoView({ block: "center", behavior: "smooth" });
        launchInput?.focus({ preventScroll: true });
        return;
      }
      const blockEl = document.querySelector(
        `.doc-overlay-global [data-block-id="${initialFocusBlockId}"]`,
      );
      blockEl?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const t1 = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTarget);
    });
    return () => cancelAnimationFrame(t1);
  }, [initialFocusBlockId, docId]);

  const parentObject = useMemo(() => {
    if (!parentId || !objects) return null;
    if (Array.isArray(objects)) return objects.find((o) => o.id === parentId) ?? null;
    return objects[parentId] ?? null;
  }, [objects, parentId]);
  const normalizedBlocks = normalizeDocBlocks(blocks);
  const hasBlocks = normalizedBlocks.length > 0;
  const showKnowledgeNotesPlaceholder = isKnowledgeMode && !knowledgeHintDismissed;

  const dismissKnowledgeHint = () => {
    setKnowledgeHintDismissed(true);
    requestAnimationFrame(() => {
      bodyRef.current?.focus({ preventScroll: true });
    });
  };

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
    const defaultHeight = isKnowledgeMode
      ? CONTENT_BOX_KNOWLEDGE_DEFAULT_HEIGHT
      : CONTENT_BOX_DEFAULT_HEIGHT;
    const desired = Math.min(
      maxHeight,
      Math.max(CONTENT_BOX_MIN_HEIGHT, contentHeight),
    );
    const currentHeight = box.getBoundingClientRect().height;

    if (desired > currentHeight + 1) {
      box.style.height = `${Math.max(desired, defaultHeight)}px`;
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
  }, [hasBlocks, isKnowledgeMode]);

  const syncBodyHeightUncapped = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = "hidden";
  }, []);

  const toggleContentExpand = useCallback(() => {
    setContentExpanded((prev) => {
      const next = !prev;
      const box = contentBoxRef.current;
      if (box) {
        if (next) {
          box.style.height = `${getContentBoxMaxHeight()}px`;
        } else {
          box.style.height = "";
          requestAnimationFrame(() => {
            syncContentBoxHeight();
          });
        }
      }
      return next;
    });
  }, [syncContentBoxHeight]);

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

  const isSlashCommandEnabled = useCallback((cmd) => {
    const parsed = parseSlashQuery(cmd.aliases[0]);
    if (!parsed) return false;
    if (
      parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD
      && hasProductCardBlock(hasBlocks ? normalizedBlocks : [])
    ) {
      return false;
    }
    return true;
  }, [hasBlocks, normalizedBlocks]);

  const insertSlashCommandFromPicker = useCallback((alias) => {
    if (hasBlocks) {
      blockStackRef.current?.insertSlashCommand?.(alias);
      requestContentBoxGrow();
      return;
    }

    const parsed = parseSlashQuery(alias);
    if (!parsed || !isSlashCommandEnabled({ aliases: [alias] })) return;

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
    requestContentBoxGrow();
  }, [
    body,
    hasBlocks,
    isSlashCommandEnabled,
    onBlocksChange,
    onBodyChange,
    requestContentBoxGrow,
  ]);

  const handleSlashConfirmFromBody = () => {
    if (!slashTail) return false;
    const parsed = parseSlashQuery(slashTail.slice(1));
    if (!parsed) return false;
    if (
      parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD
      && hasProductCardBlock(normalizedBlocks)
    ) {
      return false;
    }

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
    <div
      className={
        "doc-new-inner"
        + (isKnowledgeMode ? " doc-new-inner--knowledge" : "")
      }
    >
      <header className="doc-new-head">
        <div className="doc-new-head-top">
          {showParentPicker ? (
            <DocParentHeadPicker
              parentId={parentId}
              onParentIdChange={onParentIdChange}
              objects={objects}
            />
          ) : (
            <>
              <img className="doc-new-head-icon" src={DOC_FILE_TXT_ICON} alt="" aria-hidden />
              {docHeaderLabel ? (
                <span className="doc-new-doc-label">{docHeaderLabel}</span>
              ) : null}
            </>
          )}
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
          className={
            "doc-new-head-title"
            + (isKnowledgeMode ? " doc-new-head-title--knowledge" : "")
          }
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

      {showTemplateMeta ? (
        <TemplateMetaStrip
          createdDate={createdDate}
          onCreatedDateChange={onCreatedDateChange}
          parentId={parentId}
          templateKind={templateKind}
          subcategoryDocIds={resolvedSubcategoryDocIds}
          onSubcategoryDocIdsChange={handleSubcategoryDocIdsChange}
          allDocs={allDocs}
          excludeDocId={docId}
          nodeLinkColor={metaStripNodeLinkColor}
          onNodeLinkColorChange={handleMetaNodeLinkColorChange}
        />
      ) : (
        <DocMetaStrip
          createdDate={createdDate}
          onCreatedDateChange={onCreatedDateChange}
          brandLabel={parentObject?.brand?.trim() || ""}
          version={version}
          onVersionChange={onVersionChange}
          onVersionCommit={onVersionCommit}
          category={category}
          onCategoryChange={onCategoryChange}
          launchDate={launchDate}
          onLaunchDateChange={onLaunchDateChange}
          campaignActive={campaignActive}
          onCampaignActiveChange={onCampaignActiveChange}
          parentId={parentId}
          subcategoryDocIds={resolvedSubcategoryDocIds}
          onSubcategoryDocIdsChange={handleSubcategoryDocIdsChange}
          allDocs={allDocs}
          docId={docId}
          objects={objects}
          showCampaignMeta={showCampaignMeta}
          metaMode={metaMode}
          nodeLinkColor={metaStripNodeLinkColor}
          onNodeLinkColorChange={isKnowledgeMode ? undefined : handleMetaNodeLinkColorChange}
          onKnowledgeFileImport={onKnowledgeFileImport}
          knowledgeImport={knowledgeImport}
          hasKnowledgeImport={knowledgeImportActive}
        />
      )}

      <div
        ref={contentBoxRef}
        className={
          "doc-new-content-box doc-new-content-box--resizable"
          + (isKnowledgeMode ? " doc-new-content-box--knowledge-notes" : "")
          + (contentExpanded ? " doc-new-content-box--expanded" : "")
        }
      >
        <div
          ref={contentScrollRef}
          className={
            "doc-new-content-scroll"
            + (isKnowledgeMode ? " doc-new-content-scroll--knowledge" : "")
            + (showKnowledgeNotesPlaceholder ? " doc-new-content-scroll--hint-active" : "")
          }
        >
          <button
            type="button"
            className={
              "doc-new-content-expand-btn"
              + (contentExpanded ? " is-expanded" : "")
            }
            onClick={toggleContentExpand}
            aria-label={contentExpanded ? "Collapse content area" : "Expand content area"}
            aria-pressed={contentExpanded}
            title={contentExpanded ? "Collapse" : "Expand"}
          >
            <span className="doc-new-content-expand-btn__icon" aria-hidden />
          </button>
          {showKnowledgeNotesPlaceholder ? (
            <button
              type="button"
              className="doc-knowledge-import-hint doc-knowledge-import-hint--placeholder"
              onClick={dismissKnowledgeHint}
            >
              <span className="doc-knowledge-import-hint__text">{KNOWLEDGE_IMPORT_HINT}</span>
              <span className="doc-knowledge-import-hint__action">Tap to write</span>
            </button>
          ) : null}
          {hasBlocks ? (
            <DocBlockStack
              ref={blockStackRef}
              blocks={normalizedBlocks}
              onBlocksChange={onBlocksChange}
              focusBlockId={focusBlockId}
              onFocusBlock={setFocusBlockId}
              bodyPlaceholder={bodyPlaceholder}
              onBodyKeyDown={onBodyKeyDown}
              onEnterNewLine={requestContentBoxGrow}
              onOpenNodeForBlock={onOpenNodeForBlock || onOpenNodeForH1}
              onOpenNodeForH1={onOpenNodeForH1}
              onEnsureNodeForBlock={onEnsureNodeForBlock}
              onAnswerBelowH1Change={onAnswerBelowH1Change}
              onBlockAnchorChange={onBlockAnchorChange}
              docCreatedDate={createdDate}
              onInsertProductToCanvas={onInsertProductToCanvas}
            />
          ) : (
            <div
              className={
                "doc-body-field-wrap"
                + (isKnowledgeMode ? " doc-body-field-wrap--knowledge" : "")
                + (showKnowledgeNotesPlaceholder ? " doc-body-field-wrap--has-placeholder" : "")
              }
            >
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
          <DocSlashCommandPicker
            onSelectCommand={insertSlashCommandFromPicker}
            isCommandEnabled={isSlashCommandEnabled}
            variant="floating"
          />
        </div>
      </div>

      <div className="doc-new-actions">
        <button type="button" className="doc-new-action doc-new-action--delete" onClick={onDelete}>
          delete
        </button>
        <button
          type="button"
          className="doc-new-action doc-new-action--save"
          disabled={saveDisabled}
          onClick={onSave}
        >
          save
        </button>
      </div>
    </div>
  );
}
