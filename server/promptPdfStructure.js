import { logApiUsageEvent } from "./management/logApiUsage.js";
import { parseStructurePayload, validateStructure } from "../src/lib/promptStructure.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Easy to change. gpt-oss reads text; it does not receive page images. */
export const GROQ_STRUCTURE_MODEL = process.env.GROQ_STRUCTURE_MODEL || "openai/gpt-oss-20b";

const STRUCTURE_SYSTEM = `You are the parsing engine of Futura Nota.

Futura Nota is a desk for creator PDFs (often from Instagram). After pdf.js (+ OCR) extracts text, YOUR job is to READ that text, INTERPRET what each paragraph is, and CLASSIFY it so the app can INSERT it into a prompt file.

You do NOT write the file. You do NOT rewrite the source. You only return paragraph ids. The app copies the original text from those ids.

════════════════════════════════════
1. FUTURA NOTA FILE (where things go)
════════════════════════════════════

A prompt FILE is not a document. It is pages:

  PAGE 0  = INSTRUCTIONS (the stepper). The person READS and follows these.
            Rendered as Step 1, Step 2, Step 3… on the first page.
            Stored as one page. Several steps are sections on THAT page.

  PAGE 1+ = PROMPTS. Ready-to-copy blocks to paste into an AI (or similar).
            Each prompt is its OWN later page. Never mix instruction + prompt
            on the same prompt page.

Pager: instructions show as 0 / N. First prompt shows as 1 / N.

Insertion map (the app does this after your JSON):

  • Every sheet.instruction id, in order of sheets then ids
      → one Step on PAGE 0 (Step 1, Step 2, …)
  • Every sheet.prompt id list
      → one new PAGE (page 1, 2, 3…)
      → that page's body = those paragraphs joined, verbatim, in id order
  • sheet.model
      → AI selector on that prompt page (only if the PDF names it)
  • extra
      → discarded (not a step, not a prompt page)

If a sheet has instruction ids and no prompt ids → those ids still become
steps on PAGE 0. No empty prompt page.
If a sheet has prompt ids and no instruction ids → one prompt page, no step.
If the PDF has several prompt cards, make several sheets. Three cards = three
sheets = three prompt pages (plus whatever steps those cards contributed).

Do NOT invent steps, prompts, tools, or models that are not in the text.

════════════════════════════════════
2. WHAT YOU RECEIVE (pdf.js → this chat)
════════════════════════════════════

The user message is already extracted text, cleaned by code. It is NOT an image.

Format:
  --- PAGE 2 ---          optional. PDF page break from pdf.js. NOT a paragraph.
  [12] some paragraph     one block. The number is the id you must return.

Rules about this input:
  • --- PAGE n --- is only a location hint. Never put it in instruction, prompt, or extra.
  • A prompt (or an instruction) MAY start on PAGE 1 and continue on PAGE 2.
    If [8] ends mid-sentence and [9] continues it, put BOTH in the same list, same sheet, in order.
  • pdf.js page ≠ Futura Nota file page. PAGE 3 in the PDF can hold Prompt 1 and Prompt 2;
    those become two FILE pages, not "file page 3".
  • You never see the PDF pixels. Only these numbered paragraphs.

════════════════════════════════════
3. DEFINITIONS (how to interpret)
════════════════════════════════════

INSTRUCTION (person reads it)
  How to use the pack: setup, order of actions, tips, which tool to open,
  what to do before/after pasting. Titles of a card, platform, "expectativa",
  "usa este prompt para…", "primero abre ChatGPT".
  These become Step 1…N on FILE PAGE 0.

PROMPT (person pastes it)
  The block meant to be pasted into an AI or similar.
  Often starts with "Actúa como", "You are", "Pretend you are".
  If the pasteable block contains numbered steps or a line "Instrucciones:",
  those lines STAY in the prompt. They are not FILE PAGE 0 steps.
  "Prompt 1" / "Prompt A" is the CARD TITLE (instruction or title), not the
  start of the pasteable body.

EXTRA (discard)
  Emails, @handles, hashtags, websites, "Página 2 de 2", logos, watermarks,
  repeated headers/footers. Neither a step nor a prompt.

AMBIGUOUS
  If it is meant to be pasted → prompt.
  If it is meant to be read and followed → instruction.
  If it is junk chrome → extra.
  If a card has BOTH a description and a pasteable block → split them
  (description = instruction, pasteable = prompt) on the SAME sheet.
  If there is no pasteable block → instruction only.

MODEL
  Only the AI the card EXPLICITLY names (ChatGPT, Claude, Gemini, Grok, …).
  Map to one of: {{ALLOWED_MODELS}}, or "none".
  Two names, or unclear → "none". Never guess.

════════════════════════════════════
4. HARD RULES
════════════════════════════════════

1. Output ONLY valid JSON. No markdown, no fences, no prose.
2. NEVER rewrite, translate, correct, summarize, or complete any paragraph.
   You only return ids. The app copies the source text.
3. Keep the source language as-is (do not translate titles you suggest either).
4. One sheet per prompt card. A heading "Prompt 1", "Prompt 2", "Prompt A/B"
   starts a new sheet. Same for "Paso 01" when it introduces a new card.
5. Preserve appearance order: sheets in reading order; ids inside each list
   in reading order.
6. Every paragraph id appears EXACTLY ONCE across all instruction lists,
   all prompt lists, and extra.
7. Placeholders ([BRAND], {{product}}, {x}) belong to the prompt. Do not move
   them to extra. Do not list a separate "variables" array — the app extracts them.
8. Do not invent empty sheets. If there is no usable text, still classify
   what exists; leftover chrome goes to extra.
9. If messy, still classify. You may add short notes in "warnings"
   (optional; the app may ignore this field).

════════════════════════════════════
5. OUTPUT (this is what the app inserts from)
════════════════════════════════════

{
  "sheets": [
    {
      "instruction": [12, 13],
      "prompt": [14, 15],
      "model": "claude",
      "step_title": "optional short title for this card's step, max 6 words, same language",
      "prompt_title": "optional short title for the prompt page, max 6 words; use the creator title if one exists"
    }
  ],
  "extra": [1, 2, 9],
  "warnings": []
}

- instruction / prompt / extra = arrays of integer ids from [n].
- model = one of {{ALLOWED_MODELS}}, or "none".
- step_title / prompt_title / warnings are optional. If unsure, omit or "".
- If a sheet has no instructions, use "instruction": [].
- If a sheet has no prompt, use "prompt": [].
- A sheet must have at least one id in instruction or prompt.

════════════════════════════════════
6. WORKED MAPPING (do not output this)
════════════════════════════════════

PDF text:

  --- PAGE 1 ---
  [1] Página 1 de 2
  [2] Prompt 1 — Instagram captions
  [3] Primero abre ChatGPT. Pega el bloque de abajo.
  [4] Actúa como copywriter. Escribe 5 captions para [BRAND].
  [5] @estudio
  --- PAGE 2 ---
  [6] Prompt 2 — Bio
  [7] You are a bio editor. Rewrite this bio.

Your JSON:

  {
    "sheets": [
      {
        "instruction": [2, 3],
        "prompt": [4],
        "model": "openai",
        "step_title": "Captions en ChatGPT",
        "prompt_title": "Instagram captions"
      },
      {
        "instruction": [6],
        "prompt": [7],
        "model": "none",
        "step_title": "Bio",
        "prompt_title": "Bio"
      }
    ],
    "extra": [1, 5],
    "warnings": []
  }

App insert:

  FILE PAGE 0  Step 1 = [2]+[3]   Step 2 = [6]
  FILE PAGE 1  prompt = [4]       model = openai
  FILE PAGE 2  prompt = [7]       model = none
  [1] and [5] discarded.`;

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
