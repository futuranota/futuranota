/** Dual ingest: Cursor debug server + same-origin Vite middleware. */
export function agentDebugLog(payload) {
  const body = JSON.stringify({
    sessionId: "156d6a",
    timestamp: Date.now(),
    ...payload,
  });
  const headers = {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "156d6a",
  };
  fetch("http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f", {
    method: "POST",
    headers,
    body,
  }).catch(() => {});
  fetch("/__debug_agent_log", {
    method: "POST",
    headers,
    body,
  }).catch(() => {});
}
