/** Get trimmed selection from document or a specific root element */
export function getSelectedText(root = document) {
  const sel = root.getSelection?.() || window.getSelection?.();
  return sel?.toString().trim() || "";
}

/**
 * Build node payload from doc text selection (Parte 1 flujo 3)
 * @param {{ query: string, dataType?: string, content?: unknown, title?: string }} input
 */
export function buildNodeFromSelection(input) {
  const query = input.query?.trim();
  if (!query) return null;
  return {
    title: input.title?.trim() || query,
    dataType: input.dataType || "text",
    content: input.content ?? "",
    source: { query },
  };
}
