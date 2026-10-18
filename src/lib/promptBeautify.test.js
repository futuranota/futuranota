import { describe, expect, it } from "vitest";
import { beautifyPromptFields } from "./promptBeautify.js";

describe("beautifyPromptFields", () => {
  it("creates variables only from the prompt and leaves instruction placeholders as text", () => {
    const result = beautifyPromptFields(
      "Sigue [nota] y mira @canal",
      "Usa [info here] y el @canal",
      [],
    );
    expect(result.description).toContain("[nota]");
    expect(result.description).toContain("<mark>@canal</mark>");
    expect(result.description).not.toContain("{{");
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe("info here");
    expect(result.prompt).toContain(`{{${result.variables[0].id}}}`);
    expect(result.prompt).toContain("<mark>@canal</mark>");
    expect(result.prompt).not.toContain("[info here]");
  });

  it("leaves each headline as an h1 and marks only the text around it", () => {
    const result = beautifyPromptFields(
      "<h1>Pasos</h1>\nmira @canal",
      "<h1>Paso 01 @canal</h1>\nUsa [info here] y TITULO",
      [],
    );
    expect(result.description.startsWith("<h1>Pasos</h1>")).toBe(true);
    expect(result.description).toContain("<mark>@canal</mark>");
    expect(result.prompt.startsWith("<h1>Paso 01 @canal</h1>")).toBe(true);
    expect(result.prompt).toContain("<strong>TITULO</strong>");
    expect(result.prompt).not.toContain("<h1>/");
    expect(result.prompt).not.toContain("<strong>h1");
  });

  it("keeps a bullet list and marks the words inside each item", () => {
    const result = beautifyPromptFields("", "<ul><li>TITULO</li><li>paso 2</li></ul>", []);
    expect(result.prompt.startsWith("<ul><li>")).toBe(true);
    expect(result.prompt).toContain("<li><strong>TITULO</strong></li>");
    expect(result.prompt).toContain("<li>paso <strong>2</strong></li>");
    expect(result.prompt.endsWith("</ul>")).toBe(true);
  });

  it("bolds a question, a caps word, and a word with a number in both fields", () => {
    const result = beautifyPromptFields("¿Listo?", "TITULO paso 2", []);
    expect(result.description).toBe("<strong>¿Listo?</strong>");
    expect(result.prompt).toContain("<strong>TITULO</strong>");
    expect(result.prompt).toContain("<strong>2</strong>");
    expect(result.variables).toEqual([]);
  });
});
