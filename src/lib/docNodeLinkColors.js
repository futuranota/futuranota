/** Link color presets for documents — white = queries without node links. */
export const DOC_NODE_LINK_COLORS = [
  { id: "mint", label: "Mint", stroke: "#85da99", soft: "rgba(133, 218, 153, 0.12)" },
  { id: "sky", label: "Sky", stroke: "#B9E5FE", soft: "rgba(185, 229, 254, 0.12)" },
  { id: "rose", label: "Pink", stroke: "#c7a1a1", soft: "rgba(199, 161, 161, 0.12)" },
  { id: "white", label: "White", stroke: "#ffffff", soft: "rgba(255, 255, 255, 0.14)" },
];

export const NO_NODE_LINK_COLOR_ID = "white";

/** Legacy id → current id (persisted docs may still say "dark"). */
const LEGACY_NODE_LINK_COLOR_IDS = {
  dark: "white",
};

const DEFAULT_NODE_LINK_COLOR = DOC_NODE_LINK_COLORS.find((c) => c.id === NO_NODE_LINK_COLOR_ID)
  || DOC_NODE_LINK_COLORS[0];

export function isNoNodeLinkMode(nodeLinkColor) {
  return normalizeNodeLinkColorId(nodeLinkColor) === NO_NODE_LINK_COLOR_ID;
}

export function normalizeNodeLinkColorId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const id = LEGACY_NODE_LINK_COLOR_IDS[raw] || raw;
  return DOC_NODE_LINK_COLORS.some((c) => c.id === id) ? id : DEFAULT_NODE_LINK_COLOR.id;
}

export function getDocNodeLinkColorPreset(id) {
  const normalized = normalizeNodeLinkColorId(id);
  return DOC_NODE_LINK_COLORS.find((c) => c.id === normalized) || DEFAULT_NODE_LINK_COLOR;
}

/** Per-title link color; unset blocks stay unlinked (white / no handle). */
export function resolveBlockNodeLinkColor(block) {
  return normalizeNodeLinkColorId(block?.nodeLinkColor ?? NO_NODE_LINK_COLOR_ID);
}

/** Node→doc sync: inherit doc color, or mint when the doc has node links disabled. */
export function resolveAdoptedBlockNodeLinkColor(doc) {
  const docColor = normalizeNodeLinkColorId(doc?.nodeLinkColor);
  if (!isNoNodeLinkMode(docColor)) return docColor;
  return "mint";
}

function linkColorFromEntity(entity, docsById) {
  if (!entity?.parentDocId) return null;
  const doc = docsById[entity.parentDocId];
  if (!doc) return null;

  if (entity.sourceBlockId && Array.isArray(doc.blocks)) {
    const block = doc.blocks.find((b) => b?.id === entity.sourceBlockId);
    if (block) {
      const blockColor = resolveBlockNodeLinkColor(block);
      if (isNoNodeLinkMode(blockColor)) return null;
      return getDocNodeLinkColorPreset(blockColor).stroke;
    }
  }

  if (isNoNodeLinkMode(doc.nodeLinkColor)) return null;
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
