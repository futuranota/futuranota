import { useAnimatedText } from "../../hooks/useAnimatedText.js";

/**
 * Single-line typewriter text (same cadence as Intel Overview).
 * @param {{ text?: string, className?: string }} props
 */
export function AnimatedIntelLine({ text, className }) {
  const plain = (text || "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
  const animated = useAnimatedText(plain);
  if (!plain) return null;
  return <p className={className}>{animated || "\u00A0"}</p>;
}
