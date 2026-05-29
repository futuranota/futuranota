/** Link color presets for nodes belonging to a document. */
export const DOC_NODE_LINK_COLORS = [
  { id: "mint", label: "Mint", stroke: "#85da99", soft: "rgba(133, 218, 153, 0.12)" },
  { id: "rose", label: "Rose", stroke: "#c7a1a1", soft: "rgba(199, 161, 161, 0.12)" },
  { id: "dark", label: "Dark", stroke: "#212121", soft: "rgba(33, 33, 33, 0.35)" },
];

const DEFAULT_NODE_LINK_COLOR = DOC_NODE_LINK_COLORS[0];

export function normalizeNodeLinkColorId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return DOC_NODE_LINK_COLORS.some((c) => c.id === id) ? id : DEFAULT_NODE_LINK_COLOR.id;
}

export function getDocNodeLinkColorPreset(id) {
  const normalized = normalizeNodeLinkColorId(id);
  return DOC_NODE_LINK_COLORS.find((c) => c.id === normalized) || DEFAULT_NODE_LINK_COLOR;
}

function linkColorFromEntity(entity, docsById) {
  if (!entity?.parentDocId) return null;
  const doc = docsById[entity.parentDocId];
  if (!doc) return null;
  return getDocNodeLinkColorPreset(doc.nodeLinkColor).stroke;
}

/** Resolve wire stroke from a query block on either endpoint. */
export function resolveConnectionLinkColor(fromNode, toNode, { nodeEntitiesById = {}, docsById = {} } = {}) {
  for (const node of [fromNode, toNode]) {
    if (!node?.noteId) continue;
    const entity = nodeEntitiesById[node.noteId];
    const color = linkColorFromEntity(entity, docsById);
    if (color) return color;
  }
  return null;
}
