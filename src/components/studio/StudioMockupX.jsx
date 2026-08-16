/**
 * X (Twitter) desktop low-fi chrome.
 * Post head/body can show session identity (logo, name, desc);
 * Ad chip sits on the top-right of the video. Chrome remains shapes.
 */
export function StudioMockupX({
  wallColor = "#000000",
  frameStroke = "#191A1C",
  textColor = "#E7E9EA",
  aspectCss = "16 / 9",
  frameSizeClass = "",
  logoDataUrl = null,
  displayName = "",
  description = "",
  adLabel = "Ad",
  children,
}) {
  const stroke = frameStroke || "#191A1C";
  const ink = textColor || "#E7E9EA";
  const name = String(displayName || "").trim();
  const desc = String(description || "").trim();
  const ad = String(adLabel || "Ad").trim() || "Ad";

  return (
    <div
      className="studio-mockup-x"
      style={{ backgroundColor: wallColor }}
      aria-hidden={false}
    >
      <aside className="studio-mockup-x__nav" aria-hidden>
        <span className="studio-mockup-x__nav-logo" />
        <span className="studio-mockup-x__nav-item" />
        <span className="studio-mockup-x__nav-item" />
        <span className="studio-mockup-x__nav-item" />
        <span className="studio-mockup-x__nav-item" />
        <span className="studio-mockup-x__nav-item" />
        <span className="studio-mockup-x__nav-cta" />
        <span className="studio-mockup-x__nav-avatar" />
      </aside>

      <main className="studio-mockup-x__feed">
        <article className="studio-mockup-x__post">
          <div className="studio-mockup-x__post-head">
            {logoDataUrl ? (
              <img className="studio-mockup-x__logo" src={logoDataUrl} alt="" />
            ) : (
              <span className="studio-mockup-x__avatar" aria-hidden />
            )}
            <div className="studio-mockup-x__meta">
              {name ? (
                <span className="studio-mockup-x__name" style={{ color: ink }}>
                  {name}
                </span>
              ) : (
                <span className="studio-mockup-x__line studio-mockup-x__line--short" aria-hidden />
              )}
            </div>
            <span className="studio-mockup-x__menu-dot" aria-hidden />
          </div>
          {desc ? (
            <p className="studio-mockup-x__desc" style={{ color: ink }}>
              {desc}
            </p>
          ) : (
            <div className="studio-mockup-x__post-body" aria-hidden>
              <span className="studio-mockup-x__line" />
              <span className="studio-mockup-x__line studio-mockup-x__line--mid" />
            </div>
          )}
          <div
            className={`studio-mockup-x__media ${frameSizeClass}`}
            style={{
              aspectRatio: aspectCss,
              borderColor: stroke,
            }}
          >
            <span className="studio-mockup-x__ad" aria-hidden>
              {ad}
            </span>
            {children}
          </div>
          <div className="studio-mockup-x__actions" aria-hidden>
            <span className="studio-mockup-x__action" />
            <span className="studio-mockup-x__action" />
            <span className="studio-mockup-x__action" />
            <span className="studio-mockup-x__action" />
            <span className="studio-mockup-x__action" />
          </div>
        </article>
      </main>

      <aside className="studio-mockup-x__rail" aria-hidden>
        <span className="studio-mockup-x__search" />
        <div className="studio-mockup-x__card">
          <span className="studio-mockup-x__card-bar" />
          <span className="studio-mockup-x__card-row" />
          <span className="studio-mockup-x__card-row" />
          <span className="studio-mockup-x__card-row" />
        </div>
        <div className="studio-mockup-x__card">
          <span className="studio-mockup-x__card-bar" />
          <span className="studio-mockup-x__follow-row">
            <span className="studio-mockup-x__avatar studio-mockup-x__avatar--sm" />
            <span className="studio-mockup-x__follow-pill" />
          </span>
          <span className="studio-mockup-x__follow-row">
            <span className="studio-mockup-x__avatar studio-mockup-x__avatar--sm" />
            <span className="studio-mockup-x__follow-pill" />
          </span>
        </div>
      </aside>
    </div>
  );
}
