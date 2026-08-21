import { describe, expect, it } from "vitest";
import { planWorkspaceTreeEntries } from "./exportWorkspaceTreeZip.js";
import { NODE_BODY_KIND } from "./nodeInlineContent.js";

function textNode(id, title, text, parentDocId = null) {
  return {
    id,
    title,
    sourceQuery: title,
    parentDocId,
    content: {
      kind: NODE_BODY_KIND,
      blocks: [
        { id: `${id}-t`, type: "text", text },
      ],
    },
  };
}

function emptyNode(id, title, parentDocId) {
  return {
    id,
    title,
    sourceQuery: title,
    parentDocId,
    content: {
      kind: NODE_BODY_KIND,
      blocks: [{ id: `${id}-t`, type: "text", text: "" }],
    },
  };
}

describe("planWorkspaceTreeEntries", () => {
  it("nests documents under company/folder and skips empty", () => {
    const entries = planWorkspaceTreeEntries({
      objects: {
        o1: { id: "o1", name: "Acme Co" },
      },
      docs: {
        f1: { id: "f1", title: "Marketing", parentObjectId: "o1", docKind: "content" },
      },
      nodes: {
        n1: textNode("n1", "Brief", "Ship tomorrow", "f1"),
        n2: emptyNode("n2", "Empty", "f1"),
        n3: textNode("n3", "Loose", "No folder note", null),
      },
    });

    expect(entries.map((e) => e.zipPath)).toEqual([
      "Acme-Co/Marketing/Brief.pdf",
      "_unfiled/Loose.pdf",
    ]);
    expect(entries.find((e) => e.nodeId === "n2")).toBeUndefined();
  });

  it("dedupes colliding document titles in the same folder", () => {
    const entries = planWorkspaceTreeEntries({
      objects: { o1: { id: "o1", name: "Brand" } },
      docs: {
        f1: { id: "f1", title: "Sales", parentObjectId: "o1", docKind: "content" },
      },
      nodes: {
        a: textNode("a", "Pitch", "One", "f1"),
        b: textNode("b", "Pitch", "Two", "f1"),
      },
    });
    expect(entries.map((e) => e.zipPath)).toEqual([
      "Brand/Sales/Pitch.pdf",
      "Brand/Sales/Pitch-2.pdf",
    ]);
  });
});
