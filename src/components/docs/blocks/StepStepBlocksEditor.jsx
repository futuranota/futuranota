import { useCallback, useMemo } from "react";
import {
  createDocBlockFromSlash,
  getSlashTail,
  parseSlashQuery,
  splitBodyForSlash,
  STEP_SLASH_COMMANDS,
} from "../../../lib/docBlockSlash.js";
import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  ensureEmptyTextBlockAfter,
  insertBlockAfter,
  normalizeStepBlocks,
  removeBlockAt,
  replaceBlocksFromSlashInText,
  stepEntryHasContent,
  updateBlockAt,
} from "../../../lib/docBlocks.js";
import { CodeBlockView } from "./CodeBlockView.jsx";
import { DocSlashCommandPicker } from "./DocSlashCommandPicker.jsx";
import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";

function isStepSlashAllowed(parsed) {
  return STEP_SLASH_COMMANDS.some((cmd) => cmd.blockType === parsed?.type);
}

function appendSlashBlock(blocks, parsed) {
  const newBlock = createDocBlockFromSlash(parsed);
  let next = normalizeStepBlocks(blocks);
  const lastIndex = next.length - 1;
  const last = next[lastIndex];

  if (last?.type === DOC_BLOCK_TYPES.TEXT && !(last.text || "").trim()) {
    next = [...next.slice(0, lastIndex), newBlock];
    return ensureEmptyTextBlockAfter(next, lastIndex);
  }

  if (last?.type === DOC_BLOCK_TYPES.TEXT) {
    next = insertBlockAfter(next, lastIndex, newBlock);
    return ensureEmptyTextBlockAfter(next, lastIndex + 1);
  }

  next = [...next, newBlock];
  return ensureEmptyTextBlockAfter(next, next.length - 1);
}

function renderCodeBlock({
  block,
  index,
  safeBlocks,
  compact,
  interactive,
  updateAt,
  setBlocks,
}) {
  const hasCode = Boolean((block.code || "").trim());
  const showSaved = Boolean(block.codeSaved && hasCode);

  return (
    <div
      key={block.id}
      className={`doc-step-sequence__step-code${showSaved ? " doc-step-sequence__step-code--saved" : ""}`}
    >
      <CodeBlockView
        compact
        language={block.language}
        code={block.code || ""}
        codeSaved={interactive ? showSaved : (showSaved || hasCode)}
        onLanguageChange={interactive ? (language) => updateAt(index, { language, codeSaved: false }) : undefined}
        onCodeChange={interactive ? (code) => updateAt(index, { code, codeSaved: false }) : undefined}
        onSave={interactive ? () => {
          if (!hasCode) return;
          let next = updateBlockAt(safeBlocks, index, { codeSaved: true });
          next = ensureEmptyTextBlockAfter(next, index);
          setBlocks(next);
        } : undefined}
        onEdit={interactive ? () => updateAt(index, { codeSaved: false }) : undefined}
        onDelete={interactive ? () => {
          if (!window.confirm("¿Eliminar este bloque de código?")) return;
          let next = removeBlockAt(safeBlocks, index);
          if (!next.length) {
            next = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
          }
          setBlocks(next);
        } : undefined}
      />
    </div>
  );
}

/**
 * Mini block stack for one step-by-step instruction — same CODE blocks as documents.
 */
