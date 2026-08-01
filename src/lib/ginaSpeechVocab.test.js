import { describe, expect, it } from "vitest";
import {
  normalizeDictationTranscript,
  buildSpeechReplaceRules,
} from "./ginaSpeechVocab.js";

describe("normalizeDictationTranscript", () => {
  it("restores Spanish rr (borar→borrar, bores→borres)", () => {
    expect(normalizeDictationTranscript("necesito que me bores algo")).toBe(
      "necesito que me borres algo",
    );
    expect(normalizeDictationTranscript("quiero borar dos lineas")).toContain("borrar");
    expect(normalizeDictationTranscript("borame esta seccion")).toContain("borrame");
  });

  it("fixes Gina + marketing + estadísticas variants", () => {
    const raw =
      "Hola jina buenos dias Como puedas cincuentra un document Because merketing Um estadisticas";
    const out = normalizeDictationTranscript(raw);
    expect(out).toContain("Gina");
    expect(out).toContain("buscar");
    expect(out).toContain("documento");
    expect(out).toContain("marketing");
    expect(out).toContain("estadísticas");
  });

  it("normalizes schedule and status terms", () => {
    const out = normalizeDictationTranscript(
      "puedes programar un schedule para today in progress y un reminder",
    );
    expect(out).toContain("programar");
    expect(out).toContain("horario");
    expect(out).toContain("hoy");
    expect(out).toContain("en progreso");
    expect(out).toContain("recordatorio");
  });

  it("leaves unknown words intact", () => {
    expect(normalizeDictationTranscript("hola mundo xyz")).toBe("hola mundo xyz");
  });

  it("returns empty for blank input", () => {
    expect(normalizeDictationTranscript("   ")).toBe("");
  });
});

describe("buildSpeechReplaceRules", () => {
  it("sorts longer patterns first", () => {
    const rules = buildSpeechReplaceRules([
      { canonical: "en progreso", variants: ["progreso", "en progreso"] },
    ]);
    expect(rules[0].pattern.toLowerCase()).toContain("en progreso");
  });
});
