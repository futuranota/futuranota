import { emphasizePastedText, highlightFichas } from "../src/lib/promptBeautify.js";
import { logApiUsageEvent } from "./management/logApiUsage.js";
import { structurePdfText } from "./promptPdfStructure.js";
import { guardPromptToolCall } from "./promptToolGuard.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
const IMPROVE_MODEL = process.env.GROQ_IMPROVE_MODEL || "openai/gpt-oss-20b";
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

const READ_INSTRUCTION = `Lee esta página antes de decidir. No uses el tamaño de la letra como regla. A veces no hay título, a veces no hay descripción, y a veces el prompt es el único bloque.

Devuelve solo un objeto JSON con las claves "title", "description" y "prompt". Cada valor es un string. Si esa parte no está, usa "".

- title: la línea corta que abre la hoja, aunque sea pequeña. Suele empezar con un número o un paso, como "01 / CREAR LA HOJA", "Paso 01", "#1" o "1-". Si la palabra Prompt solo nombra una sección, no es el título. Si no hay esa línea, "".
- description: la explicación de quien comparte el PDF. Incluye la frase grande que está debajo del título, la explicación corta que la sigue, y los rótulos que explican la foto aunque estén a un lado, en vertical, como "01 ROSTRO" o "02 FRENTE". No es el prompt. Si no hay, "".
- prompt: el bloque bajo la palabra Prompt, cuando esa palabra está. Si no está, el bloque de texto más grande. Cópialo tal cual, con sus párrafos. Si no lo reconoces, "".

Un nombre pintado dentro del dibujo, un logo o una marca de agua no entra en ningún campo. Un rótulo que explica la hoja sí entra en description.

En description y en prompt, copia el énfasis que se ve en la página. Envuelve solo la frase marcada, con una de estas etiquetas y sin atributos: <strong> negrita, <em> itálica, <u> subrayado, <s> tachado, <mark> resaltado. El title va siempre sin etiquetas. No marques una frase solo porque la letra es más grande. No uses markdown ni otras etiquetas. Si el texto es normal, déjalo sin marcas.

Si el prompt trae un hueco entre marcas, cópialo tal cual, con una o con dos: {add this producto}, {{add this producto}}, [add this producto] o [[add this producto]]. No lo completes, no lo quites y no lo conviertas en texto normal. El texto de adentro es el nombre de una variable.

No transcribas la página entera. No escribas nada fuera del JSON.`;

const CONTINUE_INSTRUCTION = `Esta página sigue al PDF que ya leíste. Devuelve solo un objeto JSON {"title":"","description":"","prompt":""}.

title va siempre vacío.

description: solo si esta página agrega explicación, instrucciones o rótulos de la hoja que no son el prompt. Si no agrega nada de eso, "".

prompt: copia el prompt que continúa en esta página, tal cual y con sus párrafos. Si la página lo nombra Prompt, usa ese bloque. Si no lo nombra, usa el bloque de texto más grande solo cuando sea la continuación del prompt. Si no continúa, "".

En description y en prompt, copia el énfasis que se ve en la página. Envuelve solo la frase marcada, con una de estas etiquetas y sin atributos: <strong> negrita, <em> itálica, <u> subrayado, <s> tachado, <mark> resaltado. No marques una frase solo porque la letra es más grande. No uses markdown ni otras etiquetas. Si el texto es normal, déjalo sin marcas.

Si el prompt trae un hueco entre marcas, cópialo tal cual, con una o con dos: {add this producto}, {{add this producto}}, [add this producto] o [[add this producto]]. No lo completes, no lo quites y no lo conviertas en texto normal. El texto de adentro es el nombre de una variable.

Un nombre pintado dentro del dibujo, un logo o una marca de agua no entra. No escribas nada fuera del JSON.`;

const IMPROVE_INSTRUCTION = `Te paso texto ya pegado, no una página ni un PDF. Ordénalo. No inventes frases ni completes huecos.

Devuelve solo un objeto JSON con las claves "title", "description" y "prompt". Cada valor es un string. Si esa parte no está, usa "".

- title: la línea corta que abre el texto, como "01 / CREAR LA HOJA", "Paso 01", "#1" o "1-". Si la palabra Prompt solo nombra una sección, no es el título. Si no hay esa línea, "". El title va sin etiquetas.
- description: la explicación que está antes del prompt. Si no hay, "".
- prompt: el bloque bajo la palabra Prompt, cuando esa palabra está. Si no está, el bloque de texto más grande. Cópialo con sus párrafos. Conserva los tokens {{...}} tal cual.

Si el prompt trae un hueco entre marcas, cópialo tal cual, con una o con dos: {add this producto}, {{add this producto}}, [add this producto] o [[add this producto]]. No lo completes, no lo quites y no lo conviertas en texto normal.

Resalta en amarillo cada ficha, envolviéndola solo a ella con <mark> y sin atributos:
- la que empieza con #
- la que empieza con http o https
- la que contiene un @ entre el texto
No marques la frase entera.

Pon en negrita, con <strong> y sin atributos:
- cada oración que empiece o termine con ?
- cada palabra escrita toda en mayúsculas
- cada palabra que contenga un número
Una mayúscula sola al inicio de la oración no va en negrita. El title va sin <mark> y sin <strong>. No uses markdown ni otras etiquetas. No escribas nada fuera del JSON.`;

const MARK_NAMES = {
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  u: "u",
  s: "s",
  strike: "s",
  del: "s",
  mark: "mark",
};

