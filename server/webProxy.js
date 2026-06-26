const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
]);

const PRIVATE_IPV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/;
const UPSTREAM_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
  + "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** @type {Map<string, { html: string, expires: number }>} */
const htmlCache = new Map();

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

/** @param {string} contentType @param {string} html */
function looksLikeHtml(contentType, html) {
  if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
    return true;
  }
  const head = (html || "").trim().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

/**
 * @param {string} targetUrl
 */
async function fetchUpstreamHtml(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}`);
    }

    const html = await res.text();
    if (!html.trim()) {
      throw new Error("Empty HTML response");
    }

    const contentType = res.headers.get("content-type") || "";
    if (!looksLikeHtml(contentType, html)) {
      throw new Error("Target URL did not return HTML");
    }

    return html;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Upstream request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} targetUrl
 */
export async function fetchProxiedHtml(targetUrl) {
  const cached = htmlCache.get(targetUrl);
  if (cached && cached.expires > Date.now()) {
    return cached.html;
  }

  const raw = await fetchUpstreamHtml(targetUrl);
  const html = sanitizeHtmlForEmbed(raw, targetUrl);

  htmlCache.set(targetUrl, { html, expires: Date.now() + CACHE_TTL_MS });
  if (htmlCache.size > 100) {
    const oldest = htmlCache.keys().next().value;
    if (oldest) htmlCache.delete(oldest);
  }

  return html;
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
