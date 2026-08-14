import { useCallback, useEffect, useMemo, useState } from "react";
import { useLazyTodosStore } from "../../stores/lazyTodosStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import {
  filterLazyTodos,
  lazyTodoDisplayTitle,
  liveDocumentTitleForTodo,
  sortLazyTodosNewestFirst,
} from "../../lib/lazyTodos.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useNodesStore } from "../../stores/nodesStore.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(item: import("../../lib/lazyTodos.js").LazyTodoItem) => void} props.onOpenItem
 * @param {() => void} props.onNew
 */
export function LazyTodoQueuePanel({
  objectId = null,
  onClose,
  onOpenItem,
  onNew,
}) {
  const { t } = useI18n();
  const items = useLazyTodosStore((s) => s.items);
  const nodesById = useNodesStore((s) => s.nodes);
  const removeItem = useLazyTodosStore((s) => s.removeItem);
  const requeueOrphanedActives = useLazyTodosStore((s) => s.requeueOrphanedActives);
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    requeueOrphanedActives?.();
  }, [requeueOrphanedActives]);

  const queuedItems = useMemo(() => {
    const scoped = items.filter((item) => (
      item.status === "queued"
      && (objectId ? item.objectId === objectId : !item.objectId)
    ));
    return sortLazyTodosNewestFirst(filterLazyTodos(scoped, query, { nodesById }));
  }, [items, objectId, query, nodesById]);

  const exitBulkSelectMode = useCallback(() => {
    setBulkSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectMode((active) => {
      if (active) {
        setSelectedIds([]);
        return false;
      }
      setSelectedIds([]);
      return true;
    });
  }, []);

  const toggleSelect = useCallback((id) => {
    if (!id) return;
    setSelectedIds((prev) => (
      prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
    ));
  }, []);

  const handleDeleteSelected = async () => {
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) return;
    const confirmed = await askConfirm({
      title: t("lazyTodos.deleteSelectedTitle"),
      message: t("lazyTodos.deleteSelectedConfirm", { count: ids.length }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    for (const id of ids) {
      removeItem(id);
    }
    exitBulkSelectMode();
  };

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="lp-pack-import-detail lazy-todo-queue-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head lazy-todo-queue-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={onClose}
            aria-label={`Back — ${t("pack.lazyTodosQueueTitle")}`}
            title={`Back — ${t("pack.lazyTodosQueueTitle")}`}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
            <span className="lp-click-folder-back-label is-lowercase">
              {t("pack.lazyTodosQueueTitle")}
            </span>
          </button>
          {objectId ? (
            <button
              type="button"
              className={
                "lp-folder-density__btn lp-folder-select-btn"
                + (bulkSelectMode ? " is-active" : "")
              }
              onClick={toggleBulkSelectMode}
              title={
                bulkSelectMode
                  ? t("lazyTodos.selectActive")
                  : t("lazyTodos.selectTitle")
              }
              aria-label={t("lazyTodos.selectTitle")}
              aria-pressed={bulkSelectMode}
            >
              {t("lazyTodos.select")}
            </button>
          ) : null}
        </div>

        <div className="pack-wizard__body lazy-todo-queue-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("lazyTodos.enterCompanyFirst")}</p>
          ) : (
            <>
              <div className="lp-library-toolbar">
                <div className="lp-library-search-wrap">
                  <span className="lp-library-search-icon" aria-hidden />
                  <input
                    type="search"
                    className="lp-library-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("lazyTodos.searchPlaceholder")}
                    aria-label={t("lazyTodos.searchPlaceholder")}
                    onKeyDown={stopBubble}
                    onKeyUp={stopBubble}
                    onMouseDown={stopBubble}
                  />
                </div>
                <button
                  type="button"
                  className="lp-library-new-btn"
                  onClick={onNew}
                  disabled={bulkSelectMode}
                >
                  {t("lazyTodos.new")}
                </button>
              </div>

              {bulkSelectMode ? (
                <div className="lp-folder-bulk-bar" role="status">
                  <span className="lp-folder-bulk-bar__count">
                    {t("lazyTodos.selectCount", { count: selectedIds.length })}
                  </span>
                  <div className="lp-folder-bulk-bar__actions">
                    <button
                      type="button"
                      className="btn xs ghost"
                      onClick={exitBulkSelectMode}
                    >
                      {t("lazyTodos.selectDone")}
                    </button>
                    <button
                      type="button"
                      className="btn xs lp-folder-bulk-bar__delete"
                      disabled={selectedIds.length === 0}
                      onClick={handleDeleteSelected}
                    >
                      {t("lazyTodos.deleteSelected")}
                    </button>
                  </div>
                </div>
              ) : null}

              {queuedItems.length ? (
                <ul
                  className={
                    "lazy-todo-queue-panel__list"
                    + (bulkSelectMode ? " lazy-todo-queue-panel__list--selecting" : "")
                  }
                >
                  {queuedItems.map((item) => {
                    const selected = selectedIds.includes(item.id);
                    return (
                      <li
                        key={item.id}
                        className={
                          "lazy-todo-queue-panel__row"
                          + (bulkSelectMode ? " lazy-todo-queue-panel__row--select-mode" : "")
                          + (selected ? " is-selected" : "")
                        }
                      >
                        {bulkSelectMode ? (
                          <button
                            type="button"
                            className={
                              "lazy-todo-queue-panel__card lazy-todo-queue-panel__card--select"
                              + (selected ? " is-selected" : "")
                            }
                            onClick={() => toggleSelect(item.id)}
                            aria-pressed={selected}
                          >
                            <span
                              className={
                                "lp-doc-nodes-block__check"
                                + (selected ? " is-checked" : "")
                              }
                              aria-hidden
                            />
                            <img
                              src="/uploads/to-do.svg"
                              alt=""
                              aria-hidden
                              className="lazy-todo-queue-panel__card-icon"
                            />
                            <span className="lazy-todo-queue-panel__card-body">
                              <span className="lazy-todo-queue-panel__card-title">
                                {lazyTodoDisplayTitle(item, {
                                  liveDocTitle: liveDocumentTitleForTodo(item, nodesById),
                                })}
                              </span>
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="lazy-todo-queue-panel__card"
                            onClick={() => onOpenItem?.(item)}
                          >
                            <img
                              src="/uploads/to-do.svg"
                              alt=""
                              aria-hidden
                              className="lazy-todo-queue-panel__card-icon"
                            />
                            <span className="lazy-todo-queue-panel__card-body">
                              <span className="lazy-todo-queue-panel__card-title">
                                {lazyTodoDisplayTitle(item, {
                                  liveDocTitle: liveDocumentTitleForTodo(item, nodesById),
                                })}
                              </span>
                            </span>
                            <span className="lazy-todo-queue-panel__card-chevron" aria-hidden>
                              ›
                            </span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="lp-empty lazy-todo-queue-panel__empty">
                  <p>
                    {query.trim()
                      ? t("lazyTodos.queueNoMatch")
                      : t("lazyTodos.queueEmptyTitle")}
                  </p>
                  <p className="dim">
                    {query.trim()
                      ? t("lazyTodos.queueNoMatchHint")
                      : t("lazyTodos.queueEmptyHint")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
