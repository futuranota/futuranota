/** Slash tail must start a line (BOL or after newline) — shared by UI and block replace. */
export function getSlashTail(value) {
  const m = String(value ?? "").match(/(?:^|\n)(\/[^\n]*)$/);
  return m ? m[1] : null;
}

export function splitBodyForSlash(body) {
  const text = String(body ?? "");
  const slash = getSlashTail(text);
  if (!slash) {
    return { prefix: text, slash: null };
  }
  return {
    prefix: text.slice(0, text.length - slash.length),
    slash,
  };
}
