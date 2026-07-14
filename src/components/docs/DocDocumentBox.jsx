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
  DOCUMENT_SLASH_COMMANDS,
  DOCUMENT_SLASH_GHOST_HINTS,
  FOLDER_SLASH_COMMANDS,
  FOLDER_SLASH_GHOST_HINTS,
  parseDocumentSlashQuery,
  parseFolderSlashQuery,
  parseSlashQueryFromCommands,
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
import { hasKnowledgeImport, knowledgeNotesHasContent } from "../../lib/knowledgeImport.js";
import { useI18n } from "../../i18n/useI18n.js";
import { ContentTextSizeControls } from "./ContentTextSizeControls.jsx";
import { useDocTextTypography } from "../../hooks/useDocTextTypography.js";

const SAVE_LOADING_MIN_MS = 400;

const DEFAULT_HEADER_LABEL = "";
const CONTENT_BOX_MIN_HEIGHT = 100;
const CONTENT_BOX_DEFAULT_HEIGHT = 240;
const CONTENT_BOX_KNOWLEDGE_DEFAULT_HEIGHT = 160;
const CONTENT_BOX_PICKER_CLEARANCE = 28;
const CONTENT_BOX_MAX_HEIGHT = 720;

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
  onDetachFromNode,
  onSavedStepSequenceRemoved,
  headerLabel,
  version = "",
  onVersionChange,
  onVersionCommit,
  category = "",
  onCategoryChange,
  launchDate = "",
  onLaunchDateChange,
  scheduleStartDate = "",
  onScheduleStartDateChange,
  scheduleFinishDate = "",
  onScheduleFinishDateChange,
  scheduleStartMin = "",
  onScheduleDatesClear,
  useFolderSchedule = false,
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
  reportPresentation = null,
  onReportAnimationComplete = null,
}) {
  const { t } = useI18n();
  const isTemplate = docKind === "template" || isTemplateDoc({ docKind });
  const isProductMode = metaMode === "product";
  const isContentMode = metaMode === "content";
  const isKnowledgeMode = metaMode === "knowledge";
  /**
   * Folders: Create node only. Writing toolkit (image-split, …) lives in documents/macronodes.
   */
  const isFolderSlashSurface = metaMode === "content" || docKind === "content";
  const slashCommands = isFolderSlashSurface ? FOLDER_SLASH_COMMANDS : DOCUMENT_SLASH_COMMANDS;
  const slashGhostHints = isFolderSlashSurface ? FOLDER_SLASH_GHOST_HINTS : DOCUMENT_SLASH_GHOST_HINTS;
  const parseScopedSlashQuery = isFolderSlashSurface ? parseFolderSlashQuery : parseDocumentSlashQuery;
  const showCampaignMeta = Boolean(onVersionChange) && !isTemplate && !isProductMode && !isKnowledgeMode;
  const resolvedSubcategoryDocIds = subcategoryDocIds?.length
    ? subcategoryDocIds
    : templateSubcategoryDocIds;
  const handleSubcategoryDocIdsChange = onSubcategoryDocIdsChange || onTemplateSubcategoryDocIdsChange;
  const showTemplateMeta = isTemplate && Boolean(handleSubcategoryDocIdsChange);
  const showParentPicker = Boolean(onParentIdChange && objects?.length && !isKnowledgeMode);
  const knowledgeImportActive = hasKnowledgeImport({ knowledgeImport });
  const docHeaderLabel = (headerLabel ?? "").trim() || DEFAULT_HEADER_LABEL;
  // Step-by-step docs already show "Step by step" + the step counter inside the
  // block's own styled header. When the doc has no real title it falls back to
  // the literal "Step by step", which duplicates that label as the plain document
  // title. Blank the plain title in that case so only the styled (css) copy shows;
  // real user titles still render at the top.
  const isStepPlaybookDoc = Array.isArray(blocks)
    && blocks.some((b) => b.type === DOC_BLOCK_TYPES.STEP_SEQUENCE);
  const titleDuplicatesStepLabel =
    isStepPlaybookDoc && (title || "").trim() === "Step by step";
  const displayedTitle = titleDuplicatesStepLabel ? "" : title;
  const focusCategoryLabel = (
    (category || "").trim()
    || (displayedTitle || "").trim()
    || ""
  );
  const linkedNodeCount = useMemo(() => {
    const seen = new Set();
    for (const block of normalizeDocBlocks(blocks)) {
      if (block?.nodeId) seen.add(block.nodeId);
    }
    return seen.size;
  }, [blocks]);
  const bodyPlaceholder = isKnowledgeMode
    ? (knowledgeImportActive
      ? t("sidebar.knowledgeNotesImportPlaceholder")
      : t("sidebar.knowledgeNotesPlaceholder"))
    : bodyPlaceholderProp;
  const bodyRef = useRef(null);
  const contentBoxRef = useRef(null);
  const contentScrollRef = useRef(null);
  const blockStackRef = useRef(null);
  const contentBoxManualHeightRef = useRef(null);
  const focusCategoryRef = useRef(null);
  const [focusBlockId, setFocusBlockId] = useState(null);
  const [knowledgeHintDismissed, setKnowledgeHintDismissed] = useState(false);
  const [contentFocusMode, setContentFocusMode] = useState(false);
  const [hasManualBoxHeight, setHasManualBoxHeight] = useState(false);
  const [contentBoxResizing, setContentBoxResizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const typographyStorageKey = docId ? `doc:${docId}` : null;
  const { typographyId, setTypographyId, typographyStyle } = useDocTextTypography(typographyStorageKey);

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
    setHasManualBoxHeight(false);
    contentBoxManualHeightRef.current = null;
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
  const blocksStructureKey = useMemo(
    () => normalizedBlocks.map((b) => `${b.id}:${b.type}`).join("|"),
    [normalizedBlocks],
  );
  const knowledgeNotesFilled = knowledgeNotesHasContent(
    body,
    normalizedBlocks,
    docBlocksToBody,
  );
  const showKnowledgeImportHint = isKnowledgeMode
    && knowledgeImportActive
    && !knowledgeNotesFilled
    && !knowledgeHintDismissed;

  useEffect(() => {
    if (knowledgeNotesFilled) setKnowledgeHintDismissed(true);
  }, [knowledgeNotesFilled]);

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

  const syncFocusCategoryHeight = useCallback(() => {
    const el = focusCategoryRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const focusContentArea = useCallback(() => {
    const scroll = contentScrollRef.current;
    if (!scroll) return;
    const active = document.activeElement;
    // Don't steal caret when expand opens and a field is already focused inside.
    if (
      active instanceof HTMLElement
      && scroll.contains(active)
      && active.matches("textarea, input:not([type='hidden']), [contenteditable='true']")
    ) {
      return;
    }
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

  const applyContentBoxLayout = useCallback((box, scroll, desired) => {
    const contentNeeded = scroll.scrollHeight + CONTENT_BOX_PICKER_CLEARANCE;
    const finalHeight = Math.min(
      CONTENT_BOX_MAX_HEIGHT,
      Math.max(CONTENT_BOX_MIN_HEIGHT, desired),
    );

    box.style.height = `${finalHeight}px`;
    scroll.style.overflowY = "auto";
    scroll.style.maxHeight = `${finalHeight}px`;
    return { finalHeight, contentNeeded };
  }, []);

  const clearManualBoxHeight = useCallback(() => {
    contentBoxManualHeightRef.current = null;
    setHasManualBoxHeight(false);
    const box = contentBoxRef.current;
    const scroll = contentScrollRef.current;
    if (box) box.style.height = "";
    if (scroll) {
      scroll.style.maxHeight = "";
      scroll.style.overflowY = "";
    }
  }, []);

  const syncContentBoxHeight = useCallback(() => {
    const box = contentBoxRef.current;
    const scroll = contentScrollRef.current;
    if (!box || !scroll) return;

    const defaultHeight = isKnowledgeMode
      ? CONTENT_BOX_KNOWLEDGE_DEFAULT_HEIGHT
      : CONTENT_BOX_DEFAULT_HEIGHT;
    const manual = contentBoxManualHeightRef.current;

    if (contentFocusMode && manual == null) {
      box.style.height = "";
      scroll.style.maxHeight = "";
      scroll.style.overflowY = "";
      return;
    }

    if (manual != null) {
      applyContentBoxLayout(box, scroll, manual);
      return;
    }

    if (!hasBlocks && bodyRef.current) {
      syncBodyHeightUncapped();
    }

    applyContentBoxLayout(box, scroll, defaultHeight);
  }, [hasBlocks, isKnowledgeMode, contentFocusMode, syncBodyHeightUncapped, applyContentBoxLayout]);

  const handleContentResizePointerDown = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const box = contentBoxRef.current;
    const scroll = contentScrollRef.current;
    if (!box || !scroll) return;

    if (contentBoxManualHeightRef.current == null) {
      contentBoxManualHeightRef.current = box.getBoundingClientRect().height;
      setHasManualBoxHeight(true);
    }

    const startY = event.clientY;
    const startHeight = contentBoxManualHeightRef.current;
    setContentBoxResizing(true);
    document.body.classList.add("doc-content-resizing");

    const onMove = (moveEvent) => {
      const next = Math.min(
        CONTENT_BOX_MAX_HEIGHT,
        Math.max(CONTENT_BOX_MIN_HEIGHT, startHeight + (moveEvent.clientY - startY)),
      );
      contentBoxManualHeightRef.current = next;
      applyContentBoxLayout(box, scroll, next);
    };

    const onUp = () => {
      setContentBoxResizing(false);
      document.body.classList.remove("doc-content-resizing");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [applyContentBoxLayout]);

  const resetContentBoxHeight = useCallback(() => {
    clearManualBoxHeight();
    requestAnimationFrame(() => {
      syncContentBoxHeight();
    });
  }, [clearManualBoxHeight, syncContentBoxHeight]);

  const exitContentFocusMode = useCallback(() => {
    clearManualBoxHeight();
    setContentFocusMode(false);
    requestAnimationFrame(() => {
      syncContentBoxHeight();
    });
  }, [clearManualBoxHeight, syncContentBoxHeight]);

  const toggleContentFocus = useCallback(() => {
    if (contentFocusMode) {
      exitContentFocusMode();
      return;
    }
    clearManualBoxHeight();
    setContentFocusMode(true);
  }, [contentFocusMode, exitContentFocusMode, clearManualBoxHeight]);

  useEffect(() => {
    if (!contentFocusMode) return undefined;
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
    if (!hasBlocks && bodyRef.current) syncBodyHeightUncapped();
    syncContentBoxHeight();
  }, [hasBlocks, syncContentBoxHeight, syncBodyHeightUncapped]);

  const syncBodyHeight = useCallback(() => {
    syncBodyHeightUncapped();
    requestAnimationFrame(syncContentBoxHeight);
  }, [syncBodyHeightUncapped, syncContentBoxHeight]);

  useLayoutEffect(() => {
    syncTitleHeight();
  }, [title, syncTitleHeight]);

  useLayoutEffect(() => {
    if (!contentFocusMode) return;
    syncFocusCategoryHeight();
  }, [contentFocusMode, focusCategoryLabel, syncFocusCategoryHeight]);

  useLayoutEffect(() => {
    syncContentBoxHeight();
  }, [docId, contentFocusMode, syncContentBoxHeight]);

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
  }, [docId, blocksStructureKey, hasBlocks, syncContentBoxHeight]);

  const isSlashCommandEnabled = useCallback((cmd) => {
    const parsed = parseSlashQueryFromCommands(cmd.aliases[0], slashCommands);
    if (!parsed) return false;
    if (
      parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD
      && hasProductCardBlock(hasBlocks ? normalizedBlocks : [])
    ) {
      return false;
    }
    return true;
  }, [hasBlocks, normalizedBlocks, slashCommands]);

  const insertSlashCommandFromPicker = useCallback((alias) => {
    if (hasBlocks) {
      blockStackRef.current?.insertSlashCommand?.(alias);
      requestContentBoxGrow();
      return;
    }

    const parsed = parseScopedSlashQuery(alias);
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
    parseScopedSlashQuery,
    requestContentBoxGrow,
  ]);

  const handleSlashConfirmFromBody = () => {
    if (!slashTail) return false;
    const parsed = parseScopedSlashQuery(slashTail.slice(1));
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
      {contentFocusMode ? (
        <header className="doc-focus-top">
          <div className="doc-focus-top__row">
            <textarea
              ref={focusCategoryRef}
              className="doc-focus-top__category"
              value={focusCategoryLabel}
              placeholder={titlePlaceholder || "Describe Category"}
              rows={1}
              aria-label="Category"
              onChange={(e) => {
                const next = e.target.value;
                onTitleChange?.(next);
                if (isContentMode || isProductMode) onCategoryChange?.(next);
                requestAnimationFrame(syncFocusCategoryHeight);
              }}
            />
            <div className="doc-focus-top__meta">
              {linkedNodeCount > 0 ? (
                <span className="doc-focus-top__nodes" title={t("sidebar.filesInBlock", { count: linkedNodeCount })}>
                  <span className="doc-focus-top__nodes-dot" aria-hidden />
                  {t("sidebar.filesInBlock", { count: linkedNodeCount })}
                </span>
              ) : (
                <span className="doc-focus-top__nodes doc-focus-top__nodes--empty">
                  nodes
                </span>
              )}
              {onCloseExpand ? (
                <button
                  type="button"
                  className="doc-new-head-expand-btn doc-focus-top__close"
                  onClick={onCloseExpand}
                  aria-label="Close"
                >
                  <span className="doc-new-head-close-x" aria-hidden>×</span>
                </button>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

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
          value={displayedTitle}
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
          scheduleStartDate={scheduleStartDate}
          onScheduleStartDateChange={onScheduleStartDateChange}
          scheduleFinishDate={scheduleFinishDate}
          onScheduleFinishDateChange={onScheduleFinishDateChange}
          scheduleStartMin={scheduleStartMin}
          onScheduleDatesClear={onScheduleDatesClear}
          useFolderSchedule={useFolderSchedule}
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
          + (hasManualBoxHeight ? " doc-new-content-box--manual-height" : "")
          + (contentBoxResizing ? " is-resizing" : "")
        }
        style={typographyStyle}
      >
        <div
          ref={contentScrollRef}
          tabIndex={-1}
          className={
            "doc-new-content-scroll"
            + (isKnowledgeMode ? " doc-new-content-scroll--knowledge" : "")
            + (contentFocusMode ? " doc-new-content-scroll--focus" : "")
          }
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
          {showKnowledgeImportHint ? (
            <div className="doc-knowledge-import-hint" role="note">
              <p className="doc-knowledge-import-hint__text">{t("sidebar.knowledgeImportHint")}</p>
              <button
                type="button"
                className="doc-knowledge-import-hint__dismiss"
                onClick={dismissKnowledgeHint}
              >
                {t("sidebar.knowledgeImportHintDismiss")}
              </button>
            </div>
          ) : null}
          {hasBlocks ? (
            <DocBlockStack
              ref={blockStackRef}
              blocks={normalizedBlocks}
              onBlocksChange={onBlocksChange}
              focusBlockId={focusBlockId}
              onFocusBlock={setFocusBlockId}
              bodyPlaceholder={bodyPlaceholder}
              continuationPlaceholder={t("canvas.linkedContinuationPlaceholder")}
              onBodyKeyDown={onBodyKeyDown}
              onOpenNodeForBlock={onOpenNodeForBlock || onOpenNodeForH1}
              onOpenNodeForH1={onOpenNodeForH1}
              onEnsureNodeForBlock={onEnsureNodeForBlock}
              onAnswerBelowH1Change={onAnswerBelowH1Change}
              onBlockAnchorChange={onBlockAnchorChange}
              docCreatedDate={createdDate}
              onInsertProductToCanvas={onInsertProductToCanvas}
              onVideoEmbedSync={onVideoEmbedSync}
              onVideoEmbedH1TitleChange={onVideoEmbedH1TitleChange}
              onDetachFromNode={onDetachFromNode}
              onSavedStepSequenceRemoved={onSavedStepSequenceRemoved}
              companyObjectId={parentId || null}
              reportPresentation={reportPresentation}
              onReportAnimationComplete={onReportAnimationComplete}
              slashCommands={slashCommands}
              slashGhostHints={slashGhostHints}
            />
          ) : (
            <div
              className={
                "doc-body-field-wrap"
                + (isKnowledgeMode ? " doc-body-field-wrap--knowledge" : "")
              }
            >
              <SlashAwareTextarea
                inputRef={bodyRef}
                value={body}
                onChange={(v) => {
                  onBodyChange?.(v);
                }}
                onKeyDown={handleTextareaKeyDown}
                onFocus={() => {
                  if (showKnowledgeImportHint) dismissKnowledgeHint();
                }}
                placeholder={bodyPlaceholder}
                wrapClassName="doc-body-field-wrap__slash"
                className="doc-new-body-field"
                minHeightPx={26}
                maxHeightPx={520}
                ghostHints={slashGhostHints}
              />
            </div>
          )}
        </div>
        {!contentFocusMode ? (
          <button
            type="button"
            className={
              "doc-new-content-shrink-handle doc-new-content-shrink-handle--normal"
              + (contentBoxResizing ? " is-active" : "")
            }
            onPointerDown={handleContentResizePointerDown}
            onDoubleClick={resetContentBoxHeight}
            aria-label="Resize content area"
            title="Drag to resize · double-click to reset"
          />
        ) : null}
        <DocSlashCommandPicker
          commands={slashCommands}
          onSelectCommand={insertSlashCommandFromPicker}
          isCommandEnabled={isSlashCommandEnabled}
          variant="floating"
          nodeLinkColor={metaStripNodeLinkColor}
          onNodeLinkColorChange={isKnowledgeMode ? undefined : handleMetaNodeLinkColorChange}
        />
      </div>

      <div className="doc-new-actions">
        <ContentTextSizeControls
          typographyId={typographyId}
          onTypographyChange={setTypographyId}
        />
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
