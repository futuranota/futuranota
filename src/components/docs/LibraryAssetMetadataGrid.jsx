import { getAssetGridLayout } from "../../lib/libraryAssetGridLayout.js";
import { resolveFichaPreviewKind, promptPreviewText } from "../../lib/libraryFichaPreview.js";
import { LibraryAssetImgMark } from "./LibraryAssetImgMark.jsx";
import { useI18n } from "../../i18n/useI18n.js";

function isPendingAssignItem(item) {
  return Boolean(item?.__pendingAssign);
}

function LibraryAssetEmptySlot() {
  return (
    <div className="library-asset-queue__slot">
      <span className="folder-library-overlay__cell-badge folder-library-overlay__cell-badge--image">
        <LibraryAssetImgMark />
        <span className="folder-library-overlay__cell-badge-fmt">IMG</span>
      </span>
    </div>
  );
}

function MetadataCardBody({ item, pendingLabel = "" }) {
  const kind = resolveFichaPreviewKind(item, "image");
  if (kind === "image") {
    return (
      <>
        <img
          className="library-asset-metadata-card__img"
          src={item.mediaUrl}
          alt=""
        />
        {isPendingAssignItem(item) && pendingLabel ? (
          <span className="library-asset-metadata-card__pending-badge">{pendingLabel}</span>
        ) : null}
      </>
    );
  }

  const tag = String(item?.tag || "").trim() || "—";
  const description = promptPreviewText(item);

  return (
    <>
      <div className="library-asset-metadata-card__body">
        <span className="library-asset-metadata-card__tag">{tag}</span>
        {description ? (
          <span className="library-asset-metadata-card__desc">{description}</span>
        ) : (
          <span className="library-asset-metadata-card__desc library-asset-metadata-card__desc--empty">
            —
          </span>
        )}
      </div>
      <span className="library-asset-metadata-card__badge" aria-hidden>IMG</span>
    </>
  );
}

function assetCardClass(item) {
  const media = resolveFichaPreviewKind(item, "image") === "image"
    ? " library-asset-metadata-card--media"
    : "";
  const pending = isPendingAssignItem(item)
    ? " library-asset-metadata-card--pending"
    : "";
  return `library-asset-queue__slot library-asset-metadata-card${media}${pending}`;
}

/**
 * Adaptive asset grid: image when the ficha has media, otherwise tag + prompt.
 * @param {{ items?: import("../../lib/folderLibrary.js").FolderLibraryItem[], onOpenItem?: (item: object) => void, interactive?: boolean }} props
 */
export function LibraryAssetMetadataGrid({
  items = [],
  onOpenItem,
  interactive = true,
}) {
  const { t } = useI18n();
  const pendingLabel = t("doc.library.assetPendingPreview");
  const layout = getAssetGridLayout(items.length);
  const className = [
    "library-asset-queue",
    "library-asset-queue--adaptive",
    `library-asset-queue--cols-${layout.cols}`,
    layout.scroll ? "library-asset-queue--scroll" : "",
    interactive ? "" : "library-asset-queue--preview",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      style={{ "--asset-slot-min": `${layout.slotMinHeight}px` }}
    >
      {items.map((item) => {
        const pending = isPendingAssignItem(item);
        const ariaLabel = pending
          ? `${item.tag || "IMG"} — ${pendingLabel}`
          : (item.tag || "IMG");
        if (interactive && onOpenItem && !pending) {
          return (
            <button
              key={item.id}
              type="button"
              className={`${assetCardClass(item)} library-asset-queue__slot--hit`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenItem(item);
              }}
              aria-label={ariaLabel}
            >
              <MetadataCardBody item={item} pendingLabel={pendingLabel} />
            </button>
          );
        }
        return (
          <div
            key={item.id}
            className={assetCardClass(item)}
            aria-label={pending ? ariaLabel : undefined}
          >
            <MetadataCardBody item={item} pendingLabel={pendingLabel} />
          </div>
        );
      })}
      {layout.showPlaceholders && layout.emptySlots > 0
        ? Array.from({ length: layout.emptySlots }, (_, index) => (
          <LibraryAssetEmptySlot key={`ph-${index}`} />
        ))
        : null}
    </div>
  );
}
