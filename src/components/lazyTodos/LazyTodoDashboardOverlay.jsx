import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LazyTodoCard } from "./LazyTodoCard.jsx";
import { cloneLazyTodo } from "../../lib/lazyTodos.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {Object} props
 * @param {import("../../lib/lazyTodos.js").LazyTodoItem | null} props.session
 * @param {(patch: Partial<import("../../lib/lazyTodos.js").LazyTodoItem>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {() => void} props.onCompleted
 * @param {() => void} [props.onSave]
 * @param {(documentId: string) => void} [props.onOpenDocument]
 * @param {(folderId: string) => void} [props.onOpenFolder]
 */
export function LazyTodoDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onCompleted,
  onSave,
  onOpenDocument,
  onOpenFolder,
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab]);

  if (!session) return null;

  const item = cloneLazyTodo({
    ...session,
    id: session.id || "active-session",
  });

  return createPortal(
    <div
      className="lazy-todo-dashboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("pack.lazyTodosTitle")}
    >
      <button
        type="button"
        className="lazy-todo-dashboard-overlay__backdrop"
        aria-label={t("lazyTodos.closeTab")}
        onClick={onCloseTab}
      />
      <div className="lazy-todo-dashboard-overlay__card">
        <LazyTodoCard
          item={item}
          variant="dashboard"
          onChange={onChange}
          onCloseTab={onCloseTab}
          onCompleted={onCompleted}
          onSave={onSave}
          onOpenDocument={onOpenDocument}
          onOpenFolder={onOpenFolder}
        />
      </div>
    </div>,
    document.body,
  );
}
