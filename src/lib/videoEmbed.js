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

/** Normalize pasted URLs (missing protocol, mobile/music subdomains). */
export function normalizeVideoInputUrl(raw) {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  if (text.startsWith("undefined")) {
    text = text.slice("undefined".length).trim();
  }

  if (text.startsWith("<")) return text;

  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    text = `https://${text.replace(/^\/\//, "")}`;
  }

  return text;
}

function parseYouTube(input) {
  const text = normalizeVideoInputUrl(input);
  if (!text) return null;

  const iframeSrc = extractIframeSrc(text);
  const candidate = iframeSrc || text;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  let host = url.hostname.replace(/^www\./, "");
  if (host === "m.youtube.com" || host === "music.youtube.com") {
    host = "youtube.com";
  }

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
  const text = normalizeVideoInputUrl(input);
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
  const input = normalizeVideoInputUrl(raw);
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

export function buildVideoNodeContent(videoBlock, description = "", notes = "") {
  const embedSrc = normalizeEmbedSrcForPlayback(videoBlock?.embedSrc || "");
  return {
    kind: "embedded-video",
    provider: videoBlock?.provider || "unknown",
    videoId: videoBlock?.videoId || "",
    embedSrc,
    rawInput: videoBlock?.rawInput || "",
    description: description || "",
    notes: typeof notes === "string" ? notes : "",
  };
}

export function getVideoNodePayload(content) {
  let payload = content;
  if (typeof content === "string") {
    try {
      payload = JSON.parse(content);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object" || payload.kind !== "embedded-video") {
    return null;
  }
  return payload;
}

export function getVideoNodeNotes(content) {
  return getVideoNodePayload(content)?.notes || "";
}

/** Merge patch into embedded-video content while preserving other fields. */
export function mergeVideoNodeContent(content, patch = {}) {
  const base = getVideoNodePayload(content) || buildVideoNodeContent(null, "", "");
  const nextBlock = {
    rawInput: patch.rawInput ?? base.rawInput ?? "",
    provider: patch.provider ?? base.provider ?? "unknown",
    videoId: patch.videoId ?? base.videoId ?? "",
    embedSrc: patch.embedSrc ?? base.embedSrc ?? "",
  };
  return buildVideoNodeContent(
    nextBlock,
    patch.description ?? base.description ?? "",
    patch.notes ?? base.notes ?? "",
  );
}

export function resolveVideoEmbedFromNodeContent(content) {
  const payload = getVideoNodePayload(content);
  if (!payload) return null;
  const embedSrc = normalizeEmbedSrcForPlayback(payload.embedSrc);
  if (!isAllowedEmbedSrc(embedSrc)) return null;
  return { ...payload, embedSrc };
}
