import {
  NO_NODE_LINK_COLOR_ID,
  normalizeNodeLinkColorId,
} from "./docNodeLinkColors.js";

/** Specs panel themes keyed by document node-link color id (E2E2E2 excluded — not a node). */
export const SPECS_CARD_PANEL_BY_NODE_COLOR = {
  rose: {
    surface: "#EACDCC",
    text: "#764F4F",
    label: "#9a7373",
    stroke: "#d4b4b2",
  },
  sky: {
    surface: "#CEECFF",
    text: "#000000",
    label: "#4a4a4a",
    stroke: "#b8dff5",
  },
  mint: {
    surface: "#B7F4C6",
    text: "#024A06",
    label: "#3a7a42",
    stroke: "#9eddb0",
  },
  white: {
    surface: "#505152",
    text: "#9a9b9f",
    label: "#9a9b9f",
    stroke: "#3f4041",
  },
};

export function getSpecsCardPanelTheme(linkColorId) {
  const id = normalizeNodeLinkColorId(linkColorId);
  return SPECS_CARD_PANEL_BY_NODE_COLOR[id] || SPECS_CARD_PANEL_BY_NODE_COLOR.white;
}

export function specsCardPanelThemeToStyle(theme) {
  if (!theme) return undefined;
  return {
    "--specs-card-stroke": theme.stroke,
    "--specs-card-surface": theme.surface,
    "--specs-card-text": theme.text,
    "--specs-card-label": theme.label,
    "--scroll-bg": theme.surface,
    "--scroll-thumb": `color-mix(in oklab, ${theme.text} 22%, transparent)`,
  };
}

/** Live color while editing: block override, else doc default. */
export function resolveSpecsCardActiveLinkColorId(block, docNodeLinkColor) {
  if (block?.nodeLinkColor != null && String(block.nodeLinkColor).trim() !== "") {
    return normalizeNodeLinkColorId(block.nodeLinkColor);
  }
  if (docNodeLinkColor != null && String(docNodeLinkColor).trim() !== "") {
    return normalizeNodeLinkColorId(docNodeLinkColor);
  }
  return NO_NODE_LINK_COLOR_ID;
}

/** Panel paint: frozen when saved; live resolver while editing. */
export function resolveSpecsCardPanelLinkColorId(block, docNodeLinkColor) {
  if (Boolean(block?.specsSaved)) {
    if (block?.panelLinkColor != null && String(block.panelLinkColor).trim() !== "") {
      return normalizeNodeLinkColorId(block.panelLinkColor);
    }
    if (block?.nodeLinkColor != null && String(block.nodeLinkColor).trim() !== "") {
      return normalizeNodeLinkColorId(block.nodeLinkColor);
    }
    return NO_NODE_LINK_COLOR_ID;
  }
  return resolveSpecsCardActiveLinkColorId(block, docNodeLinkColor);
}

export function resolveSpecsCardPanelStyle(block, docNodeLinkColor) {
  const linkColorId = resolveSpecsCardPanelLinkColorId(block, docNodeLinkColor);
  return specsCardPanelThemeToStyle(getSpecsCardPanelTheme(linkColorId));
}
