import { useEffect } from "react";
import { createPortal } from "react-dom";
import { GinaChatCard } from "./GinaChatCard.jsx";

/**
 * Portal overlay for Gina chat (in-doc Call Asistente or dashboard Assistance).
 *
 * @param {{
 *   documentId?: string | null,
 *   openingMessage?: string,
 *   demoReply?: string,
 *   placeholder?: string,
 *   speechLang?: string,
 *   labels?: Record<string, string>,
 *   onSendMessage?: (text: string) => void | Promise<void>,
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
  onSendMessage,
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
          className={documentId ? "" : "gina-chat-card--dashboard"}
          documentId={documentId}
          assistantName={assistantName}
          openingMessage={openingMessage}
          demoReply={demoReply}
          placeholder={placeholder}
          speechLang={speechLang}
          labels={labels}
          onSendMessage={onSendMessage}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}

export default GinaChatOverlay;
