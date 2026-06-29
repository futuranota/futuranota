import { useEffect, useRef } from "react";
import { useAnimatedText } from "../../hooks/useAnimatedText.js";
import { renderReportMarkdownLine } from "./ReportMarkdownBody.jsx";

/**
 * Typewriter presentation for analyst strategic reports (Quicksand + linkified sources).
 * Uses the same char-by-char cadence as Intel Overview, with auto-scroll while writing.
 * @param {{ text: string, onComplete?: () => void }} props
 */
export function AnimatedReportText({ text, onComplete }) {
  const plain = (text || "").replace(/\*\*(.*?)\*\*/g, "$1");
  const animated = useAnimatedText(plain);
  const completedRef = useRef(false);
  const containerRef = useRef(null);

  const isComplete = Boolean(plain) && animated === plain;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const scrollParent = root.closest(".doc-new-content-scroll");
    if (scrollParent instanceof HTMLElement) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
      return;
    }

    root.scrollIntoView({ block: "end", behavior: "auto" });
  }, [animated]);

  useEffect(() => {
    if (!isComplete || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [isComplete, onComplete]);

  const lines = animated.split("\n");

  return (
    <div
      ref={containerRef}
      className="doc-analyst-report doc-analyst-report-animated"
      aria-live="polite"
    >
      {lines.map((line, i) => renderReportMarkdownLine(line, i, "a-", { imageScale: 1 }))
        .filter(Boolean)}
      {!isComplete ? <span className="doc-analyst-report-cursor" aria-hidden>|</span> : null}
    </div>
  );
}
