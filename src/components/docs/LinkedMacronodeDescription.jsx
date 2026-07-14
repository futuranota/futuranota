import { useNodesStore } from "../../stores/nodesStore.js";
import { getNodeWritingExcerpt } from "../../lib/nodeWritingExcerpt.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Description layer under every macronode title synced into a parent folder.
 *
 * Trigger path: left panel → expand folder → "Create a new Document"
 * (parentDocId set) → write title + body → save → title appears in open folder;
 * this row shows under that title for ANY doc, not a single title.
 *
 * Rules:
 * - Description: only when node.content has readable text (excerpt ≤120)
 * - continue reading → opens that macronode
 * - Completed chip only when node.completed
 */
export function LinkedMacronodeDescription({ nodeId, onContinue }) {
  const { t } = useI18n();
  const node = useNodesStore((s) => (nodeId ? s.nodes[nodeId] ?? null : null));
  const completed = Boolean(node?.completed);
  const { excerpt } = getNodeWritingExcerpt(node?.content);
  const hasExcerpt = Boolean(excerpt);

  if (!nodeId || (!hasExcerpt && !completed)) return null;

  const open = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onContinue?.();
  };

  const completedChip = completed ? (
    <span className="folder-doc-row__completed">
      {t("sidebar.docCompleted")}
    </span>
  ) : null;

  if (!hasExcerpt) {
    return (
      <div className="doc-linked-macro-desc">
        {completedChip}
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
      {completedChip ? (
        <>
          {" "}
          {completedChip}
        </>
      ) : null}
    </div>
  );
}
