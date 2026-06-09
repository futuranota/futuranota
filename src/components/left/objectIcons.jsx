export const CUBE_M_SRC = "/uploads/cube-m.png";
export const CUBE_SMALL_SRC = "/uploads/cube-small.png";

export function createPlaceholderImage({
  title = "",
  startColor,
  endColor,
  accentColor,
  showTitle = true,
}) {
  const titleMarkup =
    showTitle && title
      ? `<text x="196" y="565" fill="${accentColor}" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700">${title}</text>`
      : "";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="720" gradientUnits="userSpaceOnUse">
      <stop stop-color="${startColor}" />
      <stop offset="1" stop-color="${endColor}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="720" rx="40" fill="url(#bg)" />
  <rect x="96" y="96" width="1008" height="528" rx="30" fill="${accentColor}" fill-opacity="0.18" />
  <circle cx="270" cy="220" r="54" fill="${accentColor}" fill-opacity="0.7" />
  <rect x="352" y="184" width="552" height="72" rx="20" fill="${accentColor}" fill-opacity="0.68" />
  <rect x="196" y="350" width="404" height="36" rx="18" fill="${accentColor}" fill-opacity="0.62" />
  <rect x="196" y="410" width="620" height="30" rx="15" fill="${accentColor}" fill-opacity="0.56" />
  <rect x="196" y="456" width="720" height="30" rx="15" fill="${accentColor}" fill-opacity="0.46" />
  ${titleMarkup}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const OBJECT_THUMB_SRC = createPlaceholderImage({
  accentColor: "#0B1E47",
  endColor: "#CDE2FF",
  startColor: "#EAF2FF",
  showTitle: false,
});

export function ObjectIcon({ variant = "md", className = "" }) {
  const src = variant === "sm" ? CUBE_SMALL_SRC : CUBE_M_SRC;
  const sizeClass =
    variant === "sm" ? "obj-icon-img--sm" : variant === "lg" ? "obj-icon-img--lg" : "obj-icon-img--md";
  return (
    <img
      src={src}
      alt=""
      className={`obj-icon-img ${sizeClass}${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}

export function ObjectThumbPreview({ className = "" }) {
  return (
    <img
      src={OBJECT_THUMB_SRC}
      alt=""
      className={`obj-thumb-preview${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}
