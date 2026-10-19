import { describe, expect, it } from "vitest";
import { chunkText, splitProtected, translateDeskText } from "./promptTranslate.js";

describe("translateDeskText", () => {
  it("translates prose and keeps markers, tags, variables, and urls", async () => {
    const source = [
      "<strong>--//Página 01 · Instrucción//--</strong>",
      "Hola {{nombre}}",
      "Mira https://futuranota.com/docs",
      "<h1>Titulo</h1>",
    ].join("\n");

    const seen = [];
    const result = await translateDeskText(source, "en", async (pieces) => {
      seen.push(...pieces);
      return pieces.map((piece) => piece.replaceAll("Hola", "Hello").replaceAll("Mira", "See").replaceAll("Titulo", "Title"));
    });

    expect(result).toContain("<strong>--//Página 01 · Instrucción//--</strong>");
    expect(result).toContain("{{nombre}}");
    expect(result).toContain("https://futuranota.com/docs");
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("Hello {{nombre}}");
    expect(seen.join("\n")).not.toContain("{{nombre}}");
    expect(seen.join("\n")).not.toContain("--//");
    expect(seen.join("\n")).not.toContain("https://");
    expect(seen.join("\n")).not.toContain("<h1>");
  });

  it("splits a long block without cutting the only break", () => {
    const block = `${"a".repeat(100)}\n${"b".repeat(5000)}`;
    const chunks = chunkText(block, 4000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(block);
  });

  it("leaves an empty string untouched", async () => {
    const called = [];
    const result = await translateDeskText("   ", "es", async (pieces) => {
      called.push(pieces);
      return pieces;
    });
    expect(result).toBe("   ");
    expect(called).toHaveLength(0);
  });

  it("keeps a marker line as one protected span", () => {
    const parts = splitProtected("--//Página 02 · Prompt//--\nEscribe el cierre");
    expect(parts[0]).toEqual({ keep: true, value: "--//Página 02 · Prompt//--" });
    expect(parts.some((part) => part.value.includes("Escribe"))).toBe(true);
  });
});
