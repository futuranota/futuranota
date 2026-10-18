import { describe, expect, it } from "vitest";
import {
  applyMarks,
  joinPdfPageTexts,
  joinParagraphs,
  numberTranscriptParagraphs,
  parseStructurePayload,
  prepareSheetFields,
  validateStructure,
} from "./promptStructure.js";

const ALLOWED = ["openai", "claude", "grok", "gemini"];

describe("numberTranscriptParagraphs", () => {
  it("numbers the edited sheet and keeps page markers out of the map", () => {
    const { numbered, map, ids } = numberTranscriptParagraphs(
      "--- PAGE 1 ---\nPaso 01\n\n[info here]\n--- page 2 ---\nPrompt\nSigue la frase",
    );
    expect(ids).toEqual(["1", "2", "3"]);
    expect(map.get("1")).toBe("Paso 01");
    expect(map.get("2")).toBe("[info here]");
    expect(map.get("3")).toBe("Prompt\nSigue la frase");
    expect(numbered).toContain("--- PAGE 1 ---");
    expect(numbered).toContain("--- PAGE 2 ---");
    expect(numbered).not.toContain("[5]");
  });

  it("uses the current text, not an older extract", () => {
    const { map } = numberTranscriptParagraphs("Texto editado en la hoja");
    expect([...map.values()]).toEqual(["Texto editado en la hoja"]);
  });
});

describe("joinPdfPageTexts", () => {
  it("leaves a single page without a marker", () => {
    expect(joinPdfPageTexts(["Solo una", ""])).toBe("Solo una");
  });

  it("keeps the original page number when a page is empty", () => {
    expect(joinPdfPageTexts(["Uno", "", "Tres"])).toBe("--- PAGE 1 ---\nUno\n\n--- PAGE 3 ---\nTres");
  });
});

describe("validateStructure", () => {
  const ids = ["1", "2", "3"];

  it("rejects broken JSON", () => {
    expect(parseStructurePayload("no es json")).toBeNull();
    expect(validateStructure(parseStructurePayload("{"), ids, ALLOWED).ok).toBe(false);
  });

  it("rejects a repeated id", () => {
    const result = validateStructure({
      sheets: [{ instruction: [1], prompt: [1], model: "claude" }],
      extra: [2, 3],
    }, ids, ALLOWED);
    expect(result.ok).toBe(false);
  });

  it("keeps a missing paragraph as instruction, in order", () => {
    const result = validateStructure({
      sheets: [{ instruction: [], prompt: [3], model: "none" }],
      extra: [],
    }, ids, ALLOWED);
    expect(result.ok).toBe(true);
    expect(result.sheets[0].instruction).toEqual(["1", "2"]);
    expect(result.sheets[0].prompt).toEqual(["3"]);
  });

  it("treats an unknown model as none", () => {
    const result = validateStructure({
      sheets: [{ instruction: [1], prompt: [2], model: "banana" }],
      extra: [3],
    }, ids, ALLOWED);
    expect(result.ok).toBe(true);
    expect(result.sheets[0].model).toBe("none");
  });

  it("maps ChatGPT and Claude onto the selector ids", () => {
    const ten = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const result = validateStructure({
      sheets: [
        { instruction: [1], prompt: [2], model: "Claude" },
        { instruction: [3], prompt: [4], model: "none" },
        { instruction: [5], prompt: [6], model: "ChatGPT" },
        { instruction: [7], prompt: [8], model: "" },
        { instruction: [9], prompt: [10], model: "gemini" },
      ],
      extra: [],
    }, ten, ALLOWED);
    expect(result.ok).toBe(true);
    expect(result.sheets.map((sheet) => sheet.model)).toEqual([
      "claude",
      "none",
      "openai",
      "none",
      "gemini",
    ]);
  });
});

describe("prepareSheetFields", () => {
  it("creates a variable from [info here] and marks the rest by code", () => {
    const map = new Map([
      ["1", "Paso 01"],
      ["2", "Usa [info here] y escribe HELLO a hola@correo.com ¿listo? ¡vamos!"],
    ]);
    const prepared = prepareSheetFields(
      joinParagraphs(["1"], map),
      joinParagraphs(["2"], map),
      [],
    );
    expect(prepared.variables).toHaveLength(1);
    expect(prepared.variables[0].name).toBe("info here");
    expect(prepared.prompt).toContain(`<mark>{{${prepared.variables[0].id}}}</mark>`);
    expect(prepared.prompt).toContain("<strong>HELLO</strong>");
    expect(prepared.prompt).toContain("<u>hola@correo.com</u>");
    expect(prepared.prompt).toContain("<em>¿listo?</em>");
    expect(prepared.prompt).toContain("<strong>¡vamos!</strong>");
    expect(prepared.instruction).toBe("Paso 01");
  });

  it("does not invent marks when the line is plain", () => {
    expect(applyMarks("una frase normal")).toBe("una frase normal");
  });
});
