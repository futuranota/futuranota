import { describe, expect, it } from "vitest";
import {
  FOLDER_WRITING_LAYOUT_PAGED,
  FOLDER_WRITING_LAYOUT_SCROLL,
  isFolderPagedWriting,
  normalizeFolderWritingLayout,
} from "./folderWritingLayout.js";

describe("folderWritingLayout", () => {
  it("defaults to scroll", () => {
    expect(normalizeFolderWritingLayout(undefined)).toBe(FOLDER_WRITING_LAYOUT_SCROLL);
    expect(normalizeFolderWritingLayout("nope")).toBe(FOLDER_WRITING_LAYOUT_SCROLL);
  });

  it("preserves paged", () => {
    expect(normalizeFolderWritingLayout(FOLDER_WRITING_LAYOUT_PAGED)).toBe(FOLDER_WRITING_LAYOUT_PAGED);
    expect(isFolderPagedWriting(FOLDER_WRITING_LAYOUT_PAGED)).toBe(true);
    expect(isFolderPagedWriting(FOLDER_WRITING_LAYOUT_SCROLL)).toBe(false);
  });
});
