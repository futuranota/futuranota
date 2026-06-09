/** Animated hamburger ↔ close icon for mobile nav. */
export function MenuToggleIcon({ open, className = '', duration = 300 }) {
  const ms = `${duration}ms`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <line
        x1="4"
        y1="7"
        x2="20"
        y2="7"
        style={{
          transformOrigin: '12px 7px',
          transition: `transform ${ms} ease, opacity ${ms} ease`,
          transform: open ? 'translateY(5px) rotate(45deg)' : 'none',
        }}
      />
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        style={{
          transition: `opacity ${ms} ease`,
          opacity: open ? 0 : 1,
        }}
      />
      <line
        x1="4"
        y1="17"
        x2="20"
        y2="17"
        style={{
          transformOrigin: '12px 17px',
          transition: `transform ${ms} ease, opacity ${ms} ease`,
          transform: open ? 'translateY(-5px) rotate(-45deg)' : 'none',
        }}
      />
    </svg>
  );
}
