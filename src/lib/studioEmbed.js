import { parseVideoEmbedInput } from "./videoEmbed.js";

/**
 * Studio accepts Vimeo only (YouTube stays on the Intel YouTube tab).
 * @param {string} raw
 */
export function parseStudioVimeoInput(raw) {
  const parsed = parseVideoEmbedInput(raw);
  if (!parsed.rawInput && !parsed.embedSrc) {
    return parsed;
  }
  if (parsed.error) return parsed;
  if (parsed.provider !== "vimeo" || !parsed.embedSrc) {
    return {
      provider: "unknown",
      videoId: "",
      embedSrc: "",
      rawInput: parsed.rawInput || String(raw || "").trim(),
      error: "STUDIO_VIMEO_ONLY",
    };
  }
  return parsed;
}
