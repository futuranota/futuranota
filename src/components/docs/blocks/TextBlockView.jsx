import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";

export function TextBlockView({
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoFocus = false,
  showPlaceholder = true,
}) {
  return (
    <div className="doc-text-block">
      <SlashAwareTextarea
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        showPlaceholder={showPlaceholder}
        autoFocus={autoFocus}
        wrapClassName="doc-text-block__wrap"
        className="doc-text-block__field"
        minHeightPx={20}
        maxHeightPx={9999}
      />
    </div>
  );
}
