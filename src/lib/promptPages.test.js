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
  it("names the instruction page 0 and the first prompt 1", () => {
    expect(filePageCaption({ meta: "Prompt" }, 0, 2)).toBe("0 / 1");
    expect(filePageCaption({ meta: "Prompt" }, 1, 2)).toBe("1 / 1");
    expect(filePageCaption({ meta: "Prompt" }, 2, 3)).toBe("2 / 2");
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

  it("splits mixed faces into instructions then prompts", () => {
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
    expect(promptPagesAreSplit(next.steps)).toBe(true);
    expect(next.steps).toHaveLength(3);
    expect(next.steps[0].prompt).toBe("");
    expect(readInstructionSections(next.steps[0].description).map((item) => item.body)).toEqual(["Haz A", "Haz B"]);
    expect(next.steps[1].prompt).toBe("Actúa como A");
    expect(next.steps[1].description).toBe("");
    expect(next.steps[2].prompt).toBe("Actúa como B");
  });

  it("does not re-split a file that is already page 1 + prompts", () => {
    const steps = [
      { id: "i", prompt: "", description: "Step 1\nLee" },
      { id: "p", prompt: "Actúa", description: "" },
    ];
    const next = normalizePromptFile({ meta: "Prompt", steps });
    expect(next.steps).toEqual(steps);
  });
});

describe("stepsFromOrganizedSheets", () => {
  it("puts every instruction on page 1 and each prompt on its own page", () => {
    n = 0;
    const steps = stepsFromOrganizedSheets([
      { instruction: "Rol editor", prompt: "Actúa como editor", model: "claude", prompt_title: "Editor" },
      { instruction: "Rol ads", prompt: "Actúa como ads", model: "openai" },
    ], { makeId: ids() });
    expect(steps).toHaveLength(3);
    expect(steps[0].prompt).toBe("");
    expect(readInstructionSections(steps[0].description).map((item) => item.body)).toEqual([
      "Rol editor",
      "Rol ads",
    ]);
    expect(steps[1].prompt).toBe("Actúa como editor");
    expect(steps[1].title).toBe("Editor");
    expect(steps[1].modelIds).toEqual(["claude"]);
    expect(steps[2].modelIds).toEqual(["openai"]);
  });

  it("appends new prompt pages and merges instruction steps", () => {
    n = 0;
    const next = appendOrganizedSheets(
      [
        { id: "i", prompt: "", description: writeInstructionSections([{ title: "Step 1", body: "Ya" }]) },
        { id: "p", prompt: "Viejo", description: "" },
      ],
      [{ instruction: "Nuevo", prompt: "Actúa nuevo", model: "none" }],
      { makeId: ids() },
    );
    expect(next).toHaveLength(3);
    expect(readInstructionSections(next[0].description).map((item) => item.body)).toEqual(["Ya", "Nuevo"]);
    expect(next[2].prompt).toBe("Actúa nuevo");
  });
});
