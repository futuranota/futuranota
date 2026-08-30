import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  TRASH_ARCHIVE_KEY,
  archiveFolderDelete,
  listTrashItems,
  restoreTrashEntry,
} from "./workspaceTrashArchive.js";

describe("workspaceTrashArchive", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("archives a folder delete and lists it in trash", () => {
    archiveFolderDelete(
      {
        id: "DOC-1",
        title: "Qloop",
        category: "secciones",
        parentObjectId: "OBJ-1",
        nodeIds: ["NODE-1"],
        blocks: [],
      },
      [{ id: "NODE-1", title: "Doc uno", parentDocId: "DOC-1" }],
    );

    const items = listTrashItems({ query: "qloop" });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Qloop");
    expect(items[0].documentCount).toBe(1);

    const raw = JSON.parse(localStorage.getItem(TRASH_ARCHIVE_KEY) || "{}");
    expect(raw.entries["DOC-1"].kind).toBe("folder");
  });

  it("returns empty list when trash is empty", () => {
    expect(listTrashItems()).toEqual([]);
  });

  it("restore returns not-in-trash for unknown id", () => {
    expect(restoreTrashEntry("missing")).toEqual({
      ok: false,
      reason: "not-in-trash",
      entryId: "missing",
    });
  });
});
