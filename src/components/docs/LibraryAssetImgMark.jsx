const EMPTY_IMG_SLOTS = ["img-a", "img-b", "img-c", "img-d"];

export function LibraryAssetImgMark() {
  return (
    <svg className="library-asset-queue__mark" viewBox="0 0 32 32" aria-hidden>
      <rect x="4" y="6" width="24" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 22l5.2-6.2 3.4 4.1 4.1-5.3L24 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function LibraryAssetEmptyImgGrid() {
  return EMPTY_IMG_SLOTS.map((id) => (
    <div key={id} className="library-asset-queue__slot">
      <span className="folder-library-overlay__cell-badge folder-library-overlay__cell-badge--image">
        <LibraryAssetImgMark />
        <span className="folder-library-overlay__cell-badge-fmt">IMG</span>
      </span>
    </div>
  ));
}
