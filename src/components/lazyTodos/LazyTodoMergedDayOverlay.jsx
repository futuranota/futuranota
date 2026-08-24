import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { LazyTodoMergedDayCard } from "./LazyTodoMergedDayCard.jsx";
import {
  LAZY_TODO_UNSCHEDULED_DAY_KEY,
  formatLazyTodoDayLabel,
} from "../../lib/lazyTodoProvenance.js";
import { todayDateInputValue } from "../../lib/docDates.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {Object} props
 * @param {{
 *   dayKey: string,
 *   items: import("../../lib/lazyTodos.js").LazyTodoItem[],
 *   initialActiveItemId?: string|null,
 * } | null} props.session
 * @param {(itemId: string, patch: Partial<import("../../lib/lazyTodos.js").LazyTodoItem>) => void} props.onChangeItem
 * @param {(itemId: string) => void} props.onCompletedItem
 * @param {() => void} props.onClose
 * @param {(documentId: string) => void} [props.onOpenDocument]
 * @param {(folderId: string) => void} [props.onOpenFolder]
 */
export function LazyTodoMergedDayOverlay({
  session,
  onChangeItem,
  onCompletedItem,
  onClose,
  onOpenDocument,
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

  const dayMeta = useMemo(() => {
    if (!session?.dayKey) return null;
    return formatLazyTodoDayLabel(session.dayKey, { today: todayDateInputValue() });
  }, [session?.dayKey]);

  const dayLabel = useMemo(() => {
    if (!dayMeta) return "";
    if (dayMeta.kind === "today") return t("lazyTodos.dayToday");
    if (dayMeta.kind === "tomorrow") return t("lazyTodos.dayTomorrow");
    if (dayMeta.kind === "past") {
      return `${t("lazyTodos.dayPast")}${dayMeta.display ? ` · ${dayMeta.display}` : ""}`;
    }
    if (dayMeta.kind === "unscheduled" || session?.dayKey === LAZY_TODO_UNSCHEDULED_DAY_KEY) {
      return t("lazyTodos.dayUnscheduled");
    }
    return dayMeta.display || session.dayKey;
  }, [dayMeta, session?.dayKey, t]);

  if (!session?.items?.length) return null;

  const objectId = session.items.find((item) => item?.objectId)?.objectId || null;

  return createPortal(
    <div
      className="lazy-todo-dashboard-overlay lazy-todo-merged-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("lazyTodos.dayMergeTitle", { label: dayLabel })}
    >
      <button
        type="button"
        className="lazy-todo-dashboard-overlay__backdrop"
        aria-label={t("lazyTodos.closeTab")}
        onClick={onClose}
      />
      <div className="lazy-todo-dashboard-overlay__card lazy-todo-merged-overlay__card">
        <LazyTodoMergedDayCard
          dayLabel={dayLabel}
          dayKey={session.dayKey}
          objectId={objectId}
          items={session.items}
          initialActiveItemId={session.initialActiveItemId || null}
          onChangeItem={onChangeItem}
          onCompletedItem={onCompletedItem}
          onClose={onClose}
          onSave={onClose}
          onOpenDocument={onOpenDocument}
          onOpenFolder={onOpenFolder}
        />
      </div>
    </div>,
    document.body,
  );
}
