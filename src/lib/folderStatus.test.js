import { describe, expect, it } from "vitest";
import { resolveFolderStatus } from "./folderStatus.js";

describe("resolveFolderStatus priority", () => {
  const folderId = "folder-1";

  it("returns submitted when any child is submitted", () => {
    const nodes = [
      { parentDocId: folderId, status: "in_progress", completed: false },
      { parentDocId: folderId, status: "submitted", completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("submitted");
  });

  it("returns in_progress when any child is in progress and none submitted", () => {
    const nodes = [
      { parentDocId: folderId, status: "in_progress", completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("in_progress");
  });

  it("returns completed when every child is completed", () => {
    const nodes = [
      { parentDocId: folderId, status: "completed", completed: true },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId)).toEqual({
      status: "completed",
      total: 2,
      done: 2,
      percent: 100,
    });
  });

  it("migrates legacy in_review children to submitted priority", () => {
    const nodes = [
      { parentDocId: folderId, status: "in_review", completed: false },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("submitted");
  });

  it("returns not_started when children have no active work status", () => {
    const nodes = [
      { parentDocId: folderId, status: null, completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("not_started");
  });
});
