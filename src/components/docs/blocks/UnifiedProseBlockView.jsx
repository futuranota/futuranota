import { useCallback } from "react";
import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";
import { splitBodyForSlash } from "../../../lib/docBlockSlash.js";

/**
 * Single prose surface for content docs (headline + body paragraphs).
 * Persists as H1 + TEXT blocks via parent onChange.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(text: string) => void} props.onChange
 * @param {(event: KeyboardEvent) => void} [props.onKeyDown]
 * @param {() => void} [props.onFocus]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.showPlaceholder]
 * @param {boolean} [props.autoFocus]
 */
export function UnifiedProseBlockView({
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder = "Headline\n\nWrite your content…",
  showPlaceholder = true,
  autoFocus = false,
}) {
  const handleKeyDown = useCallback((event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      const el = event.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const next = `${(el.value ?? "").slice(0, start)}\n${(el.value ?? "").slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, start + 1);
      });
      return;
    }

    if (event.key === "Escape") {
      const { slash } = splitBodyForSlash(event.currentTarget?.value ?? value);
      if (slash) {
        const { prefix } = splitBodyForSlash(event.currentTarget?.value ?? value);
        event.preventDefault();
        onChange(prefix);
        return;
      }
    }

    onKeyDown?.(event);
  }, [onChange, onKeyDown, value]);

  return (
    <div className="doc-unified-prose" data-doc-unified-prose>
      <SlashAwareTextarea
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        showPlaceholder={showPlaceholder}
        autoFocus={autoFocus}
        wrapClassName="doc-unified-prose__wrap"
        className="doc-unified-prose__field"
        minHeightPx={80}
        maxHeightPx={null}
        ariaLabel="Document content"
      />
    </div>
  );
}
