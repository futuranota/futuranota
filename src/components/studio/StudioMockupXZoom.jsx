/**
 * X zoomed post (v02).
 * layoutMode "zoom" (portrait): video frame only + play, no scroll.
 * layoutMode "post" (landscape / 1:1): logo + texts + media, no scroll.
 */
export function StudioMockupXZoom({
  wallColor = "#000000",
  frameStroke = "#191A1C",
  textColor = "#E7E9EA",
  aspectCss = "16 / 9",
  frameSizeClass = "",
  layoutMode = "post",
  logoDataUrl = null,
  displayName = "",
  description = "",
  children,
}) {
  const stroke = frameStroke || "#191A1C";
  const ink = textColor || "#E7E9EA";
  const name = String(displayName || "").trim();
  const desc = String(description || "").trim();
  const isZoom = layoutMode === "zoom";

  if (isZoom) {
    return (
      <div
        className="studio-mockup-x-zoom studio-mockup-x-zoom--zoom"
        style={{ backgroundColor: wallColor }}
      >
        <div
          className={`studio-mockup-x-zoom__media studio-mockup-x-zoom__media--fill ${frameSizeClass}`}
          style={{
            aspectRatio: aspectCss,
            borderColor: stroke,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="studio-mockup-x-zoom studio-mockup-x-zoom--post"
      style={{ backgroundColor: wallColor }}
    >
      <article className="studio-mockup-x-zoom__post">
        <div className="studio-mockup-x-zoom__head">
          {logoDataUrl ? (
            <img
              className="studio-mockup-x-zoom__logo"
              src={logoDataUrl}
              alt=""
            />
          ) : (
            <span className="studio-mockup-x-zoom__logo-slot" aria-hidden />
          )}
          <div className="studio-mockup-x-zoom__meta">
            {name ? (
              <span className="studio-mockup-x-zoom__name" style={{ color: ink }}>
                {name}
              </span>
            ) : (
              <span className="studio-mockup-x-zoom__line studio-mockup-x-zoom__line--name" aria-hidden />
            )}
            <span className="studio-mockup-x-zoom__line studio-mockup-x-zoom__line--handle" aria-hidden />
          </div>
          <span className="studio-mockup-x-zoom__menu" aria-hidden />
        </div>

        {desc ? (
          <p className="studio-mockup-x-zoom__desc" style={{ color: ink }}>
            {desc}
          </p>
        ) : (
          <div className="studio-mockup-x-zoom__desc-shapes" aria-hidden>
            <span className="studio-mockup-x-zoom__line" />
            <span className="studio-mockup-x-zoom__line studio-mockup-x-zoom__line--mid" />
          </div>
        )}

        <div
          className={`studio-mockup-x-zoom__media ${frameSizeClass}`}
          style={{
            aspectRatio: aspectCss,
            borderColor: stroke,
          }}
        >
          {children}
        </div>

        <div className="studio-mockup-x-zoom__actions" aria-hidden>
          <span className="studio-mockup-x-zoom__action" />
          <span className="studio-mockup-x-zoom__action" />
          <span className="studio-mockup-x-zoom__action" />
          <span className="studio-mockup-x-zoom__action" />
          <span className="studio-mockup-x-zoom__action" />
          <span className="studio-mockup-x-zoom__action" />
        </div>
      </article>
    </div>
  );
}
