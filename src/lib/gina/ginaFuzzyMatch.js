/**
 * Soft fuzzy / phonetic matching for Gina intents and live names.
 * Handles typos (Departamenos ≈ departamentos) and light ES phonetics (b↔v).
 */

import { foldGinaText } from "./ginaTimeScope.js";

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  /** @type {number[]} */
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    /** @type {number[]} */
    const cur = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    prev = cur;
  }
  return prev[t.length];
}

/**
 * Accent-fold + light Spanish phonetic normalize for comparison.
 * @param {string} s
 */
export function phoneticFoldEs(s) {
  let out = foldGinaText(s);
  if (!out) return "";
  // Silent h
  out = out.replace(/h/g, "");
  // qu / c(+aou) → k ; ch kept as digraph → x-ish then collapsed via later rules
  out = out.replace(/ch/g, "x");
  out = out.replace(/qu/g, "k");
  out = out.replace(/c(?=[aou])/g, "k");
  // b ↔ v
  out = out.replace(/v/g, "b");
  // y ↔ i (as vowel/glide)
  out = out.replace(/y/g, "i");
  // Collapse repeated letters from normalize (bb from bv paths)
  out = out.replace(/(.)\1+/g, "$1");
  return out;
}

/**
 * Max edit distance allowed for near-match by token length.
 * @param {number} len
 */
export function nearMatchMaxDistance(len) {
  if (len < 4) return 0;
  if (len >= 7) return 2;
  return 1;
}

/**
 * True when tokens are exact, phonetically equal, or within edit distance.
 * Short tokens (<4) only match exact / phonetic-equal.
 * @param {string} a
 * @param {string} b
 */
export function nearMatchToken(a, b) {
  const left = foldGinaText(a);
  const right = foldGinaText(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const pLeft = phoneticFoldEs(left);
  const pRight = phoneticFoldEs(right);
  if (pLeft && pRight && pLeft === pRight) return true;

  const len = Math.max(left.length, right.length);
  const maxDist = nearMatchMaxDistance(Math.min(left.length, right.length));
  if (maxDist <= 0) return false;
  if (Math.abs(left.length - right.length) > maxDist) {
    // Still allow phonetic distance for b/v length-stable pairs
    if (Math.abs(pLeft.length - pRight.length) > maxDist) return false;
    return editDistance(pLeft, pRight) <= maxDist;
  }
  if (editDistance(left, right) <= maxDist) return true;
  if (pLeft && pRight && editDistance(pLeft, pRight) <= maxDist) return true;
  // Long prefix: Departame… vs departamentos
  if (len >= 8) {
    const soft = Math.max(6, Math.min(left.length, right.length) - 2);
    if (left.slice(0, soft) === right.slice(0, soft)) return true;
    if (pLeft.slice(0, soft) === pRight.slice(0, soft)) return true;
  }
  return false;
}

/**
 * Tokenize folded utterance into words.
 * @param {string} text
 */
export function tokenizeGinaText(text) {
  return foldGinaText(text)
    .replace(/[¿?¡!.,;:]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * True if any utterance token near-matches any candidate vocabulary token.
 * @param {string} text
 * @param {string[]} candidates
 */
export function textHasNearToken(text, candidates) {
  const toks = tokenizeGinaText(text);
  if (!toks.length || !Array.isArray(candidates) || !candidates.length) return false;
  const cands = candidates.map((c) => foldGinaText(c)).filter(Boolean);
  for (const tok of toks) {
    for (const cand of cands) {
      if (nearMatchToken(tok, cand)) return true;
    }
  }
  return false;
}

/**
 * True if folded text includes a near-phrase (space-separated), allowing
 * per-token near-match.
 * @param {string} text
 * @param {string[]} phrases
 */
export function textHasNearPhrase(text, phrases) {
  const toks = tokenizeGinaText(text);
  if (!toks.length || !Array.isArray(phrases)) return false;
  for (const phrase of phrases) {
    const parts = tokenizeGinaText(phrase);
    if (!parts.length) continue;
    if (parts.length === 1) {
      if (textHasNearToken(text, parts)) return true;
      continue;
    }
    for (let i = 0; i <= toks.length - parts.length; i += 1) {
      let ok = true;
      for (let j = 0; j < parts.length; j += 1) {
        if (!nearMatchToken(toks[i + j], parts[j])) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
  }
  return false;
}
