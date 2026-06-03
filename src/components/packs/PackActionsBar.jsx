import { useState } from "react";
import { exportObjectPack } from "../../lib/pack/packExport.js";

/**
 * @param {Object} props
 * @param {'objects'|'documents'} props.placement
 * @param {() => void} props.onOpenImport
 * @param {string|null} [props.exportObjectId]
 */
export function PackActionsBar({
  placement,
  onOpenImport,
  exportObjectId = null,
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!exportObjectId || exporting) return;
    setExporting(true);
    try {
      await exportObjectPack(exportObjectId, { includeGraph: false });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={"pack-actions pack-actions--" + placement} role="toolbar" aria-label="Pack import export">
      <button
        type="button"
        className="btn xs pack-actions__btn"
        onClick={onOpenImport}
      >
        Import pack
      </button>
      {placement === "documents" && exportObjectId ? (
        <button
          type="button"
          className="btn xs pack-actions__btn pack-actions__btn--accent"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exporting…" : "Export pack"}
        </button>
      ) : null}
    </div>
  );
}
