import { describe, expect, it } from "vitest";
import { buildWorkspaceScanReport } from "./workspaceRecovery.js";

describe("buildWorkspaceScanReport", () => {
  it("returns a structured report object (not undefined)", () => {
    const report = buildWorkspaceScanReport({
      query: "qloop",
      snapshot: {
        objects: {
          "OBJ-GUEST": { id: "OBJ-GUEST", name: "Home depot", role: "guest" },
        },
        docs: {
          "DOC-QL": {
            id: "DOC-QL",
            title: "Qloop",
            category: "secciones",
            parentObjectId: "OBJ-GUEST",
            nodeIds: ["NODE-1"],
            blocks: [],
          },
        },
        nodes: {
          "NODE-1": {
            id: "NODE-1",
            title: "Doc uno",
            parentDocId: "DOC-QL",
            content: "body",
          },
          "NODE-2": {
            id: "NODE-2",
            title: "Doc dos",
            parentDocId: "DOC-QL",
            content: "body",
          },
        },
      },
      ledger: {
        companies: ["OBJ-GUEST"],
        docs: ["DOC-QL"],
        nodes: ["NODE-1", "NODE-2"],
      },
      live: { docs: {}, nodes: {}, objects: {} },
    });

    expect(report.ok).toBe(true);
    expect(report.snapshot.folders).toHaveLength(1);
    expect(report.snapshot.folders[0].title).toBe("Qloop");
    expect(report.tombstones.companies).toContain("OBJ-GUEST");
    expect(report.recoverable.folders[0].id).toBe("DOC-QL");
    expect(report.hints.length).toBeGreaterThan(0);
  });

  it("finds child nodes linked by parentDocId", () => {
    const report = buildWorkspaceScanReport({
      query: "",
      snapshot: {
        docs: {
          "DOC-A": {
            id: "DOC-A",
            title: "Box",
            parentObjectId: "OBJ-1",
            nodeIds: [],
            blocks: [],
          },
        },
        nodes: {
          "NODE-X": { id: "NODE-X", title: "Inside", parentDocId: "DOC-A" },
        },
      },
      ledger: { companies: [], docs: [], nodes: [] },
      live: { docs: {}, nodes: {}, objects: {} },
    });

    expect(report.snapshot.folders[0].childCount).toBe(1);
    expect(report.snapshot.folders[0].children[0].id).toBe("NODE-X");
  });
});
