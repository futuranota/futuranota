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

  it("bolds a question, a caps word, and a word with a number in both fields", () => {
    const result = beautifyPromptFields("¿Listo?", "TITULO paso 2", []);
    expect(result.description).toBe("<strong>¿Listo?</strong>");
    expect(result.prompt).toContain("<strong>TITULO</strong>");
    expect(result.prompt).toContain("<strong>2</strong>");
    expect(result.variables).toEqual([]);
  });
});
