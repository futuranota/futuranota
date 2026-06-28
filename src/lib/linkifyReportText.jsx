import { Fragment } from "react";

const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;
const BARE_URL_RE = /https?:\/\/[^\s)\]>]+/;

/**
 * @param {string} text
 * @param {string} [keyPrefix]
 * @returns {import("react").ReactNode}
 */
export function linkifyReportText(text, keyPrefix = "line") {
  if (!text) return null;

  /** @type {import("react").ReactNode[]} */
  const nodes = [];
  let remaining = text;
  let partIndex = 0;

  while (remaining.length > 0) {
    const mdMatch = remaining.match(MD_LINK_RE);
    const urlMatch = remaining.match(BARE_URL_RE);

    const mdIndex = mdMatch?.index ?? -1;
    const urlIndex = urlMatch?.index ?? -1;

    let nextIndex = -1;
    /** @type {"md"|"url"|null} */
    let kind = null;

    if (mdIndex >= 0 && (urlIndex < 0 || mdIndex <= urlIndex)) {
      nextIndex = mdIndex;
      kind = "md";
    } else if (urlIndex >= 0) {
      nextIndex = urlIndex;
      kind = "url";
    }

    if (nextIndex < 0) {
      nodes.push(remaining);
      break;
    }

    if (nextIndex > 0) {
      nodes.push(remaining.slice(0, nextIndex));
    }

    if (kind === "md" && mdMatch) {
      nodes.push(
        <a
          key={`${keyPrefix}-md-${partIndex}`}
          href={mdMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {mdMatch[1]}
        </a>,
      );
      remaining = remaining.slice(mdMatch.index + mdMatch[0].length);
    } else if (kind === "url" && urlMatch) {
      nodes.push(
        <a
          key={`${keyPrefix}-url-${partIndex}`}
          href={urlMatch[0]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {urlMatch[0]}
        </a>,
      );
      remaining = remaining.slice(urlMatch.index + urlMatch[0].length);
    } else {
      nodes.push(remaining);
      break;
    }

    partIndex += 1;
  }

  if (nodes.length === 1 && typeof nodes[0] === "string") {
    return nodes[0];
  }

  return <Fragment>{nodes}</Fragment>;
}
