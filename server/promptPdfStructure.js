import { logApiUsageEvent } from "./management/logApiUsage.js";
import { parseStructurePayload, validateStructure } from "../src/lib/promptStructure.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Easy to change. gpt-oss reads text; it does not receive page images. */
export const GROQ_STRUCTURE_MODEL = process.env.GROQ_STRUCTURE_MODEL || "openai/gpt-oss-20b";

const STRUCTURE_SYSTEM = `You split OCR text into prompt sheets. The input has numbered paragraphs like [12] text, and optional page markers like --- PAGE 2 ---.
NEVER rewrite, translate, correct or fill in any text. You only return paragraph numbers.

Return ONLY valid JSON with this shape:
{"sheets":[{"instruction":[ids],"prompt":[ids],"model":"one of: {{ALLOWED_MODELS}}, none"}],"extra":[ids]}

Rules:
1. One sheet per prompt card. A heading such as "Prompt 1", "Prompt 2", "Prompt A" or "Prompt B" starts its own sheet. Three cards on a page mean three sheets.
2. A prompt can be cut by a page break. If a paragraph ends mid-sentence and the next one continues it, put BOTH in the same list, in order.
3. instruction = the card title, the target platform, and the short expectation for the reader (for example "La Magia del Modelo & Expectativa"). Stop before the block the reader will paste into another model.
4. prompt = that pasteable block. It often starts with "Actúa como" or "You are". Numbered steps inside it, including a line that says "Instrucciones:", stay in the prompt. Do not leave prompt empty when that block exists. The words "Prompt 1" are the card title, not the start of this block.
5. extra (top level, not per sheet) = emails, @handles, hashtags, websites, page numbers, footers ("Página 2 de 2"), logos, watermarks. A footer is neither instruction nor prompt.
6. model = the AI the card explicitly recommends. If it names more than one, or it is unclear, use "none". Never guess.
7. Every paragraph id appears exactly once across all lists.
8. Placeholders like [text], {text} and {{text}} belong to the prompt. Never change them.
9. When a card has both a description and a pasteable block, split them. If there is no pasteable block, choose instruction.`;

function structureSystem(allowedModels) {
  const list = (allowedModels || []).map((id) => String(id).trim()).filter(Boolean);
  return STRUCTURE_SYSTEM.replace("{{ALLOWED_MODELS}}", list.join(", "));
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

function softFail() {
  return { status: 200, body: { ok: false, aiUseCounted: false } };
}

/**
 * One Groq call. Returns paragraph ids only. Usage is logged only when the JSON validates.
 * No quota counter and no limit in this function.
 * @param {{ text?: string, ids?: string[], allowedModels?: string[], userId?: string, userEmail?: string }} body
 */
export async function structurePdfText(body) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  const allowedModels = Array.isArray(body.allowedModels) ? body.allowedModels.map(String) : [];
  if (!text || !ids.length) return softFail();

  const apiKey = process.env.GROQ_API_KEY || process.env.Groq_Api_key;
  if (!apiKey) {
    console.warn("[prompt-structure] GROQ_API_KEY is not set");
    return softFail();
  }

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_STRUCTURE_MODEL,
        temperature: 0,
        max_completion_tokens: 16384,
        reasoning_effort: "low",
        reasoning_format: "hidden",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: structureSystem(allowedModels) },
          { role: "user", content: `${text}\n\nThere are ${ids.length} paragraph ids, from 1 to ${ids.length}. Assign every id exactly once.` },
        ],
      }),
    });
  } catch (error) {
    console.warn("[prompt-structure] request failed", error?.message || error);
    return softFail();
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("[prompt-structure] groq failed", response.status, payload?.error?.message || "");
    return softFail();
  }

  const content = payload?.choices?.[0]?.message?.content || "";
  const checked = validateStructure(
    parseStructurePayload(content),
    ids,
    allowedModels,
  );
  if (!checked.ok) {
    console.warn("[prompt-structure] invalid", checked.reason || "parse", payload?.choices?.[0]?.finish_reason || "", String(content).slice(0, 400));
    return softFail();
  }

  const usage = normalizeUsage(payload?.usage);
  void logApiUsageEvent({
    userId: typeof body.userId === "string" ? body.userId : undefined,
    userEmail: typeof body.userEmail === "string" ? body.userEmail : undefined,
    provider: "groq",
    endpoint: "prompts/read",
    routeLabel: "Prompt structure",
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    model: GROQ_STRUCTURE_MODEL,
    billed: true,
    meta: { pass: "structure", sheets: checked.sheets.length },
  });

  return {
    status: 200,
    body: {
      ok: true,
      aiUseCounted: true,
      sheets: checked.sheets,
      extra: checked.extra,
    },
  };
}
