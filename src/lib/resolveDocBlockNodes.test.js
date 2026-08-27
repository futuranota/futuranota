import { describe, expect, it } from "vitest";
import { repairDocNodeLinks, resolveNodesForDoc } from "./resolveDocBlockNodes.js";

describe("repairDocNodeLinks", () => {
  it("adds parentDocId-linked nodes to doc.nodeIds even without block refs", () => {
    const docs = {
      "DOC-FOLDER": { id: "DOC-FOLDER", title: "21st dev", blocks: [], nodeIds: [] },
    };
    const nodes = {
      "NODE-CHILD": {
        id: "NODE-CHILD",
        parentDocId: "DOC-FOLDER",
        linkedToDoc: true,
        title: "Jueves 27th ( code )",
        content: {
          kind: "node-body",
          blocks: [{ type: "code", code: "// toggle", codeSaved: true }],
        },
      },
    };

    const repaired = repairDocNodeLinks(docs, nodes);
    expect(repaired).not.toBeNull();
    expect(repaired.docs["DOC-FOLDER"].nodeIds).toContain("NODE-CHILD");

    const listed = resolveNodesForDoc(repaired.docs["DOC-FOLDER"], nodes);
    expect(listed.map((n) => n.id)).toContain("NODE-CHILD");
  });
});
