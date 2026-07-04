import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCodeSnippet } from "../../../lib/highlightCodeSnippet.js";

/** @type {import("react-markdown").Components} */
const MARKDOWN_COMPONENTS = {
  a({ href, children, ...props }) {
    const isExternal = href && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      >
        {children}
      </a>
    );
  },
  pre({ children, ...props }) {
    return (
      <pre className="doc-markdown-preview__pre" {...props}>
        {children}
      </pre>
    );
  },
  code({ children, className, ...props }) {
    const match = /language-([\w-]+)/.exec(className || "");
    if (match) {
      const language = match[1];
      const source = String(children).replace(/\n$/, "");
      const html = highlightCodeSnippet(source, language);
      return (
        <code
          className={`doc-markdown-preview__code hljs ${className || ""}`.trim()}
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
      );
    }
    return (
      <code className="doc-markdown-preview__inline-code" {...props}>
        {children}
      </code>
    );
  },
  table({ children, ...props }) {
    return (
      <div className="doc-markdown-preview__table-wrap">
        <table className="doc-markdown-preview__table" {...props}>
          {children}
        </table>
      </div>
    );
  },
  img({ src, alt, ...props }) {
    return (
      <figure className="doc-markdown-preview__figure">
        <img
          className="doc-markdown-preview__img"
          src={src}
          alt={alt || ""}
          draggable={false}
          {...props}
        />
      </figure>
    );
  },
};

/**
 * GFM markdown preview (headings, tables, lists, code fences, etc.).
 * @param {{ source: string, className?: string }} props
 */
export function MarkdownPreview({ source, className = "" }) {
  const rootClass = ["doc-markdown-preview", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {source || ""}
      </Markdown>
    </div>
  );
}
