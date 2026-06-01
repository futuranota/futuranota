import { useEffect, useRef } from "react";
import { DOC_TODO_HEADER_ICON } from "../../../lib/docMediumAssets.js";
import { BlockAnchorFields } from "./BlockAnchorFields.jsx";
import { DocQueryHandleButton } from "./DocQueryHandleRow.jsx";

export function TodoBlockView({
  listTitle,
  onListTitleChange,
  queryEnabled = false,
  nodeLinkColor = "dark",
  linksEnabled = true,
  anchorFromNode = false,
  anchorDate = "",
  anchorTime = "",
  items,
  focusItemId = null,
  onItemsChange,
  onItemKeyDown,
  onAddItem,
  onDragHandlePointerDown,
  onQueryHandleClick,
  onFocus,
  onListTitleKeyDown,
  contentExpanded = true,
  onContentToggle,
}) {
  const inputRefs = useRef({});
  const showSchedule = linksEnabled && queryEnabled && anchorFromNode;

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
        {linksEnabled ? (
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
          onFocus={onFocus}
          onKeyDown={(e) => {
            onListTitleKeyDown?.(e);
            if (!e.defaultPrevented) e.stopPropagation();
          }}
          aria-label="Checkbox list title"
        />
        <button
          type="button"
          className="doc-todo-block__new-btn"
          onClick={onAddItem}
        >
          + new
        </button>
      </div>

      {showSchedule ? (
        <BlockAnchorFields
          readOnly
          showContentToggle={Boolean(onContentToggle)}
          contentExpanded={contentExpanded}
          onContentToggle={onContentToggle}
          anchorDate={anchorDate}
          anchorTime={anchorTime}
          className="doc-todo-block__anchor"
        />
      ) : null}

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
              data-todo-item-id={item.id}
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
