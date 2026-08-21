import { describe, expect, it } from "vitest";
import {
  buildGinaDocActionsMenu,
  buildGinaExportFollowUpChips,
  buildGinaExportFormatChips,
  buildGinaExportLearnMoreMessage,
  buildGinaExportDestPromptMessage,
  buildGinaOrganizeStyleChips,
  buildGinaOrganizePromptMessage,
  buildGinaExportPromptMessage,
  buildGinaPdfToTextMessage,
  buildGinaOrganizeAppliedAck,
  buildGinaExportAppliedAck,
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
      "Prepara la exportación de tu documento en PDF o Markdown; guárdalo en la biblioteca o descárgalo de inmediato.",
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

  it("export format chips include learn more by default", () => {
    const chips = buildGinaExportFormatChips({ locale: "es" });
    expect(chips.map((c) => c.action)).toEqual(["pdf", "markdown", "learn_more"]);
    expect(chips[2].label).toBe("Saber más");
  });

  it("export format chips can omit learn more", () => {
    const chips = buildGinaExportFormatChips({ locale: "es", includeLearnMore: false });
    expect(chips.map((c) => c.action)).toEqual(["pdf", "markdown"]);
  });

  it("export follow-up chips map by format", () => {
    expect(buildGinaExportFollowUpChips({ locale: "es", format: "pdf" }).map((c) => c.action))
      .toEqual(["save_pdf_library", "export_pdf"]);
    expect(buildGinaExportFollowUpChips({ locale: "es", format: "markdown" }).map((c) => c.action))
      .toEqual(["save_md_library", "export_md"]);
  });

  it("prompt messages cover format → dest → learn more", () => {
    expect(buildGinaOrganizePromptMessage({ locale: "es" }).length).toBeGreaterThan(20);
    expect(buildGinaPdfToTextMessage({ locale: "es" })).toMatch(/Upload/);
    expect(buildGinaExportPromptMessage({ locale: "es" })).toMatch(/formato/);
    expect(buildGinaExportDestPromptMessage({ locale: "es", format: "pdf" })).toContain("PDF");
    expect(buildGinaExportDestPromptMessage({ locale: "es", format: "markdown" }))
      .toContain("Markdown");
    expect(buildGinaExportLearnMoreMessage({ locale: "es" })).toMatch(/Markdown/);
    expect(buildGinaOrganizeAppliedAck({ locale: "es", styleId: "doc_organize_style_standard" }))
      .toContain("estándar");
    expect(buildGinaExportAppliedAck({ locale: "es", action: "export_md" }))
      .toMatch(/Markdown/);
  });
});
