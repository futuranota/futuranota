/**
 * Voice edit commands during Gina dictation (Web Speech).
 *
 * Mode B — targeted delete:
 *   1) Say “borrar” alone → arms delete-phrase mode
 *   2) Say the fragment to remove → fuzzy-match in buffer → delete
 *   Cancel with “cancelar”
 *
 * Also keeps shortcuts: borrame dos palabras / esta oración / todo.
 * Soft-R aliases: borame/vorame → borrame, borar → borrar.
 */

/**
 * @typedef {'delete_words' | 'delete_sentence' | 'delete_all' | 'arm_delete_phrase'} SpeechEditAction
 * @typedef {{ action: SpeechEditAction, count?: number }} SpeechEditCommand
 * @typedef {{ command: SpeechEditCommand, consume: number, remainder: string }} SpeechEditMatch
 */

const DELETE_VERBS = new Set([
  "borra",
  "borrar",
  "borrame",
  "borreme",
  "borralo",
  "borrala",
  "borrale",
  "borren",
  "quita",
  "quitame",
  "quiteme",
  "quitalo",
  "elimina",
  "eliminame",
  "delete",
  "remove",
  "clear",
]);

/** Verbs that alone arm Mode B (say what to delete next). */
const ARM_DELETE_VERBS = new Set([
  "borra",
  "borrar",
  "borrame",
  "borreme",
  "delete",
  "remove",
]);

/**
 * Soft R / B↔V from STT → canonical borr*.
 */
const DELETE_VERB_ALIASES = {
  borame: "borrame",
  boram: "borrame",
  bora: "borra",
  bore: "borra",
  borar: "borrar",
  vorame: "borrame",
  voram: "borrame",
  vorrame: "borrame",
  vorreme: "borrame",
  vorra: "borra",
  vora: "borra",
  vorar: "borrar",
  forame: "borrame",
  forra: "borra",
  forrame: "borrame",
  forar: "borrar",
};

const NUMBER_WORDS = {
  una: 1,
  un: 1,
  uno: 1,
  one: 1,
  "1": 1,
  dos: 2,
  two: 2,
  "2": 2,
  tres: 3,
  three: 3,
  "3": 3,
  cuatro: 4,
  four: 4,
  "4": 4,
  cinco: 5,
  five: 5,
  "5": 5,
  seis: 6,
  six: 6,
  "6": 6,
  siete: 7,
  seven: 7,
  "7": 7,
  ocho: 8,
  eight: 8,
  "8": 8,
  nueve: 9,
  nine: 9,
  "9": 9,
  diez: 10,
  ten: 10,
  "10": 10,
};

const FUSED_TOKEN_EXPANSIONS = {
  ultimoracion: ["ultima", "oracion"],
  ultimahoracion: ["ultima", "oracion"],
  esaoracion: ["esa", "oracion"],
  estaoracion: ["esta", "oracion"],
  estoracion: ["esa", "oracion"],
  estaoration: ["esta", "oracion"],
  laoracion: ["la", "oracion"],
  lahoracion: ["la", "oracion"],
  estaulimoracion: ["esta", "ultima", "oracion"],
  laultimoracion: ["la", "ultima", "oracion"],
};

