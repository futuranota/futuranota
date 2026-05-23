/** Placeholder — Parte 3 */
export function DocSyncBadge({ synced = true }) {
  if (synced) return null;
  return <span className="pill warn" style={{ fontSize: 9 }}>unsynced</span>;
}
