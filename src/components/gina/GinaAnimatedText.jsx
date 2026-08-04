import { useAnimatedText } from "../../hooks/useAnimatedText.js";

/**
 * Split Gina AI copy: emphasis (question / title) vs deep description.
 * - Only a question or short title → all headline (white/bold).
 * - Question + prose after → question = headline, prose = body (gray/small).
 * - Prose then question → prose = body, question = headline (reading order via bodyFirst).
 * - `?` inside quotes does not count as the question boundary.
 * @param {string} text
 * @returns {{ headline: string, body: string, bodyFirst?: boolean }}
 */
export function splitGinaAiText(text) {
  const plain = String(text || "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
  if (!plain) return { headline: "", body: "" };

  const lastQ = findLastQuestionMarkOutsideQuotes(plain);
  if (lastQ >= 0) {
    const throughQ = plain.slice(0, lastQ + 1);
    const afterQ = plain.slice(lastQ + 1).trim();

    // Start of the question sentence (after prior . ! … or newline)
    let qStart = 0;
    for (let i = throughQ.length - 2; i >= 0; i -= 1) {
      const ch = throughQ[i];
      if (ch === "." || ch === "!" || ch === "…" || ch === "\n") {
        qStart = i + 1;
        break;
      }
    }
    while (qStart < throughQ.length && /\s/.test(throughQ[qStart])) qStart += 1;

    const question = throughQ.slice(qStart).trim();
    const before = throughQ.slice(0, qStart).trim();
    const after = afterQ;

    // Only the question (maybe short) → full emphasis
    if (!before && !after) {
      return { headline: question || plain, body: "" };
    }

    // Desc then question → show desc (gray) then question (white)
    if (before && !after) {
      return { headline: question, body: before, bodyFirst: true };
    }

    // Question then deep description → classic headline + body (title at start)
    if (!before && after) {
      return { headline: question, body: after };
    }

    // Both sides with a mid-question: treat as descriptive body only
    // (avoid promoting a mid-block line to white bold).
    return { headline: "", body: plain };
  }

  // No question: first sentence = title emphasis; rest = deep desc
  const sentence = plain.match(/^(.+?[.!…])(\s+[\s\S]*)?$/u);
  if (sentence && sentence[2] && sentence[2].trim()) {
    return {
      headline: sentence[1].trim(),
      body: sentence[2].trim(),
    };
  }

  return { headline: plain, body: "" };
}

/** Last `?` not inside "…" / '…' / “…” / ‘…’. */
function findLastQuestionMarkOutsideQuotes(text) {
  let inDouble = false;
  let inSingle = false;
  let inCurlyDouble = false;
  let inCurlySingle = false;
  let last = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "“") inCurlyDouble = true;
    else if (ch === "”") inCurlyDouble = false;
    else if (ch === "‘") inCurlySingle = true;
    else if (ch === "’" && inCurlySingle) inCurlySingle = false;
    else if (ch === '"' && !inSingle && !inCurlyDouble && !inCurlySingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble && !inCurlyDouble && !inCurlySingle) inSingle = !inSingle;
    else if (ch === "?" && !inDouble && !inSingle && !inCurlyDouble && !inCurlySingle) {
      last = i;
    }
  }
  return last;
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
 * AI reply: white/bold question·title + gray/small deep description.
 * @param {{ text?: string, plainBody?: boolean }} props
 */
export function GinaAiMessageText({ text, plainBody = false }) {
  const plain = String(text || "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
  if (!plain) return null;

  if (plainBody) {
    const animated = useAnimatedText(plain);
    return (
      <span className="gina-chat-card__ai-text">
        <span className="gina-chat-card__ai-body gina-chat-card__ai-body--soft">
          {animated || "\u00A0"}
        </span>
      </span>
    );
  }

  const { headline, body, bodyFirst } = splitGinaAiText(text);
  const sep = body ? "\n" : "";
  // Typewriter in reading order
  const full = bodyFirst && body
    ? `${body}${sep}${headline}`
    : `${headline}${sep}${body}`;
  const animated = useAnimatedText(full);
  if (!headline && !body) return null;

  let headShown = "";
  let bodyShown = "";
  if (bodyFirst && body) {
    bodyShown = animated.slice(0, Math.min(animated.length, body.length));
    const headStart = body.length + sep.length;
    headShown = animated.length > headStart ? animated.slice(headStart) : "";
  } else {
    headShown = animated.slice(0, Math.min(animated.length, headline.length));
    const bodyStart = headline.length + sep.length;
    bodyShown = animated.length > bodyStart ? animated.slice(bodyStart) : "";
  }

  const showBody = Boolean(body);
  const showHead = Boolean(headline);
  const bodyReady = bodyFirst
    ? animated.length > 0
    : animated.length > headline.length;
  const headReady = bodyFirst
    ? animated.length > body.length
    : animated.length > 0;

  return (
    <span className="gina-chat-card__ai-text">
      {bodyFirst ? (
        <>
          {showBody && bodyReady ? (
            <span className="gina-chat-card__ai-body">{bodyShown || "\u00A0"}</span>
          ) : null}
          {showHead && headReady ? (
            <span className="gina-chat-card__ai-headline">{headShown || "\u00A0"}</span>
          ) : null}
        </>
      ) : (
        <>
          {showHead && headReady ? (
            <span className="gina-chat-card__ai-headline">{headShown || "\u00A0"}</span>
          ) : null}
          {showBody && bodyReady ? (
            <span className="gina-chat-card__ai-body">{bodyShown || "\u00A0"}</span>
          ) : null}
        </>
      )}
    </span>
  );
}

export default GinaAnimatedText;
