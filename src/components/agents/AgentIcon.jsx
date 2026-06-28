/**
 * @param {{ variant?: "orchestrator" | "analyst" | string, className?: string }} props
 */
export function AgentIcon({ variant = "orchestrator", className = "" }) {
  if (variant === "analyst") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="15" r="1.25" fill="currentColor" />
        <circle cx="11" cy="11" r="1.25" fill="currentColor" />
        <circle cx="14" cy="13" r="1.25" fill="currentColor" />
        <circle cx="18" cy="7" r="1.25" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
