import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QLoopSequenceEditor } from "./QLoopSequenceEditor.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { MarkLoadingOverlay } from "../shared/MarkLoading.jsx";

/**
 * @param {Object} props
 * @param {import("../../lib/qloopSession.js").QLoopSession | null} props.session
 * @param {(patch: Partial<import("../../lib/qloopSession.js").QLoopSession>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {(queries: import("../../lib/docBlocks.js").QLoopEntry[]) => boolean|Promise<boolean>} [props.onSaved]
 */
export function QLoopEditorOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab, saving]);

  const handleSaved = useCallback(async (finalizedQueries) => {
    if (saving || !onSaved) return;
    setSaving(true);
    try {
      const ok = await onSaved(finalizedQueries);
      if (ok) {
        onCloseTab?.();
      }
    } finally {
      setSaving(false);
    }
  }, [onCloseTab, onSaved, saving]);

  if (!session) return null;

  return createPortal(
    <div
      className="qloop-editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("pack.qloopsTitle")}
    >
      <div className="qloop-editor-overlay__backdrop" aria-hidden />
      <div className="qloop-editor-overlay__card">
        <div className="qloop-editor-overlay__top-actions">
          <button
            type="button"
            className="qloop-editor-overlay__close"
            onClick={onCloseTab}
            disabled={saving}
            aria-label={t("qloopsLibrary.closeTab")}
            title={t("qloopsLibrary.closeTab")}
          >
            ×
          </button>
        </div>
        <div className="qloop-editor-overlay__body scroll-match-bg">
          <QLoopSequenceEditor
            key={`${session.docId || "new"}:${session.blockId}`}
            blockId={session.blockId}
            title={session.title}
            queries={session.queries}
            saving={saving}
            onTitleChange={(nextTitle) => onChange({ title: nextTitle, saved: false })}
            onQueriesChange={(nextQueries) => onChange({ queries: nextQueries, saved: false })}
            onSaved={handleSaved}
          />
        </div>
      </div>
      <MarkLoadingOverlay open={saving} label={t("common.saving")} />
    </div>,
    document.body,
  );
}
