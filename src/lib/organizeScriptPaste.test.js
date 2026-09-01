import { describe, expect, it } from "vitest";
import {
  applyOrganizeScriptToWritingBlocks,
  cleanScriptHeadingTitle,
  cleanScriptLineMarkers,
  expandBracketActions,
  fixTightPunctuation,
  normalizeScriptText,
  normalizeScriptTextWithBold,
  reflowScriptLines,
} from "./organizeScriptPaste.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  NODE_BLOCK_TYPES,
} from "./nodeInlineContent.js";

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

describe("cleanScriptLineMarkers", () => {
  it("turns **Label** — body into bold label with colon", () => {
    const out = cleanScriptLineMarkers(
      "**GoAffPro** — Plan Hobby completamente gratis para empezar sin riesgo",
    );
    expect(out.line).toBe(
      "GoAffPro: Plan Hobby completamente gratis para empezar sin riesgo",
    );
    expect(out.boldRanges).toEqual([{ start: 0, end: 8 }]);
  });

  it("bolds clean Label: body rows like UpPromote", () => {
    const out = cleanScriptLineMarkers(
      "UpPromote: Integrada con Shopify, plan gratuito limitado pero funcional para empezar",
    );
    expect(out.line).toMatch(/^UpPromote:/);
    expect(out.boldRanges).toEqual([{ start: 0, end: 9 }]);
  });

  it("cleans --Label — body marker rows", () => {
    const out = cleanScriptLineMarkers(
      "--Trackdesk — Gratis mientras tus ingresos se mantengan por debajo del umbral",
    );
    expect(out.line).toMatch(/^Trackdesk:/);
    expect(out.boldRanges).toEqual([{ start: 0, end: 9 }]);
  });

  it("leaves script action lines untouched", () => {
    const out = cleanScriptLineMarkers("-> Gina camina hacia la cámara");
    expect(out.line).toBe("-> Gina camina hacia la cámara");
    expect(out.boldRanges).toEqual([]);
  });
});

describe("cleanScriptHeadingTitle", () => {
  it("strips ** wrappers from heading titles", () => {
    expect(cleanScriptHeadingTitle("**Listing de links affiliados**"))
      .toBe("Listing de links affiliados");
  });
});

describe("normalizeScriptTextWithBold", () => {
  it("applies affiliate list cleanup with bold ranges", () => {
    const text = [
      "**GoAffPro** — Plan Hobby completamente gratis para empezar",
      "**Post Affiliate Pro** — Treinta días gratis para probar sin tarjeta",
    ].join("\n");
    const { text: out, boldRanges } = normalizeScriptTextWithBold(text);
    expect(out).toContain("GoAffPro: Plan Hobby");
    expect(out).toContain("Post Affiliate Pro: Treinta días");
    expect(boldRanges.some((r) => r.start === 0 && r.end === 8)).toBe(true);
    expect(boldRanges.some((r) => out.slice(r.start, r.end) === "Post Affiliate Pro")).toBe(true);
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

  it("cleans affiliate rows and strips ** from H1 title", () => {
    const before = [
      createInlineH1Block("**Listing de links affiliados**"),
      createEmptyTextBlock("**GoAffPro** — Plan Hobby completamente gratis para empezar"),
      createEmptyTextBlock("UpPromote: Integrada con Shopify, plan gratuito limitado pero funcional"),
    ];
    const first = applyOrganizeScriptToWritingBlocks(before);
    expect(first.changed).toBe(true);
    expect(first.blocks[0].title).toBe("Listing de links affiliados");
    const textBlock = first.blocks.find((b) => b.type === NODE_BLOCK_TYPES.TEXT && b.text?.includes("GoAffPro"));
    expect(textBlock?.text).toContain("GoAffPro: Plan Hobby");
    expect(textBlock?.boldRanges?.length).toBeGreaterThan(0);

    const second = applyOrganizeScriptToWritingBlocks(first.blocks);
    expect(second.changed).toBe(false);
  });
});
