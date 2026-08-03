/**
 * Shimmer gradient text (adapted for Futura Nota — framer-motion + local cn).
 */
import { useMemo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "../../lib/utils.js";

/**
 * @param {{
 *   text: string,
 *   duration?: number,
 *   delay?: number,
 *   repeat?: boolean,
 *   repeatDelay?: number,
 *   className?: string,
 *   startOnView?: boolean,
 *   once?: boolean,
 *   inViewMargin?: string,
 *   spread?: number,
 *   color?: string,
 *   shimmerColor?: string,
 * }} props
 */
export function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2,
  color,
  shimmerColor,
}) {
  const ref = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const isInView = useInView(ref, { once, margin: inViewMargin });
  const dynamicSpread = useMemo(() => text.length * spread, [text, spread]);
  const shouldAnimate = !startOnView || isInView;

  return (
    <motion.span
      ref={ref}
      className={cn("gina-shimmer-text", className)}
      style={{
        "--spread": `${dynamicSpread}px`,
        ...(color ? { "--base-color": color } : null),
        ...(shimmerColor ? { "--shimmer-color": shimmerColor } : null),
      }}
      initial={{
        backgroundPosition: "100% center",
        opacity: 0,
      }}
      animate={
        shouldAnimate
          ? {
              backgroundPosition: "0% center",
              opacity: 1,
            }
          : {}
      }
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          duration,
          delay,
          repeatDelay,
          ease: "linear",
        },
        opacity: {
          duration: 0.3,
          delay,
        },
      }}
    >
      {text}
    </motion.span>
  );
}
