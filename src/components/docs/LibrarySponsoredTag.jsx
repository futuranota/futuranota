/**
 * Small "Ad" chip for sponsored / paid-placement library fichas.
 */
export function LibrarySponsoredTag({ label = "Ad", className = "" }) {
  const extra = String(className || "").trim();
  return (
    <span
      className={`library-sponsored-tag${extra ? ` ${extra}` : ""}`}
    >
      {label}
    </span>
  );
}
