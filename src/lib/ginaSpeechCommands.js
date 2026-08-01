/**
 * Voice edit commands during Gina dictation (Web Speech).
 * Natural Spanish/English: "borrame dos palabras", "borrame esta oración",
 * "borrame la/esta última oración" — plus common STT mashups.
 *
 * Important: Chrome often finalizes the verb and noun in separate results
 * ("Borame" then "estoración"). Always peel commands from the full buffer.
 */

/**
 * @typedef {'delete_words' | 'delete_sentence' | 'delete_all'} SpeechEditAction
 * @typedef {{ action: SpeechEditAction, count?: number }} SpeechEditCommand
 * @typedef {{ command: SpeechEditCommand, consume: number }} SpeechEditMatch
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

/**
 * Soft R / B↔V from STT → canonical borr* (as if the user rolled “rr”).
 * “borame” / “vorame” are treated like “borrame”.
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

/**
 * @param {string} token
 * @returns {string}
 */
function canonicalizeDeleteVerb(token) {
  return DELETE_VERB_ALIASES[token] || token;
}

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

/** STT often glues “última oración” / “esa oración” into one token. */
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

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function foldToken(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * @param {string} token
 * @returns {string[]}
 */
function expandToken(token) {
  if (FUSED_TOKEN_EXPANSIONS[token]) return FUSED_TOKEN_EXPANSIONS[token];
  if (token === "horacion" || token === "oration" || token === "orasion") {
    return ["oracion"];
  }
  return [token];
}

/**
 * @param {string[]} parts
 * @returns {string[]}
 */
function expandParts(parts) {
  return parts.flatMap(expandToken);
}

function isWordNoun(token) {
  return token === "palabra" || token === "palabras" || token === "word" || token === "words";
}

/**
 * @param {string[]} parts folded tokens that may be a command suffix
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

  // Normalize soft-R STT (“borame” / “vorame”) → borrame / borra
  const verb = canonicalizeDeleteVerb(expanded[0]);
  if (!DELETE_VERBS.has(verb)) return null;
  let rest = expanded.slice(1);
  if (rest[0] === "me" || rest[0] === "le") {
    rest = rest.slice(1);
  }
  if (!rest.length) return null;
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

  // borrame esta/esa/la (ultima) oración|horacion
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
 * Find a trailing voice-edit command in `text`.
 * @param {string} text
 * @returns {(SpeechEditMatch & { remainder: string }) | null}
 */
export function extractTrailingSpeechEdit(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const words = raw.split(/\s+/).filter(Boolean);
  const folded = words.map(foldToken);

  const max = Math.min(10, folded.length);
  for (let n = max; n >= 2; n -= 1) {
    const slice = folded.slice(-n);
    const command = matchCommandParts(slice);
    if (!command) continue;
    const remainder = words.slice(0, -n).join(" ").trim();
    return { command, consume: n, remainder };
  }
  return null;
}

/**
 * Peel every trailing voice command from the buffer (handles repeats + split finals).
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
    command = hit.command;
    content = hit.remainder;
    peeled = true;
  }

  return { content, command, peeled };
}

/**
 * Apply a parsed edit to the current transcript buffer.
 * @param {string} text
 * @param {SpeechEditCommand} command
 * @returns {string}
 */
export function applySpeechEdit(text, command) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!command) return source;
  if (!source) return "";

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
    // Short leftover (e.g. only a greeting after peeling failed command echoes):
    // don't wipe it — the peel already removed the command words.
    if (words.length <= 6) return source;
    return words.slice(0, -8).join(" ").trim();
  }

  return source;
}

function joinChunks(a, b) {
  const left = String(a || "").replace(/\s+/g, " ").trim();
  const right = String(b || "").replace(/\s+/g, " ").trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/**
 * Absorb a new final STT chunk.
 * Peels commands from the **full** buffer so split finals still match
 * ("Borame" + "estoración").
 *
 * @param {string} existingText
 * @param {string} finalChunk
 * @returns {{ text: string, didEdit: boolean }}
 */
export function absorbDictationFinal(existingText, finalChunk) {
  const joined = joinChunks(existingText, finalChunk);
  if (!joined) return { text: "", didEdit: false };

  const { content, command, peeled } = peelTrailingSpeechEdits(joined);
  if (!peeled || !command) {
    return { text: joined, didEdit: false };
  }

  return {
    text: applySpeechEdit(content, command),
    didEdit: true,
  };
}
