/** Status glyphs for doc todo plan (pending → completed). */
export function TodoStatusIcon({ status = "pending", size = "md", className = "" }) {
  const dim = size === "sm" ? 14 : 18;
  const base = `doc-todo-plan__status-icon doc-todo-plan__status-icon--${status} ${className}`.trim();

  if (status === "completed") {
    return (
      <svg className={base} width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "in-progress") {
    return (
      <svg className={base} width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  if (status === "need-help") {
    return (
      <svg className={base} width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === "failed") {
    return (
      <svg className={base} width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={base} width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function itemStatusFromChecked(checked) {
  return checked ? "completed" : "pending";
}

export function macroStatusFromItems(items = []) {
  if (!items.length) return "pending";
  const done = items.filter((item) => item.checked).length;
  if (done === items.length) return "completed";
  if (done > 0) return "in-progress";
  return "pending";
}
