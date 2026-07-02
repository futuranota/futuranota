import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function HeroAccentTypewriter({ texts, tinaProps }) {
  const reduceMotion = useReducedMotion();
  const lines = useMemo(
    () => (texts?.filter(Boolean).length ? texts.filter(Boolean) : ['You sell the cup.']),
    [texts],
  );
  const [lineIndex, setLineIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayText(lines[0] ?? '');
      return undefined;
    }

    const fullText = lines[lineIndex] ?? '';
    let timer;

    if (!isDeleting && displayText === fullText) {
      timer = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setLineIndex((i) => (i + 1) % lines.length);
    } else {
      timer = setTimeout(() => {
        setDisplayText((prev) =>
          isDeleting ? prev.slice(0, -1) : fullText.slice(0, prev.length + 1),
        );
      }, isDeleting ? 75 : 150);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, lineIndex, lines, reduceMotion]);

  return (
    <span className="hero__accent-type" {...tinaProps}>
      <span className="hero__accent-type__text accent-word" aria-live="polite">
        {displayText}
        {!reduceMotion && (
          <span className="hero__accent-type__cursor" aria-hidden="true">|</span>
        )}
      </span>
    </span>
  );
}