const CANCEL_PHRASES = new Set([
  "cancelar",
  "cancela",
  "cancelalo",
  "cancel",
  "cancelled",
  "canceled",
  "olvidalo",
  "nah",
  "stop",
]);

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function foldToken(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}"“”'«»]+|[^\p{L}\p{N}"“”'«»]+$/gu, "")
    .replace(/["“”'«»]/g, "");
}

function canonicalizeDeleteVerb(token) {
  return DELETE_VERB_ALIASES[token] || token;
}

function expandToken(token) {
  if (FUSED_TOKEN_EXPANSIONS[token]) return FUSED_TOKEN_EXPANSIONS[token];
  if (token === "horacion" || token === "oration" || token === "orasion") {
    return ["oracion"];
  }
  return [token];
}

function expandParts(parts) {
  return parts.flatMap(expandToken);
}

function isWordNoun(token) {
  return token === "palabra" || token === "palabras" || token === "word" || token === "words";
}

function joinChunks(a, b) {
  const left = String(a || "").replace(/\s+/g, " ").trim();
  const right = String(b || "").replace(/\s+/g, " ").trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/**
 * @param {string[]} parts
 * @returns {SpeechEditCommand | null}
 */
function matchCommandParts(parts) {
  if (!parts.length) return null;
  const expanded = expandParts(parts);
  const joined = expanded.join(" ");

  if (
    joined === "empezar de nuevo"
    || joined === "desde el principio"
    || joined === "scratch that"
    || joined === "scratch it"
    || joined === "scratch that all"
    || joined === "start over"
  ) {
    return { action: "delete_all" };
  }

  const verb = canonicalizeDeleteVerb(expanded[0]);
  if (!DELETE_VERBS.has(verb)) return null;

  let rest = expanded.slice(1);
  if (rest[0] === "me" || rest[0] === "le") {
    rest = rest.slice(1);
  }

  // Bare verb → Mode B arm (“borrar” / “borra” / “borrame”)
  if (!rest.length) {
    if (ARM_DELETE_VERBS.has(verb)) {
      return { action: "arm_delete_phrase" };
    }
    return null;
  }

  const restJoin = rest.join(" ");

  if (
    restJoin === "todo"
    || restJoin === "todo el texto"
    || restJoin === "all"
    || restJoin === "everything"
    || restJoin === "all text"
  ) {
    return { action: "delete_all" };
  }

  if (
    /^(?:(?:esa|esta|la|the)\s+)?(?:(?:ultima|ultimo|last)\s+)?(?:oracion|oraciones|frase|frases|sentence|sentences)$/.test(restJoin)
    || restJoin === "last sentence"
    || restJoin === "that sentence"
    || restJoin === "this sentence"
  ) {
    return { action: "delete_sentence" };
  }

  let i = 0;
  if (
    rest[i] === "la"
    || rest[i] === "las"
    || rest[i] === "el"
    || rest[i] === "esta"
    || rest[i] === "esas"
    || rest[i] === "estos"
    || rest[i] === "esa"
    || rest[i] === "the"
  ) {
    const look = rest.slice(i + 1);
    const maybeWordPath = look.join(" ");
    if (
      /^(?:(?:ultima|ultimas|ultimo|last)\s+)?(?:(?:\d+|una|un|uno|one|dos|two|tres|three|cuatro|four|cinco|five|seis|six|siete|seven|ocho|eight|nueve|nine|diez|ten)\s+)?(?:palabra|palabras|word|words)$/.test(maybeWordPath)
      || isWordNoun(look[0])
    ) {
      i += 1;
    }
  }
  if (rest[i] === "ultima" || rest[i] === "ultimas" || rest[i] === "ultimo" || rest[i] === "last") {
    i += 1;
  }

  let count = 1;
  if (rest[i] && NUMBER_WORDS[rest[i]] != null) {
    count = NUMBER_WORDS[rest[i]];
    i += 1;
  }

  if (!isWordNoun(rest[i])) return null;
  i += 1;
  if (i !== rest.length) return null;

  return { action: "delete_words", count };
}

/**
 * @param {string} text
 * @returns {SpeechEditMatch | null}
 */
export function extractTrailingSpeechEdit(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const words = raw.split(/\s+/).filter(Boolean);
  const folded = words.map(foldToken);

  const max = Math.min(10, folded.length);
  for (let n = max; n >= 1; n -= 1) {
    const slice = folded.slice(-n);
    const command = matchCommandParts(slice);
    if (!command) continue;
    const remainder = words.slice(0, -n).join(" ").trim();
    return { command, consume: n, remainder };
  }
  return null;
}

/**
 * @param {string} text
 * @returns {{ content: string, command: SpeechEditCommand | null, peeled: boolean }}
 */
export function peelTrailingSpeechEdits(text) {
  let content = String(text || "").replace(/\s+/g, " ").trim();
  /** @type {SpeechEditCommand | null} */
  let command = null;
  let peeled = false;
  let guard = 0;

  while (guard < 12) {
    guard += 1;
    const hit = extractTrailingSpeechEdit(content);
    if (!hit) break;
    // Mode B arm should not keep peeling further shortcut commands underneath.
    if (hit.command.action === "arm_delete_phrase") {
      command = hit.command;
      content = hit.remainder;
      peeled = true;
      break;
    }
    command = hit.command;
    content = hit.remainder;
    peeled = true;
  }

  return { content, command, peeled };
}

/**
 * @param {string} text
 * @param {SpeechEditCommand} command
 * @returns {string}
 */
export function applySpeechEdit(text, command) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!command) return source;
  if (!source) return "";

  if (command.action === "arm_delete_phrase") return source;

  if (command.action === "delete_all") return "";

  if (command.action === "delete_words") {
    const words = source.split(/\s+/);
    const n = Math.min(Math.max(1, Number(command.count) || 1), words.length);
    return words.slice(0, -n).join(" ").trim();
  }

  if (command.action === "delete_sentence") {
    const parts = source.split(/(?<=[.!?…])\s+/).filter((p) => p.trim());
    if (parts.length > 1) {
      return parts.slice(0, -1).join(" ").trim();
    }
    const words = source.split(/\s+/);
    if (words.length <= 6) return source;
    return words.slice(0, -8).join(" ").trim();
  }

  return source;
}

