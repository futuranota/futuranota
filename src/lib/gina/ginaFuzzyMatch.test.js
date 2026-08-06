import { describe, expect, it } from "vitest";
import {
  editDistance,
  nearMatchToken,
  phoneticFoldEs,
  textHasNearPhrase,
  textHasNearToken,
} from "./ginaFuzzyMatch.js";

describe("ginaFuzzyMatch", () => {
  it("editDistance counts single insertion", () => {
    expect(editDistance("departamenos", "departamentos")).toBe(1);
  });

  it("nearMatchToken matches Departamenos ≈ departamentos", () => {
    expect(nearMatchToken("Departamenos", "departamentos")).toBe(true);
    expect(nearMatchToken("departamento", "departamentos")).toBe(true);
  });

  it("phoneticFoldEs maps b↔v", () => {
    expect(phoneticFoldEs("ba")).toBe(phoneticFoldEs("va"));
    expect(nearMatchToken("barco", "varco")).toBe(true);
  });

  it("does not fuzzy-match very short tokens alone", () => {
    expect(nearMatchToken("ba", "va")).toBe(true); // phonetic equal after fold
    expect(nearMatchToken("ba", "be")).toBe(false);
    expect(nearMatchToken("xy", "zz")).toBe(false);
  });

  it("textHasNearToken finds typoed department entity", () => {
    expect(
      textHasNearToken("Cuantos Departamenos tenemos", [
        "departamento",
        "departamentos",
      ]),
    ).toBe(true);
    expect(textHasNearToken("hola gina", ["departamento"])).toBe(false);
  });

  it("textHasNearPhrase finds how many / en general", () => {
    expect(textHasNearPhrase("how many departments", ["how many"])).toBe(true);
    expect(textHasNearPhrase("cuantos en general", ["en general"])).toBe(true);
    expect(textHasNearPhrase("hola", ["en general"])).toBe(false);
  });
});
