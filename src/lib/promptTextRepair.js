const SPLIT_ACCENT = /(\p{L}) ([áéíóúüñÁÉÍÓÚÜÑ]) (?=\p{L})/gu;
const LIST_ITEM = /^[ \t]*(?:\d{1,2}[.)][ \t]+|[-–—][ \t]*)(\S.*)$/;

/**
 * Join a letter that the PDF split from its accent: "l ó gica" → "lógica".
 * @param {unknown} value
 */
export function repairSplitAccents(value) {
  return String(value ?? "").replace(SPLIT_ACCENT, "$1$2");
}

/**
 * Move a spaced dash onto the next line. A hyphen inside a word stays put.
 * @param {unknown} value
 */
export function breakBeforeDash(value) {
  return String(value ?? "").replace(/(\S)[ \t]+([-–—])/g, "$1\n$2");
}

/**
 * Turn consecutive numbered or dashed lines into one bullet list.
 * @param {unknown} value
 */
export function organizePlainLists(value) {
  const lines = String(value ?? "").split("\n");
  const out = [];
  let group = [];
  const flush = () => {
    if (!group.length) return;
    out.push(`<ul>${group.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    group = [];
  };
  for (const line of lines) {
    const match = line.match(LIST_ITEM);
    if (match) {
      group.push(match[1].trim());
      continue;
    }
    flush();
    out.push(line);
  }
  flush();
  return out.join("\n");
}

const KEPT_BLOCK = /(<h1>[\s\S]*?<\/h1>|<ul>[\s\S]*?<\/ul>)/gi;

/**
 * Repair accents, then turn plain lists into bullets.
 * An existing headline or bullet list stays a block.
 * @param {unknown} value
 */
export function repairPromptText(value) {
  const text = String(value ?? "");
  KEPT_BLOCK.lastIndex = 0;
  return text.split(KEPT_BLOCK).map((part) => {
    const repaired = repairSplitAccents(part);
    if (/^<h1>/i.test(part) || /^<ul>/i.test(part)) return repaired;
    return organizePlainLists(breakBeforeDash(repaired));
  }).join("");
}
