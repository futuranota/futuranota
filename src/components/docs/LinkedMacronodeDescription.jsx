import { useNodesStore } from "../../stores/nodesStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { getNodeWritingExcerpt } from "../../lib/nodeWritingExcerpt.js";
import { launchDateInputFromIso } from "../../lib/docDates.js";
import { useI18n } from "../../i18n/useI18n.js";
import { DocStatusChip } from "./FolderDocumentRow.jsx";
import {
  resolveDocWorkStatus,
  shouldShowDocStatusChip,
} from "../../lib/docWorkStatus.js";
import {
  isDateInputWithinFolderSchedule,
  isFolderScheduleReserved,
} from "../../lib/folderScheduleReservation.js";

/**
 * Description layer for the descriptive document model synced into a parent folder.
 *
 * Work-status chips show when the document schedule date falls inside the
 * parent folder Start→Finish frame. Reserved always shows.
 */
function useDocStatusChipVisibility(node) {
  const parentDoc = useDocsStore((s) => (
    node?.parentDocId ? s.docs[node.parentDocId] ?? null : null
  ));
  const workStatus = resolveDocWorkStatus(node);
  const docDate = launchDateInputFromIso(node?.anchorAt);
  const inFolderFrame = isFolderScheduleReserved(parentDoc)
    && Boolean(docDate)
    && isDateInputWithinFolderSchedule(docDate, parentDoc);
  return shouldShowDocStatusChip(workStatus, inFolderFrame) ? workStatus : null;
}

export function LinkedMacronodeStatusBadge({ nodeId }) {
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] ?? null : null));
  const workStatus = useDocStatusChipVisibility(node);
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
  const visibleStatus = useDocStatusChipVisibility(node);
  const workStatus = showStatus ? visibleStatus : null;
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
