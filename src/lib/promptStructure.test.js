import { describe, expect, it } from "vitest";
import {
  applyMarks,
  joinPdfPageTexts,
  joinParagraphs,
  markAssistanceText,
  markCardsFromTranscript,
  numberTranscriptParagraphs,
  paintReviewHighlights,
  parseStructurePayload,
  prepareSheetFields,
  readAssistanceMarkers,
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

  it("starts a new paragraph at the pasteable block", () => {
    const { map } = numberTranscriptParagraphs("Prompt 1: Encargo\nActúa como un editor");
    expect([...map.values()]).toEqual(["Prompt 1: Encargo", "Actúa como un editor"]);
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

describe("markAssistanceText", () => {
  it("marks instruction and prompt with the original words", () => {
    const map = new Map([
      ["1", "Explica el encuadre"],
      ["2", "Usa luz suave"],
    ]);
    expect(markAssistanceText([{ instruction: ["1"], prompt: ["2"] }], map)).toBe(
      [
        "<strong>--//Página 01 · Instrucción//--</strong>",
        "Explica el encuadre",
        "<strong>--//terminado//--</strong>",
        "<strong>--//Página 01 · Prompt//--</strong>",
        "Usa luz suave",
        "<strong>--//terminado//--</strong>",
      ].join("\n"),
    );
  });
});

describe("review markers", () => {
  const guide = [
    "Prompt 1: Conexión",
    "Plataforma Objetivo: Claude",
    "La Magia del Modelo",
    "Actúa como un estratega",
    "Instrucciones:",
    "1. Redacta el anuncio",
    "Prompt 2: Destructor",
    "Plataforma Objetivo: GPT-4o",
    "Actúa como un especialista e-commerce",
    "Futura Nota — Guía de Implementación Página 2 de 2",
  ].join("\n");

  it("splits each Prompt N card and drops the footer", () => {
    const marked = markCardsFromTranscript(guide);
    expect(marked).toContain("<strong>--//Página 01 · Instrucción//--</strong>");
    expect(marked).toContain("<strong>--//Página 02 · Prompt//--</strong>");
    expect(marked).not.toContain("Página 2 de 2");
    const sheets = readAssistanceMarkers(marked);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].instruction).toContain("Plataforma Objetivo: Claude");
    expect(sheets[0].instruction).not.toContain("Actúa como");
    expect(sheets[0].prompt).toContain("Actúa como un estratega");
    expect(sheets[0].prompt).toContain("1. Redacta el anuncio");
    expect(sheets[1].prompt).toContain("e-commerce");
  });

  it("highlights only the prompt slice in yellow", () => {
    const painted = paintReviewHighlights("Prompt: Conexión\nPágina 01\nPlataforma Objetivo\nprompting");
    expect(painted).toBe("<mark>Prompt</mark>: Conexión\nPágina 01\nPlataforma Objetivo\n<mark>prompt</mark>ing");
    expect(paintReviewHighlights(painted)).toBe(painted);
    expect(paintReviewHighlights('<mark>@canal</mark> Prompt:')).toBe(
      '<mark>@canal</mark> <mark>Prompt</mark>:',
    );
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
