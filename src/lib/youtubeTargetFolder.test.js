import { beforeEach, describe, expect, it } from "vitest";
import {
  YOUTUBE_TARGET_FOLDER_KEY,
  clearYoutubeTargetFolderId,
  getYoutubeTargetFolderId,
  resolveValidYoutubeTargetFolderId,
  setYoutubeTargetFolderId,
} from "./youtubeTargetFolder.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("youtubeTargetFolder", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and reads a folder id per company", () => {
    setYoutubeTargetFolderId("co-a", "folder-1");
    setYoutubeTargetFolderId("co-b", "folder-2");
    expect(getYoutubeTargetFolderId("co-a")).toBe("folder-1");
    expect(getYoutubeTargetFolderId("co-b")).toBe("folder-2");
    expect(JSON.parse(localStorage.getItem(YOUTUBE_TARGET_FOLDER_KEY))).toEqual({
      "co-a": "folder-1",
      "co-b": "folder-2",
    });
  });

  it("clears a company entry without dropping others", () => {
    setYoutubeTargetFolderId("co-a", "folder-1");
    setYoutubeTargetFolderId("co-b", "folder-2");
    clearYoutubeTargetFolderId("co-a");
    expect(getYoutubeTargetFolderId("co-a")).toBe(null);
    expect(getYoutubeTargetFolderId("co-b")).toBe("folder-2");
  });

  it("drops a stored id when the folder is no longer adoptable", () => {
    setYoutubeTargetFolderId("co-a", "gone");
    const docs = {
      keep: { id: "keep", title: "Keep", parentObjectId: "co-a", docKind: "content" },
    };
    expect(resolveValidYoutubeTargetFolderId("co-a", docs)).toBe(null);
    expect(getYoutubeTargetFolderId("co-a")).toBe(null);
  });

  it("keeps a stored id when the folder is still adoptable", () => {
    setYoutubeTargetFolderId("co-a", "keep");
    const docs = {
      keep: { id: "keep", title: "Keep", parentObjectId: "co-a", docKind: "content" },
    };
    expect(resolveValidYoutubeTargetFolderId("co-a", docs)).toBe("keep");
  });
});
