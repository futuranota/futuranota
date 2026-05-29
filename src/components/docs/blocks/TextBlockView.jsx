import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";

export function TextBlockView({
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  autoFocus = false,
  showPlaceholder = true,
  maxHeightPx = 520,
}) {
  return (
    <div className="doc-text-block">
      <SlashAwareTextarea
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        showPlaceholder={showPlaceholder}
        autoFocus={autoFocus}
        wrapClassName="doc-text-block__wrap"
        className="doc-text-block__field"
        minHeightPx={20}
        maxHeightPx={maxHeightPx}
      />
    </div>
  );
}
