/** @param {RequestInfo} url @param {RequestInit} [init] */
export async function apiClient(url, init = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body ? body.slice(0, 200) : res.statusText;
    if (res.status === 404) {
      throw new Error(
        `API 404 en ${url}. `
        + "En local usá `npm run dev` (no vite preview). "
        + "En Vercel, verificá que exista api/analytics/*.js.",
      );
    }
    throw new Error(`API ${res.status} ${url}: ${detail}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
