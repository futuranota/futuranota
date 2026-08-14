import { useEffect, useRef } from "react";
import { useAnimatedText } from "../../hooks/useAnimatedText.js";
import { startGinaTypingSound, stopGinaTypingSound } from "../../lib/ginaTypingSound.js";
import { GinaStrikeHoursPhrase } from "./GinaStrikeHoursExample.jsx";

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

    if (!before && !after) {
      return { headline: question || plain, body: "" };
    }

    if (before && !after) {
      return { headline: question, body: before, bodyFirst: true };
    }

    if (!before && after) {
      return { headline: question, body: after };
    }

    return { headline: "", body: plain };
  }

  // Short title line ending with ":" (e.g. "Horario de Hoy:") → headline + body.
  const colonTitle = plain.match(/^([^\n.!?]{1,80}:)\s*\n+([\s\S]+)$/u);
  if (colonTitle && colonTitle[2].trim()) {
    return {
      headline: colonTitle[1].trim(),
      body: colonTitle[2].trim(),
    };
  }

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
 * Render body text with **bold** labels and [[strike:phrase]] hash+strikethrough.
 * @param {string} text
 */
function renderBodyWithLabels(text) {
  const raw = String(text || "");
  if (!raw) return null;
  const rich = /\*\*[^*]+\*\*/.test(raw) || /\[\[strike:/.test(raw);
  if (!rich) return raw;
  const chunks = raw.split(/(\*\*[^*]+\*\*|\[\[strike:.+?\]\])/g);
  return chunks.map((part, i) => {
    const strike = part.match(/^\[\[strike:(.+?)\]\]$/);
    if (strike) {
      return <GinaStrikeHoursPhrase key={`st-${i}`} phrase={strike[1]} />;
    }
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={`lbl-${i}`} className="gina-chat-card__ai-label">
          {m[1]}
        </strong>
      );
    }
    return part ? <span key={`t-${i}`}>{part}</span> : null;
  });
}

function stripMd(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[\[strike:(.+?)\]\]/g, "$1");
}

/**
 * Same typewriter cadence as Intel Overview / AnimatedIntelLine.
 * @param {{ text?: string, className?: string }} props
 */
export function GinaAnimatedText({ text, className }) {
  const plain = stripMd(text).trim();
  const animated = useAnimatedText(plain);
  if (!plain) return null;
  return <span className={className}>{animated || "\u00A0"}</span>;
}

/**
 * AI reply: white/bold question·title + gray/small deep description.
 * Labels like **Nota:** stay bold inside the body once typing finishes.
 * @param {{ text?: string, plainBody?: boolean, onComplete?: () => void, instant?: boolean, pace?: "normal" | "slow" | "fast" }} props
 */
export function GinaAiMessageText({
  text,
  plainBody = false,
  onComplete,
  instant = false,
  pace = "normal",
  headlineIcon = null,
}) {
  const source = String(text || "").trim();
  const split = plainBody ? null : splitGinaAiText(text);
  const headline = plainBody ? "" : (split?.headline || "");
  const body = plainBody ? "" : (split?.body || "");
  const bodyFirst = Boolean(!plainBody && split?.bodyFirst && body);
  const sep = body ? "\n" : "";
  const plainBodyText = stripMd(plainBody ? source : body);
  const plainHead = stripMd(headline);
  const full = plainBody
    ? plainBodyText
    : bodyFirst
      ? `${plainBodyText}${sep}${plainHead}`
      : `${plainHead}${sep}${plainBodyText}`;

  const animatedHook = useAnimatedText(instant ? "" : full, "", { pace });
  const animated = instant ? full : animatedHook;
  const done = instant || !source || !full || animated.length >= full.length;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);

  useEffect(() => {
    if (!source || !full) return undefined;
    if (done) return undefined;
    startGinaTypingSound();
    return () => stopGinaTypingSound();
  }, [source, full, done]);

  useEffect(() => {
    if (!done || completedRef.current) return;
    stopGinaTypingSound();
    completedRef.current = true;
    onCompleteRef.current?.();
  }, [done]);

  if (!source) return null;

  if (plainBody) {
    return (
      <span className="gina-chat-card__ai-text">
        <span className="gina-chat-card__ai-body gina-chat-card__ai-body--soft">
          {done && (/\[\[strike:/.test(source) || /\*\*/.test(source))
            ? renderBodyWithLabels(source)
            : (animated || "\u00A0")}
        </span>
      </span>
    );
  }

  if (!headline && !body) return null;

  let headShown = "";
  let bodyShown = "";
  if (bodyFirst && body) {
    bodyShown = animated.slice(0, Math.min(animated.length, plainBodyText.length));
    const headStart = plainBodyText.length + sep.length;
    headShown = animated.length > headStart ? animated.slice(headStart) : "";
  } else {
    headShown = animated.slice(0, Math.min(animated.length, plainHead.length));
    const bodyStart = plainHead.length + sep.length;
    bodyShown = animated.length > bodyStart ? animated.slice(bodyStart) : "";
  }

  const showBody = Boolean(body);
  const showHead = Boolean(headline);
  const bodyReady = bodyFirst
    ? animated.length > 0
    : animated.length > plainHead.length;
  const headReady = bodyFirst
    ? animated.length > plainBodyText.length
    : animated.length > 0;

  const bodyDone = bodyShown.length >= plainBodyText.length;
  const bodyHasLabels = /\*\*(?:Nota|Por ejemplo|Note|For example):/i.test(source)
    || /\[\[strike:/.test(source);
  const labeledBody = String(body || "").replace(
    /(Nota:|Por ejemplo:|Note:|For example:)/g,
    (m) => `**${m}**`,
  );
  const bodyNode = bodyDone && bodyHasLabels
    ? renderBodyWithLabels(labeledBody)
    : bodyShown;

  const headlineNode = (
    <span className={
      "gina-chat-card__ai-headline"
      + (headlineIcon === "search" ? " gina-chat-card__ai-headline--search" : "")
    }
    >
      {headlineIcon === "search" ? (
        <span className="gina-chat-card__searching-icon gina-chat-card__searching-icon--static" aria-hidden />
      ) : null}
      {headShown || "\u00A0"}
    </span>
  );

  return (
    <span className="gina-chat-card__ai-text">
      {bodyFirst ? (
        <>
          {showBody && bodyReady ? (
            <span className="gina-chat-card__ai-body">{bodyNode || "\u00A0"}</span>
          ) : null}
          {showHead && headReady ? headlineNode : null}
        </>
      ) : (
        <>
          {showHead && headReady ? headlineNode : null}
          {showBody && bodyReady ? (
            <span className="gina-chat-card__ai-body">{bodyNode || "\u00A0"}</span>
          ) : null}
        </>
      )}
    </span>
  );
}

export default GinaAnimatedText;
