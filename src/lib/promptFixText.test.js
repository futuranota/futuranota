import { describe, expect, it } from "vitest";
import { fixPromptText } from "./promptFixText.js";

describe("fixPromptText", () => {
  it("joins a sentence split across wrapped lines", () => {
    const painted = fixPromptText(
      "Perfecto para conectar con los deseos\nprofundos del comprador sin sonar robótico.",
    );
    expect(painted).toBe("Perfecto para conectar con los deseos profundos del comprador sin sonar robótico.");
  });

  it("puts each label+bracket on its own line and splits numbered items without bullets", () => {
    const source = [
      "- Audiencia Objetivo: [CLIENTE_IDEAL] Instrucciones: 1. Redacta un párrafo",
      "emotivo (máximo 65 palabras) enfocado en cómo [TU_NICHO_O_PRODUCTO] le brinda",
      "[BENEFICIO_PRINCIPAL] a [CLIENTE_IDEAL]. 2. Agrega una llamada a la acción (CTA) directa que",
      "invite a hacer clic o copiar un código interactivo de descuento.",
    ].join("\n");
    const painted = fixPromptText(source);
    expect(painted).toContain("<strong>Audiencia Objetivo:</strong> [CLIENTE_IDEAL]");
    expect(painted).toContain("<strong>Instrucciones:</strong>");
    expect(painted).toMatch(/\[CLIENTE_IDEAL\]\n<strong>Instrucciones:<\/strong>/);
    expect(painted).toContain("\n1. Redacta un párrafo emotivo (máximo 65 palabras) enfocado en cómo [TU_NICHO_O_PRODUCTO] le brinda [BENEFICIO_PRINCIPAL] a [CLIENTE_IDEAL].");
    expect(painted).toContain("\n2. Agrega una llamada a la acción (CTA) directa que invite a hacer clic o copiar un código interactivo de descuento.");
    expect(painted).not.toContain("<ul>");
    expect(painted).not.toContain("<li>");
  });

  it("keeps a dashed label with its bracket on one line", () => {
    const painted = fixPromptText(
      "Nicho o Tipo de Producto: [TU_NICHO_O_PRODUCTO] Beneficio / Transformación Principal: [BENEFICIO_PRINCIPAL]",
    );
    expect(painted).toContain("<strong>Nicho o Tipo de Producto:</strong> [TU_NICHO_O_PRODUCTO]");
    expect(painted).toContain("<strong>Beneficio / Transformación Principal:</strong> [BENEFICIO_PRINCIPAL]");
    expect(painted).toMatch(/\[TU_NICHO_O_PRODUCTO\]\n<strong>Beneficio/);
  });

  it("joins a wrapped bracket back onto its label", () => {
    const painted = fixPromptText("Beneficio / Transformación Principal:\n[BENEFICIO_PRINCIPAL]");
    expect(painted).toBe("<strong>Beneficio / Transformación Principal:</strong> [BENEFICIO_PRINCIPAL]");
  });

  it("drops a long value under the label", () => {
    const painted = fixPromptText(
      "Dudas u Objeción de Compra: El cliente cree que es caro y no ve el valor todavía.",
    );
    expect(painted).toBe(
      "<strong>Dudas u Objeción de Compra:</strong>\nEl cliente cree que es caro y no ve el valor todavía.",
    );
  });

  it("repairs split accents and does not glue a real hyphenated word", () => {
    expect(fixPromptText("Una estructura l ó gica")).toContain("lógica");
    expect(fixPromptText("Cierre e-commerce listo")).toContain("e-commerce");
  });

  it("leaves an existing headline block and stays stable on a second pass", () => {
    const once = fixPromptText("<h1>Pasos</h1>\nAudiencia Objetivo: hola");
    expect(once.startsWith("<h1>Pasos</h1>")).toBe(true);
    expect(once).toContain("<strong>Audiencia Objetivo:</strong>");
    expect(once).toContain("\nhola");
    expect(fixPromptText(once)).toBe(once);
  });
});
