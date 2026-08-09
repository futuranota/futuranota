import { useEffect, useRef, useState } from "react";
import { useAnimatedText } from "../../hooks/useAnimatedText.js";
import { playGinaHighlightsSound } from "../../lib/ginaHighlightsSound.js";
import { startGinaTypingSound, stopGinaTypingSound } from "../../lib/ginaTypingSound.js";

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   mode: "hidden" | "typing" | "done",
 *   highlighted: boolean,
 *   onTyped?: () => void,
 * }} props
 */
function StartDocLine({ label, value, mode, highlighted, onTyped }) {
  const full = `${label}: ${value}`;
  const shouldType = mode === "typing";
  // Slightly quicker than bubble "slow" — still readable, not a race.
  const animated = useAnimatedText(shouldType ? full : "", "", { pace: "normal" });
  const shown = mode === "done" ? full : (shouldType ? animated : "");
  const done = mode === "done" || (shouldType && shown.length >= full.length);
  const onTypedRef = useRef(onTyped);
  onTypedRef.current = onTyped;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [full, mode]);

  useEffect(() => {
    if (!shouldType || done) return undefined;
    startGinaTypingSound();
    return () => stopGinaTypingSound();
  }, [shouldType, done, full]);

  useEffect(() => {
    if (mode !== "typing" || !done || firedRef.current) return;
    firedRef.current = true;
    stopGinaTypingSound();
    onTypedRef.current?.();
  }, [mode, done]);

  if (mode === "hidden") return null;

  const labelPrefix = `${label}:`;
  const typedLabelLen = Math.min(shown.length, labelPrefix.length);
  const labelShown = shown.slice(0, typedLabelLen);
  const valueShown = shown.length > labelPrefix.length
    ? shown.slice(labelPrefix.length)
    : "";

  return (
    <p
      className={
        "gina-chat-card__start-doc-line"
        + (highlighted ? " is-highlighted" : "")
      }
    >
      {mode === "done" ? (
        <>
          <strong className="gina-chat-card__ai-label">{label}:</strong>
          {" "}
          {value}
        </>
      ) : (
        <>
          <span>{labelShown || "\u00A0"}</span>
          <span>{valueShown}</span>
        </>
      )}
    </p>
  );
}

/**
 * Sequential reveal for Documento de inicio / Departamento / Tiempo asignado.
 * Each completed line plays highlights.mp3 and gets a soft green flash.
 * @param {{
 *   lines?: { label: string, value: string }[],
 *   instant?: boolean,
 *   onComplete?: () => void,
 * }} props
 */
export function GinaStartDocReveal({ lines = [], instant = false, onComplete }) {
  const rows = Array.isArray(lines) ? lines.filter((r) => r && String(r.label || "").trim()) : [];
  const key = rows.map((r) => `${r.label}|${r.value}`).join(";;");
  const [activeIndex, setActiveIndex] = useState(instant ? rows.length : 0);
  const [highlighted, setHighlighted] = useState(() => rows.map(() => Boolean(instant)));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    setActiveIndex(instant ? rows.length : 0);
    setHighlighted(rows.map(() => Boolean(instant)));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes rows
  }, [key, instant]);

  useEffect(() => {
    if (!rows.length) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }
    if (activeIndex < rows.length) return;
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current?.();
  }, [activeIndex, rows.length]);

  if (!rows.length) return null;

  return (
    <div className="gina-chat-card__start-doc" aria-live="polite">
      {rows.map((row, idx) => {
        let mode = "hidden";
        if (instant || idx < activeIndex) mode = "done";
        else if (idx === activeIndex) mode = "typing";
        return (
          <StartDocLine
            key={`${row.label}-${idx}`}
            label={String(row.label)}
            value={String(row.value || "")}
            mode={mode}
            highlighted={Boolean(highlighted[idx])}
            onTyped={() => {
              void playGinaHighlightsSound();
              setHighlighted((prev) => {
                const next = prev.slice();
                next[idx] = true;
                return next;
              });
              window.setTimeout(() => {
                setActiveIndex((v) => Math.max(v, idx + 1));
              }, 280);
            }}
          />
        );
      })}
    </div>
  );
}

export default GinaStartDocReveal;