export function StepStepBlocksEditor({
  blocks = [],
  onBlocksChange,
  readOnly = false,
  compact = false,
  autoFocus = false,
  stepId = "step",
  onOuterKeyDown,
}) {
  const safeBlocks = useMemo(() => normalizeStepBlocks(blocks), [blocks]);
  const interactive = Boolean(onBlocksChange);

  const setBlocks = useCallback((nextBlocks) => {
    onBlocksChange?.(normalizeStepBlocks(nextBlocks));
  }, [onBlocksChange]);

  const updateAt = useCallback((index, patch) => {
    setBlocks(updateBlockAt(safeBlocks, index, patch));
  }, [safeBlocks, setBlocks]);

  const insertSlashCommand = useCallback((alias) => {
    const parsed = parseSlashQuery(alias);
    if (!parsed || !isStepSlashAllowed(parsed)) return;
    setBlocks(appendSlashBlock(safeBlocks, parsed));
  }, [safeBlocks, setBlocks]);

  const confirmSlashInTextBlock = useCallback((blockIndex, textValue) => {
    const slashTail = getSlashTail(textValue);
    if (!slashTail) return false;
    const parsed = parseSlashQuery(slashTail.slice(1));
    if (!parsed || !isStepSlashAllowed(parsed)) return false;

    const newBlock = createDocBlockFromSlash(parsed);
    let next = replaceBlocksFromSlashInText(safeBlocks, blockIndex, textValue, newBlock);
    const newIndex = next.findIndex((block) => block.id === newBlock.id);
    if (newIndex >= 0) {
      next = ensureEmptyTextBlockAfter(next, newIndex);
    }
    setBlocks(next);
    return true;
  }, [safeBlocks, setBlocks]);

  const handleTextKeyDown = useCallback((blockIndex, textValue, event) => {
    if (event.key === "Enter" && !event.shiftKey && getSlashTail(textValue)) {
      if (confirmSlashInTextBlock(blockIndex, textValue)) {
        event.preventDefault();
        return;
      }
    }
    if (event.key === "Escape" && getSlashTail(textValue)) {
      const { prefix } = splitBodyForSlash(textValue);
      event.preventDefault();
      updateAt(blockIndex, { text: prefix });
      return;
    }
    onOuterKeyDown?.(event);
  }, [confirmSlashInTextBlock, onOuterKeyDown, updateAt]);

  if (readOnly && !stepEntryHasContent({ blocks: safeBlocks })) {
    return <div className="doc-step-sequence__saved-text">—</div>;
  }

  const blockNodes = safeBlocks.map((block, index) => {
    if (block.type === DOC_BLOCK_TYPES.TEXT) {
      if (readOnly) {
        if (!(block.text || "").trim()) return null;
        return (
          <div key={block.id} className="doc-step-sequence__saved-text">
            {block.text}
          </div>
        );
      }

      return (
        <div key={block.id} className="doc-step-sequence__step-text-block">
          <SlashAwareTextarea
            value={block.text || ""}
            onChange={(text) => updateAt(index, { text })}
            onKeyDown={(event) => handleTextKeyDown(index, block.text || "", event)}
            onKeyUp={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            placeholder={index === 0 ? "Paste or write instructions for this step…" : "Continue writing…"}
            className="doc-step-sequence__input doc-step-sequence__input--slash"
            wrapClassName="doc-step-sequence__slash-wrap"
            autoFocus={autoFocus && index === 0}
            minHeightPx={compact ? 72 : 96}
            maxHeightPx={compact ? 180 : 240}
            ariaLabel={`Step ${stepId} instructions`}
          />
        </div>
      );
    }

    if (block.type === DOC_BLOCK_TYPES.CODE) {
      const hasCode = Boolean((block.code || "").trim());
      if (readOnly && !hasCode && !block.codeSaved) return null;
      return renderCodeBlock({
        block,
        index,
        safeBlocks,
        compact,
        interactive,
        updateAt,
        setBlocks,
      });
    }

    return null;
  }).filter(Boolean);

  if (!blockNodes.length && readOnly) {
    return <div className="doc-step-sequence__saved-text">—</div>;
  }

  if (readOnly) {
    return <div className="doc-step-sequence__saved-body">{blockNodes}</div>;
  }

  return (
    <div className={`doc-step-sequence__step-content${compact ? " doc-step-sequence__step-content--compact" : ""}`}>
      <div className="doc-step-sequence__step-content-scroll scroll-match-bg">
        {blockNodes}
      </div>
      <DocSlashCommandPicker
        variant="pad"
        commands={STEP_SLASH_COMMANDS}
        onSelectCommand={insertSlashCommand}
      />
    </div>
  );
}
