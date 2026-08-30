import { describe, expect, it } from "vitest";
import { resolveLibraryPickerContext } from "../hooks/useLibraryImagePickerCreate.js";

describe("resolveLibraryPickerContext", () => {
  it("uses document as primary when libraryOwnerKind is document", () => {
    const ctx = resolveLibraryPickerContext({
      libraryOwnerKind: "document",
      libraryOwnerId: "doc1",
      folderLibraryId: "folder1",
    });
    expect(ctx.pickerDocumentId).toBe("doc1");
    expect(ctx.pickerFolderId).toBe("folder1");
    expect(ctx.pickerPrimaryKind).toBe("document");
    expect(ctx.pickerPrimaryId).toBe("doc1");
  });

  it("uses folder as primary when libraryOwnerKind is folder", () => {
    const ctx = resolveLibraryPickerContext({
      libraryOwnerKind: "folder",
      libraryOwnerId: "folder1",
      folderLibraryId: "folder1",
    });
    expect(ctx.pickerDocumentId).toBe("");
    expect(ctx.pickerFolderId).toBe("folder1");
    expect(ctx.pickerPrimaryKind).toBe("folder");
    expect(ctx.pickerPrimaryId).toBe("folder1");
  });
});
