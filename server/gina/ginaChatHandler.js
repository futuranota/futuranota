import { getGinaSystemPrompt, fallbackGinaNarration, sanitizeGinaReply } from "./ginaSystemPrompt.js";
import { logApiUsageEvent } from "../management/logApiUsage.js";
import { normalizeLlmUsage } from "../management/apiCostPricing.js";

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
    const usage = data?.usage && typeof data.usage === "object"
      ? {
        prompt_tokens: Number(data.usage.prompt_tokens) || 0,
        completion_tokens: Number(data.usage.completion_tokens) || 0,
      }
      : null;
    return { content: content.trim(), usage, model };
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
 *   userName?: string,
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

  const userName = typeof body.userName === "string" ? body.userName.trim() : "";
  const userNameLabel = userName || (locale === "en" ? "(no name)" : "(sin nombre)");
  const outOfScopeLine = userName
    ? (locale === "en"
      ? `Sorry ${userName}, that is outside my context.`
      : `Disculpa ${userName}, eso está fuera de mi contexto.`)
    : (locale === "en"
      ? "Sorry, that is outside my context."
      : "Disculpa, eso está fuera de mi contexto.");

  // Fixed copy only for hard clarify gates — social/dismiss go to Groq (reasoned, no scope tools)
  if (
    body.family === "name_ambiguity"
    || body.family === "confirm_date"
    || body.family === "unclear"
  ) {
    let toolCtx = body.toolContext;
    if (body.family === "unclear") {
      toolCtx = { ...(typeof toolCtx === "object" && toolCtx ? toolCtx : {}), unclear: true };
    }
    const clarify = fallbackGinaNarration(toolCtx, locale, body.workspaceInventory);
    return {
      status: 200,
      body: {
        reply: clarify,
        source: "clarify",
        message: clarify,
      },
    };
  }

  const isSocial = body.family === "social" || Boolean(body.toolContext && typeof body.toolContext === "object" && body.toolContext.social);
  const isDismiss = body.family === "dismiss" || Boolean(body.toolContext && typeof body.toolContext === "object" && body.toolContext.dismiss);
  const isFreeChat = body.family === "free_chat"
    || body.family === "default_overview"
    || Boolean(body.toolContext && typeof body.toolContext === "object" && body.toolContext.freeChat);
  const isConfirmContinue = body.family === "confirm_continue"
    || Boolean(body.toolContext && typeof body.toolContext === "object" && body.toolContext.confirmContinue);
  const noScopeTools = (isSocial || isDismiss || isFreeChat) && !isConfirmContinue;

  const toolJson = (() => {
    if (isConfirmContinue) {
      try {
        return JSON.stringify(body.toolContext ?? { confirmContinue: true }, null, 2);
      } catch {
        return JSON.stringify({ confirmContinue: true });
      }
    }
    if (isSocial) {
      return JSON.stringify({
        social: true,
        hint: "Casual greeting — reply naturally, short. No document lists. No forced CTA.",
      }, null, 2);
    }
    if (isDismiss) {
      return JSON.stringify({
        dismiss: true,
        hint: "Goodbye / later / rest — warm short close. Do NOT ask how you can help today. No lists.",
      }, null, 2);
    }
    if (isFreeChat) {
      return JSON.stringify({
        freeChat: true,
        hint: "Cordial chat. Personal plans → wish well + pivot to everyday work. No advice, no action offers, no location questions. Soft disclaimer only if they insist on advice/actions outside workflow.",
      }, null, 2);
    }
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
    `User display name: ${userNameLabel}`,
    `Out-of-scope disclaimer template: ${outOfScopeLine}`,
    `Query family: ${body.family || "unknown"}`,
    `Tools called: ${(body.toolsCalled || []).join(", ") || "none"}`,
    meetingModeOn ? "Meeting mode: ON" : "Meeting mode: OFF",
    isSocial ? "SOCIAL TURN: talk normally. Short. No document lists. No life advice or action offers." : "",
    isDismiss ? "DISMISS TURN: say goodbye / good night warmly. Do not offer help for today. No lists." : "",
    isFreeChat && !isConfirmContinue ? "FREE CHAT: cordial. Personal plans → wish well + pivot to everyday tasks (e.g. working from the beach?). NEVER give advice, brands, or offer personal actions. NEVER ask location. Hard disclaimer only if they demand advice/actions outside workflow." : "",
    isConfirmContinue ? "CONFIRM TURN: user said sí/ok. Read the PREVIOUS assistant message. If you offered to review workspace/focus/departments → do that with inventory. If you only asked a soft pivot (e.g. working from the beach?) → acknowledge briefly; do NOT dump document lists unless they asked for scope." : "",
    "",
    "WORKSPACE INVENTORY (live corpus — ONLY name entities listed here):",
    noScopeTools ? "(omitted — conversational turn)" : inventoryJson.slice(0, 8000),
    "",
    "TOOL CONTEXT (JSON — ground truth for this answer, do not invent beyond this):",
    toolJson.slice(0, 12000),
    noScopeTools ? "" : meetingBlock,
    noScopeTools ? "" : knowledgeBlock,
  ].filter((line) => line !== undefined && line !== "").join("\n");

  const chatMessages = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      status: 200,
      body: {
        reply: fallbackGinaNarration(
          isDismiss ? { dismiss: true }
            : (isSocial ? { social: true }
              : (isFreeChat ? { freeChat: true } : body.toolContext)),
          locale,
          body.workspaceInventory,
        ),
        source: "fallback",
      },
    };
  }

  try {
    let chatResult;
    try {
      chatResult = await groqChat(apiKey, GROQ_MODEL, { system, messages: chatMessages });
    } catch {
      chatResult = await groqChat(apiKey, GROQ_FALLBACK_MODEL, { system, messages: chatMessages });
    }
    const reply = chatResult.content;
    const clean = sanitizeGinaReply(
      reply,
      isDismiss ? { dismiss: true }
        : (isSocial ? { social: true }
          : (isFreeChat ? { freeChat: true } : body.toolContext)),
      locale,
      body.workspaceInventory,
    );
    const llmUsage = normalizeLlmUsage(chatResult.usage);
    const userId = typeof body.userId === "string" ? body.userId : undefined;
    const userEmail = typeof body.userEmail === "string" ? body.userEmail : undefined;
    void logApiUsageEvent({
      userId,
      userEmail,
      provider: "groq",
      endpoint: "gina/chat",
      routeLabel: "Gina",
      inputTokens: llmUsage?.inputTokens,
      outputTokens: llmUsage?.outputTokens,
      model: chatResult.model,
      billed: true,
      meta: { family: body.family || null, locale },
    });
    return { status: 200, body: { reply: clean, source: "groq", message: clean } };
  } catch (err) {
    const fallback = fallbackGinaNarration(
      isDismiss ? { dismiss: true }
        : (isSocial ? { social: true }
          : (isFreeChat ? { freeChat: true } : body.toolContext)),
      locale,
      body.workspaceInventory,
    );
    return {
      status: 200,
      body: {
        reply: fallback,
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
