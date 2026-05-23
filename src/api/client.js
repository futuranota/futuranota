/** @param {RequestInfo} url @param {RequestInit} [init] */
export async function apiClient(url, init = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
