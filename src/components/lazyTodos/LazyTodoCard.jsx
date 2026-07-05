import { useState } from "react";
import { createTodoItem } from "../../lib/docBlocks.js";
import { handleLazyTodoItemKeyDown } from "../../lib/lazyTodoItemKeyDown.js";
import { lazyTodoProgress } from "../../lib/lazyTodos.js";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";

const COMPLETED_ICON_SRC = "/uploads/completed.svg";

/**
 * @param {Object} props
 * @param {import("../../lib/lazyTodos.js").LazyTodoItem & { id: string }} props.item
 * @param {(patch: Partial<import("../../lib/lazyTodos.js").LazyTodoItem>) => void} props.onChange
 * @param {() => void} props.onCompleted
 * @param {() => void} [props.onCloseTab]
 * @param {'dashboard' | 'default'} [props.variant]
 */
export function LazyTodoCard({
  item,
  onChange,
  onCompleted,
  onCloseTab,
  variant = "default",
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const [focusItemId, setFocusItemId] = useState(null);
  const { done, total } = lazyTodoProgress(item);
  const isDashboard = variant === "dashboard";

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  const handleCompletedClick = async () => {
    const confirmed = await askConfirm({
      title: t("lazyTodos.completedTitle"),
      message: t("lazyTodos.completedConfirm"),
      confirmLabel: t("lazyTodos.completed"),
      cancelLabel: t("common.cancel"),
      tone: "default",
    });
    if (!confirmed) return;
    onCompleted?.();
  };

  const completedButton = (
    <button
      type="button"
      className="btn xs lazy-todo-card__complete-btn"
      onClick={handleCompletedClick}
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
  );

  return (
    <article className={`lazy-todo-card${isDashboard ? " lazy-todo-card--dashboard" : ""}`}>
      <header className="lazy-todo-card__header">
        <div className="lazy-todo-card__heading">
          <span className="lazy-todo-card__label">{t("lazyTodos.cardLabel")}</span>
          <span className="lazy-todo-card__counter mono-sm">
            {t("lazyTodos.progress", { done, total })}
          </span>
        </div>
        <div className="lazy-todo-card__header-actions">
          {isDashboard && onCloseTab ? (
            <button
              type="button"
              className="lazy-todo-card__close-x"
              onClick={onCloseTab}
              aria-label={t("lazyTodos.closeTab")}
              title={t("lazyTodos.closeTab")}
            >
              ×
            </button>
          ) : (
            completedButton
          )}
        </div>
      </header>

      <div className="lazy-todo-card__body">
        <div className="lazy-todo-card__reminder">
          <label className="lazy-todo-card__field-label" htmlFor={`lazy-reminder-${item.id}`}>
            {t("lazyTodos.reminderLabel")}
          </label>
          <textarea
            id={`lazy-reminder-${item.id}`}
            className="lazy-todo-card__reminder-input scroll-match-bg"
            value={item.reminder || ""}
            placeholder={t("lazyTodos.reminderPlaceholder")}
            rows={isDashboard ? 4 : 3}
            spellCheck
            onChange={(e) => onChange({ reminder: e.target.value })}
            onKeyDown={stopBubble}
            onKeyUp={stopBubble}
            onMouseDown={stopBubble}
          />
        </div>

        <div className="lazy-todo-card__todo">
          <span className="lazy-todo-card__field-label">{t("lazyTodos.todoLabel")}</span>
          <div className="lazy-todo-card__todo-block scroll-match-bg">
            <DocTodoPlanBlockView
              listTitle={t("lazyTodos.todoLabel")}
              listTitleEditable={false}
              linksEnabled={false}
              showDragHandle={false}
              items={item.items || [createTodoItem()]}
              focusItemId={focusItemId}
              onItemsChange={(items) => onChange({ items })}
              onItemKeyDown={(itemIndex, event) => {
                stopBubble(event);
                handleLazyTodoItemKeyDown({
                  items: item.items || [],
                  itemIndex,
                  event,
                  onItemsChange: (items) => onChange({ items }),
                  onFocusItemId: setFocusItemId,
                });
              }}
              onAddItem={() => {
                const newItem = createTodoItem({ text: "" });
                onChange({ items: [...(item.items || []), newItem] });
                setFocusItemId(newItem.id);
              }}
            />
          </div>
        </div>
      </div>

      {isDashboard ? (
        <footer className="lazy-todo-card__footer">
          <button
            type="button"
            className="btn xs lazy-todo-card__complete-btn lazy-todo-card__complete-btn--footer"
            onClick={handleCompletedClick}
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
      ) : null}
    </article>
  );
}