function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const cur = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) prev[j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = cur[j];
  }
  return prev[t.length];
}

function tokenSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.88;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Strip leading delete verb + optional quotes from a Mode B query.
 * @param {string} raw
 */
export function normalizeDeletePhraseQuery(raw) {
  let text = String(raw || "").replace(/\s+/g, " ").trim();
  text = text.replace(/^["“”'«»]+|["“”'«»]+$/g, "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = canonicalizeDeleteVerb(foldToken(words[0]));
  if (DELETE_VERBS.has(first) || ARM_DELETE_VERBS.has(first)) {
    words.shift();
  }
  return words.join(" ").replace(/^["“”'«»]+|["“”'«»]+$/g, "").trim();
}

/**
 * Fuzzy-find `query` inside `haystack` and remove the best matching span.
 * Prefers the last strong match (most recent dictation).
 *
 * @param {string} haystack
 * @param {string} query
 * @param {{ minScore?: number }} [options]
 * @returns {{ ok: boolean, text: string, matched?: string, score?: number }}
 */
export function removeFuzzyPhrase(haystack, query, options = {}) {
  const source = String(haystack || "").replace(/\s+/g, " ").trim();
  const needleRaw = normalizeDeletePhraseQuery(query);
  if (!source) return { ok: false, text: "" };
  if (!needleRaw) return { ok: false, text: source };

  const hayWords = source.split(/\s+/);
  const needle = needleRaw.split(/\s+/).map(foldToken).filter(Boolean);
  if (!needle.length) return { ok: false, text: source };

  // Avoid deleting tiny fragments (“el”, “de”).
  const minScore = options.minScore ?? 0.62;
  if (needle.length === 1 && needle[0].length < 5) {
    return { ok: false, text: source };
  }

  const windowSizes = new Set([
    needle.length,
    Math.max(1, needle.length - 1),
    needle.length + 1,
    needle.length + 2,
  ]);

  /** @type {{ start: number, end: number, score: number } | null} */
  let best = null;

  for (const win of windowSizes) {
    if (win < 1 || win > hayWords.length) continue;
    for (let start = 0; start + win <= hayWords.length; start += 1) {
      const slice = hayWords.slice(start, start + win).map(foldToken);
      // Align needle tokens against window (average best pairwise order-preserving).
      let scoreSum = 0;
      let used = 0;
      let j = 0;
      for (let i = 0; i < needle.length; i += 1) {
        let localBest = 0;
        let localIdx = -1;
        for (let k = j; k < slice.length; k += 1) {
          const sim = tokenSimilarity(needle[i], slice[k]);
          if (sim > localBest) {
            localBest = sim;
            localIdx = k;
          }
        }
        if (localBest >= 0.55 && localIdx >= 0) {
          scoreSum += localBest;
          used += 1;
          j = localIdx + 1;
        }
      }
      if (used === 0) continue;
      // Penalize unused needle tokens and window size mismatch.
      const coverage = used / needle.length;
      const avg = scoreSum / used;
      const sizePenalty = Math.abs(win - needle.length) * 0.04;
      const score = avg * coverage - sizePenalty;
      if (!best || score > best.score || (Math.abs(score - best.score) < 0.02 && start >= best.start)) {
        best = { start, end: start + win, score };
      }
    }
  }

  if (!best || best.score < minScore) {
    return { ok: false, text: source };
  }

  const matched = hayWords.slice(best.start, best.end).join(" ");
  const next = [...hayWords.slice(0, best.start), ...hayWords.slice(best.end)].join(" ").trim();
  return { ok: true, text: next, matched, score: best.score };
}

export function isCancelDeletePhrase(text) {
  const folded = foldToken(String(text || "").trim());
  if (!folded) return false;
  if (CANCEL_PHRASES.has(folded)) return true;
  const words = String(text || "").trim().split(/\s+/).map(foldToken);
  const joined = words.join(" ");
  return (
    joined === "no borrar"
    || joined === "cancelar borrar"
    || joined === "never mind"
    || joined === "forget it"
  );
}

export function isArmDeletePhraseOnly(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;
  const verb = canonicalizeDeleteVerb(foldToken(words[0]));
  return ARM_DELETE_VERBS.has(verb);
}

/**
 * @param {string} existingText
 * @param {string} finalChunk
 * @param {{ deletePhraseArmed?: boolean }} [options]
 * @returns {{
 *   text: string,
 *   didEdit: boolean,
 *   deletePhraseArmed: boolean,
 *   phraseMiss?: boolean,
 *   phraseDeleted?: boolean,
 *   phraseQuery?: string,
 * }}
 */
export function absorbDictationFinal(existingText, finalChunk, options = {}) {
  const armed = Boolean(options.deletePhraseArmed);
  const chunk = String(finalChunk || "").trim();
  const existing = String(existingText || "").replace(/\s+/g, " ").trim();

  if (armed) {
    if (!chunk) {
      return { text: existing, didEdit: false, deletePhraseArmed: true };
    }
    if (isCancelDeletePhrase(chunk)) {
      return { text: existing, didEdit: false, deletePhraseArmed: false };
    }
    if (isArmDeletePhraseOnly(chunk)) {
      return { text: existing, didEdit: false, deletePhraseArmed: true };
    }

    const query = normalizeDeletePhraseQuery(chunk);
    const removed = removeFuzzyPhrase(existing, query);
    if (!removed.ok) {
      return {
        text: existing,
        didEdit: false,
        deletePhraseArmed: true,
        phraseMiss: true,
        phraseQuery: query,
      };
    }
    return {
      text: removed.text,
      didEdit: true,
      deletePhraseArmed: false,
      phraseDeleted: true,
      phraseQuery: query,
    };
  }

  if (!chunk) {
    return { text: existing, didEdit: false, deletePhraseArmed: false };
  }

  const joined = joinChunks(existing, chunk);
  const { content, command, peeled } = peelTrailingSpeechEdits(joined);

  if (!peeled || !command) {
    return { text: joined, didEdit: false, deletePhraseArmed: false };
  }

  if (command.action === "arm_delete_phrase") {
    return {
      text: content,
      didEdit: false,
      deletePhraseArmed: true,
    };
  }

  return {
    text: applySpeechEdit(content, command),
    didEdit: true,
    deletePhraseArmed: false,
  };
}
