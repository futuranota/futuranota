/** Per-folder document presentation: Story (descriptive) or Quick (color link). */
export const FOLDER_VIEW_MODE_STORY = "story";
export const FOLDER_VIEW_MODE_QUICK = "quick";

export function normalizeFolderViewMode(value) {
  return value === FOLDER_VIEW_MODE_QUICK
    ? FOLDER_VIEW_MODE_QUICK
    : FOLDER_VIEW_MODE_STORY;
}

export function isFolderQuickView(viewMode) {
  return normalizeFolderViewMode(viewMode) === FOLDER_VIEW_MODE_QUICK;
}

export function isFolderStoryView(viewMode) {
  return normalizeFolderViewMode(viewMode) === FOLDER_VIEW_MODE_STORY;
}
