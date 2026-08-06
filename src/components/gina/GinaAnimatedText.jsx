import { useEffect, useRef } from "react";
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

const LABEL_SPLIT_RE = /(\*\*(?:Nota|Por ejemplo|Note|For example):\*\*)/gi;
const LABEL_MATCH_RE = /^\*\*((?:Nota|Por ejemplo|Note|For example):)\*\*$/i;

/**
 * Render body text with **Nota:** / **Por ejemplo:** as bold labels.
 * @param {string} text
 */
function renderBodyWithLabels(text) {
  const raw = String(text || "");
  if (!raw) return null;
  if (!LABEL_SPLIT_RE.test(raw)) return raw;
  LABEL_SPLIT_RE.lastIndex = 0;
  const parts = raw.split(LABEL_SPLIT_RE);
  return parts.map((part, i) => {
    const m = part.match(LABEL_MATCH_RE);
    if (m) {
      return (
        <strong key={`lbl-${i}`} className="gina-chat-card__ai-label">
          {m[1]}
        </strong>
      );
    }
    return <span key={`t-${i}`}>{part}</span>;
  });
}

function stripMd(text) {
  return String(text || "").replace(/\*\*(.*?)\*\*/g, "$1");
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
 * @param {{ text?: string, plainBody?: boolean, onComplete?: () => void }} props
 */
export function GinaAiMessageText({ text, plainBody = false, onComplete }) {
  const source = String(text || "").trim();
  const split = plainBody ? null : splitGinaAiText(text);
  const headline = plainBody ? "" : (split?.headline || "");
  const body = plainBody ? "" : (split?.body || "");
  const bodyFirst = Boolean(!plainBody && split?.bodyFirst && body);
  const sep = body ? "\n" : "";
  const plainBodyText = plainBody ? stripMd(source) : body;
  const plainHead = headline;
  const full = plainBody
    ? plainBodyText
    : bodyFirst
      ? `${plainBodyText}${sep}${plainHead}`
      : `${plainHead}${sep}${plainBodyText}`;

  const animated = useAnimatedText(full);
  const done = !source || !full || animated.length >= full.length;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);

  useEffect(() => {
    if (!done || completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.();
  }, [done]);

  if (!source) return null;

  if (plainBody) {
    return (
      <span className="gina-chat-card__ai-text">
        <span className="gina-chat-card__ai-body gina-chat-card__ai-body--soft">
          {done && /\*\*/.test(source)
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
  const bodyHasLabels = /\*\*(?:Nota|Por ejemplo|Note|For example):/i.test(source);
  const bodyNode = bodyDone && bodyHasLabels
    ? renderBodyWithLabels(
      plainBodyText.replace(
        /(Nota:|Por ejemplo:|Note:|For example:)/g,
        (m) => `**${m}**`,
      ),
    )
    : bodyShown;

  return (
    <span className="gina-chat-card__ai-text">
      {bodyFirst ? (
        <>
          {showBody && bodyReady ? (
            <span className="gina-chat-card__ai-body">{bodyNode || "\u00A0"}</span>
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
            <span className="gina-chat-card__ai-body">{bodyNode || "\u00A0"}</span>
          ) : null}
        </>
      )}
    </span>
  );
}

export default GinaAnimatedText;
