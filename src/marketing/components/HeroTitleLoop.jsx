import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const LOOP_TRANSITION = { duration: 0.9, ease: [0.22, 1, 0.36, 1] };

/**
 * Hero title — two lines:
 *   They launch the {subject}
 *   {accent phrase} (animated)
 */
export function HeroTitleLoop({ lines, intervalMs = 5200, className = '' }) {
  const reduceMotion = useReducedMotion();
  const safeLines = useMemo(
    () => (lines?.length ? lines : [{ subject: 'coffee', bracket: 'You sell the cup.' }]),
    [lines],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || safeLines.length < 2) return undefined;
    const id = setTimeout(() => {
      setIndex((i) => (i >= safeLines.length - 1 ? 0 : i + 1));
    }, intervalMs);
    return () => clearTimeout(id);
  }, [index, intervalMs, reduceMotion, safeLines.length]);

  const active = safeLines[index] ?? safeLines[0];

  return (
    <h1 className={`hero__title hero__title--loop ${className}`.trim()}>
      <span className="hero__title-line hero__title-line--lead">
        They launch the {active.subject}
      </span>
      <span className="hero__title-line hero__title-line--accent">
        <span className="hero__loop-slot" aria-live="polite">
          {safeLines.map((line, i) => (
            <motion.span
              key={`${line.subject}-${line.bracket}`}
              className="hero__loop-word accent-word"
              initial={{ opacity: 0, y: '-100%' }}
              animate={
                reduceMotion
                  ? index === i
                    ? { y: 0, opacity: 1 }
                    : { opacity: 0, pointerEvents: 'none' }
                  : index === i
                    ? { y: 0, opacity: 1 }
                    : { y: index > i ? -80 : 80, opacity: 0 }
              }
              transition={reduceMotion ? { duration: 0 } : LOOP_TRANSITION}
              aria-hidden={index !== i}
            >
              {line.bracket}
            </motion.span>
          ))}
        </span>
      </span>
    </h1>
  );
}
