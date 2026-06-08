import { useCallback } from "react";
import { useI18n } from "./useI18n.js";

/** @typedef {'Objects' | 'Documents' | 'Nodes'} PanelType */

const PANEL_TYPE_KEYS = {
  Objects: "sidebar.panelObjects",
  Documents: "sidebar.panelDocuments",
  Nodes: "sidebar.panelNodes",
};

/**
 * @param {PanelType} type
 */
export function usePanelTypeLabel(type) {
  const { t } = useI18n();
  return t(PANEL_TYPE_KEYS[type] || "sidebar.panelObjects");
}

export function usePanelTypeLabels() {
  const { t } = useI18n();
  return useCallback((type) => t(PANEL_TYPE_KEYS[type] || type), [t]);
}

export const PANEL_TYPES = /** @type {const} */ (["Objects", "Documents", "Nodes"]);
