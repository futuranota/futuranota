import { useEffect, useState } from "react";

/** Ghost hints overlay when body is exactly "/" — does not affect textarea layout. */
export function SlashGhostHints({ visible }) {
  const [ghostHint, setGhostHint] = useState("H1");

  useEffect(() => {
    if (!visible) {
      setGhostHint("H1");
      return;
    }
    setGhostHint("H1");
    const timer = setTimeout(() => setGhostHint("to-do"), 2000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="doc-slash-ghost-hints" aria-hidden>
      <span className="doc-slash-ghost-hints__prefix">/</span>
      <span className="doc-slash-ghost-hints__suffix">{ghostHint}</span>
    </div>
  );
}
