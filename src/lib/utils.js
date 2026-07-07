/** Merge class names; falsy values are skipped. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
