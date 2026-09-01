import { describe, expect, it } from "vitest";
import {
  applyOrganizeScriptToWritingBlocks,
  cleanScriptHeadingTitle,
  cleanScriptLineMarkers,
  expandBracketActions,
  fixTightPunctuation,
  normalizeScriptText,
  normalizeScriptTextWithBold,
  pickRandomMarkerColorId,
  reflowScriptLines,
} from "./organizeScriptPaste.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  NODE_BLOCK_TYPES,
} from "./nodeInlineContent.js";
import { DOC_TEXT_MARKER_COLORS } from "./docTextMarkerColors.js";

describe("expandBracketActions", () => {
  it("converts a full-line bracket action to an arrow line", () => {
    expect(expandBracketActions("[Pausa]")).toBe("-> Pausa");
  });

  it("splits inline brackets onto their own arrow lines", () => {
    const out = expandBracketActions('Intro [Pausa] fin');
    expect(out).toContain("-> Pausa");
    expect(out).toMatch(/Intro/);
    expect(out).toMatch(/fin/);
  });
});

describe("fixTightPunctuation", () => {
  it("inserts a space after commas glued to the next word", () => {
    expect(fixTightPunctuation("cajas,defino los tags")).toBe("cajas, defino los tags");
  });
});

describe("reflowScriptLines", () => {
  it("joins soft-wrapped dialogue inside open quotes", () => {
    const lines = [
      '"Mi trabajo es mantener este sistema funcionando. Yo creo las cajas,',
      "defino los tags, organizo los documentos.",
      'Tú defines el qué, yo me encargo del cómo."',
    ];
    const out = reflowScriptLines(lines);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/cajas, defino los tags/);
    expect(out[0]).toMatch(/del cómo\."$/);
  });
});

describe("normalizeScriptText", () => {
  it("normalizes line-start arrows and collapses blank runs", () => {
    const text = "⇒ Gina camina\n\n\n\"Hola\"";
    expect(normalizeScriptText(text)).toBe('-> Gina camina\n\n"Hola"');
  });

  it("reflows dialogue and spaces action blocks like example 02", () => {
    const text = [
      "-> Camina de nuevo hacia los estantes, señalando las cajas",
      '"Mi trabajo es mantener este sistema funcionando. Yo creo las cajas,',
      "defino los tags, organizo los documentos.",
      'Tú defines el qué, yo me encargo del cómo."',
      "[Pausa]",
    ].join("\n");

    const out = normalizeScriptText(text);
    expect(out).toBe(
      [
        "-> Camina de nuevo hacia los estantes, señalando las cajas",
        "",
        '"Mi trabajo es mantener este sistema funcionando. Yo creo las cajas, defino los tags, organizo los documentos. Tú defines el qué, yo me encargo del cómo."',
        "",
        "-> Pausa",
      ].join("\n"),
    );
  });
});

describe("pickRandomMarkerColorId", () => {
  it("picks yellow when rng returns 0", () => {
    expect(pickRandomMarkerColorId(() => 0)).toBe("yellow");
  });

  it("always returns a valid marker color id", () => {
    const id = pickRandomMarkerColorId();
    expect(DOC_TEXT_MARKER_COLORS.some((c) => c.id === id)).toBe(true);
  });
});

describe("cleanScriptLineMarkers", () => {
  it("turns **Label** — body into label line + body line with bold and marker", () => {
    const out = cleanScriptLineMarkers(
      "**GoAffPro** — Plan Hobby completamente gratis para empezar sin riesgo",
      "yellow",
    );
    expect(out.lines).toEqual([
      "GoAffPro:",
      "Plan Hobby completamente gratis para empezar sin riesgo",
    ]);
    expect(out.boldRanges).toEqual([{ start: 0, end: 9 }]);
    expect(out.markerRanges).toEqual([{ start: 0, end: 9, colorId: "yellow" }]);
  });

  it("splits and marks clean Label: body rows like UpPromote", () => {
    const out = cleanScriptLineMarkers(
      "UpPromote: Integrada con Shopify, plan gratuito limitado pero funcional para empezar",
      "yellow",
    );
    expect(out.lines[0]).toBe("UpPromote:");
    expect(out.lines[1]).toMatch(/^Integrada con Shopify/);
    expect(out.boldRanges).toEqual([{ start: 0, end: 10 }]);
    expect(out.markerRanges[0].colorId).toBe("yellow");
  });

  it("cleans --Label — body marker rows onto two lines", () => {
    const out = cleanScriptLineMarkers(
      "--Trackdesk — Gratis mientras tus ingresos se mantengan por debajo del umbral",
      "yellow",
    );
    expect(out.lines[0]).toBe("Trackdesk:");
    expect(out.lines[1]).toMatch(/^Gratis mientras/);
    expect(out.boldRanges).toEqual([{ start: 0, end: 10 }]);
  });

  it("uses the same session color on already-split label lines", () => {
    const out = cleanScriptLineMarkers("GoAffPro:", "mint");
    expect(out.lines).toEqual(["GoAffPro:"]);
    expect(out.markerRanges[0].colorId).toBe("mint");
  });

  it("leaves script action lines untouched", () => {
    const out = cleanScriptLineMarkers("-> Gina camina hacia la cámara");
    expect(out.lines).toEqual(["-> Gina camina hacia la cámara"]);
    expect(out.boldRanges).toEqual([]);
    expect(out.markerRanges).toEqual([]);
  });
});

