import { useEffect, useState } from "react";
import { DOC_SLASH_GHOST_HINTS } from "../../../lib/docBlockSlash.js";

/** Ghost hints overlay when body is exactly "/" — does not affect textarea layout. */
export function SlashGhostHints({ visible }) {
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    if (!visible) {
      setHintIndex(0);
      return;
    }
    setHintIndex(0);
    const interval = setInterval(() => {
      setHintIndex((i) => (i + 1) % DOC_SLASH_GHOST_HINTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const ghostHint = DOC_SLASH_GHOST_HINTS[hintIndex] ?? DOC_SLASH_GHOST_HINTS[0];

  return (
    <div className="doc-slash-ghost-hints" aria-hidden>
      <span className="doc-slash-ghost-hints__prefix">/</span>
      <span className="doc-slash-ghost-hints__suffix">{ghostHint}</span>
    </div>
  );
}
