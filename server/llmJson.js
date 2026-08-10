/**
 * Minimal Groq / Gemini JSON completion helpers for dev API routes.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
const GROQ_MODELS = [...new Set([GROQ_MODEL, GROQ_FALLBACK_MODEL])];

const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || "gemini-2.0-flash";
const GEMINI_DEFAULT_MODEL = GEMINI_FLASH_MODEL;
const GROQ_MAX_RETRIES = 3;
const GROQ_BASE_DELAY_MS = 1500;
const GROQ_REQUEST_TIMEOUT_MS = Number(process.env.GROQ_REQUEST_TIMEOUT_MS) || 22000;
const GEMINI_MAX_RETRIES = 3;
const GEMINI_BASE_DELAY_MS = 2000;

/** Serializes Groq calls to avoid burst 429 during batch scans. */
let groqChain = Promise.resolve();

/** Serializes Gemini calls to avoid burst 429 during batch scans. */
let geminiChain = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return msg.includes("429")
    || lower.includes("rate limit")
    || lower.includes("quota")
    || lower.includes("resource exhausted");
}

/** @param {string} detail */
function isRateLimitDetail(detail) {
  const lower = detail.toLowerCase();
  return detail.includes("429")
    || lower.includes("rate limit")
    || lower.includes("quota")
    || lower.includes("resource exhausted");
}

function providerRetryDelayMs(err, attempt, baseDelayMs) {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry(?:\s+after|\s+in)[^0-9]*(\d+(?:\.\d+)?)/i);
  if (match) {
    const seconds = Number.parseFloat(match[1]);
    if (seconds > 0) return Math.ceil(seconds * 1000);
  }
  return baseDelayMs * (2 ** attempt);
}

function retryDelayMs(err, attempt) {
  return providerRetryDelayMs(err, attempt, GROQ_BASE_DELAY_MS);
}

/**
 * @param {string} prompt
 * @param {{ system?: string, temperature?: number }} [options]
 * @param {string} model
 */
