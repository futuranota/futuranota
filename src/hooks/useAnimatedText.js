import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function useAnimatedText(text, delimiter = "") {
  const [cursor, setCursor] = useState(0);
  const prevTextRef = useRef(text);

  useEffect(() => {
    const prevText = prevTextRef.current;
    const startingCursor =
      prevText !== text && text.startsWith(prevText) ? cursor : 0;
    prevTextRef.current = text;

    if (prevText !== text && !text.startsWith(prevText)) {
      setCursor(0);
    }

    const parts = text.split(delimiter);
    const msPerUnit =
      delimiter === "" ? 20 :
      delimiter === " " ? 80 :
      120;
    const duration =
      delimiter === "" ? Math.max(8, (parts.length * msPerUnit) / 1000) :
      delimiter === " " ? Math.max(4, (parts.length * msPerUnit) / 1000) :
      Math.max(2, (parts.length * msPerUnit) / 1000);

    const controls = animate(startingCursor, parts.length, {
      duration,
      ease: "easeOut",
      onUpdate(latest) {
        setCursor(Math.floor(latest));
      },
    });

    return () => controls.stop();
  }, [text, delimiter]);

  return text.split(delimiter).slice(0, cursor).join(delimiter);
}
