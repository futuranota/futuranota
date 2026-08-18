import { getAssetGridLayout } from "../../lib/libraryAssetGridLayout.js";
import { LibraryAssetImgMark } from "./LibraryAssetImgMark.jsx";

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

function MetadataCardBody({ item }) {
  const tag = String(item?.tag || "").trim() || "—";
  const description = String(item?.description || "").trim();

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

/**
 * Adaptive metadata grid for document assets (no thumbnails — tag + prompt only).
 * @param {{ items?: import("../../lib/folderLibrary.js").FolderLibraryItem[], onOpenItem?: (item: object) => void, interactive?: boolean }} props
 */
export function LibraryAssetMetadataGrid({
  items = [],
  onOpenItem,
  interactive = true,
}) {
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
        if (interactive && onOpenItem) {
          return (
            <button
              key={item.id}
              type="button"
              className="library-asset-queue__slot library-asset-metadata-card library-asset-queue__slot--hit"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenItem(item);
              }}
              aria-label={item.tag || "IMG"}
            >
              <MetadataCardBody item={item} />
            </button>
          );
        }
        return (
          <div
            key={item.id}
            className="library-asset-queue__slot library-asset-metadata-card"
          >
            <MetadataCardBody item={item} />
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
