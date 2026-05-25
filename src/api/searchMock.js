const PROVIDER_NAMES = {
  claude: "Claude (Anthropic)",
  groq: "Groq / LLaMA",
  gemini: "Gemini (Google)",
  google: "Google Search",
};

export async function mockSearch({ query, provider = "claude", objectContext = null }) {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));

  const ctx = objectContext ? `Contexto: ${objectContext}\n\n` : "";
  const name = PROVIDER_NAMES[provider] || provider;

  const demos = {
    claude: `${ctx}**${name}** sobre "${query}":\n\nEste concepto es central en marcos de conocimiento orientados a objetos. "${query}" describe un proceso iterativo donde el usuario construye conocimiento a través de objetos relacionados. La clave está en la trazabilidad: cada pregunta genera un nodo, cada nodo conecta al canvas, y el conjunto forma una red semántica.\n\nCaracterísticas:\n- Persistencia entre sesiones\n- Conexiones bidireccionales\n- Contexto acumulativo`,

    groq: `${ctx}**${name}** sobre "${query}":\n\n"${query}" es una unidad atómica de conocimiento. En sistemas PKM (Personal Knowledge Management), se refiere a información estructurada que puede enlazarse con otras unidades para formar grafos.\n\nVentajas: velocidad de recuperación, modularidad, composabilidad.`,

    gemini: `${ctx}**${name}** sobre "${query}":\n\nBasado en fuentes múltiples, "${query}" aparece frecuentemente en contextos de diseño de sistemas de información. Las referencias apuntan a metodologías como Zettelkasten y grafos de conocimiento como antecedentes relevantes.\n\nFuentes: Wikipedia, docs de Obsidian, guías de Notion.`,

    google: `${ctx}**${name}** — Resultados para: "${query}"\n\n1. ${query} — descripción general y conceptos base\n2. Cómo aplicar "${query}" en sistemas modernos\n3. ${query}: guía práctica paso a paso\n4. Diferencias entre "${query}" y enfoques similares\n5. Videos: tutorial de "${query}"`,
  };

  return demos[provider] || demos.claude;
}
