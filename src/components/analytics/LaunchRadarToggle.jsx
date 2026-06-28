import "../../styles/launch-radar-toggle.css";

/**
 * Skeuomorphic lever toggle — design by @sanbronliong (CodePen / Uiverse).
 * @param {{
 *   checked?: boolean;
 *   disabled?: boolean;
 *   onCheckedChange?: (checked: boolean) => void;
 *   id?: string;
 *   ariaLabel?: string;
 * }} props
 */
export function LaunchRadarToggle({
  checked = false,
  disabled = false,
  onCheckedChange,
  id = "launch-radar-toggle",
  ariaLabel = "Launch radar",
}) {
  return (
    <div className="launch-radar-toggle" data-on={checked ? "1" : "0"} data-disabled={disabled ? "1" : "0"}>
      <div className="toggle-container">
        <input
          id={id}
          className="toggle-input"
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          aria-label={ariaLabel}
        />
        <div className="toggle-handle-wrapper">
          <div className="toggle-handle">
            <div className="toggle-handle-knob" />
            <div className="toggle-handle-bar-wrapper">
              <div className="toggle-handle-bar" />
            </div>
          </div>
        </div>
        <div className="toggle-base">
          <div className="toggle-base-inside" />
        </div>
      </div>
    </div>
  );
}