describe("cleanScriptHeadingTitle", () => {
  it("strips ** wrappers from heading titles", () => {
    expect(cleanScriptHeadingTitle("**Listing de links affiliados**"))
      .toBe("Listing de links affiliados");
  });
});

describe("normalizeScriptTextWithBold", () => {
  const fixedRng = () => 0;

  it("applies affiliate list cleanup with bold and marker ranges on split lines", () => {
    const text = [
      "**GoAffPro** — Plan Hobby completamente gratis para empezar",
      "**Post Affiliate Pro** — Treinta días gratis para probar sin tarjeta",
    ].join("\n");
    const { text: out, boldRanges, markerRanges } = normalizeScriptTextWithBold(text, fixedRng);
    const lines = out.split("\n");
    expect(lines[0]).toBe("GoAffPro:");
    expect(lines[1]).toMatch(/^Plan Hobby/);
    expect(lines[2]).toBe("Post Affiliate Pro:");
    expect(lines[3]).toMatch(/^Treinta días/);
    expect(boldRanges.some((r) => out.slice(r.start, r.end) === "GoAffPro:")).toBe(true);
    expect(boldRanges.some((r) => out.slice(r.start, r.end) === "Post Affiliate Pro:")).toBe(true);
    const colorIds = markerRanges.map((r) => r.colorId);
    expect(colorIds).toEqual(["yellow", "yellow"]);
    expect(markerRanges.every((r) => DOC_TEXT_MARKER_COLORS.some((c) => c.id === r.colorId))).toBe(true);
  });

  it("picks one color per run and may change on the next run", () => {
    const text = [
      "**GoAffPro** — Plan Hobby",
      "**Trackdesk** — Gratis mientras",
    ].join("\n");
    const first = normalizeScriptTextWithBold(text, () => 0);
    const second = normalizeScriptTextWithBold(text, () => 0.99);
    expect(first.markerRanges.map((r) => r.colorId)).toEqual(["yellow", "yellow"]);
    expect(second.markerRanges.map((r) => r.colorId)).toEqual(["blue", "blue"]);
  });
});

describe("applyOrganizeScriptToWritingBlocks", () => {
  it("merges TEXT gaps into one block without touching H1", () => {
    const before = [
      createInlineH1Block("Bienvenido"),
      createEmptyTextBlock("[Pausa]"),
      createEmptyTextBlock(""),
      createEmptyTextBlock('"Hola"'),
    ];
    const { blocks, changed } = applyOrganizeScriptToWritingBlocks(before);
    expect(changed).toBe(true);
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(blocks[0].title).toBe("Bienvenido");
    const textBlocks = blocks.filter((b) => b.type === NODE_BLOCK_TYPES.TEXT && b.text?.trim());
    expect(textBlocks).toHaveLength(1);
    expect(textBlocks[0].text).toContain("-> Pausa");
    expect(textBlocks[0].text).toContain('"Hola"');
  });

  it("is a no-op when script is already normalized and collapsed", () => {
    const script = '-> Pausa\n\n"Hola"';
    const before = [
      createInlineH1Block("Título"),
      createEmptyTextBlock(script),
    ];
    const { changed } = applyOrganizeScriptToWritingBlocks(before);
    expect(changed).toBe(false);
  });

  it("cleans affiliate rows onto split lines with markers and strips ** from H1 title", () => {
    const before = [
      createInlineH1Block("**Listing de links affiliados**"),
      createEmptyTextBlock("**GoAffPro** — Plan Hobby completamente gratis para empezar"),
      createEmptyTextBlock("UpPromote: Integrada con Shopify, plan gratuito limitado pero funcional"),
    ];
    const first = applyOrganizeScriptToWritingBlocks(before);
    expect(first.changed).toBe(true);
    expect(first.blocks[0].title).toBe("Listing de links affiliados");
    const textBlock = first.blocks.find((b) => b.type === NODE_BLOCK_TYPES.TEXT && b.text?.includes("GoAffPro"));
    const lines = textBlock?.text?.split("\n") ?? [];
    expect(lines[0]).toBe("GoAffPro:");
    expect(lines[1]).toMatch(/^Plan Hobby/);
    expect(textBlock?.boldRanges?.length).toBeGreaterThan(0);
    expect(textBlock?.markerRanges?.length).toBeGreaterThan(0);

    const second = applyOrganizeScriptToWritingBlocks(first.blocks);
    const textBlock2 = second.blocks.find((b) => b.type === NODE_BLOCK_TYPES.TEXT && b.text?.includes("GoAffPro"));
    expect(textBlock2?.text?.split("\n")).toEqual(lines);
  });
});
