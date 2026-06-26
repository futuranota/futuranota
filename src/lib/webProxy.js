import { API_ROUTES } from "../api/routes.js";

/**
 * Build reverse-proxy URL for iframe / fetch.
 * Requires Authorization header (iframe src alone cannot send it — use fetchProxiedPage).
 * @param {string} targetUrl
 */
export function buildWebProxyUrl(targetUrl) {
  const trimmed = (targetUrl || "").trim();
  if (!trimmed) return "";
  return `${API_ROUTES.webProxy}?url=${encodeURIComponent(trimmed)}`;
}

/**
 * Authenticated fetch of proxied HTML (strips X-Frame-Options / CSP upstream).
 * @param {string} targetUrl
 * @param {string} [accessToken]
 */
export async function fetchProxiedPage(targetUrl, accessToken) {
  const proxyUrl = buildWebProxyUrl(targetUrl);
  if (!proxyUrl) throw new Error("Missing article URL");

  const headers = { Accept: "text/html" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(proxyUrl, { headers });
  if (!res.ok) {
    let message = `Could not load page (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* html error body */
    }
    throw new Error(message);
  }

  const html = await res.text();
  if (!html.trim()) throw new Error("Empty page response");
  return html;
}

/**
 * Blob URL for iframe src after authenticated proxy fetch.
 * @param {string} html
 */
export function createProxiedPageBlobUrl(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  return URL.createObjectURL(blob);
}