async function completeJsonWithGroqModel(prompt, options, model) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const temperature = typeof options.temperature === "number" ? options.temperature : 0.2;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          ...(options.system
            ? [{ role: "system", content: options.system }]
            : []),
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Groq timeout after ${GROQ_REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty content");
  const usage = data?.usage && typeof data.usage === "object"
    ? {
      prompt_tokens: Number(data.usage.prompt_tokens) || 0,
      completion_tokens: Number(data.usage.completion_tokens) || 0,
      total_tokens: Number(data.usage.total_tokens) || 0,
    }
    : null;
  return {
    data: JSON.parse(raw),
    usage,
    model,
  };
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
 * @param {{ system?: string, temperature?: number }} [options]
 * @param {string} model
 */
async function completeJsonWithGeminiModel(prompt, options, model) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const temperature = typeof options.temperature === "number" ? options.temperature : 0.2;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
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
        temperature,
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

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 * @param {string} [apiModel]
 */
export async function completeJsonWithGemini(prompt, options = {}, apiModel = GEMINI_DEFAULT_MODEL) {
  if (!process.env.GEMINI_API_KEY?.trim()) return null;

  const model = apiModel || GEMINI_DEFAULT_MODEL;
  const run = async () => {
    let lastError = null;

    for (let attempt = 0; attempt < GEMINI_MAX_RETRIES; attempt += 1) {
      try {
        return await completeJsonWithGeminiModel(prompt, options, model);
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err) && attempt < GEMINI_MAX_RETRIES - 1) {
          const wait = providerRetryDelayMs(err, attempt, GEMINI_BASE_DELAY_MS);
          console.warn(
            `[llmJson] Gemini 429 on ${model}, retry ${attempt + 1}/${GEMINI_MAX_RETRIES} in ${wait}ms`,
          );
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Gemini request failed");
  };

  const result = geminiChain.then(run, run);
  geminiChain = result.catch(() => {});
  return result;
}

/**
 * Groq JSON completion for a single model with exponential backoff on 429.
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 * @param {string} model
 */
async function completeJsonWithGroqForModel(prompt, options, model) {
  const run = async () => {
    let lastError = null;

    for (let attempt = 0; attempt < GROQ_MAX_RETRIES; attempt += 1) {
      try {
        return await completeJsonWithGroqModel(prompt, options, model);
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err) && attempt < GROQ_MAX_RETRIES - 1) {
          const wait = retryDelayMs(err, attempt);
          console.warn(
            `[llmJson] Groq 429 on ${model}, retry ${attempt + 1}/${GROQ_MAX_RETRIES} in ${wait}ms`,
          );
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Groq request failed");
  };

  const result = groqChain.then(run, run);
  groqChain = result.catch(() => {});
  return result;
}

/** @type {{ code: string, detail: string, provider?: string } | null} */
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

  const failure = lastLlmFailure;
  const detail = failure?.detail || "";
  const provider = failure?.provider;
  const code = failure?.code || "";
  const rateLimited = code === "rate_limit" || isRateLimitDetail(detail);

  if (rateLimited) {
    const geminiHit = provider === "gemini"
      || (code === "gemini_error" && detail.toLowerCase().includes("gemini"));
    const groqHit = provider === "groq"
      || code === "groq_error"
      || detail.toLowerCase().includes("groq");

    if (geminiHit && !groqHit) {
      return (
        "Gemini: cuota o límite de requests alcanzado. "
        + "Revisá billing en Google AI Studio, esperá 1–2 minutos, o elegí Groq Llama en el selector de modelo. "
        + "No se inventan datos."
      );
    }

    if (groqHit && !geminiHit) {
      return (
        "Groq: rate limit alcanzado (demasiadas requests seguidas). "
        + "Esperá 1–2 minutos, elegí Gemini Flash, probá una marca puntual, o reducí el batch scan. "
        + "No se inventan datos."
      );
    }
  }

  if (code === "missing_keys") {
    if (detail.includes("GEMINI")) {
      return (
        "GEMINI_API_KEY no configurada para el modelo Gemini seleccionado. "
        + "Copiá .env.example → .env.local y reiniciá `npm run dev`. No se inventan datos."
      );
    }
    if (detail.includes("GROQ")) {
      return (
        "GROQ_API_KEY no configurada para el modelo Groq seleccionado. "
        + "Copiá .env.example → .env.local y reiniciá `npm run dev`. No se inventan datos."
      );
    }
  }

  if (code === "gemini_error" && provider === "gemini") {
    return (
      `Gemini falló (${detail.slice(0, 160)}). `
      + "Probá otro modelo o revisá GEMINI_API_KEY. No se inventan datos."
    );
  }

  if (code === "groq_error" && !hasGeminiKey()) {
    return (
      `Groq falló (${detail.slice(0, 160)}). `
      + "Opcional: añadí GEMINI_API_KEY como fallback. No se inventan datos."
    );
  }

  if (code === "all_failed") {
    return `${detail.slice(0, 280)} No se inventan datos.`;
  }

  return "No se pudo extraer con LLM (Groq/Gemini). No se inventan datos.";
}

/**
 * @param {string} prompt
 * @param {{ system?: string, provider?: string, model?: string, allowFallback?: boolean }} [options]
 */
export async function completeJson(prompt, options = {}) {
  lastLlmFailure = null;

  if (options.provider && options.model) {
    return completeJsonForProvider(prompt, options);
  }

  if (!hasGroqKey() && !hasGeminiKey()) {
    lastLlmFailure = { code: "missing_keys", detail: "sin claves en process.env" };
    return null;
  }

  try {
    const groq = await completeJsonWithGroq(prompt, options);
    if (groq?.data != null) {
      return {
        provider: "groq",
        data: groq.data,
        model: groq.model,
        usage: groq.usage,
      };
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    lastLlmFailure = {
      code: isRateLimitError(err) ? "rate_limit" : "groq_error",
      provider: "groq",
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
        code: lastLlmFailure
          ? "all_failed"
          : (isRateLimitError(err) ? "rate_limit" : "gemini_error"),
        provider: lastLlmFailure ? undefined : "gemini",
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

/**
 * Explicit provider/model path for Intel overview (no auto-fallback unless allowFallback).
 * @param {string} prompt
 * @param {{ system?: string, provider?: string, model?: string, allowFallback?: boolean }} options
 */
export async function completeJsonForProvider(prompt, options = {}) {
  lastLlmFailure = null;
  const provider = options.provider === "groq" ? "groq" : "gemini";
  const apiModel = options.model || (provider === "groq"
    ? GROQ_MODEL
    : GEMINI_DEFAULT_MODEL);

  if (provider === "groq") {
    if (!hasGroqKey()) {
      lastLlmFailure = { code: "missing_keys", detail: "GROQ_API_KEY not set" };
      return null;
    }
    try {
      const result = await completeJsonWithGroqForModel(prompt, options, apiModel);
      return {
        provider: "groq",
        data: result?.data ?? result,
        model: result?.model || apiModel,
        usage: result?.usage || null,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      lastLlmFailure = {
        code: isRateLimitError(err) ? "rate_limit" : "groq_error",
        provider: "groq",
        detail,
      };
      if (!options.allowFallback || !hasGeminiKey()) return null;
    }
  } else if (!hasGeminiKey()) {
    lastLlmFailure = { code: "missing_keys", detail: "GEMINI_API_KEY not set" };
    return null;
  }

  if (provider === "gemini" || options.allowFallback) {
    try {
      const fallbackModel = provider === "gemini"
        ? apiModel
        : GEMINI_DEFAULT_MODEL;
      const data = await completeJsonWithGemini(prompt, options, fallbackModel);
      if (data) {
        return {
          provider: "gemini",
          data,
          model: fallbackModel,
        };
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      lastLlmFailure = {
        code: lastLlmFailure
          ? "all_failed"
          : (isRateLimitError(err) ? "rate_limit" : "gemini_error"),
        provider: "gemini",
        detail: lastLlmFailure
          ? `${lastLlmFailure.detail.slice(0, 120)} · Gemini: ${detail.slice(0, 120)}`
          : detail,
      };
    }
  }

  return null;
}
