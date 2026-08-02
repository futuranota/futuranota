import { useAnimatedText } from "../../hooks/useAnimatedText.js";

/**
 * Same typewriter cadence as Intel Overview / AnimatedIntelLine.
 * @param {{ text?: string, className?: string }} props
 */
export function GinaAnimatedText({ text, className }) {
  const plain = (text || "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
  const animated = useAnimatedText(plain);
  if (!plain) return null;
  return <span className={className}>{animated || "\u00A0"}</span>;
}

export default GinaAnimatedText;
