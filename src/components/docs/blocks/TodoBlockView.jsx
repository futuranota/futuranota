import { useEffect, useRef } from "react";
import { DOC_TODO_HEADER_ICON } from "../../../lib/docMediumAssets.js";

export function TodoBlockView({
  listTitle,
  onListTitleChange,
  items,
  focusItemId = null,
  onItemsChange,
  onItemKeyDown,
  onAddItem,
  onDragHandlePointerDown,
}) {
  const inputRefs = useRef({});

  useEffect(() => {
    if (!focusItemId) return;
    inputRefs.current[focusItemId]?.focus();
  }, [focusItemId, items.length]);

  const updateItem = (index, patch) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onItemsChange(next);
  };

  return (
    <div className="doc-todo-block">
      <div className="doc-todo-block__header">
        <button
          type="button"
          className="doc-block-drag-handle"
          aria-label="Mover bloque"
          title="Mover bloque"
          draggable
          onPointerDown={onDragHandlePointerDown}
        >
          <img src={DOC_TODO_HEADER_ICON} alt="" aria-hidden />
        </button>
        <input
          type="text"
          className="doc-todo-block__title-input"
          value={listTitle}
          onChange={(e) => onListTitleChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Título de la lista"
        />
        <button
          type="button"
          className="doc-todo-block__new-btn"
          onClick={onAddItem}
        >
          + new
        </button>
      </div>

      <div className="doc-todo-block__rows">
        {items.map((item, index) => (
          <div className="doc-todo-block__row" key={item.id}>
            <button
              type="button"
              className={`doc-todo-block__checkbox${item.checked ? " is-checked" : ""}`}
              aria-label={item.checked ? "Mark incomplete" : "Mark complete"}
              onClick={() => updateItem(index, { checked: !item.checked })}
            >
              <span className="doc-todo-block__checkbox-circle" aria-hidden />
            </button>
            <input
              ref={(el) => {
                if (el) inputRefs.current[item.id] = el;
                else delete inputRefs.current[item.id];
              }}
              type="text"
              className="doc-todo-block__input"
              value={item.text}
              onChange={(e) => updateItem(index, { text: e.target.value })}
              onKeyDown={(e) => onItemKeyDown?.(index, e)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
