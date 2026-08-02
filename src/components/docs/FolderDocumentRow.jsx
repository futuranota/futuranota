import { getNodeWritingExcerpt } from "../../lib/nodeWritingExcerpt.js";
import { resolveDocSource } from "../../lib/docSources.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  DOC_WORK_STATUS,
  docWorkStatusLabel,
  resolveDocWorkStatus,
  shouldShowDocStatusChip,
} from "../../lib/docWorkStatus.js";

function getNodeDisplayTitle(node) {
  return (node?.sourceQuery || node?.title || "Untitled query").trim() || "Untitled query";
}

const DOC_STATUS_CHIP_ICON = {
  [DOC_WORK_STATUS.NOT_STARTED]: "not-started",
  [DOC_WORK_STATUS.RESERVED]: "reserved",
  [DOC_WORK_STATUS.IN_PROGRESS]: "in-progress",
  [DOC_WORK_STATUS.SUBMITTED]: "submitted",
  [DOC_WORK_STATUS.PAST_DUE]: "past-due",
  [DOC_WORK_STATUS.COMPLETED]: "completed",
};

/** Status chip for folder document rows (work statuses). */
export function DocStatusChip({ status }) {
  const { t } = useI18n();
  const resolved = resolveDocWorkStatus(
    typeof status === "string" || status == null
      ? { status }
      : status,
  );
  if (!resolved) return null;
  const label = docWorkStatusLabel(resolved, t);
  const iconKind = DOC_STATUS_CHIP_ICON[resolved] || "completed";
  return (
    <span className={`doc-status-chip doc-status-chip--${resolved}`} title={label}>
      <span
        className={`doc-status-chip__icon doc-status-chip__icon--${iconKind}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** @deprecated Prefer DocStatusChip — kept for campaign rows that still pass completed-only. */
export function CompletedChip() {
  return <DocStatusChip status={DOC_WORK_STATUS.COMPLETED} />;
}

/**
 * Folder child row: Title always; Description + continue reading when body has text;
 * Status chip when in progress / submitted / completed.
 */
export function FolderDocumentRow({
  node,
  onOpen,
  compact = false,
  showFileIcon = false,
  className = "",
  /** True when this doc's schedule date falls inside the parent folder frame. */
  docDateInFolderFrame = false,
}) {
  const { t } = useI18n();
  const title = getNodeDisplayTitle(node);
  const workStatus = resolveDocWorkStatus(node);
  const showChip = shouldShowDocStatusChip(workStatus, docDateInFolderFrame);
  const { excerpt } = getNodeWritingExcerpt(node?.content);
  const hasExcerpt = Boolean(excerpt);
  const source = resolveDocSource(node?.sourceId);
  const showIcon = showFileIcon || Boolean(source);
  const iconSrc = source?.src || "/uploads/File.svg";

  const open = (e) => {
    e?.stopPropagation?.();
    onOpen?.(node);
  };

  const statusChip = showChip ? <DocStatusChip status={workStatus} /> : null;

  return (
    <div
      className={
        "folder-doc-row"
        + (compact ? " folder-doc-row--compact" : "")
        + (workStatus === DOC_WORK_STATUS.COMPLETED ? " folder-doc-row--completed" : "")
        + (className ? ` ${className}` : "")
      }
    >
      <button
        type="button"
        className="folder-doc-row__main"
        onClick={open}
        title={source ? `${title} · ${source.label}` : title}
      >
        {showIcon ? (
          <span className="lp-node-type-icon lp-node-type-icon--compact lp-node-type-icon--file">
            <img
              src={iconSrc}
              alt=""
              aria-hidden
              className="lp-node-type-icon-img lp-icon-white"
            />
          </span>
        ) : null}
        <span className="folder-doc-row__text">
          <span className="folder-doc-row__title-row">
            <span className="folder-doc-row__title">{title}</span>
            {!hasExcerpt && statusChip ? (
              <>
                {" "}
                {statusChip}
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
              {statusChip ? (
                <>
                  {" "}
                  {statusChip}
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
