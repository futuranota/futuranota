import { describe, expect, it } from "vitest";
import {
  appendOrganizedSheets,
  filePageCaption,
  instructionThread,
  normalizePromptFile,
  promptPagesAreSplit,
  readInstructionSections,
  stepsFromOrganizedSheets,
  visibleStepTitle,
  writeInstructionSections,
} from "./promptPages.js";

let n = 0;
function ids() {
  return () => `id-${n++}`;
}

describe("filePageCaption", () => {
  it("uses 1-based pages for prompt files", () => {
    expect(filePageCaption({ meta: "Prompt" }, 0, 2)).toBe("1 / 2");
    expect(filePageCaption({ meta: "Prompt" }, 1, 2)).toBe("2 / 2");
    expect(filePageCaption({ meta: "Prompt" }, 2, 3)).toBe("3 / 3");
  });

  it("keeps transcripts 1-based", () => {
    expect(filePageCaption({ meta: "Transcript" }, 0, 1)).toBe("1 / 1");
  });
});

describe("visibleStepTitle", () => {
  it("falls back to the file instance name", () => {
    expect(visibleStepTitle({ title: "" }, "guia.pdf")).toBe("guia.pdf");
    expect(visibleStepTitle({ title: "Editor" }, "guia.pdf")).toBe("Editor");
  });
});

describe("instruction sections", () => {
  it("round-trips titled blocks", () => {
    const text = writeInstructionSections([
      { title: "Step 1", body: "Lee el brief" },
      { title: "Step 2", body: "Pega el prompt" },
    ]);
    expect(readInstructionSections(text)).toEqual([
      { title: "Step 1", body: "Lee el brief" },
      { title: "Step 2", body: "Pega el prompt" },
    ]);
  });

  it("shows Step 2 as a thread after Step 1", () => {
    const thread = instructionThread([{ title: "Step 1", body: "" }]);
    expect(thread.map((item) => [item.title, item.peek])).toEqual([
      ["Step 1", false],
      ["Step 2", true],
    ]);
  });

  it("keeps a single unmarked block as Step 1", () => {
    expect(readInstructionSections("Solo esto")).toEqual([
      { title: "Step 1", body: "Solo esto" },
    ]);
  });
});

describe("normalizePromptFile", () => {
  it("leaves transcripts alone", () => {
    const prompt = { meta: "Transcript", steps: [{ id: "t", prompt: "hola", description: "" }] };
    expect(normalizePromptFile(prompt)).toBe(prompt);
  });

  it("does not treat a single empty prompt as a legacy instruction page", () => {
    const steps = [{ id: "p", prompt: "", description: "", image: "", imagePath: "" }];
    const next = normalizePromptFile({ meta: "Prompt", steps, stepIndex: 0 });
    expect(promptPagesAreSplit(steps)).toBe(false);
    expect(next.steps).toHaveLength(1);
    expect(next.steps[0].id).toBe("p");
  });

  it("drops a legacy instruction page and keeps prompts", () => {
    n = 0;
    const next = normalizePromptFile({
      meta: "Prompt",
      name: "pack.pdf",
      stepIndex: 1,
      steps: [
        { id: "i", title: "", description: "Step 1\nLee", prompt: "", image: "", imagePath: "" },
        { id: "a", title: "", description: "", prompt: "Actúa como A", image: "", imagePath: "" },
        { id: "b", title: "", description: "", prompt: "Actúa como B", image: "", imagePath: "" },
      ],
    }, { makeId: ids() });
    expect(promptPagesAreSplit(next.steps)).toBe(false);
    expect(next.steps).toHaveLength(2);
    expect(next.steps[0].prompt).toBe("Actúa como A");
    expect(next.steps[1].prompt).toBe("Actúa como B");
    expect(next.stepIndex).toBe(0);
  });

  it("turns mixed faces into prompt-only pages", () => {
    n = 0;
    const next = normalizePromptFile({
      meta: "Prompt",
      name: "pack.pdf",
      stepIndex: 0,
      steps: [
        { id: "a", title: "", description: "Haz A", prompt: "Actúa como A", image: "", imagePath: "" },
        { id: "b", title: "", description: "Haz B", prompt: "Actúa como B", image: "", imagePath: "" },
      ],
    }, { makeId: ids() });
    expect(next.steps).toHaveLength(2);
    expect(next.steps[0].prompt).toBe("Actúa como A");
    expect(next.steps[0].description).toBe("Haz A");
    expect(next.steps[1].prompt).toBe("Actúa como B");
  });
});

describe("stepsFromOrganizedSheets", () => {
  it("creates one prompt page per sheet (no instruction page)", () => {
    n = 0;
    const steps = stepsFromOrganizedSheets([
      { instruction: "Rol editor", prompt: "Actúa como editor", model: "claude", prompt_title: "Editor" },
      { instruction: "Rol ads", prompt: "Actúa como ads", model: "openai" },
    ], { makeId: ids() });
    expect(steps).toHaveLength(2);
    expect(steps[0].prompt).toBe("Actúa como editor");
    expect(steps[0].title).toBe("Editor");
    expect(steps[0].description).toBe("Rol editor");
    expect(steps[0].modelIds).toEqual(["claude"]);
    expect(steps[1].modelIds).toEqual(["openai"]);
  });

  it("appends new prompt pages", () => {
    n = 0;
    const next = appendOrganizedSheets(
      [
        { id: "p", prompt: "Viejo", description: "" },
      ],
      [{ instruction: "Nuevo", prompt: "Actúa nuevo", model: "none" }],
      { makeId: ids() },
    );
    expect(next).toHaveLength(2);
    expect(next[0].prompt).toBe("Viejo");
    expect(next[1].prompt).toBe("Actúa nuevo");
    expect(next[1].description).toBe("Nuevo");
  });
});
