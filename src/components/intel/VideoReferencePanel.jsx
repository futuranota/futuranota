import { createPortal } from "react-dom";
import { VideoWorkspace } from "./VideoWorkspace.jsx";

export function VideoReferencePanel({ nodeId = null, searchQuery = "", onClose }) {
  return createPortal(
    <div
      className="lp-overlay lp-overlay--solid lp-overlay--center intel-ref-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Video panel"
    >
      <div
        className="intel-ref-panel intel-ref-panel--video"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <VideoWorkspace
          nodeId={nodeId}
          searchQuery={searchQuery}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
