import { describe, expect, it } from "vitest";
import {
  buildListRefineCommand,
  buildResaltarCategoryChipText,
  extractCategoryHintFromDocsSyntax,
  resolveListRefineSelection,
  wantsDocsByCategorySyntax,
} from "./ginaSyntaxDocsByCategory.js";

describe("ginaSyntaxDocsByCategory", () => {
  it("detects NL / Resaltar / comando directo / slash / legacy", () => {
    expect(wantsDocsByCategorySyntax("entregame todos los docs que sean de Blogs")).toBe(true);
    expect(wantsDocsByCategorySyntax("dame los documentos de Blogs")).toBe(true);
    expect(wantsDocsByCategorySyntax("Resaltar Campaigns Results")).toBe(true);
    expect(wantsDocsByCategorySyntax("Filtrar y resaltar: Blogs")).toBe(true);
    expect(wantsDocsByCategorySyntax(' /buscar --categoria "Blogs" --resaltar')).toBe(true);
    expect(wantsDocsByCategorySyntax("Listado completo categorías: Blogs")).toBe(true);
    expect(wantsDocsByCategorySyntax("entregame todos los documentos")).toBe(false);
  });

  it("extracts category hints across variants", () => {
    expect(extractCategoryHintFromDocsSyntax("entregame todos los docs que sean de Blogs"))
      .toMatch(/blogs/i);
    expect(extractCategoryHintFromDocsSyntax("Resaltar Blogs")).toMatch(/blogs/i);
    expect(extractCategoryHintFromDocsSyntax("Filtrar y resaltar: Blogs")).toMatch(/blogs/i);
    expect(extractCategoryHintFromDocsSyntax("Filtrar y resaltar: Blogs · con horarios"))
      .toMatch(/^blogs$/i);
    expect(extractCategoryHintFromDocsSyntax('/buscar --categoria "Blogs" --resaltar'))
      .toMatch(/blogs/i);
    expect(extractCategoryHintFromDocsSyntax("categorías: Campaign Results")).toMatch(/campaign/i);
    expect(extractCategoryHintFromDocsSyntax("dame los docs de Informes")).toMatch(/informes/i);
  });

  it("chip text is direct command (no Entrégame redundancy)", () => {
    const text = buildResaltarCategoryChipText("Blogs", { locale: "es" });
    expect(text).toBe("Filtrar y resaltar: Blogs");
    expect(text).not.toMatch(/entr[eé]game/i);
    expect(text).not.toMatch(/categor[ií]as?\s*:/i);

    const withLayers = buildResaltarCategoryChipText("Blogs", {
      locale: "es",
      showSchedule: true,
    });
    expect(withLayers).toBe("Filtrar y resaltar: Blogs · con horarios");
  });

  it("buildListRefineCommand + resolveListRefineSelection", () => {
    expect(buildListRefineCommand({
      categories: ["Blogs"],
      showSchedule: true,
      showStatus: true,
      locale: "es",
    })).toBe("Filtrar y resaltar: Blogs · con horarios · con status");

    expect(resolveListRefineSelection({
      categories: ["Blogs"],
      omit: true,
      locale: "es",
    })).toEqual({
      action: "send",
      command: "Filtrar y resaltar: Blogs",
    });

    expect(resolveListRefineSelection({
      showSchedule: true,
      locale: "es",
    })).toEqual({
      action: "send",
      command: "Listado completo con horarios",
    });

    expect(resolveListRefineSelection({ omit: true })).toEqual({ action: "dismiss" });
    expect(resolveListRefineSelection({ categories: ["Blogs"] })).toEqual({ action: "wait" });
  });
});
