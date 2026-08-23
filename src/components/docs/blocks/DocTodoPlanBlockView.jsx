import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DOC_TODO_HEADER_ICON } from "../../../lib/docMediumAssets.js";
import { DocQueryHandleButton } from "./DocQueryHandleRow.jsx";
import { FolderFileShredHandle } from "../FolderFileShredder.jsx";
import { LinkedNodeDocActions } from "./LinkedNodeDocActions.jsx";
import {
  itemStatusFromChecked,
  macroStatusFromItems,
  TodoStatusIcon,
} from "./TodoStatusIcon.jsx";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

/**
 * Single macro todo block: title + query handle (macro node), animated subtask list inside.
 */
export function DocTodoPlanBlockView({
  listTitle,
  onListTitleChange,
  queryEnabled = false,
  nodeLinkColor = "white",
  linksEnabled = true,
  items,
  focusItemId = null,
  onItemsChange,
  onItemKeyDown,
  onAddItem,
  onDragHandlePointerDown,
  onQueryHandleClick,
  onFocus,
  onListTitleKeyDown,
  onDetachFromNode = null,
  detachFromNodeLabel = "Eliminar del nodo",
  showDragHandle = true,
  listTitleEditable = true,
  titleAddon = null,
  readOnly = false,
  shredNodeId = null,
  onOpenFile = null,
  shredDragEnabled = true,
}) {
  const titleEditable = listTitleEditable && !readOnly;
  const showMoveHandle = showDragHandle && !readOnly;
  const inputRefs = useRef({});
  const [expanded, setExpanded] = useState(true);
  const prefersReducedMotion = usePrefersReducedMotion();
  const macroStatus = macroStatusFromItems(items);
  const doneCount = items.filter((item) => item.checked).length;

  useEffect(() => {
    if (readOnly || !focusItemId) return;
    inputRefs.current[focusItemId]?.focus();
  }, [focusItemId, items.length, readOnly]);

  const updateItem = (index, patch) => {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const toggleItemChecked = (index) => {
    updateItem(index, { checked: !items[index]?.checked });
  };

  const listVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: {
      opacity: 1,
      height: "auto",
      overflow: "visible",
      transition: {
        duration: prefersReducedMotion ? 0.15 : 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.04,
      },
    },
    exit: { opacity: 0, height: 0, overflow: "hidden", transition: { duration: 0.15 } },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -8 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: prefersReducedMotion ? 0.15 : 0.2 },
    },
  };

  return (
    <div className="doc-todo-plan">
      <div className="doc-todo-plan__header">
        {shredNodeId ? (
          <FolderFileShredHandle
            nodeId={shredNodeId}
            onOpen={onOpenFile}
            dragEnabled={shredDragEnabled}
          />
        ) : null}
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
        {showMoveHandle ? (
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
        ) : null}
        {titleEditable ? (
          <input
            type="text"
            className="doc-todo-plan__title-input"
            value={listTitle}
            onChange={(e) => onListTitleChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={(e) => {
              onListTitleKeyDown?.(e);
              if (!e.defaultPrevented) e.stopPropagation();
            }}
            placeholder="Todo list title"
            aria-label="Todo list title (macro node)"
          />
        ) : (
          <span className="doc-todo-plan__title-input doc-todo-plan__title-label">
            {listTitle}
          </span>
        )}
        {titleAddon}
        {readOnly ? null : (
          <button type="button" className="doc-todo-plan__new-btn" onClick={onAddItem}>
            + item
          </button>
        )}
      </div>

      <div className="doc-todo-plan__card">
        <button
          type="button"
          className="doc-todo-plan__macro-row"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <TodoStatusIcon status={macroStatus} />
          <span className="doc-todo-plan__macro-title">{listTitle || "Todo list"}</span>
          <span className="doc-todo-plan__macro-meta">
            {doneCount}/{items.length}
          </span>
          <span className={`doc-todo-plan__chevron${expanded ? " is-open" : ""}`} aria-hidden>
            ›
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              className="doc-todo-plan__list-wrap"
              variants={listVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="doc-todo-plan__guide" aria-hidden />
              <ul className="doc-todo-plan__list">
                {items.map((item, index) => (
                  <motion.li
                    key={item.id}
                    className="doc-todo-plan__item"
                    variants={rowVariants}
                  >
                    <button
                      type="button"
                      className="doc-todo-plan__status-btn"
                      aria-label={item.checked ? "Mark incomplete" : "Mark complete"}
                      onClick={() => {
                        if (readOnly) return;
                        toggleItemChecked(index);
                      }}
                    >
                      <TodoStatusIcon
                        status={itemStatusFromChecked(item.checked)}
                        size="sm"
                      />
                    </button>
                    {readOnly ? (
                      <span
                        className={
                          "doc-todo-plan__item-input"
                          + (item.checked ? " doc-todo-plan__item-input--done" : "")
                        }
                      >
                        {item.text}
                      </span>
                    ) : (
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current[item.id] = el;
                          else delete inputRefs.current[item.id];
                        }}
                        type="text"
                        className={
                          "doc-todo-plan__item-input"
                          + (item.checked ? " doc-todo-plan__item-input--done" : "")
                        }
                        data-todo-item-id={item.id}
                        value={item.text}
                        placeholder="List item"
                        onChange={(e) => updateItem(index, { text: e.target.value })}
                        onKeyDown={(e) => onItemKeyDown?.(index, e)}
                      />
                    )}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {onDetachFromNode ? (
        <LinkedNodeDocActions onDetach={onDetachFromNode} label={detachFromNodeLabel} />
      ) : null}
    </div>
  );
}
