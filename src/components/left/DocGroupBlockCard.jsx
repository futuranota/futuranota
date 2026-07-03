import { useState } from "react";

/**
 * Collapsible doc group — same visual pattern as DocNodesBlockCard.
 * @param {object} props
 * @param {string} props.groupLabel
 * @param {string} [props.groupMeta]
 * @param {import("../../types/docs.js").Doc[]} props.docs
 * @param {boolean} [props.defaultExpanded]
 * @param {(doc: import("../../types/docs.js").Doc) => import("react").ReactNode} props.renderDoc
 */
export function DocGroupBlockCard({
  groupLabel,
  groupMeta = "",
  docs = [],
  defaultExpanded = true,
  renderDoc,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!docs.length) return null;

  return (
    <article className="lp-doc-nodes-block lp-doc-nodes-block--docs">
      <div className="lp-doc-nodes-block__head">
        <button
          type="button"
          className="lp-doc-nodes-block__head-main"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className="lp-doc-icon">
            <img src="/uploads/botones/docs.svg" alt="" aria-hidden className="lp-item-icon-img" />
          </span>
          <div className="fn-card-body">
            <span className="lp-doc-group-category">{groupLabel}</span>
            {groupMeta ? (
              <span className="fn-card-meta">{groupMeta}</span>
            ) : null}
          </div>
          <span className="lp-doc-nodes-block__chevron" aria-hidden>{expanded ? "▾" : "▸"}</span>
        </button>
      </div>
      {expanded ? (
        <div className="lp-doc-nodes-block__body lp-doc-nodes-block__body--docs">
          {docs.map((doc) => renderDoc(doc))}
        </div>
      ) : null}
    </article>
  );
}
