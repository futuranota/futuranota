import { useEffect } from "react";
import { createPortal } from "react-dom";
import { GinaChatCard } from "./GinaChatCard.jsx";

/**
 * Portal overlay for Gina chat (in-doc Call Asistente or dashboard Assistance).
 * Backdrop and panel are separate layers so Assistance hero can sit between them (z 12001).
 *
 * @param {{
 *   documentId?: string | null,
 *   openingMessage?: string,
 *   openingMode?: "first" | "return" | "progress",
 *   demoReply?: string,
 *   placeholder?: string,
 *   speechLang?: string,
 *   labels?: Record<string, string>,
 *   onSendMessage?: (text: string, meta?: { meetingMode?: boolean }) => void | Promise<void | string | object>,
 *   onDocumentAction?: (action: "organize" | "organize_script" | "import_pdf" | "export_pdf" | "save_pdf_library" | "export_md" | "save_md_library") => void | boolean | Promise<void | boolean>,
 *   writingEmpty?: boolean,
 *   allowMeetingMode?: boolean,
 *   meetingDocumentTitle?: string,
 *   initialMeetingMode?: boolean,
 *   lockMeetingMode?: boolean,
 *   autoRunPrompt?: string | null,
 *   autoRunDisplayText?: string | null,
 *   compact?: boolean,
 *   onClose: () => void,
 * }} props
 */
export function GinaChatOverlay({
  documentId = null,
  assistantName = "Gina",
  openingMessage,
  openingMode = "first",
  demoReply,
  placeholder,
  speechLang = "es-ES",
  labels = {},
  onSendMessage,
  onDocumentAction,
  writingEmpty = false,
  allowMeetingMode = false,
  meetingDocumentTitle = "",
  initialMeetingMode = false,
  lockMeetingMode = false,
  autoRunPrompt = null,
  autoRunDisplayText = null,
  compact: _compact = false,
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
    <>
      <div
        className="gina-chat-overlay__backdrop"
        role="presentation"
        onMouseDown={() => onClose?.()}
      />
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
          openingMode={openingMode}
          demoReply={demoReply}
          placeholder={placeholder}
          speechLang={speechLang}
          labels={labels}
          onSendMessage={onSendMessage}
          onDocumentAction={onDocumentAction}
          writingEmpty={writingEmpty}
          allowMeetingMode={allowMeetingMode}
          meetingDocumentTitle={meetingDocumentTitle}
          initialMeetingMode={initialMeetingMode}
          lockMeetingMode={lockMeetingMode}
          autoRunPrompt={autoRunPrompt}
          autoRunDisplayText={autoRunDisplayText}
          onClose={onClose}
        />
      </div>
    </>,
    document.body,
  );
}

export default GinaChatOverlay;
