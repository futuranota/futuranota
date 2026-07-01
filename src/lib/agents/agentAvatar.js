const UPLOADS_BASE = "/uploads";

/**
 * @param {string} filename
 */
export function agentAvatarSrc(filename) {
  return `${UPLOADS_BASE}/${filename}`;
}
