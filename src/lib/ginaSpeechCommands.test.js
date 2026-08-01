import { describe, expect, it } from "vitest";
import {
  absorbDictationFinal,
  extractTrailingSpeechEdit,
  normalizeDeletePhraseQuery,
  removeFuzzyPhrase,
} from "./ginaSpeechCommands.js";

describe("Mode B — arm borrar then phrase", () => {
  it("arms on trailing borrar alone", () => {
    expect(extractTrailingSpeechEdit("Hola Gina borrar")?.command)
      .toEqual({ action: "arm_delete_phrase" });
    expect(absorbDictationFinal("Hola Gina", "borrar")).toEqual({
      text: "Hola Gina",
      didEdit: false,
      deletePhraseArmed: true,
    });
  });

  it("arms on borame / borar soft-R", () => {
    expect(absorbDictationFinal("texto", "borame").deletePhraseArmed).toBe(true);
    expect(absorbDictationFinal("texto", "borar").deletePhraseArmed).toBe(true);
  });

  it("deletes fuzzy phrase after arm", () => {
    const buffer = 'Entregame el cancion dekesi documento de la musica';
    const armed = absorbDictationFinal(buffer, "borrar");
    expect(armed.deletePhraseArmed).toBe(true);

    const deleted = absorbDictationFinal(armed.text, "el cancion dekesi", {
      deletePhraseArmed: true,
    });
    expect(deleted.didEdit).toBe(true);
    expect(deleted.deletePhraseArmed).toBe(false);
    expect(deleted.text.toLowerCase()).toContain("entregame");
    expect(deleted.text.toLowerCase()).toContain("documento");
    expect(deleted.text.toLowerCase()).not.toContain("dekesi");
  });

  it("keeps arm and reports miss when phrase not found", () => {
    const miss = absorbDictationFinal("Hola Gina buenos dias", "xyzzy foobar", {
      deletePhraseArmed: true,
    });
    expect(miss).toMatchObject({
      text: "Hola Gina buenos dias",
      didEdit: false,
      deletePhraseArmed: true,
      phraseMiss: true,
    });
  });

  it("cancels arm with cancelar", () => {
    expect(absorbDictationFinal("Hola", "cancelar", { deletePhraseArmed: true }))
      .toEqual({
        text: "Hola",
        didEdit: false,
        deletePhraseArmed: false,
      });
  });
});

describe("removeFuzzyPhrase", () => {
  it("matches noisy STT against buffer", () => {
    const out = removeFuzzyPhrase(
      "Entregame el cancion dekesi documento de la musica",
      'el cancion dekesi',
    );
    expect(out.ok).toBe(true);
    expect(out.text).toBe("Entregame documento de la musica");
  });

  it("strips leading borrar from query", () => {
    expect(normalizeDeletePhraseQuery('borrar "el cancion dekesi"'))
      .toBe("el cancion dekesi");
  });
});

describe("shortcuts still work", () => {
  it("borra dos palabras", () => {
    expect(absorbDictationFinal("uno dos tres cuatro", "borra dos palabras")).toEqual({
      text: "uno dos",
      didEdit: true,
      deletePhraseArmed: false,
    });
  });

  it("borrame esta oracion arms? no — deletes sentence shortcut", () => {
    const r = absorbDictationFinal("Hola Gina. Busca marketing.", "borrame esta oracion");
    expect(r.didEdit).toBe(true);
    expect(r.deletePhraseArmed).toBe(false);
    expect(r.text).toBe("Hola Gina.");
  });
});
