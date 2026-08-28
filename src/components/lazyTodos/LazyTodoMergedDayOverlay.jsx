import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { LazyTodoMergedDayCard } from "./LazyTodoMergedDayCard.jsx";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {Object} props
 * @param {{
 *   shellId: string,
 *   shellLabel?: string,
 *   items: import("../../lib/lazyTodos.js").LazyTodoItem[],
 *   initialActiveItemId?: string|null,
 * } | null} props.session
 * @param {(itemId: string, patch: Partial<import("../../lib/lazyTodos.js").LazyTodoItem>) => void} props.onChangeItem
 * @param {(itemId: string) => void} props.onCompletedItem
 * @param {() => void} props.onClose
 * @param {(folderId: string) => void} [props.onOpenFolder]
 */
export function LazyTodoMergedDayOverlay({
  session,
  onChangeItem,
  onCompletedItem,
  onClose,
  onOpenFolder,
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const shellLabel = useMemo(() => {
    const label = String(session?.shellLabel || "").trim();
    return label || t("lazyTodos.todoLabel");
  }, [session?.shellLabel, t]);

  if (!session?.items?.length) return null;

  const objectId = session.items.find((item) => item?.objectId)?.objectId || null;

  return createPortal(
    <div
      className="lazy-todo-dashboard-overlay lazy-todo-merged-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("lazyTodos.shellMergeTitle", { label: shellLabel })}
    >
      <button
        type="button"
        className="lazy-todo-dashboard-overlay__backdrop"
        aria-label={t("lazyTodos.closeTab")}
        onClick={onClose}
      />
      <div className="lazy-todo-dashboard-overlay__card lazy-todo-merged-overlay__card">
        <LazyTodoMergedDayCard
          shellLabel={shellLabel}
          shellId={session.shellId}
          objectId={objectId}
          items={session.items}
          initialActiveItemId={session.initialActiveItemId || null}
          onChangeItem={onChangeItem}
          onCompletedItem={onCompletedItem}
          onClose={onClose}
          onSave={onClose}
          onOpenFolder={onOpenFolder}
        />
      </div>
    </div>,
    document.body,
  );
}
