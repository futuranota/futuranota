const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
]);

const PRIVATE_IPV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/;

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; FuturaNota/1.0; +https://futuranota.com)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * @param {string} raw
 */
export function parseProxyTargetUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) throw new Error("url query parameter is required");

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    try {
      parsed = new URL(`https://${trimmed}`);
    } catch {
      throw new Error("Invalid url parameter");
    }
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error("Target host is not allowed");
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Target host is not allowed");
  }
  if (PRIVATE_IPV4.test(parsed.hostname)) {
    throw new Error("Private network URLs are not allowed");
  }

  return parsed.toString();
}

/**
 * @param {string} html
 * @param {string} targetUrl
 */
export function sanitizeHtmlForEmbed(html, targetUrl) {
  const baseHref = new URL(targetUrl).href;

  let out = (html || "")
    .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']referrer["'][^>]*>/gi, "");

  const baseTag = `<base href="${baseHref}">`;
  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else if (/<html[\s>]/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  } else {
    out = `<!DOCTYPE html><html><head>${baseTag}</head><body>${out}</body></html>`;
  }

  return out;
}

/**
 * @param {string} targetUrl
 */
export async function fetchProxiedHtml(targetUrl) {
  const res = await fetch(targetUrl, {
    headers: FETCH_HEADERS,
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Upstream returned ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("Target URL did not return HTML");
  }

  const html = await res.text();
  if (!html.trim()) {
    throw new Error("Empty HTML response");
  }

  return sanitizeHtmlForEmbed(html, targetUrl);
}

/**
 * @param {{ url?: string }} query
 */
export async function processWebProxyRequest(query = {}) {
  const targetUrl = parseProxyTargetUrl(typeof query.url === "string" ? query.url : "");
  const html = await fetchProxiedHtml(targetUrl);
  return {
    status: 200,
    html,
    contentType: "text/html; charset=utf-8",
    targetUrl,
  };
}
