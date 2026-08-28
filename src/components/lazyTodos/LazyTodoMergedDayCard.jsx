import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createTodoItem } from "../../lib/docBlocks.js";
import { handleLazyTodoItemKeyDown } from "../../lib/lazyTodoItemKeyDown.js";
import {
  liveDocumentTitleForTodo,
  lazyTodoProgress,
  resolveLazyTodoListTitle,
} from "../../lib/lazyTodos.js";
import { resolveLazyTodoProvenance } from "../../lib/lazyTodoProvenance.js";
import {
  listLinkableDocumentsForShell,
} from "../../lib/lazyTodoShell.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  itemStatusFromChecked,
  macroStatusFromItems,
  TodoStatusIcon,
} from "../docs/blocks/TodoStatusIcon.jsx";
import { LazyTodoFolderChip } from "./LazyTodoFolderChip.jsx";

const COMPLETED_ICON_SRC = "/uploads/CheckSquareOffset.svg";

/**
 * @param {{ text?: string, checked?: boolean }[]} items
 */
function checklistItems(items) {
  return (items || []).filter((row) => String(row?.text ?? "").trim());
}

function allChecklistDone(items) {
  const rows = checklistItems(items);
  return rows.length > 0 && rows.every((row) => Boolean(row.checked));
}

/**
 * Single shell merged view: one reminder | accordion of checklist cards | footer.
 *
 * @param {Object} props
 * @param {string} props.shellLabel
 * @param {string} [props.shellId]
 * @param {string|null} [props.objectId]
 * @param {import("../../lib/lazyTodos.js").LazyTodoItem[]} props.items
 * @param {string|null} [props.initialActiveItemId]
 * @param {(itemId: string, patch: Partial<import("../../lib/lazyTodos.js").LazyTodoItem>) => void} props.onChangeItem
 * @param {(itemId: string) => void} props.onCompletedItem
 * @param {() => void} props.onClose
 * @param {() => void} [props.onSave]
 * @param {(folderId: string) => void} [props.onOpenFolder]
 */
