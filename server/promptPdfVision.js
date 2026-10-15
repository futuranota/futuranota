import { logApiUsageEvent } from "./management/logApiUsage.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
const MAX_IMAGES = 3;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens;
  if (inputTokens == null && outputTokens == null) return null;
  return {
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0,
  };
}

/**
 * @param {{ images?: string[], userId?: string, userEmail?: string }} body
 */
export async function processPromptPdfRead(body) {
  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((url) => typeof url === "string" && url.startsWith("data:image/"))
    .slice(0, MAX_IMAGES);
  if (!images.length) {
    return { status: 400, body: { error: "No hay páginas para leer." } };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { status: 503, body: { error: "GROQ_API_KEY is not set" } };
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_completion_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: "Estas imágenes son las páginas de un PDF, en orden. Transcribe el texto visible. Devuelve solo ese texto, conservando los párrafos. Si una página no tiene texto, omítela.",
          },
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Groq vision failed (${response.status})`;
    return { status: response.status, body: { error: message } };
  }

  const text = String(payload?.choices?.[0]?.message?.content || "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
  const usage = normalizeUsage(payload?.usage);
  void logApiUsageEvent({
    userId: typeof body.userId === "string" ? body.userId : undefined,
    userEmail: typeof body.userEmail === "string" ? body.userEmail : undefined,
    provider: "groq",
    endpoint: "prompts/read",
    routeLabel: "Prompt PDF",
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    model: VISION_MODEL,
    billed: true,
    meta: { pages: images.length },
  });

  if (!text) {
    return { status: 200, body: { text: "" } };
  }
  return { status: 200, body: { text } };
}

export function createPromptPdfMiddleware() {
  return async function promptPdfMiddleware(req, res, next) {
    const path = (req.url || "").split("?")[0];
    if (path !== "/api/prompts/read") return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await processPromptPdfRead(body);
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "No se pudo leer el PDF",
      }));
    }
  };
}
