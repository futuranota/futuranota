import { useNodesStore } from "../../stores/nodesStore.js";
import { getNodeWritingExcerpt } from "../../lib/nodeWritingExcerpt.js";
import { useI18n } from "../../i18n/useI18n.js";
import { DocStatusChip } from "./FolderDocumentRow.jsx";
import { resolveDocWorkStatus } from "../../lib/docWorkStatus.js";

/**
 * Description layer for the descriptive document model synced into a parent folder.
 *
 * Trigger path: left panel → expand folder → "Create a new Document"
 * (parentDocId set) → write title + body → save → title appears in open folder;
 * this row shows under that title when the color-link handle is hidden.
 *
 * Rules:
 * - Description: only when enabled and node.content has readable text (excerpt ≤120)
 * - continue reading → opens that macronode
 * - Descriptive: status chip rides next to the title (see LinkedMacronodeStatusBadge)
 * - Quick / color-link: status chip sits on its own line under the title
 */
export function LinkedMacronodeStatusBadge({ nodeId }) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] ?? null : null));
  const workStatus = resolveDocWorkStatus(node);
  if (!nodeId || !workStatus) return null;
  return (
    <span className="doc-linked-macro-status-title">
      <DocStatusChip status={workStatus} />
    </span>
  );
}

export function LinkedMacronodeDescription({
  nodeId,
  onContinue,
  showDescription = true,
  showStatus = true,
}) {
  const { t } = useI18n();
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] ?? null : null));
  const workStatus = showStatus ? resolveDocWorkStatus(node) : null;
  const { excerpt } = getNodeWritingExcerpt(node?.content);
  const hasExcerpt = showDescription && Boolean(excerpt);

  if (!nodeId || (!hasExcerpt && !workStatus)) return null;

  const open = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onContinue?.();
  };

  const statusChip = workStatus ? <DocStatusChip status={workStatus} /> : null;

  if (!hasExcerpt) {
    return (
      <div className="doc-linked-macro-desc">
        {statusChip}
      </div>
    );
  }

  return (
    <div className="doc-linked-macro-desc">
      <span className="folder-doc-row__desc-label">
        {t("sidebar.docDescriptionLabel")}
      </span>
      {" "}
      <span className="folder-doc-row__desc-excerpt">{excerpt}</span>
      {" "}
      <button
        type="button"
        className="folder-doc-row__continue"
        onClick={open}
      >
        {t("sidebar.continueReading")}
      </button>
    </div>
  );
}
