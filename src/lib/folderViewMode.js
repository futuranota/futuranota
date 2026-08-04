/** Per-folder document presentation: Story (descriptive) or Quick (color link). */
export const FOLDER_VIEW_MODE_STORY = "story";
export const FOLDER_VIEW_MODE_QUICK = "quick";

export function normalizeFolderViewMode(value) {
  if (value === FOLDER_VIEW_MODE_STORY) return FOLDER_VIEW_MODE_STORY;
  if (value === FOLDER_VIEW_MODE_QUICK) return FOLDER_VIEW_MODE_QUICK;
  // Unset / invalid → Quick (new folders default to Title + Direct Link).
  return FOLDER_VIEW_MODE_QUICK;
}

export function isFolderQuickView(viewMode) {
  return normalizeFolderViewMode(viewMode) === FOLDER_VIEW_MODE_QUICK;
}

export function isFolderStoryView(viewMode) {
  return normalizeFolderViewMode(viewMode) === FOLDER_VIEW_MODE_STORY;
}
