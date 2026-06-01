import { FLOPPY_DISK_ICON, formatKnowledgeFileSize, normalizeKnowledgeImport } from "../../lib/knowledgeImport.js";

export function KnowledgeImportedFile({ knowledgeImport, compact = false }) {
  const meta = normalizeKnowledgeImport(knowledgeImport);
  if (!meta) return null;

  const ext = meta.extension?.replace(/^\./, "").toUpperCase() || "FILE";

  return (
    <div
      className={"doc-knowledge-imported-file" + (compact ? " doc-knowledge-imported-file--compact" : "")}
      role="status"
      aria-label={`File imported: ${meta.fileName}`}
    >
      <div className="doc-knowledge-imported-file__icon-wrap" aria-hidden>
        <img src={FLOPPY_DISK_ICON} alt="" className="doc-knowledge-imported-file__icon" draggable={false} />
      </div>
      <div className="doc-knowledge-imported-file__body">
        <span className="doc-knowledge-imported-file__badge">File imported</span>
        <span className="doc-knowledge-imported-file__name" title={meta.fileName}>
          {meta.fileName}
        </span>
        <span className="doc-knowledge-imported-file__meta">
          {ext}
          {meta.sizeBytes > 0 ? `, ${formatKnowledgeFileSize(meta.sizeBytes)}` : ""}
        </span>
      </div>
    </div>
  );
}
