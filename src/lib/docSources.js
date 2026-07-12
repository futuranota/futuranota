/**
 * Macronode Source catalog — visual reference for where intel/content came from.
 * Assets live in public/uploads/source/
 */

/** @typedef {{ id: string, label: string, src: string }} DocSourceOption */

const SOURCE_DIR = "/uploads/source";

/** @type {DocSourceOption[]} */
export const DOC_SOURCE_OPTIONS = [
  { id: "article", label: "Article", src: `${SOURCE_DIR}/Article.svg` },
  { id: "book", label: "Book", src: `${SOURCE_DIR}/BookBookmark.svg` },
  { id: "books", label: "Books", src: `${SOURCE_DIR}/Books.svg` },
  { id: "discord", label: "Discord", src: `${SOURCE_DIR}/DiscordLogo.svg` },
  { id: "facebook", label: "Facebook", src: `${SOURCE_DIR}/FacebookLogo.svg` },
  { id: "figma", label: "Figma", src: `${SOURCE_DIR}/FigmaLogo.svg` },
  { id: "globe", label: "Web", src: `${SOURCE_DIR}/Globe.svg` },
  { id: "google", label: "Google", src: `${SOURCE_DIR}/GoogleLogo.png` },
  { id: "instagram", label: "Instagram", src: `${SOURCE_DIR}/InstagramLogo.svg` },
  { id: "search", label: "Search", src: `${SOURCE_DIR}/MagnifyingGlass.svg` },
  { id: "medium", label: "Medium", src: `${SOURCE_DIR}/MediumLogo.svg` },
  { id: "megaphone", label: "Ads / promo", src: `${SOURCE_DIR}/MegaphoneSimple.svg` },
  { id: "messenger", label: "Messenger", src: `${SOURCE_DIR}/MessengerLogo.svg` },
  { id: "openai", label: "OpenAI", src: `${SOURCE_DIR}/OpenAiLogo.svg` },
  { id: "pinterest", label: "Pinterest", src: `${SOURCE_DIR}/PinterestLogo.svg` },
  { id: "reddit", label: "Reddit", src: `${SOURCE_DIR}/RedditLogo.svg` },
  { id: "snapchat", label: "Snapchat", src: `${SOURCE_DIR}/SnapchatLogo.svg` },
  { id: "spotify", label: "Spotify", src: `${SOURCE_DIR}/SpotifyLogo.svg` },
  { id: "telegram", label: "Telegram", src: `${SOURCE_DIR}/TelegramLogo.svg` },
  { id: "threads", label: "Threads", src: `${SOURCE_DIR}/Threads.svg` },
  { id: "tiktok", label: "TikTok", src: `${SOURCE_DIR}/TiktokLogo.png` },
  { id: "whatsapp", label: "WhatsApp", src: `${SOURCE_DIR}/WhatsappLogo.svg` },
  { id: "x", label: "X", src: `${SOURCE_DIR}/XLogo.svg` },
  { id: "youtube", label: "YouTube", src: `${SOURCE_DIR}/YoutubeLogo.svg` },
  { id: "tv", label: "TV / media", src: `${SOURCE_DIR}/tv.svg` },
];

const BY_ID = new Map(DOC_SOURCE_OPTIONS.map((opt) => [opt.id, opt]));

/**
 * @param {string | null | undefined} sourceId
 * @returns {DocSourceOption | null}
 */
export function resolveDocSource(sourceId) {
  if (!sourceId) return null;
  return BY_ID.get(String(sourceId).trim().toLowerCase()) || null;
}

/**
 * @param {string | null | undefined} sourceId
 */
export function normalizeDocSourceId(sourceId) {
  if (sourceId == null || sourceId === "") return null;
  const id = String(sourceId).trim().toLowerCase();
  return BY_ID.has(id) ? id : null;
}
