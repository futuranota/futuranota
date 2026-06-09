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
  createBlocksFromSlash,
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
import { SearchSpinner } from "../shared/SearchSpinner.jsx";
import { hasKnowledgeImport } from "../../lib/knowledgeImport.js";
import { scrollTextareaCaretIntoCameraView } from "../../lib/textareaSelectionRect.js";

const SAVE_LOADING_MIN_MS = 400;

const DEFAULT_HEADER_LABEL = "";
const CONTENT_BOX_MIN_HEIGHT = 100;
const CONTENT_BOX_DEFAULT_HEIGHT = 200;
const CONTENT_BOX_KNOWLEDGE_DEFAULT_HEIGHT = 118;

const KNOWLEDGE_IMPORT_HINT =
  "Use the text area below to summarize what you imported: key topics, "
  + "what the file is for, or a short outline. This space is for your own reference.";

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
  onSave,
  onCloseAfterSave,
  onCloseExpand,
  onTitleKeyDown,
  onBodyKeyDown,
  onOpenNodeForBlock,
  onOpenNodeForH1,
  onEnsureNodeForBlock,
  onAnswerBelowH1Change,
  onBlockAnchorChange,
  onInsertProductToCanvas,
  onVideoEmbedSync,
  onVideoEmbedH1TitleChange,
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
  const [contentFocusMode, setContentFocusMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveClick = useCallback(async () => {
    if (isSaving || saveDisabled || !onSave) return;
    setIsSaving(true);
    try {
      await Promise.all([
        Promise.resolve(onSave()),
        new Promise((resolve) => {
          window.setTimeout(resolve, SAVE_LOADING_MIN_MS);
        }),
      ]);
      onCloseAfterSave?.();
    } catch {
      setIsSaving(false);
    }
  }, [isSaving, saveDisabled, onSave, onCloseAfterSave]);

  useEffect(() => {
    setContentFocusMode(false);
    setIsSaving(false);
  }, [docId]);

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

  const focusContentArea = useCallback(() => {
    const scroll = contentScrollRef.current;
    if (!scroll) return;
    const target = scroll.querySelector(
      "textarea, input:not([type='hidden']), [contenteditable='true']",
    );
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
      return;
    }
    scroll.focus({ preventScroll: true });
  }, []);

  const syncBodyHeightUncapped = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = "hidden";
  }, []);

  const syncContentBoxHeight = useCallback(() => {
    const box = contentBoxRef.current;
    const scroll = contentScrollRef.current;
    if (!box || !scroll) return;
    if (contentFocusMode) return;

    const defaultHeight = isKnowledgeMode
      ? CONTENT_BOX_KNOWLEDGE_DEFAULT_HEIGHT
      : CONTENT_BOX_DEFAULT_HEIGHT;
    const desired = Math.max(CONTENT_BOX_MIN_HEIGHT, scroll.scrollHeight, defaultHeight);
    box.style.height = `${desired}px`;

    if (!hasBlocks && bodyRef.current) {
      syncBodyHeightUncapped();
    }

    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && scroll.contains(active)) {
      scrollTextareaCaretIntoCameraView(active, { behavior: "instant" });
    } else if (active instanceof HTMLElement && scroll.contains(active)) {
      active.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [hasBlocks, isKnowledgeMode, contentFocusMode, syncBodyHeightUncapped]);

  const exitContentFocusMode = useCallback(() => {
    setContentFocusMode(false);
    const box = contentBoxRef.current;
    if (box) box.style.height = "";
    requestAnimationFrame(() => {
      syncContentBoxHeight();
    });
  }, [syncContentBoxHeight]);

  const toggleContentFocus = useCallback(() => {
    if (contentFocusMode) {
      exitContentFocusMode();
      return;
    }
    setContentFocusMode(true);
  }, [contentFocusMode, exitContentFocusMode]);

  useEffect(() => {
    if (!contentFocusMode) return undefined;
    const box = contentBoxRef.current;
    if (box) box.style.height = "";
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(focusContentArea);
    });
    return () => cancelAnimationFrame(t);
  }, [contentFocusMode, focusContentArea]);

  useEffect(() => {
    if (!contentFocusMode) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      exitContentFocusMode();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [contentFocusMode, exitContentFocusMode]);

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
    syncBodyHeightUncapped();
    requestAnimationFrame(syncContentBoxHeight);
  }, [syncBodyHeightUncapped, syncContentBoxHeight]);

  useLayoutEffect(() => {
    syncTitleHeight();
  }, [title, syncTitleHeight]);

  useLayoutEffect(() => {
    if (hasBlocks) return;
    syncBodyHeight();
  }, [body, syncBodyHeight, hasBlocks]);

  useLayoutEffect(() => {
    if (!hasBlocks) return;
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        blockStackRef.current?.resyncTextHeights?.();
        syncContentBoxHeight();
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [docId, normalizedBlocks, hasBlocks, syncContentBoxHeight]);

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
    const inserted = createBlocksFromSlash(parsed, prefix);
    const focusId = parsed.compound && parsed.type === DOC_BLOCK_TYPES.VIDEO_EMBED
      ? inserted.find((b) => b.type === DOC_BLOCK_TYPES.H1)?.id
      : inserted[inserted.length - 1]?.id;
    onBlocksChange?.([...inserted, createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })]);
    onBodyChange?.("");
    setFocusBlockId(focusId || null);
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
    const inserted = createBlocksFromSlash(parsed, prefix);
    const focusId = parsed.compound && parsed.type === DOC_BLOCK_TYPES.VIDEO_EMBED
      ? inserted.find((b) => b.type === DOC_BLOCK_TYPES.H1)?.id
      : inserted[inserted.length - 1]?.id;
    onBlocksChange?.([...inserted, createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })]);
    onBodyChange?.("");
    setFocusBlockId(focusId || null);
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
        + (contentFocusMode ? " doc-new-inner--content-focus" : "")
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
        }
      >
        <div
          ref={contentScrollRef}
          tabIndex={-1}
          className={
            "doc-new-content-scroll"
            + (isKnowledgeMode ? " doc-new-content-scroll--knowledge" : "")
            + (showKnowledgeNotesPlaceholder ? " doc-new-content-scroll--hint-active" : "")
            + (contentFocusMode ? " doc-new-content-scroll--focus" : "")
          }
          onPointerDown={(event) => {
            if (!showKnowledgeNotesPlaceholder) return;
            if (event.target.closest(".doc-knowledge-import-hint")) return;
            dismissKnowledgeHint();
          }}
        >
          <button
            type="button"
            className={
              "doc-new-content-expand-btn"
              + (contentFocusMode ? " is-focus" : "")
            }
            onClick={toggleContentFocus}
            aria-label={contentFocusMode ? "Back to document" : "Focus on content"}
            aria-pressed={contentFocusMode}
            title={contentFocusMode ? "Back to document" : "Expand content"}
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
              onVideoEmbedSync={onVideoEmbedSync}
              onVideoEmbedH1TitleChange={onVideoEmbedH1TitleChange}
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
                onFocus={() => {
                  if (showKnowledgeNotesPlaceholder) dismissKnowledgeHint();
                }}
                placeholder={bodyPlaceholder}
                wrapClassName="doc-body-field-wrap__slash"
                className="doc-new-body-field"
                minHeightPx={26}
                maxHeightPx={520}
              />
            </div>
          )}
        </div>
        <DocSlashCommandPicker
          onSelectCommand={insertSlashCommandFromPicker}
          isCommandEnabled={isSlashCommandEnabled}
          variant="floating"
        />
      </div>

      <div className="doc-new-actions">
        <button
          type="button"
          className={
            "doc-new-action doc-new-action--save"
            + (isSaving ? " doc-new-action--save-loading" : "")
          }
          disabled={saveDisabled || isSaving}
          onClick={handleSaveClick}
          aria-busy={isSaving}
        >
          {isSaving ? (
            <>
              <SearchSpinner size={14} />
              <span>Saving…</span>
            </>
          ) : (
            "save"
          )}
        </button>
      </div>
    </div>
  );
}
