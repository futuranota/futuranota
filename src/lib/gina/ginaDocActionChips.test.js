import { describe, expect, it } from "vitest";
import {
  buildGinaDocActionsMenu,
  buildGinaExportFollowUpChips,
  buildGinaOrganizeStyleChips,
  buildGinaOrganizePromptMessage,
  buildGinaExportPromptMessage,
  buildGinaPdfToTextMessage,
  buildGinaOrganizeAppliedAck,
} from "./ginaDocActionChips.js";

describe("ginaDocActionChips", () => {
  it("menu has three stable action ids when writing is empty (es)", () => {
    const menu = buildGinaDocActionsMenu({ locale: "es", writingEmpty: true });
    expect(menu.map((x) => x.id)).toEqual([
      "doc_action_organize",
      "doc_action_pdf_to_text",
      "doc_action_export",
    ]);
    expect(menu[0].label).toBe("Organizar documento");
    expect(menu[0].hint).toBe(
      "Pule la redacción, elimina redundancias y aporta una estructura limpia y profesional.",
    );
    expect(menu[1].label).toBe("PDF → text");
    expect(menu[1].hint).toBe(
      "Sube un archivo PDF desde tu ordenador al área de trabajo (puedes conservar el título actual).",
    );
    expect(menu[2].label).toBe("Exportar documento");
    expect(menu[2].hint).toBe(
      "Prepara tu documento para exportarlo en PDF; guárdalo en la biblioteca o descárgalo de inmediato.",
    );
  });

  it("hides PDF option when writing is not empty", () => {
    const menu = buildGinaDocActionsMenu({ locale: "es", writingEmpty: false });
    expect(menu.map((x) => x.id)).toEqual([
      "doc_action_organize",
      "doc_action_export",
    ]);
  });

  it("defaults to including PDF when writingEmpty omitted", () => {
    const menu = buildGinaDocActionsMenu({ locale: "es" });
    expect(menu.some((x) => x.id === "doc_action_pdf_to_text")).toBe(true);
  });

  it("menu EN labels", () => {
    const menu = buildGinaDocActionsMenu({ locale: "en", writingEmpty: true });
    expect(menu[0].label).toBe("Organize document");
    expect(menu[1].label).toBe("PDF → text");
    expect(menu[2].label).toBe("Export document");
  });

  it("organize style chips map to organize action", () => {
    const chips = buildGinaOrganizeStyleChips({ locale: "es" });
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => c.action === "organize")).toBe(true);
    expect(chips.map((c) => c.id)).toEqual([
      "doc_organize_style_standard",
      "doc_organize_style_story",
      "doc_organize_style_pro",
    ]);
  });

  it("export follow-up chips map to library / download", () => {
    const chips = buildGinaExportFollowUpChips({ locale: "es" });
    expect(chips.map((c) => c.action)).toEqual(["save_pdf_library", "export_pdf"]);
  });

  it("prompt messages are non-empty", () => {
    expect(buildGinaOrganizePromptMessage({ locale: "es" }).length).toBeGreaterThan(20);
    expect(buildGinaPdfToTextMessage({ locale: "es" })).toMatch(/Upload/);
    expect(buildGinaExportPromptMessage({ locale: "es" })).toBe(
      "Listo, prepararé la exportación de este documento en formato PDF.\n"
      + "Antes de continuar, dime: ¿quieres guardarlo de forma permanente en la Biblioteca "
      + "para futuros proyectos, o prefieres descargarlo de inmediato?",
    );
    expect(buildGinaOrganizeAppliedAck({ locale: "es", styleId: "doc_organize_style_standard" }))
      .toContain("estándar");
  });
});
