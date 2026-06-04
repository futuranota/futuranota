export function Mark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="2.2" y="2.2" width="27.6" height="27.6" rx="7.5" stroke="currentColor" strokeWidth="2.2" opacity="0.85" style={{ stroke: 'rgb(240, 209, 209)' }} />
      <path d="M8 21 L14 14.5 L18.5 18 L24 10.5" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="10.5" r="2.4" fill="var(--accent)" />
    </svg>
  );
}
