/**
 * Regla de oro: propagar cambios entre capas cuando hay link explícito.
 */

export function injectNodeAnswerIntoDocBody(docBody, source, answerText) {
  const body = docBody || "";
  if (!source?.query) {
    return body + (body.endsWith("\n") ? "" : "\n") + `- ${answerText}\n`;
  }
  const marker = `\n- ${source.query} → ${answerText}\n`;
  if (body.includes(source.query)) {
    return body.replace(source.query, `${source.query} → ${answerText}`);
  }
  return body + marker;
}

export function nodePatchFromCanvasNode(canvasNode) {
  return {
    title: canvasNode.title,
    dataType: canvasNode.dataType,
    content: canvasNode.content,
  };
}

export function canvasNodePatchFromNode(node) {
  return {
    title: (node.title || "NOTE").toUpperCase().slice(0, 20),
    dataType: node.dataType,
    content: node.content,
  };
}
