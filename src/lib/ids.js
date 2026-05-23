export function generateId(prefix = "ID") {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).slice(2, 11);
  return `${prefix}-${timestamp}${randomStr}`.toUpperCase();
}

/** @deprecated use generateId */
export function shortId(prefix = "ID") {
  const s = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${prefix}-${s}`;
}
