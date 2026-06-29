import { linkifyReportText } from "../../lib/linkifyReportText.jsx";

export const REPORT_IMAGE_MD_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

function ReportMarkdownImage({ src, alt, fillWidth = false }) {
  return (
    <figure className="doc-analyst-report__figure">
      <img
        className={
          "doc-analyst-report__img"
          + (fillWidth ? " doc-analyst-report__img--fill" : "")
        }
        src={src}
        alt={alt || ""}
        draggable={false}
      />
    </figure>
  );
}

/**
 * @param {string} line
 * @param {number} index
 * @param {string} [keyPrefix]
 * @param {{ imageScale?: number, imageFillWidth?: boolean }} [options]
 */
export function renderReportMarkdownLine(line, index, keyPrefix = "", options = {}) {
  const key = `${keyPrefix}${index}`;
  const imageFillWidth = Boolean(options.imageFillWidth);

  if (line.startsWith("# ")) {
    return (
      <h1 key={key} className="doc-analyst-report__h1">
        {linkifyReportText(line.slice(2), `h1-${key}`)}
      </h1>
    );
  }

  if (line.startsWith("## ")) {
    return (
      <h2 key={key}>
        {linkifyReportText(line.slice(3), `h2-${key}`)}
      </h2>
    );
  }

  if (!line.trim()) {
    return null;
  }

  const imageMatch = line.match(REPORT_IMAGE_MD_RE);
  if (imageMatch) {
    const [, alt, src] = imageMatch;
    return (
      <ReportMarkdownImage
        key={key}
        src={src}
        alt={alt || ""}
        fillWidth={imageFillWidth}
      />
    );
  }

  return (
    <p key={key}>
      {linkifyReportText(line, `p-${key}`)}
    </p>
  );
}

/**
 * Static markdown renderer for agent reports (headings, paragraphs, images).
 * @param {{ text: string, className?: string, imageFillWidth?: boolean }} props
 */
export function ReportMarkdownBody({ text, className = "", imageFillWidth = false }) {
  const plain = (text || "").replace(/\*\*(.*?)\*\*/g, "$1");
  const lines = plain.split("\n");
  const rootClass = ["doc-analyst-report", "doc-analyst-report-static", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {lines.map((line, i) => renderReportMarkdownLine(line, i, "s-", { imageFillWidth }))
        .filter(Boolean)}
    </div>
  );
}
