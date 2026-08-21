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
  it("menu has three stable action ids (es)", () => {
    const menu = buildGinaDocActionsMenu({ locale: "es" });
    expect(menu.map((x) => x.id)).toEqual([
      "doc_action_organize",
      "doc_action_pdf_to_text",
      "doc_action_export",
    ]);
    expect(menu[0].label).toBe("Organizar documento");
    expect(menu[1].label).toBe("Convertir PDF a texto editable");
    expect(menu[2].label).toBe("Exportar documento");
  });

  it("menu EN labels", () => {
    const menu = buildGinaDocActionsMenu({ locale: "en" });
    expect(menu[0].label).toBe("Organize document");
    expect(menu[1].label).toBe("Convert PDF to editable text");
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
    expect(buildGinaPdfToTextMessage({ locale: "es" }).length).toBeGreaterThan(20);
    expect(buildGinaExportPromptMessage({ locale: "es" }).length).toBeGreaterThan(20);
    expect(buildGinaOrganizeAppliedAck({ locale: "es", styleId: "doc_organize_style_standard" }))
      .toContain("estándar");
  });
});
