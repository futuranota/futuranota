import { createPortal } from "react-dom";
import { CleanReader } from "./CleanReader.jsx";
import { NoteTaker } from "./NoteTaker.jsx";

export function IntelReferencePanel({
  citation,
  searchQuery,
  nodeId,
  parentDocId = null,
  blockIndex = null,
  onClose,
}) {
  if (!citation) return null;

  return createPortal(
    <div
      className="lp-overlay lp-overlay--solid lp-overlay--center intel-ref-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Reference reader"
    >
      <div
        className="intel-ref-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <CleanReader
          url={citation.url}
          title={citation.title}
          source={citation.source}
          domain={citation.domain}
          snippet={citation.body}
          onBack={onClose}
        />
        <NoteTaker
          nodeId={nodeId}
          parentDocId={parentDocId}
          blockIndex={blockIndex}
          onClose={onClose}
          inlineTodosEnabled
        />
      </div>
    </div>,
    document.body,
  );
}
