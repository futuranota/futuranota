import { describe, expect, it, vi } from "vitest";

vi.mock("../stores/middleware/persistenceMiddleware.js", () => ({
  isDocMarkedDeletedForSync: (id) => id === "DOC-DELETED",
  isNodeMarkedDeletedForSync: (id) => id === "NODE-DELETED",
}));

import {
  isWorkspaceFolderVisible,
  isWorkspaceNodeVisible,
} from "./workspaceDeleteRepair.js";

describe("workspaceDeleteRepair — product visibility rule", () => {
  it("hides tombstoned folders from workspace lists", () => {
    expect(isWorkspaceFolderVisible({ id: "DOC-DELETED", title: "Ghost" })).toBe(false);
    expect(isWorkspaceFolderVisible({ id: "DOC-LIVE", title: "Ideas" })).toBe(true);
    expect(isWorkspaceFolderVisible(null)).toBe(false);
  });

  it("hides tombstoned nodes from workspace lists", () => {
    expect(isWorkspaceNodeVisible({ id: "NODE-DELETED" })).toBe(false);
    expect(isWorkspaceNodeVisible({ id: "NODE-LIVE" })).toBe(true);
  });
});
