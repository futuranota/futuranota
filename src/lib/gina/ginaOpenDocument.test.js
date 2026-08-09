import { describe, expect, it } from "vitest";
import { buildGinaDocumentOpenPlan } from "./ginaOpenDocument.js";

describe("buildGinaDocumentOpenPlan", () => {
  const departments = [{ id: "d1", category: "Marketing" }];
  const docsMap = {
    f1: {
      id: "f1",
      title: "Horizon",
      category: "Blogs",
      departmentId: "d1",
    },
  };
  const nodesMap = {
    n1: {
      id: "n1",
      title: "Post A",
      parentDocId: "f1",
    },
    orphan: {
      id: "orphan",
      title: "Loose",
      parentDocId: null,
    },
  };

  it("builds Documents navigate + node open without requiring docs[nodeId]", () => {
    const plan = buildGinaDocumentOpenPlan("n1", {
      nodesMap,
      docsMap,
      departments,
      unassignedDepartmentId: "unassigned",
      findDepartmentById: (list, id) => list.find((d) => d.id === id) || null,
    });

    expect(plan).toMatchObject({
      kind: "node",
      targetId: "n1",
      title: "Post A",
      path: "Marketing / Blogs / Horizon / Post A",
    });
    expect(plan.navigate).toEqual({
      panel: "Documents",
      clickFolderView: "subgroups",
      departmentId: "d1",
      category: "Blogs",
      folderId: "f1",
      highlightNodeId: "n1",
    });
    expect(docsMap.n1).toBeUndefined();
  });

  it("still opens a node when folder/dept is missing", () => {
    const plan = buildGinaDocumentOpenPlan("orphan", {
      nodesMap,
      docsMap,
      departments,
      findDepartmentById: () => null,
    });
    expect(plan).toMatchObject({
      kind: "node",
      targetId: "orphan",
      title: "Loose",
      navigate: null,
    });
  });

  it("supports folder ids as a fallback", () => {
    const plan = buildGinaDocumentOpenPlan("f1", {
      nodesMap,
      docsMap,
      departments,
      unassignedDepartmentId: "unassigned",
      findDepartmentById: (list, id) => list.find((d) => d.id === id) || null,
    });
    expect(plan).toMatchObject({
      kind: "folder",
      targetId: "f1",
      title: "Horizon",
      path: "Marketing / Blogs / Horizon",
      navigate: {
        folderId: "f1",
        highlightNodeId: null,
      },
    });
  });
});
