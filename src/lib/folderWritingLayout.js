/** Per-folder document writing surface: continuous scroll or paged (Hojas). */
export const FOLDER_WRITING_LAYOUT_SCROLL = "scroll";
export const FOLDER_WRITING_LAYOUT_PAGED = "paged";

export function normalizeFolderWritingLayout(value) {
  if (value === FOLDER_WRITING_LAYOUT_PAGED) return FOLDER_WRITING_LAYOUT_PAGED;
  return FOLDER_WRITING_LAYOUT_SCROLL;
}

export function isFolderPagedWriting(value) {
  return normalizeFolderWritingLayout(value) === FOLDER_WRITING_LAYOUT_PAGED;
}
