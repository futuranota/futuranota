import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CleanReader } from "./CleanReader.jsx";
import { NoteTaker } from "./NoteTaker.jsx";

export function IntelReferencePanel({ citation, searchQuery, nodeId, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!citation) return null;

  return createPortal(
    <div
      className="lp-overlay lp-overlay--solid lp-overlay--center intel-ref-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Reference reader"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="intel-ref-panel">
        <CleanReader
          url={citation.url}
          title={citation.title}
          source={citation.source}
          domain={citation.domain}
          snippet={citation.body}
          onBack={onClose}
        />
        <NoteTaker searchQuery={searchQuery} nodeId={nodeId} />
      </div>
    </div>,
    document.body,
  );
}
