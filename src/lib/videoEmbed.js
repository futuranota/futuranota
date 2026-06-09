const ALLOWED_EMBED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
]);

export function isAllowedEmbedSrc(src) {
  if (!src) return false;
  try {
    const url = new URL(src);
    return ALLOWED_EMBED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractIframeSrc(raw) {
  const match = String(raw ?? "").match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function buildYouTubeEmbedSrc(videoId) {
  if (!videoId) return "";
  return `https://www.youtube.com/embed/${videoId}`;
}

function parseYouTube(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;

  const iframeSrc = extractIframeSrc(text);
  const candidate = iframeSrc || text;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/embed/")[1]?.split(/[/?#]/)[0] || "";
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/shorts/")[1]?.split(/[/?#]/)[0] || "";
    } else {
      videoId = url.searchParams.get("v") || "";
    }
  } else {
    return null;
  }

  if (!videoId) return null;

  return {
    provider: "youtube",
    videoId,
    embedSrc: buildYouTubeEmbedSrc(videoId),
  };
}

function parseVimeo(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;

  const iframeSrc = extractIframeSrc(text);
  const candidate = iframeSrc || text;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId = "";

  if (host === "player.vimeo.com" && url.pathname.startsWith("/video/")) {
    videoId = url.pathname.split("/video/")[1]?.split(/[/?#]/)[0] || "";
  } else if (host === "vimeo.com") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else {
    return null;
  }

  if (!videoId || !/^\d+$/.test(videoId)) return null;

  return {
    provider: "vimeo",
    videoId,
    embedSrc: `https://player.vimeo.com/video/${videoId}`,
  };
}

/**
 * Parse pasted URL or iframe snippet into a safe embed payload.
 * @param {string} raw
 */
export function parseVideoEmbedInput(raw) {
  const input = String(raw ?? "").trim();
  if (!input) {
    return {
      provider: "unknown",
      videoId: "",
      embedSrc: "",
      rawInput: "",
      error: null,
    };
  }

  const parsed = parseYouTube(input) || parseVimeo(input);
  if (!parsed) {
    return {
      provider: "unknown",
      videoId: "",
      embedSrc: "",
      rawInput: input,
      error: "Solo YouTube y Vimeo por ahora. Pega una URL o código embed válido.",
    };
  }

  if (!isAllowedEmbedSrc(parsed.embedSrc)) {
    return {
      provider: "unknown",
      videoId: "",
      embedSrc: "",
      rawInput: input,
      error: "Dominio de embed no permitido.",
    };
  }

  return {
    ...parsed,
    rawInput: input,
    error: null,
  };
}

/** Normalize legacy nocookie URLs for reliable iframe playback. */
export function normalizeEmbedSrcForPlayback(src) {
  if (!src) return "";
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "");
    if (
      (host === "youtube-nocookie.com" || host === "youtube.com")
      && url.pathname.startsWith("/embed/")
    ) {
      const videoId = url.pathname.split("/embed/")[1]?.split(/[/?#]/)[0] || "";
      if (videoId) return buildYouTubeEmbedSrc(videoId);
    }
  } catch {
    return src;
  }
  return src;
}

export function buildVideoNodeContent(videoBlock, description = "") {
  const embedSrc = normalizeEmbedSrcForPlayback(videoBlock?.embedSrc || "");
  return {
    kind: "embedded-video",
    provider: videoBlock?.provider || "unknown",
    videoId: videoBlock?.videoId || "",
    embedSrc,
    rawInput: videoBlock?.rawInput || "",
    description: description || "",
  };
}

export function resolveVideoEmbedFromNodeContent(content) {
  let payload = content;
  if (typeof content === "string") {
    try {
      payload = JSON.parse(content);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object") return null;
  if (payload.kind !== "embedded-video") return null;
  const embedSrc = normalizeEmbedSrcForPlayback(payload.embedSrc);
  if (!isAllowedEmbedSrc(embedSrc)) return null;
  return { ...payload, embedSrc };
}
