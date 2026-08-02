import { getGinaSystemPrompt, fallbackGinaNarration } from "./ginaSystemPrompt.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
const TIMEOUT_MS = Number(process.env.GROQ_REQUEST_TIMEOUT_MS) || 22000;

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {{ system: string, messages: { role: string, content: string }[] }} payload
 */
async function groqChat(apiKey, model, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: payload.system },
          ...payload.messages,
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Groq returned empty content");
    }
    return content.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @param {{
 *   messages?: { role?: string, content?: string }[],
 *   toolContext?: unknown,
 *   toolsCalled?: string[],
 *   family?: string,
 *   locale?: string,
 *   workspaceInventory?: unknown,
 *   meetingBrief?: { title?: string, body?: string, documentId?: string | null } | null,
 *   meetingMode?: boolean,
 *   knowledgeContext?: string,
 * }} body
 */
export async function processGinaChatRequest(body = {}) {
  const locale = body.locale === "en" ? "en" : "es";
  const history = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...history].reverse().find((m) => m?.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content.trim() : "";
  if (!userText) {
    return { status: 400, body: { error: "messages with a user turn are required" } };
  }

  // Client-handled clarification turns — no Groq invention
  if (body.family === "name_ambiguity" || body.family === "confirm_date") {
    return {
      status: 200,
      body: {
        reply: fallbackGinaNarration(body.toolContext, locale, body.workspaceInventory),
        source: "clarify",
        message: fallbackGinaNarration(body.toolContext, locale, body.workspaceInventory),
      },
    };
  }

  const toolJson = (() => {
    try {
      return JSON.stringify(body.toolContext ?? {}, null, 2);
    } catch {
      return "{}";
    }
  })();

  const inventoryJson = (() => {
    try {
      return JSON.stringify(body.workspaceInventory ?? {}, null, 2);
    } catch {
      return "{}";
    }
  })();

  const meeting = body.meetingBrief && typeof body.meetingBrief === "object"
    ? body.meetingBrief
    : null;
  const meetingTitle = meeting?.title ? String(meeting.title).trim() : "";
  const meetingBody = meeting?.body ? String(meeting.body).trim() : "";
  const meetingModeOn = Boolean(body.meetingMode) || Boolean(meetingBody) || body.family === "meeting_brief";
  const meetingBlock = meetingBody
    ? [
        "",
        "MEETING BRIEF (skill/doc inserted — LEARN source when admin says aprende esto):",
        `Title: ${meetingTitle || "(untitled)"}`,
        meeting?.documentId ? `Document id: ${meeting.documentId}` : "",
        "---",
        meetingBody.slice(0, 12000),
        "---",
        "If LEARN: summarize + emit <<<GINA_LEARN ... >>> and ask to save to memory.",
        "If ANSWER/test: use GINA TAUGHT MEMORY; do not invent beyond memory + this brief.",
      ].filter(Boolean).join("\n")
    : (meetingModeOn
      ? "\n\nMeeting mode: ON (no skill/doc brief attached — learn from user text, or ask them to select/insert a skill document and say “aprende esto”)."
      : "\n\nMeeting mode: OFF — TOOLS/scope; taught memory only for product meanings already taught.");

  // Taught memory: Meeting always; Talk also gets it for product Q&A
  const knowledgeBlock = typeof body.knowledgeContext === "string" && body.knowledgeContext.trim()
    ? `\n\n${body.knowledgeContext.trim().slice(0, 14000)}`
    : "";

  const system = [
    getGinaSystemPrompt(),
    "",
    `Locale: ${locale}`,
    `Query family: ${body.family || "unknown"}`,
    `Tools called: ${(body.toolsCalled || []).join(", ") || "none"}`,
    meetingModeOn ? "Meeting mode: ON" : "Meeting mode: OFF",
    "",
    "WORKSPACE INVENTORY (live corpus — ONLY name entities listed here):",
    inventoryJson.slice(0, 8000),
    "",
    "TOOL CONTEXT (JSON — ground truth for this answer, do not invent beyond this):",
    toolJson.slice(0, 12000),
    meetingBlock,
    knowledgeBlock,
  ].filter((line) => line !== undefined).join("\n");

  const chatMessages = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      status: 200,
      body: {
        reply: fallbackGinaNarration(body.toolContext, locale, body.workspaceInventory),
        source: "fallback",
      },
    };
  }

  try {
    let reply;
    try {
      reply = await groqChat(apiKey, GROQ_MODEL, { system, messages: chatMessages });
    } catch {
      reply = await groqChat(apiKey, GROQ_FALLBACK_MODEL, { system, messages: chatMessages });
    }
    return { status: 200, body: { reply, source: "groq", message: reply } };
  } catch (err) {
    return {
      status: 200,
      body: {
        reply: fallbackGinaNarration(body.toolContext, locale, body.workspaceInventory),
        source: "fallback",
        warning: err instanceof Error ? err.message : "groq_failed",
      },
    };
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function createGinaChatMiddleware() {
  return async function ginaChatMiddleware(req, res, next) {
    const url = req.url || "";
    if (!url.startsWith("/api/gina/chat")) {
      next();
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
      const result = await processGinaChatRequest(body);
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Gina chat failed",
      }));
    }
  };
}
