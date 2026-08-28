import { useState } from "react";

/**
 * Bouncy on/off switch (Magic UI–style). Controlled via checked + onChange.
 */
export function PremiumToggle({
  checked = false,
  onChange,
  label = "",
  "aria-label": ariaLabel,
  disabled = false,
  className = "",
}) {
  const [isPressed, setIsPressed] = useState(false);

  const handleToggle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };

  const wrapClass = [
    "premium-toggle-wrap",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapClass}>
      {label ? (
        <span
          className={
            "premium-toggle__label"
            + (checked ? " premium-toggle__label--on" : "")
          }
        >
          {label}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label || undefined}
        disabled={disabled}
        onClick={handleToggle}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        className={
          "premium-toggle"
          + (checked ? " premium-toggle--on" : "")
          + (isPressed ? " premium-toggle--pressed" : "")
        }
      >
        <span className="premium-toggle__glow" aria-hidden />
        <span className="premium-toggle__track-inner" aria-hidden />
        <span className="premium-toggle__thumb">
          <span className="premium-toggle__thumb-shine" aria-hidden />
          <span className="premium-toggle__thumb-highlight" aria-hidden />
          <span className="premium-toggle__dot" aria-hidden />
          <span
            key={checked ? "on" : "off"}
            className="premium-toggle__ripple"
            aria-hidden
          />
        </span>
      </button>
    </div>
  );
}
