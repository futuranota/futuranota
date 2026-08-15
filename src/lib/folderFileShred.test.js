import { describe, expect, it } from "vitest";
import {
  beginFolderFileDrag,
  dataTransferHasFolderFile,
  endFolderFileDrag,
  FOLDER_FILE_SHRED_MIME,
  getActiveFolderFileDragId,
  readFolderFileDragNodeId,
  writeFolderFileDragData,
} from "./folderFileShred.js";

function fakeDataTransfer(initial = {}) {
  const store = { ...initial };
  return {
    types: Object.keys(store),
    effectAllowed: "none",
    setData(type, value) {
      store[type] = value;
      this.types = Object.keys(store);
    },
    getData(type) {
      return store[type] || "";
    },
  };
}

describe("folderFileShred", () => {
  it("writes and reads a node id from drag data", () => {
    const dt = fakeDataTransfer();
    writeFolderFileDragData(dt, "node-1");
    expect(dt.getData(FOLDER_FILE_SHRED_MIME)).toBe("node-1");
    expect(readFolderFileDragNodeId(dt)).toBe("node-1");
    expect(dataTransferHasFolderFile(dt)).toBe(true);
  });

  it("tracks the active drag id for dragover (getData empty)", () => {
    beginFolderFileDrag("node-2");
    expect(getActiveFolderFileDragId()).toBe("node-2");
    expect(dataTransferHasFolderFile(fakeDataTransfer())).toBe(true);
    endFolderFileDrag();
    expect(getActiveFolderFileDragId()).toBe(null);
  });
});
