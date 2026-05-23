/** @param {import('../types/docs.js').Doc & { subsections?: Array<{ nodeId: string, content?: string }> }} doc */
export function getDocSubsection(doc, nodeId) {
  return (doc.subsections || []).find((sub) => sub.nodeId === nodeId);
}

export function getDocNodeIds(doc) {
  return doc.nodeIds || (doc.subsections || []).map((sub) => sub.nodeId);
}

export function updateSubsectionContent(doc, nodeId, content) {
  const subsections = doc.subsections || [];
  if (!subsections.length) {
    return { ...doc, nodeIds: doc.nodeIds || [] };
  }
  return {
    ...doc,
    subsections: subsections.map((sub) =>
      sub.nodeId === nodeId ? { ...sub, content } : sub,
    ),
  };
}
