import { useMemo, useState } from "react";
import { useLazyTodosStore } from "../../stores/lazyTodosStore.js";
import {
  filterLazyTodos,
  lazyTodoDisplayTitle,
  lazyTodoPreview,
  lazyTodoProgress,
  sortLazyTodosNewestFirst,
} from "../../lib/lazyTodos.js";
import { useI18n } from "../../i18n/useI18n.js";

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
  const [query, setQuery] = useState("");

  const queuedItems = useMemo(() => {
    const scoped = items.filter((item) => (
      item.status === "queued"
      && (objectId ? item.objectId === objectId : !item.objectId)
    ));
    return sortLazyTodosNewestFirst(filterLazyTodos(scoped, query));
  }, [items, objectId, query]);

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
            aria-label={t("common.back")}
            title={t("common.back")}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
          </button>
          <h3 className="pack-wizard__title lazy-todo-queue-panel__title">
            {t("pack.lazyTodosQueueTitle")}
          </h3>
        </div>

        <div className="pack-wizard__body lazy-todo-queue-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("lazyTodos.enterCompanyFirst")}</p>
          ) : (
            <>
              <div className="lazy-todo-queue-panel__toolbar">
                <input
                  type="search"
                  className="lazy-todo-queue-panel__search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("lazyTodos.searchPlaceholder")}
                  aria-label={t("lazyTodos.searchPlaceholder")}
                  onKeyDown={stopBubble}
                  onKeyUp={stopBubble}
                  onMouseDown={stopBubble}
                />
                <button
                  type="button"
                  className="btn xs workspace-action-btn lazy-todo-queue-panel__new-btn"
                  onClick={onNew}
                >
                  {t("lazyTodos.new")}
                </button>
              </div>

              {queuedItems.length ? (
                <ul className="lazy-todo-queue-panel__list">
                  {queuedItems.map((item) => {
                    const { done, total } = lazyTodoProgress(item);
                    return (
                      <li key={item.id} className="lazy-todo-queue-panel__item">
                        <div className="lazy-todo-queue-panel__item-main">
                          <div className="lazy-todo-queue-panel__item-head">
                            <span className="lazy-todo-queue-panel__item-title">
                              {lazyTodoDisplayTitle(item)}
                            </span>
                            <span className="lazy-todo-queue-panel__item-meta mono-sm">
                              {t("lazyTodos.progress", { done, total })}
                            </span>
                          </div>
                          {lazyTodoPreview(item) ? (
                            <p className="lazy-todo-queue-panel__item-preview">
                              {lazyTodoPreview(item)}
                            </p>
                          ) : null}
                        </div>
                        <div className="lazy-todo-queue-panel__item-actions">
                          <button
                            type="button"
                            className="btn xs pack-actions__btn pack-actions__btn--toolbar panel-list-open-btn"
                            onClick={() => onOpenItem?.(item)}
                          >
                            {t("common.open")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="lp-empty lazy-todo-queue-panel__empty">
                  <p>{t("lazyTodos.queueEmptyTitle")}</p>
                  <p className="dim">{t("lazyTodos.queueEmptyHint")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
