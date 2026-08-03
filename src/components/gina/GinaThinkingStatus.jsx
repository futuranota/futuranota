/**
 * Cycling shimmer status while Gina waits on Groq / tools.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShimmeringText } from "./ShimmeringText.jsx";

const PHRASES_ES = [
  "Gina está pensando…",
  "Procesando tu mensaje…",
  "Revisando el contexto…",
  "Preparando la respuesta…",
  "Casi listo…",
];

const PHRASES_EN = [
  "Gina is thinking…",
  "Processing your message…",
  "Reviewing context…",
  "Generating a reply…",
  "Almost there…",
];

/**
 * @param {{
 *   locale?: string,
 *   phrases?: string[],
 *   cycleMs?: number,
 *   className?: string,
 *   ariaLabel?: string,
 * }} props
 */
export function GinaThinkingStatus({
  locale = "es",
  phrases,
  cycleMs = 2800,
  className,
  ariaLabel,
}) {
  const list = Array.isArray(phrases) && phrases.length
    ? phrases
    : (locale === "en" ? PHRASES_EN : PHRASES_ES);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
    if (list.length <= 1) return undefined;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % list.length);
    }, cycleMs);
    return () => clearInterval(id);
  }, [list, cycleMs]);

  const text = list[currentIndex] || list[0] || "";

  return (
    <div
      className={className || "gina-chat-card__thinking"}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel || text}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          <ShimmeringText
            text={text}
            startOnView={false}
            color="rgba(255,255,255,0.45)"
            shimmerColor="rgba(255,255,255,0.95)"
            duration={1.8}
            spread={1.6}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
