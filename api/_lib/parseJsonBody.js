/**
 * Normalize Vercel / Node request bodies (object, string JSON, or empty).
 * @param {import('@vercel/node').VercelRequest | import('http').IncomingMessage} req
 * @returns {Record<string, unknown>}
 */
export function parseJsonBody(req) {
  const raw = req?.body;
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
