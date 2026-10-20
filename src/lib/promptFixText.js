import { repairSplitAccents } from "./promptTextRepair.js";

const KEPT_BLOCK = /(<h1>[\s\S]*?<\/h1>|<ul>[\s\S]*?<\/ul>)/gi;
const LABEL = /(?<=^|\n|[ \t])((?!https?:)(?:[\p{Lu}][\p{L}\p{N}'’/-]*\s+){0,4}[\p{Lu}][\p{L}\p{N}'’/-]*:)/gu;
const MARK_ATOM = /(<strong>[\s\S]*?<\/strong>|<h1>[\s\S]*?<\/h1>|<mark>[\s\S]*?<\/mark>)/gi;

function plain(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ");
}

function canJoin(prev, next) {
  const left = plain(prev).replace(/[ \t]+$/g, "");
  const right = plain(next).replace(/^[ \t]+/g, "");
  if (!left.trim() || !right.trim()) return false;
  if (/[.!?:…]\s*$/.test(left)) return false;
  if (/^\s*(?:\d{1,2}[.)]\s+|[-–—]\s+)/.test(right)) return false;
  if (/^\s*\p{Ll}/u.test(right)) return true;
  if (/^\s*[\[\(\{]/.test(right)) return true;
  return false;
}

function joinBrokenLines(value) {
  const lines = String(value ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/[ \t]+$/g, "");
    if (!out.length) {
      out.push(line);
      continue;
    }
    const prev = out[out.length - 1];
    if (canJoin(prev, line)) {
      out[out.length - 1] = `${prev.replace(/[ \t]+$/g, "")} ${line.replace(/^[ \t]+/g, "")}`.replace(/[ \t]{2,}/g, " ");
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function splitListMarkers(value) {
  let text = String(value ?? "");
  text = text.replace(/^[-–—]\s+(?=[\p{Lu}][^\n]{0,40}:)/u, "");
  text = text.replace(/([^\n])[ \t]+(\d{1,2}[.)][ \t]+)/g, "$1\n$2");
  text = text.replace(/(\S)[ \t]+([-–—])[ \t]+(?=\S)/g, "$1\n$2 ");
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
}

function boldLabels(value) {
  MARK_ATOM.lastIndex = 0;
  LABEL.lastIndex = 0;
  return String(value ?? "").split(MARK_ATOM).map((part) => {
    if (/^<(strong|h1|mark)>/i.test(part)) return part;
    LABEL.lastIndex = 0;
    return part.replace(LABEL, "<strong>$1</strong>");
  }).join("");
}

/**
 * Fix Text: join wrapped sentences, put 1. / - items on their own lines,
 * bold short labels, repair split accents. Does not build bullets or variables.
 * @param {unknown} value
 */
export function fixPromptText(value) {
  const text = String(value ?? "");
  KEPT_BLOCK.lastIndex = 0;
  return text.split(KEPT_BLOCK).map((part) => {
    const repaired = repairSplitAccents(part);
    if (/^<h1>/i.test(part) || /^<ul>/i.test(part)) return repaired;
    return boldLabels(splitListMarkers(joinBrokenLines(repaired)));
  }).join("");
}
