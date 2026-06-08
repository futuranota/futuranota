import { useAnimatedText } from "../../hooks/useAnimatedText.js";
import { useTranslatedText } from "../../hooks/useTranslatedText.js";

export function AnimatedOverviewText({ text }) {
  const translated = useTranslatedText(text);
  const plain = (translated || "").replace(/\*\*(.*?)\*\*/g, "$1");
  const animated = useAnimatedText(plain);

  return (
    <div className="intel-overview-text">
      {animated.split("\n").map((line, i) => (
        <p key={i}>{line || "\u00A0"}</p>
      ))}
    </div>
  );
}
