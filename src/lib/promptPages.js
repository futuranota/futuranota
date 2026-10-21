/** Page 1 = instructions. Later pages = pure prompts. */

export const INSTRUCTION_SECTION_MARK = "\n\n--- STEP ---\n\n";

const TITLE_LINE = /^(?:step|paso)\s+\d+\b/i;

function makeId() {
  return crypto.randomUUID();
}

function hasText(value) {
  return Boolean(String(value || "").replace(/<\/?(?:strong|em|u|s|mark|h1|ul|li)>/gi, "").trim());
}

function hasMedia(step) {
  return Boolean(String(step?.image || "").trim() || String(step?.imagePath || "").trim())
    || Number.isInteger(step?.pdfPage);
}

export function isTranscriptPrompt(prompt) {
  return prompt?.meta === "Transcript";
}

export function isInstructionIndex(prompt, index) {
  if (isTranscriptPrompt(prompt)) return false;
  return index === 0;
}

/**
 * Instruction page = 0. Prompt pages start at 1.
 * Transcripts keep 1-based file pages.
 * @param {object} prompt
 * @param {number} index
 * @param {number} total
 */
export function filePageCaption(prompt, index, total) {
  const count = Math.max(Number(total) || 0, 1);
  const current = Math.max(Number(index) || 0, 0);
  if (isTranscriptPrompt(prompt)) return `${current + 1} / ${count}`;
  const prompts = Math.max(count - 1, 1);
  return `${current === 0 ? 0 : current} / ${prompts}`;
}

export function visibleStepTitle(step, fileName) {
  const title = String(step?.title || "").trim();
  if (title) return title;
  return String(fileName || "").trim();
}

export function blankInstructionStep(id = makeId()) {
  return {
    id,
    title: "",
    modelIds: [],
    description: "",
    prompt: "",
    image: "",
    imagePath: "",
    pdfPage: null,
    video: null,
    pdf: null,
    format: "text",
    promptSaved: false,
    sheetFace: 0,
  };
}

export function blankPromptStep(id = makeId()) {
  return {
    id,
    title: "",
    modelIds: [],
    description: "",
    prompt: "",
    image: "",
    imagePath: "",
    pdfPage: null,
    video: null,
    pdf: null,
    format: "text",
    promptSaved: false,
    sheetFace: 1,
  };
}

/**
 * @param {string} text
 * @returns {{ title: string, body: string }[]}
 */
export function readInstructionSections(text) {
  const raw = String(text || "").trim();
  if (!raw) return [{ title: "Step 1", body: "" }];
  const parts = raw.split(INSTRUCTION_SECTION_MARK);
  return parts.map((part, index) => {
    const lines = String(part || "").replace(/\r\n/g, "\n").split("\n");
    const first = (lines[0] || "").trim();
    if (TITLE_LINE.test(first)) {
      return { title: first, body: lines.slice(1).join("\n").trim() };
    }
    return { title: `Step ${index + 1}`, body: String(part || "").trim() };
  });
}

/**
 * @param {{ title?: string, body?: string }[]} sections
 */
export function writeInstructionSections(sections) {
  const list = (sections || []).length ? sections : [{ title: "Step 1", body: "" }];
  return list.map((section, index) => {
    const title = String(section?.title || "").trim() || `Step ${index + 1}`;
    const body = String(section?.body || "").trim();
    return body ? `${title}\n${body}` : title;
  }).join(INSTRUCTION_SECTION_MARK);
}

export function promptPagesAreSplit(steps) {
  if (!steps?.length) return false;
  if (hasText(steps[0].prompt) || hasMedia(steps[0])) return false;
  return steps.slice(1).every((item) => !hasText(item.description));
}

function ensurePromptPage(steps, createId) {
  if (steps.length > 1) return steps;
  return [...steps, blankPromptStep(createId())];
}

/**
 * Lift mixed instruction/prompt pages into page 1 + prompt pages.
 * Transcripts stay as a single prompt page.
 * @param {object} prompt
 * @param {{ makeId?: () => string }} [options]
 */
export function normalizePromptFile(prompt, options = {}) {
  if (!prompt || isTranscriptPrompt(prompt)) return prompt;
  const createId = options.makeId || makeId;
  const source = prompt.steps?.length ? prompt.steps : [blankInstructionStep(createId())];
  if (promptPagesAreSplit(source)) {
    const steps = ensurePromptPage(source, createId);
    return {
      ...prompt,
      steps,
      stepIndex: Math.min(Math.max(Number(prompt.stepIndex) || 0, 0), steps.length - 1),
    };
  }

  const sections = [];
  const promptPages = [];
  for (const item of source) {
    if (hasText(item.description)) {
      sections.push({ title: "", body: item.description });
    }
    if (hasText(item.prompt) || hasMedia(item)) {
      promptPages.push({
        ...item,
        description: "",
        sheetFace: 1,
      });
    }
  }

  const instruction = {
    ...blankInstructionStep(createId()),
    description: writeInstructionSections(
      sections.length
        ? sections.map((section, index) => ({
          title: `Step ${index + 1}`,
          body: section.body,
        }))
        : [{ title: "Step 1", body: "" }],
    ),
    promptSaved: sections.some((section) => hasText(section.body)),
  };

  return {
    ...prompt,
    steps: [instruction, ...(promptPages.length ? promptPages : [blankPromptStep(createId())])],
    stepIndex: 0,
  };
}

/**
 * @param {{ instruction?: string, prompt?: string, model?: string }[]} sheets
 * @param {{ makeId?: () => string }} [options]
 */
export function stepsFromOrganizedSheets(sheets, options = {}) {
  const createId = options.makeId || makeId;
  const sections = (sheets || []).map((sheet, index) => ({
    title: `Step ${index + 1}`,
    body: String(sheet.instruction || "").trim(),
  })).filter((section) => section.body);

  const instruction = {
    ...blankInstructionStep(createId()),
    description: writeInstructionSections(sections.length ? sections : [{ title: "Step 1", body: "" }]),
    promptSaved: false,
  };

  const prompts = (sheets || []).map((sheet) => {
    if (!hasText(sheet.prompt)) return null;
    return {
      ...blankPromptStep(createId()),
      prompt: sheet.prompt,
      modelIds: sheet.model && sheet.model !== "none" ? [sheet.model] : [],
      promptSaved: false,
    };
  }).filter(Boolean);

  return [instruction, ...(prompts.length ? prompts : [blankPromptStep(createId())])];
}

/**
 * @param {object[]} steps
 * @param {{ instruction?: string, prompt?: string, model?: string }[]} sheets
 * @param {{ makeId?: () => string }} [options]
 */
export function appendOrganizedSheets(steps, sheets, options = {}) {
  const createId = options.makeId || makeId;
  const current = normalizePromptFile({ meta: "Prompt", steps }, { makeId: createId }).steps;
  const incoming = stepsFromOrganizedSheets(sheets, { makeId: createId });
  const existing = readInstructionSections(current[0].description).filter((section) => hasText(section.body));
  const added = readInstructionSections(incoming[0].description).filter((section) => hasText(section.body));
  const merged = [...existing, ...added].map((section, index) => ({
    ...section,
    title: TITLE_LINE.test(section.title) ? `Step ${index + 1}` : section.title,
  }));
  return [
    {
      ...current[0],
      description: writeInstructionSections(merged.length ? merged : [{ title: "Step 1", body: "" }]),
      promptSaved: false,
    },
    ...current.slice(1),
    ...incoming.slice(1),
  ];
}
