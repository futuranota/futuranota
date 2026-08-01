import { describe, expect, it } from "vitest";
import {
  absorbDictationFinal,
  applySpeechEdit,
  extractTrailingSpeechEdit,
  peelTrailingSpeechEdits,
} from "./ginaSpeechCommands.js";

describe("extractTrailingSpeechEdit — natural Spanish", () => {
  it("parses borrar dos palabras / borrar esta oracion", () => {
    expect(extractTrailingSpeechEdit("hola borrar dos palabras")?.command)
      .toEqual({ action: "delete_words", count: 2 });
    expect(extractTrailingSpeechEdit("texto borrar esta oracion")?.command)
      .toEqual({ action: "delete_sentence" });
  });

  it("maps borame / vorame to borrame (soft R → rr)", () => {
    expect(extractTrailingSpeechEdit("texto borame dos palabras")?.command)
      .toEqual({ action: "delete_words", count: 2 });
    expect(extractTrailingSpeechEdit("texto vorame esta oracion")?.command)
      .toEqual({ action: "delete_sentence" });
    expect(extractTrailingSpeechEdit("texto vorame dos palabras")?.remainder)
      .toBe("texto");
  });

  it("parses borame estoración (STT drop-r + mashup)", () => {
    expect(extractTrailingSpeechEdit("Hola Gina Buenos dias Borame estoración")?.command)
      .toEqual({ action: "delete_sentence" });
    expect(extractTrailingSpeechEdit("Hola Gina Buenos dias Borame estoración")?.remainder)
      .toBe("Hola Gina Buenos dias");
  });

  it("parses borrame dos palabras", () => {
    const hit = extractTrailingSpeechEdit("hola mundo borrame dos palabras");
    expect(hit?.command).toEqual({ action: "delete_words", count: 2 });
    expect(hit?.remainder).toBe("hola mundo");
  });

  it("parses borrame esta oracion / horacion", () => {
    expect(extractTrailingSpeechEdit("borrame esta oración")?.command)
      .toEqual({ action: "delete_sentence" });
    expect(extractTrailingSpeechEdit("borrame esta horacion")?.command)
      .toEqual({ action: "delete_sentence" });
  });

  it("parses borrame la / esta ultima oracion", () => {
    expect(extractTrailingSpeechEdit("texto borrame la ultima oracion")?.command)
      .toEqual({ action: "delete_sentence" });
    expect(extractTrailingSpeechEdit("borrame esta ultima oracion")?.command)
      .toEqual({ action: "delete_sentence" });
  });
});

describe("peelTrailingSpeechEdits", () => {
  it("strips repeated failed-command echoes", () => {
    const peeled = peelTrailingSpeechEdits(
      "Hola Gina Buenos dias Borame estoración Borame estoración",
    );
    expect(peeled.content).toBe("Hola Gina Buenos dias");
    expect(peeled.command).toEqual({ action: "delete_sentence" });
    expect(peeled.peeled).toBe(true);
  });
});

describe("absorbDictationFinal — split finals", () => {
  it("matches when verb and noun arrive in separate finals", () => {
    const step1 = absorbDictationFinal("Hola Gina Buenos dias", "Borame");
    expect(step1).toEqual({
      text: "Hola Gina Buenos dias Borame",
      didEdit: false,
    });
    const step2 = absorbDictationFinal(step1.text, "estoración");
    expect(step2).toEqual({
      text: "Hola Gina Buenos dias",
      didEdit: true,
    });
  });

  it("handles the exact user transcript in one chunk", () => {
    expect(
      absorbDictationFinal("", "Hola Gina Buenos dias Borame estoración Borame estoración"),
    ).toEqual({
      text: "Hola Gina Buenos dias",
      didEdit: true,
    });
  });

  it("applies borrame dos palabras to existing buffer", () => {
    expect(absorbDictationFinal("Hola Gina un documento un documento", "borrame dos palabras"))
      .toEqual({
        text: "Hola Gina un documento",
        didEdit: true,
      });
  });

  it("appends normal speech", () => {
    expect(absorbDictationFinal("Hola Gina", "buenos dias")).toEqual({
      text: "Hola Gina buenos dias",
      didEdit: false,
    });
  });
});

describe("applySpeechEdit", () => {
  it("deletes last N words", () => {
    expect(applySpeechEdit("uno dos tres cuatro", { action: "delete_words", count: 2 }))
      .toBe("uno dos");
  });

  it("keeps short greeting when deleting sentence without punctuation", () => {
    expect(applySpeechEdit("Hola Gina Buenos dias", { action: "delete_sentence" }))
      .toBe("Hola Gina Buenos dias");
  });

  it("deletes last sentence when punctuated", () => {
    expect(applySpeechEdit("Hola Gina. Busca marketing.", { action: "delete_sentence" }))
      .toBe("Hola Gina.");
  });
});
