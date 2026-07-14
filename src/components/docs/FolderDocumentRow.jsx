import { getNodeWritingExcerpt } from "../../lib/nodeWritingExcerpt.js";
import { useI18n } from "../../i18n/useI18n.js";

function getNodeDisplayTitle(node) {
  return (node?.sourceQuery || node?.title || "Untitled query").trim() || "Untitled query";
}

/**
 * Folder child row: Title always; Description + continue reading when body has text;
 * Completed chip only when active (beside title if no excerpt, else on Description line).
 */
export function FolderDocumentRow({
  node,
  onOpen,
  compact = false,
  showFileIcon = false,
  className = "",
}) {
  const { t } = useI18n();
  const title = getNodeDisplayTitle(node);
  const completed = Boolean(node?.completed);
  const { excerpt } = getNodeWritingExcerpt(node?.content);
  const hasExcerpt = Boolean(excerpt);

  const open = (e) => {
    e?.stopPropagation?.();
    onOpen?.(node);
  };

  const completedChip = completed ? (
    <span className="folder-doc-row__completed">
      {t("sidebar.docCompleted")}
    </span>
  ) : null;

  return (
    <div
      className={
        "folder-doc-row"
        + (compact ? " folder-doc-row--compact" : "")
        + (completed ? " folder-doc-row--completed" : "")
        + (className ? ` ${className}` : "")
      }
    >
      <button
        type="button"
        className="folder-doc-row__main"
        onClick={open}
        title={title}
      >
        {showFileIcon ? (
          <span className="lp-node-type-icon lp-node-type-icon--compact lp-node-type-icon--file">
            <img
              src="/uploads/File.svg"
              alt=""
              aria-hidden
              className="lp-node-type-icon-img lp-icon-white"
            />
          </span>
        ) : null}
        <span className="folder-doc-row__text">
          <span className="folder-doc-row__title-row">
            <span className="folder-doc-row__title">{title}</span>
            {!hasExcerpt && completedChip ? (
              <>
                {" "}
                {completedChip}
              </>
            ) : null}
          </span>
          {hasExcerpt ? (
            <span className="folder-doc-row__desc">
              <span className="folder-doc-row__desc-label">
                {t("sidebar.docDescriptionLabel")}
              </span>
              {" "}
              <span className="folder-doc-row__desc-excerpt">{excerpt}</span>
              {" "}
              <span
                className="folder-doc-row__continue"
                role="link"
                tabIndex={-1}
                onClick={open}
              >
                {t("sidebar.continueReading")}
              </span>
              {completedChip ? (
                <>
                  {" "}
                  {completedChip}
                </>
              ) : null}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

export { getNodeDisplayTitle };
