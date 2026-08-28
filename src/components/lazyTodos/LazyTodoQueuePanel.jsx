import { useCallback, useEffect, useMemo, useState } from "react";
import { useLazyTodosStore } from "../../stores/lazyTodosStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { filterLazyTodos } from "../../lib/lazyTodos.js";
import { groupLazyTodosByShell } from "../../lib/lazyTodoShell.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useNodesStore } from "../../stores/nodesStore.js";

/**
 * Queue: one stacked card per shell. Click opens the merged shell
 * (all checklist cards inside). No schedule-date grouping.
 *
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(item: import("../../lib/lazyTodos.js").LazyTodoItem) => void} [props.onOpenItem]
 * @param {(payload: {
 *   shellId: string,
 *   shellLabel: string,
 *   items: import("../../lib/lazyTodos.js").LazyTodoItem[],
 * }) => void} [props.onOpenShellMerge]
 * @param {() => void} props.onNew
 */
export function LazyTodoQueuePanel({
  objectId = null,
  onClose,
  onOpenItem: _onOpenItem,
  onOpenShellMerge,
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
  const [selectedShellIds, setSelectedShellIds] = useState([]);

  useEffect(() => {
    requeueOrphanedActives?.();
  }, [requeueOrphanedActives]);

  const queuedItems = useMemo(() => {
    const scoped = items.filter((item) => (
      item.status === "queued"
      && (objectId ? item.objectId === objectId : !item.objectId)
    ));
    return filterLazyTodos(scoped, query, { nodesById });
  }, [items, objectId, query, nodesById]);

  const shellGroups = useMemo(
    () => groupLazyTodosByShell(queuedItems, {
      nodesById,
      requireContent: false,
    }),
    [queuedItems, nodesById],
  );

  const exitBulkSelectMode = useCallback(() => {
    setBulkSelectMode(false);
    setSelectedShellIds([]);
  }, []);

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectMode((active) => {
      if (active) {
        setSelectedShellIds([]);
        return false;
      }
      setSelectedShellIds([]);
      return true;
    });
  }, []);

  const toggleSelectShell = useCallback((shellId) => {
    if (!shellId) return;
    setSelectedShellIds((prev) => (
      prev.includes(shellId)
        ? prev.filter((entry) => entry !== shellId)
        : [...prev, shellId]
    ));
  }, []);

  const handleDeleteSelected = async () => {
    const groups = shellGroups.filter((group) => selectedShellIds.includes(group.shellId));
    const ids = groups.flatMap((group) => group.items.map((item) => item.id).filter(Boolean));
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

  const openShell = useCallback((group) => {
    if (!group?.items?.length) return;
    if (onOpenShellMerge) {
      onOpenShellMerge({
        shellId: group.shellId,
        shellLabel: group.title,
        items: group.items,
        initialActiveItemId: group.items[0]?.id || null,
      });
      return;
    }
    _onOpenItem?.(group.items[0]);
  }, [onOpenShellMerge, _onOpenItem]);

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
                    {t("lazyTodos.selectCount", { count: selectedShellIds.length })}
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
                      disabled={selectedShellIds.length === 0}
                      onClick={handleDeleteSelected}
                    >
                      {t("lazyTodos.deleteSelected")}
                    </button>
                  </div>
                </div>
              ) : null}

              {shellGroups.length ? (
                <ul
                  className={
                    "lazy-todo-queue-panel__list"
                    + (bulkSelectMode ? " lazy-todo-queue-panel__list--selecting" : "")
                  }
                >
                  {shellGroups.map((group) => {
                    const label = group.title || t("lazyTodos.todoLabel");
                    const selected = selectedShellIds.includes(group.shellId);
                    return (
                      <li
                        key={group.shellId}
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
                            onClick={() => toggleSelectShell(group.shellId)}
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
                                {label}
                              </span>
                              <span className="lazy-todo-queue-panel__card-sub dim">
                                {t("lazyTodos.shellMergeCount", { count: group.items.length })}
                              </span>
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="lazy-todo-queue-panel__card"
                            onClick={() => openShell(group)}
                            aria-label={t("lazyTodos.shellSectionAria", { label })}
                          >
                            <img
                              src="/uploads/to-do.svg"
                              alt=""
                              aria-hidden
                              className="lazy-todo-queue-panel__card-icon"
                            />
                            <span className="lazy-todo-queue-panel__card-body">
                              <span className="lazy-todo-queue-panel__card-title">
                                {label}
                              </span>
                              <span className="lazy-todo-queue-panel__card-sub dim">
                                {t("lazyTodos.shellMergeCount", { count: group.items.length })}
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
