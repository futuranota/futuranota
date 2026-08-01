import { useEffect } from "react";
import { createPortal } from "react-dom";
import { GinaChatCard } from "./GinaChatCard.jsx";

/**
 * Portal overlay for Call Asistente chat above the open document modal.
 *
 * @param {{
 *   documentId?: string | null,
 *   openingMessage?: string,
 *   demoReply?: string,
 *   placeholder?: string,
 *   speechLang?: string,
 *   labels?: Record<string, string>,
 *   onClose: () => void,
 * }} props
 */
export function GinaChatOverlay({
  documentId = null,
  assistantName = "Gina",
  openingMessage,
  demoReply,
  placeholder,
  speechLang = "es-ES",
  labels = {},
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="gina-chat-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="gina-chat-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={labels.dialogAria || assistantName}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GinaChatCard
          documentId={documentId}
          assistantName={assistantName}
          openingMessage={openingMessage}
          demoReply={demoReply}
          placeholder={placeholder}
          speechLang={speechLang}
          labels={labels}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}

export default GinaChatOverlay;
