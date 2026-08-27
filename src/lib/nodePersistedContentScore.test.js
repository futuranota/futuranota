import { describe, expect, it } from "vitest";
import {
  isLinkedFolderChildNode,
  nodeEntityPersistedContentCharCount,
  nodeHasPersistedContent,
  nodePersistedContentCharCount,
} from "./nodePersistedContentScore.js";

describe("nodePersistedContentCharCount", () => {
  it("measures plain string content", () => {
    expect(nodePersistedContentCharCount("hello")).toBe(5);
  });

  it("measures node-body code blocks (not [object Object])", () => {
    const count = nodePersistedContentCharCount({
      kind: "node-body",
      blocks: [
        {
          id: "NCD-1",
          type: "code",
          language: "markdown",
          code: "export function Toggle() { return null }",
          codeSaved: true,
        },
        { id: "NTX-1", type: "text", text: "" },
      ],
    });
    expect(count).toBeGreaterThan(30);
    expect(count).not.toBe(15);
  });
});

describe("nodeEntityPersistedContentCharCount", () => {
  it("includes title and body", () => {
    const n = nodeEntityPersistedContentCharCount({
      title: "Doc",
      content: {
        kind: "node-body",
        blocks: [{ id: "NCD-1", type: "code", code: "const x = 1", codeSaved: true }],
      },
    });
    expect(n).toBeGreaterThan("Doc".length + "const x = 1".length - 1);
  });
});

describe("nodeHasPersistedContent / isLinkedFolderChildNode", () => {
  it("detects linked folder child with code body", () => {
    const node = {
      parentDocId: "DOC-1",
      linkedToDoc: true,
      title: "Jueves 27th ( code )",
      content: {
        kind: "node-body",
        blocks: [{ type: "code", code: "// snippet", codeSaved: true }],
      },
    };
    expect(nodeHasPersistedContent(node)).toBe(true);
    expect(isLinkedFolderChildNode(node)).toBe(true);
  });
});