export function LazyTodoMergedDayCard({
  shellLabel,
  shellId = "",
  objectId = null,
  items = [],
  initialActiveItemId = null,
  onChangeItem,
  onCompletedItem,
  onClose,
  onSave,
  onOpenFolder,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const nodesById = useNodesStore((s) => s.nodes);
  const docsById = useDocsStore((s) => s.docs);
  const inputRefs = useRef({});
  const linkPickerRef = useRef(null);
  const confirmOpenRef = useRef(false);
  const suppressAutoCompleteRef = useRef(false);
  const prevAllDoneRef = useRef(false);

  const [activeItemId, setActiveItemId] = useState(() => (
    initialActiveItemId
    && items.some((item) => item.id === initialActiveItemId)
      ? initialActiveItemId
      : (items[0]?.id || null)
  ));
  const [focusItemId, setFocusItemId] = useState(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  // Re-sync only when the day bucket list changes — never override user accordion toggles.
  useEffect(() => {
    if (!items.length) {
      setActiveItemId(null);
      return;
    }
    setActiveItemId((current) => {
      if (current && items.some((item) => item.id === current)) return current;
      if (current === null) return null;
      return items[0]?.id ?? null;
    });
  }, [items]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) || null,
    [items, activeItemId],
  );

  const activeProvenance = useMemo(
    () => resolveLazyTodoProvenance(activeItem, { nodesById, docsById }),
    [activeItem, nodesById, docsById],
  );

  const linkableDocs = useMemo(
    () => listLinkableDocumentsForShell(nodesById, objectId, items, docsById),
    [nodesById, objectId, items, docsById],
  );

  const aggregate = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const item of items) {
      const progress = lazyTodoProgress(item);
      done += progress.done;
      total += progress.total;
    }
    return { done, total };
  }, [items]);

  useEffect(() => {
    if (!focusItemId) return;
    inputRefs.current[focusItemId]?.focus();
  }, [focusItemId, activeItemId, activeItem?.items?.length]);

  useEffect(() => {
    if (!linkPickerOpen) return undefined;
    const onPointerDown = (event) => {
      if (linkPickerRef.current?.contains(event.target)) return;
      setLinkPickerOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [linkPickerOpen]);

  useEffect(() => {
    if (!activeItem) {
      prevAllDoneRef.current = false;
      return;
    }
    const allDone = allChecklistDone(activeItem.items);
    const crossed = allDone && !prevAllDoneRef.current;
    prevAllDoneRef.current = allDone;
    if (!allDone) {
      suppressAutoCompleteRef.current = false;
      return;
    }
    if (!crossed || suppressAutoCompleteRef.current || confirmOpenRef.current) return;
    void handleCompletedClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.items, activeItemId]);

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  const patchActive = (patch) => {
    if (!activeItem?.id) return;
    onChangeItem?.(activeItem.id, patch);
  };

  const handleCompletedClick = async () => {
    if (!activeItem?.id || confirmOpenRef.current) return;
    confirmOpenRef.current = true;
    try {
      const confirmed = await askConfirm({
        title: t("lazyTodos.completedTitle"),
        message: t("lazyTodos.completedConfirm"),
        confirmLabel: t("lazyTodos.completed"),
        cancelLabel: t("common.cancel"),
        tone: "default",
      });
      if (!confirmed) {
        suppressAutoCompleteRef.current = true;
        return;
      }
      suppressAutoCompleteRef.current = false;
      onCompletedItem?.(activeItem.id);
    } finally {
      confirmOpenRef.current = false;
    }
  };

  const toggleSection = (itemId) => {
    setFocusItemId(null);
    setLinkPickerOpen(false);
    setActiveItemId((current) => (current === itemId ? null : itemId));
  };

  const handleSave = () => {
    onSave?.();
    onClose?.();
  };

  const handleLinkDocument = (doc) => {
    if (!activeItem?.id || !doc?.id) return;
    onChangeItem?.(activeItem.id, {
      documentId: doc.id,
      listTitle: doc.title || activeItem.listTitle,
    });
    setLinkPickerOpen(false);
  };

  const showLinkFile = Boolean(
    activeItem
    && !activeProvenance.documentId
    && linkableDocs.length > 0,
  );

  const accordion = (
    <div className="lazy-todo-merged-day-card__accordion scroll-match-bg">
      {items.map((item) => {
        const liveDocTitle = liveDocumentTitleForTodo(item, nodesById);
        const fileTitle = resolveLazyTodoListTitle(item, {
          liveDocTitle,
          fallback: t("lazyTodos.todoLabel"),
        });
        const provenance = resolveLazyTodoProvenance(item, {
          nodesById,
          docsById,
        });
        const { done, total } = lazyTodoProgress(item);
        const expanded = activeItemId === item.id;
        const checklist = item.items?.length ? item.items : [createTodoItem()];
        const macroStatus = macroStatusFromItems(checklist);
        const needsLink = expanded && !provenance.documentId;

        return (
          <div
            key={item.id}
            className={
              "lazy-todo-merged-section"
              + (expanded ? " is-open" : "")
            }
          >
            <div className="lazy-todo-merged-section__row">
              <button
                type="button"
                className="lazy-todo-merged-section__toggle"
                onClick={() => toggleSection(item.id)}
                aria-expanded={expanded}
              >
                <TodoStatusIcon status={macroStatus} />
                <span className="lazy-todo-merged-section__title">
                  {fileTitle}
                </span>
                <span className="lazy-todo-merged-section__meta mono-sm">
                  {done}/{total}
                </span>
                <span
                  className={
                    "doc-todo-plan__chevron"
                    + (expanded ? " is-open" : "")
                  }
                  aria-hidden
                >
                  ›
                </span>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  className="lazy-todo-merged-section__body"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {needsLink ? (
                    <div
                      className="lazy-todo-merged-section__link"
                      ref={linkPickerRef}
                    >
                      <button
                        type="button"
                        className="btn xs ghost lazy-todo-merged-section__link-btn"
                        onClick={(event) => {
                          stopBubble(event);
                          setLinkPickerOpen((open) => !open);
                        }}
                        disabled={!linkableDocs.length}
                        title={t("lazyTodos.linkFileHint")}
                      >
                        {t("lazyTodos.linkFile")}
                      </button>
                      {linkPickerOpen && linkableDocs.length ? (
                        <div
                          className="lazy-todo-merged-section__link-menu scroll-match-bg"
                          role="listbox"
                          aria-label={t("lazyTodos.pickLinkFile")}
                        >
                          <span className="lazy-todo-merged-section__link-hint dim">
                            {t("lazyTodos.pickLinkFile")}
                          </span>
                          {linkableDocs.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              className="lazy-todo-merged-section__link-option"
                              role="option"
                              onClick={(event) => {
                                stopBubble(event);
                                handleLinkDocument(doc);
                              }}
                            >
                              {doc.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="doc-todo-plan__guide" aria-hidden />
                  <ul className="doc-todo-plan__list">
                    {checklist.map((row, index) => (
                      <li key={row.id} className="doc-todo-plan__item">
                        <button
                          type="button"
                          className="doc-todo-plan__status-btn"
                          aria-label={
                            row.checked ? "Mark incomplete" : "Mark complete"
                          }
                          onClick={() => {
                            const nextItems = checklist.map((entry, i) => (
                              i === index
                                ? { ...entry, checked: !entry.checked }
                                : entry
                            ));
                            onChangeItem?.(item.id, { items: nextItems });
                          }}
                        >
                          <TodoStatusIcon
                            status={itemStatusFromChecked(row.checked)}
                            size="sm"
                          />
                        </button>
                        <input
                          ref={(el) => {
                            if (el) inputRefs.current[row.id] = el;
                            else delete inputRefs.current[row.id];
                          }}
                          type="text"
                          className={
                            "doc-todo-plan__item-input"
                            + (row.checked ? " doc-todo-plan__item-input--done" : "")
                          }
                          data-todo-item-id={row.id}
                          value={row.text}
                          placeholder="List item"
                          onChange={(e) => {
                            const nextItems = checklist.map((entry, i) => (
                              i === index
                                ? { ...entry, text: e.target.value }
                                : entry
                            ));
                            onChangeItem?.(item.id, { items: nextItems });
                          }}
                          onKeyDown={(event) => {
                            stopBubble(event);
                            handleLazyTodoItemKeyDown({
                              items: checklist,
                              itemIndex: index,
                              event,
                              onItemsChange: (nextItems) => {
                                onChangeItem?.(item.id, { items: nextItems });
                              },
                              onFocusItemId: setFocusItemId,
                            });
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="doc-todo-plan__new-btn lazy-todo-merged-section__add"
                    onClick={() => {
                      const newItem = createTodoItem({ text: "" });
                      onChangeItem?.(item.id, {
                        items: [...checklist, newItem],
                      });
                      setFocusItemId(newItem.id);
                    }}
                  >
                    + item
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );

  return (
    <article className="lazy-todo-card lazy-todo-card--dashboard lazy-todo-merged-day-card">
      <header className="lazy-todo-card__header">
        <div className="lazy-todo-card__heading">
          <span className="lazy-todo-card__label">
            {t("lazyTodos.shellMergeTitle", { label: shellLabel })}
          </span>
          <span className="lazy-todo-card__counter mono-sm">
            {t("lazyTodos.progress", {
              done: aggregate.done,
              total: aggregate.total,
            })}
          </span>
        </div>
        <div className="lazy-todo-card__header-actions">
          <button
            type="button"
            className="lazy-todo-card__close-x"
            onClick={onClose}
            aria-label={t("lazyTodos.closeTab")}
            title={t("lazyTodos.closeTab")}
          >
            ×
          </button>
        </div>
      </header>

      <div className="lazy-todo-card__body">
        <div className="lazy-todo-card__reminder">
          <label
            className="lazy-todo-card__field-label"
            htmlFor="lazy-merged-reminder"
          >
            {t("lazyTodos.reminderLabel")}
          </label>
          <textarea
            id="lazy-merged-reminder"
            className="lazy-todo-card__reminder-input scroll-match-bg"
            value={activeItem?.reminder || ""}
            placeholder={
              activeItem
                ? t("lazyTodos.reminderPlaceholder")
                : t("lazyTodos.shellMergeEmpty")
            }
            rows={4}
            spellCheck
            disabled={!activeItem}
            onChange={(e) => patchActive({ reminder: e.target.value })}
            onKeyDown={stopBubble}
            onKeyUp={stopBubble}
            onMouseDown={stopBubble}
          />
        </div>

        <div className="lazy-todo-card__todo">
          <span className="lazy-todo-card__field-label">{t("lazyTodos.todoLabel")}</span>
          {accordion}
        </div>
      </div>

      <footer className="lazy-todo-card__footer lazy-todo-merged-day-card__footer">
        <div className="lazy-todo-card__footer-start">
          <button
            type="button"
            className="lazy-todo-card__save-btn"
            onClick={handleSave}
          >
            {t("lazyTodos.save")}
          </button>
          {!showLinkFile && activeItem && activeProvenance.folderId ? (
            <LazyTodoFolderChip
              folderTitle={activeProvenance.folderTitle}
              folderId={activeProvenance.folderId}
              canOpenFolder={activeProvenance.canOpenFolder}
              onOpenFolder={onOpenFolder}
            />
          ) : null}
        </div>

        <button
          type="button"
          className="btn xs lazy-todo-card__complete-btn lazy-todo-card__complete-btn--footer"
          onClick={handleCompletedClick}
          disabled={!activeItem}
        >
          <img
            src={COMPLETED_ICON_SRC}
            alt=""
            className="lazy-todo-card__complete-icon"
            aria-hidden
            draggable={false}
          />
          <span>{t("lazyTodos.completed")}</span>
        </button>
      </footer>
    </article>
  );
}
