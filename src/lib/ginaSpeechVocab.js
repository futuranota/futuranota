/**
 * Gina dictation vocab — post-process Web Speech transcripts.
 * Exact / near-pronunciation variants → canonical product terms.
 * Grow this list over time; do not invent sentence rewrites here.
 */

/**
 * @typedef {{ canonical: string, variants: string[] }} GinaSpeechVocabEntry
 */

/** @type {GinaSpeechVocabEntry[]} */
export const GINA_SPEECH_VOCAB = [
  // Spanish rr — Web Speech often drops a rolled R (borar→borrar, bores→borres)
  {
    canonical: "borrar",
    variants: ["borrar", "borar", "vorar", "forar"],
  },
  {
    canonical: "borra",
    variants: ["borra", "bora", "vora", "forra"],
  },
  {
    canonical: "borrame",
    variants: ["borrame", "borame", "borreme", "vorame", "vorrame", "forame"],
  },
  {
    canonical: "borres",
    variants: ["borres", "bores", "vores"],
  },
  {
    canonical: "borre",
    variants: ["borre", "bore", "vore"],
  },
  {
    canonical: "borramos",
    variants: ["borramos", "boramos", "voramos"],
  },
  {
    canonical: "borren",
    variants: ["borren", "boren", "voren"],
  },

  // Assistant
  {
    canonical: "Gina",
    variants: ["gina", "jina", "jeena", "guina", "heena", "gyna", "djina"],
  },

  // Documents / navigation
  {
    canonical: "documento",
    variants: ["documento", "document", "dokumento"],
  },
  {
    canonical: "documentos",
    variants: ["documentos", "documents", "dokumentos"],
  },
  {
    canonical: "sección",
    variants: ["sección", "seccion", "section", "sekcion"],
  },
  {
    canonical: "carpeta",
    variants: ["carpeta", "folder"],
  },
  {
    canonical: "carpetas",
    variants: ["carpetas", "folders"],
  },
  {
    canonical: "buscar",
    variants: [
      "buscar",
      "busca",
      "search",
      "serch",
      "encontrar",
      "encuentra",
      "cincuentra",
      "encontre",
    ],
  },
  {
    canonical: "abrir",
    variants: ["abrir", "abre", "open", "oppen"],
  },

  // Domains (common asks)
  {
    canonical: "marketing",
    variants: ["marketing", "merketing", "merketin", "mercadeo", "márketing"],
  },
  {
    canonical: "estadísticas",
    variants: [
      "estadísticas",
      "estadisticas",
      "estadística",
      "estadistica",
      "statistics",
      "stats",
      "statisticas",
    ],
  },

  // Scheduling
  {
    canonical: "horario",
    variants: ["horario", "horarios", "schedule", "schedules", "skedule"],
  },
  {
    canonical: "agenda",
    variants: ["agenda", "calendario"],
  },
  {
    canonical: "programar",
    variants: ["programar", "programa", "programemos", "agendar"],
  },
  {
    canonical: "alarma",
    variants: ["alarma", "alarmas", "alarm", "alarms"],
  },
  {
    canonical: "recordatorio",
    variants: ["recordatorio", "recordatorios", "reminder", "reminders"],
  },
  {
    canonical: "timeline",
    variants: ["timeline", "time line", "línea de tiempo", "linea de tiempo"],
  },
  {
    canonical: "hoy",
    variants: ["hoy", "today"],
  },
  {
    canonical: "mañana",
    variants: ["mañana", "manana", "tomorrow"],
  },
  {
    canonical: "tarde",
    variants: ["tarde", "afternoon"],
  },
  {
    canonical: "inicio",
    variants: ["inicio", "empezar", "start", "arranque"],
  },
  {
    canonical: "fin",
    variants: ["fin", "finish", "terminar", "acabar"],
  },

  // Status (document work status)
  {
    canonical: "en progreso",
    variants: ["en progreso", "in progress", "inprogress"],
  },
  {
    canonical: "enviado",
    variants: ["enviado", "submitted", "submited", "entregado"],
  },
  {
    canonical: "completado",
    variants: ["completado", "completed", "completo"],
  },
  {
    canonical: "pendiente",
    variants: ["pendiente", "pending", "por hacer"],
  },
];

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
 * Build longest-first phrase rules (folded words → canonical).
 * @param {GinaSpeechVocabEntry[]} [entries]
 */
export function buildSpeechReplaceRules(entries = GINA_SPEECH_VOCAB) {
  /** @type {Map<string, { parts: string[], canonical: string, pattern: string }>} */
  const byKey = new Map();

  for (const entry of entries) {
    const canonical = String(entry?.canonical || "").trim();
    if (!canonical) continue;
    const variants = Array.isArray(entry.variants) ? entry.variants : [];
    for (const raw of [canonical, ...variants]) {
      const variant = String(raw || "").trim();
      if (!variant) continue;
      const parts = variant.split(/\s+/).map(foldToken).filter(Boolean);
      if (!parts.length) continue;
      const key = parts.join(" ");
      const existing = byKey.get(key);
      if (existing && existing.parts.length >= parts.length) continue;
      byKey.set(key, { parts, canonical, pattern: variant });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (b.parts.length !== a.parts.length) return b.parts.length - a.parts.length;
    return b.pattern.length - a.pattern.length;
  });
}

/**
 * Normalize a dictation transcript with the Gina speech vocab.
 * Conservative: only swaps known product/schedule terms; leaves the rest intact.
 *
 * @param {string} text
 * @param {{ entries?: GinaSpeechVocabEntry[] }} [options]
 * @returns {string}
 */
export function normalizeDictationTranscript(text, options = {}) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return "";

  const words = source.split(/\s+/);
  const rules = buildSpeechReplaceRules(options.entries || GINA_SPEECH_VOCAB);
  const out = [];
  let i = 0;

  while (i < words.length) {
    let matched = false;
    for (const rule of rules) {
      const n = rule.parts.length;
      if (i + n > words.length) continue;
      let ok = true;
      for (let j = 0; j < n; j += 1) {
        if (foldToken(words[i + j]) !== rule.parts[j]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      out.push(rule.canonical);
      i += n;
      matched = true;
      break;
    }
    if (!matched) {
      out.push(words[i]);
      i += 1;
    }
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}
