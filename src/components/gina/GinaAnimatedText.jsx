import { useAnimatedText } from "../../hooks/useAnimatedText.js";

/**
 * Split Gina AI copy into headline (through first ?) and descriptive body.
 * @param {string} text
 * @returns {{ headline: string, body: string }}
 */
export function splitGinaAiText(text) {
  const plain = String(text || "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
  if (!plain) return { headline: "", body: "" };

  const qIdx = plain.indexOf("?");
  if (qIdx >= 0) {
    return {
      headline: plain.slice(0, qIdx + 1).trim(),
      body: plain.slice(qIdx + 1).trim(),
    };
  }

  const sentence = plain.match(/^(.+?[.!?…])(\s+[\s\S]*)?$/u);
  if (sentence && sentence[2] && sentence[2].trim()) {
    return {
      headline: sentence[1].trim(),
      body: sentence[2].trim(),
    };
  }

  return { headline: plain, body: "" };
}

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

/**
 * AI reply with Inter Medium headline + Light body (textbox-example.svg).
 * @param {{ text?: string }} props
 */
export function GinaAiMessageText({ text }) {
  const { headline, body } = splitGinaAiText(text);
  const sep = body ? "\n" : "";
  const full = `${headline}${sep}${body}`;
  const animated = useAnimatedText(full);
  if (!headline && !body) return null;

  const headShown = animated.slice(0, Math.min(animated.length, headline.length));
  const bodyStart = headline.length + sep.length;
  const bodyShown = animated.length > bodyStart ? animated.slice(bodyStart) : "";

  return (
    <span className="gina-chat-card__ai-text">
      {headline ? (
        <span className="gina-chat-card__ai-headline">{headShown || "\u00A0"}</span>
      ) : null}
      {body ? (
        <>
          {headline && animated.length > headline.length ? "\n" : null}
          <span className="gina-chat-card__ai-body">{bodyShown || (animated.length > headline.length ? "\u00A0" : "")}</span>
        </>
      ) : null}
    </span>
  );
}

export default GinaAnimatedText;
