import { useAnimatedText } from "../../hooks/useAnimatedText.js";

export function AnimatedOverviewText({ text }) {
  const plain = (text || "").replace(/\*\*(.*?)\*\*/g, "$1");
  const animated = useAnimatedText(plain);

  return (
    <div className="intel-overview-text">
      {animated.split("\n").map((line, i) => (
        <p key={i}>{line || "\u00A0"}</p>
      ))}
    </div>
  );
}
