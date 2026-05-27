import { DOC_BLOCK_TYPES } from "./docBlocks.js";

export function getSlashTail(value) {
  const m = String(value ?? "").match(/(\/[^\n]*)$/);
  return m ? m[1] : null;
}

export function splitBodyForSlash(body) {
  const slash = getSlashTail(body);
  if (!slash) {
    return { prefix: String(body ?? ""), slash: null };
  }
  return {
    prefix: String(body ?? "").slice(0, body.length - slash.length),
    slash,
  };
}

export function parseSlashQuery(query) {
  const normalized = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (normalized === "h1") {
    return { type: DOC_BLOCK_TYPES.H1 };
  }

  if (normalized === "todo" || normalized === "to-do") {
    return { type: DOC_BLOCK_TYPES.TODO };
  }

  return null;
}
