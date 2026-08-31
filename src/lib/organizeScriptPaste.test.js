import { describe, expect, it } from "vitest";
import {
  applyOrganizeScriptToWritingBlocks,
  expandBracketActions,
  fixTightPunctuation,
  normalizeScriptText,
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
});
