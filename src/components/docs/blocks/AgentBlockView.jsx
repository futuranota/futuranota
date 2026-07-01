import { useEffect, useRef } from "react";

function syncInstructionHeight(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
}

/**
 * Macro-node /agent cell — user task instructions for orchestrator routing.
 */
export function AgentBlockView({
  instruction = "",
  onInstructionChange,
  onKeyDown,
  onDelete,
  onDetach,
  deleteLabel = "Eliminar",
  autoFocus = false,
  compact = false,
}) {
  const textareaRef = useRef(null);
  const handleDelete = onDelete || onDetach;

  useEffect(() => {
    if (!autoFocus) return undefined;
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    syncInstructionHeight(textareaRef.current);
  }, [instruction]);

  const handleKeyDown = (e) => {
    onKeyDown?.(e);
    e.stopPropagation();
  };

  return (
    <div
      className={`doc-agent-cell${compact ? " doc-agent-cell--compact" : ""}`}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="doc-agent-cell__header">
        <span className="doc-agent-cell__label">Agent</span>
        {handleDelete ? (
          <div className="doc-agent-cell__hover-actions">
            <button
              type="button"
              className="doc-agent-cell__delete"
              onClick={handleDelete}
              aria-label={deleteLabel}
            >
              {deleteLabel}
            </button>
          </div>
        ) : null}
      </div>
      <div className="doc-agent-cell__card">
        <textarea
          ref={textareaRef}
          className="doc-agent-cell__input"
          value={instruction}
          placeholder="Describe tus instrucciones e.g. 'escríbeme varios titles para…' or 'escríbeme un blog para…'"
          rows={3}
          spellCheck
          onChange={(e) => {
            onInstructionChange?.(e.target.value);
            syncInstructionHeight(e.target);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