function keepMarks(value) {
  let text = typeof value === "string" ? value : "";
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  const kept = [];
  text = text.replace(/<\/?(strong|em|u|s|mark|b|i|strike|del)\b[^>]*>/gi, (tag) => {
    const name = tag.match(/<\/?([a-z0-9]+)/i)?.[1]?.toLowerCase();
    const mapped = MARK_NAMES[name];
    if (!mapped) return "";
    const token = `\u0000${kept.length}\u0000`;
    kept.push(tag.startsWith("</") ? `</${mapped}>` : `<${mapped}>`);
    return token;
  });
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/\u0000(\d+)\u0000/g, (_, index) => kept[Number(index)] || "");
  text = text.replace(/<(strong|em|u|s|mark)>\s*<\/\1>/gi, "");
  return text.trim();
}

function plainField(value) {
  return keepMarks(value).replace(/<\/?(?:strong|em|u|s|mark)>/gi, "").trim();
}

export function parsePdfFields(raw) {
  const cleaned = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
  if (!cleaned) return { title: "", description: "", prompt: "" };
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : cleaned).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Groq didn’t return the PDF fields.");
  }
  let parsed;
  try {
    parsed = JSON.parse(source.slice(start, end + 1));
  } catch {
    throw new Error("Groq didn’t return the PDF fields.");
  }
  return {
    title: plainField(parsed?.title),
    description: keepMarks(parsed?.description),
    prompt: keepMarks(parsed?.prompt),
  };
}

/**
 * @param {{ pages?: { index?: number, image?: string }[], images?: string[], pass?: string, description?: string, prompt?: string, text?: string, userId?: string, userEmail?: string }} body
 */
export async function processPromptPdfRead(body) {
  if (body.pass === "improve") return processPromptImprove(body);
  if (body.pass === "structure") return structurePdfText(body);

  const listed = Array.isArray(body.pages)
    ? body.pages
    : (Array.isArray(body.images) ? body.images.map((image, index) => ({ index: index + 1, image })) : []);
  const pages = listed
    .map((page, index) => ({
      index: Number(page?.index) > 0 ? Number(page.index) : index + 1,
      image: page?.image,
    }))
    .filter((page) => typeof page.image === "string" && page.image.startsWith("data:image/"))
    .slice(0, MAX_IMAGES);
  if (!pages.length) {
    return { status: 400, body: { error: "No hay páginas para leer." } };
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.Groq_Api_key;
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
            text: body.pass === "continue" ? CONTINUE_INSTRUCTION : READ_INSTRUCTION,
          },
          ...pages.flatMap((page) => ([
            { type: "text", text: `Página ${page.index}` },
            { type: "image_url", image_url: { url: page.image } },
          ])),
        ],
      }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Groq vision failed (${response.status})`;
    return { status: response.status, body: { error: message } };
  }

  const usage = normalizeUsage(payload?.usage);
  const pass = body.pass === "continue" ? "continue" : "read";
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
    meta: { pages: pages.length, indexes: pages.map((page) => page.index), pass },
  });

  let fields;
  try {
    fields = parsePdfFields(payload?.choices?.[0]?.message?.content || "");
  } catch (err) {
    return {
      status: 422,
      body: { error: err instanceof Error ? err.message : "Groq didn’t return the PDF fields." },
    };
  }
  if (pass === "continue") {
    fields = { title: "", description: fields.description, prompt: fields.prompt };
  }
  return { status: 200, body: fields };
}

/**
 * Order pasted text. No page image.
 * @param {{ description?: string, prompt?: string, text?: string, userId?: string, userEmail?: string }} body
 */
async function processPromptImprove(body) {
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const fallback = typeof body.text === "string" ? body.text.trim() : "";
  const pasted = [
    description ? `Descripción:\n${description}` : "",
    prompt ? `Prompt:\n${prompt}` : "",
    !description && !prompt && fallback ? fallback : "",
  ].filter(Boolean).join("\n\n").slice(0, 12000);
  if (!pasted) {
    return { status: 400, body: { error: "No hay texto pegado para mejorar." } };
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.Groq_Api_key;
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
      model: IMPROVE_MODEL,
      temperature: 0,
      max_completion_tokens: 4096,
      reasoning_effort: "low",
      reasoning_format: "hidden",
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: `${IMPROVE_INSTRUCTION}\n\nTEXTO PEGADO:\n${pasted}`,
      }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Groq improve failed (${response.status})`;
    return { status: response.status, body: { error: message } };
  }

  const usage = normalizeUsage(payload?.usage);
  void logApiUsageEvent({
    userId: typeof body.userId === "string" ? body.userId : undefined,
    userEmail: typeof body.userEmail === "string" ? body.userEmail : undefined,
    provider: "groq",
    endpoint: "prompts/read",
    routeLabel: "Prompt improve",
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    model: IMPROVE_MODEL,
    billed: true,
    meta: { pass: "improve", chars: pasted.length },
  });

  let fields;
  try {
    fields = parsePdfFields(payload?.choices?.[0]?.message?.content || "");
  } catch (err) {
    return {
      status: 422,
      body: { error: err instanceof Error ? err.message : "Groq didn’t return the PDF fields." },
    };
  }
  return {
    status: 200,
    body: {
      title: fields.title,
      description: emphasizePastedText(highlightFichas(fields.description)),
      prompt: emphasizePastedText(highlightFichas(fields.prompt)),
    },
  };
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
      const blocked = await guardPromptToolCall(req, body);
      if (blocked) {
        res.statusCode = blocked.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(blocked.body));
        return;
      }
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
