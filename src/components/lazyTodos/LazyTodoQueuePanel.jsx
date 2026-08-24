import { useCallback, useEffect, useMemo, useState } from "react";
import { useLazyTodosStore } from "../../stores/lazyTodosStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { filterLazyTodos } from "../../lib/lazyTodos.js";
import {
  LAZY_TODO_UNSCHEDULED_DAY_KEY,
  groupLazyTodosByScheduleDay,
} from "../../lib/lazyTodoProvenance.js";
import { todayDateInputValue } from "../../lib/docDates.js";
import { useI18n } from "../../i18n/useI18n.js";
import { useNodesStore } from "../../stores/nodesStore.js";

/**
 * Queue: one stacked card per schedule day. Click opens the merged day shell
 * (all file to-dos inside). No per-file rows outside.
 *
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(item: import("../../lib/lazyTodos.js").LazyTodoItem) => void} [props.onOpenItem]
 * @param {(payload: { dayKey: string, items: import("../../lib/lazyTodos.js").LazyTodoItem[] }) => void} [props.onOpenDayMerge]
 * @param {() => void} props.onNew
 */
export function LazyTodoQueuePanel({
  objectId = null,
  onClose,
  onOpenItem: _onOpenItem,
  onOpenDayMerge,
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
  const [selectedDayKeys, setSelectedDayKeys] = useState([]);

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

  const dayGroups = useMemo(
    () => groupLazyTodosByScheduleDay(queuedItems, {
      nodesById,
      today: todayDateInputValue(),
      requireContent: false,
    }),
    [queuedItems, nodesById],
  );

  const dayLabelFor = useCallback((group) => {
    if (group.kind === "today") return t("lazyTodos.dayToday");
    if (group.kind === "tomorrow") return t("lazyTodos.dayTomorrow");
    if (group.kind === "past") {
      return `${t("lazyTodos.dayPast")}${group.display ? ` · ${group.display}` : ""}`;
    }
    if (group.kind === "unscheduled" || group.dayKey === LAZY_TODO_UNSCHEDULED_DAY_KEY) {
      return t("lazyTodos.dayUnscheduled");
    }
    return group.display || group.dayKey;
  }, [t]);

  const exitBulkSelectMode = useCallback(() => {
    setBulkSelectMode(false);
    setSelectedDayKeys([]);
  }, []);

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectMode((active) => {
      if (active) {
        setSelectedDayKeys([]);
        return false;
      }
      setSelectedDayKeys([]);
      return true;
    });
  }, []);

  const toggleSelectDay = useCallback((dayKey) => {
    if (!dayKey) return;
    setSelectedDayKeys((prev) => (
      prev.includes(dayKey)
        ? prev.filter((entry) => entry !== dayKey)
        : [...prev, dayKey]
    ));
  }, []);

  const handleDeleteSelected = async () => {
    const groups = dayGroups.filter((group) => selectedDayKeys.includes(group.dayKey));
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

  const openDay = useCallback((group) => {
    if (!group?.items?.length) return;
    if (onOpenDayMerge) {
      onOpenDayMerge({ dayKey: group.dayKey, items: group.items });
      return;
    }
    // Fallback: open first item if merge handler missing
    _onOpenItem?.(group.items[0]);
  }, [onOpenDayMerge, _onOpenItem]);

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
                    {t("lazyTodos.selectCount", { count: selectedDayKeys.length })}
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
                      disabled={selectedDayKeys.length === 0}
                      onClick={handleDeleteSelected}
                    >
                      {t("lazyTodos.deleteSelected")}
                    </button>
                  </div>
                </div>
              ) : null}

              {dayGroups.length ? (
                <ul
                  className={
                    "lazy-todo-queue-panel__list"
                    + (bulkSelectMode ? " lazy-todo-queue-panel__list--selecting" : "")
                  }
                >
                  {dayGroups.map((group) => {
                    const label = dayLabelFor(group);
                    const selected = selectedDayKeys.includes(group.dayKey);
                    return (
                      <li
                        key={group.dayKey}
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
                            onClick={() => toggleSelectDay(group.dayKey)}
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
                                {t("lazyTodos.dayMergeCount", { count: group.items.length })}
                              </span>
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="lazy-todo-queue-panel__card"
                            onClick={() => openDay(group)}
                            aria-label={t("lazyTodos.daySectionAria", { label })}
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
                                {t("lazyTodos.dayMergeCount", { count: group.items.length })}
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
