import { LibrarySponsoredTag } from "../LibrarySponsoredTag.jsx";
import {
  LIBRARY_MEDIA_BADGE_SRC,
  fichaShowsMediaBadge,
  promptPreviewText,
  resolveFichaPreviewKind,
} from "../../../lib/libraryFichaPreview.js";

export function formatLibraryFichaBadge(item) {
  if (item?.attachmentKind) return String(item.attachmentKind).toUpperCase().slice(0, 6);
  if (item?.category === "pdf") return "PDF";
  if (item?.category === "skill") return "FILE";
  if (item?.category === "image") return "TXT";
  if (item?.category === "video") return "VIDEO";
  return "FILE";
}

function MediaBadge({ item, prefer, faceOptions = {} }) {
  if (!fichaShowsMediaBadge(item, prefer, faceOptions)) return null;
  return (
    <img
      className="folder-library-overlay__cell-media-badge"
      src={LIBRARY_MEDIA_BADGE_SRC}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}

/**
 * @param {object} item
 * @param {"image"|"prompt"} prefer
 * @param {string} [sponsoredLabel]
 * @param {{ tabLocked?: boolean }} [faceOptions]
 */
export function renderLibraryFichaFace(item, prefer, sponsoredLabel = "", faceOptions = {}) {
  const isAttachment = item?.category === "skill" || item?.category === "pdf";
  const kind = isAttachment ? "badge" : resolveFichaPreviewKind(item, prefer, faceOptions);
  if (kind === "prompt") {
    return (
      <>
        <span className="folder-library-overlay__cell-prompt">
          {promptPreviewText(item)}
        </span>
        <MediaBadge item={item} prefer={prefer} faceOptions={faceOptions} />
        {item?.sponsored && item?.mediaUrl ? (
          <LibrarySponsoredTag
            label={sponsoredLabel}
            className="library-sponsored-tag--overlay folder-library-overlay__cell-sponsored-tag"
          />
        ) : null}
      </>
    );
  }
  if (kind === "image") {
    return (
      <>
        <img
          className="folder-library-overlay__cell-img"
          src={item.mediaUrl}
          alt=""
        />
        {item?.sponsored ? (
          <LibrarySponsoredTag
            label={sponsoredLabel}
            className="library-sponsored-tag--overlay folder-library-overlay__cell-sponsored-tag"
          />
        ) : null}
      </>
    );
  }
  return (
    <span
      className={
        "folder-library-overlay__cell-badge"
        + ` folder-library-overlay__cell-badge--${item.category}`
      }
      aria-hidden
    >
      <span className="folder-library-overlay__cell-badge-lines" />
      <span className="folder-library-overlay__cell-badge-fmt">
        {formatLibraryFichaBadge(item)}
      </span>
    </span>
  );
}
