/**
 * Minimal Groq / Gemini JSON completion helpers for dev API routes.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
const GROQ_MODELS = [...new Set([GROQ_MODEL, GROQ_FALLBACK_MODEL])];

const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MAX_RETRIES = 3;
const GROQ_BASE_DELAY_MS = 1500;

/** Serializes Groq calls to avoid burst 429 during batch scans. */
let groqChain = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("rate limit");
}

function retryDelayMs(err, attempt) {
  const match = (err instanceof Error ? err.message : "").match(/retry.?after[^0-9]*(\d+)/i);
  const headerSeconds = match ? Number(match[1]) : 0;
  if (headerSeconds > 0) return headerSeconds * 1000;
  return GROQ_BASE_DELAY_MS * (2 ** attempt);
}

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 * @param {string} model
 */
async function completeJsonWithGroqModel(prompt, options, model) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        ...(options.system
          ? [{ role: "system", content: options.system }]
          : []),
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty content");
  return JSON.parse(raw);
}

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 */
export async function completeJsonWithGroq(prompt, options = {}) {
  if (!process.env.GROQ_API_KEY) return null;

  const run = async () => {
    let lastError = null;

    for (const model of GROQ_MODELS) {
      for (let attempt = 0; attempt < GROQ_MAX_RETRIES; attempt += 1) {
        try {
          return await completeJsonWithGroqModel(prompt, options, model);
        } catch (err) {
          lastError = err;
          if (isRateLimitError(err) && attempt < GROQ_MAX_RETRIES - 1) {
            const wait = retryDelayMs(err, attempt);
            console.warn(`[llmJson] Groq 429 on ${model}, retry ${attempt + 1}/${GROQ_MAX_RETRIES} in ${wait}ms`);
            await sleep(wait);
            continue;
          }
          if (isRateLimitError(err) && model !== GROQ_MODELS[GROQ_MODELS.length - 1]) {
            console.warn(`[llmJson] Groq rate limit on ${model}, trying fallback model`);
            break;
          }
          throw err;
        }
      }
    }

    throw lastError || new Error("Groq request failed");
  };

  const result = groqChain.then(run, run);
  groqChain = result.catch(() => {});
  return result;
}

/**
 * Uses GEMINI_API_KEY only — GOOGLE_API_KEY is for Translate/CSE, not Generative Language.
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 */
export async function completeJsonWithGemini(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const parts = [];
  if (options.system) {
    parts.push({ text: options.system });
  }
  parts.push({ text: prompt });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned empty content");
  return JSON.parse(raw);
}

/** @type {{ code: string, detail: string } | null} */
let lastLlmFailure = null;

export function getLastLlmFailure() {
  return lastLlmFailure;
}

function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Human-readable reason when completeJson() returned null.
 */
export function describeLlmUnavailable() {
  if (!hasGroqKey() && !hasGeminiKey()) {
    return (
      "No hay LLM configurado (GROQ_API_KEY o GEMINI_API_KEY). "
      + "Copiá .env.example → .env.local, pegá la clave y reiniciá `npm run dev`. "
      + "En Vercel: Project Settings → Environment Variables. No se inventan datos."
    );
  }

  const detail = lastLlmFailure?.detail || "";

  if (detail.includes("429") || detail.toLowerCase().includes("rate limit")) {
    return (
      "Groq rate limit alcanzado (demasiadas requests seguidas). "
      + "Esperá 1–2 minutos, probá una marca puntual, o reducí el batch scan. "
      + "No se inventan datos."
    );
  }

  if (lastLlmFailure?.code === "groq_error" && !hasGeminiKey()) {
    return (
      `Groq falló (${lastLlmFailure.detail.slice(0, 160)}). `
      + "Opcional: añadí GEMINI_API_KEY como fallback. No se inventan datos."
    );
  }

  if (lastLlmFailure?.code === "all_failed") {
    return `${lastLlmFailure.detail.slice(0, 280)} No se inventan datos.`;
  }

  return "No se pudo extraer con LLM (Groq/Gemini). No se inventan datos.";
}

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 */
export async function completeJson(prompt, options = {}) {
  lastLlmFailure = null;

  if (!hasGroqKey() && !hasGeminiKey()) {
    lastLlmFailure = { code: "missing_keys", detail: "sin claves en process.env" };
    return null;
  }

  try {
    const groq = await completeJsonWithGroq(prompt, options);
    if (groq) return { provider: "groq", data: groq };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    lastLlmFailure = {
      code: isRateLimitError(err) ? "rate_limit" : "groq_error",
      detail,
    };
    console.error("[llmJson] Groq failed, falling back to Gemini:", detail);
  }

  if (hasGeminiKey()) {
    try {
      const gemini = await completeJsonWithGemini(prompt, options);
      if (gemini) return { provider: "gemini", data: gemini };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      lastLlmFailure = {
        code: lastLlmFailure ? "all_failed" : "gemini_error",
        detail: lastLlmFailure
          ? `Groq: ${lastLlmFailure.detail.slice(0, 120)} · Gemini: ${detail.slice(0, 120)}`
          : detail,
      };
      console.error("[llmJson] Gemini failed:", detail);
    }
  }

  if (!lastLlmFailure) {
    lastLlmFailure = { code: "empty_response", detail: "Groq y Gemini devolvieron vacío" };
  }

  return null;
}
